import React, { useRef, useState } from 'react';
// import HCaptcha from '@hcaptcha/react-hcaptcha';

const API_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/$/, '');
// const SITE_KEY = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_HCAPTCHA_SITE_KEY) ||
//   process.env.REACT_APP_HCAPTCHA_SITE_KEY || '10000000-ffff-ffff-ffff-000000000001';

export default function ManualOverride() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: '',
    company: '',
    companyWebsite: '',
    justification: '',
    proofUrlInput: ''
  });
  const [proofUrls, setProofUrls] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [captchaToken, setCaptchaToken] = useState('dev-bypass');
  const [captchaError, setCaptchaError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const captchaRef = useRef(null);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const addProofUrl = () => {
    const u = form.proofUrlInput.trim();
    if (u) setProofUrls((p) => Array.from(new Set([...p, u])));
    setForm((p) => ({ ...p, proofUrlInput: '' }));
  };

  const onFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setAttachments(files.slice(0, 3));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResult(null);
    setCaptchaError('');

    // if (!captchaToken) {
    //   // Kick the widget to prompt the user
    //   captchaRef.current?.execute?.();
    //   setCaptchaError('Please complete the captcha.');
    //   return;
    // }

    try {
      setSubmitting(true);

      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('email', form.email);
      fd.append('role', form.role);
      fd.append('company', form.company);
      fd.append('companyWebsite', form.companyWebsite);
      fd.append('justification', form.justification);
      fd.append('proofUrls', JSON.stringify(proofUrls));
      fd.append('hcaptchaToken', captchaToken);
      attachments.forEach((f) => fd.append('attachments', f, f.name));

      const res = await fetch(`${API_BASE}/api/manual-overrides`, { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        setResult({ ok: false, message: data?.error || 'Submission failed.' });
      } else {
        setResult({ ok: true, message: 'Request submitted. We’ll review and email you once a decision is made.' });
        setForm({
          name: '',
          email: '',
          role: '',
          company: '',
          companyWebsite: '',
          justification: '',
          proofUrlInput: ''
        });
        setProofUrls([]);
        setAttachments([]);
        setCaptchaToken('');
        captchaRef.current?.resetCaptcha?.();
      }
    } catch (err) {
      setResult({ ok: false, message: 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Optional: dim the busy background image for contrast */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 760,
          margin: '48px auto',
          padding: 0
        }}
      >
        <div
          style={{
            backdropFilter: 'blur(6px)',
            background: 'rgba(255,255,255,0.92)',
            border: '1px solid rgba(229,231,235,0.9)',
            borderRadius: 16,
            boxShadow: '0 10px 28px rgba(16,24,40,.10)',
            padding: 24,
            color: '#111'
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28, color: '#0f172a' }}>Manual Recruiter Verification</h1>
          <p style={{ marginTop: 8, color: '#334155' }}>
            If you don’t have a corporate email domain yet or represent a smaller regional brand, you can request a manual
            override. Provide details below so our team can verify your organization.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="row">
              <label>Name *</label>
              <input name="name" value={form.name} onChange={onChange} required />
            </div>
            <div className="row">
              <label>Email *</label>
              <input type="email" name="email" value={form.email} onChange={onChange} required />
            </div>
            <div className="row">
              <label>Role / Title</label>
              <input name="role" value={form.role} onChange={onChange} />
            </div>
            <div className="row">
              <label>Company *</label>
              <input name="company" value={form.company} onChange={onChange} required />
            </div>
            <div className="row">
              <label>Company Website</label>
              <input name="companyWebsite" value={form.companyWebsite} onChange={onChange} placeholder="https://..." />
            </div>

            <div className="row">
              <label>Justification / Notes</label>
              <textarea
                name="justification"
                value={form.justification}
                onChange={onChange}
                rows={4}
                placeholder="Explain why you need a manual override and how we can verify your organization."
              />
            </div>

            <div className="row">
              <label>Proof URLs</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  name="proofUrlInput"
                  value={form.proofUrlInput}
                  onChange={onChange}
                  placeholder="LinkedIn, state license lookup, press page, etc."
                />
                <button type="button" onClick={addProofUrl}>Add</button>
              </div>
              {proofUrls.length > 0 && (
                <ul style={{ marginTop: 6, color: '#0f172a' }}>
                  {proofUrls.map((u) => (
                    <li key={u} style={{ wordBreak: 'break-all' }}>{u}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="row">
              <label>Attachments (PDF/PNG/JPG up to 10MB, max 3)</label>
              <input type="file" onChange={onFiles} accept=".pdf,image/*" multiple />
            </div>

            {/* <div className="row">
              <HCaptcha
                sitekey={SITE_KEY}
                ref={captchaRef}
                onVerify={(tok) => { setCaptchaToken(tok); setCaptchaError(''); }}
                onExpire={() => setCaptchaToken('')}
                onError={(err) => {
                  console.error('hCaptcha error:', err);
                  setCaptchaError('hCaptcha failed to initialize. Check site key, allowed domains, and blockers.');
                }}
              />
              {captchaError && (
                <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: '#991b1b' }}>
                  {captchaError}
                </div>
              )}
            </div> */}

            <div className="row">
              <button type="submit" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>

            {result && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 8,
                  background: result.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  color: result.ok ? '#065f46' : '#991b1b'
                }}
              >
                {result.message}
              </div>
            )}
          </form>
        </div>
      </div>

      <style>{`
        .row { margin: 12px 0; display: flex; flex-direction: column; gap: 6px; }
        label { font-weight: 600; color: #0f172a; }
        input, textarea, button {
          padding: 10px; font-size: 14px;
        }
        input, textarea {
          border: 1px solid #d1d5db; border-radius: 8px; color: #0f172a; background: #fff;
        }
        input::placeholder, textarea::placeholder { color: #64748b; }
        button {
          border: 0; border-radius: 10px; cursor: pointer;
          background: #0ea5b9; color: #fff; font-weight: 600;
          padding: 12px 16px;
        }
        button:hover { filter: brightness(0.95); }
      `}</style>
    </div>
  );
}
