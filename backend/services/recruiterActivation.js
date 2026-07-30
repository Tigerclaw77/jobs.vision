const RECRUITER_ACTIVATION_ROLES = new Set([
  "candidate",
  "recruiter",
  "admin",
]);

function canActivateRecruiter(role) {
  return RECRUITER_ACTIVATION_ROLES.has(
    String(role || "").trim().toLowerCase()
  );
}

async function activateRecruiterForUser(
  userId,
  { executeOne } = {}
) {
  if (!userId) return null;
  const runOne = executeOne || require("./db.js").one;

  return runOne(
    `
      update public.profiles
      set role = case
            when role = 'candidate' then 'recruiter'
            else role
          end,
          updated_at = case
            when role = 'candidate' then now()
            else updated_at
          end
      where id = $1
        and role in ('candidate', 'recruiter', 'admin')
      returning id, email, role, first_name, last_name, company
    `,
    [userId]
  );
}

module.exports = {
  activateRecruiterForUser,
  canActivateRecruiter,
};
