// backend/server.js
require("dotenv").config(); // keep this first

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const cron = require("node-cron");

// Initialize Stripe after dotenv
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? require("stripe")(stripeKey) : null;

const { createClient } = require("@supabase/supabase-js");
const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Billing engine
const { billJobsMonthly } = require("./controllers/billingController");

// Express app
const app = express();
console.log('BOOT SUPABASE_URL =', process.env.SUPABASE_URL);

// =======================
// Stripe Webhook
// =======================
const PLAN_MAP = {
  price_RECRUITER_BASIC: {
    table: "recruiter_entitlements",
    values: { plan: "recruiter_basic", max_active_jobs: 1 },
  },
  price_RECRUITER_PRO: {
    table: "recruiter_entitlements",
    values: { plan: "recruiter_pro", max_active_jobs: 5 },
  },
  price_CANDIDATE_BASIC: {
    table: "candidate_entitlements",
    values: { plan: "candidate_basic", apply_cap_per_day: 10 },
  },
};

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
        if (process.env.STRIPE_SKIP_VERIFY === "true") {
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

            const { data: profile, error: pErr } = await supa
              .from("profiles")
              .select("id")
              .eq("stripe_customer_id", customerId)
              .single();

            if (pErr || !profile) {
              console.error("❌ No profile for customer:", customerId, pErr);
              break;
            }

            const plan = PLAN_MAP[priceId];
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

            const { error: upErr } = await supa
              .from(plan.table)
              .upsert(payload, { onConflict: "profile_id" });

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
            const { data: profile } = await supa
              .from("profiles")
              .select("id")
              .eq("stripe_customer_id", customerId)
              .single();

            if (profile) {
              await supa
                .from("recruiter_entitlements")
                .update({
                  status: "canceled",
                  updated_at: new Date().toISOString(),
                })
                .eq("profile_id", profile.id);

              await supa
                .from("candidate_entitlements")
                .update({
                  status: "canceled",
                  updated_at: new Date().toISOString(),
                })
                .eq("profile_id", profile.id);

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

// =======================
// Routes
// =======================
const userRoutes = require("./routes/users");
app.use("/api/users", userRoutes);

const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

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
