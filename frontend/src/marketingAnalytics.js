const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

const envValue = (value) => {
  const cleaned = String(value || "").trim();
  return cleaned && !cleaned.startsWith("%REACT_APP_") ? cleaned : "";
};

const marketingConfig = {
  posthogKey: envValue(process.env.REACT_APP_POSTHOG_KEY),
  posthogHost: envValue(process.env.REACT_APP_POSTHOG_HOST) || DEFAULT_POSTHOG_HOST,
  clarityProjectId: envValue(process.env.REACT_APP_CLARITY_PROJECT_ID),
  gaMeasurementId: envValue(process.env.REACT_APP_GA_MEASUREMENT_ID),
};

function loadScript(id, src) {
  if (typeof document === "undefined" || document.getElementById(id)) return;

  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function initializePostHog() {
  if (!marketingConfig.posthogKey || typeof window === "undefined") return;

  const posthog = (window.posthog = window.posthog || []);
  if (posthog.__SV) return;

  posthog._i = [];
  posthog.init = function initPostHog(key, config, name) {
    const target = name ? (posthog[name] = []) : posthog;
    target.people = target.people || [];
    target.toString = () => (name ? `posthog.${name}` : "posthog");
    target.people.toString = () => `${target.toString()}.people`;

    [
      "capture",
      "identify",
      "reset",
      "register",
      "captureException",
      "startSessionRecording",
      "stopSessionRecording",
    ].forEach((method) => {
      target[method] = function queuePostHogCall() {
        target.push([method].concat(Array.prototype.slice.call(arguments)));
      };
    });

    posthog._i.push([key, config, name]);
  };
  posthog.__SV = 1;

  const host = marketingConfig.posthogHost.replace(/\/$/, "");
  loadScript("jobs-vision-posthog", `${host}/static/array.js`);
  posthog.init(marketingConfig.posthogKey, {
    api_host: host,
    capture_pageview: false,
    person_profiles: "identified_only",
  });
}

function initializeClarity() {
  if (!marketingConfig.clarityProjectId || typeof window === "undefined") return;

  window.clarity =
    window.clarity ||
    function queueClarityCall() {
      (window.clarity.q = window.clarity.q || []).push(arguments);
    };

  loadScript(
    "jobs-vision-clarity",
    `https://www.clarity.ms/tag/${marketingConfig.clarityProjectId}`
  );
}

function initializeGa4() {
  if (!marketingConfig.gaMeasurementId || typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  loadScript(
    "jobs-vision-ga4",
    `https://www.googletagmanager.com/gtag/js?id=${marketingConfig.gaMeasurementId}`
  );
  window.gtag("js", new Date());
  window.gtag("config", marketingConfig.gaMeasurementId, {
    send_page_view: false,
  });
}

export function initializeMarketingAnalytics() {
  initializePostHog();
  initializeClarity();
  initializeGa4();
}

export function trackPageView(path) {
  if (typeof window === "undefined") return;

  const pagePath = path || `${window.location.pathname}${window.location.search}`;
  const pageLocation = `${window.location.origin}${pagePath}`;

  if (window.gtag && marketingConfig.gaMeasurementId) {
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: pageLocation,
      page_title: document.title,
    });
  }

  if (window.posthog?.capture) {
    window.posthog.capture("$pageview", {
      $current_url: pageLocation,
      page_path: pagePath,
    });
  }
}

export function trackMarketingConversion(eventName, properties = {}) {
  if (!eventName || typeof window === "undefined") return;

  if (window.gtag) {
    window.gtag("event", eventName, properties);
  }

  if (window.posthog?.capture) {
    window.posthog.capture(eventName, properties);
  }

  if (window.clarity) {
    window.clarity("event", eventName);
  }
}
