import React from "react";
import "../styles/legal.css";

const UPDATED_AT = "June 18, 2026";

export default function PrivacyPolicy() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <p className="legal-eyebrow">jobs.vision</p>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: {UPDATED_AT}</p>

        <p>
          This Privacy Policy explains how jobs.vision collects, uses, and protects
          information from candidates, recruiters, employers, account holders, and
          visitors.
        </p>

        <h2>Information We Collect</h2>
        <p>
          We collect information you provide directly, including account details, contact
          information, candidate profile details, recruiter profile details, job postings,
          application destination information, messages, support requests, and billing
          information needed to operate paid services.
        </p>

        <h2>Candidate Accounts and Applications</h2>
        <p>
          Candidates may provide profile information, saved jobs, application activity,
          contact details, and preferences. If resume uploads, candidate profiles, or
          richer application tools are enabled, we may process those files and related
          information to provide the requested feature.
        </p>

        <h2>Recruiter and Employer Accounts</h2>
        <p>
          Recruiters and employers may provide business information, contact methods,
          job postings, application destinations, verification details, billing status,
          and subscription information.
        </p>

        <h2>Analytics and Usage Data</h2>
        <p>
          We may collect usage information such as pages viewed, listing views, apply
          clicks, device and browser information, approximate location derived from IP
          address, referring pages, and timestamps. This helps us operate, secure, and
          improve the service.
        </p>

        <h2>Cookies</h2>
        <p>
          We use cookies and similar technologies for authentication, preferences,
          security, analytics, and service performance. You can adjust browser settings
          to limit cookies, but some features may not work correctly.
        </p>

        <h2>Payments</h2>
        <p>
          Payments are processed by Stripe. jobs.vision does not store full card numbers.
          Stripe may collect payment details, billing information, and transaction data
          under its own privacy and security practices.
        </p>

        <h2>Email and Communications</h2>
        <p>
          We use email providers, including Resend, to send account verification,
          transactional, support, and service-related emails. These messages may include
          information needed to verify your account, manage postings, or use the service.
        </p>

        <h2>How We Use Information</h2>
        <p>
          We use information to provide accounts, show jobs, manage recruiter postings,
          support applications, process payments, send service messages, prevent abuse,
          improve search and matching, troubleshoot issues, and comply with legal
          obligations.
        </p>

        <h2>Sharing Information</h2>
        <p>
          We share information with service providers that help us operate jobs.vision,
          including hosting, authentication, database, payment, email, analytics, and
          security providers. We may also share information when required by law, to
          protect rights and safety, or as part of a business transfer.
        </p>

        <h2>Data Retention</h2>
        <p>
          We keep information as long as needed to provide the service, maintain business
          records, resolve disputes, enforce agreements, improve reliability, and comply
          with legal obligations. We may retain limited records after account closure
          where necessary for security, billing, audit, or legal reasons.
        </p>

        <h2>Your Rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, delete, or
          restrict certain personal information. You can contact us to make a request. We
          may need to verify your identity before responding.
        </p>

        <h2>Security</h2>
        <p>
          We use reasonable technical and organizational safeguards to protect
          information. No internet service can guarantee perfect security.
        </p>

        <h2>Contact</h2>
        <p>
          Privacy questions and requests can be sent to{" "}
          <a href="mailto:support@jobs.vision">support@jobs.vision</a>.
        </p>
      </section>
    </main>
  );
}
