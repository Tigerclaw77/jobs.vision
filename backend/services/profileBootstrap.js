const { one } = require("./db");

const SELF_SERVICE_ROLES = new Set(["candidate", "recruiter"]);

function normalizeSelfServiceRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return SELF_SERVICE_ROLES.has(role) ? role : "candidate";
}

function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function metadataForUser(user = {}) {
  const claims = user.claims || {};
  return {
    ...(claims.metadata || {}),
    ...(claims.user_metadata || {}),
    ...(claims.app_metadata || {}),
  };
}

function profileFieldsForAuthUser(user = {}, overrides = {}) {
  const metadata = metadataForUser(user);
  const role = normalizeSelfServiceRole(
    pickFirst(
      overrides.accountRole,
      overrides.userRole,
      metadata.accountRole,
      metadata.userRole,
      metadata.role,
      user.role
    )
  );

  return {
    id: user.id,
    email: pickFirst(overrides.email, user.email, user.claims?.email),
    role,
    firstName: pickFirst(overrides.firstName, overrides.first_name, metadata.firstName, metadata.first_name),
    lastName: pickFirst(overrides.lastName, overrides.last_name, metadata.lastName, metadata.last_name),
    company: pickFirst(overrides.company, metadata.company, metadata.companyName),
  };
}

async function getProfile(userId) {
  if (!userId) return null;
  return one(
    "select id, email, role, first_name, last_name, company from public.profiles where id = $1",
    [userId]
  );
}

async function upsertProfileForAuthUser(user, overrides = {}) {
  const fields = profileFieldsForAuthUser(user, overrides);
  if (!fields.id) throw new Error("Cannot bootstrap profile without user id");

  return one(
    `
      insert into public.profiles (id, email, role, first_name, last_name, company)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (id) do update set
        email = coalesce(excluded.email, public.profiles.email),
        role = case
          when public.profiles.role = 'admin' then public.profiles.role
          else excluded.role
        end,
        first_name = coalesce(excluded.first_name, public.profiles.first_name),
        last_name = coalesce(excluded.last_name, public.profiles.last_name),
        company = coalesce(excluded.company, public.profiles.company),
        updated_at = now()
      returning id, email, role, first_name, last_name, company
    `,
    [
      fields.id,
      fields.email || null,
      fields.role,
      fields.firstName || null,
      fields.lastName || null,
      fields.company || null,
    ]
  );
}

async function ensureProfileForAuthUser(user) {
  const existing = await getProfile(user?.id);
  if (existing) return existing;
  return upsertProfileForAuthUser(user);
}

module.exports = {
  ensureProfileForAuthUser,
  getProfile,
  upsertProfileForAuthUser,
};
