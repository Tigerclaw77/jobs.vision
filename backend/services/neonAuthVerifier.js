const crypto = require("crypto");
const https = require("https");
const jwt = require("jsonwebtoken");

const JWKS_URL =
  process.env.NEON_AUTH_JWKS_URL ||
  process.env.NEON_AUTH_JWKS_URI ||
  process.env.NEON_JWKS_URL ||
  "";

const ISSUER = process.env.NEON_AUTH_ISSUER || "";
const AUDIENCE = process.env.NEON_AUTH_AUDIENCE || "";
const JWKS_CACHE_MS = 5 * 60 * 1000;

let cachedJwks = null;
let cachedAt = 0;

function fetchJson(url) {
  if (typeof fetch === "function") {
    return fetch(url).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Unable to fetch Neon Auth JWKS: ${res.status}`);
      }
      return res.json();
    });
  }

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`Unable to fetch Neon Auth JWKS: ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on("error", reject);
  });
}

async function fetchJwks() {
  if (!JWKS_URL) {
    throw new Error("Missing NEON_AUTH_JWKS_URL");
  }

  if (cachedJwks && Date.now() - cachedAt < JWKS_CACHE_MS) {
    return cachedJwks;
  }

  const jwks = await fetchJson(JWKS_URL);
  cachedJwks = Array.isArray(jwks.keys) ? jwks : { keys: [] };
  cachedAt = Date.now();
  return cachedJwks;
}

async function getPublicKey(kid) {
  const jwks = await fetchJwks();
  const jwk = jwks.keys.find((key) => key.kid === kid);
  if (!jwk) {
    throw new Error("No matching Neon Auth JWKS key");
  }

  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

function decodeJwtPart(part) {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function assertRegisteredClaims(payload) {
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && now >= payload.exp) {
    throw new Error("Neon Auth token expired");
  }

  if (payload.nbf && now < payload.nbf) {
    throw new Error("Neon Auth token not active yet");
  }

  if (ISSUER && payload.iss !== ISSUER) {
    throw new Error("Neon Auth token issuer mismatch");
  }

  if (AUDIENCE) {
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!audiences.includes(AUDIENCE)) {
      throw new Error("Neon Auth token audience mismatch");
    }
  }
}

async function verifyEdDsaJwt(token, decoded) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed Neon Auth token");
  }

  const key = await getPublicKey(decoded.header.kid);
  const verified = crypto.verify(
    null,
    Buffer.from(`${parts[0]}.${parts[1]}`),
    key,
    Buffer.from(parts[2], "base64url")
  );

  if (!verified) {
    throw new Error("Invalid Neon Auth token signature");
  }

  const payload = decodeJwtPart(parts[1]);
  assertRegisteredClaims(payload);
  return payload;
}

function pickAppRole(payload) {
  const candidates = [
    payload?.app_metadata?.role,
    payload?.app_metadata?.accountRole,
    payload?.app_metadata?.userRole,
    payload?.user_metadata?.role,
    payload?.user_metadata?.accountRole,
    payload?.user_metadata?.userRole,
    payload?.metadata?.role,
    payload?.metadata?.accountRole,
    payload?.metadata?.userRole,
    payload?.role,
  ];

  return candidates.find((role) =>
    ["admin", "recruiter", "candidate"].includes(String(role || "").toLowerCase())
  );
}

async function verifyNeonAuthToken(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) {
    throw new Error("Malformed Neon Auth token");
  }

  let payload;
  if (decoded.header.alg === "EdDSA") {
    payload = await verifyEdDsaJwt(token, decoded);
  } else {
    const key = await getPublicKey(decoded.header.kid);
    const options = {
      algorithms: [decoded.header.alg || "RS256"],
    };

    if (ISSUER) options.issuer = ISSUER;
    if (AUDIENCE) options.audience = AUDIENCE;

    payload = jwt.verify(token, key, options);
  }
  const id = payload.sub || payload.user_id || payload.id;
  if (!id) {
    throw new Error("Neon Auth token missing subject");
  }

  return {
    id: String(id),
    email: payload.email || payload.user?.email || null,
    role: pickAppRole(payload),
    claims: payload,
  };
}

module.exports = { verifyNeonAuthToken };
