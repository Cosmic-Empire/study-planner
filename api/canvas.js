export default async function handler(req, res) {
  // Allow requests from any origin (your Vercel frontend)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = req.headers['authorization'];
  if (!token) {
    return res.status(400).json({ error: 'Missing Authorization header' });
  }

  const { path } = req.query;
  if (!path) {
    return res.status(400).json({ error: 'Missing path parameter' });
  }

  const CANVAS_BASE = 'https://sdhc.instructure.com';
  const url = CANVAS_BASE + '/' + (Array.isArray(path) ? path.join('/') : path);

  // Forward any query params except 'path' itself
  const params = new URLSearchParams();
  for (const [key, val] of Object.entries(req.query)) {
    if (key !== 'path') params.append(key, val);
  }
  const fullUrl = params.toString() ? url + '?' + params.toString() : url;

  try {
    const canvasRes = await fetch(fullUrl, {
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
      },
    });

    const data = await canvasRes.json();

    // Forward the Link header for pagination
    const linkHeader = canvasRes.headers.get('Link');
    if (linkHeader) {
      // Rewrite Canvas URLs in Link header to go through our proxy
      const rewritten = linkHeader.replace(
        new RegExp(CANVAS_BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        '/api/canvas'
      );
      res.setHeader('Link', rewritten);
    }

    return res.status(canvasRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
}
