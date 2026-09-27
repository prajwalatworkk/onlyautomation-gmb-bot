// Vercel serverless function — GET reads config, POST saves config to GitHub
// Config is stored as config.json in this repo so the bot can read it via raw GitHub URL

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO  = process.env.GITHUB_REPO;   // e.g. "prajwalshetty/onlyautomation"
const CONFIG_PATH  = 'config.json';

const DEFAULT_CONFIG = {
  active: true,
  days: ['Tue', 'Fri'],
  time: '10:00',
  postsPerWeek: 2,
  topics: ['Google Ads Tips', 'Lead Generation', 'Website Design', 'Local SEO', 'Social Media'],
  autoPost: true,
  whatsappApproval: false,
  includeImage: true,
  learnMore: true,
  websiteUrl: 'https://digitalhub360.in',
  updatedAt: null,
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — return current config
  if (req.method === 'GET') {
    try {
      const r = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${CONFIG_PATH}`,
        { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } }
      );
      if (r.status === 404) return res.status(200).json(DEFAULT_CONFIG);
      const data = await r.json();
      const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      return res.status(200).json({ ...content, _sha: data.sha });
    } catch (e) {
      return res.status(200).json(DEFAULT_CONFIG);
    }
  }

  // POST — save config to GitHub
  if (req.method === 'POST') {
    try {
      const config = { ...req.body };
      const sha = config._sha;
      delete config._sha;
      config.updatedAt = new Date().toISOString();

      const body = {
        message: `dashboard update · ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
        content: Buffer.from(JSON.stringify(config, null, 2)).toString('base64'),
      };
      if (sha) body.sha = sha;

      const r = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${CONFIG_PATH}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json',
          },
          body: JSON.stringify(body),
        }
      );
      if (!r.ok) {
        const err = await r.json();
        return res.status(500).json({ error: err.message || 'GitHub API error' });
      }
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).end();
};
