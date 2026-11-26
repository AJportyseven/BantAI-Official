/* ══════════════════════════════════════════════════════════════════
   BantAI 2.0 — GLOBAL INTERACTIVE & MOTION ENGINE
   ══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 1. Splash Handler
  const splash = document.getElementById('splash');
  const segs = splash ? splash.querySelectorAll('.splash-seg') : [];
  function fillSeg(i){ if (segs[i]) segs[i].classList.add('is-filled'); }
  var milestonesDone = 0;
  var contentShown = false;
  var exited = false;
  function showContent(){
    if (exited) return;
    contentShown = true;
    if (splash) splash.classList.add('is-visible');
  }
  function exitSplash(){
    if (exited) return;
    exited = true;
    if (!splash || !document.documentElement.classList.contains('splash')) { window.__bantaiReady=true; document.documentElement.classList.add('page-ready'); return; }
    if (contentShown) {
      splash.classList.add('is-exiting');
      setTimeout(function(){
        document.documentElement.classList.add('page-ready');
        document.documentElement.classList.remove('splash');
        window.__bantaiReady = true;
        try { sessionStorage.setItem('bantai-splash','1'); } catch(e){}
        window.dispatchEvent(new Event('bantai:ready'));
      }, 760);
    } else {
      document.documentElement.classList.add('page-ready');
      document.documentElement.classList.remove('splash');
      window.__bantaiReady = true;
      try { sessionStorage.setItem('bantai-splash','1'); } catch(e){}
      window.dispatchEvent(new Event('bantai:ready'));
    }
  }
  if (document.documentElement.classList.contains('splash')) {
    var contentTimer = setTimeout(showContent, 150);
    function milestone(){ milestonesDone++; if (milestonesDone>=3){ clearTimeout(contentTimer); exitSplash(); } }
    window.addEventListener('DOMContentLoaded', function(){ fillSeg(0); milestone(); }, {once:true});
    if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function(){ fillSeg(1); milestone(); }).catch(function(){ fillSeg(1); milestone(); }); }
    else { fillSeg(1); milestone(); }
    window.addEventListener('load', function(){ fillSeg(2); milestone(); }, {once:true});
    ['keydown','pointerdown'].forEach(function(ev){ window.addEventListener(ev, exitSplash, {once:true}); });
    window.addEventListener('pageshow', function(e){ if (e.persisted){ document.documentElement.classList.remove('splash'); window.__bantaiReady=true; document.documentElement.classList.add('page-ready'); window.dispatchEvent(new Event('bantai:ready')); } });
    setTimeout(exitSplash, 3000);
  } else {
    window.__bantaiReady = true;
    document.documentElement.classList.add('page-ready');
    window.dispatchEvent(new Event('bantai:ready'));
  }

  // 2. Page entrance
  document.body.classList.add('page-enter');

  // 3. Scroll progress bar + back-to-top
  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.innerHTML = '<div class="scroll-progress__bar"></div>';
  document.body.appendChild(progress);
  const progressBar = progress.querySelector('.scroll-progress__bar');

  const backToTop = document.createElement('button');
  backToTop.className = 'back-to-top';
  backToTop.setAttribute('aria-label', 'Back to top');
  backToTop.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
  document.body.appendChild(backToTop);

  let scrollTicking = false;
  var railTrack = document.querySelector('.rail-track');
  var navScrollHook = null;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      if (progressBar) progressBar.style.transform = 'scaleX(' + (pct/100) + ')';
      if (railTrack) railTrack.style.setProperty('--p', (pct/100).toFixed(3));
      if (scrollTop > 600) backToTop.classList.add('is-visible');
      else backToTop.classList.remove('is-visible');
      if (navScrollHook) navScrollHook(scrollTop);
      // drift
      if (!prefersReduced && window.innerWidth >= 640) {
        const driftEls = document.querySelectorAll('[data-drift]');
        const reads = [];
        driftEls.forEach(el => { const r = el.getBoundingClientRect(); reads.push({ el, r }); });
        reads.forEach(({el, r}) => {
          if (r.bottom < 0 || r.top > window.innerHeight) return;
          const centerY = r.top + r.height/2;
          const max = parseFloat(el.getAttribute('data-drift')) || 0;
          const val = Math.max(-1, Math.min(1, (0.5 - centerY/window.innerHeight)*2));
          el.style.setProperty('--drift', val.toFixed(3));
          el.style.setProperty('--drift-max', max);
        });
      }
      scrollTicking = false;
    });
  }

function initNav() {
  var nav = document.getElementById('nv');
  if (!nav) return;
  var pill = nav.querySelector('.nv-pill');
  var links = nav.querySelector('.nv-links');
  var ind = nav.querySelector('.nv-ind');
  var burger = nav.querySelector('.nv-burger');
  var cta = nav.querySelector('.nv-cta');
  if (!pill || !links || !ind || !burger) return;
  var items = Array.prototype.slice.call(links.querySelectorAll('.nv-l'));
  var label = burger.querySelector('.nv-burger-l');
  var desktop = window.matchMedia('(min-width: 1100px)');
  var canHover = window.matchMedia('(hover: hover)').matches;
  var hidden = false;
  var open = false;
  var state = 'top';
  var prevY = window.pageYOffset || 0;
  var holdUntil = 0;

  function rest() {
    return links.querySelector('.nv-l[aria-current]:not(.nv-l--dl)');
  }
  function place(el) {
    items.forEach(function (a) { a.classList.remove('is-lit'); });
    if (!el || !desktop.matches) { links.setAttribute('data-ind', 'off'); return; }
    links.style.setProperty('--ix', el.offsetLeft + 'px');
    links.style.setProperty('--iw', el.offsetWidth + 'px');
    links.setAttribute('data-ind', 'on');
    el.classList.add('is-lit');
  }
  function settle() { place(rest()); }

  items.forEach(function (a) {
    if (a.classList.contains('nv-l--dl')) return;
    a.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') place(a); });
    a.addEventListener('focus', function () { place(a); });
    a.addEventListener('blur', settle);
  });
  links.addEventListener('pointerleave', settle);

  function setHidden(h) {
    if (h === hidden) return;
    hidden = h;
    nav.setAttribute('data-hidden', h ? 'true' : 'false');
  }
  function setOpen(o, back) {
    open = o;
    nav.setAttribute('data-open', o ? 'true' : 'false');
    burger.setAttribute('aria-expanded', o ? 'true' : 'false');
    if (label) label.textContent = o ? 'Close' : 'Menu';
    if (o) setHidden(false);
    if (!o && back) burger.focus();
  }
  burger.addEventListener('click', function () { setOpen(!open, false); });
  links.addEventListener('pointerdown', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a.nv-l') : null;
    if (!a || a.classList.contains('nv-l--dl') || a.getAttribute('href').charAt(0) !== '#') return;
    items.forEach(function (x) { x.removeAttribute('aria-current'); });
    a.setAttribute('aria-current', 'location');
  });
  links.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a.nv-l') : null;
    if (a && !a.classList.contains('nv-l--dl') && a.getAttribute('href').charAt(0) === '#') settle();
    if (open && a) setOpen(false, false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) setOpen(false, pill.contains(document.activeElement));
  });
  document.addEventListener('pointerdown', function (e) {
    if (open && !pill.contains(e.target)) setOpen(false, false);
  });
  pill.addEventListener('focusout', function (e) {
    if (open && e.relatedTarget && !pill.contains(e.relatedTarget)) setOpen(false, false);
  });

  function onMq() { if (desktop.matches && open) setOpen(false, false); settle(); }
  if (desktop.addEventListener) desktop.addEventListener('change', onMq); else desktop.addListener(onMq);
  var rz = 0;
  window.addEventListener('resize', function () {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(settle);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);

  nav.addEventListener('focusin', function () { setHidden(false); });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) holdUntil = performance.now() + 1100;
  });
  document.addEventListener('pointermove', function (e) {
    if (hidden && e.pointerType === 'mouse' && e.clientY < 10) setHidden(false);
  }, { passive: true });

  navScrollHook = function (y) {
    var s = y > 72 ? 'scrolled' : 'top';
    if (s !== state) { state = s; nav.setAttribute('data-state', s); }
    var hovering = canHover && (pill.matches(':hover') || (cta && cta.matches(':hover')));
    if (open || y < 96 || hovering || performance.now() < holdUntil) {
      setHidden(false);
      prevY = y;
      return;
    }
    var d = y - prevY;
    if (Math.abs(d) < 8) return;
    setHidden(d > 0);
    prevY = y;
  };

  if (cta) {
    var origin = function (e) {
      var r = cta.getBoundingClientRect();
      cta.style.setProperty('--ox', ((e.clientX - r.left) / r.width * 100) + '%');
      cta.style.setProperty('--oy', ((e.clientY - r.top) / r.height * 100) + '%');
    };
    cta.addEventListener('pointerenter', origin);
    cta.addEventListener('pointerleave', origin);
  }

  var spy = items.filter(function (a) { return a.getAttribute('href').charAt(0) === '#'; });
  if (spy.length && 'IntersectionObserver' in window) {
    var sio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var id = en.target.id;
        spy.forEach(function (a) {
          if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        });
        settle();
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    spy.forEach(function (a) {
      var t = document.getElementById(a.getAttribute('href').slice(1));
      if (t) sio.observe(t);
    });
  }

  var dark = new Set();
  var darkEls = document.querySelectorAll('#classroom, #authority, .pl-final, [data-nav-theme="dark"]');
  if (darkEls.length && 'IntersectionObserver' in window) {
    var dio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) dark.add(en.target); else dark.delete(en.target);
      });
      nav.setAttribute('data-theme', dark.size ? 'dark' : 'light');
    }, { rootMargin: '0px 0px -92% 0px' });
    darkEls.forEach(function (el) { dio.observe(el); });
  }

  settle();
  requestAnimationFrame(function () { links.classList.add('nv-ready'); });
}
initNav();


  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  backToTop.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' }); });

  // Mobile nav toggle
  const navToggle = document.querySelector('.nav-toggle');
  const navLinksContainer = document.getElementById('navLinks');
  if (navToggle && navLinksContainer) {
    navToggle.addEventListener('click', () => {
      const open = navLinksContainer.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinksContainer.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinksContainer.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navLinksContainer.classList.contains('is-open')) {
        navLinksContainer.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 980 && navLinksContainer.classList.contains('is-open')) {
        navLinksContainer.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Active nav link based on hash/section
  const navLinks = document.querySelectorAll('.nav-links a');
  function setActiveNav() {
    const hash = window.location.hash || '#top';
    navLinks.forEach(a => {
      const href = a.getAttribute('href') || '';
      const isActive = href === hash || (href.startsWith('#') && href === window.location.hash);
      a.classList.toggle('active', isActive);
    });
  }
  window.addEventListener('hashchange', setActiveNav);
  setActiveNav();

  // 5. Smooth anchor navigation
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id && id.length > 1) {
        const target = document.querySelector(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
          history.replaceState(null, '', id);
        }
      }
    });
  });

  // 6. Deployment Diagram Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  const deployCards = document.querySelectorAll('.deploy-card');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      deployCards.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      const targetCard = document.getElementById(targetId);
      if (targetCard) targetCard.classList.add('active');
    });
  });

  // 7. Lightbox Modal for Deployment Images
  const modal = document.getElementById('deployModal');
  const modalImg = document.getElementById('deployModalImg');
  const modalClose = document.getElementById('deployModalClose');

  if (modal && modalImg) {
    document.querySelectorAll('.deploy-card img').forEach(img => {
      img.addEventListener('click', () => {
        modalImg.src = img.src;
        modal.classList.add('open');
      });
    });
    if (modalClose) {
      modalClose.addEventListener('click', () => modal.classList.remove('open'));
    }
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });
  }

  // 8. FAQ Accordion Toggle
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (btn) {
      btn.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        faqItems.forEach(i => i.classList.remove('open'));
        if (!isOpen) item.classList.add('open');
      });
    }
  });

  // 9. Non-Windows OS Alert & Download Toast Notification
  const isWin = (navigator.userAgentData?.platform || navigator.platform || navigator.userAgent).toUpperCase().indexOf('WIN') !== -1;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  const osAlert = document.getElementById('osAlert');
  if (osAlert && (!isWin || isMobile)) {
    osAlert.style.display = 'flex';
  }

  const toast = document.getElementById('toast');
  const toastClose = document.getElementById('toastClose');
  let toastTimer;

  function isMobileDevice() {
    if (navigator.userAgentData && typeof navigator.userAgentData.mobile === 'boolean') {
      return navigator.userAgentData.mobile === true;
    }
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
    return false;
  }

  document.querySelectorAll('.dl').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (isMobileDevice()) {
        e.preventDefault();
        if (osAlert) {
          osAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }
      if (toast) {
        clearTimeout(toastTimer);
        setTimeout(() => toast.classList.add('show'), 600);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 12000);
      }
    });
  });

  if (toastClose) {
    toastClose.addEventListener('click', () => toast.classList.remove('show'));
  }


  // Active nav indicator: one IO over #how and #deployment
  const navIndicator = document.querySelector('.nav-indicator');
  const navLinkEls = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('#how, #deployment');
  if (sections.length && navLinkEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          navLinkEls.forEach(a => {
            const href = a.getAttribute('href') || '';
            a.setAttribute('aria-current', href.includes(e.target.id) ? 'page' : 'false');
          });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(s => io.observe(s));
  }

  // 11. Scroll Reveal Observer (with variants) — starts only after page-ready
  const revealElements = document.querySelectorAll('[data-reveal], .app-frame, [data-stagger]');
  function startReveals() {
    if (revealElements.length === 0) return;
    if (prefersReduced) {
      revealElements.forEach(el => el.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealElements.forEach(el => observer.observe(el));
  }
  if (document.documentElement.classList.contains('page-ready')) {
    startReveals();
  } else {
    window.addEventListener('bantai:ready', startReveals, { once: true });
  }






  // Authority drift
  const authLines = document.querySelectorAll('.auth-line');
  const authSection = document.getElementById('authority');
  if (authLines.length && authSection && !prefersReduced && window.innerWidth >= 640) {
    var authTicking = false;
    window.addEventListener('scroll', function(){
      if (authTicking) return;
      authTicking = true;
      requestAnimationFrame(function(){
        const r = authSection.getBoundingClientRect();
        const vh = window.innerHeight;
        const progress = Math.min(1, Math.max(0, (vh*0.5 - r.top)/(r.height + vh*0.5)));
        const drift = (progress - 0.5) * 8; // vw-ish
        if (authLines[0]) authLines[0].style.transform = 'translateX(' + (-drift) + 'vw)';
        if (authLines[1]) authLines[1].style.transform = 'translateX(' + (drift) + 'vw)';
        authTicking = false;
      });
    }, { passive: true });
  }

function initPipeline() {
  function run() {
    var scene = document.querySelector('[data-pl-scene]');
    if (!scene || !('IntersectionObserver' in window)) return;
    var steps = scene.querySelectorAll('[data-pl-step]');
    if (!steps.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        scene.setAttribute('data-step', e.target.getAttribute('data-pl-step'));
        Array.prototype.forEach.call(steps, function (st) {
          st.classList.toggle('is-active', st === e.target);
        });
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    Array.prototype.forEach.call(steps, function (st) { io.observe(st); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
}
(function initScene() {
  function run() {
    var scene = document.querySelector('[data-scene]');
    if (!scene || !('IntersectionObserver' in window)) return;
    var steps = Array.prototype.slice.call(scene.querySelectorAll('[data-step-index]'));
    if (!steps.length) return;
    var current = -1;
    var live = {};

    function setStep(n) {
      if (n === current) return;
      current = n;
      scene.setAttribute('data-step', String(n));
      steps.forEach(function (el) {
        el.classList.toggle('is-active', Number(el.getAttribute('data-step-index')) === n);
      });
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        live[e.target.getAttribute('data-step-index')] = e.isIntersecting;
      });
      for (var i = 0; i < steps.length; i++) {
        var idx = steps[i].getAttribute('data-step-index');
        if (live[idx]) { setStep(Number(idx)); return; }
      }
      if (steps[0].getBoundingClientRect().top > window.innerHeight / 2) setStep(0);
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    steps.forEach(function (el) {
      io.observe(el);
      el.addEventListener('focus', function () {
        setStep(Number(el.getAttribute('data-step-index')));
      });
    });
    setStep(0);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
initPipeline();

  // 12. Showcase intersection trigger for app-frame::
  const showcase = document.getElementById('showcase');
  if (showcase) {
    const frame = showcase.querySelector('.app-frame');
    if (frame) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) { frame.classList.add('is-in'); io.unobserve(frame); }
        });
      }, { threshold: 0.2 });
      io.observe(frame);
    }
  }
})();

/* ══════════════════════════════════════════════════════════════════
   ADVANCED SCROLL STORYTELLING ENGINE
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  // Decision typography reveal
  const decisionSection = document.querySelector('.decision-type');
  if (decisionSection) {
    const lines = decisionSection.querySelectorAll('.decision-line');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          lines.forEach((l, i) => setTimeout(() => l.classList.add('is-in'), i * 250));
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    io.observe(decisionSection);
  }

  // Alert cascade
  const cascade = document.querySelector('.alert-cascade');
  if (cascade) {
    const cards = cascade.querySelectorAll('.alert-card-sim');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          cards.forEach((c, i) => setTimeout(() => c.classList.add('is-in'), i * 150));
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    io.observe(cascade);
  }

})();

