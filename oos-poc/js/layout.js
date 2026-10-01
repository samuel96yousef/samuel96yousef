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
    /* Bara tabellens egna delar. En tabell kan innehålla en annan, till exempel i en utfälld rad. */
    [table.tHead].concat(Array.prototype.slice.call(table.tBodies)).filter(Boolean).forEach(function (g) { set(g, 'rowgroup'); });
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

  /* ---------- Text ---------- */

  /*
   * Stora tal och korta rubriker som inte kan radbrytas (till exempel "152 380 kr" med hårt
   * mellanslag) krymps tills de får plats, men aldrig under 60 % av sin vanliga storlek.
   */
  var FIT = '.kpi-value, .big, .facts-mini strong, .period-now, .detail-title, .page-title';

  function fitText(scope) {
    scope.querySelectorAll(FIT).forEach(function (el) {
      el.style.fontSize = '';
      if (el.scrollWidth <= el.clientWidth + 1 || !el.clientWidth) return;
      var base = parseFloat(getComputedStyle(el).fontSize);
      var size = Math.max(base * 0.6, Math.floor((base * el.clientWidth) / el.scrollWidth));
      el.style.fontSize = size + 'px';
    });
  }

  /*
   * Mjuka bindestreck i långa sammansatta ord, vid de leder som är vanliga i OOS.
   * Webbläsaren visar bara bindestrecket om ordet behöver brytas där. Webbläsarnas egen
   * avstavning saknar ofta svenska, därför görs det här.
   */
  var STEMS = /^(verksamhets|leverans|kompetens|kapacitets|belastnings|beläggnings|allokerings|utvecklings|rapporterings|förändrings|utbetalnings|organisations|notifikations|integrations|automations|säkerhets|arbetsgivar|medarbetar|pensions|plattforms|infrastruktur|kunskaps|ansvars|produkt|analys|arbets|domän|nyckel|standard|grund|system|avtals|kund)/i;
  var SHY = '\u00ad';
  /* Bara etiketter och rubriker. Knappar och flikar lämnas orörda, de bryts aldrig och läses upp. */
  var HYPHENATE = '.kpi-label, .kpi-note, .tbl th, .kv dt, .label, .aside-title, .eyebrow, .tier-head, .card-title, .page-title, .detail-title';

  function softHyphens(word) {
    if (word.length < 12 || word.indexOf(SHY) >= 0) return word;
    var out = '';
    var rest = word;
    var m;
    while ((m = STEMS.exec(rest)) && rest.length - m[1].length >= 4) {
      out += rest.slice(0, m[1].length) + SHY;
      rest = rest.slice(m[1].length);
    }
    return out + rest;
  }

  function hyphenate(scope) {
    scope.querySelectorAll(HYPHENATE).forEach(function (el) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var text = node.nodeValue;
        if (text.length < 12) continue;
        var next = text.replace(/[A-Za-zÅÄÖåäöÉé]{12,}/g, softHyphens);
        if (next !== text) node.nodeValue = next;
      }
    });
  }

  /* ---------- Sökträffar ---------- */

  /*
   * Markerar sökorden i en tabell som är filtrerad (data-q), så att det syns varför raden
   * kom med. Bara i textnoder, inte i knappar eller dold text.
   */
  function highlight(scope) {
    scope.querySelectorAll('table[data-q]').forEach(function (table) {
      var terms = OOSUtil.matcher(table.getAttribute('data-q')).terms;
      if (!terms.length) return;
      Array.prototype.forEach.call(table.tBodies, function (tb) {
        var walker = document.createTreeWalker(tb, NodeFilter.SHOW_TEXT, {
          acceptNode: function (n) {
            return n.parentNode.closest('button, .sr-only, svg, mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
          }
        });
        var nodes = [];
        var n;
        while ((n = walker.nextNode())) nodes.push(n);
        nodes.forEach(function (node) {
          var text = node.nodeValue;
          var norm = OOSUtil.searchNorm(text);
          if (norm.length !== text.length) return;
          var ranges = [];
          terms.forEach(function (term) {
            for (var i = norm.indexOf(term); i >= 0; i = norm.indexOf(term, i + term.length)) ranges.push([i, i + term.length]);
          });
          if (!ranges.length) return;
          ranges.sort(function (a, b) { return a[0] - b[0]; });
          var merged = [ranges[0]];
          ranges.slice(1).forEach(function (r) {
            var last = merged[merged.length - 1];
            if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
            else merged.push(r);
          });
          var frag = document.createDocumentFragment();
          var pos = 0;
          merged.forEach(function (r) {
            if (r[0] > pos) frag.appendChild(document.createTextNode(text.slice(pos, r[0])));
            var m = document.createElement('mark');
            m.textContent = text.slice(r[0], r[1]);
            frag.appendChild(m);
            pos = r[1];
          });
          if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
          node.parentNode.replaceChild(frag, node);
        });
      });
    });
  }

  /* ---------- Linjer mellan rutor ---------- */

  /*
   * En svg med data-connect ritar linjer mellan rutor i samma behållare, från rutornas faktiska
   * läge efter layouten. Görs om när bredden ändras. offsetLeft och offsetTop används, så att en
   * pågående rörelse inte flyttar linjerna. Varje g[data-a][data-b] är en linje:
   *  - standard och "flow": kurva från högerkanten av [data-node=a] till vänsterkanten av
   *    [data-node=b], med pilspets om det finns en .carrow.
   *  - "drop" (tidslinjen): lodrät linje från stapeln på rad a till romben på rad b som visar
   *    när a blir klar. Romben och stapelns slut står på samma datum, alltså samma x.
   */
  function offsetIn(el, box) {
    var x = 0;
    var y = 0;
    while (el && el !== box) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x: x, y: y };
  }

  function connect(scope) {
    scope.querySelectorAll('svg[data-connect]').forEach(function (svg) {
      if (!svg.getClientRects().length) return; /* dold i smal layout */
      var box = svg.parentNode;
      var mode = svg.getAttribute('data-connect');
      var r = function (v) { return Math.round(v * 10) / 10; };
      svg.setAttribute('viewBox', '0 0 ' + box.clientWidth + ' ' + box.clientHeight);
      svg.querySelectorAll('g[data-a]').forEach(function (g) {
        var line = g.querySelector('.cline');
        var arrow = g.querySelector('.carrow');
        var na = box.querySelector('[data-node="' + g.getAttribute('data-a') + '"]');
        var nb = box.querySelector('[data-node="' + g.getAttribute('data-b') + '"]');
        var a = na && mode === 'drop' ? na.querySelector('.tl-bar') : na;
        var b = nb && mode === 'drop' ? nb.querySelector('.tl-mark[data-from="' + g.getAttribute('data-a') + '"]') : nb;
        if (!a || !b || !a.offsetParent || !b.offsetParent) {
          line.removeAttribute('d');
          if (arrow) arrow.removeAttribute('d');
          g.setAttribute('hidden', '');
          return;
        }
        g.removeAttribute('hidden');
        var pa = offsetIn(a, box);
        var pb = offsetIn(b, box);
        if (mode === 'drop') {
          var x = pb.x + b.offsetWidth / 2;
          var down = pa.y < pb.y;
          var y0 = down ? pa.y + a.offsetHeight + 2 : pa.y - 2;
          var y1 = down ? pb.y - 1 : pb.y + b.offsetHeight + 1;
          line.setAttribute('d', 'M' + r(x) + ' ' + r(y0) + ' L' + r(x) + ' ' + r(y1));
          return;
        }
        var x0 = pa.x + a.offsetWidth;
        var ya = pa.y + a.offsetHeight / 2;
        var x1 = pb.x - (arrow ? 7 : 0);
        var yb = pb.y + b.offsetHeight / 2;
        var mx = (x0 + x1) / 2;
        line.setAttribute('d', 'M' + r(x0) + ' ' + r(ya) + ' C' + r(mx) + ' ' + r(ya) + ' ' + r(mx) + ' ' + r(yb) + ' ' + r(x1) + ' ' + r(yb));
        if (arrow) arrow.setAttribute('d', 'M' + r(x1) + ' ' + r(yb - 4) + ' L' + r(x1 + 7) + ' ' + r(yb) + ' L' + r(x1) + ' ' + r(yb + 4) + ' Z');
      });
    });
  }

  /* ---------- Samlat ---------- */

  /* Anpassar allt i scope. reveal = true efter en omritning, så att vald flik rullas fram. */
  function fit(scope, reveal) {
    if (reveal) {
      hyphenate(scope);
      highlight(scope);
    }
    scope.querySelectorAll('table.tbl').forEach(fitTable);
    fitTabs(scope, reveal);
    fitText(scope);
    markScrollable(scope);
    connect(scope);
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

  return { fit: fit, watch: watch, hyphenate: hyphenate, STACK_BELOW: STACK_BELOW, _softHyphens: softHyphens };
})();
