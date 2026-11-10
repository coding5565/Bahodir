(function () {
  'use strict';

  var root = document.documentElement;
  var page = root.dataset.page;
  var SITE = window.SITE || { links: {} };
  var PROJECTS = window.PROJECTS || [];
  var I18N = window.I18N || { en: {} };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var lang = root.lang === 'uz' ? 'uz' : 'en';
  var lenis = null;

  /* ---------- Helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function store(type, key, value) {
    try {
      var s = window[type];
      if (value === undefined) return s.getItem(key);
      if (value === null) s.removeItem(key); else s.setItem(key, value);
    } catch (e) { return null; }
    return null;
  }

  function t(key) {
    var dict = I18N[lang] || {};
    return dict[key] !== undefined ? dict[key] : (I18N.en || {})[key];
  }

  // Localised data field: a string or { en, uz }
  function L(field) {
    if (field == null) return '';
    if (typeof field === 'string') return field;
    return field[lang] || field.en || '';
  }

  function fmt(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }

  function esc(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function initials(title) {
    var words = String(title).trim().split(/\s+/);
    if (words.length > 1 && /^\d+$/.test(words[words.length - 1])) return words[words.length - 1];
    return words.map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
  }

  /* ---------- Language ---------- */
  function applyI18n() {
    root.lang = lang;
    $$('[data-i18n]').forEach(function (el) {
      var v = t(el.dataset.i18n);
      if (typeof v === 'string') el.textContent = v;
    });
    $$('[data-i18n-html]').forEach(function (el) {
      var v = t(el.dataset.i18nHtml);
      if (typeof v === 'string') el.innerHTML = v;
    });
    $$('[data-i18n-attr]').forEach(function (el) {
      el.dataset.i18nAttr.split(';').forEach(function (pair) {
        var parts = pair.split(':');
        var v = t(parts[1]);
        if (typeof v === 'string') el.setAttribute(parts[0], v);
      });
    });
    $$('[data-lang]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    });

    if (page === 'home') {
      document.title = t('meta.title');
      var desc = $('meta[name="description"]');
      if (desc) desc.setAttribute('content', t('meta.description'));
    }

    var roles = $('[data-roles]');
    if (roles) {
      roles.innerHTML = t('hero.roles').map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');
    }
  }

  function setLang(next) {
    if (next === lang) return;
    store('localStorage', 'br-lang', next);
    var saved = store('localStorage', 'br-lang') === next;
    var url = new URL(window.location.href);
    var hadParam = url.searchParams.has('lang');
    // Storage blocked: carry the choice in the URL instead
    if (saved) url.searchParams.delete('lang'); else url.searchParams.set('lang', next);
    leavePage(function () {
      if (hadParam || !saved) window.location.replace(url.toString());
      else window.location.reload();
    });
  }

  /* ---------- Rendering ---------- */
  function placeholderHTML(project) {
    return '<div class="ph" style="--c:' + esc(project.color || '#FF6A1F') + '">' +
      '<span class="ph-mark" aria-hidden="true">' + esc(initials(L(project.title))) + '</span></div>';
  }

  function mediaHTML(src, alt, project, opts) {
    opts = opts || {};
    var inner = src
      ? '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="' + (opts.eager ? 'eager' : 'lazy') + '" decoding="async">'
      : placeholderHTML(project);
    return '<div class="media-inner"><div class="media-zoom">' + inner + '</div></div>';
  }

  // Swap broken images for the placeholder artwork
  function guardImages(scope, project) {
    $$('img', scope).forEach(function (img) {
      function fail() {
        var zoom = img.parentNode;
        if (zoom) zoom.innerHTML = placeholderHTML(project);
      }
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fail();
      else img.addEventListener('error', fail, { once: true });
    });
  }

  function projectUrl(p) {
    return 'project.html?p=' + encodeURIComponent(p.slug);
  }

  function renderLinks() {
    var links = SITE.links || {};
    $$('[data-link]').forEach(function (a) {
      var href = links[a.dataset.link];
      if (href) a.href = href;
    });
    var year = $('[data-year]');
    if (year) year.textContent = String(new Date().getFullYear());
    $$('[data-available]').forEach(function (el) { el.hidden = !SITE.available; });
  }

  function renderMarquee() {
    var track = $('[data-marquee]');
    if (!track) return;
    var star = '<svg class="marquee-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.6 6.6 5.4 11.4 12 12-6.6.6-11.4 5.4-12 12-.6-6.6-5.4-11.4-12-12C6.6 11.4 11.4 6.6 12 0z"/></svg>';
    var group = '<div class="marquee-group">' + t('marquee').map(function (w) {
      return '<span class="marquee-item">' + esc(w) + star + '</span>';
    }).join('') + '</div>';
    // 8 copies = two identical halves for a seamless translateX(-50%) loop, wide enough for ~4500px screens
    track.innerHTML = new Array(9).join(group);
  }

  function renderWorks() {
    var grid = $('[data-works]');
    if (!grid) return;
    grid.innerHTML = PROJECTS.map(function (p, i) {
      var title = L(p.title);
      return '<article class="work-card">' +
        '<a class="work-link" href="' + projectUrl(p) + '" data-cursor>' +
        // Empty alt: the visible title already names the link
        '<div class="work-media" data-reveal-media>' + mediaHTML(p.cover, '', p) + '</div>' +
        '<div class="work-info">' +
        '<span class="work-index">' + pad(i + 1) + '</span>' +
        '<h3 class="work-title"><span class="work-title-text">' + esc(title) + '</span></h3>' +
        '<p class="work-meta">' + esc(L(p.category)) + ' · ' + esc(p.year || '') + '</p>' +
        '</div></a></article>';
    }).join('');
    $$('.work-card', grid).forEach(function (card, i) { guardImages(card, PROJECTS[i]); });
    var count = $('[data-works-count]');
    if (count) count.textContent = pad(PROJECTS.length);
  }

  // Thumb for the swipeable works list on phones: width = visible share, moves with scroll
  function setupWorksProgress() {
    var grid = $('[data-works]');
    var bar = $('[data-works-progress]');
    if (!grid || !bar) return;
    function update() {
      var total = grid.scrollWidth;
      var frac = total ? Math.min(1, grid.clientWidth / total) : 1;
      var max = total - grid.clientWidth;
      var p = max > 0 ? grid.scrollLeft / max : 0;
      bar.style.width = (frac * 100) + '%';
      bar.style.transform = 'translateX(' + (frac < 1 ? p * (1 - frac) / frac * 100 : 0) + '%)';
    }
    grid.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  function renderStats() {
    var box = $('[data-stats]');
    if (!box || !SITE.stats || !SITE.stats.length) return;
    box.innerHTML = SITE.stats.map(function (s) {
      return '<div class="stat"><dt>' + esc(L(s.label)) + '</dt>' +
        '<dd><span data-count="' + Number(s.value) + '">' + Number(s.value) + '</span><span>' + esc(s.suffix || '') + '</span></dd></div>';
    }).join('');
    box.hidden = false;
  }

  function renderProject() {
    var slug = new URLSearchParams(window.location.search).get('p');
    var index = -1;
    PROJECTS.some(function (p, i) { if (p.slug === slug) { index = i; return true; } return false; });
    if (index === -1) {
      window.location.replace('index.html#work');
      return false;
    }
    var p = PROJECTS[index];
    var title = L(p.title);
    document.title = title + ' — Raxmatov Bahodirjon';
    var desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', L(p.summary));

    $('[data-p="category"]').textContent = L(p.category);
    $('[data-p="title"]').textContent = title;
    $('[data-p="summary"]').textContent = L(p.summary);
    $('[data-p="client"]').textContent = L(p.client) || '—';
    $('[data-p="year"]').textContent = p.year || '—';
    $('[data-p="role"]').textContent = L(p.role) || '—';
    $('[data-p="services"]').textContent = L(p.services) || '—';
    $('[data-p="challenge"]').textContent = L(p.challenge);
    $('[data-p="solution"]').textContent = L(p.solution);

    var cover = $('[data-p="cover"]');
    cover.innerHTML = mediaHTML(p.cover, fmt(t('project.coverAlt'), { title: title }), p, { eager: true });
    guardImages(cover, p);

    var images = (p.images && p.images.length) ? p.images : [null, null, null];
    var gallery = $('[data-p="gallery"]');
    gallery.innerHTML = images.map(function (src, i) {
      var full = i % 3 === 0;
      return '<figure class="g-item' + (full ? ' is-full' : '') + '" data-reveal-media>' +
        mediaHTML(src, fmt(t('project.imageAlt'), { title: title, n: i + 1 }), p) + '</figure>';
    }).join('');
    guardImages(gallery, p);

    var next = PROJECTS[(index + 1) % PROJECTS.length];
    var nextLink = $('[data-p="next"]');
    nextLink.href = projectUrl(next);
    $('[data-p="next-title"]').textContent = L(next.title);
    return true;
  }

  /* ---------- UI (works without GSAP) ---------- */
  var menuBtn = $('.menu-btn');

  function setMenu(open) {
    if (!menuBtn) return;
    root.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    var label = $('.menu-btn-label', menuBtn);
    if (label) label.textContent = t(open ? 'menu.close' : 'menu.open');
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    // Keep Tab and screen readers inside the open menu
    ['#main', '.site-footer'].forEach(function (s) {
      var el = $(s);
      if (el) el.inert = open;
    });
    if (open) {
      var first = $('#mobile-menu a');
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 300);
    }
  }

  function scrollToTarget(target) {
    var header = $('.site-header');
    if (header) header.classList.remove('is-hidden');
    if (lenis) {
      lenis.scrollTo(target, { duration: 1.4, offset: target === 0 ? 0 : -10 });
    } else if (target === 0) {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    } else {
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function setupUI() {
    $$('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.dataset.lang); });
    });

    if (menuBtn) {
      menuBtn.addEventListener('click', function () {
        setMenu(!root.classList.contains('menu-open'));
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && root.classList.contains('menu-open')) {
          setMenu(false);
          menuBtn.focus();
        }
      });
      window.matchMedia('(min-width: 1101px)').addEventListener('change', function (e) {
        if (e.matches) setMenu(false);
      });
    }

    // In-page anchors
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      var target = id === '#top' || id === '#' ? 0 : $(id);
      if (target == null) return;
      e.preventDefault();
      if (root.classList.contains('menu-open')) setMenu(false);
      scrollToTarget(target);
      // Move focus with the scroll so keyboard users continue from the target
      var dest = target === 0 ? $('#main') : target;
      if (dest) {
        if (!dest.hasAttribute('tabindex')) dest.setAttribute('tabindex', '-1');
        dest.focus({ preventScroll: true });
      }
    });

    // Local time
    var clock = $('[data-clock]');
    if (clock) {
      var formatter;
      try {
        formatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: SITE.timeZone || 'Asia/Tashkent' });
      } catch (e) {
        formatter = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
      }
      var tick = function () { clock.textContent = formatter.format(new Date()) + ' GMT+5'; };
      tick();
      setInterval(tick, 15000);
    }
  }

  /* ---------- Page transitions ---------- */
  var transitionEl = $('.page-transition');
  var hasGsap = !!(window.gsap && window.ScrollTrigger && window.SplitText && window.CustomEase);

  function leavePage(go) {
    if (!hasGsap || reduceMotion || !transitionEl) { go(); return; }
    store('sessionStorage', 'br-pt', '1');
    if (lenis) lenis.stop();
    // y: 0 clears the px offset GSAP parses from the CSS translateY(100%)
    gsap.fromTo(transitionEl, { y: 0, yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: 'expo.inOut', onComplete: go });
  }

  function setupLinkTransitions() {
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href]');
      if (!a || a.target || a.hasAttribute('download')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto|tel):/i.test(href)) return;
      var url = new URL(a.href, window.location.href);
      if (url.protocol !== window.location.protocol || url.host !== window.location.host) return;
      // Same document, only the hash differs: let the anchor handler deal with it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      leavePage(function () { window.location.href = url.href; });
    });

    // Restored from the back/forward cache: make sure the overlay is gone
    window.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      store('sessionStorage', 'br-pt', null);
      root.classList.remove('pt-enter');
      if (root.classList.contains('menu-open')) setMenu(false);
      if (hasGsap && transitionEl) gsap.set(transitionEl, { y: 0, yPercent: 100 });
      if (lenis) lenis.start();
    });
  }

  function enterPage() {
    store('sessionStorage', 'br-pt', null);
    root.classList.remove('pt-enter');
    if (!transitionEl) return;
    gsap.fromTo(transitionEl, { y: 0, yPercent: 0 }, { yPercent: -100, duration: 0.9, delay: 0.05, ease: 'expo.inOut' });
  }

  /* ---------- Boot ---------- */
  applyI18n();
  renderLinks();
  if (page === 'home') {
    renderMarquee();
    renderWorks();
    setupWorksProgress();
    renderStats();
  } else if (page === 'project') {
    if (!renderProject()) return;
  }
  setupUI();
  setupLinkTransitions();

  // Static path: no GSAP, reduced motion, or the inline 5 s safety timer already revealed the page
  if (!hasGsap || reduceMotion || !root.classList.contains('js')) {
    window.__brReady = true;
    root.classList.remove('js', 'is-loading', 'pt-enter');
    store('sessionStorage', 'br-pt', null);
    if (page === 'home') store('sessionStorage', 'br-loaded', '1');
    return;
  }

  window.__brReady = true;
  gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
  CustomEase.create('reveal', '0.16, 1, 0.3, 1');
  gsap.defaults({ ease: 'reveal', duration: 1 });

  var fontsReady = document.fonts && document.fonts.ready
    ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 2500); })])
    : Promise.resolve();

  fontsReady.then(start);

  function start() {
    var intro;
    try {
      init();
    } catch (err) {
      console.error(err);
      bail();
    }

    // Recover from any init error: show everything, drop the loader/overlay
    function bail() {
      try {
        if (intro) intro.progress(1);
        gsap.set('[data-intro]', { opacity: 1 });
        if (transitionEl) gsap.set(transitionEl, { y: 0, yPercent: 100 });
      } catch (e) { /* nothing else to do */ }
      var pre = $('.preloader');
      if (pre) pre.remove();
      root.classList.remove('js', 'is-loading', 'pt-enter');
      store('sessionStorage', 'br-pt', null);
      if (lenis) lenis.start();
    }

    function init() {
      setupLenis();
      setupHeader();

      intro = page === 'home' ? heroIntro() : projectIntro();
      setupReveals();
      if (page === 'home') {
        setupHeroScroll();
        setupRoles();
        setupMarquee();
        setupAbout();
        setupServices();
        setupContact();
      }
      if (finePointer) {
        setupCursor();
        setupMagnetic();
      }

      if (root.classList.contains('is-loading') && page === 'home') {
        runPreloader().then(function () { intro.play(); });
      } else if (root.classList.contains('pt-enter')) {
        enterPage();
        gsap.delayedCall(0.35, function () { intro.play(); });
      } else {
        root.classList.remove('is-loading');
        intro.play();
      }

      window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    }
  }

  /* ---------- Smooth scroll ---------- */
  function setupLenis() {
    if (typeof window.Lenis !== 'function') return;
    lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    if (root.classList.contains('is-loading') || root.classList.contains('menu-open')) lenis.stop();
  }

  /* ---------- Header: hide on scroll down, show on scroll up ---------- */
  function setupHeader() {
    var header = $('.site-header');
    if (!header) return;
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: function (self) {
        var y = self.scroll();
        header.classList.toggle('is-scrolled', y > 40);
        if (root.classList.contains('menu-open')) return;
        if (self.direction === 1 && y > 200) header.classList.add('is-hidden');
        else if (self.direction === -1) header.classList.remove('is-hidden');
      }
    });
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
  }

  /* ---------- Preloader ---------- */
  function runPreloader() {
    return new Promise(function (resolve) {
      var pre = $('.preloader');
      if (!pre) { root.classList.remove('is-loading'); resolve(); return; }
      var count = $('[data-loader-count]', pre);
      var letters = $$('.preloader-mark span', pre);
      var meta = $$('.preloader-meta span', pre);
      var bar = $('.preloader-bar', pre);
      var progress = { v: 0 };
      var loaded = document.readyState === 'complete'
        ? Promise.resolve()
        : Promise.race([
          new Promise(function (r) { window.addEventListener('load', r, { once: true }); }),
          new Promise(function (r) { setTimeout(r, 3500); })
        ]);

      var tl = gsap.timeline({
        onComplete: function () {
          pre.remove();
          store('sessionStorage', 'br-loaded', '1');
        }
      });

      tl.from(letters, { yPercent: 110, stagger: 0.08, duration: 0.9 })
        .from(meta, { autoAlpha: 0, y: 10, stagger: 0.1, duration: 0.8 }, 0.1)
        .to(progress, {
          v: 100, duration: 1.3, ease: 'power2.inOut',
          onUpdate: function () { count.textContent = Math.round(progress.v); }
        }, 0)
        .to(bar, { scaleX: 1, duration: 1.3, ease: 'power2.inOut' }, 0)
        .addPause(1.3, function () { loaded.then(function () { tl.play(); }); })
        .to(letters, { yPercent: -110, stagger: 0.05, duration: 0.6, ease: 'power3.in' }, 1.35)
        .to([count, meta], { autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, '<')
        .to(pre, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'expo.inOut' }, '>-0.15')
        .add(function () {
          root.classList.remove('is-loading');
          if (lenis) lenis.start();
          resolve();
        }, '<0.35');
    });
  }

  /* ---------- Entrance timelines ---------- */
  function heroIntro() {
    var tl = gsap.timeline({ paused: true });
    // Split the h1 itself so SplitText's aria-label lands on the heading
    var chars = SplitText.create('.hero-name', { type: 'chars' }).chars;
    var leadSplit = SplitText.create('.hero-lead', { type: 'lines', mask: 'lines', aria: 'none' });
    var lead = leadSplit.lines;

    tl.set('[data-intro]', { opacity: 1 })
      .from('.site-header > *', { yPercent: -60, opacity: 0, stagger: 0.06, duration: 0.9 }, 0.3)
      .from('.hero-role', { opacity: 0, y: 12, duration: 0.8 }, 0)
      .from(chars, { yPercent: 105, stagger: 0.02, duration: 1 }, 0.1)
      .fromTo('.hero-portrait', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut' }, 0.15)
      .from('.hero-portrait img', { scale: 1.12, duration: 1.6 }, 0.15)
      .from(lead, { yPercent: 105, stagger: 0.06, duration: 0.9 }, 0.45)
      .from('.badge', { opacity: 0, y: 12, duration: 0.8 }, 0.65)
      .from('.hero-bottom', { opacity: 0, duration: 0.9 }, 0.75);
    // Revert line splits once at rest so the paragraph re-wraps on resize/rotation
    tl.eventCallback('onComplete', function () { leadSplit.revert(); });
    return tl;
  }

  function projectIntro() {
    var tl = gsap.timeline({ paused: true });
    var titleSplit = SplitText.create('.p-title', { type: 'lines', mask: 'lines' });
    var summarySplit = SplitText.create('.p-summary', { type: 'lines', mask: 'lines', aria: 'none' });
    var lines = titleSplit.lines;
    var summary = summarySplit.lines;

    tl.set('[data-intro]', { opacity: 1 })
      .from('.site-header > *', { yPercent: -60, opacity: 0, stagger: 0.06, duration: 0.9 }, 0.2)
      .from('.p-back, .p-hero .eyebrow', { opacity: 0, y: 12, stagger: 0.06, duration: 0.8 }, 0.1)
      .from(lines, { yPercent: 105, stagger: 0.08, duration: 1 }, 0.1)
      .from(summary, { yPercent: 105, stagger: 0.06, duration: 0.9 }, 0.35)
      .from('.p-meta > div', { opacity: 0, y: 14, stagger: 0.05, duration: 0.8 }, 0.45)
      .fromTo('.p-cover', { clipPath: 'inset(6% 4% 6% 4%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut' }, 0.35)
      .from('.p-cover .media-inner', { scale: 1.1, duration: 1.6 }, 0.35);
    tl.eventCallback('onComplete', function () { titleSplit.revert(); summarySplit.revert(); });

    gsap.fromTo('.p-cover .media-inner', { yPercent: -6 }, {
      yPercent: 6,
      ease: 'none',
      scrollTrigger: { trigger: '.p-cover', start: 'top bottom', end: 'bottom top', scrub: true }
    });
    return tl;
  }

  /* ---------- Scroll-driven effects ---------- */
  function setupReveals() {
    // If keyboard focus lands in content that has not been revealed yet, finish its reveal
    document.addEventListener('focusin', function (e) {
      ScrollTrigger.getAll().forEach(function (st) {
        var tr = st.trigger;
        if (st.vars.toggleActions && st.animation && tr && (tr.contains(e.target) || e.target.contains(tr))) st.animation.progress(1);
      });
    });

    $$('[data-split]').forEach(function (el) {
      SplitText.create(el, {
        type: 'lines',
        mask: 'lines',
        autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.lines, {
            yPercent: 105,
            stagger: 0.08,
            duration: 1,
            scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
          });
        }
      });
    });

    $$('[data-fade]').forEach(function (el) {
      gsap.from(el, {
        opacity: 0,
        y: 24,
        duration: 1,
        scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' }
      });
    });

    $$('[data-stagger]').forEach(function (el) {
      gsap.from(el.children, {
        opacity: 0,
        y: 28,
        stagger: 0.08,
        duration: 1,
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      });
    });

    $$('[data-reveal-media]').forEach(function (el) {
      var inner = $('.media-inner', el);
      var info = el.parentNode ? $('.work-info', el.parentNode) : null;
      var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' } });
      tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'expo.inOut' })
        .from(inner, { scale: 1.12, duration: 1.5 }, 0);
      if (info) tl.from(info.children, { opacity: 0, y: 16, stagger: 0.06, duration: 0.9 }, 0.4);

      // Gentle parallax inside the frame
      gsap.fromTo(inner, { yPercent: -4 }, {
        yPercent: 4,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true }
      });
    });
  }

  function setupHeroScroll() {
    gsap.to('.hero-portrait img', {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  function setupRoles() {
    var items = $$('[data-roles] li');
    if (items.length < 2) return;
    // Reset the CSS fallback offset so only yPercent drives the ticker
    gsap.set(items, { y: 0, yPercent: 110 });
    gsap.set(items[0], { yPercent: 0 });
    var tl = gsap.timeline({ repeat: -1, delay: 2.5 });
    items.forEach(function (el, i) {
      var next = items[(i + 1) % items.length];
      tl.to(el, { yPercent: -110, duration: 0.8, ease: 'power3.inOut' }, '+=1.8')
        // immediateRender: false, or the last step would hide items[0] at build time
        .fromTo(next, { yPercent: 110 }, { yPercent: 0, duration: 0.8, ease: 'power3.inOut', immediateRender: false }, '<');
    });
  }

  // Marquee speeds up with scroll velocity and follows scroll direction
  function setupMarquee() {
    var track = $('[data-marquee]');
    if (!track || !track.getAnimations) return;
    var anim = track.getAnimations()[0];
    if (!anim) return;
    // Keep the clock far from 0 so reverse playback (scrolling up) can never reach the start and finish
    var iter = Number(anim.effect.getComputedTiming().duration) || 96000;
    anim.currentTime = (anim.currentTime || 0) + iter * 1000;
    var dir = 1;
    var boost = 0;
    var rate = 1;
    ScrollTrigger.create({
      trigger: '.marquee',
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: function (self) {
        dir = self.direction;
        boost = Math.min(Math.abs(self.getVelocity()) / 300, 5);
      }
    });
    gsap.ticker.add(function () {
      boost *= 0.92;
      var target = dir * (1 + boost);
      rate += (target - rate) * 0.1;
      anim.playbackRate = rate;
    });
  }

  function setupAbout() {
    var el = $('[data-scrub-words]');
    if (!el) return;
    SplitText.create(el, {
      type: 'words',
      aria: 'none',
      autoSplit: true,
      onSplit: function (self) {
        return gsap.fromTo(self.words, { opacity: 0.2 }, {
          opacity: 1,
          stagger: 0.1,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true }
        });
      }
    });

    $$('[data-count]').forEach(function (num) {
      var target = Number(num.dataset.count) || 0;
      var o = { v: 0 };
      gsap.to(o, {
        v: target,
        duration: 2,
        ease: 'power2.out',
        scrollTrigger: { trigger: num, start: 'top 90%', toggleActions: 'play none none none' },
        onUpdate: function () { num.textContent = Math.round(o.v); }
      });
    });
  }

  function setupServices() {
    $$('.service').forEach(function (row) {
      var tl = gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 90%', toggleActions: 'play none none none' } });
      tl.from($('.service-line', row), { scaleX: 0, duration: 1.4, ease: 'expo.inOut' })
        .from(row.querySelectorAll('.service-num, .service-title, .service-text'), {
          opacity: 0, y: 18, stagger: 0.06, duration: 0.9
        }, 0.3);
    });
  }

  function setupContact() {
    var cta = $('.contact-cta');
    if (cta) {
      gsap.from(cta, {
        opacity: 0,
        y: 20,
        duration: 0.9,
        scrollTrigger: { trigger: cta, start: 'top 95%', toggleActions: 'play none none none' }
      });
    }
  }

  /* ---------- Pointer effects (desktop only) ---------- */
  function setupCursor() {
    var cursor = $('.cursor');
    if (!cursor) return;
    var label = $('span', cursor);
    var xTo = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3' });
    var yTo = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3' });
    var placed = false;

    window.addEventListener('pointermove', function (e) {
      if (!placed) { gsap.set(cursor, { x: e.clientX, y: e.clientY }); placed = true; }
      xTo(e.clientX);
      yTo(e.clientY);
    }, { passive: true });

    $$('[data-cursor]').forEach(function (el) {
      el.addEventListener('pointerenter', function () {
        label.textContent = el.dataset.cursor || t('cursor.view');
        gsap.to(cursor, { scale: 1, duration: 0.5, ease: 'back.out(1.7)', overwrite: 'auto' });
      });
      el.addEventListener('pointerleave', function () {
        gsap.to(cursor, { scale: 0, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      });
    });
  }

  function setupMagnetic() {
    $$('[data-magnetic]').forEach(function (el) {
      var strength = parseFloat(el.dataset.magnetic) || 0.25;
      var xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
      var yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * strength);
        yTo((e.clientY - (r.top + r.height / 2)) * strength);
      });
      el.addEventListener('pointerleave', function () {
        xTo(0);
        yTo(0);
      });
    });
  }
})();
