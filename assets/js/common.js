/* Shared by the public site and the admin console. */
(function (global) {
  'use strict';

  const DRAFT_KEY = 'giguy:draft';
  const TOKEN_KEY = 'giguy:gh-token';
  const VERSION_KEY = 'giguy:version-preview';

  function store(kind) {
    try { return kind === 'session' ? global.sessionStorage : global.localStorage; } catch (e) { return null; }
  }
  function getItem(key) {
    for (const s of [store('local'), store('session')]) {
      try { const v = s && s.getItem(key); if (v) return v; } catch (e) { /* blocked */ }
    }
    return null;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Only http(s), mailto, tel, relative and anchor links survive; anything else becomes "#".
  function safeUrl(u) {
    const s = String(u || '').trim();
    if (!s) return '#';
    if (/^(https?:|mailto:|tel:)/i.test(s) || /^[#./a-z0-9_-]/i.test(s) && !/^[a-z][a-z0-9+.-]*:/i.test(s)) return s;
    return '#';
  }
  function isExternal(u) { return /^https?:/i.test(u || ''); }
  function tel(phone) { return 'tel:+1' + String(phone || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); }

  // Tiny inline markdown: **bold**, *em*, [text](url).
  function inline(text) {
    let s = esc(text);
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, t, u) {
      const url = safeUrl(u.replace(/&amp;/g, '&'));
      const ext = isExternal(url) ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(url) + '"' + ext + '>' + t + '</a>';
    });
    // Phone numbers written in text become tap-to-call links that never break across lines.
    // (Skips numbers already inside a link, e.g. [call us](tel:...).)
    // Fax numbers (preceded by "fax") just stay on one line; they aren't something to tap and call.
    s = s.replace(/(<a\b[^>]*>.*?<\/a>)|\((\d{3})\)\s?(\d{3})-(\d{4})/g, (m, link, a, b, c, at, all) => {
      if (link) return link;
      const num = '(' + a + ') ' + b + '-' + c;
      return /fax\b[^.;]{0,60}$/i.test(all.slice(Math.max(0, at - 70), at)) ? '<span class="tel">' + num + '</span>'
        : '<a class="tel" href="tel:+1' + a + b + c + '">' + num + '</a>';
    });
    return s;
  }
  // Blocks split on blank lines. "## " starts a heading line, "- " lines make a list.
  function md(text) {
    return String(text || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => {
      const lines = p.split('\n');
      let out = '';
      while (lines.length && /^##\s+/.test(lines[0])) out += '<h3>' + inline(lines.shift().replace(/^##\s+/, '')) + '</h3>';
      if (!lines.length) return out;
      if (lines.every(l => /^[-•]\s+/.test(l))) return out + '<ul>' + lines.map(l => '<li>' + inline(l.replace(/^[-•]\s+/, '')) + '</li>').join('') + '</ul>';
      return out + '<p>' + lines.map(inline).join('<br>') + '</p>';
    }).join('');
  }
  function lines(text) { return String(text || '').split('\n').map(s => s.trim()).filter(Boolean); }

  // A banner is live when it isn't hidden and now is inside its (optional) start/end window.
  function bannerState(b, now) {
    if (!b || b.hidden || !String(b.message || '').trim()) return 'off';
    const t = (now || new Date()).getTime();
    const s = b.start ? Date.parse(b.start) : NaN;
    const e = b.end ? Date.parse(b.end) : NaN;
    if (!isNaN(s) && t < s) return 'scheduled';
    if (!isNaN(e) && t >= e) return 'expired';
    return 'live';
  }

  function readDraft() {
    try { const raw = store('local') && store('local').getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  async function loadSite() {
    const params = new URLSearchParams(global.location.search);
    if (params.has('draft')) {
      const d = readDraft();
      if (d) return { data: d, draft: true };
    }
    // A past version opened from the admin's Change history (kept apart from unpublished edits).
    if (params.has('version')) {
      try { const v = JSON.parse(store('local').getItem(VERSION_KEY) || 'null'); if (v) return { data: v, draft: true, version: true }; } catch (e) { /* fall through */ }
    }
    const base = global.GG_BASE || '';
    const res = await fetch(base + 'data/site.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('site.json ' + res.status);
    return { data: await res.json(), draft: false };
  }

  global.GG = {
    DRAFT_KEY, TOKEN_KEY, VERSION_KEY,
    esc, safeUrl, isExternal, tel, inline, md, lines, bannerState, loadSite, readDraft, getItem,
  };
})(window);
