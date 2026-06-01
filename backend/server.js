require("dotenv").config(); // keep this first

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cron = require("node-cron");
const helmet = require("helmet");

// Initialize Stripe after dotenv
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (stripeKey && !stripeKey.startsWith("sk_test_")) {
  throw new Error("Only Stripe test-mode secret keys are supported in this integration pass.");
}
const stripe = stripeKey ? require("stripe")(stripeKey) : null;
const stripeSkipVerify = process.env.STRIPE_SKIP_VERIFY === "true";

if (process.env.NODE_ENV === "production" && stripeSkipVerify) {
  throw new Error("STRIPE_SKIP_VERIFY must not be true in production.");
}

const { one, query } = require("./services/db");
const {
  getPlanFromSubscription,
  normalizeStripeStatus,
} = require("./services/stripeCatalog");
const {
  markSubscriptionCanceled,
  upsertStripeEntitlement,
} = require("./services/entitlements");

// ✅ Billing engine
const { billJobsMonthly } = require("./controllers/billingController");

// Express app
const app = express();
app.use(helmet());
console.log("BOOT database configured:", Boolean(process.env.DATABASE_URL));

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
  if (typeof subscriptionId === "object") return subscriptionId;
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price"],
  });
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
    "/api/stripe/webhook",
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
            await syncSubscriptionEntitlement(session.subscription, {
              ...(session.metadata || {}),
              profileId: session.metadata?.profileId || session.client_reference_id,
            });
            return res.json({ received: true });
          }

          case "invoice.paid": {
            const invoice = event.data.object;
            await syncSubscriptionEntitlement(invoice.subscription);
            return res.json({ received: true });
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object;
            const sub = await retrieveSubscription(invoice.subscription);
            if (sub) {
              sub.status = "past_due";
              await syncSubscriptionEntitlement(sub);
            }
            return res.json({ received: true });
          }

          case "customer.subscription.updated": {
            await syncSubscriptionEntitlement(event.data.object);
            return res.json({ received: true });
          }

          case "customer.subscription.deleted": {
            const sub = event.data.object;
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

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // server-to-server or curl
    if (allowedOrigins.includes(origin)) return cb(null, true);
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
app.use("/api/stripe", stripeRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "jobs.vision-api",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// =======================
// Routes
// =======================
const userRoutes = require("./routes/users");
app.use("/api/users", userRoutes);

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const profileRoutes = require("./routes/profile");
app.use("/api/profile", profileRoutes);

const jobRoutes = require("./routes/jobs");
app.use("/api/jobs", jobRoutes);

const favoritesRoutes = require("./routes/favorites");
app.use("/api/favorites", favoritesRoutes);

const applicationsRoutes = require("./routes/applications");
app.use("/api/applications", applicationsRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const notificationsRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationsRoutes);

const recruiterDomainsRouter = require("./routes/recruiterDomains");
app.use("/api", recruiterDomainsRouter);

const manualOverrides = require('./routes/manualOverrides.js');
app.use('/api/manual-overrides', manualOverrides);

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
cron.schedule("0 3 * * *", async () => {
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
