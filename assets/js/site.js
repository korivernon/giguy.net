/* Renders every public page from data/site.json. Each page is a shell with <body data-page="…">. */
(function () {
  'use strict';
  const G = window.GG;
  const { esc, inline, md, lines, safeUrl, tel } = G;
  const $ = (s, r) => (r || document).querySelector(s);
  const shown = list => (list || []).filter(x => !x.hidden);

  const NAV = [
    ['home', 'index.html', 'Home'],
    ['about', 'about.html', 'About'],
    ['team', 'team.html', 'Our Team'],
    ['services', 'services.html', 'Services'],
    ['patients', 'patients.html', 'Patients'],
    ['learn', 'learn.html', 'Learn'],
    ['contact', 'contact.html', 'Contact'],
  ];
  const PAGE = document.body.dataset.page;
  const navKey = PAGE === 'article' || PAGE === 'quiz' ? 'learn' : PAGE;

  const ICON = {
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.1.8-1.2-4.5-2.7z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zM9 6a3 3 0 0 1 6 0v2H9zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9zM8 13h8v2H8zm0 4h8v2H8z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-1.4 1.4 5.6 5.6H4v2h12.2l-5.6 5.6L12 20l8-8z"/></svg>',
    menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>',
    scope: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a3 3 0 0 0-1 5.83V15a5 5 0 0 1-10 0v-.1A6 6 0 0 0 13 9V3h-3v2h1v4a4 4 0 0 1-8 0V5h1V3H1v6a6 6 0 0 0 5 5.9V15a7 7 0 0 0 14 0v-1.17A3 3 0 0 0 19 8zm0 4a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35 10.55 20C5.4 15.36 2 12.28 2 8.5A5.4 5.4 0 0 1 7.5 3 6 6 0 0 1 12 5.09 6 6 0 0 1 16.5 3 5.4 5.4 0 0 1 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 5c-1.1-.35-2.3-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5z"/></svg>',
  };
  const HL_ICONS = ['scope', 'check', 'heart'];

  let D;

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
    const hoursShort = lines(P.hours).slice(0, 2).join(' · ');
    $('#site-header').innerHTML = bannerHtml() +
      '<div class="topbar"><div class="container topbar-in">' +
        '<span class="tb-item">' + ICON.clock + esc(hoursShort) + '</span>' +
        '<span class="tb-phones">' + locs.map(l => '<a href="' + tel(l.phone) + '">' + ICON.phone + esc(l.name) + ' ' + esc(l.phone) + '</a>').join('') + '</span>' +
      '</div></div>' +
      '<header class="header"><div class="container header-in">' +
        '<a class="logo" href="index.html" aria-label="' + esc(P.name) + ', home"><img src="img/logos/logo.png" alt="The GI Guy" width="180" height="72">' +
          '<span class="logo-text"><b>' + esc(P.doctor) + '</b><small>' + esc(P.tagline) + '</small></span></a>' +
        '<nav class="nav" id="nav" aria-label="Main">' +
          NAV.map(n => '<a href="' + n[1] + '"' + (n[0] === navKey ? ' aria-current="page"' : '') + '>' + n[2] + '</a>').join('') +
          '<a class="btn btn-accent nav-portal" href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">' + ICON.lock + esc(P.portalLabel || 'Patient Portal') + '</a>' +
          '<a class="btn btn-outline nav-call" href="' + tel(P.phone) + '">' + ICON.phone + 'Call ' + esc(P.phone) + '</a>' +
        '</nav>' +
        '<a class="btn btn-accent portal-desk" href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">' + ICON.lock + esc(P.portalLabel || 'Patient Portal') + '</a>' +
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

  function footer() {
    const P = D.practice || {};
    const year = new Date().getFullYear();
    $('#site-footer').innerHTML = '<footer class="footer"><div class="container">' +
      '<div class="foot-grid">' +
        '<div class="foot-brand"><img src="img/logos/footer-logo.png" alt="The GI Guy" width="150" height="60" loading="lazy">' +
          '<p>' + esc(P.footerTagline) + '</p>' +
          '<div class="social">' + (D.social || []).filter(s => s.url).map(s => '<a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener">' + esc(s.label) + '</a>').join('') + '</div></div>' +
        '<div><h4>Visit</h4>' + shown(D.locations).map(l =>
          '<p><b>' + esc(l.name) + '</b><br>' + esc(l.address).replace(/\n/g, '<br>') + '<br><a href="' + tel(l.phone) + '">' + esc(l.phone) + '</a> · Fax ' + esc(l.fax) + '</p>').join('') + '</div>' +
        '<div><h4>Hours</h4><p>' + lines(P.hours).map(esc).join('<br>') + '</p>' +
          '<h4>Patients</h4><p><a href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">' + esc(P.portalLabel || 'Patient Portal') + '</a><br><a href="patients.html#forms">Patient forms</a><br><a href="patients.html#prep">Colonoscopy prep</a></p></div>' +
        '<div><h4>Explore</h4><p>' + NAV.slice(1).map(n => '<a href="' + n[1] + '">' + n[2] + '</a>').join('<br>') + '<br><a href="risk-quiz.html">Colon cancer risk quiz</a></p></div>' +
      '</div>' +
      (D.partners && D.partners.length ? '<div class="partners">' + D.partners.map(p => '<img src="' + esc(p.logo) + '" alt="' + esc(p.name) + '" loading="lazy">').join('') + '</div>' : '') +
      '<p class="fine">' + esc(P.emergencyNote) + ' ' + esc(P.disclaimer) + '</p>' +
      '<p class="fine">© ' + year + ' ' + esc(P.doctor) + ' · ' + esc(P.name) + '</p>' +
    '</div></footer>';
  }

  function pageHead(title, sub, crumb) {
    return '<section class="page-head"><div class="container">' +
      (crumb ? '<p class="crumb"><a href="index.html">Home</a> / ' + crumb + '</p>' : '') +
      '<h1>' + esc(title) + '</h1>' + (sub ? '<p class="lead">' + inline(sub) + '</p>' : '') + '</div></section>';
  }

  function callBand() {
    const P = D.practice || {};
    return '<section class="cta"><div class="container cta-in">' +
      '<div><h2>Ready to schedule?</h2><p>Call either office and our staff will find a time that works for you.</p></div>' +
      '<div class="cta-acts">' + shown(D.locations).map(l => '<a class="btn btn-light" href="' + tel(l.phone) + '">' + ICON.phone + esc(l.name) + ' ' + esc(l.phone) + '</a>').join('') +
        '<a class="btn btn-accent" href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">' + ICON.lock + esc(P.portalLabel || 'Patient Portal') + '</a></div>' +
    '</div></section>';
  }

  function faqHtml(list) {
    return '<div class="faq">' + (list || []).map(f => '<details><summary>' + esc(f.q) + '</summary><div class="faq-a">' + md(f.a) + '</div></details>').join('') + '</div>';
  }

  function serviceCards(list) {
    return '<div class="cards">' + list.map(s =>
      '<article class="card svc" id="' + esc(s.id) + '"><h3>' + esc(s.title) + '</h3><p class="muted">' + esc(s.summary) + '</p>' +
      (s.points ? '<ul class="ticks">' + lines(s.points).map(p => '<li>' + ICON.check + '<span>' + inline(p) + '</span></li>').join('') + '</ul>' : '') +
      '</article>').join('') + '</div>';
  }

  function mapUrl(l) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(l.mapQuery || l.address.replace(/\n/g, ', ')); }

  function locationCards(withMap) {
    return '<div class="locs">' + shown(D.locations).map(l =>
      '<article class="card loc">' +
        (withMap ? '<iframe class="map" title="Map of the ' + esc(l.name) + ' office" src="https://maps.google.com/maps?q=' + encodeURIComponent(l.mapQuery || l.address) + '&z=15&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>' : '') +
        '<div class="loc-body"><h3>' + esc(l.name) + ' office</h3>' +
        '<p class="icoline">' + ICON.pin + '<span>' + esc(l.address).replace(/\n/g, '<br>') + '</span></p>' +
        '<p class="icoline">' + ICON.phone + '<span><a href="' + tel(l.phone) + '">' + esc(l.phone) + '</a> · Fax ' + esc(l.fax) + '</span></p>' +
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
          '<a class="btn btn-outline" href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">' + ICON.lock + esc(P.portalLabel || 'Patient Portal') + '</a></div></div>' +
        '<figure class="hero-photo"><img src="' + esc(Dr.photo) + '" alt="Dr. Kurt Vernon, The GI Guy" width="481" height="310">' +
          '<figcaption class="hero-meet"><p class="eyebrow">Meet the GI Guy</p><h2>' + esc(Dr.name) + '</h2>' +
          '<blockquote>“' + esc(Dr.quote) + '”</blockquote>' +
          '<a class="btn btn-primary btn-sm" href="team.html">Meet our team ' + ICON.arrow + '</a></figcaption></figure>' +
      '</div></section>' +
      '<section class="quick"><div class="container quick-grid">' +
        '<a class="qcard" href="contact.html">' + ICON.pin + '<span><b>Locations & hours</b><small>Fuquay-Varina and Dunn</small></span></a>' +
        (forms[0] ? '<a class="qcard" href="patients.html#' + esc(forms[0].anchor || forms[0].id) + '">' + ICON.doc + '<span><b>Patient forms</b><small>Fill out before your visit</small></span></a>' : '') +
        (forms[1] ? '<a class="qcard" href="patients.html#' + esc(forms[1].anchor || forms[1].id) + '">' + ICON.doc + '<span><b>Colonoscopy prep</b><small>Step-by-step instructions</small></span></a>' : '') +
        '<a class="qcard" href="risk-quiz.html">' + ICON.check + '<span><b>Are you at risk?</b><small>Quick colon cancer quiz</small></span></a>' +
      '</div></section>' +
      '<section class="section"><div class="container"><div class="hl-grid">' + (H.highlights || []).map((h, i) =>
        '<div class="hl"><span class="hl-ico">' + ICON[HL_ICONS[i % 3]] + '</span><h3>' + esc(h.title) + '</h3><p>' + inline(h.text) + '</p></div>').join('') + '</div></div></section>' +
      '<section class="section alt"><div class="container">' +
        '<div class="sec-head"><div><p class="eyebrow">Services</p><h2>How we can help</h2></div><a class="more" href="services.html">All services ' + ICON.arrow + '</a></div>' +
        '<div class="tiles">' + shown(D.services).slice(0, 6).map(s => '<a class="tile" href="services.html#' + esc(s.id) + '"><b>' + esc(s.title) + '</b><span>' + esc(s.summary) + '</span></a>').join('') + '</div>' +
      '</div></section>' +
      (H.recognition ? '<section class="recog"><div class="container recog-in">' + ICON.check + '<p>' + inline(H.recognition) + (H.recognitionLink ? ' <a href="' + esc(safeUrl(H.recognitionLink)) + '">Read more</a>' : '') + '</p></div></section>' : '') +
      '<section class="section"><div class="container two-col">' +
        '<div><p class="eyebrow">FAQs</p><h2>Your questions, answered</h2>' + faqHtml(D.faqs) + '</div>' +
        '<div><p class="eyebrow">Visit us</p><h2>Two convenient offices</h2>' + locationCards(false) +
          '<div class="card hours"><h3>' + ICON.clock + 'Office hours</h3><p>' + lines(P.hours).map(esc).join('<br>') + '</p></div></div>' +
      '</div></section>' + callBand();
  };

  PAGES.about = function () {
    const A = D.about || {};
    return pageHead(A.title, '', 'About') +
      '<section class="section"><div class="container two-col wide-left">' +
        '<div class="prose">' + md(A.text) + '</div>' +
        '<aside class="card treats"><h3>Conditions we treat</h3><ul class="chips">' + (D.conditions || []).map(c => '<li>' + esc(c) + '</li>').join('') + '</ul></aside>' +
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
    return pageHead('Meet our team', 'Personal care from a team that knows you by name.', 'Our Team') +
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
    return pageHead('Services', 'Expert diagnosis and treatment for digestive conditions, using the latest technology, including FUSE™ full-spectrum endoscopy.', 'Services') +
      '<section class="section"><div class="container">' + serviceCards(shown(D.services)) + '</div></section>' +
      '<section class="section alt"><div class="container"><h2>Conditions we treat</h2><ul class="chips big">' + (D.conditions || []).map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' +
      '<p class="muted" style="margin-top:20px">Has Dr. Vernon recommended a procedure? See <a href="patients.html#prep">preparation instructions</a> or call us with any questions.</p></div></section>' +
      callBand();
  };

  PAGES.patients = function () {
    const P = D.practice || {};
    return pageHead('For patients', 'Everything you need before and after your visit.', 'Patients') +
      '<section class="section"><div class="container two-col">' +
        '<div class="card portal-card"><span class="hl-ico">' + ICON.lock + '</span><h2>Patient Portal</h2><p>View your health information, message the office, and manage your care online. The portal opens on our secure partner site.</p>' +
          '<a class="btn btn-accent" href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">Open the Patient Portal ' + ICON.arrow + '</a></div>' +
        '<div class="card"><span class="hl-ico">' + ICON.phone + '</span><h2>Appointments</h2><p>To schedule, reschedule or ask a question, call the office nearest you.</p>' +
          shown(D.locations).map(l => '<p class="icoline">' + ICON.phone + '<span><b>' + esc(l.name) + ':</b> <a href="' + tel(l.phone) + '">' + esc(l.phone) + '</a></span></p>').join('') +
          '<p class="muted small">' + lines(P.hours).map(esc).join(' · ') + '</p></div>' +
      '</div></section>' +
      '<section class="section alt"><div class="container"><h2>Forms & instructions</h2><div class="docs">' + shown(D.forms).map(f =>
        '<a class="card doc" id="' + esc(f.anchor || f.id) + '" href="' + esc(safeUrl(f.file)) + '" target="_blank" rel="noopener">' + ICON.doc +
        '<span><b>' + esc(f.title) + '</b><small>' + esc(f.text) + '</small><em>Open PDF ' + ICON.arrow + '</em></span></a>').join('') + '</div></div></section>' +
      '<section class="section"><div class="container two-col">' +
        '<div class="card"><h2>Insurance</h2><p>' + inline((D.about || {}).insurance) + '</p></div>' +
        '<div class="card note"><h2>Before you message us</h2><p>' + esc(P.emergencyNote) + '</p><p class="muted small">Social media pages are for general information only, and we can\'t give medical advice there. For a specific question, please call the office or use the Patient Portal.</p></div>' +
      '</div></section>' +
      '<section class="section alt"><div class="container narrow"><h2>Common questions</h2>' + faqHtml(D.faqs) + '</div></section>';
  };

  PAGES.learn = function () {
    const organs = D.organs || [];
    return pageHead('Patient education', 'Learn how your digestive system works, check your colon cancer risk, and read about common procedures.', 'Learn') +
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
    if (!a) return pageHead('Article not found', 'It may have moved. [See all articles](learn.html).', '<a href="learn.html">Learn</a>');
    document.title = a.title + ' · The GI Guy';
    const others = shown(D.articles).filter(x => x !== a);
    return pageHead(a.title, a.summary, '<a href="learn.html">Learn</a>') +
      '<section class="section"><div class="container two-col wide-left"><article class="prose">' + md(a.body) + '</article>' +
      '<aside>' + (others.length ? '<div class="card"><h3>More to read</h3><ul class="plain">' + others.map(o => '<li><a href="article.html?id=' + encodeURIComponent(o.id) + '">' + esc(o.title) + '</a></li>').join('') + '</ul></div>' : '') +
      '<div class="card" style="margin-top:16px"><h3>Questions?</h3><p>Call us at <a href="' + tel(D.practice.phone) + '">' + esc(D.practice.phone) + '</a>.</p></div></aside></div></section>';
  };

  PAGES.quiz = function () {
    const Q = D.quiz || {};
    return pageHead(Q.title, Q.intro, '<a href="learn.html">Learn</a>') +
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
        '<p>' + shown(D.locations).map(l => '<a class="btn btn-primary btn-sm" href="' + tel(l.phone) + '">' + ICON.phone + esc(l.name) + ' ' + esc(l.phone) + '</a>').join(' ') + '</p>';
      r.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  }

  PAGES.contact = function () {
    const P = D.practice || {};
    return pageHead('Contact & locations', 'Two offices serving the Greater Raleigh area and surrounding communities.', 'Contact') +
      '<section class="section"><div class="container">' + locationCards(true) +
        '<div class="two-col" style="margin-top:24px"><div class="card hours"><h3>' + ICON.clock + 'Office hours</h3><p>' + lines(P.hours).map(esc).join('<br>') + '</p></div>' +
        '<div class="card portal-card"><h3>' + ICON.lock + esc(P.portalLabel || 'Patient Portal') + '</h3><p>Message the office, see results and manage your care online.</p><a class="btn btn-accent btn-sm" href="' + esc(safeUrl(P.portalUrl)) + '" target="_blank" rel="noopener">Open the portal ' + ICON.arrow + '</a></div></div>' +
        '<div class="card note" style="margin-top:24px"><p><b>In an emergency, call 911.</b> ' + esc(P.emergencyNote) + '</p><p class="muted small">We monitor our website, portal and social media, but social media is for general information only and can\'t be used for medical advice. To protect your privacy, please call the office or use the portal for questions about your care.</p></div>' +
      '</div></section>';
  };

  /* ---------------- boot ---------------- */
  async function boot() {
    try {
      const res = await G.loadSite();
      D = res.data;
    } catch (err) {
      $('#app').innerHTML = '<p class="container loading">Sorry, the page didn\'t load. Please refresh, or call <a href="tel:+19195770085">(919) 577-0085</a>.</p>';
      return;
    }
    header();
    const render = PAGES[PAGE] || PAGES.home;
    $('#app').innerHTML = render();
    footer();
    if (PAGE === 'learn') afterLearn();
    if (PAGE === 'quiz') afterQuiz();
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(() => t.scrollIntoView(), 0); }
  }
  boot();
})();
