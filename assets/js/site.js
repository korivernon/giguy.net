/* Renders every public page from data/site.json. Each page is a shell with <body data-page="…">. */
(function () {
  'use strict';
  const G = window.GG;
  const { esc, inline, md, lines, safeUrl, tel } = G;
  const $ = (s, r) => (r || document).querySelector(s);
  const shown = list => (list || []).filter(x => !x.hidden);

  const NAV = [
    ['home', 'index.html', 'Home'],
    ['about', 'about.html', 'About Us'],
    ['team', 'team.html', 'Our Team'],
    ['conditions', 'conditions.html', 'Conditions'],
    ['services', 'services.html', 'Services'],
    ['fasttrack', 'fast-track-colonoscopy.html', 'Fast-Track', 'nav-ft'],
    ['patients', 'patients.html', 'Patient Resources'],
    ['learn', 'learn.html', 'Learn'],
    ['contact', 'contact.html', 'Contact Us'],
  ];
  const PAGE = document.body.dataset.page;
  const navKey = PAGE === 'article' || PAGE === 'quiz' ? 'learn' : PAGE === 'condition' ? 'conditions' : PAGE === 'procedure' ? 'services' : PAGE;

  const ICON = {
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.1.8-1.2-4.5-2.7z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9zM8 13h8v2H8zm0 4h8v2H8z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-1.4 1.4 5.6 5.6H4v2h12.2l-5.6 5.6L12 20l8-8z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2zm3 5v2h10V9zm0 4v2h7v-2z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>',
    scope: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a3 3 0 0 0-1 5.83V15a5 5 0 0 1-10 0v-.1A6 6 0 0 0 13 9V3h-3v2h1v4a4 4 0 0 1-8 0V5h1V3H1v6a6 6 0 0 0 5 5.9V15a7 7 0 0 0 14 0v-1.17A3 3 0 0 0 19 8zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5A5.4 5.4 0 0 1 7.5 3 6 6 0 0 1 12 5.09 6 6 0 0 1 16.5 3 5.4 5.4 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 5c-1.1-.35-2.3-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5z"/></svg>',
  };
  const HL_ICONS = ['scope', 'check', 'heart'];

  let D;
  const ftOn = () => !!(D && D.fasttrack && D.fasttrack.enabled === true);
  const navItems = () => NAV.filter(n => n[0] !== 'fasttrack' || ftOn());

  /* ---------------- shared chrome ---------------- */
  function bannerHtml() {
    const live = (D.banners || []).filter(b => G.bannerState(b) === 'live');
    if (!live.length) return '';
    return live.map(b => {
      const key = 'giguy:banner:' + b.id + ':' + b.message.length;
      let dismissed = false; try { dismissed = sessionStorage.getItem(key) === '1'; } catch (e) { /* blocked */ }
      if (dismissed) return '';
      const link = b.linkUrl && b.linkLabel ? ' <a href="' + esc(safeUrl(b.linkUrl)) + '">' + esc(b.linkLabel) + '</a>' : '';
      return '<div class="banner banner-' + esc(b.style || 'info') + '" role="status">' +
        '<div class="container banner-in"><span class="banner-msg">' + inline(b.message) + link + '</span>' +
        '<button class="banner-x" type="button" aria-label="Dismiss notice" data-dismiss="' + esc(key) + '">' + ICON.close + '</button></div></div>';
    }).join('');
  }

  function header() {
    const P = D.practice || {};
    const locs = shown(D.locations);
    $('#site-header').innerHTML = bannerHtml() +
      '<div class="topbar"><div class="container topbar-in">' +
        '<span class="tb-phones">' + locs.map(l => '<a href="' + tel(l.phone) + '">' + ICON.phone + esc(l.name) + ' ' + esc(l.phone) + '</a>').join('') + '</span>' +
      '</div></div>' +
      '<header class="header"><div class="container header-in">' +
        '<a class="logo" href="index.html" aria-label="' + esc(P.name) + ', home"><img src="img/logos/logo.png" alt="The GI Guy" width="180" height="72">' +
          '<span class="logo-text"><b>' + esc(P.doctor) + '</b><small>' + esc(P.tagline) + '</small></span></a>' +
        '<nav class="nav" id="nav" aria-label="Main">' +
          navItems().map(n => '<a href="' + n[1] + '"' + (n[3] ? ' class="' + n[3] + '"' : '') + (n[0] === navKey ? ' aria-current="page"' : '') + '>' + n[2] + '</a>').join('') +
          '<a class="btn btn-outline nav-call" href="' + tel(P.phone) + '">' + ICON.phone + 'Call ' + esc(P.phone) + '</a>' +
        '</nav>' +
        '<a class="portal-link" href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">' + ICON.lock + '<span>' + esc(P.portalLabel || 'Patient Portal') + '</span></a>' +
        '<button class="menu-btn" type="button" id="menu" aria-expanded="false" aria-controls="nav" aria-label="Menu">' + ICON.menu + '</button>' +
      '</div></header>';
    const btn = $('#menu');
    btn.onclick = () => {
      document.documentElement.style.setProperty('--hdr', document.querySelector('.header').getBoundingClientRect().bottom + 'px');
      const open = document.body.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', open);
      btn.innerHTML = open ? ICON.close : ICON.menu;
    };
    $('#site-header').addEventListener('click', e => {
      const x = e.target.closest('[data-dismiss]'); if (!x) return;
      try { sessionStorage.setItem(x.dataset.dismiss, '1'); } catch (err) { /* blocked */ }
      x.closest('.banner').remove();
    });
  }

  // Brand marks for the footer (Simple Icons, CC0). Unknown platforms fall back to their name.
  const SOCIAL = {
    facebook: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z',
    linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
    x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
    instagram: 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077',
    youtube: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  };
  function socialIcon(s) {
    const u = String(s.url || '').toLowerCase(), l = String(s.label || '').toLowerCase();
    const key = /facebook/.test(u + l) ? 'facebook' : /linkedin/.test(u + l) ? 'linkedin' : /(^|\/\/|\.)(x|twitter)\.com/.test(u) || l === 'x' || /twitter/.test(l) ? 'x'
      : /instagram/.test(u + l) ? 'instagram' : /youtube|youtu\.be/.test(u + l) ? 'youtube' : '';
    return key ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + SOCIAL[key] + '"/></svg>' : esc(s.label);
  }

  function footer() {
    const P = D.practice || {};
    const year = new Date().getFullYear();
    $('#site-footer').innerHTML = '<footer class="footer"><div class="container">' +
      '<div class="foot-grid">' +
        '<div class="foot-brand"><img src="img/logos/footer-logo.png" alt="The GI Guy" width="150" height="60" loading="lazy">' +
          '<p>' + esc(P.footerTagline) + '</p>' +
          '<div class="social">' + (D.social || []).filter(s => s.url).map(s => '<a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener" aria-label="' + esc(s.label) + '" title="' + esc(s.label) + '">' + socialIcon(s) + '</a>').join('') + '</div></div>' +
        '<div class="foot-visit"><h4>Visit</h4><div class="foot-locs">' + shown(D.locations).map(l =>
          '<p><b>' + esc(l.name) + '</b><a class="foot-addr" href="' + mapUrl(l) + '" target="_blank" rel="noopener">' + esc(l.address).replace(/\n/g, '<br>') + '</a><a href="' + tel(l.phone) + '">Phone ' + esc(l.phone) + '</a>' + (l.fax ? '<span>Fax ' + esc(l.fax) + '</span>' : '') + '</p>').join('') + '</div></div>' +
        '<div class="foot-hours">' + hoursHtml(P, 'h4') + '</div>' +
        '<div class="foot-patients"><h4>Patients</h4><ul><li><a href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">' + esc(P.portalLabel || 'Patient Portal') + '</a></li>' + (P.klaraUrl ? '<li><a href="' + esc(safeUrl(P.klaraUrl)) + '" target="_blank" rel="noopener">' + esc(P.klaraLabel || 'Message us on Klara') + '</a></li>' : '') + (shown(D.videos).length ? '<li><a href="patients.html#videos">Instruction Videos</a></li>' : '') + '<li><a href="patients.html#forms">Patient Forms</a></li><li><a href="patients.html#prep">Colonoscopy Prep</a></li><li><a href="risk-quiz.html">Colon Cancer Risk Quiz</a></li></ul></div>' +
        '<div class="foot-explore"><h4>Explore</h4><ul>' + navItems().slice(1).map(n => '<li><a href="' + n[1] + '">' + n[2] + '</a></li>').join('') + '</ul></div>' +
      '</div>' +
      (D.partners && D.partners.length ? '<div class="partners">' + D.partners.map(p => '<img src="' + esc(p.logo) + '" alt="' + esc(p.name) + '" loading="lazy">').join('') + '</div>' : '') +
      '<p class="fine">' + esc(P.emergencyNote) + ' ' + esc(P.disclaimer) + '</p>' +
      '<p class="fine">© ' + year + ' ' + esc(P.doctor) + ' · ' + esc(P.name) + '</p>' +
    '</div></footer>';
  }

  const navLabel = key => (NAV.find(n => n[0] === key) || [, , ''])[2];
  const crumbLink = key => { const n = NAV.find(x => x[0] === key); return '<a href="' + n[1] + '">' + n[2] + '</a>'; };
  // Section pages: heading, breadcrumb and browser tab all use the menu label.
  function sectionHead(key, sub, extra) { document.title = navLabel(key) + ' · The GI Guy'; return pageHead(navLabel(key), sub, navLabel(key), extra); }
  function pageHead(title, sub, crumb, extra) {
    return '<section class="page-head"><div class="container">' +
      (crumb ? '<p class="crumb"><a href="index.html">Home</a> / ' + crumb + '</p>' : '') +
      '<h1>' + esc(title) + '</h1>' + (sub ? '<p class="lead">' + inline(sub) + '</p>' : '') + (extra || '') + '</div></section>';
  }

  function callBand() {
    return '<section class="cta"><div class="container cta-in">' +
      '<div><h2>Ready to schedule?</h2><p>Call either office and our staff will find a time that works for you.</p></div>' +
      callOpts() +
    '</div></section>';
  }

  function faqHtml(list) {
    return '<div class="faq">' + (list || []).map(f => '<details><summary>' + esc(f.q) + '</summary><div class="faq-a">' + md(f.a) + '</div></details>').join('') + '</div>';
  }

  function serviceCards(list) {
    return '<div class="cards">' + list.map(s =>
      '<article class="card svc" id="' + esc(s.id) + '"><h3><a href="' + procUrl(s) + '">' + esc(s.title) + '</a></h3><p class="muted">' + esc(s.summary) + '</p>' +
      (s.points ? '<ul class="ticks">' + lines(s.points).map(p => '<li>' + ICON.check + '<span>' + inline(p) + '</span></li>').join('') + '</ul>' : '') +
      '<a class="more" href="' + procUrl(s) + '">Learn more ' + ICON.arrow + '</a></article>').join('') + '</div>';
  }

  // Office name on one line, number on the next; outlined so it reads as a choice, not a white slab.
  const callOpts = (cls) => '<div class="call-opts' + (cls ? ' ' + cls : '') + '">' + shown(D.locations).map(l =>
    '<a class="call-opt" href="' + tel(l.phone) + '"><small>' + esc(l.name) + '</small><b>' + ICON.phone + esc(l.phone) + '</b></a>').join('') + '</div>';
  // Office hours, then endoscopy hours when set; one time block per line.
  function hoursHtml(P, hTag) {
    const block = (title, txt) => txt ? '<' + hTag + ' class="hours-title">' + title + '</' + hTag + '><p class="hours-lines">' + lines(txt).map(esc).join('<br>') + '</p>' : '';
    return block('Office Hours', P.hours) + block('Endoscopy Hours', P.endoscopyHours);
  }
  const klaraLink = (P, cls) => P.klaraUrl ? '<a class="' + cls + '" href="' + esc(safeUrl(P.klaraUrl)) + '" target="_blank" rel="noopener">' + ICON.chat + esc(P.klaraLabel || 'Message us on Klara') + ' ' + ICON.arrow + '</a>' : '';
  const ytId = u => { const m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : ''; };
  // Click-to-play: YouTube's thumbnail first; the player (privacy-enhanced domain) loads only when tapped.
  function videoCards(list) {
    return '<div class="videos">' + list.filter(v => ytId(v.youtube)).map(v => {
      const id = ytId(v.youtube);
      return '<article class="card video"><button class="video-frame" type="button" data-yt="' + id + '" aria-label="Play: ' + esc(v.title) + '">' +
        '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="" loading="lazy"><span class="video-play" aria-hidden="true"></span></button>' +
        '<h3>' + esc(v.title) + '</h3>' + (v.text ? '<p class="muted">' + inline(v.text) + '</p>' : '') + '</article>';
    }).join('') + '</div>';
  }
  function mapUrl(l) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.mapQuery || l.address.replace(/\n/g, ', ')); }

  function locationCards(withMap) {
    return '<div class="locs">' + shown(D.locations).map(l =>
      '<article class="card loc">' +
        (withMap ? '<iframe class="map" title="Map of the ' + esc(l.name) + ' office" src="https://maps.google.com/maps?q=' + encodeURIComponent(l.mapQuery || l.address) + '&z=15&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' : '') +
        '<div class="loc-body"><h3>' + esc(l.name) + ' office</h3>' +
        '<p class="icoline">' + ICON.pin + '<span>' + esc(l.address).replace(/\n/g, '<br>') + '</span></p>' +
        '<p class="icoline">' + ICON.phone + '<span><a href="' + tel(l.phone) + '">' + esc(l.phone) + '</a>' + (l.fax ? ' · Fax ' + esc(l.fax) : '') + '</span></p>' +
        '<div class="loc-acts"><a class="btn btn-primary btn-sm" href="' + tel(l.phone) + '">Call</a><a class="btn btn-outline btn-sm" href="' + mapUrl(l) + '" target="_blank" rel="noopener">Directions</a></div></div>' +
      '</article>').join('') + '</div>';
  }

  /* ---------------- pages ---------------- */
  const PAGES = {};

  PAGES.home = function () {
    const H = D.home || {}, P = D.practice || {}, Dr = D.doctor || {};
    const forms = shown(D.forms);
    return '<section class="hero"><div class="container hero-in">' +
        '<div class="hero-copy"><p class="eyebrow">' + esc(H.eyebrow) + '</p><h1>' + esc(H.title) + '</h1><p class="lead">' + inline(H.text) + '</p>' +
          '<div class="hero-acts"><a class="btn btn-primary" href="' + tel(P.phone) + '">' + ICON.phone + 'Call to schedule</a>' +
          '<a class="btn btn-outline" href="#conditions">' + esc(H.conditionsTitle || 'Conditions & Services') + '</a></div></div>' +
        '<figure class="hero-photo"><img src="' + esc(Dr.photo) + '" alt="Dr. Kurt Vernon, The GI Guy" width="481" height="310">' +
          '<figcaption class="hero-meet"><p class="eyebrow">Meet the GI Guy</p><h2>' + esc(Dr.name) + '</h2>' +
          '<blockquote>“' + esc(Dr.quote) + '”</blockquote>' +
          '<a class="btn btn-primary btn-sm" href="team.html">Meet our team ' + ICON.arrow + '</a></figcaption></figure>' +
      '</div></section>' +
      (ftOn() && D.fasttrack.homeBand ? '<section class="ft-band"><div class="container ft-band-in"><p>' + inline(D.fasttrack.homeBand) + '</p><a class="btn btn-accent" href="fast-track-colonoscopy.html">How Fast-Track works ' + ICON.arrow + '</a></div></section>' : '') +
      '<section class="quick"><div class="container quick-grid">' +
        '<a class="qcard" href="contact.html">' + ICON.pin + '<span><b>Locations & hours</b><small>Fuquay-Varina and Dunn</small></span></a>' +
        (forms[0] ? '<a class="qcard" href="patients.html#' + esc(forms[0].anchor || forms[0].id) + '">' + ICON.doc + '<span><b>Patient forms</b><small>Fill out before your visit</small></span></a>' : '') +
        (forms[1] ? '<a class="qcard" href="patients.html#' + esc(forms[1].anchor || forms[1].id) + '">' + ICON.doc + '<span><b>Colonoscopy prep</b><small>Step-by-step instructions</small></span></a>' : '') +
        '<a class="qcard" href="risk-quiz.html">' + ICON.check + '<span><b>Are you at risk?</b><small>Quick colon cancer quiz</small></span></a>' +
      '</div></section>' +
      '<section class="section"><div class="container"><div class="hl-grid">' + (H.highlights || []).map((h, i) =>
        '<div class="hl"><span class="hl-ico">' + ICON[HL_ICONS[i % 3]] + '</span><h3>' + esc(h.title) + '</h3><p>' + inline(h.text) + '</p></div>').join('') + '</div></div></section>' +
      condProcBlock() +
      (H.recognition ? '<section class="recog"><div class="container recog-in">' + ICON.check + '<p>' + inline(H.recognition) + (H.recognitionLink ? ' <a href="' + esc(safeUrl(H.recognitionLink)) + '">Read more</a>' : '') + '</p></div></section>' : '') +
      '<section class="section"><div class="container two-col">' +
        '<div><p class="eyebrow">FAQs</p><h2>Your questions, answered</h2>' + faqHtml(D.faqs) + '</div>' +
        '<div><p class="eyebrow">Visit us</p><h2>Two convenient offices</h2>' + locationCards(false) +
          '<div class="card hours">' + hoursHtml(P, 'h3') + '</div></div>' +
      '</div></section>' + callBand();
  };

  PAGES.about = function () {
    const A = D.about || {};
    return sectionHead('about', '') +
      '<section class="section"><div class="container two-col wide-left">' +
        '<div class="prose">' + md(A.text) + '</div>' +
        '<aside class="card treats"><h3>Conditions we treat</h3><ul class="chips">' + shown(D.conditions).map(c => '<li><a href="' + condUrl(c) + '">' + esc(c.name || c) + '</a></li>').join('') + '</ul></aside>' +
      '</div></section>' +
      '<section class="section alt"><div class="container"><div class="hl-grid">' + (A.values || []).map((v, i) =>
        '<div class="hl"><span class="hl-ico">' + ICON[HL_ICONS[i % 3]] + '</span><h3>' + esc(v.title) + '</h3><p>' + inline(v.text) + '</p></div>').join('') + '</div></div></section>' +
      '<section class="section"><div class="container two-col">' +
        '<div class="card"><h2>Insurance</h2><p>' + inline(A.insurance) + '</p><a class="btn btn-primary btn-sm" href="' + tel(D.practice.phone) + '">' + ICON.phone + 'Call ' + esc(D.practice.phone) + '</a></div>' +
        '<div class="card" id="wellness"><h2>' + esc(A.wellnessTitle) + '</h2>' + md(A.wellnessText) + '</div>' +
      '</div></section>' + callBand();
  };

  PAGES.team = function () {
    const Dr = D.doctor || {};
    return sectionHead('team', 'Personal care from a team that knows you by name.') +
      '<section class="section"><div class="container">' +
        '<article class="doctor"><div class="doctor-photo"><img src="' + esc(Dr.photo) + '" alt="Dr. Kurt Vernon" width="481" height="310"></div>' +
        '<div class="doctor-body"><p class="eyebrow">' + esc(Dr.role) + '</p><h2>' + esc(Dr.name) + '</h2><blockquote>“' + esc(Dr.quote) + '”</blockquote>' + md(Dr.bio) + '</div></article>' +
        '<dl class="creds">' + (Dr.credentials || []).map(c => '<div><dt>' + esc(c.label) + '</dt><dd>' + esc(c.value) + '</dd></div>').join('') + '</dl>' +
      '</div></section>' +
      '<section class="section alt"><div class="container"><h2 class="center">Our providers</h2><div class="team">' + shown(D.team).map(p =>
        '<article class="card person" id="' + esc(p.id) + '">' +
          '<img src="' + esc(p.photo) + '" alt="' + esc(p.name) + '" loading="lazy">' +
          '<div class="person-body"><h3>' + esc(p.name) + '</h3><p class="role">' + esc(p.role) + '</p>' +
          (p.statement ? '<blockquote>“' + esc(p.statement) + '”</blockquote>' : '') +
          '<details><summary>Background & education</summary>' + md(p.bio) +
            (p.education ? '<h4>Education</h4><ul>' + lines(p.education).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') +
            (p.memberships ? '<h4>Credentials & memberships</h4><ul>' + lines(p.memberships).map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>' : '') +
          '</details></div></article>').join('') + '</div></div></section>' + callBand();
  };

  PAGES.services = function () {
    return sectionHead('services', 'Procedures and treatments for digestive conditions, using modern endoscopy equipment.') +
      ftPromo() +
      '<section class="section"><div class="container">' + serviceCards(shown(D.services)) + '</div></section>' +
      '<section class="section alt"><div class="container"><h2>Conditions we treat</h2><p class="muted">Choose one to learn what it is and how we treat it.</p><ul class="chips big">' + shown(D.conditions).map(c => '<li><a href="' + condUrl(c) + '">' + esc(c.name || c) + '</a></li>').join('') + '</ul>' +
      '<p class="muted" style="margin-top:20px">Has Dr. Vernon recommended a procedure? See <a href="patients.html#prep">preparation instructions</a> or call us with any questions.</p></div></section>' +
      callBand();
  };

  function ftPromo() {
    const F = D.fasttrack; if (!ftOn()) return '';
    return '<section class="section ft-promo-wrap"><div class="container"><a class="card quiz-promo ft-promo" href="fast-track-colonoscopy.html">' + ICON.clock +
      '<span><b>' + esc(F.title) + '</b><small>' + esc(F.noVisit) + '</small></span>' + ICON.arrow + '</a></div></section>';
  }

  PAGES.fasttrack = function () {
    // Switched off in the admin: send visitors (and any old links or ads) to the home page.
    if (!ftOn()) { location.replace('index.html' + location.search); return ''; }
    const F = D.fasttrack || {}, P = D.practice || {};
    const callBtns = callOpts();
    const tickList = t => '<ul class="ticks">' + lines(t).map(x => '<li>' + ICON.check + '<span>' + inline(x) + '</span></li>').join('') + '</ul>';
    return '<section class="ft-hero"><div class="container">' +
        '<p class="crumb"><a href="index.html">Home</a> / ' + esc(F.navLabel || 'Fast-Track') + '</p>' +
        '<p class="eyebrow">' + esc(F.eyebrow) + '</p><h1>' + esc(F.title) + '</h1><p class="lead">' + inline(F.intro) + '</p>' +
        '<p class="ft-novisit">' + ICON.check + '<span>' + inline(F.noVisit) + '</span></p>' +
        callBtns +
      '</div></section>' +
      '<section class="section"><div class="container"><h2>How it works</h2><ol class="steps">' + (F.steps || []).map((st, i) =>
        '<li class="card"><span class="step-n">' + (i + 1) + '</span><h3>' + esc(st.title) + '</h3><p>' + inline(st.text) + '</p></li>').join('') + '</ol></div></section>' +
      '<section class="section alt"><div class="container two-col">' +
        '<div class="card"><h2>Fast-Track is for you if</h2>' + tickList(F.fit) + '</div>' +
        '<div class="card note"><h2>We may need to see you first if you</h2>' + tickList(F.notFit) + '<p class="muted small">' + inline(F.notFitNote) + '</p></div>' +
      '</div></section>' +
      '<section class="section"><div class="container two-col">' +
        '<div class="card"><h2>Have these ready</h2>' + tickList(F.bring) + '</div>' +
        '<div class="card"><h2>Insurance</h2><p>' + inline(F.insurance) + '</p><a class="btn btn-primary btn-sm" href="' + tel(P.phone) + '">' + ICON.phone + 'Call ' + esc(P.phone) + '</a></div>' +
      '</div></section>' +
      '<section class="section alt"><div class="container narrow"><h2>Questions</h2>' + faqHtml(F.faqs) + '</div></section>' +
      (F.providers ? '<section class="section" id="referrals"><div class="container narrow"><div class="card"><h2>' + esc(F.providersTitle) + '</h2><p>' + inline(F.providers) + '</p></div></div></section>' : '') +
      '<section class="cta"><div class="container cta-in"><div><h2>Don\'t wait months to find out.</h2><p>Call either office and ask for Fast-Track.</p></div><div class="cta-acts">' + callBtns + '</div></div></section>';
  };

  /* ---------------- conditions & procedures ---------------- */
  // A sentence ends at . ! or ? followed by a space, but not after a lone initial like "H. pylori".
  const firstSentence = t => { const m = String(t || '').match(/^.*?[^A-Z\s][.!?](\s|$)/); return m ? m[0].trim() : String(t || ''); };
  const condUrl = c => 'condition.html?id=' + encodeURIComponent(c.id);
  const procUrl = s => 'procedure.html?id=' + encodeURIComponent(s.id);
  const rowLink = (url, name, sub) => '<a class="cp-row" href="' + url + '"><span><b>' + esc(name) + '</b><small>' + inline(sub) + '</small></span>' + ICON.arrow + '</a>';

  // Home page: two columns like a care-center page, every condition with what it is, and every procedure.
  function condProcBlock() {
    const H = D.home || {}, conds = shown(D.conditions), procs = shown(D.services);
    if (!conds.length && !procs.length) return '';
    return '<section class="section" id="conditions"><div class="container">' +
      '<div class="sec-head"><div><p class="eyebrow">Get the right care</p><h2>' + esc(H.conditionsTitle || 'Conditions & Services') + '</h2>' +
        (H.conditionsIntro ? '<p class="muted sec-intro">' + inline(H.conditionsIntro) + '</p>' : '') + '</div>' +
        '</div>' +
      '<div class="cp">' +
        '<div class="cp-col cp-conds"><div class="cp-head"><h3>' + navLabel('conditions') + '</h3><a class="more" href="conditions.html">View all ' + ICON.arrow + '</a></div><div class="cp-list" id="cp-conds">' + conds.map(c => rowLink(condUrl(c), c.name, firstSentence(c.text))).join('') + '</div>' +
          (conds.length > 8 ? '<button class="btn btn-outline btn-sm cp-more" type="button" data-expand="cp-conds">Show all ' + conds.length + ' conditions</button>' : '') + '</div>' +
        '<div class="cp-col"><div class="cp-head"><h3>' + navLabel('services') + '</h3><a class="more" href="services.html">View all ' + ICON.arrow + '</a></div><div class="cp-list">' + procs.map(s => rowLink(procUrl(s), s.title, s.summary)).join('') + '</div></div>' +
      '</div></div></section>';
  }

  PAGES.conditions = function () {
    return sectionHead('conditions', 'Digestive, liver and colon conditions we diagnose and treat. Choose one to learn what it is and how we treat it.') +
      '<section class="section"><div class="container"><div class="conds">' + shown(D.conditions).map(c =>
        '<a class="cond" href="' + condUrl(c) + '" id="' + esc(c.id) + '"><h3>' + esc(c.name) + '</h3><p>' + inline(c.text) + '</p><span class="more">Learn more ' + ICON.arrow + '</span></a>').join('') + '</div>' +
      '<p class="muted" style="margin-top:20px">Looking for a procedure? See <a href="services.html">' + navLabel('services') + '</a>.</p></div></section>' +
      callBand();
  };

  const tickList = t => '<ul class="ticks">' + lines(t).map(x => '<li>' + ICON.check + '<span>' + inline(x) + '</span></li>').join('') + '</ul>';
  const block = (title, html) => html ? '<section class="detail-block"><h2>' + esc(title) + '</h2>' + html + '</section>' : '';
  function notFound(kind) {
    const key = kind === 'Condition' ? 'conditions' : 'services';
    return pageHead(kind + ' not found', 'It may have moved. [See all ' + navLabel(key) + '](' + NAV.find(n => n[0] === key)[1] + ').', crumbLink(key));
  }

  PAGES.condition = function () {
    const id = new URLSearchParams(location.search).get('id');
    const c = shown(D.conditions).find(x => x.id === id);
    if (!c) return notFound('Condition');
    document.title = c.name + ' · The GI Guy';
    const procs = (c.procedures || []).map(pid => shown(D.services).find(s => s.id === pid)).filter(Boolean);
    const others = shown(D.conditions).filter(x => x !== c);
    return pageHead(c.name, c.text, crumbLink('conditions') + ' / ' + esc(c.name)) +
      '<section class="section"><div class="container two-col wide-left"><article class="prose detail">' +
        block('What is it?', c.what ? md(c.what) : '') +
        block(c.causesTitle || 'Common causes', c.causes ? tickList(c.causes) : '') +
        block(c.symptomsTitle || 'Symptoms', c.symptoms ? tickList(c.symptoms) : '') +
        block('Diagnosis & treatment', c.treatment ? md(c.treatment) : '') +
        (c.when ? '<div class="card note"><h3>When to call us</h3>' + md(c.when) + '</div>' : '') +
      '</article><aside class="detail-side">' +
        (procs.length ? '<div class="card"><h3>Related services</h3><div class="cp-list">' + procs.map(s => rowLink(procUrl(s), s.title, s.summary)).join('') + '</div></div>' : '') +
        '<div class="card"><h3>Other conditions</h3><ul class="plain">' + others.slice(0, 8).map(o => '<li><a href="' + condUrl(o) + '">' + esc(o.name) + '</a></li>').join('') + '<li><a href="conditions.html">All ' + navLabel('conditions') + ' ' + ICON.arrow + '</a></li></ul></div>' +
      '</aside></div></section>' + callBand();
  };

  PAGES.procedure = function () {
    const id = new URLSearchParams(location.search).get('id');
    const s = shown(D.services).find(x => x.id === id);
    if (!s) return notFound('Procedure');
    document.title = s.title + ' · The GI Guy';
    const conds = shown(D.conditions).filter(c => (c.procedures || []).includes(s.id));
    const form = /colonoscopy|sigmoid/.test(s.id) ? shown(D.forms).find(f => /prep/.test(f.id)) : null;
    const ft = s.id === 'colonoscopy' && ftOn();
    return pageHead(s.title, s.summary, crumbLink('services') + ' / ' + esc(s.title)) +
      '<section class="section"><div class="container two-col wide-left"><article class="prose detail">' +
        block('What is it?', s.what ? md(s.what) : '') +
        block('Why it\'s done', s.why ? tickList(s.why) : (s.points ? tickList(s.points) : '')) +
        block('How to prepare', s.prep ? md(s.prep) : '') +
        block('What to expect', s.expect ? md(s.expect) : '') +
        block('Afterward', s.after ? md(s.after) : '') +
        (shown(D.videos).some(v => v.service === s.id) ? block('Watch', videoCards(shown(D.videos).filter(v => v.service === s.id))) : '') +
      '</article><aside class="detail-side">' +
        (ft ? '<a class="card quiz-promo ft-promo" href="fast-track-colonoscopy.html">' + ICON.clock + '<span><b>Positive stool test?</b><small>Fast-Track: colonoscopy usually in 7–14 days.</small></span>' + ICON.arrow + '</a>' : '') +
        (form ? '<a class="card doc" href="' + esc(safeUrl(form.file)) + '" target="_blank" rel="noopener">' + ICON.doc + '<span><b>' + esc(form.title) + '</b><em>Open PDF ' + ICON.arrow + '</em></span></a>' : '') +
        (conds.length ? '<div class="card"><h3>Conditions it helps with</h3><ul class="plain">' + conds.map(c => '<li><a href="' + condUrl(c) + '">' + esc(c.name) + '</a></li>').join('') + '</ul></div>' : '') +
      '</aside></div></section>' + callBand();
  };

  PAGES.patients = function () {
    const P = D.practice || {};
    const portal = '<a class="head-portal" href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">' + ICON.lock + esc(P.portalLabel || 'Patient Portal') + ' ' + ICON.arrow + '</a>';
    const head = '<div class="head-links">' + portal + klaraLink(P, 'head-portal') + '</div>';
    const vids = shown(D.videos);
    return sectionHead('patients', 'Forms, colonoscopy prep, instruction videos, insurance and answers to common questions.', head) +
      ftPromo() +
      (vids.length ? '<section class="section" id="videos"><div class="container"><h2>Instruction Videos</h2>' + videoCards(vids) + '</div></section>' : '') +
      '<section class="section alt"><div class="container"><h2>Forms & instructions</h2><div class="docs">' + shown(D.forms).map(f =>
        '<a class="card doc" id="' + esc(f.anchor || f.id) + '" href="' + esc(safeUrl(f.file)) + '" target="_blank" rel="noopener">' + ICON.doc +
        '<span><b>' + esc(f.title) + '</b><small>' + esc(f.text) + '</small><em>Open PDF ' + ICON.arrow + '</em></span></a>').join('') + '</div></div></section>' +
      '<section class="section"><div class="container two-col">' +
        '<div class="card"><h2>Appointments</h2><p>To schedule, reschedule or ask a question, call the office nearest you.</p>' +
          shown(D.locations).map(l => '<p class="icoline">' + ICON.phone + '<span><b>' + esc(l.name) + ':</b> <a href="' + tel(l.phone) + '">' + esc(l.phone) + '</a></span></p>').join('') +
          '<div class="hours-in-card">' + hoursHtml(P, 'h3') + '</div></div>' +
        '<div class="card"><h2>Insurance</h2><p>' + inline((D.about || {}).insurance) + '</p></div>' +
      '</div></section>' +
      '<section class="section"><div class="container"><div class="card note"><h2>Before you message us</h2><p>' + esc(P.emergencyNote) + '</p><p class="muted small">Social media pages are for general information only, and we can\'t give medical advice there. For a specific question, please call the office or use the Patient Portal.</p></div></div></section>' +
      '<section class="section alt"><div class="container narrow"><h2>Common questions</h2>' + faqHtml(D.faqs) + '</div></section>';
  };

  PAGES.learn = function () {
    const organs = D.organs || [];
    return sectionHead('learn', 'Patient education: how your digestive system works, your colon cancer risk, and articles on common procedures.') +
      '<section class="section"><div class="container">' +
        '<a class="card quiz-promo" href="risk-quiz.html">' + ICON.check + '<span><b>Are you at risk for colon cancer?</b><small>Take the 9-question quiz. It takes about a minute.</small></span>' + ICON.arrow + '</a>' +
      '</div></section>' +
      '<section class="section alt" id="digestive-system"><div class="container"><h2>Your digestive system</h2><p class="muted">Tap an organ to learn what it does.</p>' +
        '<div class="organs"><img src="img/digestive-system.png" alt="Diagram of the digestive system" loading="lazy" width="637" height="790">' +
        '<div><div class="organ-tabs" role="tablist">' + organs.map((o, i) => '<button type="button" role="tab" aria-selected="' + (i === 0) + '" data-organ="' + i + '">' + esc(o.name) + '</button>').join('') + '</div>' +
        '<div class="card organ-panel" id="organ-panel" role="tabpanel"></div></div></div>' +
      '</div></section>' +
      '<section class="section"><div class="container"><h2>Articles</h2><div class="cards">' + shown(D.articles).map(a =>
        '<a class="card article-card" href="article.html?id=' + encodeURIComponent(a.id) + '"><h3>' + esc(a.title) + '</h3><p class="muted">' + esc(a.summary) + '</p><span class="more">Read ' + ICON.arrow + '</span></a>').join('') +
        '<a class="card article-card" href="about.html#wellness"><h3>' + esc((D.about || {}).wellnessTitle) + '</h3><p class="muted">Our integrated approach to nutrition, lifestyle and doctor-approved wellness products.</p><span class="more">Read ' + ICON.arrow + '</span></a>' +
      '</div></div></section>';
  };
  function afterLearn() {
    const organs = D.organs || [];
    const panel = $('#organ-panel'); if (!panel) return;
    const pick = i => {
      panel.innerHTML = '<h3>' + esc(organs[i].name) + '</h3>' + md(organs[i].text);
      document.querySelectorAll('[data-organ]').forEach(b => b.setAttribute('aria-selected', String(Number(b.dataset.organ) === i)));
    };
    document.querySelector('.organ-tabs').addEventListener('click', e => { const b = e.target.closest('[data-organ]'); if (b) pick(Number(b.dataset.organ)); });
    if (organs.length) pick(0);
  }

  PAGES.article = function () {
    const id = new URLSearchParams(location.search).get('id');
    const a = shown(D.articles).find(x => x.id === id);
    if (!a) return pageHead('Article not found', 'It may have moved. [See all articles](learn.html).', crumbLink('learn'));
    document.title = a.title + ' · The GI Guy';
    const others = shown(D.articles).filter(x => x !== a);
    return pageHead(a.title, a.summary, crumbLink('learn') + ' / ' + esc(a.title)) +
      '<section class="section"><div class="container two-col wide-left"><article class="prose">' + md(a.body) + '</article>' +
      '<aside>' + (others.length ? '<div class="card"><h3>More to read</h3><ul class="plain">' + others.map(o => '<li><a href="article.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.title) + '</a></li>').join('') + '</ul></div>' : '') +
      '<div class="card" style="margin-top:16px"><h3>Questions?</h3><p>Call us at <a href="' + tel(D.practice.phone) + '">' + esc(D.practice.phone) + '</a>.</p></div></aside></div></section>';
  };

  PAGES.quiz = function () {
    const Q = D.quiz || {};
    document.title = Q.title + ' · The GI Guy';
    return pageHead(Q.title, Q.intro, crumbLink('learn') + ' / ' + esc(Q.title)) +
      '<section class="section"><div class="container narrow"><form class="quiz" id="quiz">' + (Q.questions || []).map((q, i) =>
        '<fieldset class="q"><legend>' + (i + 1) + '. ' + esc(q) + '</legend><div class="yn">' +
        '<label><input type="radio" name="q' + i + '" value="yes" required><span>Yes</span></label>' +
        '<label><input type="radio" name="q' + i + '" value="no"><span>No</span></label></div></fieldset>').join('') +
      '<button class="btn btn-primary" type="submit">See my result</button>' +
      '<div class="quiz-result" id="quiz-result" hidden></div></form>' +
      '<p class="muted small">This quiz is for education only and is not a diagnosis. Nothing you enter is sent anywhere.</p></div></section>';
  };
  function afterQuiz() {
    const f = $('#quiz'); if (!f) return;
    const Q = D.quiz || {};
    f.onsubmit = e => {
      e.preventDefault();
      const yes = Array.from(f.querySelectorAll('input[value="yes"]:checked')).length;
      const r = $('#quiz-result');
      r.hidden = false;
      r.className = 'quiz-result ' + (yes ? 'warn' : 'ok');
      r.innerHTML = '<h3>' + (yes ? 'Talk with us about screening' : 'Good news') + '</h3><p>' + inline(yes ? Q.yesResult : Q.noResult) + '</p>' +
        callOpts('on-light');
      r.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }

  PAGES.contact = function () {
    const P = D.practice || {};
    return sectionHead('contact', 'Two offices serving the Greater Raleigh area and surrounding communities.') +
      '<section class="section"><div class="container">' + locationCards(true) +
        '<div class="two-col" style="margin-top:24px"><div class="card hours">' + hoursHtml(P, 'h3') + (P.klaraUrl ? '<p style="margin-top:14px">' + klaraLink(P, 'btn btn-outline btn-sm') + '</p>' : '') + '</div>' +
        '<div class="card note"><p><b>In an emergency, call 911.</b> ' + esc(P.emergencyNote) + '</p><p class="muted small">We monitor our website and social media, but social media is for general information only and can\'t be used for medical advice. To protect your privacy, please call the office with questions about your care.</p></div></div>' +
      '</div></section>';
  };

  /* ---------------- title case ---------------- */
  const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via', 'with']);
  const KEEP_LOWER = new Set(['pylori']);   // species names stay lowercase
  function titleCase(str) {
    const words = str.split(/(\s+)/);
    const idx = words.map((w, i) => /\S/.test(w) ? i : -1).filter(i => i >= 0);
    const first = idx[0], last = idx[idx.length - 1];
    let afterBreak = true;
    return words.map((w, i) => {
      if (!/\S/.test(w)) return w;
      const core = w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '').toLowerCase();
      const keep = /[A-Z].*[A-Z]|[a-z][A-Z]|\d/.test(w) || /^[A-Z]\.$/.test(w) || KEEP_LOWER.has(core);   // EGD, FACG, H., 7–14, pylori
      let out = w;
      if (!keep) {
        if (SMALL.has(core) && i !== first && i !== last && !afterBreak) out = w.toLowerCase();
        else out = w.replace(/[A-Za-z]+/g, (m, off) => (off === 0 || /[-–(\/"“]/.test(w[off - 1])) ? m[0].toUpperCase() + m.slice(1) : m);
      }
      afterBreak = /[:?!—–·|]$/.test(w);
      return out;
    }).join('');
  }
  const TC_SEL = 'h1, h2, h3, .crumb, .cp-row b, .qcard b, .doc b, .quiz-promo b, .tile b';
  function applyTitleCase(root) {
    root.querySelectorAll(TC_SEL).forEach(el => {
      if (el.closest('.faq, blockquote, .hero-meet blockquote')) return;
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n; while ((n = walk.nextNode())) n.nodeValue = titleCase(n.nodeValue);
    });
  }

  /* ---------------- boot ---------------- */
  async function boot() {
    let draft = false;
    try {
      const res = await G.loadSite();
      D = res.data; draft = res.draft;
    } catch (err) {
      $('#app').innerHTML = '<p class="container loading">Sorry, the page didn\'t load. Please refresh, or call <a href="tel:+19195770085">(919) 577-0085</a>.</p>';
      return;
    }
    header();
    const render = PAGES[PAGE] || PAGES.home;
    $('#app').innerHTML = render();
    footer();
    applyTitleCase(document.body);
    document.title = titleCase(document.title);
    // Admin preview: keep ?draft=1 on links between pages so the unpublished version follows you.
    if (draft) document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href');
      if (/^[a-z0-9-]+\.html/i.test(h) && !/[?&]draft=/.test(h)) a.setAttribute('href', h.replace(/^([^?#]+)(\?[^#]*)?/, (m, p, q) => p + (q ? q + '&' : '?') + 'draft=1'));
    });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-yt]'); if (!b) return;
      b.outerHTML = '<iframe class="video-frame" src="https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&rel=0" title="Video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
    });
    document.querySelectorAll('[data-expand]').forEach(b => b.onclick = () => { document.getElementById(b.dataset.expand).classList.add('open'); b.remove(); });
    if (PAGE === 'learn') afterLearn();
    if (PAGE === 'quiz') afterQuiz();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView(), 0); }
  }
  boot();
})();
