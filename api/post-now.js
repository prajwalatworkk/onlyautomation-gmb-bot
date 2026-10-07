// One-click posting queue.
// GET → { [bizId]: { status: 'queued'|'posting'|'done'|'failed', requestedAt, finishedAt?, error? } }
// POST { bizId, status } → dashboard queues ('queued'); the bot reports 'posting' / 'done' / 'failed'.
// Login (dashboard) or bot key required — enforced by middleware.

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const PATH = 'requests.json';
const STATUSES = new Set(['queued', 'posting', 'done', 'failed']);

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
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET') return res.status(200).json((await read()).data);
    if (req.method !== 'POST') return res.status(405).end();

    const { bizId, status, error } = req.body || {};
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(bizId || '')) return res.status(400).json({ error: 'Invalid business id' });
    if (!STATUSES.has(status)) return res.status(400).json({ error: 'Invalid status' });

    let lastError = 'GitHub API error';
    for (let attempt = 1; attempt <= 4; attempt++) {
      const { data, sha } = await read();
      const now = new Date().toISOString();
      const prev = data[bizId] || {};
      if (status === 'queued' && (prev.status === 'queued' || prev.status === 'posting')) {
        return res.status(200).json({ ok: true, entry: prev, alreadyQueued: true });
      }
      const entry = status === 'queued'
        ? { status, requestedAt: now }
        : { ...prev, status, ...(status === 'posting' ? { startedAt: now } : { finishedAt: now }), ...(error ? { error: String(error).slice(0, 300) } : {}) };
      if (status !== 'failed') delete entry.error;
      data[bizId] = entry;

      const body = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
      const r = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ message: `post now · ${bizId} · ${status}`, content: body, ...(sha ? { sha } : {}) }),
      });
      if (r.ok) return res.status(200).json({ ok: true, entry });
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
