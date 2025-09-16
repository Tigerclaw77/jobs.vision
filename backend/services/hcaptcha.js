// backend/services/hcaptcha.js
const fetch = require('node-fetch');

async function verifyHCaptcha(token, secret, remoteip) {
  if (!token) return { success: false, 'error-codes': ['missing-input-response'] };

  const params = new URLSearchParams();
  params.append('response', token);
  params.append('secret', secret);
  if (remoteip) params.append('sitekeyremoteip', remoteip);

  const res = await fetch('https://hcaptcha.com/siteverify', {
    method: 'POST',
    body: params
  });
  const data = await res.json();
  // data: { success, challenge_ts, hostname, credit, score?, 'error-codes'? }
  return data;
}

module.exports = { verifyHCaptcha };
