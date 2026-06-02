// Cloudflare Pages Function — live viewer presence via D1
// Bound to the gassy-goos-bingo-presence D1 database as env.DB

const TTL_MS  = 90_000;   // viewer is "active" if seen within 90 seconds
const CLEANUP = 0.05;     // 5% chance of running stale-row cleanup per request

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const now    = Date.now();
  const cutoff = now - TTL_MS;
  const DB     = env.DB;

  // GET /presence — return current active viewer count (read-only)
  if (request.method === 'GET') {
    const { count } = await DB.prepare(
      'SELECT COUNT(*) AS count FROM viewers WHERE last_seen > ?'
    ).bind(cutoff).first();
    return json({ viewers: count });
  }

  // POST /presence — heartbeat (keep alive) or leave
  if (request.method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch {}

    const { id, leave } = body;
    if (!id || typeof id !== 'string' || id.length > 64) {
      return json({ error: 'bad id' }, 400);
    }

    if (leave) {
      // Viewer is closing the tab — remove immediately
      await DB.prepare('DELETE FROM viewers WHERE session_id = ?').bind(id).run();
      const { count } = await DB.prepare(
        'SELECT COUNT(*) AS count FROM viewers WHERE last_seen > ?'
      ).bind(cutoff).first();
      return json({ viewers: count });
    }

    // Heartbeat — upsert session timestamp
    await DB.prepare(
      `INSERT INTO viewers (session_id, last_seen) VALUES (?, ?)
       ON CONFLICT(session_id) DO UPDATE SET last_seen = excluded.last_seen`
    ).bind(id, now).run();

    // Probabilistic cleanup of stale rows (avoids a cleanup Worker)
    if (Math.random() < CLEANUP) {
      await DB.prepare('DELETE FROM viewers WHERE last_seen < ?').bind(cutoff).run();
    }

    const { count } = await DB.prepare(
      'SELECT COUNT(*) AS count FROM viewers WHERE last_seen > ?'
    ).bind(cutoff).first();
    return json({ viewers: count });
  }

  return new Response('Method not allowed', { status: 405, headers: CORS });
}
