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
      h += '<span class="col-label' + (t.current ? ' current' : '') + '">' + esc(t.period.type === 'quarter' ? t.period.label : U.MONTHS[U.parseDate(t.period.start).getUTCMonth()]) + '</span>';
    });
    h += '</div><p class="muted small" style="margin-top:12px">Skillnaderna kommer av antal arbetsdagar, teamavdrag och domänroller som börjar eller slutar. Staplarna börjar på noll, så små skillnader syns som små.</p></section>';

    /* Kompetensmatris */
    var rowsBy = OOS.segVal('matrix-rows', 'team');
    var m = e.competenceMatrix(ctx.period, rowsBy);
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Kompetensmatris</div>' +
      '<div class="card-sub">Timmar per kompetensområde i ' + esc(ctx.period.inText) + '. Mörkare ruta betyder fler timmar.</div></div>' +
      UI.seg('matrix-rows', [{ key: 'team', label: 'Per team' }, { key: 'delivery', label: 'Per leveransdomän' }], rowsBy) + '</div>';
    h += '<div class="table-wrap"><table class="tbl heat"><thead><tr><th>' + (rowsBy === 'team' ? 'Team' : 'Leveransdomän') + '</th>';
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

  var W = 168;
  var GAP = 64;
  var NH = 26;
  var ROW = 34;
  var TOP = 36;

  function trunc(s, n) {
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

  /* Följer kopplingarna uppströms och nedströms från vald nod. */
  function reach(edges, start) {
    function walk(dirFrom, dirTo) {
      var seen = new Set([start]);
      var queue = [start];
      while (queue.length) {
        var cur = queue.shift();
        edges.forEach(function (ed) {
          if (ed[dirFrom] === cur && !seen.has(ed[dirTo])) {
            seen.add(ed[dirTo]);
            queue.push(ed[dirTo]);
          }
        });
      }
      return seen;
    }
    return { up: walk('to', 'from'), down: walk('from', 'to') };
  }

  function connectionsTab(ctx) {
    var e = ctx.e;
    var g = e.connectionGraph();
    var nodes = [];
    g.columns.forEach(function (c) { nodes = nodes.concat(c.nodes); });
    var byId = new Map(nodes.map(function (n) { return [n.id, n]; }));
    var sel = OOS.state.graphSel && byId.has(OOS.state.graphSel) ? byId.get(OOS.state.graphSel) : null;
    var r = sel ? reach(g.edges, sel.id) : null;
    var gaps = nodes.filter(function (n) { return n.issues.length; });
    var primary = g.edges.filter(function (x) { return x.rel === 'primary'; }).length;

    var h = '<p class="lede"><strong>' + g.edges.length + '</strong> kopplingar mellan <strong>' + nodes.length + '</strong> delar av organisationen.' +
      (gaps.length ? ' <strong class="over">' + gaps.length + (gaps.length === 1 ? ' lucka' : ' luckor') + '</strong> där en koppling saknas.' : ' Inga luckor.') + '</p>';
    h += '<div class="kpis">' +
      UI.kpi('Primära kopplingar', primary, 'Heldragen linje') +
      UI.kpi('Stödjande kopplingar', g.edges.length - primary, 'Streckad linje') +
      UI.kpi('Team', S.db.teams.length, 'Mitten av kartan') +
      UI.kpi('Luckor', gaps.length, gaps.length ? 'Saknar en koppling' : 'Allt är kopplat', { crit: gaps.length > 0 }) +
      '</div>';

    /* Layout: fem kolumner, noderna jämnt fördelade på höjden. */
    var maxN = Math.max.apply(null, g.columns.map(function (c) { return c.nodes.length; }));
    var H = TOP + maxN * ROW + 8;
    var width = g.columns.length * W + (g.columns.length - 1) * GAP;
    var pos = new Map();
    g.columns.forEach(function (c, ci) {
      var slot = (H - TOP) / c.nodes.length;
      c.nodes.forEach(function (n, i) {
        pos.set(n.id, { x: ci * (W + GAP), y: TOP + slot * i + (slot - NH) / 2 });
      });
    });

    var svg = '<svg class="graph" viewBox="0 0 ' + width + ' ' + H + '" width="' + width + '" height="' + H + '" aria-labelledby="graph-title">' +
      '<title id="graph-title">Kopplingskarta från leveransdomän till system</title>';
    g.columns.forEach(function (c, ci) {
      svg += '<text class="graph-head" x="' + (ci * (W + GAP)) + '" y="14">' + esc(c.label) + '</text>';
    });
    g.edges.forEach(function (ed) {
      var a = pos.get(ed.from);
      var b = pos.get(ed.to);
      if (!a || !b) return;
      var x1 = a.x + W;
      var y1 = a.y + NH / 2;
      var x2 = b.x;
      var y2 = b.y + NH / 2;
      var mx = (x1 + x2) / 2;
      var on = r && ((r.up.has(ed.from) && r.up.has(ed.to)) || (r.down.has(ed.from) && r.down.has(ed.to)));
      var cls = 'edge' + (ed.rel === 'primary' ? '' : ' support') + (r ? (on ? ' on' : ' off') : '');
      svg += '<path class="' + cls + '" d="M' + x1 + ' ' + y1 + ' C' + mx + ' ' + y1 + ' ' + mx + ' ' + y2 + ' ' + x2 + ' ' + y2 + '"/>';
    });
    nodes.forEach(function (n) {
      var p = pos.get(n.id);
      var state = !r ? '' : n.id === sel.id ? ' sel' : r.up.has(n.id) || r.down.has(n.id) ? ' on' : ' off';
      var label = n.name + (n.issues.length ? '. Lucka: ' + n.issues.join(', ') : '');
      svg += '<g class="gnode' + state + (n.issues.length ? ' issue' : '') + '" transform="translate(' + p.x + ' ' + p.y + ')" tabindex="0" role="button" aria-pressed="' + (sel && n.id === sel.id ? 'true' : 'false') + '" aria-label="' + esc(label) + '" data-action="graph-select" data-id="' + esc(n.id) + '">' +
        '<title>' + esc(label) + '</title><rect width="' + W + '" height="' + NH + '" rx="6"/>' +
        '<text x="10" y="' + (NH / 2 + 4) + '">' + esc(trunc(n.name, 23)) + '</text>' +
        (n.issues.length ? '<circle cx="' + (W - 10) + '" cy="' + NH / 2 + '" r="3.5"/>' : '') + '</g>';
    });
    svg += '</svg>';

    h += '<section class="card"><div class="card-head"><div><div class="card-title">Kopplingskarta</div>' +
      '<div class="card-sub">Välj en ruta för att följa dess kopplingar uppåt och nedåt. Heldragen linje är primär, streckad är stödjande. En gul punkt betyder en lucka.</div></div>' +
      (sel ? UI.btn('Rensa val', 'graph-clear', { cls: 'btn-sm' }) : '') + '</div>';
    h += '<div class="graph-wrap">' + svg + '</div></section>';

    h += '<div class="grid-2">';
    h += '<section class="card"><div class="card-head"><div class="card-title">' + (sel ? esc(sel.name) : 'Ingen ruta vald') + '</div>' +
      (sel ? C.link(sel.kind + ':' + sel.refId, 'Öppna') : '') + '</div>';
    h += sel ? selectionDetail(e, g, sel, byId) : '<p class="muted">Välj en ruta i kartan för att se alla dess kopplingar här.</p>';
    h += '</section>';

    h += '<section class="card"><div class="card-head"><div class="card-title">Luckor</div></div>';
    if (!gaps.length) h += '<p class="muted">Inga luckor. Alla delar har de kopplingar de behöver.</p>';
    else {
      h += '<div class="list">';
      gaps.forEach(function (n) {
        h += '<div class="list-item"><span class="dot warning"></span><div class="grow">' + C.link(n.kind + ':' + n.refId, n.name) +
          '<div class="muted small">' + esc(labelOf(g, n.col)) + ' · ' + esc(n.issues.join(', ')) + '</div></div>' +
          UI.btn('Visa i kartan', 'graph-select', { cls: 'btn-sm', data: { id: n.id } }) + '</div>';
      });
      h += '</div>';
    }
    h += '</section></div>';
    return h;
  }

  function labelOf(g, col) {
    return g.columns.filter(function (c) { return c.key === col; })[0].label;
  }

  function selectionDetail(e, g, sel, byId) {
    var ins = g.edges.filter(function (x) { return x.to === sel.id; });
    var outs = g.edges.filter(function (x) { return x.from === sel.id; });
    function group(title, list, key) {
      if (!list.length) return '';
      var h = '<div class="field-block" style="margin-bottom:14px"><span class="label">' + esc(title) + '</span><div class="list">';
      list.forEach(function (x) {
        var n = byId.get(x[key]);
        if (!n) return;
        h += '<div class="list-item" style="padding:6px 0">' + '<div class="grow">' + C.link(n.kind + ':' + n.refId, n.name) + '</div>' + C.relLabel(x.rel) + '</div>';
      });
      return h + '</div></div>';
    }
    var colIdx = g.columns.map(function (c) { return c.key; }).indexOf(sel.col);
    var h = '';
    if (sel.issues.length) h += '<div class="note warn" style="margin-bottom:14px">' + esc(sel.issues.join('. ')) + '.</div>';
    h += group(colIdx > 0 ? g.columns[colIdx - 1].label : '', ins, 'from');
    h += group(colIdx < g.columns.length - 1 ? g.columns[colIdx + 1].label : '', outs, 'to');
    /* Team har också system och medlemmar som inte syns i kolumnkedjan. */
    if (sel.col === 'team') {
      var sys = e.teamSystems(sel.refId);
      if (sys.length) {
        h += '<div class="field-block" style="margin-bottom:14px"><span class="label">System som teamet arbetar med</span><div class="list">';
        sys.forEach(function (x) {
          h += '<div class="list-item" style="padding:6px 0"><div class="grow">' + C.link('systems:' + x.system.id, x.system.name) + '</div>' + C.objectiveLabel(x.link.objective) + '</div>';
        });
        h += '</div></div>';
      }
      h += '<p class="muted small">' + e.teamMembers(sel.refId).length + ' medlemmar.</p>';
    }
    if (sel.col === 'system') {
      var teams = e.systemTeams(sel.refId);
      if (teams.length) {
        h += '<div class="field-block"><span class="label">Team</span><div class="list">';
        teams.forEach(function (x) {
          h += '<div class="list-item" style="padding:6px 0"><div class="grow">' + C.link('teams:' + x.team.id, x.team.name) + '</div>' + C.objectiveLabel(x.link.objective) + '</div>';
        });
        h += '</div></div>';
      }
    }
    return h || '<p class="muted">Inga kopplingar.</p>';
  }

  /* ---------- Åtgärder ---------- */

  var A = OOS.actions;
  A['graph-select'] = function (el) {
    var id = el.getAttribute('data-id');
    OOS.state.graphSel = OOS.state.graphSel === id && el.tagName !== 'BUTTON' ? null : id;
    OOS.refresh();
    var again = document.querySelector('.gnode[data-id="' + id.replace(/"/g, '') + '"]');
    if (again) again.focus({ preventScroll: el.tagName !== 'BUTTON' });
  };
  A['graph-clear'] = function () {
    OOS.state.graphSel = null;
    OOS.refresh();
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
        { key: 'loadMin', label: 'Beläggningsgrad, lägst (%)', type: 'number', min: 0, max: 100 },
        { key: 'loadMax', label: 'Beläggningsgrad, högst (%)', type: 'number', min: 0, max: 100 },
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
