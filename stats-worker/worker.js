// Dexle daily stats: counts finished daily puzzles from the web version.
// POST /result  { day: "YYYY-MM-DD", client: "<random id>", solved: true|false, guesses: 1..LIVES }
// GET  /stats?day=YYYY-MM-DD  ->  { day, players, solved, average, dist: [n1, n2, ...] }
// Needs a D1 database bound as DB (schema.sql) and the vars below (wrangler.toml or the dashboard).

const DEFAULTS = { ALLOWED_ORIGINS: 'https://rukicodebold.github.io', TIMEZONE: 'America/Los_Angeles', LIVES: '4', PER_IP_PER_DAY: '6' };

export default {
  async fetch(request, env) {
    const cfg = { ...DEFAULTS, ...env };
    const origin = request.headers.get('Origin') || '';
    const allowed = cfg.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const json = (body, status = 200, extra = {}) =>
      new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors, ...extra } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    const today = dayIn(cfg.TIMEZONE, 0);
    const near = [dayIn(cfg.TIMEZONE, -1), today, dayIn(cfg.TIMEZONE, 1)];
    const lives = parseInt(cfg.LIVES, 10);

    try {
      if (url.pathname === '/stats' && request.method === 'GET') {
        const day = url.searchParams.get('day') || today;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: 'bad day' }, 400);
        const { results } = await env.DB.prepare(
          'SELECT solved, guesses, COUNT(*) AS n FROM results WHERE day = ? GROUP BY solved, guesses'
        ).bind(day).all();
        let players = 0, solved = 0, sum = 0;
        const dist = Array(lives).fill(0);
        for (const r of results) {
          players += r.n;
          if (r.solved) { solved += r.n; sum += r.guesses * r.n; if (r.guesses >= 1 && r.guesses <= lives) dist[r.guesses - 1] += r.n; }
        }
        return json({ day, players, solved, average: solved ? Math.round((sum / solved) * 100) / 100 : null, dist },
          200, { 'Cache-Control': 'public, max-age=30' });
      }

      if (url.pathname === '/result' && request.method === 'POST') {
        if (allowed.length && origin && !allowed.includes(origin)) return json({ error: 'origin' }, 403);
        let b;
        try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
        const day = String(b.day || ''), client = String(b.client || '');
        const solved = b.solved === true, guesses = Number(b.guesses);
        if (!near.includes(day)) return json({ error: 'not a current day' }, 400);
        if (!/^[A-Za-z0-9_-]{8,64}$/.test(client)) return json({ error: 'bad client' }, 400);
        if (!Number.isInteger(guesses) || guesses < 1 || guesses > lives) return json({ error: 'bad guesses' }, 400);
        if (!solved && guesses !== lives) return json({ error: 'a failed game uses every life' }, 400);

        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const ipHash = await sha256(`${day}|${ip}`); // salted by day; the address itself is never stored
        const seen = await env.DB.prepare('SELECT COUNT(*) AS n FROM results WHERE day = ? AND ip_hash = ?').bind(day, ipHash).first();
        if (seen && seen.n >= parseInt(cfg.PER_IP_PER_DAY, 10)) return json({ ok: false, reason: 'limit' }, 429);

        const r = await env.DB.prepare(
          'INSERT OR IGNORE INTO results (day, client, solved, guesses, ip_hash, at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(day, client, solved ? 1 : 0, guesses, ipHash, Date.now()).run();
        return json({ ok: true, counted: (r.meta && r.meta.changes) ? true : false });
      }

      return json({ error: 'not found' }, 404);
    } catch (err) {
      return json({ error: 'server' }, 500);
    }
  },
};

function dayIn(tz, offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
}
