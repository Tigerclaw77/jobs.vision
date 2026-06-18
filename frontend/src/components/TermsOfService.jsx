import React from "react";
import "../styles/legal.css";

const UPDATED_AT = "June 18, 2026";

export default function TermsOfService() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <p className="legal-eyebrow">jobs.vision</p>
        <h1>Terms of Service</h1>
        <p className="legal-updated">Last updated: {UPDATED_AT}</p>

        <p>
          These Terms of Service govern your access to and use of jobs.vision. They apply
          to candidates, recruiters, employers, account holders, and visitors.
        </p>

        <h2>Accounts</h2>
        <p>
          You are responsible for the information you provide, for keeping your login
          credentials secure, and for activity under your account. You may not create an
          account using false, misleading, or unauthorized information.
        </p>

        <h2>Job Postings</h2>
        <p>
          Employers and recruiters are responsible for the accuracy, legality, and
          completeness of their job postings. Postings must describe real opportunities,
          use appropriate application destinations, and comply with applicable employment,
          wage, licensing, and anti-discrimination laws.
        </p>

        <h2>User Content</h2>
        <p>
          You retain ownership of content you submit, including job postings, profile
          information, application information, messages, and other materials. You grant
          jobs.vision permission to host, display, transmit, and process that content as
          needed to operate the service.
        </p>

        <h2>Applications</h2>
        <p>
          Candidates may use jobs.vision to discover jobs and follow employer-selected
          application destinations. Unless a feature specifically says otherwise,
          jobs.vision is not the employer, hiring manager, staffing agency, or system of
          record for hiring decisions.
        </p>

        <h2>Payments and Subscriptions</h2>
        <p>
          Paid recruiter and candidate services are billed through Stripe. Prices,
          billing cadence, and included features are shown before checkout. Subscriptions
          renew until cancelled. Cancellation stops future renewal charges but does not
          automatically refund charges already paid, except where required by law or
          expressly stated by jobs.vision.
        </p>

        <h2>Acceptable Use</h2>
        <p>
          You may not use jobs.vision to post fraudulent jobs, scrape or misuse data,
          interfere with the service, upload malicious code, harass others, violate
          privacy rights, impersonate another person or business, or use the service for
          unlawful activity.
        </p>

        <h2>Intellectual Property</h2>
        <p>
          jobs.vision, its design, software, branding, and platform content are protected
          by intellectual property laws. You may not copy, reverse engineer, or resell the
          service except as allowed by law or with written permission.
        </p>

        <h2>Disclaimer of Warranties</h2>
        <p>
          The service is provided as is and as available. jobs.vision does not guarantee
          uninterrupted availability, error-free operation, job availability, candidate
          quality, hiring outcomes, or the accuracy of third-party or user-submitted
          content.
        </p>

        <h2>Limitation of Liability</h2>
        <p>
          To the fullest extent allowed by law, jobs.vision will not be liable for
          indirect, incidental, consequential, special, punitive, or lost-profit damages
          arising from your use of the service. Our total liability for any claim is
          limited to the amount you paid to jobs.vision in the three months before the
          event giving rise to the claim.
        </p>

        <h2>Changes and Termination</h2>
        <p>
          We may update the service or these terms from time to time. We may suspend or
          terminate access for violations of these terms, legal risk, security concerns,
          nonpayment, or misuse of the service.
        </p>

        <h2>Governing Law</h2>
        <p>
          These terms are governed by the laws of the State of Texas, without regard to
          conflict-of-law rules, unless applicable law requires otherwise.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a href="mailto:support@jobs.vision">support@jobs.vision</a>.
        </p>
      </section>
    </main>
  );
}
