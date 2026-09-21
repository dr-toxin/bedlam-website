/* ---------- Show dates ----------
   The list comes from data/shows.json. The workflow .github/workflows/calendar-sync.yml rewrites that file
   from the band's public Google Calendar every 30 minutes (see scripts/sync_calendar.py for the rules).
   The raw GitHub copy is tried first because it updates within minutes, without waiting for a site redeploy;
   the copy served with the site is the fallback. */
var DATA_URLS = [
  'https://raw.githubusercontent.com/dr-toxin/bedlam-website/main/data/shows.json',
  'data/shows.json'
];
var SHOW_LENGTH_MS = 4 * 3600 * 1000;   // treated as "on stage now" for this long after start (24 hours for all-day events)
var TZ = 'America/Chicago';
var fmt = {
  wd:   new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }),
  mon:  new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'short' }),
  day:  new Intl.DateTimeFormat('en-US', { timeZone: TZ, day: 'numeric' }),
  time: new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' })
};
function parts(t) { var d = new Date(t); return { wd: fmt.wd.format(d), mon: fmt.mon.format(d), day: fmt.day.format(d), time: fmt.time.format(d) }; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* Google Maps directions: the street address when we have one, otherwise a search for the venue and its city */
var PIN = '<svg class="pin" viewBox="0 0 12 12" aria-hidden="true"><path fill="currentColor" d="M6 0a4 4 0 0 0-4 4c0 3 4 8 4 8s4-5 4-8a4 4 0 0 0-4-4zm0 5.5A1.5 1.5 0 1 1 6 2.5a1.5 1.5 0 0 1 0 3z"/></svg>';
function mapUrl(s) {
  var q = s.address ? s.venue + ', ' + s.address : s.venue + ', ' + s.city;
  return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(q);
}
/* venue and city; with a city or address on hand it becomes a link with an address tooltip (hover, focus or tap) */
function whereHtml(s, i) {
  if (!s.city && !s.address) return '<div class="tee-where"><strong>' + esc(s.venue) + '</strong></div>';
  var url = esc(mapUrl(s));
  return '<div class="tee-where">' +
    '<a class="venue-link" href="' + url + '" target="_blank" rel="noopener" aria-describedby="tip-' + i + '"><strong>' + esc(s.venue) + '</strong>' +
    (s.city ? '<span>' + PIN + esc(s.city) + '</span>' : '') + '</a>' +
    '<div class="map-tip" role="tooltip" id="tip-' + i + '"><span class="lbl">' + (s.address ? 'Address' : 'No street address yet') + '</span>' +
    '<span class="adr">' + esc(s.address || s.venue + ', ' + s.city) + '</span>' +
    '<a class="go" href="' + url + '" target="_blank" rel="noopener">Get directions &#8599;</a></div></div>';
}

/* try each address in turn; give back the list of shows, or null if none could be read */
function loadShows(done) {
  var i = 0, bust = '?t=' + Math.floor(Date.now() / 300000);
  (function next() {
    if (i >= DATA_URLS.length) return done(null);
    var url = DATA_URLS[i++] + bust;
    fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) { if (!d || !Array.isArray(d.shows)) throw new Error('bad data'); done(d.shows); })
      .catch(next);
  })();
}

(function shows() {
  var list = [];
  var el = {
    what: document.getElementById('sign-what'), when: document.getElementById('sign-when'),
    count: document.getElementById('sign-count'), live: document.getElementById('sign-live'),
    d: document.getElementById('c-d'), h: document.getElementById('c-h'), m: document.getElementById('c-m'), s: document.getElementById('c-s'),
    tee: document.getElementById('tee'), teeList: document.getElementById('tee-list'), title: document.getElementById('sign-title')
  };
  var current = null;

  function lengthOf(s) { return s.allDay ? 24 * 3600 * 1000 : SHOW_LENGTH_MS; }
  function upcoming() { var now = Date.now(); return list.filter(function (s) { return s.t + lengthOf(s) > now; }); }
  function timeText(s, p) { return s.allDay ? 'All day' : p.time + ' CT'; }

  function render() {
    var up = upcoming(), next = up[0];
    current = next || null;
    if (!next) {
      el.what.textContent = 'New dates coming soon';
      el.when.textContent = '';
      el.count.hidden = true; el.live.hidden = true; el.tee.hidden = true;
      return;
    }
    var p = parts(next.t);
    el.what.textContent = p.wd + ' ' + p.mon + ' ' + p.day + ' · ' + next.venue;
    el.when.textContent = [next.city, timeText(next, p), next.lineup].filter(Boolean).join(' · ');
    el.title.setAttribute('aria-label', 'Next show: ' + next.venue + ', ' + p.wd + ' ' + p.mon + ' ' + p.day);
    var rest = up.slice(1, 13);
    el.tee.hidden = rest.length === 0;
    el.teeList.innerHTML = rest.map(function (s, i) {
      var q = parts(s.t);
      var tag = (s.lineup ? '<em>' + esc(s.lineup) + '</em>' : '') + (s.url ? '<a href="' + esc(s.url) + '" rel="noopener" target="_blank">Details</a>' : '');
      return '<li class="tee-row"><div class="tee-date"><b>' + esc(q.mon + ' ' + q.day) + '</b><span>' + esc(q.wd) + ' · ' + esc(s.allDay ? 'All day' : q.time) + '</span></div>' +
             whereHtml(s, i) +
             '<div class="tee-tag">' + tag + '</div></li>';
    }).join('');
    tick();
  }

  function tick() {
    if (!current) return;
    var diff = current.t - Date.now();
    if (diff <= 0) {
      if (current.t + lengthOf(current) <= Date.now()) { render(); return; }
      el.count.hidden = true; el.live.hidden = false; return;
    }
    el.live.hidden = true; el.count.hidden = false;
    var sec = Math.floor(diff / 1000);
    el.d.textContent = pad(Math.floor(sec / 86400));
    el.h.textContent = pad(Math.floor(sec % 86400 / 3600));
    el.m.textContent = pad(Math.floor(sec % 3600 / 60));
    el.s.textContent = pad(sec % 60);
  }

  function refresh() {
    loadShows(function (rows) {
      if (rows === null) { if (!list.length) render(); return; }   // keep what is on screen if a refresh fails
      list = rows.map(function (s) { return { t: Date.parse(s.start), venue: s.venue || s.title, city: s.city || '', address: s.address || '', lineup: s.lineup || '', url: s.url || '', allDay: !!s.allDay }; })
                 .filter(function (s) { return !isNaN(s.t); })
                 .sort(function (a, b) { return a.t - b.t; });
      render();
    });
  }

  /* phones and tablets (no hover): the first tap on a venue opens its address, the link inside goes to Maps */
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('.venue-link');
    Array.prototype.forEach.call(el.teeList.querySelectorAll('.tee-where.open'), function (w) { if (!link || w !== link.parentNode) w.classList.remove('open'); });
    if (link && window.matchMedia('(hover: none)').matches) { e.preventDefault(); link.parentNode.classList.toggle('open'); }
  });

  refresh();
  setInterval(tick, 1000);
  setInterval(refresh, 10 * 60 * 1000);
})();
