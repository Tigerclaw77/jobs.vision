const express = require("express");
const { requireAuth } = require("../middleware/auth.js");
const { one, query } = require("../services/db.js");
const { getPlanByKey } = require("../services/stripeCatalog.js");
const {
  getRequiredRecruiterPlanKey,
  normalizeRecruiterPostingRole,
  paymentMetadataForJob,
  upsertRecruiterPostingPayment,
} = require("../services/recruiterPostingPayments.js");

const router = express.Router();

const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require("stripe")(stripeKey) : null;

function frontendUrl() {
  return (process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
}

function roleCanBuyPlan(role, plan) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return true;
  return normalized === plan.audience;
}

async function findActivePriceByLookupKey(lookupKey) {
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [lookupKey],
    limit: 1,
  });

  return prices.data[0] || null;
}

async function getOrCreateCustomer(profile) {
  if (profile.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(profile.stripe_customer_id);
      if (!customer.deleted) return customer.id;
    } catch (err) {
      console.warn("Stripe customer lookup failed; creating a replacement.", err.message);
    }
  }

  const customer = await stripe.customers.create({
    email: profile.email || undefined,
    metadata: {
      app: "jobs.vision",
      profileId: profile.id,
      userId: profile.id,
      role: profile.role || "",
    },
  });

  await query("update public.profiles set stripe_customer_id = $1 where id = $2", [
    customer.id,
    profile.id,
  ]);

  return customer.id;
}

function isAdmin(user = {}) {
  return String(user.role || user.userRole || "").toLowerCase() === "admin";
}

function canCheckoutJob(user = {}, job = {}) {
  if (isAdmin(user)) return true;
  const userId = String(user.id || "");
  return [job.recruiter_id, job.posted_by, job.claimed_by_user_id]
    .filter(Boolean)
    .map(String)
    .includes(userId);
}

router.post("/checkout", requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe is not configured." });
    }

    const requestedPlanKey = String(req.body?.planKey || req.body?.plan || "")
      .trim()
      .toLowerCase();
    let plan = getPlanByKey(requestedPlanKey);
    if (!plan) {
      return res.status(400).json({ error: "Unknown Stripe plan." });
    }

    if (!roleCanBuyPlan(req.user.role, plan)) {
      return res.status(403).json({ error: `This plan is for ${plan.audience}s.` });
    }

    const profile = await one(
      "select id, email, role, stripe_customer_id from public.profiles where id = $1",
      [req.user.id]
    );

    if (!profile) return res.status(404).json({ error: "Profile not found." });

    let recruiterPostingMetadata = null;
    if (plan.audience === "recruiter") {
      const jobId = req.body?.jobId || req.body?.job_id;
      if (!jobId) {
        return res.status(400).json({
          error: "A saved posting is required before recruiter checkout.",
          code: "recruiter_posting_job_required",
        });
      }

      const job = await one(
        `
          select id, recruiter_id, posted_by, claimed_by_user_id, role, status, is_archived
          from public.jobs
          where id = $1
        `,
        [jobId]
      );

      if (!job) {
        return res.status(404).json({ error: "Posting not found." });
      }

      if (!canCheckoutJob(req.user, job)) {
        return res.status(403).json({ error: "You cannot checkout for this posting." });
      }

      if (job.is_archived) {
        return res.status(400).json({ error: "Removed postings cannot be checked out." });
      }

      const role = normalizeRecruiterPostingRole(job.role);
      if (!role) {
        return res.status(400).json({
          error: "Choose a valid posting role before checkout.",
          code: "invalid_job_role",
        });
      }

      const requiredPlanKey = getRequiredRecruiterPlanKey(role);
      if (requestedPlanKey && requestedPlanKey !== requiredPlanKey) {
        return res.status(400).json({
          error: "Checkout plan does not match this posting role.",
          code: "recruiter_posting_plan_mismatch",
          jobId: job.id,
          role,
          requiredPlanKey,
        });
      }

      plan = getPlanByKey(requiredPlanKey);
      recruiterPostingMetadata = paymentMetadataForJob({
        jobId: job.id,
        profileId: profile.id,
        role,
        requiredPlanKey,
      });
    }

    const recurringPrice = await findActivePriceByLookupKey(plan.recurringLookupKey);
    if (!recurringPrice) {
      return res.status(503).json({
        error: "Stripe price is missing. Run the Stripe setup script first.",
        lookupKey: plan.recurringLookupKey,
      });
    }

    const lineItems = [{ price: recurringPrice.id, quantity: 1 }];

    if (plan.firstMonthAdjustmentLookupKey) {
      const adjustmentPrice = await findActivePriceByLookupKey(
        plan.firstMonthAdjustmentLookupKey
      );
      if (!adjustmentPrice) {
        return res.status(503).json({
          error: "Stripe first-month adjustment price is missing. Run the Stripe setup script first.",
          lookupKey: plan.firstMonthAdjustmentLookupKey,
        });
      }
      lineItems.push({ price: adjustmentPrice.id, quantity: 1 });
    }

    const customerId = await getOrCreateCustomer(profile);
    const baseUrl = frontendUrl();
    const successPath =
      plan.audience === "recruiter" && recruiterPostingMetadata?.jobId
        ? `/recruiter/editjob/${encodeURIComponent(recruiterPostingMetadata.jobId)}`
        : plan.audience === "recruiter"
        ? "/recruiter/dashboard"
        : "/profile";
    const cancelPath = plan.audience === "recruiter" ? "/pricing?audience=recruiter" : "/";

    const metadata = {
      app: "jobs.vision",
      userId: profile.id,
      profileId: profile.id,
      productKey: plan.planKey,
      planKey: plan.planKey,
      audience: plan.audience,
      dbPlan: plan.dbPlan,
      ...(recruiterPostingMetadata || {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: profile.id,
      line_items: lineItems,
      allow_promotion_codes: true,
      success_url: `${baseUrl}${successPath}?checkout=success&plan=${encodeURIComponent(
        plan.planKey
      )}${
        recruiterPostingMetadata?.jobId
          ? `&jobId=${encodeURIComponent(recruiterPostingMetadata.jobId)}`
          : ""
      }`,
      cancel_url: `${baseUrl}${cancelPath}${
        cancelPath.includes("?") ? "&" : "?"
      }checkout=cancelled&plan=${encodeURIComponent(plan.planKey)}${
        recruiterPostingMetadata?.jobId
          ? `&jobId=${encodeURIComponent(recruiterPostingMetadata.jobId)}`
          : ""
      }`,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    if (recruiterPostingMetadata) {
      await upsertRecruiterPostingPayment({
        jobId: recruiterPostingMetadata.jobId,
        profileId: profile.id,
        role: recruiterPostingMetadata.role,
        requiredPlanKey: recruiterPostingMetadata.requiredPlanKey,
        status: "incomplete",
        stripeCustomerId: customerId,
        stripeCheckoutSessionId: session.id,
        stripePriceId: recurringPrice.id,
        stripeLookupKey: recurringPrice.lookup_key || plan.recurringLookupKey,
      });
    }

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Create Stripe checkout error:", err);
    return res.status(500).json({ error: "Failed to create Stripe checkout session." });
  }
});

module.exports = router;
