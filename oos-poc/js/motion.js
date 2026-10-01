/*
 * Rörelse i Fabriken, byggd på anime.js (MIT, js/vendor).
 *
 * Regler (se DESIGN.md):
 * - Rörelse förklarar en förändring: något kommer in, växer till sitt värde eller flyttar sig.
 * - Kort: 200–800 ms. Inga loopar, ingen studs utöver en liten fjäder när något flyttas.
 * - Den som valt minskad rörelse i operativsystemet får inga animationer alls.
 * - Om biblioteket saknas fungerar allt precis som förut, utan rörelse.
 *
 * Appen ritar om vyer med innerHTML. Därför tas en ögonblicksbild av staplar, siffror och
 * tabellrader före omritningen, och nya element animeras från de gamla värdena efteråt.
 */
var OOSMotion = (function () {
  var A = typeof anime !== 'undefined' ? anime : null;
  var EASE = 'out(3)';
  var BARS = '.bar-fill, .loadbar-fill, .cbar, .stack100-seg, .depth-seg, .pbar';
  var NUMS = '.kpi-value, .lede strong, .big, .donut text';
  var COUNT_ON_ENTER = '.kpi-value, .lede strong';
  var nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });

  function reduced() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  function enabled() {
    return !!A && !reduced();
  }

  /*
   * Kör en animation och tar bort de inline-stilar den lagt till när den är klar.
   * Kvarvarande transform skulle annars skapa nya staplingskontexter i layouten.
   */
  function run(targets, params) {
    params.onComplete = function (anim) { A.utils.cleanInlineStyles(anim); };
    return A.animate(targets, params);
  }

  /* ---------- Nycklar som överlever en omritning ---------- */

  function hostKey(el) {
    var host = el.closest('[data-go], [data-id], .kpi, .kpi-item, [data-tip]');
    if (!host) return '';
    if (host.hasAttribute('data-go')) return host.getAttribute('data-go');
    if (host.hasAttribute('data-id')) return host.getAttribute('data-id');
    var label = host.querySelector('.kpi-label');
    if (label) return label.textContent;
    return host.getAttribute('data-tip') || '';
  }

  function keyed(scope, selector, fn) {
    var count = new Map();
    scope.querySelectorAll(selector).forEach(function (el) {
      var base = selector + '|' + hostKey(el);
      var n = count.get(base) || 0;
      count.set(base, n + 1);
      fn(el, base + '|' + n);
    });
  }

  /* ---------- Siffror ---------- */

  var NUM_RE = /^(\D*?)([\u2212\-+\u00b1]?)(\d(?:[\d\s\u00a0\u202f]*\d)?)(.*)$/;

  function parseNum(text) {
    var m = NUM_RE.exec(text || '');
    if (!m) return null;
    /* Bara heltal. Decimaler skulle visas fel under räkningen. */
    if (/^[,.]\d/.test(m[4])) return null;
    var v = parseInt(m[3].replace(/[\s\u00a0\u202f]/g, ''), 10);
    if (isNaN(v)) return null;
    if (m[2] === '−' || m[2] === '-') v = -v;
    return { prefix: m[1], signed: m[2] !== '', value: v, suffix: m[4] };
  }

  function formatNum(p, v) {
    var r = Math.round(v);
    var sign = p.signed ? (r > 0 ? '+' : r < 0 ? '−' : '±') : r < 0 ? '−' : '';
    return p.prefix + sign + nf.format(Math.abs(r)) + p.suffix;
  }

  function tweenNumber(el, from, delay) {
    /* Element med egen markup räknas inte, textContent skulle skriva över den. */
    if (el.children.length) return;
    var to = parseNum(el.textContent);
    if (!to || to.value === from) return;
    var finalText = el.textContent;
    var state = { v: from };
    el.textContent = formatNum(to, from);
    A.animate(state, {
      v: to.value,
      duration: 600,
      delay: delay || 0,
      ease: EASE,
      onUpdate: function () { el.textContent = formatNum(to, state.v); },
      onComplete: function () { el.textContent = finalText; }
    });
  }

  /* ---------- Ögonblicksbild före omritning ---------- */

  function snapshot(scope) {
    var snap = { bars: new Map(), cols: new Map(), marks: new Map(), rings: new Map(), nums: new Map(), rows: new Map(), charts: new Set(), morph: new Map(), lk: new Set() };
    if (!enabled() || !scope.firstChild) return snap;
    scope.querySelectorAll('[data-chart]').forEach(function (el) { snap.charts.add(el.getAttribute('data-chart')); });
    scope.querySelectorAll('[data-morph]').forEach(function (el) { snap.morph.set(el.getAttribute('data-morph'), el.style.width); });
    scope.querySelectorAll('.lk-row').forEach(function (el) { snap.lk.add(el.id); });
    keyed(scope, BARS, function (el, k) { snap.bars.set(k, el.style.width); });
    keyed(scope, '.col-bar', function (el, k) { snap.cols.set(k, el.style.height); });
    keyed(scope, '.bullet-mark', function (el, k) { snap.marks.set(k, el.style.left); });
    keyed(scope, '.donut .val', function (el, k) { snap.rings.set(k, el.getAttribute('stroke-dasharray')); });
    keyed(scope, NUMS, function (el, k) {
      var p = el.children.length ? null : parseNum(el.textContent);
      if (p) snap.nums.set(k, p.value);
    });
    scope.querySelectorAll('tr[data-go]').forEach(function (tr) {
      snap.rows.set(tr.getAttribute('data-go'), tr.getBoundingClientRect().top);
    });
    return snap;
  }

  /* ---------- Entré: sida eller flik ---------- */

  function growBars(scope, startDelay) {
    var bars = scope.querySelectorAll(BARS);
    if (bars.length) {
      run(bars, { scaleX: [0, 1], duration: 650, delay: A.stagger(6, { start: startDelay }), ease: 'out(4)' });
    }
    var cols = scope.querySelectorAll('.col-bar');
    if (cols.length) {
      run(cols, { scaleY: [0, 1], duration: 650, delay: A.stagger(50, { start: startDelay }), ease: 'out(4)' });
    }
    scope.querySelectorAll('.bullet-mark').forEach(function (el, i) {
      run(el, { left: ['0%', el.style.left], opacity: [0, 1], duration: 700, delay: startDelay + i * 40, ease: 'out(4)' });
    });
    scope.querySelectorAll('.donut .val').forEach(function (el) {
      var full = el.getAttribute('stroke-dasharray');
      var c = full.split(' ')[1];
      A.animate(el, { strokeDasharray: ['0 ' + c, full], duration: 800, delay: startDelay, ease: 'out(3)' });
    });
  }

  function enter(scope, items) {
    if (!items.length) return;
    run(items, { opacity: [0, 1], translateY: [8, 0], duration: 360, delay: A.stagger(45), ease: EASE });
    growBars(scope, 120);
    scope.querySelectorAll(COUNT_ON_ENTER).forEach(function (el, i) {
      var p = parseNum(el.textContent);
      if (p && Math.abs(p.value) >= 10) tweenNumber(el, 0, 80 + i * 30);
    });
    var graph = scope.querySelector('.graph');
    if (graph) drawEdges(graph, null, 200);
    scope.querySelectorAll('[data-chart]').forEach(function (el) { drawChart(el, 220, true); });
  }

  /*
   * Bilderna av arbetet byggs upp i den ordning man läser dem. I tidslinjen växer staplarna ut
   * från sitt startdatum, sedan dyker beroendenas romber upp och linjerna ritas. I kopplingarna
   * växer staplarna första gången, och linjerna för ett val ritas från vänster till höger.
   * fresh är sant när bilden visas första gången, falskt när den ritas om efter ett val.
   */
  function drawChart(el, delay, fresh) {
    if (!enabled()) return;
    var d = delay || 0;
    if (el.classList.contains('tl')) {
      var bars = el.querySelectorAll('.tl-bar');
      if (bars.length) run(bars, { scaleX: [0, 1], duration: 560, delay: A.stagger(14, { start: d }), ease: 'out(4)' });
      var today = el.querySelector('.tl-today');
      if (today) run(today, { opacity: [0, 1], duration: 400, delay: d + 200, ease: EASE });
      var marks = el.querySelectorAll('.tl-mark');
      if (marks.length) run(marks, { opacity: [0, 1], scale: [0.4, 1], duration: 300, delay: A.stagger(40, { start: d + 480 }), ease: 'out(3)' });
      var delays = el.querySelectorAll('.tl-delay');
      if (delays.length) run(delays, { scaleX: [0, 1], duration: 420, delay: d + 640, ease: 'out(3)' });
      el.querySelectorAll('.tl-link:not([hidden]) .cline').forEach(function (path, i) {
        A.animate(A.svg.createDrawable(path), { draw: ['0 0', '0 1'], duration: 420, delay: d + 520 + i * 40, ease: 'inOut(2)' });
      });
    } else if (el.classList.contains('lk')) {
      if (fresh) {
        var lbars = el.querySelectorAll('.lbar');
        if (lbars.length) run(lbars, { scaleX: [0, 1], duration: 600, delay: A.stagger(10, { start: d }), ease: 'out(4)' });
      }
      el.querySelectorAll('.lk-link:not([hidden]) .cline').forEach(function (path, i) {
        var col = +path.parentNode.getAttribute('data-c');
        A.animate(A.svg.createDrawable(path), { draw: ['0 0', '0 1'], duration: 480, delay: d + 80 + col * 260 + (i % 12) * 18, ease: 'inOut(2)' });
      });
    } else if (el.classList.contains('chain')) {
      /* Epiken först, sedan det den väntar på och det som väntar på den, sist pilarna mellan dem. */
      var mid = el.querySelector('.chain-col.mid .chain-node');
      if (mid) run(mid, { opacity: [0, 1], scale: [0.96, 1], duration: 380, delay: d, ease: EASE });
      var sides = el.querySelectorAll('.chain-col.in .chain-node, .chain-col.out .chain-node, .chain-none');
      if (sides.length) run(sides, { opacity: [0, 1], translateY: [6, 0], duration: 360, delay: A.stagger(60, { start: d + 140 }), ease: EASE });
      var edgeSvg = el.querySelector('.chain-edges');
      if (!edgeSvg || !edgeSvg.getClientRects().length) return; /* smal layout: pilarna är stilade linjer */
      el.querySelectorAll('.cedge').forEach(function (g, i) {
        var at = d + 320 + i * 80;
        A.animate(A.svg.createDrawable(g.querySelector('.cline')), { draw: ['0 0', '0 1'], duration: 480, delay: at, ease: 'inOut(2)' });
        run(g.querySelector('.carrow'), { opacity: [0, 1], duration: 160, delay: at + 400, ease: EASE });
      });
    }
  }

  /* ---------- Uppdatering: från gamla värden till nya ---------- */

  function update(scope, snap) {
    var newBars = [];
    keyed(scope, BARS, function (el, k) {
      if (!snap.bars.has(k)) { newBars.push(el); return; }
      var old = snap.bars.get(k);
      if (old && old !== el.style.width) A.animate(el, { width: [old, el.style.width], duration: 550, ease: EASE });
    });
    if (newBars.length && newBars.length <= 60 && snap.bars.size) {
      run(newBars, { scaleX: [0, 1], duration: 500, delay: A.stagger(8), ease: 'out(4)' });
    }
    keyed(scope, '.col-bar', function (el, k) {
      var old = snap.cols.get(k);
      if (old && old !== el.style.height) A.animate(el, { height: [old, el.style.height], duration: 550, ease: EASE });
    });
    keyed(scope, '.bullet-mark', function (el, k) {
      var old = snap.marks.get(k);
      if (old && old !== el.style.left) A.animate(el, { left: [old, el.style.left], duration: 550, ease: EASE });
    });
    keyed(scope, '.donut .val', function (el, k) {
      var old = snap.rings.get(k);
      var now = el.getAttribute('stroke-dasharray');
      if (old && old !== now) A.animate(el, { strokeDasharray: [old, now], duration: 600, ease: EASE });
    });
    keyed(scope, NUMS, function (el, k) {
      if (snap.nums.has(k)) tweenNumber(el, snap.nums.get(k), 0);
    });
    /* Tabellrader som bytt plats glider dit, nya rader tonas in. */
    var fresh = [];
    scope.querySelectorAll('tr[data-go]').forEach(function (tr) {
      var key = tr.getAttribute('data-go');
      if (!snap.rows.has(key)) { fresh.push(tr); return; }
      var dy = snap.rows.get(key) - tr.getBoundingClientRect().top;
      if (Math.abs(dy) > 2) run(tr, { translateY: [dy, 0], duration: 420, ease: EASE });
    });
    if (fresh.length && fresh.length <= 15 && snap.rows.size) {
      run(fresh, { opacity: [0, 1], duration: 260, delay: A.stagger(25), ease: EASE });
    }
    /* Delar av en stapel glider till sina nya värden. Nya delar växer från noll. */
    scope.querySelectorAll('[data-morph]').forEach(function (el) {
      var k = el.getAttribute('data-morph');
      var old = snap.morph.get(k);
      if (old === undefined && !snap.morph.size) return;
      if (old === undefined) old = '0%';
      if (old !== el.style.width) A.animate(el, { width: [old, el.style.width], duration: 520, ease: EASE });
    });
    /* Rader som kommer till i kopplingarna tonas in. */
    if (snap.lk.size) {
      var freshRows = Array.prototype.filter.call(scope.querySelectorAll('.lk-row'), function (el) { return !snap.lk.has(el.id); });
      if (freshRows.length) run(freshRows, { opacity: [0, 1], translateY: [4, 0], duration: 280, delay: A.stagger(20), ease: EASE });
    }
    /* En bild med nytt innehåll (annan gruppering, period, epik eller ett nytt val) byggs upp igen. */
    scope.querySelectorAll('[data-chart]').forEach(function (el) {
      if (!snap.charts.has(el.getAttribute('data-chart'))) drawChart(el, 60, false);
    });
  }

  /* Det som står efter en fliklista. Är det en enda behållare animeras dess delar var för sig. */
  function panelItems(tablist) {
    var items = [];
    for (var n = tablist.nextElementSibling; n; n = n.nextElementSibling) items.push(n);
    if (items.length === 1 && items[0].children.length > 1) items = Array.prototype.slice.call(items[0].children);
    return items;
  }

  /*
   * Spelar rätt sorts rörelse efter en omritning.
   * hint: 'nav' (ny sida), 'tab' (ny flik, fliklistan anges), 'detail' (ny post i en lista med detaljvy),
   * 'update' (data ändrades) eller 'quiet' (ingen rörelse, till exempel vid sökning och bläddring).
   */
  function play(scope, snap, hint, tablist) {
    if (!enabled() || hint === 'quiet') return;
    try {
      if (hint === 'nav') enter(scope, Array.prototype.slice.call(scope.children));
      else if (hint === 'tab' && tablist) enter(tablist.parentNode, panelItems(tablist));
      else {
        if (snap) update(scope, snap);
        if (hint === 'detail') reveal(scope.querySelector('#detail'));
      }
    } catch (e) {
      /* Rörelse får aldrig stoppa appen. */
      if (window.console) console.warn('Animation hoppades över:', e);
    }
  }

  /* ---------- Kopplingskartan ---------- */

  /* Noderna glider med en lätt fjäder från gamla till nya platser. */
  function moveNodes(svg, old) {
    if (!enabled() || !old || !old.size) return;
    var springy = A.spring({ bounce: 0.1, duration: 520 });
    svg.querySelectorAll('.gnode').forEach(function (el) {
      var o = old.get(el.getAttribute('data-id'));
      var nx = +el.getAttribute('data-x');
      var ny = +el.getAttribute('data-y');
      if (!o || (+o.x === nx && +o.y === ny)) return;
      A.animate(el, { translateX: [+o.x, nx], translateY: [+o.y, ny], ease: springy });
    });
  }

  /*
   * Linjerna ritas ut i beroendeordning: från den valda noden och utåt,
   * eller från vänster till höger när ingen nod är vald. Streckade linjer tonas in.
   */
  function drawEdges(svg, selCol, startDelay) {
    if (!enabled()) return;
    var base = startDelay || 0;
    svg.querySelectorAll('.edge').forEach(function (path) {
      var c = +path.getAttribute('data-c');
      var dist = selCol === null || selCol === undefined ? c : Math.abs(c + 0.5 - selCol);
      var delay = base + dist * 110;
      if (path.classList.contains('support')) {
        run(path, { opacity: [0, 1], duration: 420, delay: delay + 120, ease: EASE });
      } else {
        A.animate(A.svg.createDrawable(path), { draw: ['0 0', '0 1'], duration: 520, delay: delay, ease: 'inOut(2)' });
      }
    });
  }

  /* ---------- Enskilda element ---------- */

  /* Ett block som fått nytt innehåll tonas fram. */
  function reveal(el) {
    if (!enabled() || !el || el.length === 0) return;
    run(el, { opacity: [0, 1], translateY: [6, 0], duration: 300, delay: el.length > 1 ? A.stagger(25) : 0, ease: EASE });
  }

  function dialogIn(el) {
    if (!enabled() || !el) return;
    run(el, { opacity: [0, 1], scale: [0.97, 1], translateY: [6, 0], duration: 240, ease: EASE });
  }

  function toastIn(el) {
    if (!enabled() || !el) return;
    run(el, { opacity: [0, 1], translateY: [12, 0], duration: 260, ease: EASE });
  }

  function toastOut(el, done) {
    if (!enabled()) { done(); return; }
    A.animate(el, { opacity: [1, 0], translateY: [0, 6], duration: 200, ease: 'in(2)', onComplete: done });
  }

  return {
    drawChart: drawChart,
    enabled: enabled,
    snapshot: snapshot,
    play: play,
    moveNodes: moveNodes,
    drawEdges: drawEdges,
    reveal: reveal,
    dialogIn: dialogIn,
    toastIn: toastIn,
    toastOut: toastOut,
    _parseNum: parseNum,
    _formatNum: formatNum
  };
})();
