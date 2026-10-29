// GI Guy patient feedback API (Cloudflare Worker + D1).
// Public:  POST /api/feedback            a patient's survey answers
// Staff:   POST /api/login                passcode -> signed session token (12 h)
//          GET  /api/responses            all responses, newest first
//          PATCH /api/responses/:id       status, staff note, mark replied
const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const clip = (v, n) => (v == null ? null : String(v).trim().slice(0, n) || null);
const OFFICES = ['Fuquay-Varina', 'Dunn', 'Not sure'];
const STATUSES = ['new', 'in_progress', 'done'];

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/[+/=]/g, c => ({ '+': '-', '/': '_', '=': '' }[c]));
}
function sameText(a, b) {   // constant-time compare
  if (a.length !== b.length) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
// At most `limit` hits of `kind` per IP in the last `windowSec` seconds.
async function rateLimited(env, kind, ipHash, limit, windowSec) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('DELETE FROM hits WHERE at < ?').bind(now - 86400).run();
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM hits WHERE kind = ? AND ip_hash = ? AND at > ?').bind(kind, ipHash, now - windowSec).first();
  if (row.n >= limit) return true;
  await env.DB.prepare('INSERT INTO hits (kind, ip_hash, at) VALUES (?, ?, ?)').bind(kind, ipHash, now).run();
  return false;
}
async function staffOk(req, env) {
  const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const [exp, sig] = tok.split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000 || !env.SESSION_SECRET) return false;
  return sameText(sig, await hmac(env.SESSION_SECRET, 'staff.' + exp));
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    const cors = allowed.includes(origin)
      ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS', vary: 'origin' }
      : {};
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const reply = (b, s) => json(b, s, cors);
    const ipHash = await sha256((req.headers.get('cf-connecting-ip') || 'local') + '|giguy');
    try {
      if (url.pathname === '/api/feedback' && req.method === 'POST') {
        if (!cors['access-control-allow-origin']) return reply({ error: 'origin' }, 403);
        const b = await req.json().catch(() => null);
        if (!b || typeof b !== 'object') return reply({ error: 'bad request' }, 400);
        if (b.website) return reply({ ok: true });                       // honeypot: bots fill every field
        if (await rateLimited(env, 'submit', ipHash, 6, 3600)) return reply({ error: 'Too many responses from this device. Please try again later.' }, 429);
        const office = OFFICES.includes(b.office) ? b.office : 'Not sure';
        const rating = Number.isInteger(b.rating) && b.rating >= 1 && b.rating <= 5 ? b.rating : null;
        const answers = {};
        for (const [k, v] of Object.entries(b.answers || {}).slice(0, 12)) answers[clip(k, 80)] = clip(v, 20);
        const c = b.contact || {};
        const wants = b.wantsReply ? 1 : 0;
        if (!rating && !clip(b.comments, 1) && !clip(b.shoutoutText, 1)) return reply({ error: 'Please answer at least one question.' }, 400);
        await env.DB.prepare(`INSERT INTO responses (office, rating, recommend, answers, comments, shoutout_person, shoutout_text, wants_reply, contact_name, contact_phone, contact_email, ip_hash)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(office, rating, clip(b.recommend, 10), JSON.stringify(answers), clip(b.comments, 3000),
          clip(b.shoutoutPerson, 120), clip(b.shoutoutText, 2000), wants, wants ? clip(c.name, 120) : null, wants ? clip(c.phone, 40) : null, wants ? clip(c.email, 160) : null, ipHash).run();
        return reply({ ok: true });
      }
      if (url.pathname === '/api/login' && req.method === 'POST') {
        if (await rateLimited(env, 'login', ipHash, 8, 900)) return reply({ error: 'Too many tries. Wait 15 minutes.' }, 429);
        const b = await req.json().catch(() => ({}));
        if (!env.STAFF_PASSCODE || !sameText(String(b.passcode || ''), env.STAFF_PASSCODE)) return reply({ error: 'That passcode is not right.' }, 401);
        const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
        return reply({ token: exp + '.' + await hmac(env.SESSION_SECRET, 'staff.' + exp), expires: exp });
      }
      if (url.pathname.startsWith('/api/responses')) {
        if (!(await staffOk(req, env))) return reply({ error: 'signed out' }, 401);
        if (req.method === 'GET' && url.pathname === '/api/responses') {
          const { results } = await env.DB.prepare('SELECT * FROM responses ORDER BY created_at DESC LIMIT 2000').all();
          for (const r of results) { delete r.ip_hash; try { r.answers = JSON.parse(r.answers || '{}'); } catch (e) { r.answers = {}; } }
          return reply({ responses: results });
        }
        const m = url.pathname.match(/^\/api\/responses\/(\d+)$/);
        if (m && req.method === 'PATCH') {
          const b = await req.json().catch(() => ({}));
          const sets = [], vals = [];
          if (STATUSES.includes(b.status)) { sets.push('status = ?'); vals.push(b.status); }
          if ('staffNote' in b) { sets.push('staff_note = ?'); vals.push(clip(b.staffNote, 4000)); }
          if (b.replied === true) sets.push("replied_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')");
          if (b.replied === false) sets.push('replied_at = NULL');
          if (!sets.length) return reply({ error: 'nothing to change' }, 400);
          sets.push("updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')");
          await env.DB.prepare('UPDATE responses SET ' + sets.join(', ') + ' WHERE id = ?').bind(...vals, Number(m[1])).run();
          const row = await env.DB.prepare('SELECT * FROM responses WHERE id = ?').bind(Number(m[1])).first();
          if (!row) return reply({ error: 'not found' }, 404);
          delete row.ip_hash; row.answers = JSON.parse(row.answers || '{}');
          return reply({ response: row });
        }
      }
      return reply({ error: 'not found' }, 404);
    } catch (e) {
      return reply({ error: 'Something went wrong. Please try again.' }, 500);
    }
  },
};
