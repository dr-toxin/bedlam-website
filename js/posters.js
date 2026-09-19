/* Poster data: f = file id (assets/posters/<f>.jpg full size, assets/posters/t/<f>.jpg rack size), r = width/height, c = caption. */
var POSTERS = [{"f":"p01","r":0.667,"c":"Highway 61 Roadhouse · Aug 30"},{"f":"p02","r":0.751,"c":"Tamm Ave · June 8 · Trio"},{"f":"p03","r":0.787,"c":"Bronson House · Sept 29, 2017"},{"f":"p04","r":0.75,"c":"9-Mile Garden · June 7"},{"f":"p05","r":0.772,"c":"The Great Grizzly · Jan 27"},{"f":"p06","r":0.783,"c":"1860's Saloon · June 1"},{"f":"p07","r":0.778,"c":"Tamm Ave · Oct 4"},{"f":"p08","r":0.75,"c":"Barrel House · April 18 · Acoustic Duo"},{"f":"p09","r":0.773,"c":"Angry Beaver · April 20"},{"f":"p10","r":0.87,"c":"Angry Beaver · June 30, 2018"},{"f":"p11","r":0.707,"c":"Sammy's Last Chance, Edwardsville · Jan 11"},{"f":"p12","r":0.773,"c":"The Great Grizzly · April 15"},{"f":"p13","r":0.599,"c":"Tamm Ave · June 8"},{"f":"p14","r":0.742,"c":"Angry Beaver · Friday night"},{"f":"p15","r":0.75,"c":"9-Mile Garden · Sept 28"},{"f":"p16","r":0.773,"c":"The Great Grizzly Bear · Dec 2, 2023"},{"f":"p17","r":0.758,"c":"Tamm Ave · April 23"},{"f":"p18","r":0.773,"c":"Jacksons · Oct 8"},{"f":"p19","r":0.75,"c":"Highway 61 Roadhouse · Feb 28"},{"f":"p20","r":0.888,"c":"The Naked Vine · Sept 25, 2020"},{"f":"p21","r":0.75,"c":"Porchfest · Sept 20"},{"f":"p22","r":0.772,"c":"Old Time Pub · April 12 · Duo"},{"f":"p23","r":0.707,"c":"Highway 61 Roadhouse · Nov 8"},{"f":"p24","r":0.562,"c":"Tamm Ave · Aug 17"},{"f":"p25","r":0.707,"c":"Schlafly Bottle Works · Dec 7"},{"f":"p26","r":0.81,"c":"Tamm Ave · June 3"},{"f":"p27","r":0.647,"c":"Angry Beaver · July 26"},{"f":"p28","r":0.773,"c":"Classics Bar & Grill · April 14"},{"f":"p29","r":0.707,"c":"Llywelyn's · Jan 31 · Full band"},{"f":"p30","r":0.773,"c":"Das Bevo Biergarten · Oct 5 · Acoustic Trio"},{"f":"p31","r":0.707,"c":"Flock · Oct 10"},{"f":"p32","r":0.73,"c":"9-Mile Garden · Sept 28"},{"f":"p33","r":0.562,"c":"Firehouse Bar · May 25"},{"f":"p34","r":0.772,"c":"Schlafly Bottle Works · July 26"},{"f":"p35","r":0.637,"c":"Llywelyn's Pub · Sept 16"},{"f":"p36","r":0.667,"c":"1860's Saloon · Nov 1"}];

/* ---------- Poster rack ---------- */
(function rack() {
  var stage = document.getElementById('r-stage');
  if (!stage || !window.POSTERS) return;
  var P = window.POSTERS, N = P.length;
  var $ = function (id) { return document.getElementById(id); };
  var cap = $('r-cap'), count = $('r-count'), rail = $('r-rail'), prevB = $('r-prev'), nextB = $('r-next');
  var zoom = $('r-zoom'), zImg = $('r-zimg'), zCap = $('r-zcap'), zClose = $('r-zclose');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pos = 0, target = 0, raf = 0, els = [], loaded = {};
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v) { return Math.max(0, Math.min(N - 1, v)); }

  P.forEach(function (p, i) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'poster'; b.setAttribute('data-i', i); b.style.setProperty('--r', p.r);
    b.setAttribute('aria-label', 'Poster ' + (i + 1) + ' of ' + N + ': ' + p.c);
    b.tabIndex = -1;
    var img = document.createElement('img'); img.alt = ''; img.decoding = 'async'; img.draggable = false;
    b.appendChild(img); stage.insertBefore(b, stage.firstChild); els.push(b);
  });
  /* DOM order: later posters first, so nearer-center posters can be layered by z-index */

  function stageW() { return stage.clientWidth; }
  function phPx() { return els[0].getBoundingClientRect().height || 440; }

  function layout() {
    var H = phPx(), W = H * 0.75;
    var narrow = stageW() < 640;
    var near = W * (narrow ? 0.66 : 0.68), gap = W * (narrow ? 0.13 : 0.17);
    for (var i = 0; i < N; i++) {
      var d = i - pos, a = Math.abs(d), s = d < 0 ? -1 : 1, e = els[i];
      if (a > 5.5) { if (!e.hidden) e.hidden = true; continue; }
      if (e.hidden) e.hidden = false;
      var t = Math.min(a, 1);
      var x = s * (near * t + Math.max(a - 1, 0) * gap);
      var ry = reduce ? 0 : -s * 42 * t;
      var sc = 1 - Math.min(a, 3) * 0.055 - (t < 1 ? (1 - t) * 0 : 0);
      var z = -Math.min(a, 3) * 90 + (1 - t) * 0;
      var br = 1 - Math.min(a, 3) * 0.16;
      e.style.setProperty('--x', x + 'px'); e.style.setProperty('--ry', ry + 'deg');
      e.style.setProperty('--s', sc); e.style.setProperty('--z', z + 'px');
      e.style.zIndex = 100 - Math.round(a * 10);
      e.style.filter = br < 0.999 ? 'brightness(' + br + ')' : '';
      e.style.pointerEvents = a > 4.2 ? 'none' : '';
    }
  }
  /* the section stays hidden until the first poster image has really loaded */
  var section = document.getElementById('posters');
  function reveal() { if (section) section.hidden = false; layout(); requestAnimationFrame(layout); }
  function ensureImages() {
    var c = Math.round(target);
    for (var i = Math.max(0, c - 6); i <= Math.min(N - 1, c + 6); i++) {
      if (!loaded[i]) {
        loaded[i] = 1;
        if (i === 0) els[0].firstChild.addEventListener('load', reveal, { once: true });
        els[i].firstChild.src = 'assets/posters/t/' + P[i].f + '.jpg';
      }
    }
  }
  function updateInfo() {
    var c = Math.round(clamp(target));
    cap.textContent = P[c].c;
    count.textContent = two(c + 1) + ' / ' + two(N);
    rail.value = c; rail.style.setProperty('--p', (N > 1 ? c / (N - 1) : 0) * 100 + '%');
    prevB.disabled = c === 0; nextB.disabled = c === N - 1;
    els.forEach(function (e, i) { e.setAttribute('aria-current', i === c ? 'true' : 'false'); });
  }
  function frame() {
    var d = target - pos;
    if (reduce || Math.abs(d) < 0.002) { pos = target; layout(); raf = 0; return; }
    pos += d * 0.17; layout(); raf = requestAnimationFrame(frame);
  }
  function go(t, instant) {
    target = clamp(t);
    updateInfo(); ensureImages();
    if (instant) { pos = target; layout(); return; }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  /* drag / swipe */
  var down = null, moved = 0, vel = 0, lastX = 0, lastT = 0;
  function step() { return phPx() * 0.75 * 0.55; }
  stage.addEventListener('pointerdown', function (e) {
    if (e.target.closest('.bin')) return;
    down = { x: e.clientX, y: e.clientY, pos: pos, id: e.pointerId, el: e.target.closest ? e.target.closest('.poster') : null }; moved = 0; vel = 0; lastX = e.clientX; lastT = performance.now();
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  });
  stage.addEventListener('pointermove', function (e) {
    if (!down) return;
    var dx = e.clientX - down.x; moved = Math.max(moved, Math.abs(dx));
    if (moved > 6) stage.classList.add('drag');
    var now = performance.now(), dt = now - lastT;
    if (dt > 0) { vel = 0.8 * vel + 0.2 * ((e.clientX - lastX) / dt); lastX = e.clientX; lastT = now; }
    if (moved > 6) { pos = target = clamp(down.pos - dx / step()); layout(); updateInfo(); ensureImages(); }
  });
  function endDrag(e) {
    if (!down) return;
    var wasDrag = moved > 6, tgtEl = down.el;
    down = null; stage.classList.remove('drag');
    if (wasDrag) { go(Math.round(clamp(pos - vel * 260 / step())), false); return; }
    if (tgtEl) {
      var i = +tgtEl.getAttribute('data-i');
      if (i === Math.round(target)) openZoom(i); else go(i, false);
    }
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', function () { down = null; stage.classList.remove('drag'); go(Math.round(pos), false); });

  /* wheel (horizontal only, so page scrolling is left alone) */
  var wheelAcc = 0, wheelT = 0;
  stage.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    wheelAcc += e.deltaX; clearTimeout(wheelT);
    var t = clamp(Math.round(target) + Math.trunc(wheelAcc / 90));
    if (Math.abs(wheelAcc) >= 90) { wheelAcc = 0; go(t, false); }
    wheelT = setTimeout(function () { wheelAcc = 0; }, 160);
  }, { passive: false });

  /* keys and buttons */
  stage.addEventListener('keydown', function (e) {
    var c = Math.round(target);
    if (e.key === 'ArrowLeft') { go(c - 1, false); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { go(c + 1, false); e.preventDefault(); }
    else if (e.key === 'Home') { go(0, false); e.preventDefault(); }
    else if (e.key === 'End') { go(N - 1, false); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { openZoom(c); e.preventDefault(); }
  });
  prevB.addEventListener('click', function () { go(Math.round(target) - 1, false); });
  nextB.addEventListener('click', function () { go(Math.round(target) + 1, false); });
  rail.addEventListener('input', function () { go(+rail.value, false); });

  /* zoom */
  function openZoom(i) {
    if (!zoom || !zoom.showModal) return;
    zImg.src = 'assets/posters/' + P[i].f + '.jpg';
    zImg.alt = 'Poster: ' + P[i].c;
    zCap.textContent = P[i].c;
    zoom.showModal();
  }
  if (zoom) {
    zClose.addEventListener('click', function () { zoom.close(); });
    zoom.addEventListener('click', function (e) { if (e.target === zoom) zoom.close(); });
    zoom.addEventListener('close', function () { zImg.removeAttribute('src'); });
  }

  window.addEventListener('resize', function () { layout(); });
  rail.max = N - 1;
  go(0, true);
  requestAnimationFrame(layout);
})();
