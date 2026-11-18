/* ==========================================================
   wedding.js
   - Background music + Play/Pause button
   - Lenis smooth scrolling
   - GSAP + ScrollTrigger animations
   - Working 3D photo gallery (autoplay, swipe, arrows)
   - Live countdown

   Everything is written defensively: if the GSAP / Lenis CDN
   fails to load, the page still shows normally and the music
   button still works.
   ========================================================== */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var hasGsap = function () { return typeof window.gsap !== 'undefined'; };
  var hasST = function () { return typeof window.ScrollTrigger !== 'undefined'; };

  /* ========================================================
     1. MUSIC
     ======================================================== */
  function initMusic() {
    var audio = $('#bgm');
    var wrap = $('#bgm-wrap');
    var btn = $('#bgm-btn');
    if (!audio || !wrap || !btn) return;

    var TARGET_VOLUME = 0.7;
    var isPlaying = false;
    var userPaused = false;       // guest pressed pause on purpose
    var pausedByTab = false;      // we paused because the tab went to background
    var fade = { v: 0 };

    audio.volume = 0;

    function setUI(playing) {
      wrap.classList.toggle('is-paused', !playing);
      btn.setAttribute('aria-label', playing ? 'Pause music' : 'Play music');
      btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    }

    function fadeTo(v, dur, done) {
      if (hasGsap()) {
        fade.v = audio.volume;
        window.gsap.killTweensOf(fade);
        window.gsap.to(fade, {
          v: v, duration: dur, ease: 'none',
          onUpdate: function () { audio.volume = Math.max(0, Math.min(1, fade.v)); },
          onComplete: function () { if (done) done(); }
        });
      } else {
        audio.volume = v;
        if (done) done();
      }
    }

    function play() {
      var p;
      try { p = audio.play(); } catch (e) { p = null; }
      function ok() {
        isPlaying = true;
        setUI(true);
        wrap.classList.remove('needs-tap');
        fadeTo(TARGET_VOLUME, 1.6);
      }
      function blocked() {
        isPlaying = false;
        setUI(false);
        wrap.classList.add('needs-tap');
      }
      if (p && typeof p.then === 'function') return p.then(ok, blocked);
      ok();
      return Promise.resolve();
    }

    function pause() {
      isPlaying = false;
      setUI(false);
      fadeTo(0, 0.6, function () { if (!isPlaying) audio.pause(); });
    }

    btn.addEventListener('click', function () {
      if (isPlaying) { userPaused = true; pause(); }
      else { userPaused = false; play(); }
    });

    /* Browsers block autoplay with sound. Try once, and if blocked,
       start on the guest's first tap / key press anywhere on the page. */
    var gestures = ['pointerup', 'click', 'keydown', 'touchend'];
    function disarm() {
      gestures.forEach(function (g) { doc.removeEventListener(g, onGesture, true); });
    }
    function onGesture(e) {
      if (wrap.contains(e.target)) return;          // the button handles itself
      if (userPaused) { disarm(); return; }
      play().then(function () { if (isPlaying) disarm(); });
    }
    function arm() {
      gestures.forEach(function (g) { doc.addEventListener(g, onGesture, true); });
    }

    play().then(function () { if (!isPlaying) arm(); });

    /* pause when the guest leaves the tab, resume when they return */
    doc.addEventListener('visibilitychange', function () {
      if (doc.hidden) {
        if (isPlaying) { audio.pause(); pausedByTab = true; }
      } else if (pausedByTab) {
        pausedByTab = false;
        if (!userPaused && isPlaying) audio.play().catch(function () {});
      }
    });

    audio.addEventListener('error', function () {
      /* only fires when every <source> failed */
      if (window.console) console.warn('[wedding] No playable music file found. Put your mp3 at assets/music/wedding.mp3');
    }, true);
  }

  /* ========================================================
     2. SMOOTH SCROLL (Lenis)
     ======================================================== */
  function initSmoothScroll() {
    if (reduceMotion || typeof window.Lenis === 'undefined') return;
    var lenis = new window.Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true
    });
    if (hasGsap() && hasST()) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      window.gsap.ticker.lagSmoothing(0);
    } else {
      (function raf(t) { lenis.raf(t); window.requestAnimationFrame(raf); })(0);
    }
  }


  /* ========================================================
     TEXT SPLITTING (own tiny splitter, no plugin needed)
     mode "chars": letters rise one by one (good for headings / script fonts)
     mode "words": words slide up out of a mask (good for sentences)
     ======================================================== */
  function splitText(el, mode) {
    if (!el || el.getAttribute('data-split')) return [];
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return [];

    /* flex/grid parents drop plain spaces, so wrap the content first */
    var display = window.getComputedStyle(el).display;
    var host = el;
    if (/flex|grid/.test(display)) {
      host = doc.createElement('span');
      while (el.firstChild) host.appendChild(el.firstChild);
      el.appendChild(host);
    }

    var parts = [];
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 1) { walk(n); return; }
        if (n.nodeType !== 3) return;
        var frag = doc.createDocumentFragment();
        n.nodeValue.split(/(\s+)/).forEach(function (piece) {
          if (!piece) return;
          if (/^\s+$/.test(piece)) { frag.appendChild(doc.createTextNode(' ')); return; }
          var word = doc.createElement('span');
          word.className = 'sw' + (mode === 'words' ? ' sw-mask' : '');
          word.setAttribute('aria-hidden', 'true');
          if (mode === 'chars') {
            Array.from(piece).forEach(function (ch) {   /* code points, so emoji (💍) are not split in half */
              var c = doc.createElement('span');
              c.className = 'si';
              c.textContent = ch;
              word.appendChild(c);
              parts.push(c);
            });
          } else {
            var w = doc.createElement('span');
            w.className = 'si';
            w.textContent = piece;
            word.appendChild(w);
            parts.push(w);
          }
          frag.appendChild(word);
        });
        node.replaceChild(frag, n);
      });
    }
    walk(host);

    /* screen-reader copy of the original text */
    var sr = doc.createElement('span');
    sr.className = 'sw-sr';
    sr.textContent = text;
    el.insertBefore(sr, el.firstChild);

    el.setAttribute('data-split', mode);
    return parts;
  }

  function animateSplit(gsap, el, mode, delay) {
    var parts = splitText(el, mode);
    if (!parts.length) return;
    var vars = mode === 'chars'
      ? { yPercent: 70, opacity: 0, rotation: 4, duration: 1.2, ease: 'power4.out',
          stagger: { amount: Math.min(0.045 * parts.length, 0.7) } }
      : { yPercent: 115, duration: 1.2, ease: 'power4.out',
          stagger: { amount: Math.min(0.07 * parts.length, 0.6) } };
    vars.delay = delay || 0.05;
    vars.scrollTrigger = { trigger: el, start: 'top 90%', once: true };
    gsap.from(parts, vars);
  }

  /* decide which texts get the letter / word animation */
  function prepareText(gsap) {
    var charsTargets = $$('h2').concat($$('[data-r="stagger"] h3'));
    var wordsTargets = []
      .concat($$('[data-r="up"][class*="uppercase"] > span'))              // "Together with our families..."
      .concat($$('[data-r="up"][class*="gap-4"] p'))                       // event time / venue / address
      .concat($$('[data-r="up"][class*="gap-4"] > div > span'))            // RING CEREMONY & HALDI, VENUE
      .concat($$('[data-r="children"] h3'))                                // "The Wedding will take place at"
      .concat($$('[data-landing-screenshot-id="invite-map"] h3'))          // Wedding Reception Venue, Balaji Lawn
      .concat($$('[data-landing-screenshot-id="invite-map"] [class*="whitespace-pre-line"] > span'))
      .concat($$('footer [dir="auto"]'));                                  // "Your presence would be..."

    charsTargets.forEach(function (el) {
      el.removeAttribute('data-r');         // the text animation replaces the plain fade-up
      animateSplit(gsap, el, 'chars', 0.05);
    });
    wordsTargets.forEach(function (el) {
      if (el.hasAttribute('data-r')) el.removeAttribute('data-r');
      animateSplit(gsap, el, 'words', 0.1);
    });
  }

  /* ========================================================
     3. GSAP ANIMATIONS
     ======================================================== */
  function initAnimations() {
    if (!hasGsap() || reduceMotion) return;
    var gsap = window.gsap;
    if (hasST()) {
      gsap.registerPlugin(window.ScrollTrigger);
      window.ScrollTrigger.config({ ignoreMobileResize: true });
    }
    gsap.defaults({ ease: 'power3.out' });

    heroIntro(gsap);
    if (hasST()) {
      prepareText(gsap);
      heroParallax(gsap);
      decorParallax(gsap);
      scrollReveals(gsap);
      calendarDay(gsap);
      window.addEventListener('load', function () { window.ScrollTrigger.refresh(); });
    }
  }

  /* ----- Hero: opening animation ----- */
  function heroIntro(gsap) {
    var hero = $('[data-anim="hero"]');
    if (!hero) return;

    var arch = $('[style*="arch-frame.webp"]', hero);
    var castle = $('[style*="castle.webp"]', hero);
    var sandstone = $('[style*="sandstone.webp"]', hero);
    var flower1 = $('[style*="flower1.webp"]', hero);
    var bells = $('[style*="bells.webp"]', hero);
    var flowers2 = $$('[style*="flower2.webp"]', hero);
    var fence = $('[style*="fence.webp"]', hero);
    var nameBlock = $('[class*="top-[43.9%]"]', hero);

    var tl = gsap.timeline({ delay: 0.15 });

    if (arch)      tl.from(arch,      { opacity: 0, scale: 0.94, duration: 1.8, ease: 'power2.out' }, 0);
    if (castle)    tl.from(castle,    { opacity: 0, y: 70, duration: 1.7 }, 0.1);
    if (sandstone) tl.from(sandstone, { opacity: 0, y: -60, duration: 1.5 }, 0.2);
    if (flower1)   tl.from(flower1,   { opacity: 0, scale: 0.7, rotation: -12, transformOrigin: '30% 30%', duration: 1.9, ease: 'power2.out' }, 0.2);
    if (bells)     tl.from(bells,     { opacity: 0, y: -150, duration: 1.8, ease: 'elastic.out(1, 0.55)' }, 0.35);
    if (flowers2.length) tl.from(flowers2, { opacity: 0, duration: 1.5, ease: 'power2.out' }, 0.7);
    if (fence)     tl.from(fence,     { opacity: 0, duration: 1.4, ease: 'power2.out' }, 0.9);
    if (nameBlock) {
      var nameSpans = $$('span.inline-block', nameBlock);
      var letters = [];
      nameSpans.forEach(function (sp) { letters = letters.concat(splitText(sp, 'chars')); });
      tl.from(nameBlock.children, { opacity: 0, duration: 0.9, stagger: 0.3, ease: 'power1.out' }, 0.8);
      if (letters.length) {
        tl.from(letters, {
          opacity: 0, y: 38, rotation: 5, scale: 0.85, filter: 'blur(6px)',
          duration: 1.5, ease: 'power3.out', stagger: { amount: 1.2 }
        }, 0.9);
      }
    }

    /* the start-states are applied, so we can safely un-hide the hero now */
    root.classList.remove('anim-pending');

    /* gentle, endless sway once the intro has finished */
    tl.eventCallback('onComplete', function () {
      if (bells) {
        gsap.fromTo(bells, { rotation: -2.5 }, {
          rotation: 2.5, transformOrigin: '50% 0%', duration: 3.4,
          ease: 'sine.inOut', yoyo: true, repeat: -1
        });
      }
      if (flower1) {
        gsap.to(flower1, {
          rotation: 1.8, scale: 1.02, transformOrigin: '30% 30%', duration: 4.2,
          ease: 'sine.inOut', yoyo: true, repeat: -1
        });
      }
    });
  }

  /* ----- Hero: soft parallax while scrolling away ----- */
  function heroParallax(gsap) {
    var hero = $('[data-anim="hero"]');
    if (!hero) return;
    var st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.8 };
    var bells = $('[style*="bells.webp"]', hero);
    var flower1 = $('[style*="flower1.webp"]', hero);
    var castle = $('[style*="castle.webp"]', hero);
    if (bells)   gsap.to(bells,   { yPercent: -16, ease: 'none', scrollTrigger: st });
    if (flower1) gsap.to(flower1, { yPercent: -10, ease: 'none', scrollTrigger: st });
    if (castle)  gsap.to(castle,  { yPercent: 6,   ease: 'none', scrollTrigger: st });
  }

  /* ----- Decorative flowers / castle that drift while you scroll ----- */
  function decorParallax(gsap) {
    $$('[style*="will-change: transform"]').forEach(function (el) {
      var sec = el.closest('section') || el.parentElement;
      gsap.fromTo(el, { y: -45 }, {
        y: 45, ease: 'none',
        scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
      });
    });

    /* castle at the very bottom rises into view */
    var castleBottom = $('[data-anim="castle-bottom"]');
    if (castleBottom) {
      gsap.fromTo(castleBottom, { yPercent: 10 }, {
        yPercent: 0, ease: 'none',
        scrollTrigger: { trigger: castleBottom, start: 'top bottom', end: 'bottom bottom', scrub: 0.8 }
      });
    }
  }

  /* ----- Fade/slide reveal for every [data-r] element ----- */
  function scrollReveals(gsap) {
    var done = [];   // elements already animated (so children aren't animated twice)

    function insideDone(el) {
      return done.some(function (d) { return d !== el && d.contains(el); });
    }
    function trig(el, start) {
      return { trigger: el, start: start || 'top 90%', once: true };
    }
    function up(el, extra) {
      var lift = el.querySelector && el.querySelector('.sw') ? 14 : 40;
      gsap.from(el, Object.assign({
        opacity: 0, y: lift, duration: 1.1, scrollTrigger: trig(el)
      }, extra || {}));
    }

    $$('[data-r]').forEach(function (el) {
      if (insideDone(el)) return;
      var type = el.getAttribute('data-r');

      if (type === 'children') {
        done.push(el);
        Array.prototype.slice.call(el.children).forEach(function (c) {
          done.push(c);
          up(c);          // every child gets its own scroll trigger
        });
        return;
      }

      done.push(el);

      if (type === 'stagger') {
        gsap.from(el.children, {
          opacity: 0, y: 14, duration: 1.1, stagger: 0.22, scrollTrigger: trig(el)
        });
      } else if (type === 'left') {
        up(el, { y: 0, x: -60, duration: 1.2 });
      } else if (type === 'right') {
        up(el, { y: 0, x: 60, duration: 1.2 });
      } else if (type === 'grow') {
        up(el, { y: 0, scaleY: 0, transformOrigin: '50% 50%', duration: 1.1 });
      } else if (type === 'zoom') {
        up(el, { y: 30, scale: 0.92, duration: 1.2 });
      } else if (type === 'line') {
        up(el, { y: 0, scaleX: 0.2, duration: 1.2 });
      } else {
        up(el);
      }
    });
  }

  /* ----- Calendar: the wedding date pops in and then keeps pulsing ----- */
  function calendarDay(gsap) {
    var d = $('[data-anim="day13"]');
    if (!d) return;
    gsap.set(d, { scale: 0 });
    window.ScrollTrigger.create({
      trigger: d, start: 'top 92%', once: true,
      onEnter: function () {
        gsap.to(d, {
          scale: 1, rotation: 0, duration: 1, delay: 0.5, ease: 'back.out(2.4)',
          onComplete: function () {
            gsap.to(d, { scale: 1.18, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 });
          }
        });
      }
    });
  }

  /* ========================================================
     4. PHOTO GALLERY (3D ring, autoplay / swipe / arrows)
     ======================================================== */
  function initGallery() {
    var stage = $('[data-gallery="stage"]');
    if (!stage) return;
    var cards = Array.prototype.slice.call(stage.children);
    var N = cards.length;
    if (N < 2) return;

    var counter = $('[data-gallery="counter"]');
    var prevBtn = $('[aria-label="Previous photo"]');
    var nextBtn = $('[aria-label="Next photo"]');
    var activeIdx = -1;

    /* no GSAP? leave the original static layout untouched */
    if (!hasGsap()) return;
    var gsap = window.gsap;

    /* take control from the original CSS transitions/transforms */
    cards.forEach(function (c) {
      c.style.transition = 'none';
      c.style.transform = '';
    });

    function table(a, pts) {          // linear interpolation over |offset|
      var i = Math.min(Math.floor(a), pts.length - 2);
      var t = Math.min(a - i, 1);
      return pts[i] + (pts[i + 1] - pts[i]) * t;
    }

    function render(p) {
      var half = N / 2;
      cards.forEach(function (c, i) {
        var o = i - p;
        o = ((o + half) % N + N) % N - half;      // wrap into [-N/2, N/2)
        var a = Math.abs(o);
        var scale = table(a, [1, 0.85, 0.7, 0.7]);
        var opacity = table(a, [1, 0.75, 0.5, 0.3, 0.3]);
        if (a > 4) opacity = 0.3 * Math.max(0, 1 - (a - 4) / Math.max(0.5, half - 4));  // hide the wrap-around jump
        gsap.set(c, {
          xPercent: o * 60,
          z: -150 * a,
          rotationY: 45 * o,
          scale: scale,
          opacity: opacity,
          zIndex: Math.round(100 - a)
        });
      });

      var idx = ((Math.round(p) % N) + N) % N;
      if (idx !== activeIdx) {
        activeIdx = idx;
        cards.forEach(function (c, i) {
          c.classList.toggle('ring-2', i === idx);
          c.classList.toggle('ring-white/30', i === idx);
        });
        if (counter) counter.textContent = (idx + 1) + ' / ' + N;
      }
    }

    var state = { p: 0 };
    var tween = null;
    render(0);

    function goTo(target) {
      if (tween) tween.kill();
      if (reduceMotion) { state.p = target; render(target); return; }
      tween = gsap.to(state, {
        p: target, duration: 1.1, ease: 'power3.inOut',
        onUpdate: function () { render(state.p); }
      });
    }
    function step(d) { goTo(Math.round(state.p) + d); }

    if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); restartAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); restartAuto(); });

    /* swipe + tap on a side card */
    var startX = 0, startY = 0, moved = false, down = false;
    stage.addEventListener('pointerdown', function (e) {
      down = true; moved = false; startX = e.clientX; startY = e.clientY;
    });
    stage.addEventListener('pointerup', function (e) {
      if (!down) return;
      down = false;
      var dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        moved = true;
        step(dx < 0 ? 1 : -1);
        restartAuto();
      } else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        var card = e.target.closest ? cards.filter(function (c) { return c.contains(e.target); })[0] : null;
        if (card) {
          var i = cards.indexOf(card);
          var cur = Math.round(state.p);
          var o = i - cur;
          o = ((o + N / 2) % N + N) % N - N / 2;
          if (o !== 0) { goTo(cur + Math.round(o)); restartAuto(); }
        }
      }
    });
    stage.addEventListener('pointercancel', function () { down = false; });

    /* autoplay */
    if (reduceMotion) return;
    var inView = !hasST();
    var hovering = false;
    var timer = null;
    function schedule() {
      if (timer) timer.kill();
      timer = gsap.delayedCall(3.8, function () {
        if (inView && !hovering && !doc.hidden && !down) step(1);
        schedule();
      });
    }
    function restartAuto() { schedule(); }
    stage.addEventListener('mouseenter', function () { hovering = true; });
    stage.addEventListener('mouseleave', function () { hovering = false; });
    if (hasST()) {
      window.ScrollTrigger.create({
        trigger: stage, start: 'top 85%', end: 'bottom 15%',
        onToggle: function (self) { inView = self.isActive; }
      });
    }
    schedule();
  }

  /* ========================================================
     5. LIVE COUNTDOWN
     ======================================================== */
  function initCountdown() {
    var el = $('[data-countdown]');
    if (!el) return;
    var target = new Date(el.getAttribute('data-countdown')).getTime();
    if (isNaN(target)) return;

    function tick() {
      var diff = target - Date.now();
      if (diff <= 0) { el.textContent = 'The celebration has begun \u2661'; return false; }
      var s = Math.floor(diff / 1000);
      var d = Math.floor(s / 86400);
      var h = Math.floor((s % 86400) / 3600);
      var m = Math.floor((s % 3600) / 60);
      var sec = s % 60;
      el.textContent = d + ' days ' + h + ' hours ' + m + ' min ' + sec + ' sec';
      return true;
    }
    if (!tick()) return;
    var t = window.setInterval(function () { if (!tick()) window.clearInterval(t); }, 1000);
  }

  /* ========================================================
     BOOT
     ======================================================== */
  function boot() {
    try { initMusic(); } catch (e) { if (window.console) console.error(e); }
    try { initCountdown(); } catch (e) { if (window.console) console.error(e); }
    try { initSmoothScroll(); } catch (e) { if (window.console) console.error(e); }
    try { initAnimations(); } catch (e) { if (window.console) console.error(e); }
    try { initGallery(); } catch (e) { if (window.console) console.error(e); }
    root.classList.remove('anim-pending');   // safety: never leave the hero hidden
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
