// GET → post history per business ({ [bizId]: [{ date, headline, topic, keywords }] })
// POST { history } → saved by the GMB bot after each published post. Both are login/bot-key protected by middleware.

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const PATH = 'history.json';

module.exports = async function handler(req, res) {
  if (!GITHUB_TOKEN || !GITHUB_REPO) return res.status(500).json({ error: 'GITHUB_TOKEN / GITHUB_REPO not set' });
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${PATH}`;
  const headers = { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' };

  const read = async () => {
    const r = await fetch(`${url}?ref=main&t=${Date.now()}`, { headers: { ...headers, 'Cache-Control': 'no-cache' } });
    if (r.status === 404) return { data: {}, sha: undefined };
    if (!r.ok) throw new Error(`GitHub read failed (${r.status})`);
    const file = await r.json();
    return { data: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), sha: file.sha };
  };

  try {
    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json((await read()).data);
    }
    if (req.method !== 'POST') return res.status(405).end();

    const history = req.body && req.body.history;
    if (!history || typeof history !== 'object' || Array.isArray(history)) return res.status(400).json({ error: 'history object required' });
    const body = Buffer.from(JSON.stringify(history, null, 2)).toString('base64');
    if (body.length > 2_000_000) return res.status(413).json({ error: 'history too large' });

    let lastError = 'GitHub API error';
    for (let attempt = 1; attempt <= 4; attempt++) {
      const { sha } = await read();
      const r = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ message: `post history · ${new Date().toISOString()}`, content: body, ...(sha ? { sha } : {}) }),
      });
      if (r.ok) return res.status(200).json({ ok: true });
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
