/*
 * Layout som följer den yta som faktiskt finns, inte skärmens storlek.
 *
 * CSS sköter det mesta med container queries (se "Responsivt" i css/app.css). Det här
 * skriptet tar hand om det som beror på innehållet och därför måste mätas:
 *
 * Tabeller provas i tur och ordning:
 *   1. Hela tabellen, om den får plats.
 *   2. Utan kolumner som är markerade som mindre viktiga: först data-opt="2", sedan data-opt="1".
 *      Uppgifterna finns kvar i detaljvyn.
 *   3. Om ytan är smalare än 600 px: varje rad blir ett kort med etikett och värde.
 *   4. Annars rullar tabellen i sidled med första kolumnen fast.
 * Tabeller med data-fit="scroll" (matriser) rullar alltid i stället för att ändras.
 * Tabeller med flera rubrikrader (pivottabeller) rullar utan fast kolumn.
 *
 * Fliklistor som inte får plats rullar, och den valda fliken hålls synlig.
 */
var OOSLayout = (function () {
  var STACK_BELOW = 600;
  var MODES = ['hide-1', 'hide-2', 'stacked', 'scrolls'];

  /* ---------- Tabeller ---------- */

  function headerLabel(th) {
    var c = th.cloneNode(true);
    c.querySelectorAll('.sort').forEach(function (x) { x.remove(); });
    c.querySelectorAll('br').forEach(function (x) { x.replaceWith(' '); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }

  /* Märker varje cell med kolumnens rubrik och vikt. Görs en gång per omritning. */
  function prepare(table) {
    if (table.hasAttribute('data-fit-ready')) return;
    table.setAttribute('data-fit-ready', '');
    var head = table.tHead;
    if (!head || head.rows.length !== 1) {
      if (!table.hasAttribute('data-fit')) table.setAttribute('data-fit', 'pivot');
      return;
    }
    var cols = [];
    Array.prototype.forEach.call(head.rows[0].cells, function (th) {
      var opt = th.getAttribute('data-opt');
      if (opt) th.classList.add('opt-' + opt);
      for (var k = 0; k < (th.colSpan || 1); k++) cols.push({ label: headerLabel(th), opt: opt });
    });
    Array.prototype.forEach.call(table.tBodies, function (tb) {
      Array.prototype.forEach.call(tb.rows, function (tr) {
        var i = 0;
        Array.prototype.forEach.call(tr.cells, function (td) {
          var c = cols[i];
          if (c && td.colSpan === 1) {
            if (c.label) td.setAttribute('data-label', c.label);
            if (c.opt) td.classList.add('opt-' + c.opt);
            wrapValue(td);
          }
          i += td.colSpan || 1;
        });
      });
    });
  }

  /*
   * Cellens innehåll samlas i ett element, så att etikett och värde kan ställas mot varandra
   * när raden visas som kort. I vanlig tabell har det display: contents och påverkar inget.
   */
  function wrapValue(td) {
    var v = document.createElement('span');
    v.className = 'cv';
    while (td.firstChild) v.appendChild(td.firstChild);
    td.appendChild(v);
  }

  /*
   * När raderna visas som kort ändras tabellens display. Uttryckliga roller gör att
   * skärmläsare fortfarande uppfattar den som en tabell.
   */
  function setRoles(table, on) {
    var set = function (el, role) {
      if (on) el.setAttribute('role', role);
      else el.removeAttribute('role');
    };
    if (on === table.hasAttribute('role')) return;
    set(table, 'table');
    Array.prototype.forEach.call(table.querySelectorAll('thead, tbody'), function (g) { set(g, 'rowgroup'); });
    Array.prototype.forEach.call(table.rows, function (tr) {
      set(tr, 'row');
      Array.prototype.forEach.call(tr.cells, function (c) { set(c, c.tagName === 'TH' ? 'columnheader' : 'cell'); });
    });
  }

  function fits(wrap) {
    return wrap.scrollWidth <= wrap.clientWidth + 1;
  }

  function fitTable(table) {
    var wrap = table.parentElement;
    if (!wrap || !wrap.classList.contains('table-wrap')) return;
    prepare(table);
    MODES.forEach(function (m) { table.classList.remove(m); });
    setRoles(table, false);
    wrap.classList.remove('scrolling');
    if (fits(wrap)) return;
    var kind = table.getAttribute('data-fit');
    if (kind !== 'scroll' && kind !== 'pivot') {
      table.classList.add('hide-2');
      if (fits(wrap)) return;
      table.classList.add('hide-1');
      if (fits(wrap)) return;
      if (wrap.clientWidth < STACK_BELOW) {
        table.classList.remove('hide-1');
        table.classList.add('stacked');
        setRoles(table, true);
        return;
      }
    }
    table.classList.add('scrolls');
    wrap.classList.add('scrolling');
  }

  /* Ytor som rullar i sidled måste gå att nå och rulla med tangentbordet. */
  function markScrollable(scope) {
    scope.querySelectorAll('.table-wrap, .graph-wrap').forEach(function (w, i) {
      if (w.scrollWidth > w.clientWidth + 1) {
        var section = w.closest('.card');
        var title = section && section.querySelector('.card-title');
        w.setAttribute('tabindex', '0');
        w.setAttribute('role', 'region');
        w.setAttribute('aria-label', (title ? title.textContent : 'Tabell ' + (i + 1)) + (w.classList.contains('graph-wrap') ? ', karta' : ', tabell'));
      } else {
        w.removeAttribute('tabindex');
        w.removeAttribute('role');
        w.removeAttribute('aria-label');
      }
    });
  }

  /* ---------- Flikar ---------- */

  function tabEdges(tabs) {
    var max = tabs.scrollWidth - tabs.clientWidth;
    var over = max > 1;
    tabs.classList.toggle('overflows', over);
    tabs.classList.toggle('at-end', over && tabs.scrollLeft >= max - 1);
    tabs.classList.toggle('at-middle', over && tabs.scrollLeft > 1 && tabs.scrollLeft < max - 1);
  }

  function fitTabs(scope, reveal) {
    scope.querySelectorAll('.tabs').forEach(function (tabs) {
      if (reveal) {
        var on = tabs.querySelector('.tab.on');
        if (on && tabs.scrollWidth > tabs.clientWidth + 1) {
          var left = on.offsetLeft - tabs.offsetLeft;
          if (left < tabs.scrollLeft || left + on.offsetWidth > tabs.scrollLeft + tabs.clientWidth) {
            tabs.scrollLeft = Math.max(0, left - 32);
          }
        }
      }
      tabEdges(tabs);
    });
  }

  document.addEventListener('scroll', function (ev) {
    var t = ev.target;
    if (t && t.classList && t.classList.contains('tabs')) tabEdges(t);
  }, true);

  /* ---------- Samlat ---------- */

  /* Anpassar allt i scope. reveal = true efter en omritning, så att vald flik rullas fram. */
  function fit(scope, reveal) {
    scope.querySelectorAll('table.tbl').forEach(fitTable);
    fitTabs(scope, reveal);
    markScrollable(scope);
  }

  /*
   * Följer ytans bredd. Tabeller och flikar anpassas direkt.
   * onWidth anropas lite senare, när användaren slutat dra i fönstret, med den nya bredden.
   */
  function watch(el, onWidth) {
    var width = el.clientWidth;
    var frame = null;
    var timer = null;
    var react = function () {
      var w = el.clientWidth;
      if (w === width) return;
      width = w;
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () { fit(el, false); });
      clearTimeout(timer);
      timer = setTimeout(function () { onWidth(w); }, 140);
    };
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(react).observe(el);
    else window.addEventListener('resize', react);
  }

  return { fit: fit, watch: watch, STACK_BELOW: STACK_BELOW };
})();
