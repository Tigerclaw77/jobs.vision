const express = require("express");
const { requireAuth } = require("../middleware/auth.js");
const { one, query } = require("../services/db.js");
const { getPlanByKey } = require("../services/stripeCatalog.js");

const router = express.Router();

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (stripeKey && !stripeKey.startsWith("sk_test_")) {
  throw new Error("Only Stripe test-mode secret keys are supported in this integration pass.");
}
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

router.post("/checkout", requireAuth, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ error: "Stripe is not configured." });
    }

    const plan = getPlanByKey(req.body?.planKey || req.body?.plan);
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

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: profile.id,
      line_items: lineItems,
      allow_promotion_codes: true,
      success_url: `${baseUrl}/profile?checkout=success&plan=${encodeURIComponent(
        plan.planKey
      )}`,
      cancel_url: `${baseUrl}/?checkout=cancelled&plan=${encodeURIComponent(plan.planKey)}`,
      metadata: {
        app: "jobs.vision",
        userId: profile.id,
        profileId: profile.id,
        productKey: plan.planKey,
        planKey: plan.planKey,
        audience: plan.audience,
        dbPlan: plan.dbPlan,
      },
      subscription_data: {
        metadata: {
          app: "jobs.vision",
          userId: profile.id,
          profileId: profile.id,
          productKey: plan.planKey,
          planKey: plan.planKey,
          audience: plan.audience,
          dbPlan: plan.dbPlan,
        },
      },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error("Create Stripe checkout error:", err);
    return res.status(500).json({ error: "Failed to create Stripe checkout session." });
  }
});

module.exports = router;
