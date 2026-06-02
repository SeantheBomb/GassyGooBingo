// Pages Function — leaderboard API backed by D1
// GET  /leaderboard → top 100 entries sorted by time ascending
// POST /leaderboard → submit a new entry { name, timeSeconds }

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

  const DB = env.DB;

  // GET — return top 100
  if (request.method === 'GET') {
    const { results } = await DB.prepare(
      `SELECT id, name, time_seconds, submitted_at
       FROM leaderboard
       ORDER BY time_seconds ASC
       LIMIT 100`
    ).all();
    return json({ entries: results });
  }

  // POST — submit new entry
  if (request.method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch {}

    const { name, timeSeconds } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 50) {
      return json({ error: 'invalid name' }, 400);
    }
    if (typeof timeSeconds !== 'number' || timeSeconds < 1 || timeSeconds > 86400) {
      return json({ error: 'invalid time' }, 400);
    }

    const ts = Math.round(timeSeconds);
    const now = Date.now();

    await DB.prepare(
      'INSERT INTO leaderboard (name, time_seconds, submitted_at) VALUES (?, ?, ?)'
    ).bind(name.trim(), ts, now).run();

    // What rank did they land at?
    const { rank } = await DB.prepare(
      'SELECT COUNT(*) AS rank FROM leaderboard WHERE time_seconds < ?'
    ).bind(ts).first();

    // Prune to top 100
    await DB.prepare(
      `DELETE FROM leaderboard
       WHERE id NOT IN (SELECT id FROM leaderboard ORDER BY time_seconds ASC LIMIT 100)`
    ).run();

    return json({ rank: rank + 1 });
  }

  return new Response('Not found', { status: 404, headers: CORS });
}
