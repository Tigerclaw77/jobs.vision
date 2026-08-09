require("dotenv").config(); // keep this first

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const helmet = require("helmet");

// Initialize Stripe after dotenv
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require("stripe")(stripeKey) : null;
const stripeSkipVerify = process.env.STRIPE_SKIP_VERIFY === "true";

if (process.env.NODE_ENV === "production" && stripeSkipVerify) {
  throw new Error("STRIPE_SKIP_VERIFY must not be true in production.");
}

const { one, query } = require("./services/db");
const { jobPath } = require("./services/jobSeo");
const {
  getPlanFromSubscription,
  normalizeStripeStatus,
} = require("./services/stripeCatalog");
const {
  markSubscriptionCanceled,
  upsertStripeEntitlement,
} = require("./services/entitlements");
const {
  findRecruiterPostingPaymentBySubscription,
  markRecruiterPostingPaymentCanceled,
  normalizeRecruiterPostingRole,
  upsertRecruiterPostingPayment,
} = require("./services/recruiterPostingPayments");

// ✅ Billing engine
const { billJobsMonthly } = require("./controllers/billingController");

// Express app
const app = express();
app.use(helmet());
console.log("BOOT database configured:", Boolean(process.env.DATABASE_URL));

function apiPaths(path) {
  if (path === "/api") {
    return ["/api", "/"];
  }

  const strippedPath = path.replace(/^\/api(?=\/)/, "");
  return strippedPath === path ? [path] : [path, strippedPath];
}

// =======================
// Stripe Webhook
// =======================
async function findProfileForStripeCustomer(customerId, metadata = {}) {
  if (customerId) {
    const profile = await one(
      "select id from public.profiles where stripe_customer_id = $1",
      [customerId]
    );
    if (profile) return profile;
  }

  const profileId = metadata.profileId || metadata.userId;
  if (!profileId) return null;

  const profile = await one("select id from public.profiles where id = $1", [profileId]);
  if (profile && customerId) {
    await query("update public.profiles set stripe_customer_id = $1 where id = $2", [
      customerId,
      profile.id,
    ]);
  }
  return profile;
}

async function retrieveSubscription(subscriptionId) {
  if (!subscriptionId) return null;
  const id = typeof subscriptionId === "object" ? subscriptionId.id : subscriptionId;
  if (typeof subscriptionId === "object" && subscriptionId?.items?.data?.[0]?.price?.id) {
    return subscriptionId;
  }
  return stripe.subscriptions.retrieve(id, {
    expand: ["items.data.price"],
  });
}

function isRecruiterPostingMetadata(metadata = {}) {
  return (
    metadata.paymentScope === "recruiter_posting" ||
    Boolean(metadata.jobId || metadata.job_id)
  );
}

function firstSubscriptionPrice(subscription = {}) {
  return subscription?.items?.data?.find((item) => item?.price)?.price || null;
}

async function syncRecruiterPostingPayment(subscription, fallbackMetadata = {}) {
  const sub = await retrieveSubscription(subscription);
  if (!sub) {
    console.warn("No subscription found for recruiter posting payment sync.");
    return null;
  }

  const existing = await findRecruiterPostingPaymentBySubscription(sub.id);
  const metadata = {
    ...(existing || {}),
    ...(fallbackMetadata || {}),
    ...(sub.metadata || {}),
  };

  const jobId = metadata.jobId || metadata.job_id;
  if (!jobId) {
    return null;
  }

  const profile = await findProfileForStripeCustomer(sub.customer, metadata);
  const profileId = profile?.id || metadata.profileId || metadata.userId || metadata.profile_id;
  const price = firstSubscriptionPrice(sub);
  const status = normalizeStripeStatus(sub.status);
  const role = normalizeRecruiterPostingRole(metadata.role || existing?.role);
  const requiredPlanKey = metadata.requiredPlanKey || metadata.required_plan_key;

  const payload = await upsertRecruiterPostingPayment({
    jobId,
    profileId,
    role,
    requiredPlanKey,
    status,
    stripeCustomerId: sub.customer,
    stripeCheckoutSessionId:
      metadata.stripeCheckoutSessionId ||
      metadata.stripe_checkout_session_id ||
      existing?.stripe_checkout_session_id,
    stripeSubscriptionId: sub.id,
    stripePriceId: price?.id || existing?.stripe_price_id || null,
    stripeLookupKey: price?.lookup_key || existing?.stripe_lookup_key || null,
  });
  console.log(`Stripe posting payment synced for job ${jobId}`, payload);
  return payload;
}

async function syncSubscriptionEntitlement(subscription, fallbackMetadata = {}) {
  const sub = await retrieveSubscription(subscription);
  if (!sub) {
    console.warn("No subscription found for Stripe entitlement sync.");
    return null;
  }

  const plan = getPlanFromSubscription(sub);
  if (!plan) {
    console.warn("Unmapped Stripe subscription price:", sub.id);
    return null;
  }

  const profile = await findProfileForStripeCustomer(sub.customer, {
    ...(fallbackMetadata || {}),
    ...(sub.metadata || {}),
  });
  if (!profile) {
    console.warn("No profile found for Stripe customer:", sub.customer);
    return null;
  }

  const status = normalizeStripeStatus(sub.status);
  const payload = await upsertStripeEntitlement(profile.id, plan, status, sub.id);
  console.log(`Stripe entitlement synced for ${profile.id}`, payload);
  return payload;
}

// Only mount webhook if Stripe is configured
if (stripe) {
  app.post(
    apiPaths("/api/stripe/webhook"),
    bodyParser.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"];
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      let event;

      try {
        if (stripeSkipVerify) {
          event = JSON.parse(req.body.toString("utf8"));
          console.log("⚠️  Skipping Stripe signature verification (DEV ONLY)");
        } else {
          event = stripe.webhooks.constructEvent(req.body, sig, secret);
        }
      } catch (err) {
        console.error("❌ Webhook verify error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      console.log("✅ Received:", event.type);

      try {
        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object;
            const metadata = {
              ...(session.metadata || {}),
              profileId: session.metadata?.profileId || session.client_reference_id,
              stripeCheckoutSessionId: session.id,
            };
            if (isRecruiterPostingMetadata(metadata)) {
              await syncRecruiterPostingPayment(session.subscription, metadata);
            } else {
              await syncSubscriptionEntitlement(session.subscription, metadata);
            }
            return res.json({ received: true });
          }

          case "invoice.paid": {
            const invoice = event.data.object;
            const sub = await retrieveSubscription(invoice.subscription);
            if (sub && (isRecruiterPostingMetadata(sub.metadata) || (await findRecruiterPostingPaymentBySubscription(sub.id)))) {
              await syncRecruiterPostingPayment(sub);
            } else {
              await syncSubscriptionEntitlement(sub || invoice.subscription);
            }
            return res.json({ received: true });
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object;
            const sub = await retrieveSubscription(invoice.subscription);
            if (sub) {
              sub.status = "past_due";
              if (
                isRecruiterPostingMetadata(sub.metadata) ||
                (await findRecruiterPostingPaymentBySubscription(sub.id))
              ) {
                await syncRecruiterPostingPayment(sub);
              } else {
                await syncSubscriptionEntitlement(sub);
              }
            }
            return res.json({ received: true });
          }

          case "customer.subscription.updated": {
            const sub = await retrieveSubscription(event.data.object);
            if (
              sub &&
              (isRecruiterPostingMetadata(sub.metadata) ||
                (await findRecruiterPostingPaymentBySubscription(sub.id)))
            ) {
              await syncRecruiterPostingPayment(sub);
            } else {
              await syncSubscriptionEntitlement(sub || event.data.object);
            }
            return res.json({ received: true });
          }

          case "customer.subscription.deleted": {
            const sub = event.data.object;
            if (
              isRecruiterPostingMetadata(sub.metadata) ||
              (await findRecruiterPostingPaymentBySubscription(sub.id))
            ) {
              await markRecruiterPostingPaymentCanceled(sub.id, "canceled");
              return res.json({ received: true });
            }

            const profile = await findProfileForStripeCustomer(sub.customer, sub.metadata);
            if (profile) {
              await markSubscriptionCanceled(profile.id, sub.id);
            }

            return res.json({ received: true });
          }

          default:
            console.log(`Unhandled Stripe event type ${event.type}`);
            return res.json({ received: true });
        }
      } catch (err) {
        console.error("Stripe webhook handler error:", err);
        return res.status(500).json({ error: "Stripe webhook handler failed" });
      }

      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;

          try {
            let customerId = session.customer;
            let sub;

            if (!customerId && session.subscription) {
              sub = await stripe.subscriptions.retrieve(session.subscription, {
                expand: ["items.data.price"],
              });
              customerId = sub.customer;
            }

            if (!customerId) {
              console.warn("⚠️ No customerId on session; skipping entitlement.");
              break;
            }

            if (!sub) {
              sub = await stripe.subscriptions.retrieve(session.subscription, {
                expand: ["items.data.price"],
              });
            }
            const priceId = sub?.items?.data?.[0]?.price?.id;
            if (!priceId) {
              console.warn("⚠️ No priceId found on subscription; skipping.");
              break;
            }

            const profile = await one(
              "select id from public.profiles where stripe_customer_id = $1",
              [customerId]
            );
            const pErr = null;

            if (!profile) {
              console.error("❌ No profile for customer:", customerId, pErr);
              break;
            }

            const plan = null;
            if (!plan) {
              console.warn("⚠️ Unmapped price ID:", priceId);
              break;
            }

            const payload = {
              profile_id: profile.id,
              status: "active",
              updated_at: new Date().toISOString(),
              ...plan.values,
            };

            let upErr = null;
            if (plan.table === "recruiter_entitlements") {
              await query(
                `
                  insert into public.recruiter_entitlements
                    (profile_id, status, updated_at, plan, max_active_jobs)
                  values ($1, $2, $3, $4, $5)
                  on conflict (profile_id) do update set
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    plan = excluded.plan,
                    max_active_jobs = excluded.max_active_jobs
                `,
                [
                  payload.profile_id,
                  payload.status,
                  payload.updated_at,
                  payload.plan,
                  payload.max_active_jobs,
                ]
              );
            } else if (plan.table === "candidate_entitlements") {
              await query(
                `
                  insert into public.candidate_entitlements
                    (profile_id, status, updated_at, plan, apply_cap_per_day)
                  values ($1, $2, $3, $4, $5)
                  on conflict (profile_id) do update set
                    status = excluded.status,
                    updated_at = excluded.updated_at,
                    plan = excluded.plan,
                    apply_cap_per_day = excluded.apply_cap_per_day
                `,
                [
                  payload.profile_id,
                  payload.status,
                  payload.updated_at,
                  payload.plan,
                  payload.apply_cap_per_day,
                ]
              );
            }

            if (upErr) console.error("❌ Entitlement upsert error:", upErr);
            else
              console.log(
                `✅ Entitlements updated in ${plan.table} for`,
                profile.id,
                payload
              );
          } catch (err) {
            console.error("❌ checkout.session.completed handler error", err);
          }
          break;
        }

        case "invoice.paid":
          console.log("✅ Invoice paid");
          break;

        case "customer.subscription.updated":
          console.log("🔄 Subscription updated:", event.data.object.id);
          break;

        case "customer.subscription.deleted": {
          const sub = event.data.object;
          const customerId = sub.customer;

          try {
            const profile = await one(
              "select id from public.profiles where stripe_customer_id = $1",
              [customerId]
            );

            if (profile) {
              const updatedAt = new Date().toISOString();

              await query(
                "update public.recruiter_entitlements set status = 'canceled', updated_at = $1 where profile_id = $2",
                [updatedAt, profile.id]
              );

              await query(
                "update public.candidate_entitlements set status = 'canceled', updated_at = $1 where profile_id = $2",
                [updatedAt, profile.id]
              );

              console.log(
                "❌ Subscription canceled, entitlements marked inactive for",
                profile.id
              );
            }
          } catch (err) {
            console.error("❌ customer.subscription.deleted handler error", err);
          }
          break;
        }

        default:
          console.log(`⚠️ Unhandled event type ${event.type}`);
      }

      res.json({ received: true });
    }
  );

  console.log("➡️  Stripe webhook route registered at /api/stripe/webhook");
} else {
  console.warn("⚠️ STRIPE_SECRET_KEY missing — webhook route disabled.");
}

// =======================
// Middleware
// =======================

// CORS setup (allow localhost + prod domain)
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.FRONTEND_URL,          // e.g. https://jobs.vision
  "https://jobs.vision",
  "https://www.jobs.vision",
].filter(Boolean);

function isLocalDevOrigin(origin) {
  if (process.env.NODE_ENV === "production") return false;

  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // server-to-server or curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (isLocalDevOrigin(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
}));
app.options("*", cors());

// JSON body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const stripeRoutes = require("./routes/stripe");
app.use(apiPaths("/api/stripe"), stripeRoutes);

app.get(apiPaths("/api/health"), (_req, res) => {
  res.json({
    ok: true,
    service: "jobs.vision-api",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

function publicSiteOrigin() {
  return (
    process.env.PUBLIC_SITE_URL ||
    process.env.FRONTEND_URL ||
    "https://www.jobs.vision"
  ).replace(/\/+$/, "");
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sitemapDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function sitemapUrl({ loc, lastmod, changefreq, priority }) {
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : "",
    changefreq ? `    <changefreq>${escapeXml(changefreq)}</changefreq>` : "",
    priority ? `    <priority>${escapeXml(priority)}</priority>` : "",
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

app.get(apiPaths("/api/sitemap.xml"), async (_req, res) => {
  try {
    const origin = publicSiteOrigin();
    const corePages = [
      { path: "/", changefreq: "weekly", priority: "1.0" },
      { path: "/jobs", changefreq: "daily", priority: "0.9" },
      { path: "/pricing", changefreq: "monthly", priority: "0.7" },
      { path: "/candidate/register", changefreq: "monthly", priority: "0.7" },
      { path: "/recruiter/register", changefreq: "monthly", priority: "0.7" },
      { path: "/terms", changefreq: "yearly", priority: "0.4" },
      { path: "/privacy", changefreq: "yearly", priority: "0.4" },
      { path: "/contact", changefreq: "yearly", priority: "0.4" },
    ];

    const jobs = await query(
      `
        select
          jobs.id,
          jobs.title,
          jobs.company,
          jobs.employer_name,
          jobs.practice_name,
          jobs.parent_company,
          jobs.location,
          jobs.city,
          jobs.state,
          jobs.updated_at,
          jobs.posted_at,
          jobs.created_at
        from public.jobs jobs
        where jobs.status = 'active'
          and jobs.is_archived = false
          and not exists (
            select 1
            from public.job_imports ji
            where ji.published_job_id = jobs.id
              and (
                ji.status = 'rejected'
                or ji.recommendation = 'reject'
                or ji.review_action = 'reject'
                or coalesce(ji.role_badge, '') = 'OTHER'
              )
          )
        order by coalesce(jobs.updated_at, jobs.posted_at, jobs.created_at) desc
        limit 50000
      `
    );

    const urls = [
      ...corePages.map((page) =>
        sitemapUrl({
          loc: `${origin}${page.path}`,
          changefreq: page.changefreq,
          priority: page.priority,
        })
      ),
      ...(jobs.rows || []).map((job) =>
        sitemapUrl({
          loc: `${origin}${jobPath(job)}`,
          lastmod: sitemapDate(job.updated_at || job.posted_at || job.created_at),
          changefreq: "daily",
          priority: "0.8",
        })
      ),
    ];

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls,
      "</urlset>",
      "",
    ].join("\n");

    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, s-maxage=900");
    return res.send(xml);
  } catch (e) {
    console.error("Sitemap generation error:", e);
    return res.status(500).type("text/plain").send("Failed to generate sitemap");
  }
});

// =======================
// Routes
// =======================
const userRoutes = require("./routes/users");
app.use(apiPaths("/api/users"), userRoutes);

const authRoutes = require("./routes/auth");
app.use(apiPaths("/api/auth"), authRoutes);

const profileRoutes = require("./routes/profile");
app.use(apiPaths("/api/profile"), profileRoutes);

const jobRoutes = require("./routes/jobs");
app.use(apiPaths("/api/jobs"), jobRoutes);

const favoritesRoutes = require("./routes/favorites");
app.use(apiPaths("/api/favorites"), favoritesRoutes);

const applicationsRoutes = require("./routes/applications");
app.use(apiPaths("/api/applications"), applicationsRoutes);

const adminRoutes = require('./routes/admin');
app.use(apiPaths('/api/admin'), adminRoutes);

const notificationsRoutes = require('./routes/notifications');
app.use(apiPaths('/api/notifications'), notificationsRoutes);

const recruiterDomainsRouter = require("./routes/recruiterDomains");
app.use(apiPaths("/api"), recruiterDomainsRouter);

const manualOverrides = require('./routes/manualOverrides.js');
app.use(apiPaths('/api/manual-overrides'), manualOverrides);

const cronRoutes = require("./routes/cron");
app.use(apiPaths("/api/cron"), cronRoutes);

// Welcome
app.get("/", (req, res) => {
  res.send("Welcome to the API! Use endpoints like /api/jobs, /api/favorites, /api/applications");
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: "Endpoint not found" });
});

// =======================
// Cron job (billing engine)
// =======================
if (process.env.ENABLE_IN_PROCESS_CRON === "true") cron.schedule("0 3 * * *", async () => {
  try {
    console.log("🧾 Running daily job billing engine...");
    await billJobsMonthly(
      { body: {}, user: { userRole: "admin" } },
      {
        status: () => ({
          json: (msg) => console.log("✅ Billing engine:", msg),
        }),
      }
    );
  } catch (err) {
    console.error("❌ Billing cron error:", err);
  }
});

// =======================
// Start server
// =======================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
