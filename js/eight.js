/* ---------- 8-track video data ----------
   One cartridge per video (four fill the panel neatly, and more work too). Each one needs the numbers from the video's Groove "Share & embed" tab:
   gid = the id in the embed code, permalink = the permalink in the embed code, page = the Public URL.
   An empty slot is just null. To add a video, add an object like the others (or replace a null).
   page is optional. whitaker: true marks the video the hero's "Watch the set" link jumps to. */
var VIDEOS = [
  { title: 'Big River', artist: 'Johnny Cash', detail: 'Whitaker Music Festival · Jul 29, 2026', whitaker: true,
    gid: '309671', permalink: 'G9ygMm6c3tjyZJxSm8UO', page: '' },
  { title: 'Clyde', artist: 'J.J. Cale', detail: 'Whitaker Music Festival · Jul 29, 2026', whitaker: true,
    gid: '309660', permalink: 'mw3ENGdZbTeDkPaSoKr7',
    page: 'https://app.groove.cm/groovevideo/videopage/309660/qth0u07a0678f245e3d75881a6179fe3cf2ba' },
  { title: 'Rainy Day Women #12 & 35', artist: 'Bob Dylan', detail: 'Whitaker Music Festival · Jul 29, 2026', whitaker: true,
    gid: '309672', permalink: '8kxdyR3PYXRHh9jItoiW', page: '' },
  { title: 'Knockin’ On Heaven’s Door', artist: 'Bob Dylan', detail: 'Whitaker Music Festival · Jul 29, 2026', whitaker: true,
    gid: '309677', permalink: 'xhiQOZxfrapVjxso536f', page: '' },
  { title: 'Runnin’ Down A Dream', artist: 'Tom Petty', detail: '9 Mile Garden · Aug 22, 2026',
    gid: '309661', permalink: 'iuSS4n0fKJlvUdc6R3u2',
    page: 'https://app.groove.cm/groovevideo/videopage/309661/4pyr76c6ba4adb751ce308c75325f41868cb9' }
];

/* ---------- 8-track video player ---------- */
(function eight() {
  var root = document.getElementById('eight');
  if (!root || !window.VIDEOS) return;
  var V = window.VIDEOS;
  var $ = function (id) { return document.getElementById(id); };
  var screen = $('e-screen'), list = $('e-list'), lampsEl = $('e-lamps'), meta = $('e-meta'), title = $('e-title'), sub = $('e-sub');
  var progB = $('e-prog'), ejectB = $('e-eject');
  var cur = -1, assetsAsked = false, checkT = 0;
  function two(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* the cartridge list and the four lamps */
  V.forEach(function (v, i) {
    var li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.className = 'cartridge' + (v ? '' : ' empty'); b.setAttribute('data-i', i);
    if (v) {
      b.innerHTML = '<span class="no">' + (i + 1) + '</span><span><span class="t">' + esc(v.title) + '</span><span class="s">' + esc(v.artist + (v.detail ? ' · ' + v.detail : '')) + '</span></span>';
    } else {
      b.disabled = true;
      b.innerHTML = '<span class="no">' + (i + 1) + '</span><span><span class="t">Empty slot</span><span class="s">Cartridge coming soon</span></span>';
    }
    li.appendChild(b); list.appendChild(li);
    var lamp = document.createElement('i'); lamp.className = 'lamp'; lampsEl.appendChild(lamp);
  });
  var rows = list.querySelectorAll('.cartridge'), lamps = lampsEl.querySelectorAll('.lamp');

  function paint() {
    rows.forEach(function (r, i) { if (i === cur) r.setAttribute('aria-current', 'true'); else r.removeAttribute('aria-current'); });
    lamps.forEach(function (l, i) { l.classList.toggle('on', i === cur); });
    if (cur >= 0 && rows[cur]) {   /* keep the playing cartridge visible in the scrolling list (moves the list only, not the page) */
      var li = rows[cur].parentNode, top = li.offsetTop, bottom = top + li.offsetHeight;
      if (top < list.scrollTop) list.scrollTop = top;
      else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    }
    if (cur < 0) { meta.textContent = 'No cartridge'; title.textContent = 'Pick a track'; sub.textContent = 'Press a cartridge to load it'; return; }
    var v = V[cur];
    meta.textContent = 'Track ' + (cur + 1) + ' of ' + V.length;
    title.textContent = v.title;
    sub.textContent = v.artist + (v.detail ? ' · ' + v.detail : '');
  }

  /* Groove's widget is loaded the way their embed code does it: the stylesheet, the element, then the script. */
  function loadAssets() {
    if (assetsAsked) return; assetsAsked = true;
    var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://widget.groovevideo.com/widget/app.css'; document.head.appendChild(l);
    var s = document.createElement('script'); s.src = 'https://widget.groovevideo.com/widget/app.js'; document.body.appendChild(s);
  }
  function standby(html) { screen.innerHTML = '<div class="standby">' + html + '</div>'; }
  function mount(i) {
    var v = V[i]; if (!v) return;
    clearTimeout(checkT);
    started = true;   /* a chosen cartridge cancels the start-up autoload */
    cur = i; paint();
    screen.innerHTML = '';
    var w = document.createElement('groovevideo-widget');
    w.setAttribute('id', v.gid); w.setAttribute('permalink', v.permalink);
    screen.appendChild(w);
    loadAssets();
    checkT = setTimeout(function () {
      if (cur === i && !w.children.length && !w.shadowRoot) {
        standby('<b>Player didn’t load</b>' + (v.page ? '<span>Open this video on Groove:</span><a href="' + esc(v.page) + '" target="_blank" rel="noopener">' + esc(v.title) + '</a>' : '<span>Please try again in a moment</span>'));
      }
    }, 9000);
  }
  function eject() {
    clearTimeout(checkT); cur = -1; paint();
    standby('<b>Cartridge ejected</b><span>Pick a track to load it</span>');
  }
  function next() {
    for (var k = 1; k <= V.length; k++) {
      var i = (cur + k + V.length) % V.length;
      if (V[i]) { mount(i); return; }
    }
  }

  list.addEventListener('click', function (e) { var b = e.target.closest('.cartridge'); if (b && !b.disabled) mount(+b.getAttribute('data-i')); });
  progB.addEventListener('click', next);
  ejectB.addEventListener('click', eject);

  standby('<b>Insert a cartridge</b><span>Loading the first track</span>');
  paint();
  var started = false;
  var wl = document.querySelector('.plaque-link');   /* the hero's "Watch the set" link */
  if (wl) wl.addEventListener('click', function () {
    for (var i = 0; i < V.length; i++) if (V[i] && V[i].whitaker) { started = true; mount(i); break; }
  });
  function start() { if (started) return; started = true; for (var i = 0; i < V.length; i++) if (V[i]) { mount(i); break; } }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); start(); } }, { rootMargin: '500px 0px' });
    io.observe(root);
  } else start();
})();
