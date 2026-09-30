// POST { bizId, dataUrl } — stores a business logo as logos/<bizId>.png in the repo (the bot reads it from there)

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO;
const MAX_B64 = 1_500_000; // ~1.1 MB PNG

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    return res.status(500).json({ error: 'Setup needed: GITHUB_TOKEN + GITHUB_REPO env vars.' });
  }

  const { bizId, dataUrl } = req.body || {};
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(bizId || '')) return res.status(400).json({ error: 'Invalid business id' });
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Logo must be sent as a PNG data URL' });
  if (m[1].length > MAX_B64) return res.status(413).json({ error: 'Logo too large (max ~1 MB)' });

  const path = `logos/${bizId}.png`;
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
  try {
    // GitHub answers 409 when another commit (e.g. a settings save) lands moments before; re-read and retry.
    let lastError = 'GitHub API error';
    for (let attempt = 1; attempt <= 4; attempt++) {
      let sha;
      const existing = await fetch(`${url}?ref=main&t=${Date.now()}`, { headers: { ...headers, 'Cache-Control': 'no-cache' } });
      if (existing.ok) sha = (await existing.json()).sha;
      const r = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ message: `logo · ${bizId}`, content: m[1], ...(sha ? { sha } : {}) }),
      });
      if (r.ok) return res.status(200).json({ ok: true, path });
      const err = await r.json().catch(() => ({}));
      lastError = err.message || lastError;
      if (r.status !== 409) break;
      await new Promise(done => setTimeout(done, 1500 * attempt));
    }
    return res.status(500).json({ error: lastError });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
