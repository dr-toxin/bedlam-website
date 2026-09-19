/* ---------- Neon sign: a tube that is failing ----------
   One or two letters of NEXT SHOW misbehave. Each has its own random schedule: a long quiet spell, then
   a burst of uneven stutters, sometimes a dip instead of a full cut, sometimes a long dead pause. */
(function neon() {
  var title = document.getElementById('sign-title');
  var sign = document.getElementById('sign');
  if (!title) return;
  var text = 'NEXT SHOW';
  title.innerHTML = '<span aria-hidden="true">' + text.split('').map(function (c) {
    return c === ' ' ? ' ' : '<span class="nl">' + c + '</span>';
  }).join('') + '</span>';
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var letters = Array.prototype.slice.call(title.querySelectorAll('.nl'));
  var pool = letters.slice(), picks = [], n = Math.random() < 0.5 ? 1 : 2;
  while (picks.length < n) { picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); }
  var offCount = 0;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function set(l, st) {
    var was = l.classList.contains('off') || l.classList.contains('dim');
    l.classList.remove('off', 'dim');
    if (st) l.classList.add(st);
    var now = st === 'off' ? 1 : 0;
    if (!was && now) offCount++; else if (was && !now && offCount > 0) offCount--;
    sign.style.setProperty('--bloom', offCount ? 0.78 : 1);
  }
  function burst(l, done) {
    var steps = Math.floor(rnd(2, 7)), i = 0;
    (function step() {
      if (i >= steps) { set(l, null); return done(); }
      var st = Math.random() < 0.3 ? 'dim' : 'off';
      set(l, i % 2 === 0 ? st : null);
      i++;
      setTimeout(step, rnd(30, 240));
    })();
  }
  function cycle(l) {
    setTimeout(function () {
      burst(l, function () {
        if (Math.random() < 0.18) {                      // the tube dies for a moment
          set(l, 'off');
          setTimeout(function () { set(l, 'dim'); setTimeout(function () { set(l, null); cycle(l); }, rnd(80, 260)); }, rnd(350, 1500));
        } else cycle(l);
      });
    }, rnd(1500, 9000));
  }
  picks.forEach(function (l, i) { setTimeout(function () { cycle(l); }, rnd(600, 3500) + i * 1300); });
})();
