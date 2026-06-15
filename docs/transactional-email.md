# Transactional Email

jobs.vision sends backend transactional email through the shared Nodemailer service in
`backend/services/email.js`.

## Provider

The configured provider is Resend SMTP for the verified `jobs.vision` domain.

Required backend environment variables:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=<resend-api-key>
SMTP_FROM=no-reply@jobs.vision
```

`RESEND_API_KEY` is also supported as a fallback when `SMTP_PASS` is empty. Prefer
`SMTP_PASS` in deployed environments so the SMTP credential is explicit.

Optional local smoke-test recipient:

```env
SMTP_TEST_RECIPIENT=<non-production-test-inbox>
```

Never use a real production user address for smoke tests.

## Active Backend Email Paths

All active backend email paths use the shared `sendEmail` helper:

| Flow | Source |
|---|---|
| Applicant notification to recruiter | `backend/routes/applications.js` |
| Listing claim approval notification | `backend/routes/admin.js` |
| Listing claim rejection notification | `backend/routes/admin.js` |
| Recruiter domain verification notification | `backend/routes/recruiterDomains.js` |
| Manual override decision notification | `backend/routes/manualOverrides.js` |

## Neon Auth Verification Emails

User email verification and magic-link style auth flows are separate from the backend SMTP
service. The frontend uses Neon Auth through `frontend/src/utils/neonAuthClient.js`.

Backend Resend SMTP readiness does not by itself verify Neon Auth email delivery. Neon Auth
verification emails must be configured and tested in Neon/Auth provider settings separately.
