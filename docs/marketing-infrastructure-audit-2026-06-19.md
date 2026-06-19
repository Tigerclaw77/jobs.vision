# Marketing Infrastructure Audit - 2026-06-19

Scope: `honestlenses.com`, `paladincompliance.com`, and `jobs.vision`.

Status legend:

- Present and configured: visible in production and likely working.
- Present but incomplete: code or asset exists, but production configuration, env, or verification is incomplete.
- Missing: no production or repo signal found.
- Broken or likely misconfigured: accessible, but canonical/domain/config behavior is likely wrong.

Production checks used live home pages, `/robots.txt`, `/sitemap.xml`, favicon/social image assets, and built repo output. Code fixes below require redeploy before production reflects them.

## Honest Lenses

Live production:

- Home: `https://www.honestlenses.com/` returns 200.
- Robots: `https://www.honestlenses.com/robots.txt` returns 200 and allows crawling.
- Sitemap: `https://www.honestlenses.com/sitemap.xml` returns 200 with 95 URLs.
- GSC HTML file: `https://www.honestlenses.com/googled0e686bd107e2b0b.html` returns 200.
- Favicon: `https://www.honestlenses.com/icon.svg` returns 200.
- Social asset candidate: `https://www.honestlenses.com/cl.png` returns 200.

| Item | Production status | Repo status after this audit |
| --- | --- | --- |
| PostHog | Present but incomplete | Existing PostHog provider/events remain. Requires `NEXT_PUBLIC_POSTHOG_KEY` and production event confirmation. |
| Microsoft Clarity | Missing | Added optional script support via `NEXT_PUBLIC_CLARITY_PROJECT_ID`. |
| GA4 | Missing | Added optional script support via `NEXT_PUBLIC_GA_MEASUREMENT_ID`. |
| Google Search Console | Present and configured | Existing HTML verification file is live. |
| Sitemap generation | Present and configured | Next sitemap generates 95 URLs on build. |
| robots.txt | Present and configured | Allows crawl and points to sitemap. |
| Open Graph tags | Missing | Added global OG metadata. |
| Twitter/X tags | Missing | Added global Twitter metadata. |
| Canonical URLs | Missing | Added root canonical metadata. |
| Structured data/schema | Missing on home | Added Organization and WebSite JSON-LD. |
| Favicon/social preview | Present but incomplete | Favicon was live; social image is now wired to `/cl.png`. |
| Canonical domain | Broken or likely misconfigured | Both bare and `www` return 200. Sitemap/canonical use bare domain; configure `www` redirect to bare. |

Direct code changes:

- `src/app/layout.tsx`: global canonical, OG, Twitter, JSON-LD, optional GA4 and Clarity scripts.
- `.env.example`: added Clarity and GA4 public env vars.

Required env vars:

- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`
- `POSTHOG_PROJECT_API_KEY` for server-side events if not using the public key server-side.
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`

External checklist:

1. PostHog: create/open the project at `https://us.posthog.com/`, copy the project key, set `NEXT_PUBLIC_POSTHOG_KEY`, keep host as `https://us.i.posthog.com`, redeploy, then confirm `$pageview`, checkout, cart, and order events arrive.
2. Clarity: create/open a project at `https://clarity.microsoft.com/`, copy the Project ID, set `NEXT_PUBLIC_CLARITY_PROJECT_ID`, redeploy, then confirm recordings begin.
3. GA4: create/open the web stream at `https://analytics.google.com/analytics/web/`, copy the Measurement ID (`G-...`), set `NEXT_PUBLIC_GA_MEASUREMENT_ID`, redeploy, then verify Realtime.
4. Search Console: open `https://search.google.com/search-console`, confirm the existing HTML-file property is verified, submit `https://honestlenses.com/sitemap.xml`.
5. Vercel Domains: open `https://vercel.com/dashboard`, select `honest-lenses`, Settings > Domains, set `honestlenses.com` as primary and redirect `www.honestlenses.com` to it.
6. DNS if not already correct for Vercel: apex `A` record to `76.76.21.21`; `www` `CNAME` to `cname.vercel-dns.com`.

Scorecard after deploy/env:

- Analytics Readiness: 70/100
- SEO Readiness: 88/100
- Marketing Readiness: 82/100
- Conversion Tracking Readiness: 72/100

## Paladin Compliance

Live production:

- Home: `https://www.paladincompliance.com/` returns 200.
- Robots: `https://www.paladincompliance.com/robots.txt` returns 200.
- Sitemap: `https://www.paladincompliance.com/sitemap.xml` returns 200 with 7 URLs.
- GSC meta tag is present in production.
- Favicon: `https://www.paladincompliance.com/favicon.ico` returns 200.
- Social asset candidate: `https://www.paladincompliance.com/paladincompliance-bg.png` returns 200.

| Item | Production status | Repo status after this audit |
| --- | --- | --- |
| PostHog | Missing | Added optional PostHog loader via env vars. |
| Microsoft Clarity | Missing | Added optional script support via env var. |
| GA4 | Missing | Added optional script support via env var. |
| Google Search Console | Present and configured | Existing `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` metadata path remains. |
| Sitemap generation | Present but incomplete | Live sitemap used bare domain while production redirects to `www`; code now emits `www`. |
| robots.txt | Present but incomplete | Live robots pointed at bare sitemap; code now points to `www` sitemap. |
| Open Graph tags | Missing | Added global OG metadata. |
| Twitter/X tags | Missing | Added global Twitter metadata. |
| Canonical URLs | Missing | Added root canonical metadata. |
| Structured data/schema | Missing on home | Added Organization and WebSite JSON-LD. |
| Favicon/social preview | Present but incomplete | Favicon was live; social image is now wired to `/paladincompliance-bg.png`. |

Direct code changes:

- `src/app/layout.tsx`: global canonical, OG, Twitter, JSON-LD, optional PostHog, GA4, and Clarity scripts.
- `src/app/robots.ts`: sitemap now uses `https://www.paladincompliance.com/sitemap.xml`.
- `src/app/sitemap.xml/route.ts`: sitemap URLs now use `https://www.paladincompliance.com`.
- `docs/production-deployment.md`: added measurement/search env vars.

Required env vars:

- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`
- `NEXT_PUBLIC_CLARITY_PROJECT_ID`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`

External checklist:

1. PostHog: create/open the project at `https://us.posthog.com/`, copy the project key, set `NEXT_PUBLIC_POSTHOG_KEY`, redeploy, then confirm pageview and funnel events.
2. Clarity: create/open a project at `https://clarity.microsoft.com/`, copy the Project ID, set `NEXT_PUBLIC_CLARITY_PROJECT_ID`, redeploy, then confirm session recordings.
3. GA4: create/open the web stream at `https://analytics.google.com/analytics/web/`, copy the Measurement ID (`G-...`), set `NEXT_PUBLIC_GA_MEASUREMENT_ID`, redeploy, then verify Realtime.
4. Search Console: open `https://search.google.com/search-console`, verify the URL-prefix or domain property, then submit `https://www.paladincompliance.com/sitemap.xml`.
5. Vercel Domains: open `https://vercel.com/dashboard`, select the Paladin project, Settings > Domains, set `www.paladincompliance.com` as primary and redirect `paladincompliance.com` to it.
6. DNS if not already correct for Vercel: apex `A` record to `76.76.21.21`; `www` `CNAME` to `cname.vercel-dns.com`.
7. For GSC DNS verification, add a TXT record at the DNS provider: host `@`, value `google-site-verification=<token from Search Console>`, TTL default or 3600.

Scorecard after deploy/env:

- Analytics Readiness: 62/100
- SEO Readiness: 90/100
- Marketing Readiness: 84/100
- Conversion Tracking Readiness: 55/100

## jobs.vision

Live production:

- Home: `https://www.jobs.vision/` returns 200, but served stock CRA metadata before this patch.
- Robots: `https://www.jobs.vision/robots.txt` returns 200.
- Sitemap: `https://www.jobs.vision/sitemap.xml` returns 200 with 8 URLs.
- Favicon: `https://www.jobs.vision/favicon.svg` returns 200.
- Social asset candidate: `https://www.jobs.vision/images/clinicbg-home.webp` returns 200.

| Item | Production status | Repo status after this audit |
| --- | --- | --- |
| PostHog | Missing | Added optional loader via `REACT_APP_POSTHOG_KEY`. |
| Microsoft Clarity | Missing | Added optional loader via `REACT_APP_CLARITY_PROJECT_ID`. |
| GA4 | Missing | Added optional loader via `REACT_APP_GA_MEASUREMENT_ID`. |
| Google Search Console | Missing | Requires external verification. |
| Sitemap generation | Present but incomplete | Static sitemap existed but used bare domain; code now uses `www`. |
| robots.txt | Present but incomplete | Static robots existed but pointed at bare sitemap; code now uses `www`. |
| Open Graph tags | Missing | Added static OG tags. |
| Twitter/X tags | Missing | Added static Twitter tags. |
| Canonical URLs | Missing | Added static root canonical. |
| Structured data/schema | Missing | Added WebSite JSON-LD. |
| Favicon/social preview | Present but incomplete | Favicon was live; social preview now uses existing clinic image. |

Direct code changes:

- `frontend/public/index.html`: title, description, canonical, OG, Twitter, JSON-LD.
- `frontend/public/robots.txt`: `www` sitemap URL and explicit allow.
- `frontend/public/sitemap.xml`: all URLs moved to `https://www.jobs.vision`.
- `frontend/public/manifest.json`: updated app name, description, theme, start URL.
- `frontend/src/marketingAnalytics.js`: optional PostHog, Clarity, GA4, pageview, and conversion event helpers.
- `frontend/src/index.js`: initializes analytics.
- `frontend/src/App.js`: sends SPA route pageviews.
- `.env.example` and `frontend/.env.example`: added analytics env vars.

Required env vars:

- `REACT_APP_POSTHOG_KEY`
- `REACT_APP_POSTHOG_HOST=https://us.i.posthog.com`
- `REACT_APP_CLARITY_PROJECT_ID`
- `REACT_APP_GA_MEASUREMENT_ID`

External checklist:

1. PostHog: create/open the project at `https://us.posthog.com/`, copy the project key, set `REACT_APP_POSTHOG_KEY`, redeploy, then confirm `$pageview` events.
2. Clarity: create/open a project at `https://clarity.microsoft.com/`, copy the Project ID, set `REACT_APP_CLARITY_PROJECT_ID`, redeploy, then confirm recordings.
3. GA4: create/open the web stream at `https://analytics.google.com/analytics/web/`, copy the Measurement ID (`G-...`), set `REACT_APP_GA_MEASUREMENT_ID`, redeploy, then verify Realtime.
4. Search Console: open `https://search.google.com/search-console`, create a Domain property for `jobs.vision`, and verify with DNS TXT.
5. DNS for GSC: host `@`, type `TXT`, value `google-site-verification=<token from Search Console>`, TTL default or 3600.
6. Submit `https://www.jobs.vision/sitemap.xml` in Search Console after redeploy.
7. Vercel Domains: open `https://vercel.com/dashboard`, select `jobs.vision`, Settings > Domains, set `www.jobs.vision` as primary and redirect `jobs.vision` to it.
8. DNS if not already correct for Vercel: apex `A` record to `76.76.21.21`; `www` `CNAME` to `cname.vercel-dns.com`.

Scorecard after deploy/env:

- Analytics Readiness: 58/100
- SEO Readiness: 78/100
- Marketing Readiness: 76/100
- Conversion Tracking Readiness: 52/100

## Verification Summary

Builds:

- `jobs.vision/frontend`: `npm.cmd run build` passed.
- `hlv2`: `npm.cmd run build` passed after sandbox approval for `.next` writes.
- `paladincompliance`: `npm.cmd run build` passed after sandbox approval for `.next` writes.

Metadata:

- `jobs.vision/frontend/build/index.html` contains canonical, OG, Twitter, and JSON-LD.
- `hlv2/.next/server/app/index.html` contains canonical, OG, Twitter, and JSON-LD.
- `paladincompliance` local production render on port 4311 contains canonical, OG, Twitter, and JSON-LD after setting a dummy process-local `STRIPE_WEBHOOK_SECRET` for startup validation.

Crawlability:

- All three live `robots.txt` endpoints return 200 and allow public crawl.
- All three live `sitemap.xml` endpoints return 200.
- `jobs.vision` and Paladin code now align sitemap URLs with their production `www` canonical behavior.
- Honest Lenses still needs a Vercel domain redirect decision because both bare and `www` serve 200.
