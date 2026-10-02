/* Insikter: KPI:er med målnivåer, mätvärden i diagram och en karta över kopplingar. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  var TABS = [
    { key: 'kpi', label: 'KPI:er' },
    { key: 'metrics', label: 'Mätvärden' },
    { key: 'connections', label: 'Kopplingar' }
  ];

  OOS.views.insights = function (ctx) {
    var tab = OOS.tab('insights', 'kpi');
    var h = UI.pageHead({
      title: 'Insikter',
      sub: 'Nyckeltal, mätvärden och kopplingar för ' + esc(ctx.period.inText) + '. Allt räknas fram ur samma modell som resten av Fabriken.',
      actions: tab === 'kpi' ? UI.btn('Ändra mål', 'kpi-targets') : ''
    });
    h += '<div>' + UI.tabs('insights', TABS, tab) + '<div class="stack-lg">';
    if (tab === 'kpi') h += kpiTab(ctx);
    else if (tab === 'metrics') h += metricsTab(ctx);
    else h += connectionsTab(ctx);
    h += '</div></div>';
    return h;
  };

  /* ---------- KPI:er ---------- */

  function fmtValue(k) {
    if (k.key === 'nextChange') return U.fmtSigned(k.value, ' %');
    if (k.unit === '%') return U.fmtPct(k.value);
    return U.fmtNum(k.value);
  }

  function fmtNum(k, v) {
    return k.unit === '%' ? U.fmtPct(v) : U.fmtNum(v);
  }

  function targetText(k) {
    var t = k.target;
    if (t.min !== undefined && t.max !== undefined) return 'Mål ' + U.fmtNum(t.min) + '–' + fmtNum(k, t.max);
    if (t.min !== undefined) return 'Mål minst ' + (k.key === 'nextChange' ? U.fmtSigned(t.min, ' %') : fmtNum(k, t.min));
    if (t.max !== undefined) return t.max === 0 ? 'Mål 0' : 'Mål högst ' + fmtNum(k, t.max);
    return 'Inget mål satt';
  }

  var STATUS_TEXT = { ok: 'Inom målet', above: 'Över målet', below: 'Under målet', none: '' };

  /* Punktdiagram: skala, målzon och markering för värdet. */
  function bullet(k) {
    var lo = k.scale[0];
    var hi = k.scale[1];
    function pos(v) { return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)); }
    var t = k.target;
    var hasBand = t.min !== undefined || t.max !== undefined;
    var a = pos(t.min !== undefined ? t.min : lo);
    var b = pos(t.max !== undefined ? t.max : hi);
    var h = '<div class="bullet" aria-hidden="true"><div class="bullet-track">';
    if (hasBand) h += '<div class="bullet-band" style="left:' + a + '%;width:' + Math.max(1.5, b - a) + '%"></div>';
    if (lo < 0) h += '<div class="bullet-zero" style="left:' + pos(0) + '%"></div>';
    h += '<div class="bullet-mark' + (k.severity ? ' ' + k.severity : '') + '" style="left:' + pos(k.value) + '%"></div></div>';
    h += '<div class="bullet-scale"><span>' + (k.key === 'nextChange' ? U.fmtSigned(lo, ' %') : fmtNum(k, lo)) + '</span><span>' + (k.key === 'nextChange' ? U.fmtSigned(hi, ' %') : fmtNum(k, hi)) + '</span></div></div>';
    return h;
  }

  function kpiTab(ctx) {
    var list = ctx.e.kpis(ctx.period);
    var withTarget = list.filter(function (k) { return k.status !== 'none'; });
    var off = withTarget.filter(function (k) { return k.status !== 'ok'; });
    var h = '<p class="lede">' + (withTarget.length - off.length) + ' av ' + withTarget.length + ' nyckeltal med mål ligger inom målet' +
      (off.length ? '. Utanför: ' + off.map(function (k) { return '<strong>' + esc(k.label.toLowerCase()) + '</strong>'; }).join(' och ') + '.' : '.') + '</p>';
    h += '<div class="kpi-grid">';
    list.forEach(function (k) {
      var status = STATUS_TEXT[k.status];
      h += '<section class="kpi-item" aria-label="' + esc(k.label) + '">' +
        '<div class="kpi-label">' + esc(k.label) + '</div>' +
        '<div class="kpi-value' + (k.severity === 'critical' ? ' crit' : k.severity === 'warning' ? ' warn' : '') + '">' + fmtValue(k) + '</div>' +
        bullet(k) +
        '<div class="kpi-status">' + (k.status !== 'none' ? '<span class="dot ' + (k.severity || 'ok') + '"></span>' : '') +
        '<span>' + (status ? esc(status) + ' · ' : '') + esc(targetText(k)) + '</span></div>' +
        '<p class="kpi-def">' + esc(k.definition) + '</p></section>';
    });
    h += '</div>';

    var cov = list.filter(function (k) { return k.key === 'coverage'; })[0].detail;
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Modellens täckning i detalj</div>' +
      '<div class="card-sub">' + cov.passed + ' av ' + cov.total + ' kopplingar som ska finnas är registrerade.</div></div></div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Krav</th><th class="num">Uppfyllt</th><th>Andel</th></tr></thead><tbody>';
    cov.parts.sort(function (a, b) { return a.ok / a.total - b.ok / b.total; }).forEach(function (p) {
      var pct = (p.ok / p.total) * 100;
      h += '<tr><td>' + esc(p.what) + '</td><td class="num">' + p.ok + ' av ' + p.total + '</td><td>' + UI.bar(pct, { warnAt: 1000, soft: pct >= 99.5 }) + '</td></tr>';
    });
    h += '</tbody></table></div></section>';
    h += '<p class="muted small">Målnivåerna är förslag. Vilka nivåer som gäller är ett beslut för ledningen och sparas med Ändra mål.</p>';
    return h;
  }

  /* ---------- Mätvärden ---------- */

  function metricsTab(ctx) {
    var e = ctx.e;
    var h = '';

    /* Kapacitet över tid */
    var trend = e.capacityTrend(ctx.period, 3, 3);
    var max = Math.max.apply(null, trend.map(function (t) { return t.capacity; }).concat([1]));
    var cur = trend.filter(function (t) { return t.current; })[0];
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Kapacitet över tid</div>' +
      '<div class="card-sub">Tre perioder bakåt och tre framåt, räknat på dagens team och roller.</div></div></div>';
    h += '<div class="cols-chart" role="img" aria-label="' + esc(trend.map(function (t) { return t.period.label + ' ' + U.fmtH(t.capacity); }).join(', ')) + '">';
    trend.forEach(function (t) {
      var diff = t.capacity - cur.capacity;
      var tip = t.period.label + '\n' + U.fmtH(t.capacity) + (t.current ? '\nInnevarande period' : '\n' + U.fmtSigned(diff, ' h') + ' mot ' + cur.period.inText);
      h += '<div class="col' + (t.current ? ' current' : '') + '" data-tip="' + esc(tip) + '">' +
        '<span class="col-val">' + U.fmtNum(t.capacity) + '</span>' +
        '<div class="col-bar-wrap"><div class="col-bar" style="height:' + (t.capacity / max) * 100 + '%"></div></div></div>';
    });
    h += '</div><div class="cols-labels" aria-hidden="true">';
    trend.forEach(function (t) {
      h += '<span class="col-label' + (t.current ? ' current' : '') + '">' + esc(t.period.type === 'month' ? U.MONTHS[U.parseDate(t.period.start).getUTCMonth()] : t.period.label) + '</span>';
    });
    h += '</div><p class="muted small" style="margin-top:12px">Skillnaderna kommer av antal arbetsdagar, teamavdrag och domänroller som börjar eller slutar. Staplarna börjar på noll, så små skillnader syns som små.</p></section>';

    /* Kompetensmatris */
    var rowsBy = OOS.segVal('matrix-rows', 'team');
    var m = e.competenceMatrix(ctx.period, rowsBy);
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Kompetensmatris</div>' +
      '<div class="card-sub">Timmar per kompetensområde i ' + esc(ctx.period.inText) + '. Mörkare ruta betyder fler timmar.</div></div>' +
      UI.seg('matrix-rows', [{ key: 'team', label: 'Per team' }, { key: 'delivery', label: 'Per leveransdomän' }], rowsBy) + '</div>';
    h += '<div class="table-wrap"><table class="tbl heat" data-fit="scroll"><thead><tr><th>' + (rowsBy === 'team' ? 'Team' : 'Leveransdomän') + '</th>';
    m.cols.forEach(function (c) { h += '<th class="num heat-col">' + esc(c.name) + '</th>'; });
    h += '<th class="num">Totalt</th></tr></thead><tbody>';
    m.rows.forEach(function (r) {
      var page = rowsBy === 'team' ? 'teams:' : 'deliveryDomains:';
      h += '<tr><td>' + (r.id === '_none' ? esc(r.name) : C.link(page + r.id, r.name)) + '</td>';
      r.values.forEach(function (v, i) {
        var step = v > 0 ? Math.min(6, Math.max(1, Math.ceil((v / m.max) * 6))) : 0;
        var tip = r.name + ' · ' + m.cols[i].name + '\n' + (v > 0 ? U.fmtH(v) + ' (' + U.fmtPct((v / r.total) * 100) + ' av raden)' : 'Ingen kapacitet');
        h += '<td class="num heat-cell h' + step + '" data-tip="' + esc(tip) + '">' + (v > 0 ? U.fmtNum(v) : '<span class="heat-empty">–</span>') + '</td>';
      });
      h += '<td class="num"><strong>' + U.fmtNum(r.total) + '</strong></td></tr>';
    });
    h += '<tr class="total"><td>Totalt</td>';
    m.cols.forEach(function (c) { h += '<td class="num">' + U.fmtNum(c.total) + '</td>'; });
    h += '<td class="num">' + U.fmtNum(m.total) + '</td></tr></tbody></table></div>';
    h += '<p class="muted small">' + (rowsBy === 'team' ? 'Bara team. Domänmoln och nyckelroller syns i vyn per leveransdomän.' : 'Team, domänmoln och nyckelroller.') + ' Kapaciteten räknas på varje persons primära kompetenser.</p></section>';

    /* Beläggning per team */
    var target = (e.kpis(ctx.period).filter(function (k) { return k.key === 'load'; })[0] || {}).target || {};
    var teams = S.db.teams.map(function (t) { return { t: t, c: e.teamCapacity(t.id, ctx.period) }; })
      .sort(function (a, b) { return b.c.loadPct - a.c.loadPct; });
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Beläggning per team</div>' +
      '<div class="card-sub">Det skuggade fältet är målet ' + (target.min !== undefined ? U.fmtNum(target.min) : 0) + '–' + U.fmtPct(target.max !== undefined ? target.max : 100) + '. Gult från 90 %.</div></div></div>';
    h += '<div class="loadbars">';
    teams.forEach(function (x) {
      var v = x.c.loadPct;
      var cls = v > 100.5 ? ' crit' : v >= 90 ? ' warn' : '';
      h += '<div class="loadbar" role="link" tabindex="0" data-go="teams:' + esc(x.t.id) + '" aria-label="' + esc(x.t.name + ', ' + U.fmtPct(v)) + '" data-tip="' + esc(x.t.name + '\n' + U.fmtPct(v) + ' planerat\n' + U.fmtH(x.c.free) + ' ledigt av ' + U.fmtH(x.c.capacity)) + '">' +
        '<span class="loadbar-name">' + esc(x.t.name) + '</span>' +
        '<div class="loadbar-track">' +
        (target.min !== undefined || target.max !== undefined ? '<div class="loadbar-band" style="left:' + (target.min || 0) + '%;width:' + ((target.max !== undefined ? target.max : 100) - (target.min || 0)) + '%"></div>' : '') +
        '<div class="loadbar-fill' + cls + '" style="width:' + Math.min(100, v) + '%"></div></div>' +
        '<span class="loadbar-val' + cls + '">' + U.fmtPct(v) + '</span></div>';
    });
    h += '</div></section>';

    /* Sammansättning och kompetensdjup */
    var comp = e.composition(ctx.period);
    h += '<div class="grid-2">';
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Kapacitetens sammansättning</div><div class="card-sub">Andel av timmarna i ' + esc(ctx.period.inText) + '</div></div></div>' +
      stack100('Var kapaciteten ligger', comp.source) + stack100('Vem som bidrar', comp.employment) + '</section>';
    var depth = e.competenceDepth();
    var dmax = Math.max.apply(null, depth.map(function (d) { return d.total; }).concat([1]));
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Kompetensdjup</div><div class="card-sub">Antal personer per område och högsta nivå</div></div></div>';
    h += '<div class="legend-line" style="margin-bottom:12px">' + [1, 2, 3, 4].map(function (n) { return '<span><span class="sw lv' + n + '"></span>' + UI.LEVELS[n] + '</span>'; }).join('') + '</div>';
    h += '<div class="depth">';
    depth.forEach(function (d) {
      var tip = d.category + '\n' + d.levels.map(function (n, i) { return UI.LEVELS[i + 1] + ': ' + n; }).join('\n');
      h += '<div class="depth-row" data-tip="' + esc(tip) + '"><span class="depth-name">' + esc(d.category) + '</span><div class="depth-track">';
      d.levels.forEach(function (n, i) {
        if (n) h += '<div class="depth-seg lv' + (i + 1) + '" style="width:' + (n / dmax) * 100 + '%"></div>';
      });
      h += '</div><span class="depth-val">' + d.total + '<span class="muted"> · ' + d.advanced + ' på nivå 3–4</span></span></div>';
    });
    h += '</div></section></div>';
    return h;
  }

  function stack100(title, parts) {
    var h = '<div class="stack100"><div class="label">' + esc(title) + '</div><div class="stack100-bar" role="img" aria-label="' +
      esc(parts.map(function (p) { return p.label + ' ' + U.fmtPct(p.pct); }).join(', ')) + '">';
    parts.forEach(function (p, i) {
      if (p.pct > 0) h += '<div class="stack100-seg s' + (i + 1) + '" style="width:' + p.pct + '%" data-tip="' + esc(p.label + '\n' + U.fmtH(p.value) + ' (' + U.fmtPct(p.pct) + ')') + '"></div>';
    });
    h += '</div><div class="stack100-legend">';
    parts.forEach(function (p, i) {
      h += '<span><span class="sw s' + (i + 1) + '"></span>' + esc(p.label) + ' <strong class="num">' + U.fmtPct(p.pct) + '</strong></span>';
    });
    return h + '</div></div>';
  }

  /* ---------- Kopplingar ---------- */

  /* Under den här bredden visas kartan som nivåer uppifrån och ned i stället för som karta. */
  var MAP_MIN = 640;

  /*
   * Kartans mått räknas fram ur den bredd som finns, så att den alltid får plats utan att rulla.
   * Namnen mäts i det typsnitt kartan har och bryts på så många rader som behövs, högst tre.
   * Alla rutor får samma höjd, efter det namn som behöver flest rader.
   */
  function geometry(avail, cols, nodes, selId) {
    var gap = Math.round(Math.max(28, Math.min(64, avail * 0.05)));
    var w = Math.floor(Math.min(220, (avail - (cols - 1) * gap) / cols));
    var size = w >= 130 ? 12 : 11;
    var labels = new Map();
    var lines = 1;
    (nodes || []).forEach(function (n) {
      var room = w - 20 - (n.issues.length ? 12 : 0);
      var l = wrapLabel(n.name, room, size, n.id === selId ? 600 : 400, 3);
      labels.set(n.id, l);
      lines = Math.max(lines, l.length);
    });
    var nh = 12 + lines * 14;
    return { W: w, GAP: gap, NH: nh, ROW: nh + 8, TOP: 36, size: size, labels: labels };
  }

  /* Textens bredd i kartans typsnitt. Utan canvas räknas med en genomsnittlig teckenbredd. */
  var measureCtx;
  function textWidth(s, size, weight) {
    if (measureCtx === undefined) {
      var c = document.createElement('canvas');
      measureCtx = c.getContext ? c.getContext('2d') : null;
    }
    if (!measureCtx) return s.length * size * 0.56;
    measureCtx.font = weight + ' ' + size + 'px ' + getComputedStyle(document.body).fontFamily;
    return measureCtx.measureText(s).width;
  }

  /* Vanliga efterled i namnen. Ett långt ord delas helst framför dem: Produktregel-motor. */
  var STEMS = ['administration', 'efterlevnad', 'utveckling', 'plattform', 'struktur', 'hantering', 'register', 'tjänst', 'portal', 'system', 'motor', 'regel', 'stöd', 'lager', 'team'];

  /*
   * Var ett ord som inte ryms på en rad ska delas. Bäst är vid ett bindestreck eller framför ett
   * känt efterled, sedan efter ett s mot konsonant (Avtals-register), och sist så långt som ryms.
   * Minst fyra tecken flyttas till nästa rad, så att det inte blir en ensam stavelse kvar.
   */
  function splitWord(word, fits) {
    var best = null;
    for (var i = word.length - 4; i >= 2; i--) {
      var hyphen = word[i - 1] === '-';
      var head = word.slice(0, i) + (hyphen ? '' : '-');
      if (!fits(head)) continue;
      var rest = word.slice(i).toLowerCase();
      var rank = hyphen || STEMS.some(function (x) { return rest.indexOf(x) === 0; }) ? 0
        : word[i - 1] === 's' && /[bcdfghjklmnpqrstvwxz]/.test(rest[0]) && i >= 4 ? 1 : 2;
      if (!best || rank < best.rank) best = { at: i, head: head, rank: rank };
      if (rank === 0) break;
    }
    return best;
  }

  /* Delar ett namn på rader som ryms i bredden. Det som ändå inte ryms på max rader kortas med … */
  function wrapLabel(s, room, size, weight, max) {
    var fits = function (t) { return textWidth(t, size, weight) <= room; };
    var lines = [];
    var cur = '';
    s.split(' ').forEach(function (word) {
      var cand = cur ? cur + ' ' + word : word;
      if (fits(cand)) { cur = cand; return; }
      if (cur) lines.push(cur);
      cur = '';
      var cut;
      while (!fits(word) && (cut = splitWord(word, fits))) {
        lines.push(cut.head);
        word = word.slice(cut.at);
      }
      cur = word;
    });
    if (cur) lines.push(cur);
    if (lines.length > max) lines = lines.slice(0, max - 1).concat([lines.slice(max - 1).join(' ')]);
    return lines.map(function (l) {
      if (fits(l)) return l;
      while (l.length > 1 && !fits(l + '…')) l = l.slice(0, -1);
      return l + '…';
    });
  }

  function trunc(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /*
   * Utan val: noderna fördelas jämnt på höjden i sin grundordning.
   * Med val: det som hör till valet samlas överst, sorterat för så få korsningar som möjligt,
   * och resten läggs nedanför en skiljelinje.
   */
  function layout(g, focus, geo) {
    var W = geo.W;
    var GAP = geo.GAP;
    var NH = geo.NH;
    var ROW = geo.ROW;
    var TOP = geo.TOP;
    var pos = new Map();
    if (!focus) {
      var maxN = Math.max.apply(null, g.columns.map(function (c) { return c.nodes.length; }));
      var H = TOP + maxN * ROW + 8;
      g.columns.forEach(function (c, ci) {
        var slot = (H - TOP) / c.nodes.length;
        c.nodes.forEach(function (n, i) {
          pos.set(n.id, { x: ci * (W + GAP), y: Math.round(TOP + slot * i + (slot - NH) / 2) });
        });
      });
      return { pos: pos, height: H, divider: null };
    }

    var blocks = g.columns.map(function (c) {
      return {
        hi: c.nodes.filter(function (n) { return focus.nodes.has(n.id); }),
        lo: c.nodes.filter(function (n) { return !focus.nodes.has(n.id); })
      };
    });
    var fEdges = Array.from(focus.edges).map(function (i) { return g.edges[i]; });

    /* Korsningsminimering: sortera varje kolumn efter grannarnas medelposition, fram och tillbaka. */
    function sweep(ci, ref) {
      var index = new Map();
      blocks[ref].hi.forEach(function (n, i) { index.set(n.id, i); });
      var ranked = blocks[ci].hi.map(function (n, i) {
        var ps = [];
        fEdges.forEach(function (e) {
          if (e.from === n.id && index.has(e.to)) ps.push(index.get(e.to));
          if (e.to === n.id && index.has(e.from)) ps.push(index.get(e.from));
        });
        return { n: n, rank: ps.length ? U.sum(ps) / ps.length : i, i: i };
      });
      ranked.sort(function (a, b) { return a.rank - b.rank || a.i - b.i; });
      blocks[ci].hi = ranked.map(function (x) { return x.n; });
    }
    for (var iter = 0; iter < 3; iter++) {
      for (var a = 1; a < blocks.length; a++) sweep(a, a - 1);
      for (var b = blocks.length - 2; b >= 0; b--) sweep(b, b + 1);
    }

    var maxHi = Math.max.apply(null, blocks.map(function (x) { return x.hi.length; }));
    var maxLo = Math.max.apply(null, blocks.map(function (x) { return x.lo.length; }));
    var dividerY = TOP + maxHi * ROW + 12;
    var loTop = dividerY + 34;
    blocks.forEach(function (blk, ci) {
      var off = ((maxHi - blk.hi.length) / 2) * ROW;
      blk.hi.forEach(function (n, i) { pos.set(n.id, { x: ci * (W + GAP), y: Math.round(TOP + off + i * ROW) }); });
      blk.lo.forEach(function (n, i) { pos.set(n.id, { x: ci * (W + GAP), y: loTop + i * ROW }); });
    });
    return { pos: pos, height: maxLo ? loTop + maxLo * ROW + 8 : dividerY, divider: maxLo ? dividerY : null, blocks: blocks };
  }

  /* Kartan som SVG: kolumner från vänster till höger med linjer mellan. */
  function mapSvg(g, nodes, focus, sel, geo) {
    var W = geo.W;
    var GAP = geo.GAP;
    var NH = geo.NH;
    var lay = layout(g, focus, geo);
    var width = g.columns.length * W + (g.columns.length - 1) * GAP;
    var svg = '<svg class="graph" viewBox="0 0 ' + width + ' ' + lay.height + '" width="' + width + '" height="' + lay.height + '" aria-labelledby="graph-title">' +
      '<title id="graph-title">Kopplingskarta från leveransdomän till IT-domän</title>';
    g.columns.forEach(function (c, ci) {
      svg += '<text class="graph-head" x="' + (ci * (W + GAP)) + '" y="14">' + esc(trunc(c.label, Math.floor((W + GAP - 8) / 6.6))) + '</text>';
    });
    if (lay.divider) {
      svg += '<line class="graph-divider" x1="0" x2="' + width + '" y1="' + lay.divider + '" y2="' + lay.divider + '"/>' +
        '<text class="graph-head" x="0" y="' + (lay.divider + 22) + '">Inte kopplade till ' + esc(sel.name) + '</text>';
    }
    svg += '<g class="edges">';
    g.edges.forEach(function (ed, i) {
      if (focus && !focus.edges.has(i)) return;
      var p1 = lay.pos.get(ed.from);
      var p2 = lay.pos.get(ed.to);
      if (!p1 || !p2) return;
      var x1 = p1.x + W;
      var y1 = p1.y + NH / 2;
      var x2 = p2.x;
      var y2 = p2.y + NH / 2;
      var mx = (x1 + x2) / 2;
      /* data-c är kolumnen linjen startar i. Rörelsen ritar ut linjerna i den ordningen. */
      svg += '<path class="edge' + (ed.rel === 'primary' ? '' : ' support') + (focus ? ' on' : '') + '" data-c="' + Math.round(p1.x / (W + GAP)) + '" d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>';
    });
    svg += '</g>';
    nodes.forEach(function (n) {
      var p = lay.pos.get(n.id);
      var state = !focus ? '' : n.id === sel.id ? ' sel' : focus.nodes.has(n.id) ? ' on' : ' off';
      var label = n.name + (n.issues.length ? '. Lucka: ' + n.issues.join(', ') : '');
      var lines = geo.labels.get(n.id) || [n.name];
      /* Raderna centreras i rutan, 14 px mellan raderna. */
      var text = '<text x="10" y="' + (NH / 2 + 4 - (lines.length - 1) * 7) + '" style="font-size:' + geo.size + 'px">' + esc(lines[0]) +
        lines.slice(1).map(function (l) { return '<tspan x="10" dy="14">' + esc(l) + '</tspan>'; }).join('') + '</text>';
      svg += '<g class="gnode' + state + (n.issues.length ? ' issue' : '') + '" style="transform:translate(' + p.x + 'px,' + p.y + 'px)" data-x="' + p.x + '" data-y="' + p.y + '" data-c="' + Math.round(p.x / (W + GAP)) + '" tabindex="0" role="button" aria-pressed="' + (sel && n.id === sel.id ? 'true' : 'false') + '" aria-label="' + esc(label) + '" data-action="graph-select" data-id="' + esc(n.id) + '">' +
        '<title>' + esc(label) + '</title><rect width="' + W + '" height="' + NH + '" rx="6"/>' + text +
        (n.issues.length ? '<circle cx="' + (W - 10) + '" cy="' + NH / 2 + '" r="3.5"/>' : '') + '</g>';
    });
    return '<div class="graph-wrap">' + svg + '</svg></div>';
  }

  /*
   * Smal yta: samma kolumner som nivåer uppifrån och ned. Med ett val visas bara det som hör
   * till valet, i samma ordning som i kartan. Kopplingarnas art står på delens egen sida.
   */
  function tiersHtml(g, focus, sel) {
    var blocks = focus ? layout(g, focus, geometry(1000, g.columns.length)).blocks : null;
    var h = '<ol class="tiers" aria-label="Kopplingar från leveransdomän till IT-domän">';
    g.columns.forEach(function (c, ci) {
      var shown = blocks ? blocks[ci].hi : c.nodes;
      h += '<li class="tier"><div class="tier-head">' + esc(c.label) + ' <span class="muted">' + (focus ? shown.length + ' av ' + c.nodes.length : c.nodes.length) + '</span></div><div class="tier-nodes">';
      shown.forEach(function (n) {
        var state = !focus ? '' : n.id === sel.id ? ' sel' : ' on';
        h += '<button type="button" class="tnode' + state + (n.issues.length ? ' issue' : '') + '" data-action="graph-select" data-id="' + esc(n.id) + '" aria-pressed="' + (sel && n.id === sel.id ? 'true' : 'false') + '">' +
          esc(n.name) + (n.issues.length ? '<span class="tnode-dot" aria-hidden="true"></span><span class="sr-only">. Lucka: ' + esc(n.issues.join(', ')) + '</span>' : '') + '</button>';
      });
      if (!shown.length) h += '<span class="muted small">Inget kopplat</span>';
      h += '</div></li>';
    });
    return h + '</ol>';
  }

  var fontsPending = false;

  function connectionsTab(ctx) {
    var e = ctx.e;
    var g = e.connectionGraph();
    var nodes = [];
    g.columns.forEach(function (c) { nodes = nodes.concat(c.nodes); });
    var byId = new Map(nodes.map(function (n) { return [n.id, n]; }));
    var sel = OOS.state.graphSel && byId.has(OOS.state.graphSel) ? byId.get(OOS.state.graphSel) : null;
    var focus = sel ? OOSEngine.connectionFocus(g, sel.id) : null;
    var gaps = nodes.filter(function (n) { return n.issues.length; });
    /* Fliken är kartan och luckorna. Kartan visar själv kopplingarna, så de står inte en gång till som lista. */
    var h = '';

    /* Kartan står i ett kort: dra av kortets kant och innermarginal (se .card i app.css). */
    var cardPad = Math.min(24, Math.max(16, 0.022 * window.innerWidth));
    var avail = OOS.measure() - 2 * cardPad - 4;
    var asMap = avail >= MAP_MIN;
    var drawing = asMap ? mapSvg(g, nodes, focus, sel, geometry(avail, g.columns.length, nodes, sel ? sel.id : null)) : tiersHtml(g, focus, sel);
    /* Namnen mäts i kartans typsnitt. Laddas det efter att kartan ritats, ritas den om en gång. */
    if (asMap && document.fonts && document.fonts.status !== 'loaded' && !fontsPending) {
      fontsPending = true;
      document.fonts.ready.then(function () {
        if (OOS.tab('insights', 'kpi') === 'connections' && document.querySelector('.graph')) {
          OOS.motion('quiet');
          OOS.refresh();
        }
      });
    }

    h += '<section class="card" id="graph-section"><div class="card-head"><div><div class="card-title">Kopplingskarta</div>' +
      '<div class="card-sub">' + (sel
        ? 'Visar det som hör till ' + esc(sel.name) + ': ' + U.plural(focus.nodes.size - 1, 'del', 'delar') + '. Primära kopplingar följs hela vägen, ' + (asMap ? 'streckade stödjande kopplingar visas men följs inte vidare.' : 'stödjande kopplingar visas men följs inte vidare.')
        : asMap
          ? 'Välj en ruta för att samla det som hör till den. Heldragen linje är primär koppling eller ansvar, streckad är stödjande. En gul punkt betyder en lucka.'
          : 'Välj en del för att se det som hör till den. En gul punkt betyder en lucka. Bredda fönstret för att se kartan med linjer.') + '</div></div>' +
      (sel ? '<div class="page-actions"><button type="button" class="btn btn-sm" data-go="' + esc(sel.kind + ':' + sel.refId) + '" aria-label="Öppna ' + esc(sel.name) + '">Öppna</button>' +
        UI.btn('Visa hela kartan', 'graph-clear', { cls: 'btn-sm' }) + '</div>' : '') + '</div>';
    h += drawing + '</section>';

    h += '<section class="card" id="graph-gaps"><div class="card-head"><div><div class="card-title">Luckor' + (gaps.length ? ', ' + gaps.length : '') + '</div>' +
      (gaps.length ? '<div class="card-sub">Delar som saknar en koppling. Visa i kartan väljer rutan.</div>' : '') + '</div></div>';
    if (!gaps.length) h += '<p class="muted">Inga luckor.</p>';
    else {
      h += '<div class="list">';
      gaps.forEach(function (n) {
        h += '<div class="list-item"><span class="dot warning"></span><div class="grow">' + C.link(n.kind + ':' + n.refId, n.name) +
          '<div class="muted small">' + esc(labelOf(g, n.col)) + ' · ' + esc(n.issues.join(', ')) + '</div></div>' +
          UI.btn('Visa i kartan', 'graph-select', { cls: 'btn-sm', data: { id: n.id } }) + '</div>';
      });
      h += '</div>';
    }
    h += '</section>';
    return h;
  }

  function labelOf(g, col) {
    return g.columns.filter(function (c) { return c.key === col; })[0].label;
  }

  /* Rutornas platser före omritningen, så att de kan glida till de nya (se OOSMotion.moveNodes). */
  function capturePositions() {
    var map = new Map();
    document.querySelectorAll('.gnode').forEach(function (el) {
      map.set(el.getAttribute('data-id'), { x: el.getAttribute('data-x'), y: el.getAttribute('data-y') });
    });
    return map;
  }

  function reduceMotion() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
  }

  /*
   * Kartan ritas om helt. Rutorna glider till sina nya platser och linjerna ritas ut
   * från den valda rutan och utåt, så att det syns vad som hör ihop.
   */
  function redraw(old) {
    OOS.motion('quiet');
    OOS.refresh();
    var svg = document.querySelector('.graph');
    if (svg) {
      var sel = OOS.state.graphSel && svg.querySelector('.gnode.sel');
      OOSMotion.moveNodes(svg, old);
      OOSMotion.drawEdges(svg, sel ? +sel.getAttribute('data-c') : null, 180);
    } else {
      OOSMotion.reveal(document.querySelector('.tiers'));
    }
  }

  function focusNode(id, scroll) {
    var safe = id.replace(/"/g, '');
    var el = document.querySelector('.gnode[data-id="' + safe + '"], .tnode[data-id="' + safe + '"]');
    if (el) el.focus({ preventScroll: true });
    var section = document.getElementById('graph-section');
    if (scroll && section && section.getBoundingClientRect().top < 0) {
      section.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    }
  }

  /* ---------- Åtgärder ---------- */

  var A = OOS.actions;
  A['graph-select'] = function (el) {
    var id = el.getAttribute('data-id');
    var fromList = !el.classList.contains('gnode') && !el.classList.contains('tnode');
    var old = capturePositions();
    OOS.state.graphSel = OOS.state.graphSel === id && !fromList ? null : id;
    redraw(old);
    focusNode(id, true);
  };
  A['graph-clear'] = function () {
    var old = capturePositions();
    var prev = OOS.state.graphSel;
    OOS.state.graphSel = null;
    redraw(old);
    if (prev) focusNode(prev, false);
  };
  A['kpi-targets'] = function () {
    var t = Object.assign({}, OOSEngine.DEFAULT_TARGETS, S.db.settings.kpiTargets || {});
    UI.openForm({
      title: 'Målnivåer',
      intro: 'Målen styr när ett nyckeltal visas som avvikelse. Lämna tomt för att inte ha någon gräns.',
      values: {
        loadMin: t.load.min, loadMax: t.load.max,
        producingMin: t.producingShare.min, consultantMax: t.consultantShare.max,
        coverageMin: t.coverage.min, nextChangeMin: t.nextChange.min
      },
      fields: [
        { key: 'loadMin', label: 'Beläggning, lägst (%)', type: 'number', min: 0, max: 100 },
        { key: 'loadMax', label: 'Beläggning, högst (%)', type: 'number', min: 0, max: 100 },
        { key: 'producingMin', label: 'Producerande team, minst (%)', type: 'number', min: 0, max: 100 },
        { key: 'consultantMax', label: 'Konsultandel, högst (%)', type: 'number', min: 0, max: 100 },
        { key: 'coverageMin', label: 'Modellens täckning, minst (%)', type: 'number', min: 0, max: 100 },
        { key: 'nextChangeMin', label: 'Förändring nästa period, minst (%)', type: 'number', min: -100, max: 100 }
      ],
      validate: function (v) {
        if (v.loadMin !== null && v.loadMax !== null && v.loadMin > v.loadMax) return { loadMax: 'Högsta värdet måste vara större än det lägsta.' };
      },
      onSubmit: function (v) {
        function range(min, max) {
          var r = {};
          if (min !== null) r.min = min;
          if (max !== null) r.max = max;
          return r;
        }
        var next = Object.assign({}, S.db.settings.kpiTargets || {}, {
          load: range(v.loadMin, v.loadMax),
          producingShare: range(v.producingMin, null),
          consultantShare: range(null, v.consultantMax),
          coverage: range(v.coverageMin, null),
          nextChange: range(v.nextChangeMin, null)
        });
        S.updateSettings({ kpiTargets: next });
        UI.toast('Målnivåerna sparades.');
        OOS.refresh();
      }
    });
  };
})();
