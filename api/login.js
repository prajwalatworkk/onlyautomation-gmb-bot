// POST { password } — checks the dashboard password and sets a 30-day login cookie.
const crypto = require('crypto');

const MAX_AGE = 60 * 60 * 24 * 30;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return res.status(503).json({ error: 'Login is not set up yet.' });

  const given = Buffer.from(String((req.body && req.body.password) || ''));
  const expected = Buffer.from(password);
  const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);
  if (!ok) {
    await new Promise(done => setTimeout(done, 800)); // slow down password guessing
    return res.status(401).json({ error: 'Wrong password' });
  }

  const payload = `v1.${Math.floor(Date.now() / 1000) + MAX_AGE}`;
  const sig = crypto.createHmac('sha256', `${process.env.GITHUB_TOKEN || ''}|${password}`).update(payload).digest('hex');
  res.setHeader('Set-Cookie', `oa_session=${payload}.${sig}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
  return res.status(200).json({ ok: true });
};
