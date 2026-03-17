export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = req.headers['authorization'];
  if (!token) return res.status(400).json({ error: 'Missing Authorization header' });

  // Expect: /api/canvas?path=/api/v1/courses&per_page=50&...
  const { path, ...rest } = req.query;
  if (!path) return res.status(400).json({ error: 'Missing path param' });

  const params = new URLSearchParams(rest);
  const CANVAS_BASE = 'https://sdhc.instructure.com';
  const fullUrl = CANVAS_BASE + path + (params.toString() ? '?' + params.toString() : '');

  console.log('Proxying to:', fullUrl);

  try {
    const canvasRes = await fetch(fullUrl, {
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
      },
    });

    const text = await canvasRes.text();
    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(500).json({ error: 'Canvas returned non-JSON: ' + text.slice(0, 200) }); }

    // Forward Link header for pagination, rewriting Canvas base URL to proxy URL
    const linkHeader = canvasRes.headers.get('Link');
    if (linkHeader) {
      const rewritten = linkHeader.replace(/https:\/\/sdhc\.instructure\.com(\/api\/v1\/[^>]*)/g, '/api/canvas?path=$1');
      res.setHeader('Link', rewritten);
    }

    return res.status(canvasRes.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Proxy fetch failed: ' + err.message });
  }
}
