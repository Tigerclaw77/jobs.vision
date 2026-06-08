const { normalizeUrl } = require("./utils");

const DEFAULT_USER_AGENT = "jobs-vision-discovery/0.1 (+https://jobs.vision)";

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, cancel: () => clearTimeout(timeout) };
}

function parseRobotsGroups(robotsText = "") {
  const groups = [];
  let current = null;

  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      current = { agents: [value.toLowerCase()], disallow: [], allow: [] };
      groups.push(current);
    } else if (current && key === "disallow") {
      current.disallow.push(value);
    } else if (current && key === "allow") {
      current.allow.push(value);
    }
  }

  return groups;
}

function pathMatches(rule, pathname) {
  if (!rule) return false;
  const normalizedRule = rule.endsWith("*") ? rule.slice(0, -1) : rule;
  return pathname.startsWith(normalizedRule);
}

function isAllowedByRobots(url, robotsText = "", userAgent = DEFAULT_USER_AGENT) {
  if (!robotsText) return true;
  let pathname = "/";
  try {
    pathname = new URL(url).pathname || "/";
  } catch {
    return false;
  }

  const groups = parseRobotsGroups(robotsText);
  const agent = userAgent.toLowerCase();
  const matching = groups.filter((group) =>
    group.agents.some((entry) => entry === "*" || agent.includes(entry))
  );
  const rules = matching.length ? matching : groups.filter((group) => group.agents.includes("*"));

  for (const group of rules) {
    const allowed = group.allow.some((rule) => pathMatches(rule, pathname));
    if (allowed) return true;
    const blocked = group.disallow.some((rule) => pathMatches(rule, pathname));
    if (blocked) return false;
  }

  return true;
}

async function fetchText(url, options = {}) {
  const timeout = timeoutSignal(options.timeoutMs || 12000);
  try {
    const response = await fetch(url, {
      signal: timeout.signal,
      headers: {
        "User-Agent": options.userAgent || DEFAULT_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
      },
    });
    const text = await response.text();
    return { ok: response.ok, status: response.status, text, finalUrl: response.url || url };
  } finally {
    timeout.cancel();
  }
}

async function fetchRobotsFor(url, options = {}) {
  let robotsUrl;
  try {
    const parsed = new URL(url);
    robotsUrl = `${parsed.origin}/robots.txt`;
  } catch {
    return "";
  }

  try {
    const response = await fetchText(robotsUrl, options);
    return response.ok ? response.text : "";
  } catch {
    return "";
  }
}

async function fetchPage(url, options = {}) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return { ok: false, status: 0, html: "", finalUrl: url, notes: ["Invalid source URL."] };
  }

  const robots = await fetchRobotsFor(normalizedUrl, options);
  if (!isAllowedByRobots(normalizedUrl, robots, options.userAgent || DEFAULT_USER_AGENT)) {
    return {
      ok: false,
      status: 403,
      html: "",
      finalUrl: normalizedUrl,
      notes: ["Skipped because robots.txt disallows this path."],
    };
  }

  const response = await fetchText(normalizedUrl, options);
  return {
    ok: response.ok,
    status: response.status,
    html: response.text,
    finalUrl: response.finalUrl,
    notes: response.ok ? [] : [`Fetch returned HTTP ${response.status}.`],
  };
}

module.exports = {
  DEFAULT_USER_AGENT,
  fetchPage,
  isAllowedByRobots,
};
