import { useEffect, useMemo } from "react";

const DEFAULT_TITLE = "jobs.vision | Optometry and Eye Care Jobs";
const DEFAULT_DESCRIPTION =
  "Optometry and eye care jobs for optometrists, opticians, technicians, and practice teams.";

function readMeta(attribute, key) {
  return document.head.querySelector(`meta[${attribute}="${key}"]`);
}

function upsertMeta(attribute, key, content) {
  let tag = readMeta(attribute, key);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, key);
    tag.setAttribute("data-seo-managed", "true");
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content || "");
  return tag;
}

function upsertCanonical(href) {
  let tag = document.head.querySelector('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", "canonical");
    tag.setAttribute("data-seo-managed", "true");
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
  return tag;
}

function snapshotHead(keys) {
  const meta = {};
  keys.forEach(([attribute, key]) => {
    const tag = readMeta(attribute, key);
    meta[`${attribute}:${key}`] = {
      existed: Boolean(tag),
      content: tag?.getAttribute("content") || "",
    };
  });

  const canonical = document.head.querySelector('link[rel="canonical"]');
  return {
    title: document.title,
    canonical: {
      existed: Boolean(canonical),
      href: canonical?.getAttribute("href") || "",
    },
    meta,
  };
}

function restoreHead(snapshot, keys) {
  document.title = snapshot.title || DEFAULT_TITLE;

  keys.forEach(([attribute, key]) => {
    const previous = snapshot.meta[`${attribute}:${key}`];
    const tag = readMeta(attribute, key);
    if (!previous?.existed) {
      if (tag?.getAttribute("data-seo-managed") === "true") tag.remove();
      return;
    }
    upsertMeta(attribute, key, previous.content);
  });

  const canonical = document.head.querySelector('link[rel="canonical"]');
  if (!snapshot.canonical.existed) {
    if (canonical?.getAttribute("data-seo-managed") === "true") canonical.remove();
  } else {
    upsertCanonical(snapshot.canonical.href);
  }

  document.getElementById("jobposting-jsonld")?.remove();
}

export default function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogType = "website",
  ogImage = "https://www.jobs.vision/images/clinicbg-home.webp",
  jsonLd = null,
  noIndex = false,
}) {
  const jsonLdText = useMemo(() => (jsonLd ? JSON.stringify(jsonLd) : ""), [jsonLd]);

  useEffect(() => {
    const keys = [
      ["name", "description"],
      ["property", "og:type"],
      ["property", "og:site_name"],
      ["property", "og:title"],
      ["property", "og:description"],
      ["property", "og:url"],
      ["property", "og:image"],
      ["name", "twitter:card"],
      ["name", "twitter:title"],
      ["name", "twitter:description"],
      ["name", "twitter:image"],
      ["name", "robots"],
    ];
    const snapshot = snapshotHead(keys);

    document.title = title || DEFAULT_TITLE;
    upsertMeta("name", "description", description || DEFAULT_DESCRIPTION);
    upsertMeta("property", "og:type", ogType);
    upsertMeta("property", "og:site_name", "jobs.vision");
    upsertMeta("property", "og:title", title || DEFAULT_TITLE);
    upsertMeta("property", "og:description", description || DEFAULT_DESCRIPTION);
    if (canonical) upsertMeta("property", "og:url", canonical);
    if (ogImage) upsertMeta("property", "og:image", ogImage);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title || DEFAULT_TITLE);
    upsertMeta("name", "twitter:description", description || DEFAULT_DESCRIPTION);
    if (ogImage) upsertMeta("name", "twitter:image", ogImage);
    if (noIndex) upsertMeta("name", "robots", "noindex, nofollow");
    if (canonical) upsertCanonical(canonical);

    document.getElementById("jobposting-jsonld")?.remove();
    if (jsonLdText) {
      const script = document.createElement("script");
      script.id = "jobposting-jsonld";
      script.type = "application/ld+json";
      script.text = jsonLdText;
      document.head.appendChild(script);
    }

    return () => restoreHead(snapshot, keys);
  }, [canonical, description, jsonLdText, noIndex, ogImage, ogType, title]);

  return null;
}
