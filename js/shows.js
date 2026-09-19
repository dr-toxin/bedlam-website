/* ---------- Show dates ----------
   SAMPLE DATA. Replace with the calendar feed from n8n. Each show needs an ISO start time with its
   UTC offset (Central is -05:00 in daylight time and -06:00 in standard time). */
var SHOWS = [
  { start: '2026-10-02T20:00:00-05:00', venue: 'The Copper Room',      area: 'Soulard',            city: 'St. Louis, MO', lineup: 'Full band' },
  { start: '2026-10-16T20:30:00-05:00', venue: 'Maple & Main',         area: '',                   city: 'Maplewood, MO', lineup: 'Full band' },
  { start: '2026-10-24T19:00:00-05:00', venue: 'Riverbend Winery',     area: '',                   city: 'Augusta, MO',   lineup: 'Trio', url: '#shows' },
  { start: '2026-11-07T20:00:00-06:00', venue: 'Grove Brewing Co.',    area: 'The Grove',          city: 'St. Louis, MO', lineup: 'Full band' },
  { start: '2026-11-21T19:30:00-06:00', venue: 'Barrel House',         area: 'Downtown',           city: 'St. Louis, MO', lineup: 'Duo' },
  { start: '2026-12-05T20:00:00-06:00', venue: 'Club Atmos',           area: 'Central West End',   city: 'St. Louis, MO', lineup: 'Duo' },
  { start: '2026-12-31T21:00:00-06:00', venue: 'The Copper Room',      area: 'New Year’s Eve', city: 'St. Louis, MO', lineup: 'Full band', url: '#shows' },
  { start: '2027-01-16T20:00:00-06:00', venue: 'Maple & Main',         area: '',                   city: 'Maplewood, MO', lineup: 'Full band' }
];
var SHOW_LENGTH_MS = 4 * 3600 * 1000;   // treated as "on stage now" for this long after start
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

(function shows() {
  var list = SHOWS.map(function (s) { return Object.assign({ t: Date.parse(s.start) }, s); }).sort(function (a, b) { return a.t - b.t; });
  var el = {
    what: document.getElementById('sign-what'), when: document.getElementById('sign-when'),
    count: document.getElementById('sign-count'), live: document.getElementById('sign-live'),
    d: document.getElementById('c-d'), h: document.getElementById('c-h'), m: document.getElementById('c-m'), s: document.getElementById('c-s'),
    tee: document.getElementById('tee'), teeList: document.getElementById('tee-list'), title: document.getElementById('sign-title')
  };
  var current = null;

  function upcoming() { var now = Date.now(); return list.filter(function (s) { return s.t + SHOW_LENGTH_MS > now; }); }

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
    el.when.textContent = next.city + ' · ' + p.time + ' CT' + (next.lineup ? ' · ' + next.lineup : '');
    el.title.setAttribute('aria-label', 'Next show: ' + next.venue + ', ' + p.wd + ' ' + p.mon + ' ' + p.day);
    var rest = up.slice(1);
    el.tee.hidden = rest.length === 0;
    el.teeList.innerHTML = rest.map(function (s) {
      var q = parts(s.t);
      var tag = '<em>' + esc(s.lineup || '') + '</em>' + (s.url ? '<a href="' + esc(s.url) + '" rel="noopener">Tickets</a>' : '');
      return '<li class="tee-row"><div class="tee-date"><b>' + esc(q.mon + ' ' + q.day) + '</b><span>' + esc(q.wd) + ' · ' + esc(q.time) + '</span></div>' +
             '<div class="tee-where"><strong>' + esc(s.venue) + '</strong><span>' + esc((s.area ? s.area + ' · ' : '') + s.city) + '</span></div>' +
             '<div class="tee-tag">' + tag + '</div></li>';
    }).join('');
    tick();
  }

  function tick() {
    if (!current) return;
    var diff = current.t - Date.now();
    if (diff <= 0) {
      if (current.t + SHOW_LENGTH_MS <= Date.now()) { render(); return; }
      el.count.hidden = true; el.live.hidden = false; return;
    }
    el.live.hidden = true; el.count.hidden = false;
    var sec = Math.floor(diff / 1000);
    el.d.textContent = pad(Math.floor(sec / 86400));
    el.h.textContent = pad(Math.floor(sec % 86400 / 3600));
    el.m.textContent = pad(Math.floor(sec % 3600 / 60));
    el.s.textContent = pad(sec % 60);
  }

  render();
  setInterval(tick, 1000);
})();
