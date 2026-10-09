/* "Suggest an edit" — for people signed into the admin console only.
 *
 * A 💡 button on every page (public site and /admin/) takes a screenshot of
 * what's on screen, lets you draw on it to point at things, and saves the note
 * plus the screenshot to a PRIVATE GitHub repo (the site repo is public). The
 * admin console lists them under "Suggested edits"; /process-edits in the
 * giguy.net repo works through them. Same idea as Rooted's "Suggest a feature".
 *
 * Storage: <editsRepo>/edits/<id>.json (+ <id>.jpg), written with the admin's
 * own GitHub token, so the public never sees the button or the data. */
(function (global) {
  'use strict';
  const G = global.GG;
  const CFG_KEY = 'giguy:gh-config';
  const DEFAULT_EDITS_REPO = 'korivernon/giguy-edits';
  const DIR = 'edits';
  const KINDS = [['change', 'Change something'], ['bug', "Something's broken"], ['feature', 'New feature'], ['wording', 'Wording']];
  const STATUSES = [['new', 'New'], ['in_progress', 'In progress'], ['done', 'Done'], ['wont_do', "Won't do"]];
  const esc = G.esc;

  function cfg() { try { return JSON.parse(global.localStorage.getItem(CFG_KEY) || '{}'); } catch (e) { return {}; } }
  const token = () => G.getItem(G.TOKEN_KEY);
  const repo = () => cfg().editsRepo || DEFAULT_EDITS_REPO;

  /* ---------------- GitHub (private edits repo) ---------------- */
  async function gh(path, opts) {
    const res = await fetch('https://api.github.com' + path, Object.assign({}, opts, {
      headers: Object.assign({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', Authorization: 'Bearer ' + token() },
        opts && opts.body ? { 'Content-Type': 'application/json' } : {}, (opts && opts.headers) || {}),
    }));
    if (opts && opts.raw) { if (!res.ok) throw Object.assign(new Error('GitHub ' + res.status), { status: res.status }); return res; }
    let body = null; try { body = await res.json(); } catch (e) { /* empty */ }
    if (!res.ok) throw Object.assign(new Error((body && body.message) || ('GitHub ' + res.status)), { status: res.status });
    return body;
  }
  const url = p => '/repos/' + repo() + '/contents/' + p;
  const b64 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const unb64 = s => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/\s/g, '')), c => c.charCodeAt(0)));
  async function put(path, content64, message, sha) {
    return gh(url(path), { method: 'PUT', body: JSON.stringify({ message, content: content64, sha: sha || undefined }) });
  }
  function explain(err) {
    if (err.status === 404 || err.status === 403) return 'Your GitHub token can\'t reach ' + repo() + '. Edit the token on GitHub and add that repository (Contents: read and write).';
    if (err.status === 401) return 'Your GitHub token was rejected. Sign into the admin page again.';
    return err.message;
  }

  async function list() {
    let files;
    try { files = await gh(url(DIR) + '?t=' + Date.now()); } catch (e) { if (e.status === 404) return []; throw e; }
    const jsons = (Array.isArray(files) ? files : []).filter(f => /\.json$/.test(f.name));
    const items = await Promise.all(jsons.map(async f => {
      const r = await gh(url(f.path) + '?t=' + Date.now());
      const item = JSON.parse(unb64(r.content)); item._sha = r.sha; return item;
    }));
    return items.sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)));
  }
  async function update(item, changes) {
    const next = Object.assign({}, item, changes, { updated_at: new Date().toISOString() });
    delete next._sha;
    const r = await put(DIR + '/' + item.id + '.json', b64(JSON.stringify(next, null, 2) + '\n'), 'Edit ' + item.id + ': ' + (changes.status || 'update'), item._sha);
    next._sha = r.content.sha; return next;
  }
  // Private repo, so images come through the API (not a public URL).
  async function imageUrl(item) {
    if (!item.screenshot) return null;
    const res = await gh(url(item.screenshot), { raw: true, headers: { Accept: 'application/vnd.github.raw' } });
    return URL.createObjectURL(await res.blob());
  }

  /* ---------------- screenshot ---------------- */
  function loadLib() {
    if (global.htmlToImage) return Promise.resolve(true);
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js';
      s.onload = () => res(!!global.htmlToImage); s.onerror = () => res(false);
      document.head.appendChild(s);
    });
  }
  // Warm-up: the library and the page's web fonts are fetched once, in the background, as soon as the
  // button appears; otherwise the first tap can take longer than the timeout and come back empty.
  let fontCSS = null;
  function warm() {
    loadLib().then(ok => { if (ok && !fontCSS) fontCSS = global.htmlToImage.getFontEmbedCSS(document.body).catch(() => ''); });
  }
  // What's on screen right now (not the whole long page).
  async function capture() {
    if (!(await loadLib())) return null;
    if (!fontCSS) warm();
    const fontEmbedCSS = await Promise.race([fontCSS, new Promise(r => setTimeout(() => r(undefined), 4000))]);
    const ratio = Math.min(global.devicePixelRatio || 1, 2);
    const bg = getComputedStyle(document.body).backgroundColor;
    const opts = {
      pixelRatio: ratio, cacheBust: false, backgroundColor: bg, fontEmbedCSS: fontEmbedCSS || undefined,
      filter: n => {
        if (!n.tagName) return true;
        if (n.id === 'gg-suggest' || (n.classList && (n.classList.contains('gg-sg-dialog') || n.classList.contains('toast')))) return false;
        if (n.tagName === 'IFRAME') return false;                                      // maps, videos
        if (n.tagName === 'IMG' && n.src && new URL(n.src, location.href).origin !== location.origin) return false;
        return true;
      },
    };
    const top = global.scrollY, vw = global.innerWidth, vh = global.innerHeight;
    const timeout = new Promise(r => setTimeout(() => r(null), 12000));               // never leave the button hanging
    try {
      const full = await Promise.race([timeout, global.htmlToImage.toCanvas(document.body, opts)]);
      if (!full) return null;
      const out = document.createElement('canvas');
      out.width = Math.round(vw * ratio); out.height = Math.round(vh * ratio);
      const ctx = out.getContext('2d');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(full, 0, Math.round(top * ratio), out.width, out.height, 0, 0, out.width, out.height);
      // Sticky header: in the copy it sits at its natural spot near the top of the page, so when the
      // page is scrolled, paint it back over the top of the screenshot where the visitor sees it.
      const hdr = document.querySelector('.header') || document.getElementById('topbar');
      if (hdr && top > 0 && hdr.getBoundingClientRect().top <= 1) {
        const tb = document.querySelector('.topbar:not(#topbar)');
        const naturalTop = tb ? tb.getBoundingClientRect().bottom + top : 0;   // site: just under the phone bar; admin: page top
        const h = hdr.offsetHeight;
        ctx.drawImage(full, 0, Math.round(naturalTop * ratio), out.width, Math.round(h * ratio), 0, 0, out.width, Math.round(h * ratio));
      }
      return out.toDataURL('image/jpeg', 0.8);
    } catch (e) { return null; }
  }

  /* ---------------- markup: draw on the screenshot ---------------- */
  function annotate(src, host) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const wrap = document.createElement('div');
        wrap.className = 'gg-markup'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Mark up screenshot');
        const colors = ['#e0352b', '#f2c230', '#1f9d55', '#2563eb', '#111111'];
        wrap.innerHTML = '<div class="gg-markup-bar"><button type="button" data-k="cancel">Cancel</button><span class="sp"></span>' +
          colors.map((c, i) => '<button type="button" class="sw' + (i ? '' : ' on') + '" data-c="' + c + '" style="background:' + c + '" aria-label="Pen colour ' + (i + 1) + '"></button>').join('') +
          '<span class="sp"></span><button type="button" data-k="undo" aria-label="Undo">↶</button><button type="button" data-k="clear">Clear</button><button type="button" class="pri" data-k="done">Done</button></div>' +
          '<div class="gg-markup-stage"><canvas></canvas></div><p class="gg-markup-tip">Draw with your finger or mouse to circle or point at things.</p>';
        host.appendChild(wrap);
        const canvas = wrap.querySelector('canvas'), stage = wrap.querySelector('.gg-markup-stage'), ctx = canvas.getContext('2d');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const fit = () => { const k = Math.min(stage.clientWidth / img.naturalWidth, stage.clientHeight / img.naturalHeight); canvas.style.width = Math.round(img.naturalWidth * k) + 'px'; canvas.style.height = Math.round(img.naturalHeight * k) + 'px'; };
        let strokes = [], current = null, color = colors[0];
        const redraw = () => {
          ctx.drawImage(img, 0, 0);
          const lw = Math.max(4, canvas.width / 160);
          strokes.concat(current ? [current] : []).forEach(st => {
            ctx.strokeStyle = st.color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); st.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
            if (st.pts.length === 1) ctx.lineTo(st.pts[0][0] + .1, st.pts[0][1] + .1);
            ctx.stroke();
          });
        };
        const pt = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; };
        canvas.addEventListener('pointerdown', e => { e.preventDefault(); canvas.setPointerCapture(e.pointerId); current = { color, pts: [pt(e)] }; redraw(); });
        canvas.addEventListener('pointermove', e => { if (current) { current.pts.push(pt(e)); redraw(); } });
        const end = () => { if (current) { strokes.push(current); current = null; redraw(); } };
        canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
        wrap.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          if (b.dataset.c) { color = b.dataset.c; wrap.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === b)); return; }
          const k = b.dataset.k;
          if (k === 'undo') { strokes.pop(); redraw(); }
          if (k === 'clear') { strokes = []; redraw(); }
          if (k === 'cancel' || k === 'done') {
            const out = k === 'done' && strokes.length ? canvas.toDataURL('image/jpeg', 0.82) : null;
            global.removeEventListener('resize', fit); wrap.remove(); resolve(out);
          }
        });
        global.addEventListener('resize', fit);
        redraw(); fit();
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /* ---------------- the button + dialog ---------------- */
  let fab = null;
  function toast(msg, bad) {
    const t = document.createElement('div'); t.className = 'gg-sg-toast' + (bad ? ' bad' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 7000 : 3200);
  }
  async function open() {
    fab.disabled = true; fab.setAttribute('aria-busy', 'true');
    const page = location.pathname.replace(/^.*\/giguy\.net\//, '/') + location.search.replace(/[?&]draft=1/, '') + location.hash;
    const viewport = global.innerWidth + 'x' + global.innerHeight + ' @' + (global.devicePixelRatio || 1) + 'x, scrolled ' + Math.round(global.scrollY);
    let shot = await capture();
    fab.disabled = false; fab.removeAttribute('aria-busy');
    const dlg = document.createElement('dialog');
    dlg.className = 'gg-sg-dialog'; dlg.setAttribute('aria-labelledby', 'gg-sg-title');
    dlg.innerHTML = '<form method="dialog" novalidate><div class="gg-sg-head"><h2 id="gg-sg-title">Suggest an edit</h2><button value="cancel" class="x" aria-label="Close">✕</button></div>' +
      '<p class="gg-sg-sub">Saved privately with a screenshot of this page (' + esc(page || '/') + ').</p>' +
      (shot ? '<figure class="gg-sg-shot"><button type="button" class="gg-sg-shot-btn" aria-label="Draw on the screenshot to point things out"><img alt="Screenshot of this page" src="' + shot + '"><span class="hint">✏️ Tap to draw on it</span></button>' +
        '<label class="gg-sg-check"><input type="checkbox" name="include" checked> Include this screenshot</label></figure>'
        : '<p class="gg-sg-sub">A screenshot couldn\'t be taken here; describe what you were looking at.</p>') +
      '<div class="gg-sg-kinds" role="radiogroup" aria-label="Type">' + KINDS.map((k, i) => '<label><input type="radio" name="kind" value="' + k[0] + '"' + (i ? '' : ' checked') + '><span>' + k[1] + '</span></label>').join('') + '</div>' +
      '<label class="gg-sg-field"><span>What should change?</span><textarea name="message" rows="4" required placeholder="e.g. Make the Dunn phone number bigger on phones."></textarea></label>' +
      '<div class="gg-sg-btns"><button type="submit" value="send" class="pri">Save suggestion</button><button value="cancel">Cancel</button></div></form>';
    document.body.appendChild(dlg);
    const form = dlg.querySelector('form');
    const shotBtn = dlg.querySelector('.gg-sg-shot-btn');
    if (shotBtn) shotBtn.addEventListener('click', async () => {
      const marked = await annotate(shot, dlg); if (!marked) return;
      shot = marked; dlg.querySelector('.gg-sg-shot img').src = marked;
      dlg.querySelector('.gg-sg-shot .hint').textContent = '✏️ Marked up — tap to edit'; form.include.checked = true;
    });
    form.addEventListener('submit', async e => {
      if (e.submitter && e.submitter.value === 'cancel') return;
      e.preventDefault();
      const message = form.message.value.trim();
      if (!message) { form.message.focus(); form.message.setAttribute('aria-invalid', 'true'); return; }
      const btn = form.querySelector('button.pri'); btn.disabled = true; btn.textContent = 'Saving…';
      const id = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-') + '-' + Math.random().toString(36).slice(2, 6);
      const withShot = shot && (!form.include || form.include.checked);
      let who = '';
      try { who = (await gh('/user')).login || ''; } catch (err) { /* fine */ }
      const item = { id, kind: form.querySelector('input[name=kind]:checked').value, message, page: page || '/', title: document.title,
        viewport, user_agent: navigator.userAgent, submitted_by: who, submitted_at: new Date().toISOString(), status: 'new',
        screenshot: withShot ? DIR + '/' + id + '.jpg' : null, resolution: '', resolved_commit: '' };
      try {
        if (withShot) await put(item.screenshot, shot.split(',')[1], 'Screenshot for edit ' + id);
        await put(DIR + '/' + id + '.json', b64(JSON.stringify(item, null, 2) + '\n'), 'Suggested edit ' + id + ': ' + message.slice(0, 60));
        dlg.close(); toast('Saved. It\'s in Suggested edits in the admin page.');
      } catch (err) {
        btn.disabled = false; btn.textContent = 'Save suggestion'; toast('Couldn\'t save: ' + explain(err), true);
      }
    });
    dlg.addEventListener('close', () => { dlg.remove(); fab && fab.focus(); });
    dlg.showModal(); form.message.focus();
  }

  function styles() {
    if (document.getElementById('gg-sg-css')) return;
    const s = document.createElement('style'); s.id = 'gg-sg-css';
    s.textContent = `
#gg-suggest{position:fixed;right:16px;bottom:16px;z-index:60;display:inline-flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 16px;background:#0e3a0d;color:#fff;font:700 14px/1 "Figtree",system-ui,sans-serif;box-shadow:0 10px 30px -8px rgba(0,0,0,.45);cursor:pointer}
#gg-suggest:hover{background:#1a5718}#gg-suggest[aria-busy=true]{opacity:.7;cursor:progress}
@media (max-width:600px){#gg-suggest .lbl{display:none}#gg-suggest{padding:14px}}
.gg-sg-dialog{width:min(560px,100% - 24px);max-height:92vh;border:0;border-radius:16px;padding:0;box-shadow:0 30px 80px rgba(0,0,0,.45);font-family:"Figtree",system-ui,sans-serif;color:#14200f;background:#fff}
.gg-sg-dialog::backdrop{background:rgba(0,0,0,.5)}
.gg-sg-dialog form{padding:18px 20px 20px;display:grid;gap:12px}
.gg-sg-head{display:flex;align-items:center;justify-content:space-between}.gg-sg-head h2{margin:0;font-size:1.25rem;color:#0e3a0d}
.gg-sg-dialog .x{border:0;background:none;font-size:18px;cursor:pointer;color:#55604f}
.gg-sg-sub{margin:0;color:#55604f;font-size:.9rem}
.gg-sg-shot{margin:0}.gg-sg-shot-btn{position:relative;display:block;width:100%;padding:0;border:1px solid #ecdcd4;border-radius:10px;overflow:hidden;cursor:pointer;background:#f6f6f6}
.gg-sg-shot img{display:block;width:100%;max-height:260px;object-fit:contain}
.gg-sg-shot .hint{position:absolute;right:8px;bottom:8px;background:rgba(14,58,13,.9);color:#fff;font-size:12px;font-weight:700;padding:5px 9px;border-radius:999px}
.gg-sg-check{display:flex;gap:6px;align-items:center;font-size:.85rem;color:#55604f;margin-top:6px}
.gg-sg-kinds{display:flex;flex-wrap:wrap;gap:6px}.gg-sg-kinds label{cursor:pointer}.gg-sg-kinds input{position:absolute;opacity:0}
.gg-sg-kinds span{display:inline-block;padding:7px 12px;border:1.5px solid #ecdcd4;border-radius:999px;font-size:.88rem;font-weight:600}
.gg-sg-kinds input:checked+span{background:#1a5718;border-color:#1a5718;color:#fff}.gg-sg-kinds input:focus-visible+span{outline:3px solid #F7A582}
.gg-sg-field{display:grid;gap:5px;font-weight:600;font-size:.9rem}.gg-sg-field textarea{font:16px/1.45 "Figtree",system-ui,sans-serif;padding:10px;border:1.5px solid #ecdcd4;border-radius:10px;resize:vertical}
.gg-sg-field textarea[aria-invalid=true]{border-color:#b3261e}
.gg-sg-btns{display:flex;gap:8px}.gg-sg-btns button{border-radius:999px;padding:10px 18px;font:700 .95rem "Figtree",system-ui,sans-serif;border:1.5px solid #1a5718;background:#fff;color:#1a5718;cursor:pointer}
.gg-sg-btns .pri{background:#1a5718;color:#fff}.gg-sg-btns .pri:disabled{opacity:.6}
.gg-markup{position:fixed;inset:0;z-index:5;background:#111;display:flex;flex-direction:column}
.gg-markup-bar{display:flex;gap:8px;align-items:center;padding:10px;background:#222;flex-wrap:wrap}.gg-markup-bar .sp{flex:1}
.gg-markup-bar button{border:0;border-radius:8px;padding:8px 12px;font:700 14px system-ui;background:#3a3a3a;color:#fff;cursor:pointer}.gg-markup-bar .pri{background:#1f9d55}
.gg-markup-bar .sw{width:28px;height:28px;padding:0;border-radius:50%;border:3px solid transparent}.gg-markup-bar .sw.on{border-color:#fff}
.gg-markup-stage{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:8px}.gg-markup-stage canvas{touch-action:none;border-radius:6px;background:#fff}
.gg-markup-tip{margin:0;padding:8px;text-align:center;color:#bbb;font:13px system-ui}
.gg-sg-toast{position:fixed;left:50%;bottom:80px;transform:translateX(-50%);z-index:70;background:#0e3a0d;color:#fff;padding:10px 16px;border-radius:10px;font:600 14px "Figtree",system-ui,sans-serif;max-width:calc(100% - 32px);box-shadow:0 10px 30px -8px rgba(0,0,0,.45)}
.gg-sg-toast.bad{background:#b3261e}`;
    document.head.appendChild(s);
  }

  function mount() {
    if (!token() || fab) return;                       // only for people signed into the admin page
    styles();
    fab = document.createElement('button');
    fab.id = 'gg-suggest'; fab.type = 'button'; fab.setAttribute('aria-label', 'Suggest an edit');
    fab.innerHTML = '<span aria-hidden="true">💡</span><span class="lbl">Suggest an edit</span>';
    fab.addEventListener('click', open);
    document.body.appendChild(fab);
    (global.requestIdleCallback || (f => setTimeout(f, 1500)))(warm);
  }

  global.GGSuggest = { list, update, imageUrl, mount, repo, STATUSES, KINDS, explain };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})(window);
