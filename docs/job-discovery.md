# Job Discovery Import Pipeline

The job discovery pipeline is intentionally review-first. It discovers postings from employer career pages, stores them in `public.job_imports`, and never publishes to `public.jobs` until an admin approves the import.

## Add Sources

Copy `backend/scripts/job-discovery-sources.example.json` and add one or more sources:

```json
[
  {
    "employerName": "Example Employer",
    "employerWebsiteUrl": "https://example.com",
    "careersUrl": "https://example.com/careers",
    "industryKey": "eyecare",
    "sourceType": "career_page"
  }
]
```

Supported `sourceType` values:

- `career_page`
- `greenhouse`
- `lever`
- `workday`
- `unknown`

## Run Discovery

Apply `neon-migrations/009_job_imports.sql` first, then run:

```bash
node backend/scripts/discover-jobs.js backend/scripts/job-discovery-sources.example.json
```

The script respects robots.txt where practical, uses depth 1 by default, and upserts discovered rows by duplicate key.

## Review Imports

Admin UI:

```text
/admin/job-imports
```

Available actions:

- run discovery from a small source list
- edit normalized import fields
- open source URL
- open apply URL
- approve/publish
- reject

## Reusable Core

Industry-agnostic code lives in:

```text
src/lib/job-discovery/
```

jobs.vision eyecare-specific role and industry keywords live in:

```text
src/lib/job-discovery/industries/eyecare.ts
```
