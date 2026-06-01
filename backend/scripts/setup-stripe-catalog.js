require("dotenv").config();

const stripeKey = process.env.STRIPE_SECRET_KEY;
const JOBS_VISION_STRIPE_ACCOUNT_ID = "acct_1TdWCRJgo9pmORhC";
const configuredAccountId = process.env.STRIPE_ACCOUNT_ID || JOBS_VISION_STRIPE_ACCOUNT_ID;

if (!stripeKey) {
  console.error("STRIPE_SECRET_KEY is required.");
  process.exit(1);
}

if (!stripeKey.startsWith("sk_test_")) {
  console.error("Refusing to create catalog with a non-test Stripe secret key.");
  process.exit(1);
}

const stripe = require("stripe")(stripeKey);
const {
  STRIPE_PRODUCTS,
  STRIPE_WEBHOOK_EVENTS,
  metadataForPlan,
} = require("../services/stripeCatalog");

async function findProduct(plan) {
  const products = await stripe.products.search({
    query: `metadata['app']:'jobs.vision' AND metadata['plan_key']:'${plan.planKey}' AND metadata['audience']:'${plan.audience}'`,
    limit: 1,
  });

  return products.data[0] || null;
}

async function upsertProduct(plan) {
  const metadata = metadataForPlan(plan);
  const existing = await findProduct(plan);

  if (existing) {
    return stripe.products.update(existing.id, {
      name: plan.name,
      active: true,
      metadata,
    });
  }

  return stripe.products.create({
    name: plan.name,
    active: true,
    metadata,
  });
}

async function findPriceByLookupKey(lookupKey) {
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [lookupKey],
    limit: 1,
  });

  return prices.data[0] || null;
}

async function createPriceIfMissing({ productId, lookupKey, amountCents, recurring, metadata }) {
  const existing = await findPriceByLookupKey(lookupKey);
  if (existing) return existing;

  return stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: amountCents,
    lookup_key: lookupKey,
    recurring: recurring ? { interval: "month" } : undefined,
    metadata,
  });
}

async function setupWebhookIfRequested() {
  const webhookUrl = process.env.STRIPE_WEBHOOK_URL;
  if (!webhookUrl) return null;

  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((endpoint) => endpoint.url === webhookUrl);

  if (existing) {
    return stripe.webhookEndpoints.update(existing.id, {
      enabled_events: STRIPE_WEBHOOK_EVENTS,
      metadata: { app: "jobs.vision" },
    });
  }

  return stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: STRIPE_WEBHOOK_EVENTS,
    metadata: { app: "jobs.vision" },
  });
}

async function verifyStripeAccount() {
  if (configuredAccountId !== JOBS_VISION_STRIPE_ACCOUNT_ID) {
    throw new Error(
      `STRIPE_ACCOUNT_ID must be ${JOBS_VISION_STRIPE_ACCOUNT_ID} for jobs.vision. Received ${configuredAccountId}.`
    );
  }

  const account = await stripe.accounts.retrieve();

  if (account.id !== JOBS_VISION_STRIPE_ACCOUNT_ID) {
    throw new Error(
      `Stripe account mismatch. Expected ${JOBS_VISION_STRIPE_ACCOUNT_ID}, but STRIPE_SECRET_KEY belongs to ${account.id}.`
    );
  }

  return account;
}

async function main() {
  const account = await verifyStripeAccount();
  const output = [];

  for (const plan of STRIPE_PRODUCTS) {
    const product = await upsertProduct(plan);
    const recurringPrice = await createPriceIfMissing({
      productId: product.id,
      lookupKey: plan.recurringLookupKey,
      amountCents: plan.recurringAmountCents,
      recurring: true,
      metadata: metadataForPlan(plan, "monthly_recurring"),
    });

    const row = {
      plan: plan.planKey,
      product: { id: product.id, name: product.name },
      recurringPrice: {
        id: recurringPrice.id,
        lookupKey: recurringPrice.lookup_key,
        amount: recurringPrice.unit_amount,
      },
    };

    if (plan.firstMonthAdjustmentLookupKey) {
      const adjustmentPrice = await createPriceIfMissing({
        productId: product.id,
        lookupKey: plan.firstMonthAdjustmentLookupKey,
        amountCents: plan.firstMonthAdjustmentAmountCents,
        recurring: false,
        metadata: metadataForPlan(plan, "first_month_adjustment"),
      });

      row.firstMonthAdjustmentPrice = {
        id: adjustmentPrice.id,
        lookupKey: adjustmentPrice.lookup_key,
        amount: adjustmentPrice.unit_amount,
      };
    }

    output.push(row);
  }

  const webhook = await setupWebhookIfRequested();

  console.log(
    JSON.stringify(
      {
        account: {
          id: account.id,
          displayName: account.settings?.dashboard?.display_name || account.business_profile?.name || null,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
        },
        productsAndPrices: output,
        webhook,
      },
      null,
      2
    )
  );

  if (!webhook) {
    console.log(
      "\nNo webhook was created because STRIPE_WEBHOOK_URL is not set. Create one in the Stripe Dashboard or rerun with STRIPE_WEBHOOK_URL=https://your-domain/api/stripe/webhook."
    );
  } else if (webhook.secret) {
    console.log("\nCopy this value to STRIPE_WEBHOOK_SECRET. Stripe shows it only once:");
    console.log(webhook.secret);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
