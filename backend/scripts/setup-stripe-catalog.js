require("dotenv").config();

const stripeKey = process.env.STRIPE_SECRET_KEY;
const JOBS_VISION_STRIPE_ACCOUNT_ID = "acct_1TdWA4JcQ1I2F7dC";
const configuredAccountId = process.env.STRIPE_ACCOUNT_ID || JOBS_VISION_STRIPE_ACCOUNT_ID;

const {
  STRIPE_PRODUCTS,
  STRIPE_WEBHOOK_EVENTS,
  metadataForPlan,
} = require("../services/stripeCatalog");

function usage() {
  return `
Usage: node scripts/setup-stripe-catalog.js [--dry-run] [--live]

Options:
  --dry-run   Validate the catalog and print what would be created. No writes.
  --live      Required when STRIPE_SECRET_KEY is an sk_live_ key.
  --help      Show this help text.
`;
}

function parseArgs(argv) {
  const allowed = new Set(["--dry-run", "--live", "--help"]);
  const unknown = argv.filter((arg) => !allowed.has(arg));
  if (unknown.length) {
    throw new Error(`Unknown option(s): ${unknown.join(", ")}\n${usage()}`);
  }

  return {
    dryRun: argv.includes("--dry-run"),
    help: argv.includes("--help"),
    live: argv.includes("--live"),
  };
}

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  console.log(usage().trim());
  process.exit(0);
}

if (!stripeKey) {
  console.error("STRIPE_SECRET_KEY is required.");
  process.exit(1);
}

const isTestKey = stripeKey.startsWith("sk_test_");
const isLiveKey = stripeKey.startsWith("sk_live_");

if (!isTestKey && !isLiveKey) {
  console.error("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_.");
  process.exit(1);
}

if (isLiveKey && !options.live) {
  console.error("Refusing to use a live Stripe secret key without the explicit --live flag.");
  process.exit(1);
}

if (options.live && !isLiveKey) {
  console.error("--live requires an sk_live_ Stripe secret key.");
  process.exit(1);
}

const stripe = require("stripe")(stripeKey);
const mode = isLiveKey ? "live" : "test";

function escapeSearchValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function productMetadata(plan) {
  return metadataForPlan(plan, "monthly_recurring");
}

function expectedPriceSpecs(plan) {
  const specs = [
    {
      amountCents: plan.recurringAmountCents,
      key: "recurringPrice",
      lookupKey: plan.recurringLookupKey,
      priceKind: "monthly_recurring",
      recurring: true,
    },
  ];

  if (plan.firstMonthAdjustmentLookupKey) {
    specs.push({
      amountCents: plan.firstMonthAdjustmentAmountCents,
      key: "firstMonthAdjustmentPrice",
      lookupKey: plan.firstMonthAdjustmentLookupKey,
      priceKind: "first_month_adjustment",
      recurring: false,
    });
  }

  return specs;
}

function expectedPriceCount() {
  return STRIPE_PRODUCTS.reduce((count, plan) => count + expectedPriceSpecs(plan).length, 0);
}

function compareMetadata(actual = {}, expected = {}) {
  const diffs = [];
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();

  for (const key of expectedKeys) {
    if (actual[key] !== expected[key]) {
      diffs.push(`${key}: expected ${expected[key]}, found ${actual[key] ?? "<missing>"}`);
    }
  }

  for (const key of actualKeys) {
    if (!Object.prototype.hasOwnProperty.call(expected, key)) {
      diffs.push(`${key}: unexpected metadata key`);
    }
  }

  return diffs;
}

function productIdOf(price) {
  if (!price?.product) return null;
  return typeof price.product === "string" ? price.product : price.product.id;
}

function validationError(subject, id, diffs) {
  return `${subject} ${id} does not match expected jobs.vision catalog:\n- ${diffs.join("\n- ")}`;
}

function validateProduct(product, plan) {
  const diffs = [];
  if (product.name !== plan.name) {
    diffs.push(`name: expected ${plan.name}, found ${product.name}`);
  }
  if (product.active !== true) {
    diffs.push("active: expected true");
  }
  diffs.push(...compareMetadata(product.metadata || {}, productMetadata(plan)));

  if (diffs.length) {
    throw new Error(validationError("Product", product.id, diffs));
  }
}

function validatePrice(price, plan, spec, product) {
  const diffs = [];
  const expectedMetadata = metadataForPlan(plan, spec.priceKind);
  const expectedProductId = product?.id || null;
  const actualProductId = productIdOf(price);

  if (price.active !== true) {
    diffs.push("active: expected true");
  }
  if (price.unit_amount !== spec.amountCents) {
    diffs.push(`unit_amount: expected ${spec.amountCents}, found ${price.unit_amount}`);
  }
  if (String(price.currency || "").toLowerCase() !== "usd") {
    diffs.push(`currency: expected usd, found ${price.currency}`);
  }
  if (price.lookup_key !== spec.lookupKey) {
    diffs.push(`lookup_key: expected ${spec.lookupKey}, found ${price.lookup_key || "<missing>"}`);
  }
  if (!expectedProductId) {
    diffs.push(`product: expected product ${plan.name} to exist before reusing a price`);
  } else if (actualProductId !== expectedProductId) {
    diffs.push(`product: expected ${expectedProductId}, found ${actualProductId || "<missing>"}`);
  }

  if (spec.recurring) {
    if (!price.recurring) {
      diffs.push("interval: expected recurring month, found one-time");
    } else {
      if (price.recurring.interval !== "month") {
        diffs.push(`interval: expected month, found ${price.recurring.interval}`);
      }
      if (price.recurring.interval_count !== 1) {
        diffs.push(`interval_count: expected 1, found ${price.recurring.interval_count}`);
      }
    }
  } else if (price.recurring) {
    diffs.push(`interval: expected one-time, found recurring ${price.recurring.interval}`);
  }

  diffs.push(...compareMetadata(price.metadata || {}, expectedMetadata));

  if (diffs.length) {
    throw new Error(validationError("Price", price.id, diffs));
  }
}

async function searchProducts(query) {
  const products = await stripe.products.search({ query, limit: 10 });
  return products.data || [];
}

async function findProduct(plan) {
  const metadataQuery =
    `metadata['app']:'jobs.vision' ` +
    `AND metadata['plan_key']:'${escapeSearchValue(plan.planKey)}' ` +
    `AND metadata['audience']:'${escapeSearchValue(plan.audience)}'`;
  const nameQuery = `name:'${escapeSearchValue(plan.name)}'`;

  const [metadataProducts, namedProducts] = await Promise.all([
    searchProducts(metadataQuery),
    searchProducts(nameQuery),
  ]);

  const exactNamedProducts = namedProducts.filter((product) => product.name === plan.name);

  if (metadataProducts.length > 1) {
    throw new Error(
      `Multiple products match ${plan.planKey} metadata: ${metadataProducts
        .map((product) => product.id)
        .join(", ")}`
    );
  }

  const product = metadataProducts[0] || null;
  if (product) {
    const duplicateNames = exactNamedProducts.filter((candidate) => candidate.id !== product.id);
    if (duplicateNames.length) {
      throw new Error(
        `Refusing to continue because duplicate product name ${plan.name} exists: ${duplicateNames
          .map((candidate) => candidate.id)
          .join(", ")}`
      );
    }
    validateProduct(product, plan);
    return product;
  }

  if (exactNamedProducts.length) {
    throw new Error(
      `Found product named ${plan.name} without expected metadata: ${exactNamedProducts
        .map((candidate) => candidate.id)
        .join(", ")}. Refusing to create a duplicate.`
    );
  }

  return null;
}

async function findActivePriceByLookupKey(lookupKey) {
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [lookupKey],
    limit: 10,
  });

  if ((prices.data || []).length > 1) {
    throw new Error(
      `Multiple active prices found for lookup_key ${lookupKey}: ${prices.data
        .map((price) => price.id)
        .join(", ")}`
    );
  }

  return prices.data[0] || null;
}

function describeProduct(product, plan, action) {
  return {
    action,
    active: product?.active ?? true,
    id: product?.id || null,
    metadata: product?.metadata || productMetadata(plan),
    name: product?.name || plan.name,
  };
}

function describePrice(price, plan, spec, productId, action) {
  return {
    action,
    amount: price?.unit_amount ?? spec.amountCents,
    currency: price?.currency || "usd",
    id: price?.id || null,
    interval: spec.recurring ? "month" : null,
    lookupKey: price?.lookup_key || spec.lookupKey,
    metadata: price?.metadata || metadataForPlan(plan, spec.priceKind),
    priceKind: spec.priceKind,
    productId: price ? productIdOf(price) : productId || null,
  };
}

async function createProduct(plan) {
  if (options.dryRun) {
    return {
      description: describeProduct(null, plan, "would_create"),
      product: null,
    };
  }

  const product = await stripe.products.create({
    active: true,
    metadata: productMetadata(plan),
    name: plan.name,
  });

  validateProduct(product, plan);
  return {
    description: describeProduct(product, plan, "created"),
    product,
  };
}

async function ensureProduct(plan) {
  const existing = await findProduct(plan);
  if (existing) {
    return {
      description: describeProduct(existing, plan, "reused"),
      product: existing,
    };
  }

  return createProduct(plan);
}

async function createPrice(plan, spec, product) {
  if (!product?.id) {
    return {
      description: describePrice(null, plan, spec, null, "would_create"),
      price: null,
    };
  }

  if (options.dryRun) {
    return {
      description: describePrice(null, plan, spec, product.id, "would_create"),
      price: null,
    };
  }

  const price = await stripe.prices.create({
    currency: "usd",
    lookup_key: spec.lookupKey,
    metadata: metadataForPlan(plan, spec.priceKind),
    product: product.id,
    recurring: spec.recurring ? { interval: "month" } : undefined,
    unit_amount: spec.amountCents,
  });

  validatePrice(price, plan, spec, product);
  return {
    description: describePrice(price, plan, spec, product.id, "created"),
    price,
  };
}

async function ensurePrice(plan, spec, product) {
  const existing = await findActivePriceByLookupKey(spec.lookupKey);
  if (existing) {
    validatePrice(existing, plan, spec, product);
    return {
      description: describePrice(existing, plan, spec, product?.id, "reused"),
      price: existing,
    };
  }

  return createPrice(plan, spec, product);
}

async function setupWebhookIfRequested() {
  const webhookUrl = process.env.STRIPE_WEBHOOK_URL;
  if (!webhookUrl) return null;

  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((endpoint) => endpoint.url === webhookUrl);
  const payload = {
    enabled_events: STRIPE_WEBHOOK_EVENTS,
    metadata: { app: "jobs.vision" },
  };

  if (options.dryRun) {
    return {
      action: existing ? "would_update" : "would_create",
      enabledEvents: STRIPE_WEBHOOK_EVENTS,
      id: existing?.id || null,
      url: webhookUrl,
    };
  }

  if (existing) {
    const webhook = await stripe.webhookEndpoints.update(existing.id, payload);
    return {
      action: "updated",
      enabledEvents: webhook.enabled_events,
      id: webhook.id,
      url: webhook.url,
    };
  }

  const webhook = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    ...payload,
  });

  return {
    action: "created",
    enabledEvents: webhook.enabled_events,
    id: webhook.id,
    secret: webhook.secret,
    url: webhook.url,
  };
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

async function ensurePlan(plan) {
  const productResult = await ensureProduct(plan);
  const row = {
    audience: plan.audience,
    plan: plan.planKey,
    product: productResult.description,
  };

  for (const spec of expectedPriceSpecs(plan)) {
    const priceResult = await ensurePrice(plan, spec, productResult.product);
    row[spec.key] = priceResult.description;
  }

  return row;
}

function verificationFor(rows) {
  const productDescriptions = rows.map((row) => row.product);
  const priceDescriptions = rows.flatMap((row) =>
    ["recurringPrice", "firstMonthAdjustmentPrice"]
      .map((key) => row[key])
      .filter(Boolean)
  );

  const resolvedProducts = productDescriptions.filter((product) => product.id).length;
  const resolvedPrices = priceDescriptions.filter((price) => price.id).length;

  return {
    clean: true,
    expectedActiveProducts: STRIPE_PRODUCTS.length,
    expectedActivePrices: expectedPriceCount(),
    resolvedActiveProducts: resolvedProducts,
    resolvedActivePrices: resolvedPrices,
    wouldCreateProducts: productDescriptions.filter((product) => product.action === "would_create")
      .length,
    wouldCreatePrices: priceDescriptions.filter((price) => price.action === "would_create")
      .length,
    status: options.dryRun ? "dry_run_clean" : "catalog_ready",
  };
}

async function main() {
  const account = await verifyStripeAccount();
  const rows = [];

  for (const plan of STRIPE_PRODUCTS) {
    rows.push(await ensurePlan(plan));
  }

  const webhook = await setupWebhookIfRequested();
  const output = {
    account: {
      chargesEnabled: account.charges_enabled,
      displayName:
        account.settings?.dashboard?.display_name || account.business_profile?.name || null,
      id: account.id,
      payoutsEnabled: account.payouts_enabled,
    },
    dryRun: options.dryRun,
    mode,
    productsAndPrices: rows,
    verification: verificationFor(rows),
    webhook,
  };

  console.log(JSON.stringify(output, null, 2));

  if (webhook?.secret) {
    console.log("\nCopy this value to STRIPE_WEBHOOK_SECRET. Stripe shows it only once:");
    console.log(webhook.secret);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
