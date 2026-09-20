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
    el.teeList.innerHTML = rest.map(function (s) {
      var q = parts(s.t);
      var tag = (s.lineup ? '<em>' + esc(s.lineup) + '</em>' : '') + (s.url ? '<a href="' + esc(s.url) + '" rel="noopener" target="_blank">Details</a>' : '');
      return '<li class="tee-row"><div class="tee-date"><b>' + esc(q.mon + ' ' + q.day) + '</b><span>' + esc(q.wd) + ' · ' + esc(s.allDay ? 'All day' : q.time) + '</span></div>' +
             '<div class="tee-where"><strong>' + esc(s.venue) + '</strong>' + (s.city ? '<span>' + esc(s.city) + '</span>' : '') + '</div>' +
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
      list = rows.map(function (s) { return { t: Date.parse(s.start), venue: s.venue || s.title, city: s.city || '', lineup: s.lineup || '', url: s.url || '', allDay: !!s.allDay }; })
                 .filter(function (s) { return !isNaN(s.t); })
                 .sort(function (a, b) { return a.t - b.t; });
      render();
    });
  }

  refresh();
  setInterval(tick, 1000);
  setInterval(refresh, 10 * 60 * 1000);
})();
