/* Marquee bulbs: as many whole bulbs as fit, spread evenly, so no half bulb is clipped at an edge. */
(function () {
  var rows = document.querySelectorAll('.bulbs');
  var PITCH = 28;
  function fill(row) {
    var n = Math.max(2, Math.floor((row.clientWidth + 16) / PITCH));
    if (row.getAttribute('data-n') === String(n)) return;
    row.setAttribute('data-n', n);
    row.querySelectorAll('.bulb').forEach(function (b) { b.remove(); });
    for (var i = 0; i < n; i++) { var b = document.createElement('span'); b.className = 'bulb'; row.appendChild(b); }
    row.classList.add('js');
  }
  function all() { rows.forEach(fill); }
  all();
  if (window.ResizeObserver) { var ro = new ResizeObserver(all); rows.forEach(function (r) { ro.observe(r); }); }
  else window.addEventListener('resize', all);
})();
