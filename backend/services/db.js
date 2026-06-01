const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for Neon/Postgres database access.");
}

const sslDisabled =
  process.env.PGSSLMODE === "disable" ||
  process.env.PGSSL === "false" ||
  /\bsslmode=disable\b/i.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: sslDisabled ? false : { rejectUnauthorized: false },
  max: Number(process.env.PGPOOL_MAX || 10),
});

function assertIdentifier(identifier) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }
  return identifier;
}

function quoteIdent(identifier) {
  return `"${assertIdentifier(identifier)}"`;
}

function buildInsert(table, values, { returning = "*" } = {}) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  if (!entries.length) throw new Error("No values provided for insert");

  const columns = entries.map(([key]) => quoteIdent(key));
  const params = entries.map(([, value]) => value);
  const placeholders = params.map((_, index) => `$${index + 1}`);

  return {
    text: `insert into ${table} (${columns.join(", ")}) values (${placeholders.join(", ")}) returning ${returning}`,
    params,
  };
}

function buildUpdate(table, values, whereSql, whereParams = [], { returning = "*" } = {}) {
  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  if (!entries.length) throw new Error("No values provided for update");

  const params = entries.map(([, value]) => value).concat(whereParams);
  const setSql = entries
    .map(([key], index) => `${quoteIdent(key)} = $${index + 1}`)
    .join(", ");

  return {
    text: `update ${table} set ${setSql} where ${whereSql} returning ${returning}`,
    params,
  };
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function one(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

module.exports = {
  pool,
  query,
  one,
  buildInsert,
  buildUpdate,
};
