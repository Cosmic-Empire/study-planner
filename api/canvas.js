export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['authorization'];
  if (!token) return res.status(400).json({ error: 'Missing Authorization header' });

  const { path, ...rest } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path param' });

  const CANVAS_BASE = 'https://sdhc.instructure.com';
  const params = new URLSearchParams(rest);
  const fullUrl = CANVAS_BASE + path + (params.toString() ? '?' + params.toString() : '');

  // Hard 8s timeout on the Canvas fetch itself — Vercel free plan kills at 10s
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const canvasRes = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
      },
    });
    clearTimeout(timer);

    const text = await canvasRes.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Canvas returned non-JSON: ' + text.slice(0, 300) }); }

    const linkHeader = canvasRes.headers.get('Link');
    if (linkHeader) {
      res.setHeader('Link', linkHeader.replace(/https:\/\/sdhc\.instructure\.com(\/api\/v1\/[^>]*)/g, '/api/canvas?path=$1'));
    }

    return res.status(canvasRes.status).json(data);
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      // Return empty array instead of hanging — client treats this as "no assignments"
      return res.status(200).json([]);
    }
    return res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
}
