const test = require("node:test");
const assert = require("node:assert/strict");

const {
  activateRecruiterForUser,
  canActivateRecruiter,
} = require("../services/recruiterActivation.js");

test("candidate, recruiter, and admin profiles are valid activation subjects", () => {
  assert.equal(canActivateRecruiter("candidate"), true);
  assert.equal(canActivateRecruiter("recruiter"), true);
  assert.equal(canActivateRecruiter("admin"), true);
  assert.equal(canActivateRecruiter(""), false);
  assert.equal(canActivateRecruiter("unknown"), false);
});

test("activation promotes only candidate profiles and preserves admin", async () => {
  const calls = [];
  const expectedProfile = {
    id: "candidate-id",
    email: "candidate@example.com",
    role: "recruiter",
  };

  const result = await activateRecruiterForUser("candidate-id", {
    executeOne: async (sql, params) => {
      calls.push({ sql, params });
      return expectedProfile;
    },
  });

  assert.deepEqual(result, expectedProfile);
  assert.deepEqual(calls[0].params, ["candidate-id"]);
  assert.match(calls[0].sql, /when role = 'candidate' then 'recruiter'/);
  assert.match(calls[0].sql, /role in \('candidate', 'recruiter', 'admin'\)/);
});

test("activation does not run without an authenticated user id", async () => {
  let called = false;
  const result = await activateRecruiterForUser("", {
    executeOne: async () => {
      called = true;
      return null;
    },
  });

  assert.equal(result, null);
  assert.equal(called, false);
});
