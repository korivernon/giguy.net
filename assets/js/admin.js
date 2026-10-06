(function () {
  'use strict';
  const K = window.GG;
  const { esc } = K;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const CFG_KEY = 'giguy:gh-config';
  const DRAFT_BASE_KEY = 'giguy:draft-base';
  const DATA_PATH = 'data/site.json';
  const DEFAULT_REPO = 'korivernon/giguy.net';
  const DEFAULT_BRANCH = 'main';

  const S = { mode: null, token: '', repo: DEFAULT_REPO, branch: DEFAULT_BRANCH, data: null, base: '', sha: '', view: 'banners', q: '', showHidden: true, login: '' };

  /* ---------------- storage ---------------- */
  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function ss() { try { return window.sessionStorage; } catch (e) { return null; } }
  function put(store, k, v) { try { store && (v == null ? store.removeItem(k) : store.setItem(k, v)); } catch (e) { /* blocked */ } }
  function saveCreds(remember) {
    put(ls(), K.TOKEN_KEY, null); put(ss(), K.TOKEN_KEY, null);
    put(remember ? ls() : ss(), K.TOKEN_KEY, S.token);
    put(ls(), CFG_KEY, JSON.stringify({ repo: S.repo, branch: S.branch }));
  }
  function forget() { put(ls(), K.TOKEN_KEY, null); put(ss(), K.TOKEN_KEY, null); }

  /* ---------------- utils ---------------- */
  function toast(msg, kind) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (kind || '');
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = 'toast ' + (kind || ''); }, kind === 'err' ? 6000 : 2800);
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  function uniqueId(list, base) {
    let id = base || 'item', n = 2;
    while (list.some(x => x.id === id)) id = base + '-' + n++;
    return id;
  }
  function getPath(o, p) { return p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o); }
  function setPath(o, p, v) {
    const ks = p.split('.'); let cur = o;
    ks.slice(0, -1).forEach(k => { if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; });
    cur[ks[ks.length - 1]] = v;
  }
  function b64encode(bytes) {
    let bin = ''; const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  }
  const b64utf8 = s => b64encode(new TextEncoder().encode(s));
  function utf8b64(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  const serialize = d => JSON.stringify(d, null, 2) + '\n';

  /* ---------------- GitHub ---------------- */
  async function gh(path, opts) {
    const res = await fetch('https://api.github.com' + path, Object.assign({}, opts, {
      headers: Object.assign({
        Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        Authorization: 'Bearer ' + S.token,
      }, opts && opts.body ? { 'Content-Type': 'application/json' } : {}),
    }));
    let body = null;
    try { body = await res.json(); } catch (e) { /* empty */ }
    if (!res.ok) {
      const err = new Error((body && body.message) || ('GitHub ' + res.status));
      err.status = res.status; throw err;
    }
    return body;
  }
  const contentsUrl = p => '/repos/' + S.repo + '/contents/' + p.split('/').map(encodeURIComponent).join('/');

  async function ghLoad() {
    const f = await gh(contentsUrl(DATA_PATH) + '?ref=' + encodeURIComponent(S.branch) + '&t=' + Date.now());
    return { data: JSON.parse(utf8b64(f.content)), sha: f.sha };
  }
  async function ghPutFile(path, b64, message, sha) {
    return gh(contentsUrl(path), { method: 'PUT', body: JSON.stringify({ message, content: b64, branch: S.branch, sha: sha || undefined }) });
  }
  async function ghSha(path) {
    try { return (await gh(contentsUrl(path) + '?ref=' + encodeURIComponent(S.branch))).sha; } catch (e) { if (e.status === 404) return null; throw e; }
  }

  /* ---------------- draft persistence ---------------- */
  const dirty = () => S.data && serialize(S.data) !== S.base;
  let saveT;
  function changed() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      if (dirty()) { put(ls(), K.DRAFT_KEY, JSON.stringify(S.data)); put(ls(), DRAFT_BASE_KEY, S.sha || 'local'); }
      else { put(ls(), K.DRAFT_KEY, null); put(ls(), DRAFT_BASE_KEY, null); }
    }, 250);
    renderTopbar();
    renderSideCounts();
  }
  window.addEventListener('beforeunload', e => { if (dirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------- field schema ---------------- */
  const STYLE_OPTS = [['closed', 'Peach: office closed / schedule change'], ['info', 'Green: general news'], ['alert', 'Red: urgent']];
  const TF = [['title', 'Title'], ['text', 'Text']];
  const SCHEMA = {
    banners: [
      { k: 'message', label: 'Message', type: 'textarea', rows: 2, req: true, hint: 'e.g. "Our offices are closed Friday, July 3." **bold** works.' },
      { k: 'style', label: 'Color', type: 'select', opts: STYLE_OPTS },
      { row: [{ k: 'start', label: 'Show starting', type: 'datetime', hint: 'blank = right away' }, { k: 'end', label: 'Take down at', type: 'datetime', hint: 'blank = until you turn it off' }] },
      { row: [{ k: 'linkLabel', label: 'Optional link text', hint: 'e.g. Call us' }, { k: 'linkUrl', label: 'Link address', hint: 'e.g. contact.html or tel:+19195770085' }] },
      { k: 'hidden', label: 'Turned off (never shows, even inside the dates)', type: 'check' },
    ],
    practice: [
      { row: [{ k: 'practice.name', label: 'Practice name' }, { k: 'practice.doctor', label: 'Doctor / legal name' }] },
      { k: 'practice.tagline', label: 'Tagline under the logo' },
      { row: [{ k: 'practice.phone', label: 'Main phone (Call buttons)' }, { k: 'practice.portalLabel', label: 'Portal button text' }] },
      { k: 'practice.portalUrl', label: 'Patient Portal address', hint: 'Every Patient Portal button sends patients here.' },
      { k: 'practice.hours', label: 'Office hours', type: 'textarea', rows: 3, hint: 'One line per row; each shows on its own line.' },
      { k: 'practice.emergencyNote', label: 'Emergency note', type: 'textarea', rows: 2 },
      { k: 'practice.disclaimer', label: 'Footer disclaimer', type: 'textarea', rows: 2 },
      { k: 'practice.footerTagline', label: 'Footer tagline' },
      { k: 'social', label: 'Social links (footer)', type: 'pairs', fields: [['label', 'Label'], ['url', 'https://…']] },
    ],
    home: [
      { k: 'home.eyebrow', label: 'Small line above the headline' },
      { k: 'home.title', label: 'Headline' },
      { k: 'home.text', label: 'Intro text', type: 'textarea', rows: 3 },
      { k: 'home.highlights', label: 'Three highlights', type: 'pairs', fields: TF, long: 1 },
      { k: 'home.conditionsTitle', label: 'Conditions section heading' },
      { k: 'home.conditionsIntro', label: 'Conditions section intro', type: 'textarea', rows: 2, hint: 'The conditions themselves are under "Conditions" in the menu.' },
      { k: 'home.recognition', label: 'Recognition strip', type: 'textarea', rows: 2, hint: 'blank = hide the strip' },
      { k: 'home.recognitionLink', label: 'Recognition "Read more" link' },
    ],
    about: [
      { k: 'about.title', label: 'Headline' },
      { k: 'about.text', label: 'About text', type: 'textarea', rows: 8, hint: 'Blank line = new paragraph. [link](https://…) works.' },
      { k: 'about.values', label: 'Three values', type: 'pairs', fields: TF, long: 1 },
      { k: 'about.insurance', label: 'Insurance', type: 'textarea', rows: 3 },
      { k: 'about.wellnessTitle', label: 'Wellness title' },
      { k: 'about.wellnessText', label: 'Wellness text', type: 'textarea', rows: 4 },
    ],
    doctor: [
      { row: [{ k: 'doctor.name', label: 'Name' }, { k: 'doctor.role', label: 'Title' }] },
      { k: 'doctor.photo', label: 'Photo', type: 'file', dir: 'img/team', accept: 'image/*' },
      { k: 'doctor.quote', label: 'Quote', type: 'textarea', rows: 4 },
      { k: 'doctor.bio', label: 'Bio', type: 'textarea', rows: 8 },
      { k: 'doctor.credentials', label: 'Credentials', type: 'pairs', fields: [['label', 'e.g. Residency'], ['value', 'Details']] },
    ],
    team: [
      { row: [{ k: 'name', label: 'Name & credentials', req: true }, { k: 'role', label: 'Title' }] },
      { k: 'photo', label: 'Photo', type: 'file', dir: 'img/team', accept: 'image/*' },
      { k: 'statement', label: 'Patient care statement', type: 'textarea', rows: 3 },
      { k: 'bio', label: 'Background', type: 'textarea', rows: 4 },
      { k: 'education', label: 'Education (one per line)', type: 'textarea', rows: 3 },
      { k: 'memberships', label: 'Credentials & memberships (one per line)', type: 'textarea', rows: 3 },
      { k: 'hidden', label: 'Hidden from the site', type: 'check' },
    ],
    services: [
      { k: 'title', label: 'Service', req: true },
      { k: 'summary', label: 'One-line summary' },
      { k: 'points', label: 'Bullet points on the Services page (one per line)', type: 'textarea', rows: 4 },
      { k: 'what', label: 'Detail page: What is it?', type: 'textarea', rows: 4 },
      { k: 'why', label: 'Detail page: Why it\'s done (one per line)', type: 'textarea', rows: 4 },
      { k: 'prep', label: 'Detail page: How to prepare', type: 'textarea', rows: 3 },
      { k: 'expect', label: 'Detail page: What to expect', type: 'textarea', rows: 3 },
      { k: 'after', label: 'Detail page: Afterward', type: 'textarea', rows: 3 },
      { k: 'hidden', label: 'Hidden from the site', type: 'check' },
    ],
    conditions: [
      { k: 'name', label: 'Condition', req: true },
      { k: 'text', label: 'Short description (home page and lists)', type: 'textarea', rows: 3, hint: 'One or two plain-language sentences. The home page shows the first sentence.' },
      { k: 'what', label: 'Detail page: What is it?', type: 'textarea', rows: 4 },
      { k: 'causes', label: 'Detail page: Common causes (one per line)', type: 'textarea', rows: 4 },
      { k: 'symptoms', label: 'Detail page: Symptoms (one per line)', type: 'textarea', rows: 5 },
      { row: [{ k: 'causesTitle', label: 'Causes heading (optional)', hint: 'blank = Common causes' }, { k: 'symptomsTitle', label: 'Symptoms heading (optional)', hint: 'blank = Symptoms' }] },
      { k: 'treatment', label: 'Detail page: Diagnosis & treatment', type: 'textarea', rows: 5 },
      { k: 'when', label: 'Detail page: When to call us', type: 'textarea', rows: 2 },
      { k: 'procedures', label: 'Related procedures', type: 'list', hint: 'Comma-separated service ids: colonoscopy, egd, capsule-endoscopy, flexible-sigmoidoscopy, esophageal-dilation, hemorrhoid-treatment, cologuard, consultations' },
      { k: 'hidden', label: 'Hidden from the site', type: 'check' },
    ],
    faqs: [
      { k: 'q', label: 'Question', req: true },
      { k: 'a', label: 'Answer', type: 'textarea', rows: 4, hint: '[link text](page.html) works.' },
    ],
    locations: [
      { k: 'name', label: 'Office name', req: true },
      { k: 'address', label: 'Address (two lines)', type: 'textarea', rows: 2 },
      { row: [{ k: 'phone', label: 'Phone' }, { k: 'fax', label: 'Fax' }] },
      { k: 'mapQuery', label: 'Address for the map', hint: 'one line, e.g. 1004 Procure St, Fuquay-Varina, NC 27526' },
      { k: 'hidden', label: 'Hidden from the site', type: 'check' },
    ],
    forms: [
      { k: 'title', label: 'Title', req: true },
      { k: 'text', label: 'Description', type: 'textarea', rows: 2 },
      { k: 'file', label: 'PDF', type: 'file', dir: 'files', accept: 'application/pdf', keepName: true },
      { k: 'hidden', label: 'Hidden from the site', type: 'check' },
    ],
    articles: [
      { k: 'title', label: 'Title', req: true },
      { k: 'summary', label: 'Summary (shown on the card)', type: 'textarea', rows: 2 },
      { k: 'body', label: 'Article', type: 'textarea', rows: 16, hint: 'Blank line = new paragraph. "## " starts a heading. Lines starting with "- " make a list. [link](https://…) works.' },
      { k: 'hidden', label: 'Hidden from the site', type: 'check' },
    ],
    fasttrack: [
      { k: 'fasttrack.enabled', label: 'Show Fast-Track on the live site (menu item, page, home band and promos)', type: 'check' },
      { row: [{ k: 'fasttrack.navLabel', label: 'Menu label' }, { k: 'fasttrack.eyebrow', label: 'Small line above the headline' }] },
      { k: 'fasttrack.title', label: 'Headline', hint: 'Keep the 7–14 day wording consistent with what the office can deliver.' },
      { k: 'fasttrack.intro', label: 'Intro', type: 'textarea', rows: 4 },
      { k: 'fasttrack.noVisit', label: '"No office visit" line', type: 'textarea', rows: 2 },
      { k: 'fasttrack.homeBand', label: 'Home page band', type: 'textarea', rows: 2, hint: '**bold** shows in peach. Blank = hide the band.' },
      { k: 'fasttrack.steps', label: 'How it works (steps)', type: 'pairs', fields: TF, long: 1 },
      { k: 'fasttrack.fit', label: '"Fast-Track is for you if" (one per line)', type: 'textarea', rows: 4 },
      { k: 'fasttrack.notFit', label: '"We may need to see you first if you" (one per line)', type: 'textarea', rows: 4 },
      { k: 'fasttrack.notFitNote', label: 'Note under that list', type: 'textarea', rows: 2 },
      { k: 'fasttrack.bring', label: '"Have these ready" (one per line)', type: 'textarea', rows: 4 },
      { k: 'fasttrack.insurance', label: 'Insurance', type: 'textarea', rows: 3 },
      { k: 'fasttrack.faqs', label: 'Questions', type: 'pairs', fields: [['q', 'Question'], ['a', 'Answer']], long: 1 },
      { k: 'fasttrack.providersTitle', label: 'Referring doctors heading' },
      { k: 'fasttrack.providers', label: 'Referring doctors text', type: 'textarea', rows: 4, hint: 'Blank = hide this section.' },
    ],
    learn: [
      { k: 'quiz.title', label: 'Quiz title' },
      { k: 'quiz.intro', label: 'Quiz intro', type: 'textarea', rows: 3 },
      { k: 'quiz.questions', label: 'Yes/no questions (one per line)', type: 'lines', rows: 10 },
      { k: 'quiz.yesResult', label: 'Result if any answer is Yes', type: 'textarea', rows: 2 },
      { k: 'quiz.noResult', label: 'Result if every answer is No', type: 'textarea', rows: 2 },
      { k: 'organs', label: 'Your digestive system (organ + description)', type: 'pairs', fields: [['name', 'Organ'], ['text', 'What it does']], long: 1 },
    ],
  };

  const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  function fmtWhen(iso) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  const COLLECTIONS = {
    banners: {
      label: 'Banners', one: 'banner',
      sym: x => ({ live: 'LIVE', scheduled: 'SOON', expired: 'ENDED', off: 'OFF' }[K.bannerState(x)]),
      title: x => short(x.message, 90),
      sub: x => (x.start ? 'from ' + fmtWhen(x.start) : 'from now') + ' · ' + (x.end ? 'until ' + fmtWhen(x.end) : 'no end date'),
      blank: () => ({ id: '', message: '', style: 'closed', start: '', end: '', linkLabel: '', linkUrl: '', hidden: false }),
      idFrom: () => 'banner-' + Date.now().toString(36),
    },
    team: { label: 'Team', one: 'provider', sym: () => 'TEAM', title: x => x.name, sub: x => x.role || '', blank: () => ({ id: '', name: '', role: '', photo: '', statement: '', bio: '', education: '', memberships: '', hidden: false }), idFrom: x => slug(x.name) },
    services: { label: 'Services', one: 'service', sym: () => 'SVC', title: x => x.title, sub: x => x.summary || '', blank: () => ({ id: '', title: '', summary: '', points: '', hidden: false }), idFrom: x => slug(x.title) },
    conditions: { label: 'Conditions', one: 'condition', sym: () => 'COND', title: x => x.name, sub: x => short(x.text, 100), blank: () => ({ id: '', name: '', text: '', hidden: false }), idFrom: x => slug(x.name) },
    faqs: { label: 'FAQs', one: 'question', sym: () => 'FAQ', title: x => x.q, sub: x => short(x.a, 100), blank: () => ({ id: '', q: '', a: '' }), idFrom: x => slug(x.q) },
    locations: { label: 'Locations', one: 'location', sym: () => 'OFFICE', title: x => x.name, sub: x => (x.address || '').replace(/\n/g, ', ') + ' · ' + (x.phone || ''), blank: () => ({ id: '', name: '', address: '', phone: '', fax: '', mapQuery: '', hidden: false }), idFrom: x => slug(x.name) },
    forms: { label: 'Forms & PDFs', one: 'form', sym: () => 'PDF', title: x => x.title, sub: x => x.file || '', blank: () => ({ id: '', title: '', text: '', file: '', hidden: false }), idFrom: x => slug(x.title) },
    articles: { label: 'Articles', one: 'article', sym: () => 'POST', title: x => x.title, sub: x => short(x.summary, 100), blank: () => ({ id: '', title: '', date: '', summary: '', body: '', hidden: false }), idFrom: x => slug(x.title) },
  };

  const NAV = [
    ['banners', 'Banners'], ['practice', 'Practice info & hours'], ['locations', 'Locations'], ['home', 'Home page'], ['about', 'About & insurance'], ['conditions', 'Conditions'],
    ['fasttrack', 'Fast-Track colonoscopy'], ['doctor', 'Dr. Vernon'], ['team', 'Team'], ['services', 'Services'], ['faqs', 'FAQs'], ['forms', 'Forms & PDFs'],
    ['articles', 'Articles'], ['learn', 'Quiz & digestive system'], ['raw', 'Raw JSON'],
  ];

  /* ---------------- form engine ---------------- */
  function fieldHtml(f, obj) {
    const v = getPath(obj, f.k);
    const id = 'f-' + f.k.replace(/\./g, '-');
    const lab = '<span>' + esc(f.label) + (f.req ? ' *' : '') + '</span>';
    const hint = f.hint ? '<small>' + esc(f.hint) + '</small>' : '';
    const a = ' id="' + id + '" data-k="' + esc(f.k) + '" data-type="' + (f.type || 'text') + '"';
    switch (f.type) {
      case 'textarea': return '<label class="field">' + lab + '<textarea' + a + ' rows="' + (f.rows || 3) + '">' + esc(v || '') + '</textarea>' + hint + '</label>';
      case 'lines': return '<label class="field">' + lab + '<textarea' + a + ' rows="' + (f.rows || 4) + '">' + esc((v || []).join('\n')) + '</textarea>' + hint + '</label>';
      case 'list': return '<label class="field">' + lab + '<input type="text"' + a + ' value="' + esc((v || []).join(', ')) + '">' + hint + '</label>';
      case 'datetime': return '<label class="field">' + lab + '<input type="datetime-local"' + a + ' value="' + esc(toLocalInput(v)) + '">' + hint + '</label>';
      case 'pairs': return '<div class="field">' + lab + '<div class="rep" data-links="' + esc(f.k) + '">' + (v || []).map((l, i) => linkRow(f.k, l, i, f)).join('') + '</div><div><button type="button" class="btn sm" data-add-link="' + esc(f.k) + '">+ Add</button></div>' + hint + '</div>';
      case 'month': return '<label class="field">' + lab + '<input type="month"' + a + ' value="' + esc(v || '') + '">' + hint + '</label>';
      case 'color': return '<label class="field">' + lab + '<input type="color"' + a + ' value="' + esc(v || '#0bb5c9') + '">' + hint + '</label>';
      case 'check': return '<label class="check"><input type="checkbox"' + a + (v === true || (v !== false && false) ? ' checked' : '') + '>' + esc(f.label) + '</label>';
      case 'range': return '<label class="field">' + lab + '<input type="range" min="1" max="5" step="1"' + a + ' value="' + esc(v || 3) + '"><small class="mono" data-range-out="' + id + '">' + '●'.repeat(Number(v) || 3) + '</small>' + hint + '</label>';
      case 'select': return '<label class="field">' + lab + '<select' + a + '>' + f.opts.map(o => '<option value="' + esc(o[0]) + '"' + ((v || f.opts[0][0]) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select>' + hint + '</label>';
      case 'category': return '<label class="field">' + lab + '<input type="text" list="cat-list"' + a + ' value="' + esc(v || '') + '"><datalist id="cat-list">' + (S.data.categories || []).map(c => '<option value="' + esc(c) + '">').join('') + '</datalist><small>pick one or type a new category</small></label>';
      case 'links': return '<div class="field">' + lab + '<div class="rep" data-links="' + esc(f.k) + '">' + (v || []).map((l, i) => linkRow(f.k, l, i)).join('') + '</div><div><button type="button" class="btn sm" data-add-link="' + esc(f.k) + '">+ Add link</button></div>' + hint + '</div>';
      case 'file': return '<div class="field">' + lab + '<div class="upl">' + (v && f.accept === 'image/*' ? '<img class="thumb" src="../' + esc(v) + '" alt="">' : '') +
        '<input type="text"' + a + ' value="' + esc(v || '') + '" placeholder="' + esc(f.dir) + '/file">' +
        '<label class="btn sm" style="cursor:pointer">Upload<input type="file" hidden accept="' + esc(f.accept) + '" data-upload="' + esc(f.k) + '" data-dir="' + esc(f.dir) + '"' + (f.keepName ? ' data-keep="1"' : '') + '></label></div>' +
        '<small>' + (S.mode === 'github' ? 'Uploads commit the file straight to the repo.' : 'Uploads need GitHub mode. You can still type a path.') + '</small></div>';
      default: return '<label class="field">' + lab + '<input type="text"' + a + ' value="' + esc(v == null ? '' : v) + '">' + hint + '</label>';
    }
  }
  function linkRow(k, l, i, f) {
    const fields = (f && f.fields) || [['label', 'Label'], ['url', 'https://… or page.html']];
    const long = f && f.long;
    return '<div class="rep-row' + (long != null ? ' long' : '') + '" data-i="' + i + '">' + fields.map((fd, j) => j === long
      ? '<textarea rows="2" placeholder="' + esc(fd[1]) + '" data-lk="' + esc(k) + '" data-li="' + i + '" data-lf="' + fd[0] + '">' + esc(l[fd[0]] || '') + '</textarea>'
      : '<input placeholder="' + esc(fd[1]) + '" data-lk="' + esc(k) + '" data-li="' + i + '" data-lf="' + fd[0] + '" value="' + esc(l[fd[0]] || '') + '">').join('') +
      '<button type="button" class="ib danger" title="Remove" data-del-link="' + esc(k) + '" data-li="' + i + '">✕</button></div>';
  }
  // ISO (UTC) <-> the browser's local "YYYY-MM-DDTHH:MM" used by datetime-local inputs.
  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d)) return '';
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function formHtml(fields, obj) {
    return fields.map(f => f.row
      ? '<div class="row' + f.row.length + '">' + f.row.map(x => fieldHtml(x, obj)).join('') + '</div>'
      : fieldHtml(f, obj)).join('');
  }
  function readField(el) {
    const t = el.dataset.type;
    if (t === 'check') return el.checked;
    if (t === 'list') return el.value.split(',').map(s => s.trim()).filter(Boolean);
    if (t === 'lines') return el.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (t === 'range') return Number(el.value);
    if (t === 'month') return el.value || null;
    if (t === 'datetime') return el.value ? new Date(el.value).toISOString() : '';
    return el.value;
  }
  // Wires inputs inside `root` to `obj`; calls onChange after each edit.
  function bindForm(root, obj, onChange, rerender) {
    root.addEventListener('input', e => {
      const el = e.target;
      if (el.dataset.k && el.type !== 'file') {
        setPath(obj, el.dataset.k, readField(el));
        if (el.dataset.type === 'range') { const o = root.querySelector('[data-range-out="' + el.id + '"]'); if (o) o.textContent = '●'.repeat(Number(el.value)); }
        onChange();
      } else if (el.dataset.lk) {
        const arr = getPath(obj, el.dataset.lk) || [];
        arr[Number(el.dataset.li)][el.dataset.lf] = el.value;
        onChange();
      }
    });
    root.addEventListener('change', async e => {
      const el = e.target;
      if (!el.dataset.upload || !el.files || !el.files[0]) return;
      const path = await upload(el.files[0], el.dataset.dir, !!el.dataset.keep);
      if (path) { setPath(obj, el.dataset.upload, path); onChange(); rerender(); }
    });
    root.addEventListener('click', e => {
      const add = e.target.closest('[data-add-link]');
      const del = e.target.closest('[data-del-link]');
      if (add) { const k = add.dataset.addLink; const arr = getPath(obj, k) || []; arr.push({}); setPath(obj, k, arr); onChange(); rerender(); }
      if (del) { const k = del.dataset.delLink; const arr = getPath(obj, k) || []; arr.splice(Number(del.dataset.li), 1); onChange(); rerender(); }
    });
  }

  async function upload(file, dir, keepName) {
    if (S.mode !== 'github') { toast('Connect GitHub to upload files', 'err'); return null; }
    if (file.size > 15 * 1024 * 1024) { toast('File is over 15 MB', 'err'); return null; }
    const dot = file.name.lastIndexOf('.');
    const ext = dot > 0 ? file.name.slice(dot).toLowerCase().replace(/[^.a-z0-9]/g, '') : '';
    const name = keepName ? file.name.replace(/[^\w.-]+/g, '_') : (slug(dot > 0 ? file.name.slice(0, dot) : file.name) || 'file') + '-' + Date.now().toString(36) + ext;
    const path = dir + '/' + name;
    try {
      toast('Uploading ' + name + '…');
      const buf = new Uint8Array(await file.arrayBuffer());
      const sha = await ghSha(path);
      await ghPutFile(path, b64encode(buf), 'Upload ' + path + ' via console', sha);
      toast('Uploaded ' + path + '. Publish to use it.', 'ok');
      return path;
    } catch (err) { toast('Upload failed: ' + err.message, 'err'); return null; }
  }

  /* ---------------- shell ---------------- */
  function renderShell() {
    $('#root').innerHTML =
      '<div class="shell"><aside class="side">' +
        '<a class="brand" href="../" target="_blank" rel="noopener"><img src="../img/logos/logo.png" alt="" width="70"><span class="brand-sym">Admin</span></a>' +
        '<div class="gsearch"><input id="gq" type="search" placeholder="Search the whole site…" autocomplete="off" aria-label="Search the whole site" value="' + esc(S.gq || '') + '"><kbd>/</kbd></div>' +
        '<nav id="sidenav">' + NAV.map(n => '<a href="#' + n[0] + '" data-view="' + n[0] + '">' + n[1] + '<span class="n" data-count="' + n[0] + '"></span></a>').join('') + '</nav>' +
        '<div class="who">' + (S.mode === 'github'
          ? '<span class="mode-pill gh">GITHUB</span><br>' + esc(S.login ? '@' + S.login : '') + '<br>' + esc(S.repo) + ' @ ' + esc(S.branch)
          : '<span class="mode-pill">LOCAL</span><br>changes download as site.json') +
          '<br><button class="btn sm" id="signout" type="button">' + (S.mode === 'github' ? 'Sign out' : 'Connect GitHub') + '</button></div>' +
      '</aside><div><div class="topbar" id="topbar"></div><div class="content" id="view"></div></div></div>';
    $('#signout').addEventListener('click', () => {
      if (dirty() && !confirm('You have unpublished changes. They stay saved as a draft on this device. Continue?')) return;
      forget(); location.hash = ''; location.reload();
    });
    const gq = $('#gq');
    gq.addEventListener('input', () => {
      S.gq = gq.value;
      if (S.view !== 'search') { location.hash = 'search'; return; }
      renderView();
    });
    gq.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const r = $('#results [data-hit]'); if (r) r.click(); }
      if (e.key === 'Escape') { gq.value = ''; S.gq = ''; if (S.view === 'search') renderView(); }
    });
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !e.target.closest('input, textarea, select, [contenteditable]') && !$('#modal').open) { e.preventDefault(); gq.focus(); gq.select(); }
    });
    renderSideCounts();
  }
  function renderSideCounts() {
    Object.keys(COLLECTIONS).forEach(k => {
      const el = $('[data-count="' + k + '"]'); if (!el) return;
      const list = S.data[k] || [];
      const h = list.filter(x => x.hidden).length;
      el.textContent = list.length + (h ? ' (' + h + ' hidden)' : '');
    });
  }
  function renderTopbar() {
    const tb = $('#topbar'); if (!tb) return;
    const title = S.view === 'search' ? 'Search' : (NAV.find(n => n[0] === S.view) || [, ''])[1];
    const d = dirty();
    tb.innerHTML = '<h1>' + esc(title) + '</h1>' +
      (d ? '<span class="dirty">● unpublished changes</span>' : '<span class="clean">✓ in sync</span>') +
      '<span class="sp"></span>' +
      '<button class="btn sm" type="button" id="preview">Preview</button>' +
      '<button class="btn sm danger" type="button" id="discard"' + (d ? '' : ' disabled') + '>Discard</button>' +
      '<button class="btn sm primary" type="button" id="publish"' + (d ? '' : ' disabled') + '>' + (S.mode === 'github' ? 'Publish' : 'Download JSON') + '</button>';
    $('#preview').onclick = () => { put(ls(), K.DRAFT_KEY, JSON.stringify(S.data)); window.open('../?draft=1', '_blank'); };
    $('#discard').onclick = () => {
      if (!confirm('Throw away all unpublished changes?')) return;
      S.data = JSON.parse(S.base); changed(); renderView();
    };
    $('#publish').onclick = publish;
  }

  function go() {
    const [view, id] = decodeURIComponent(location.hash.slice(1)).split('/');
    S.view = view === 'search' || NAV.some(n => n[0] === view) ? view : 'banners';
    $$('#sidenav a').forEach(a => { if (a.dataset.view === S.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    renderTopbar();
    renderView();
    if (id && COLLECTIONS[S.view]) {
      const item = (S.data[S.view] || []).find(x => x.id === id);
      if (item) editItem(S.view, item);
    } else focusPending($('#view'));
  }

  function renderView() {
    const v = $('#view');
    if (COLLECTIONS[S.view]) return renderList(v, S.view);
    if (S.view === 'raw') return renderRaw(v);
    if (S.view === 'search') return renderSearch(v);
    const hints = {
      practice: 'Phone, Patient Portal link, hours and footer text used across the whole site.',
      home: 'The top of the home page, the three highlights and the recognition strip.',
      about: 'The About page: practice story, values, insurance and wellness.',
      doctor: 'Dr. Vernon\'s section on the Our Team page and the home page.',
      fasttrack: '<b>Off by default until counsel signs off.</b> While the box below is unticked, nothing about Fast-Track shows on the site and its page redirects to the home page. Use Preview to see it before turning it on. The Fast-Track Colonoscopy page (fast-track-colonoscopy.html) for patients with a positive stool test, plus the band on the home page.',
      learn: 'The colon cancer risk quiz and the digestive system guide on the Learn page.',
    };
    v.innerHTML = '<p class="hint">' + (hints[S.view] || '') + '</p><div class="formcard" id="form">' + formHtml(SCHEMA[S.view], S.data) + '</div>';
    bindForm($('#form'), S.data, () => { changed(); }, () => renderView());
  }

  /* ---------------- site-wide search ---------------- */
  // Every editable value on the site, one entry per field (and per row of a repeater).
  function searchIndex() {
    const out = [];
    NAV.forEach(([view, navLabel]) => {
      if (!SCHEMA[view]) return;
      const fields = SCHEMA[view].flatMap(f => f.row || [f]).filter(f => f.type !== 'check');
      const C = COLLECTIONS[view];
      const each = (obj, ctx) => fields.forEach(f => {
        const v = getPath(obj, f.k);
        const base = Object.assign({ view, navLabel, k: f.k, label: f.label }, ctx);
        if (f.type === 'pairs') {
          (v || []).forEach((row, i) => f.fields.forEach(fd => out.push(Object.assign({}, base, { li: i, lf: fd[0], text: String(row[fd[0]] || '') }))));
        } else if (f.type === 'lines') out.push(Object.assign(base, { text: (v || []).join('\n') }));
        else if (f.type === 'select') out.push(Object.assign(base, { text: ((f.opts.find(o => o[0] === v) || [, v || ''])[1]) }));
        else if (f.type === 'datetime') out.push(Object.assign(base, { text: fmtWhen(v) }));
        else out.push(Object.assign(base, { text: v == null ? '' : String(v) }));
      });
      if (C) (S.data[view] || []).forEach(item => each(item, { id: item.id, where: C.title(item), hidden: !!item.hidden }));
      else each(S.data, {});
    });
    return out;
  }
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function snippet(text, terms) {
    const low = text.toLowerCase();
    let at = -1; terms.some(t => (at = low.indexOf(t)) >= 0);
    const from = Math.max(0, at - 50), to = Math.min(text.length, (at < 0 ? 0 : at) + 110);
    let s = esc((from ? '…' : '') + text.slice(from, to).replace(/\s+/g, ' ') + (to < text.length ? '…' : ''));
    terms.forEach(t => { s = s.replace(new RegExp('(' + reEsc(esc(t)) + ')', 'gi'), '<mark>$1</mark>'); });
    return s;
  }
  function renderSearch(v) {
    const q = (S.gq || '').trim().toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    if (!terms.length) {
      v.innerHTML = '<p class="hint">Type in the search box to find any text on the site: a phone number, a provider, a service, a word in an article. Click a result to edit it. Tip: press <kbd>/</kbd> anywhere to jump to search.</p>';
      return;
    }
    const hits = searchIndex().map(h => {
      const text = h.text.toLowerCase();
      const hay = text + ' ' + h.label.toLowerCase() + ' ' + String(h.where || '').toLowerCase() + ' ' + h.navLabel.toLowerCase();
      if (!terms.every(t => hay.includes(t))) return null;
      h.score = terms.filter(t => text.includes(t)).length * 10 - (h.hidden ? 1 : 0);
      return h;
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    S.hits = hits.slice(0, 100);
    v.innerHTML = '<p class="hint">' + hits.length + ' match' + (hits.length === 1 ? '' : 'es') + ' for “' + esc(S.gq.trim()) + '”' + (hits.length > 100 ? ' (showing the first 100)' : '') + '. Click one to edit it.</p>' +
      (hits.length ? '<div class="list" id="results">' + S.hits.map((h, i) =>
        '<button type="button" class="hit' + (h.hidden ? ' is-hidden' : '') + '" data-hit="' + i + '">' +
          '<span class="hit-where">' + esc(h.navLabel) + (h.where ? ' › ' + esc(short(h.where, 60)) : '') + ' › ' + esc(h.label) + (h.li != null ? ' #' + (h.li + 1) : '') + (h.hidden ? ' <em>(hidden)</em>' : '') + '</span>' +
          '<span class="hit-text">' + (h.text ? snippet(h.text, terms) : '<i>empty</i>') + '</span>' +
        '</button>').join('') + '</div>'
      : '<div class="list"><div class="empty">No matches. Try a shorter word.</div></div>');
    if (!hits.length) return;
    $('#results').onclick = e => {
      const b = e.target.closest('[data-hit]'); if (!b) return;
      const h = S.hits[Number(b.dataset.hit)];
      S.focus = { k: h.k, li: h.li, lf: h.lf, terms };
      const hash = '#' + h.view + (h.id ? '/' + encodeURIComponent(h.id) : '');
      if (location.hash === hash) go(); else location.hash = hash;
    };
  }
  // After jumping from a search result: scroll to the field, focus it and select the matched text.
  function focusPending(root) {
    const f = S.focus; if (!f || !root) return false;
    S.focus = null;
    const sel = f.li != null ? '[data-lk="' + f.k + '"][data-li="' + f.li + '"][data-lf="' + f.lf + '"]' : '[data-k="' + f.k + '"]';
    const el = root.querySelector(sel); if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
    if (typeof el.setSelectionRange === 'function' && /^(text|search|url|tel|)$/.test(el.type || '') || el.tagName === 'TEXTAREA') {
      const low = el.value.toLowerCase(); const t = f.terms.find(x => low.includes(x));
      if (t) { const at = low.indexOf(t); try { el.setSelectionRange(at, at + t.length); } catch (e) { /* not selectable */ } }
    }
    const box = el.closest('.field, .rep-row') || el;
    box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
    return true;
  }

  /* ---------------- collection list ---------------- */
  const LIST_HINTS = {
    banners: 'A banner shows across the top of every page between its start and end times, then disappears on its own. <b>LIVE</b> = showing now, <b>SOON</b> = scheduled, <b>ENDED</b> = past its end time. Visitors can close a banner with ✕. Remember to Publish.',
    team: 'Providers on the Our Team page, in this order. Dr. Vernon has his own section.',
    services: 'Services in the order they appear. The first six also show on the home page.',
    conditions: 'Conditions we treat, in this order. Each has its own page (condition.html?id=…) and shows with its first sentence on the home page.',
    forms: 'PDFs on the Patients page. The first two are linked from the home page (patient forms, then colonoscopy prep).',
  };
  function renderList(v, key) {
    const C = COLLECTIONS[key];
    const list = S.data[key] = S.data[key] || [];
    const mode = 'manual';
    const q = S.q.toLowerCase();
    const shown = list.filter(x => (S.showHidden || !x.hidden) && (!q || JSON.stringify(x).toLowerCase().includes(q)));
    const manual = mode === 'manual';
    v.innerHTML =
      '<div class="listbar">' +
        '<button class="btn sm primary" type="button" id="add">+ Add ' + esc(C.one) + '</button>' +
        '<input class="input" id="q" type="search" placeholder="search" value="' + esc(S.q) + '">' +
        '<label class="check" style="margin:0"><input type="checkbox" id="showhidden"' + (S.showHidden ? ' checked' : '') + '>show hidden</label>' +
        '<span class="sp"></span>' +
      '</div>' +
      (LIST_HINTS[key] ? '<p class="hint">' + LIST_HINTS[key] + '</p>' : '') +
      '<div class="list" id="list">' + (shown.length ? shown.map(x => {
        const i = list.indexOf(x);
        return '<div class="item' + (x.hidden ? ' is-hidden' : '') + '" data-id="' + esc(x.id) + '">' +
          '<span class="s s-' + esc(C.sym(x).toLowerCase()) + '">' + esc(C.sym(x)) + '</span>' +
          '<span class="t"><b>' + esc(C.title(x)) + '</b><small>' + esc(C.sub(x)) + '</small></span>' +
          '<span class="acts">' +
            (manual ? '<button class="ib" title="Move up" data-act="up"' + (i === 0 || q ? ' disabled' : '') + '>↑</button><button class="ib" title="Move down" data-act="down"' + (i === list.length - 1 || q ? ' disabled' : '') + '>↓</button>' : '') +
            (C.feature ? '<button class="ib' + (x.featured ? ' on' : '') + '" title="' + (x.featured ? 'Unfeature' : 'Feature as a card') + '" data-act="feature">' + (x.featured ? '★' : '☆') + '</button>' : '') +
            '<button class="switch" type="button" role="switch" aria-checked="' + !x.hidden + '" title="' + (x.hidden ? 'Hidden. Click to show on the site' : 'Shown. Click to hide from the site') + '" data-act="hide"><span class="knob"></span><span class="lbl">' + (x.hidden ? 'Off' : 'On') + '</span></button>' +
            '<button class="ib" title="Edit" data-act="edit">✎</button>' +
            '<button class="ib" title="Duplicate" data-act="dup">⧉</button>' +
            '<button class="ib danger" title="Delete" data-act="del">🗑</button>' +
          '</span></div>';
      }).join('') : '<div class="empty">nothing here yet</div>') + '</div>';

    $('#add').onclick = () => editItem(key, null);
    $('#q').oninput = e => { S.q = e.target.value; const pos = e.target.selectionStart; renderList(v, key); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    $('#showhidden').onchange = e => { S.showHidden = e.target.checked; renderList(v, key); };
    $('#list').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = b.closest('.item').dataset.id;
      const i = list.findIndex(x => x.id === id); const x = list[i];
      switch (b.dataset.act) {
        case 'up': if (i > 0) { list.splice(i - 1, 0, list.splice(i, 1)[0]); } break;
        case 'down': if (i < list.length - 1) { list.splice(i + 1, 0, list.splice(i, 1)[0]); } break;
        case 'feature': x.featured = !x.featured; break;
        case 'hide': x.hidden = !x.hidden; toast(short(C.title(x), 40) + (x.hidden ? ' turned off' : ' turned on')); break;
        case 'edit': return editItem(key, x);
        case 'dup': { const c = clone(x); c.id = uniqueId(list, x.id + '-copy'); if (c.name) c.name += ' (copy)'; if (c.title) c.title += ' (copy)'; c.hidden = true; list.splice(i + 1, 0, c); toast('Duplicated as hidden copy'); break; }
        case 'del': if (!confirm('Delete “' + C.title(x) + '”? (Hide keeps it but takes it off the site.)')) return; list.splice(i, 1); break;
      }
      changed(); renderList(v, key);
    };
  }

  function editItem(key, item) {
    const C = COLLECTIONS[key];
    const isNew = !item;
    const work = isNew ? C.blank() : clone(item);
    const m = $('#modal');
    const draw = () => {
      m.innerHTML = '<form method="dialog" id="mform">' +
        '<div class="modal-head"><h2>' + (isNew ? 'New ' : 'Edit ') + esc(C.one) + '</h2><button class="ib" value="cancel" title="Close">✕</button></div>' +
        '<div class="modal-body" id="mbody">' + formHtml(SCHEMA[key], work) + '</div>' +
        '<div class="modal-foot">' + (isNew ? '' : '<button class="btn sm danger" type="button" id="mdel" style="margin-right:auto">Delete</button>') +
        '<button class="btn sm" value="cancel">Cancel</button><button class="btn sm primary" type="submit" value="save" id="msave">' + (isNew ? 'Add' : 'Apply') + '</button></div></form>';
      bindForm($('#mbody'), work, () => {}, () => { const st = $('#mbody').scrollTop; draw(); $('#mbody').scrollTop = st; });
      if ($('#mdel')) $('#mdel').onclick = () => {
        if (!confirm('Delete this item?')) return;
        const list = S.data[key]; list.splice(list.findIndex(x => x.id === item.id), 1);
        m.close(); changed(); renderView();
      };
      $('#mform').onsubmit = e => {
        if (e.submitter && e.submitter.value !== 'save') return;
        const missing = SCHEMA[key].flatMap(f => f.row || [f]).filter(f => f.req && !String(getPath(work, f.k) || '').trim());
        if (key === 'banners' && work.start && work.end && Date.parse(work.end) <= Date.parse(work.start)) { e.preventDefault(); toast('"Take down at" must be after "Show starting"', 'err'); return; }
        if (missing.length) { e.preventDefault(); toast('Fill in: ' + missing.map(f => f.label).join(', '), 'err'); return; }
        const list = S.data[key];
        work.id = slug(work.id) || C.idFrom(work) || 'item';
        if (list.some(x => x.id === work.id && x !== item)) work.id = uniqueId(list.filter(x => x !== item), work.id);
        if (isNew) list.unshift(work); else list.splice(list.indexOf(item), 1, work);
        changed(); renderView();
        toast((isNew ? 'Added' : 'Updated') + '. Press Publish to put it on the live site.', 'ok');
      };
    };
    draw();
    m.onclose = () => { if (location.hash.split('/').length > 1) history.replaceState(null, '', '#' + key); };
    m.showModal();
    if (!focusPending($('#mbody'))) { const first = $('#mbody input, #mbody textarea'); if (first) first.focus(); }
  }

  /* ---------------- raw ---------------- */
  function renderRaw(v) {
    v.innerHTML = '<p class="hint">The whole site in one file. Edit anything, then Apply. Invalid JSON is rejected.</p>' +
      '<div class="formcard"><label class="field"><textarea id="raw" rows="30" spellcheck="false">' + esc(serialize(S.data)) + '</textarea></label>' +
      '<button class="btn sm primary" type="button" id="apply">Apply</button></div>';
    $('#apply').onclick = () => {
      try {
        const d = JSON.parse($('#raw').value);
        if (!d || typeof d !== 'object' || !d.practice) throw new Error('missing "practice"');
        S.data = d; normalize(); changed(); toast('Applied', 'ok');
      } catch (err) { toast('Invalid JSON: ' + err.message, 'err'); }
    };
  }

  // Publish confirmation: asks for a short note about what changed. Resolves the message, or null if cancelled.
  function confirmPublish() {
    return new Promise(resolve => {
      const m = $('#modal');
      m.innerHTML = '<form method="dialog" id="pubform" autocomplete="off">' +
        '<div class="modal-head"><h2>Publish changes</h2><button class="ib" value="cancel" title="Close">✕</button></div>' +
        '<div class="modal-body">' +
          '<label class="field"><span>What changed (commit message)</span><input id="pubmsg" type="text" value="Update site content"></label>' +
        '</div>' +
        '<div class="modal-foot"><button class="btn sm" value="cancel">Cancel</button><button class="btn sm primary" type="submit" value="go">Publish</button></div></form>';
      let done = false;
      m.onclose = () => { if (!done) resolve(null); };
      $('#pubform').onsubmit = async e => {
        if (e.submitter && e.submitter.value !== 'go') return;
        e.preventDefault();
        done = true; const msg = $('#pubmsg').value.trim() || 'Update site content';
        m.close(); resolve(msg);
      };
      m.showModal();
      $('#pubmsg').select();
    });
  }

  /* ---------------- publish ---------------- */
  async function publish() {
    if (S.mode !== 'github') {
      const blob = new Blob([serialize(S.data)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'site.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Downloaded site.json. Replace data/site.json in the repo with it.', 'ok');
      return;
    }
    const msg = await confirmPublish();
    if (msg === null) return;
    const btn = $('#publish'); btn.disabled = true; btn.textContent = 'Publishing…';
    const body = serialize(S.data);
    try {
      let res;
      try { res = await ghPutFile(DATA_PATH, b64utf8(body), msg || 'Update site content', S.sha); }
      catch (err) {
        if (err.status !== 409 && err.status !== 422) throw err;
        if (!confirm('site.json changed on GitHub since you loaded it (another device or a commit). Overwrite it with your version?')) throw new Error('Publish cancelled');
        const fresh = await ghSha(DATA_PATH);
        res = await ghPutFile(DATA_PATH, b64utf8(body), msg || 'Update site content', fresh);
      }
      S.sha = res.content.sha; S.base = body;
      put(ls(), K.DRAFT_KEY, null); put(ls(), DRAFT_BASE_KEY, null);
      renderTopbar();
      toast('Published. The live site updates in about a minute.', 'ok');
    } catch (err) {
      toast((err.status === 401 || err.status === 403 || err.status === 404 ? 'GitHub refused the write (' + err.status + '). Check the token has Contents: read & write on ' + S.repo + '. ' : '') + err.message, 'err');
      renderTopbar();
    }
  }

  /* ---------------- boot ---------------- */
  function normalize() {
    const d = S.data;
    Object.keys(COLLECTIONS).forEach(k => {
      d[k] = d[k] || [];
      d[k].forEach(x => { if (!x.id) x.id = uniqueId(d[k], COLLECTIONS[k].idFrom(x) || 'item'); });
    });
    ['practice', 'home', 'about', 'doctor', 'quiz', 'fasttrack'].forEach(k => { d[k] = d[k] || {}; });
    d.social = d.social || [];  d.organs = d.organs || [];
  }

  function offerDraftRestore() {
    let raw; try { raw = ls() && ls().getItem(K.DRAFT_KEY); } catch (e) { raw = null; }
    let parsed; try { parsed = raw && JSON.parse(raw); } catch (e) { parsed = null; }
    if (!parsed || serialize(parsed) === S.base) return;
    let base; try { base = ls().getItem(DRAFT_BASE_KEY); } catch (e) { base = null; }
    const stale = base && S.sha && base !== S.sha;
    if (confirm('You have unpublished changes saved on this device.' + (stale ? '\n\nHeads up: the live site changed since that draft was made. Restoring will replace those newer changes when you publish.' : '') + '\n\nRestore them?')) {
      S.data = parsed; normalize();
    } else {
      put(ls(), K.DRAFT_KEY, null); put(ls(), DRAFT_BASE_KEY, null);
    }
  }

  async function start(mode) {
    S.mode = mode;
    $('#root').innerHTML = '<p class="wrap loading mono">&gt; loading site.json<span class="cursor">▍</span></p>';
    try {
      if (mode === 'github') {
        const [user, file] = await Promise.all([gh('/user').catch(() => ({})), ghLoad()]);
        S.login = user.login || '';
        S.data = file.data; S.sha = file.sha;
      } else {
        const res = await fetch('../' + DATA_PATH + '?t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('could not load site.json (' + res.status + ')');
        S.data = await res.json();
      }
    } catch (err) {
      // Only a rejected token (401) is thrown away; network blips and GitHub hiccups keep it and offer a retry.
      if (mode === 'github' && err.status !== 401) return loadFailed(err);
      if (mode === 'github') forget();
      return gate(mode === 'github' ? 'GitHub said: ' + err.message + (err.status === 401 ? ' (bad or expired token)' : err.status === 404 ? ' (token cannot see ' + S.repo + ', or the branch/file does not exist)' : '') : err.message);
    }
    normalize();
    S.base = serialize(S.data);
    offerDraftRestore();
    renderShell();
    window.addEventListener('hashchange', go);
    go();
  }

  function loadFailed(err) {
    $('#root').innerHTML = '<div class="gate"><div class="gate-box"><h1>GI Guy admin</h1>' +
      '<p>Could not reach GitHub just now (' + esc(err.message || 'network error') + '). Your saved token is still here.</p>' +
      '<button class="btn primary" type="button" id="retry" style="width:100%;justify-content:center">Retry</button>' +
      '<div class="or">or</div><button class="btn" type="button" id="newtok" style="width:100%;justify-content:center">Use a different token</button></div></div>';
    $('#retry').onclick = () => start('github');
    $('#newtok').onclick = () => { forget(); gate(); };
  }

  function gate(error) {
    let cfg = {}; try { cfg = JSON.parse((ls() && ls().getItem(CFG_KEY)) || '{}'); } catch (e) { cfg = {}; }
    const newTokenUrl = 'https://github.com/settings/personal-access-tokens/new';
    $('#root').innerHTML = '<div class="gate"><form class="gate-box" id="gate" autocomplete="off">' +
      '<h1>GI Guy admin</h1><p>Change banners, hours, providers and pages. Publishing saves to GitHub, and the live site updates about a minute later.</p>' +
      (error ? '<p style="color:var(--down)">' + esc(error) + '</p>' : '') +
      '<label class="field"><span>GitHub token</span><input id="tok" type="password" required placeholder="github_pat_…" autocomplete="off"></label>' +
      '<div class="row2"><label class="field"><span>Repo</span><input id="repo" value="' + esc(cfg.repo || DEFAULT_REPO) + '"></label>' +
      '<label class="field"><span>Branch</span><input id="branch" value="' + esc(cfg.branch || DEFAULT_BRANCH) + '"></label></div>' +
      '<label class="check"><input type="checkbox" id="remember" checked>Remember on this device</label>' +
      '<button class="btn primary" type="submit" style="width:100%;justify-content:center">Unlock</button>' +
      '<details style="margin-top:14px"><summary class="mono" style="cursor:pointer;font-size:12px;color:var(--muted)">How do I get a token?</summary><ol>' +
        '<li>Open <a href="' + newTokenUrl + '" target="_blank" rel="noopener">GitHub → Fine-grained tokens → Generate</a>.</li>' +
        '<li>Repository access: <b>Only select repositories</b> → <code>' + esc(DEFAULT_REPO.split('/')[1]) + '</code>.</li>' +
        '<li>Permissions → Repository → <b>Contents: Read and write</b>. Nothing else.</li>' +
        '<li>Pick an expiry, generate, paste it here. It stays in this browser only.</li></ol></details>' +
      '<div class="or">or</div>' +
      '<button class="btn" type="button" id="local" style="width:100%;justify-content:center">Edit without GitHub (download JSON)</button>' +
      '</form></div>';
    $('#gate').onsubmit = e => {
      e.preventDefault();
      S.token = $('#tok').value.trim(); S.repo = $('#repo').value.trim() || DEFAULT_REPO; S.branch = $('#branch').value.trim() || DEFAULT_BRANCH;
      saveCreds($('#remember').checked);
      start('github');
    };
    $('#local').onclick = () => start('local');
  }

  function enter() {
    const tok = K.getItem(K.TOKEN_KEY);
    let cfg = {}; try { cfg = JSON.parse((ls() && ls().getItem(CFG_KEY)) || '{}'); } catch (e) { cfg = {}; }
    if (tok) { S.token = tok; S.repo = cfg.repo || DEFAULT_REPO; S.branch = cfg.branch || DEFAULT_BRANCH; start('github'); }
    else gate();
  }

  enter();
})();
