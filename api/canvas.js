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

  // Single abort controller covers BOTH the fetch AND the body read
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const canvasRes = await fetch(fullUrl, {
      signal: controller.signal,
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
      },
    });

    // Read body with same signal — this is the key fix
    // If body read takes too long, abort fires and we return []
    const text = await canvasRes.text();
    clearTimeout(timer);

    let data;
    try { data = JSON.parse(text); }
    catch(e) { return res.status(200).json([]); }

    if (!canvasRes.ok) {
      return res.status(canvasRes.status).json(
        typeof data === 'object' ? data : { error: 'Canvas error ' + canvasRes.status }
      );
    }

    return res.status(200).json(Array.isArray(data) ? data : data);

  } catch (err) {
    clearTimeout(timer);
    // AbortError = timeout — return empty array so client never hangs
    return res.status(200).json([]);
  }
}
