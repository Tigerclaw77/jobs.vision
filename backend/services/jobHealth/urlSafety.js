const dns = require("node:dns").promises;
const net = require("node:net");

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function parseIpv4(address) {
  const parts = String(address).split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return parts;
}

function isBlockedIpv4(address) {
  const parts = parseIpv4(address);
  if (!parts) return false;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 88) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isBlockedIpv6(address) {
  const normalized = String(address).toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (/^fe[cdef]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  if (normalized.startsWith("2001:db8")) return true;
  if (normalized.startsWith("::ffff:")) {
    return isBlockedIpv4(normalized.slice("::ffff:".length));
  }
  return false;
}

function isBlockedIp(address) {
  const version = net.isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version === 6) return isBlockedIpv6(address);
  return true;
}

function normalizeLookupResults(results) {
  const rows = Array.isArray(results) ? results : [results];
  return rows
    .map((row) => (typeof row === "string" ? row : row?.address))
    .filter(Boolean);
}

async function defaultResolveHost(hostname) {
  return dns.lookup(hostname, { all: true, verbatim: true });
}

async function assertSafeExternalUrl(rawUrl, { resolveHost = defaultResolveHost } = {}) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    const error = new Error("Application URL is invalid.");
    error.code = "invalid_apply_url";
    error.outcome = "hard_fail";
    throw error;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    const error = new Error("Application URL must use HTTP or HTTPS.");
    error.code = "unsupported_url_protocol";
    error.outcome = "hard_fail";
    throw error;
  }
  if (parsed.username || parsed.password) {
    const error = new Error("Application URL must not contain credentials.");
    error.code = "url_credentials_not_allowed";
    error.outcome = "hard_fail";
    throw error;
  }

  const hostname = parsed.hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    const error = new Error("Application URL resolves to a blocked hostname.");
    error.code = "blocked_destination";
    error.outcome = "hard_fail";
    throw error;
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      const error = new Error("Application URL resolves to a private or reserved address.");
      error.code = "blocked_destination";
      error.outcome = "hard_fail";
      throw error;
    }
    return { url: parsed, hostname, addresses: [hostname] };
  }

  let addresses;
  try {
    addresses = normalizeLookupResults(await resolveHost(hostname));
  } catch (cause) {
    const error = new Error(`Could not resolve application domain: ${hostname}`);
    error.code = ["ENOTFOUND", "ENODATA"].includes(cause?.code)
      ? "dead_domain"
      : "dns_inconclusive";
    error.outcome = error.code === "dead_domain" ? "hard_fail" : "inconclusive";
    error.cause = cause;
    throw error;
  }

  if (!addresses.length) {
    const error = new Error(`Application domain has no addresses: ${hostname}`);
    error.code = "dead_domain";
    error.outcome = "hard_fail";
    throw error;
  }
  if (addresses.some(isBlockedIp)) {
    const error = new Error("Application domain resolves to a private or reserved address.");
    error.code = "blocked_destination";
    error.outcome = "hard_fail";
    throw error;
  }

  return { url: parsed, hostname, addresses };
}

module.exports = {
  assertSafeExternalUrl,
  isBlockedIp,
  isBlockedIpv4,
  isBlockedIpv6,
};
