/*
 * Bilder av arbetet: tidslinje med beroenden, flöde från initiativ via team till kompetensområde,
 * beroendekedja för en epik och teamets arbete period för period.
 *
 * Samma uttryck som kopplingskartan: gråskala för identitet (arbetstyp), gult och rött bara för
 * avvikelser (risk, flaskhals, klart för sent). Tunna markeringar, hårfina linjer, värden i
 * klartext. Allt som visas i en bild finns också i listan, så att inget bara går att läsa i en
 * tooltip. Rörelsen finns i js/motion.js (drawCharts).
 */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var E = OOSEngine;
  var S = OOSStore;
  var C = OOS.common;
  var esc = U.esc;

  /* Textens bredd mäts med samma typsnitt som sidan, så att etiketter kortas där de faktiskt tar slut. */
  var pen = null;
  function textW(s, size, weight) {
    if (!pen) pen = document.createElement('canvas').getContext('2d');
    pen.font = (weight || 400) + ' ' + size + 'px ' + getComputedStyle(document.body).fontFamily;
    return pen.measureText(s).width;
  }

  function trunc(s, px, size, weight) {
    size = size || 12.5;
    px -= 4;
    if (textW(s, size, weight) <= px) return s;
    var lo = 1;
    var hi = s.length - 1;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (textW(s.slice(0, mid).replace(/\s+$/, '') + '…', size, weight) <= px) lo = mid;
      else hi = mid - 1;
    }
    return s.slice(0, lo).replace(/\s+$/, '') + '…';
  }

  /* Bredden inne i ett kort: dra av kortets kant och innermarginal (se .card i app.css). */
  function cardInner() {
    var pad = Math.min(24, Math.max(16, 0.022 * window.innerWidth));
    return OOS.measure() - 2 * pad - 4;
  }

  function ms(iso) { return U.parseDate(iso).getTime(); }
  var DAY = 86400000;

  function tightAreas(e, ep, p) {
    var needs = E.normNeeds(ep.needs);
    if (!needs || !E.epicCounts(ep.status) || ep.status === 'done' || E.epicHoursInPeriod(ep, p) <= 0) return [];
    return e.teamCategoryLoad(ep.teamId, p).rows.filter(function (r) {
      return (r.gap || r.loadPct > 100.5) && needs.some(function (n) { return n.category === r.category; });
    });
  }

  /* ---------- Tidslinje ---------- */

  /*
   * Epikerna på en tidsaxel, grupperade per team eller initiativ. Beroenden ritas som en båge
   * mellan slutdatumen: från det som måste bli klart först till epiken som väntar. Pekar bågen
   * bakåt i tiden blir beroendet klart för sent, och den blir röd.
   */
  function gantt(ctx, opts) {
    var e = ctx.e;
    var p = ctx.period;
    var group = opts.group || 'team';
    var scope = opts.scope || 'work';
    var months = [];
    var m = E.prevPeriod(E.prevPeriod(E.periodOf(p.start, 'month')));
    for (var i = 0; i < 12; i++) { months.push(m); m = E.nextPeriod(m); }
    var t0 = ms(months[0].start);
    var t1 = ms(months[11].end) + DAY;

    var visible = S.db.epics.filter(function (ep) {
      if (scope === 'work' && ep.type === 'maintenance') return false;
      return ms(ep.from) < t1 && ms(ep.to) + DAY > t0;
    });

    /* Grupper: team eller initiativ, i namnordning. Utan initiativ och förvaltning sist. */
    var groups = new Map();
    visible.forEach(function (ep) {
      var key, name, go;
      if (group === 'initiative') {
        var init = ep.initiativeId ? e.get('initiatives', ep.initiativeId) : null;
        key = init ? init.id : ep.type === 'maintenance' ? '~maint' : '~none';
        name = init ? init.name : ep.type === 'maintenance' ? 'Förvaltning' : 'Utan initiativ';
        go = init ? 'initiatives:' + init.id : null;
      } else {
        var t = e.get('teams', ep.teamId);
        key = t ? t.id : '~none';
        name = t ? t.name : 'Utan team';
        go = t ? 'teams:' + t.id : null;
      }
      if (!groups.has(key)) groups.set(key, { key: key, name: name, go: go, epics: [] });
      groups.get(key).epics.push(ep);
    });
    var list = Array.from(groups.values()).sort(function (a, b) {
      return (a.key.charAt(0) === '~') - (b.key.charAt(0) === '~') || a.name.localeCompare(b.name, 'sv');
    });
    list.forEach(function (g) {
      g.epics.sort(function (a, b) { return a.from.localeCompare(b.from) || a.name.localeCompare(b.name, 'sv'); });
    });

    /* I en smal ruta står namnet ovanför stapeln, så att tidsaxeln får hela bredden. */
    var inner = cardInner();
    var compact = inner < 640;
    var W = Math.max(220, inner);
    var L = compact ? 0 : Math.round(Math.max(170, Math.min(260, W * 0.24)));
    var T = W - L - (compact ? 22 : 36); /* plats till höger för beroendebågar */
    var TOP = 34;
    var GROW = 30;
    var ROW = compact ? 42 : 28;
    var LX = compact ? 0 : 12;
    function x(tms) { return L + Math.max(0, Math.min(1, (tms - t0) / (t1 - t0))) * T; }
    function barY(ry) { return compact ? ry + 30 : ry + ROW / 2; }

    /* Rader och deras y-läge. */
    var y = TOP;
    var rowY = new Map();
    var rows = [];
    list.forEach(function (g) {
      rows.push({ kind: 'group', g: g, y: y });
      y += GROW;
      g.epics.forEach(function (ep) {
        rowY.set(ep.id, barY(y));
        rows.push({ kind: 'epic', ep: ep, y: y });
        y += ROW;
      });
    });
    var BOTTOM = y;
    var H = y + 26;
    if (!visible.length) return '<div class="empty">Inget arbete i perioden runt ' + esc(p.inText) + '.</div>';

    var arrow = function (id, cls) {
      return '<marker id="' + id + '" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path class="g-arrow' + cls + '" d="M0 0 L8 4 L0 8 z"/></marker>';
    };
    var svg = '<svg class="gantt' + (compact ? ' compact' : '') + '" data-chart="gantt-' + esc(group + '-' + scope + '-' + p.start + (compact ? '-c' : '')) + '" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-labelledby="gantt-title">' +
      '<title id="gantt-title">Tidslinje för epikerna, ' + esc(months[0].label) + ' till ' + esc(months[11].label) + '</title>' +
      '<defs>' + arrow('ga', '') + arrow('ga-risk', ' risk') + arrow('ga-late', ' late') + '</defs>';

    /* Månader: hårfina linjer, förkortade namn, aktuell period markerad. */
    svg += '<g class="g-months">';
    months.forEach(function (mm, mi) {
      var xa = x(ms(mm.start));
      var xb = x(ms(mm.end) + DAY);
      var cur = mm.start === E.periodOf(p.start, 'month').start;
      if (cur) svg += '<rect class="g-current" x="' + xa + '" y="' + (TOP - 6) + '" width="' + (xb - xa) + '" height="' + (BOTTOM - TOP + 6) + '"/>';
      svg += '<line class="g-grid" x1="' + xa + '" x2="' + xa + '" y1="' + (TOP - 6) + '" y2="' + BOTTOM + '"/>';
      var d = U.parseDate(mm.start);
      var lab = U.MONTHS[d.getUTCMonth()] + (d.getUTCMonth() === 0 || mi === 0 ? ' ' + d.getUTCFullYear() : '');
      if (xb - xa < 52) lab = U.MONTHS[d.getUTCMonth()];
      if (xb - xa < 30) lab = lab.slice(0, 1);
      svg += '<text class="g-month' + (cur ? ' cur' : '') + '" x="' + ((xa + xb) / 2) + '" y="16" text-anchor="middle">' + esc(lab) + '</text>';
    });
    svg += '<line class="g-grid" x1="' + (L + T) + '" x2="' + (L + T) + '" y1="' + (TOP - 6) + '" y2="' + BOTTOM + '"/></g>';

    /* Rader */
    rows.forEach(function (r) {
      if (r.kind === 'group') {
        var g = r.g;
        var meta = '';
        var tone = '';
        if (group === 'team' && g.go) {
          var tc = e.teamCapacity(g.key, p);
          var tight = (tc.categories || []).some(function (c) { return c.gap || c.loadPct > 100.5; });
          tone = tc.loadPct > 100.5 || tight ? ' crit' : tc.loadPct >= 90 ? ' warn' : '';
          meta = U.fmtPct(tc.loadPct) + ' belagt' + (tight ? ', flaskhals' : '');
        } else if (g.go) {
          var sum = e.initiativeSummary(g.key, p);
          meta = U.fmtH(sum.hoursInPeriod) + ' i ' + p.inText;
        }
        var nameRoom = compact ? W - (meta ? textW(meta, 12) + 16 : 0) : L - 12;
        svg += '<g class="g-group"' + (g.go ? ' data-go="' + esc(g.go) + '" tabindex="0" role="link" aria-label="' + esc(g.name + (meta ? ', ' + meta : '')) + '"' : '') + '>' +
          '<line class="g-rule" x1="0" x2="' + W + '" y1="' + r.y + '" y2="' + r.y + '"/>' +
          '<text class="g-group-name" x="0" y="' + (r.y + 19) + '">' + esc(trunc(g.name, nameRoom, 12.5, 600)) + '</text>' +
          (meta ? '<text class="g-group-meta' + tone + '" x="' + (L + T) + '" y="' + (r.y + 19) + '" text-anchor="end">' + esc(meta) + '</text>' : '') + '</g>';
        return;
      }
      var ep = r.ep;
      var xa = x(ms(ep.from));
      var xb = Math.max(xa + 4, x(ms(ep.to) + DAY));
      var cy = barY(r.y);
      var tightRows = tightAreas(e, ep, p);
      var team = e.get('teams', ep.teamId);
      var status = C.EPIC_STATUS[ep.status] || '';
      var tip = ep.name + '\n' + [C.EPIC_TYPE[ep.type], team ? team.name : ''].filter(Boolean).join(' · ') + '\n' +
        U.fmtDate(ep.from) + ' – ' + U.fmtDate(ep.to) + '\n' + C.epicFrameText(ep) + ' · ' + status +
        (tightRows.length ? '\nFlaskhals: ' + tightRows.map(function (t) { return t.category; }).join(', ') : '');
      var label = trunc(ep.name, (compact ? W - 8 : L - 22) - LX - (tightRows.length ? 14 : 0));
      var ly = compact ? r.y + 17 : cy + 4;
      svg += '<g class="gbar ' + esc(ep.type) + (ep.status === 'proposed' ? ' proposed' : '') + (ep.status === 'done' ? ' done' : '') + '" data-epic="' + esc(ep.id) + '" data-go="epics:' + esc(ep.id) + '" tabindex="0" role="link" aria-label="' + esc(tip.replace(/\n/g, ', ')) + '" data-tip="' + esc(tip) + '">' +
        '<rect class="g-hit" x="0" y="' + r.y + '" width="' + W + '" height="' + ROW + '"/>' +
        '<text class="g-label" x="' + LX + '" y="' + ly + '">' + esc(label) + '</text>' +
        (tightRows.length ? '<circle class="g-flag" cx="' + (LX + textW(label, 12.5) + 9).toFixed(1) + '" cy="' + (ly - 4) + '" r="3.5"/>' : '') +
        '<rect class="gb" x="' + xa + '" y="' + (cy - 6) + '" width="' + (xb - xa) + '" height="12" rx="3"/>' +
        '</g>';
    });

    /* I dag: linjen genom raderna, etiketten under, så att den inte krockar med månaderna. */
    var today = ms(U.todayISO());
    if (today >= t0 && today < t1) {
      var tx = x(today);
      svg += '<g class="g-today"><line x1="' + tx + '" x2="' + tx + '" y1="' + (TOP - 6) + '" y2="' + (BOTTOM + 4) + '"/><text x="' + tx + '" y="' + (H - 6) + '" text-anchor="middle">I dag</text></g>';
    }

    /* Beroenden: båge från slutet av det som måste bli klart först till slutet av epiken som väntar. */
    svg += '<g class="g-deps">';
    var depCount = 0;
    var tones = { risk: 0, late: 0 };
    visible.forEach(function (ep) {
      (ep.dependsOn || []).forEach(function (id) {
        if (!rowY.has(id) || !rowY.has(ep.id)) return;
        var dep = e.get('epics', id);
        var risks = e.epicDependencies(ep.id, p).filter(function (d) { return d.epic.id === id; })[0];
        risks = risks ? risks.risks : [];
        var tone = risks.some(function (r) { return r.kind === 'late'; }) ? 'late' : risks.length ? 'risk' : '';
        if (tone) tones[tone]++;
        var x1 = x(ms(dep.to) + DAY);
        var y1 = rowY.get(id);
        var x2 = x(ms(ep.to) + DAY);
        var y2 = rowY.get(ep.id);
        var reach = Math.min(W - 4, Math.max(x1, x2) + (compact ? 16 : 22));
        var tip = ep.name + ' väntar på ' + dep.name + (risks.length ? '\n' + risks.map(function (r) { return r.text; }).join('\n') : '');
        svg += '<path class="dep' + (tone ? ' ' + tone : '') + '" data-from="' + esc(id) + '" data-to="' + esc(ep.id) + '" data-tip="' + esc(tip) + '" ' +
          'd="M' + (x1 + 2) + ' ' + y1 + ' C' + reach + ' ' + y1 + ' ' + reach + ' ' + y2 + ' ' + (x2 + 3) + ' ' + y2 + '" marker-end="url(#ga' + (tone ? '-' + tone : '') + ')"/>';
        depCount++;
      });
    });
    svg += '</g></svg>';

    var anyFlag = visible.some(function (ep) { return tightAreas(e, ep, p).length; });
    var legend = '<div class="legend-line chart-legend" aria-hidden="true">' +
      '<span><span class="sw-k development"></span>Utveckling</span><span><span class="sw-k investigation"></span>Utredning</span>' +
      (scope === 'all' ? '<span><span class="sw-k maintenance"></span>Förvaltning</span>' : '') +
      '<span><span class="sw-k proposal"></span>Förslag</span><span><span class="sw-line"></span>Beroende</span>' +
      (tones.risk ? '<span><span class="sw-line risk"></span>Beroende med risk</span>' : '') +
      (tones.late ? '<span><span class="sw-line late"></span>Klart för sent</span>' : '') +
      (anyFlag ? '<span><span class="sw-dot crit"></span>Flaskhals i teamet</span>' : '') +
      '<span><span class="sw-line today"></span>I dag</span></div>';
    return legend + '<div class="graph-wrap chart-wrap">' + svg + '</div>' +
      '<p class="card-note">' + U.plural(visible.length, 'epik', 'epiker') + ' och ' + U.plural(depCount, 'beroende', 'beroenden') + '. Bågen går från slutet av det som måste bli klart först till slutet av epiken som väntar. ' +
      (compact ? 'Tryck på en epik för att öppna den.' : 'Håll pekaren över en epik för att se hela dess kedja av beroenden, klicka för att öppna den.') + '</p>';
  }

  /* ---------- Flöde: initiativ → team → kompetensområde ---------- */

  /*
   * Periodens beslutade arbete som flöden. Från vänster: varifrån arbetet kommer (initiativ,
   * förvaltning eller utan initiativ), vilket team som gör det och vilken kompetens det kräver.
   * Tjockleken är timmar. Ett flöde till ett område som är fullt i teamet är rött.
   */
  function flow(ctx, sel) {
    var e = ctx.e;
    var p = ctx.period;
    var src = new Map();
    var teams = new Map();
    var cats = new Map();
    var l1 = new Map();
    var l2 = [];
    function node(map, id, name, col, go) {
      if (!map.has(id)) map.set(id, { id: id, name: name, col: col, go: go, value: 0, inV: 0, outV: 0 });
      return map.get(id);
    }
    S.db.teams.forEach(function (t) {
      var d = e.teamDemand(t.id, p);
      if (d.hours <= 0.5) return;
      var tn = node(teams, 't:' + t.id, t.name, 1, 'teams:' + t.id);
      d.epics.forEach(function (x2) {
        if (!x2.counts || x2.load <= 0) return;
        var ep = x2.epic;
        var init = ep.initiativeId ? e.get('initiatives', ep.initiativeId) : null;
        var sid = init ? 's:' + init.id : ep.type === 'maintenance' ? 's:~maint' : 's:~none';
        var sn = node(src, sid, init ? init.name : ep.type === 'maintenance' ? 'Förvaltning' : 'Utan initiativ', 0, init ? 'initiatives:' + init.id : null);
        var key = sid + '|' + tn.id;
        l1.set(key, (l1.get(key) || 0) + x2.load);
        sn.outV += x2.load;
        tn.inV += x2.load;
      });
      e.teamCategoryLoad(t.id, p).rows.forEach(function (r) {
        if (r.demand <= 0.5) return;
        var cn = node(cats, 'c:' + r.category, r.category, 2, null);
        cn.inV += r.demand;
        tn.outV += r.demand;
        l2.push({ a: tn.id, b: cn.id, v: r.demand, tight: r.gap || r.loadPct > 100.5, gap: r.gap, row: r, team: t });
      });
    });
    var links = [];
    l1.forEach(function (v, key) { var k = key.split('|'); links.push({ a: k[0], b: k[1], v: v }); });
    links = links.concat(l2);
    var cols = [Array.from(src.values()), Array.from(teams.values()), Array.from(cats.values())];
    if (!cols[1].length) return '<div class="empty">Inget beslutat arbete i ' + esc(p.inText) + '.</div>';
    cols.forEach(function (c) { c.forEach(function (n) { n.value = Math.max(n.inV, n.outV); }); });

    /* Ordning: källor efter storlek (förvaltning och utan initiativ sist), sedan efter tyngdpunkt. */
    cols[0].sort(function (a, b) { return (a.id.indexOf('~') > 0) - (b.id.indexOf('~') > 0) || b.value - a.value; });
    function barycenter(col, prev, dir) {
      var idx = new Map(prev.map(function (n, i) { return [n.id, i]; }));
      col.forEach(function (n) {
        var w = 0;
        var s = 0;
        links.forEach(function (l) {
          var other = dir > 0 ? (l.b === n.id ? l.a : null) : (l.a === n.id ? l.b : null);
          if (other && idx.has(other)) { w += l.v; s += l.v * idx.get(other); }
        });
        n.bc = w ? s / w : 999;
      });
      col.sort(function (a, b) { return a.bc - b.bc; });
    }
    barycenter(cols[1], cols[0], 1);
    barycenter(cols[2], cols[1], 1);
    barycenter(cols[1], cols[2], -1);
    barycenter(cols[1], cols[0], 1);

    var W = Math.max(600, cardInner());
    var NW = 10;
    var LW = Math.round(Math.max(170, Math.min(300, W * 0.26)));
    var RW = Math.round(Math.max(170, Math.min(230, W * 0.2)));
    var TOP = 30;
    var GAP = 8;
    var maxN = Math.max(cols[0].length, cols[1].length, cols[2].length);
    var H = Math.max(420, maxN * 30 + TOP + 10);
    var total = U.sum(cols[1], function (n) { return n.value; });
    var k = Math.min.apply(null, cols.map(function (c) {
      var t = U.sum(c, function (n) { return n.value; }) || 1;
      return (H - TOP - 10 - (c.length - 1) * GAP) / t;
    }));
    var X = [LW, Math.round((LW + W - RW - NW) / 2), W - RW - NW];
    cols.forEach(function (c, ci) {
      var used = U.sum(c, function (n) { return n.value * k; }) + (c.length - 1) * GAP;
      var yy = TOP + Math.max(0, (H - TOP - 10 - used) / 2);
      c.forEach(function (n) {
        n.x = X[ci];
        n.y = yy;
        n.h = Math.max(2, n.value * k);
        n.outOff = 0;
        n.inOff = 0;
        yy += n.h + GAP;
      });
    });
    var byId = new Map();
    cols.forEach(function (c) { c.forEach(function (n) { byId.set(n.id, n); }); });
    /* Flödena staplas i noden i samma ordning som noderna de går till, så att de korsar så lite som möjligt. */
    links.sort(function (a, b) { return byId.get(a.b).y - byId.get(b.b).y; });
    links.forEach(function (l) { var a = byId.get(l.a); l.th = l.v * k; l.y0 = a.y + a.outOff + l.th / 2; a.outOff += l.th; });
    links.slice().sort(function (a, b) { return byId.get(a.a).y - byId.get(b.a).y; }).forEach(function (l) {
      var b = byId.get(l.b); l.y1 = b.y + b.inOff + l.th / 2; b.inOff += l.th;
    });

    /* Fokus: den valda noden och det som hänger ihop med den, ett steg åt varje håll. */
    var focus = null;
    if (sel && byId.has(sel)) {
      focus = { nodes: new Set([sel]), links: new Set(), far: new Set() };
      links.forEach(function (l, i) {
        if (l.a === sel || l.b === sel) { focus.links.add(i); focus.nodes.add(l.a); focus.nodes.add(l.b); }
      });
      var col = byId.get(sel).col;
      if (col !== 1) {
        links.forEach(function (l, i) {
          if (focus.links.has(i)) return;
          var touchesTeam = (col === 0 && focus.nodes.has(l.a) && byId.get(l.a).col === 1) || (col === 2 && focus.nodes.has(l.b) && byId.get(l.b).col === 1);
          if (touchesTeam) { focus.far.add(i); focus.nodes.add(l.a); focus.nodes.add(l.b); }
        });
      }
    }

    var svg = '<svg class="flow' + (focus ? ' focused' : '') + '" data-chart="flow-' + esc(p.start) + '" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="group" aria-labelledby="flow-title">' +
      '<title id="flow-title">Beslutat arbete i ' + esc(p.inText) + ' från initiativ via team till kompetensområde</title>';
    ['Varifrån arbetet kommer', 'Team', 'Kompetensområde'].forEach(function (t, ci) {
      svg += '<text class="graph-head" x="' + (ci === 0 ? X[0] + NW : ci === 1 ? X[1] : X[2]) + '" y="14"' + (ci === 0 ? ' text-anchor="end"' : '') + '>' + esc(t) + '</text>';
    });
    svg += '<g class="flinks">';
    links.forEach(function (l, i) {
      var a = byId.get(l.a);
      var b = byId.get(l.b);
      var x0 = a.x + NW;
      var x1 = b.x;
      var mx = (x0 + x1) / 2;
      var state = !focus ? '' : focus.links.has(i) ? ' on' : focus.far.has(i) ? ' far' : ' off';
      var tip = a.name + ' → ' + b.name + '\n' + U.fmtH(l.v) + (l.tight ? '\n' + (l.gap ? l.team.name + ' saknar ' + b.name : b.name + ' är fullt i ' + l.team.name + ': ' + U.fmtPct(l.row.loadPct)) : '');
      svg += '<path class="flink' + (l.tight ? ' tight' : '') + (l.gap ? ' gap' : '') + state + '" data-c="' + a.col + '" data-a="' + esc(l.a) + '" data-b="' + esc(l.b) + '" data-tip="' + esc(tip) + '" ' +
        'd="M' + x0 + ' ' + l.y0.toFixed(1) + ' C' + mx + ' ' + l.y0.toFixed(1) + ' ' + mx + ' ' + l.y1.toFixed(1) + ' ' + x1 + ' ' + l.y1.toFixed(1) + '" stroke-width="' + Math.max(1, l.th).toFixed(1) + '"/>';
    });
    svg += '</g>';
    cols.forEach(function (c, ci) {
      c.forEach(function (n) {
        var state = !focus ? '' : n.id === sel ? ' sel' : focus.nodes.has(n.id) ? ' on' : ' off';
        var tightTeam = ci === 1 && links.some(function (l) { return l.a === n.id && l.tight; });
        var label = n.name;
        var hours = U.fmtH(n.value);
        /* Kolumnen heter Team, så ordet behöver inte stå i varje etikett. Hela namnet finns i aria-label. */
        var shown = ci === 1 ? label.replace(/\s+Team$/, '') : label;
        var tx = ci === 0 ? n.x - 8 : n.x + NW + 8;
        var room = (ci === 0 ? LW - 14 : ci === 1 ? (X[2] - X[1]) * 0.72 : RW - 14) - textW(' ' + hours, 12.5);
        var cy = n.y + n.h / 2;
        svg += '<g class="fnode c' + ci + state + (tightTeam ? ' issue' : '') + '" data-id="' + esc(n.id) + '" data-c="' + ci + '" tabindex="0" role="button" aria-pressed="' + (n.id === sel) + '" ' +
          'aria-label="' + esc(label + ', ' + hours + (tightTeam ? ', flaskhals' : '')) + '" data-action="flow-select" data-tip="' + esc(label + '\n' + hours + (tightTeam ? '\nFlaskhals i teamet' : '')) + '">' +
          '<rect class="f-hit" x="' + (ci === 0 ? n.x - LW + 4 : n.x) + '" y="' + (n.y - 2) + '" width="' + (ci === 0 ? LW - 4 + NW : NW + room) + '" height="' + Math.max(16, n.h + 4) + '"/>' +
          '<rect class="f-bar" x="' + n.x + '" y="' + n.y + '" width="' + NW + '" height="' + n.h + '" rx="2"/>' +
          '<text class="f-label" x="' + tx + '" y="' + (cy + 4) + '"' + (ci === 0 ? ' text-anchor="end"' : '') + '>' + esc(trunc(shown, room)) + ' <tspan class="f-val">' + esc(hours) + '</tspan></text>' +
          (tightTeam ? '<circle class="f-flag" cx="' + (ci === 0 ? n.x - 4 : n.x + NW / 2) + '" cy="' + (n.y - 6) + '" r="3"/>' : '') + '</g>';
      });
    });
    svg += '</svg>';
    var legend = '<div class="legend-line chart-legend" aria-hidden="true"><span><span class="sw-line thick"></span>Timmar, tjockare är mer</span>' +
      '<span><span class="sw-line thick crit"></span>Till ett område som är fullt i teamet</span></div>';
    return legend + '<div class="graph-wrap chart-wrap">' + svg + '</div>' +
      '<p class="card-note">' + U.fmtH(total) + ' beslutat arbete i ' + esc(p.inText) + '. ' +
      (W > cardInner() + 1 ? 'Dra i sidled för att se team och kompetensområden. Tryck' : 'Klicka') + ' på en nod för att se vad som hänger ihop med den, och en gång till för att släppa.</p>';
  }

  /* ---------- Beroendekedja för en epik ---------- */

  /*
   * Det epiken väntar på till vänster, epiken i mitten och det som väntar på den till höger.
   * Rutorna är vanlig HTML som bryter text som allt annat. Pilarna ritas efter layouten i
   * js/layout.js (connect), från rutornas faktiska läge, så att de håller vid varje bredd.
   * I en smal ruta staplas kolumnerna och pilarna pekar nedåt.
   */
  function chain(ep, deps, waiting, ctx) {
    var e = ctx.e;
    function tone(risks) {
      return risks.some(function (r) { return r.kind === 'late'; }) ? ' late' : risks.length ? ' risk' : '';
    }
    function node(x, key, center) {
      var t = e.get('teams', x.epic.teamId);
      var risks = x.risks || [];
      var sub = (t ? t.name + ' · ' : '') + (center ? '' : (C.EPIC_STATUS[x.epic.status] || '') + ' · ') + 'klar ' + U.fmtDate(x.epic.to);
      var label = x.epic.name + ', ' + sub + (risks.length ? '. ' + risks.map(function (r) { return r.text; }).join('. ') : '');
      return '<div class="chain-node' + (center ? ' sel' : '') + tone(risks) + '" data-node="' + key + '"' +
        (center ? '' : ' data-go="epics:' + esc(x.epic.id) + '" tabindex="0" role="link" aria-label="' + esc(label) + '"') + '>' +
        '<span class="chain-name">' + esc(x.epic.name) + '</span><span class="chain-sub">' + esc(sub) + '</span>' +
        (risks.length ? '<ul class="chain-risks">' + risks.map(function (r) { return '<li class="' + (r.kind === 'late' ? 'late' : 'risk') + '">' + esc(r.text) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>';
    }
    function column(cls, head, list, side) {
      return '<div class="chain-col ' + cls + '"><div class="chain-head">' + head + '</div><div class="chain-list">' +
        (list.length ? list.map(function (x, i) { return node(x, side + i, false); }).join('') : '<div class="chain-none">Inget</div>') + '</div></div>';
    }
    var edges = '';
    deps.forEach(function (x, i) {
      edges += '<g class="cedge' + tone(x.risks) + '" data-a="in' + i + '" data-b="mid"><path class="cline"/><path class="carrow"/></g>';
    });
    waiting.forEach(function (x, i) {
      edges += '<g class="cedge' + tone(x.risks) + '" data-a="mid" data-b="out' + i + '"><path class="cline"/><path class="carrow"/></g>';
    });
    return '<div class="chain" data-chart="chain-' + esc(ep.id) + '">' +
      '<svg class="chain-edges" data-connect aria-hidden="true">' + edges + '</svg>' +
      column('in', 'Väntar på', deps, 'in') +
      '<div class="chain-down' + (deps.length ? '' : ' none') + '" aria-hidden="true"></div>' +
      '<div class="chain-col mid"><div class="chain-head">Epiken</div><div class="chain-list">' + node({ epic: ep, risks: [] }, 'mid', true) + '</div></div>' +
      '<div class="chain-down' + (waiting.length ? '' : ' none') + '" aria-hidden="true"></div>' +
      column('out', 'Väntar på den här', waiting, 'out') + '</div>';
  }

  /* ---------- Teamets arbete period för period, med epikens del ---------- */

  function periodChart(ep, team, periods, ctx) {
    var e = ctx.e;
    var counts = E.epicCounts(ep.status);
    var data = periods.map(function (pp) {
      var tc = e.teamCapacity(team.id, pp);
      var mine = E.epicHoursInPeriod(ep, pp);
      var loaded = tc.loaded + (counts ? 0 : mine);
      return { p: pp, cap: tc.capacity, loaded: loaded, mine: mine, other: loaded - mine, current: pp.start === ctx.period.start };
    });
    var max = Math.max.apply(null, data.map(function (d) { return Math.max(d.cap, d.loaded); }).concat([1]));
    var h = '<div class="legend-line chart-legend" aria-hidden="true"><span><span class="sw loaded"></span>Epiken' + (counts ? '' : ' (förslag)') + '</span>' +
      '<span><span class="sw other"></span>Annat arbete i teamet</span><span><span class="sw-line cap"></span>Kapacitet</span><span><span class="sw over"></span>Över kapaciteten</span></div>';
    h += '<div class="pchart" role="img" aria-label="' + esc(data.map(function (d) { return d.p.label + ': ' + U.fmtH(d.loaded) + ' av ' + U.fmtH(d.cap); }).join(', ')) + '">';
    data.forEach(function (d) {
      var pct = d.cap ? (d.loaded / d.cap) * 100 : 0;
      var tone = pct > 100.5 ? ' crit' : pct >= 90 ? ' warn' : '';
      var over = Math.max(0, d.loaded - d.cap);
      var tip = d.p.label + '\nEpiken: ' + U.fmtH(d.mine) + '\nAnnat arbete: ' + U.fmtH(d.other) + '\nKapacitet: ' + U.fmtH(d.cap) + ' (' + U.fmtPct(pct) + ' belagt)';
      var mon = U.MONTHS[U.parseDate(d.p.start).getUTCMonth()];
      h += '<div class="pcol' + (d.current ? ' current' : '') + '" data-tip="' + esc(tip) + '" tabindex="0" aria-label="' + esc(tip.replace(/\n/g, ', ')) + '">' +
        '<span class="pval' + tone + '">' + U.fmtPct(pct) + '</span>' +
        '<div class="pplot">' +
        '<div class="col-bar pstack" style="height:' + ((d.loaded / max) * 100).toFixed(2) + '%">' +
        (d.mine > 0.5 ? '<span class="pmine' + (counts ? '' : ' proposal') + '" style="flex-grow:' + d.mine.toFixed(1) + '"></span>' : '') +
        (d.other > 0.5 ? '<span class="pother" style="flex-grow:' + d.other.toFixed(1) + '"></span>' : '') +
        (over > 0.5 ? '<span class="pover" style="height:' + ((over / d.loaded) * 100).toFixed(2) + '%"></span>' : '') +
        '</div><span class="pcap" style="bottom:' + ((d.cap / max) * 100).toFixed(2) + '%"></span></div>' +
        '<span class="plabel">' + esc(mon) + '</span></div>';
    });
    return h + '</div>';
  }

  OOS.epicViz = { gantt: gantt, flow: flow, chain: chain, periodChart: periodChart };

  /* ---------- Rörelse när man pekar ---------- */

  /*
   * I tidslinjen lyser epikens hela kedja upp när man pekar på den eller ger den fokus: allt den
   * väntar på, bakåt i flera led, och allt som väntar på den, framåt. Resten tonas ned.
   * Det sker utan omritning, så att det känns direkt.
   */
  function chainOf(edges, start, from, to) {
    var ids = new Set([start]);
    var on = new Set();
    var grew = true;
    while (grew) {
      grew = false;
      edges.forEach(function (ed) {
        if (!on.has(ed) && ids.has(ed[from])) { on.add(ed); ids.add(ed[to]); grew = true; }
      });
    }
    return { ids: ids, on: on };
  }

  function hot(target) {
    var svg = target && target.closest ? target.closest('.gantt') : null;
    document.querySelectorAll('.gantt.hot').forEach(function (g) {
      if (g === svg) return;
      g.classList.remove('hot');
      g.querySelectorAll('.on').forEach(function (x) { x.classList.remove('on'); });
    });
    if (!svg) return;
    var bar = target.closest('.gbar');
    var dep = target.closest('.dep');
    svg.querySelectorAll('.on').forEach(function (x) { x.classList.remove('on'); });
    if (!bar && !dep) { svg.classList.remove('hot'); return; }
    var edges = Array.prototype.map.call(svg.querySelectorAll('.dep'), function (d) {
      return { el: d, a: d.getAttribute('data-from'), b: d.getAttribute('data-to') };
    });
    var up = chainOf(edges, bar ? bar.getAttribute('data-epic') : dep.getAttribute('data-from'), 'b', 'a');
    var down = chainOf(edges, bar ? bar.getAttribute('data-epic') : dep.getAttribute('data-to'), 'a', 'b');
    var ids = new Set(Array.from(up.ids).concat(Array.from(down.ids)));
    up.on.forEach(function (ed) { ed.el.classList.add('on'); });
    down.on.forEach(function (ed) { ed.el.classList.add('on'); });
    if (dep) dep.classList.add('on');
    svg.querySelectorAll('.gbar').forEach(function (b) { if (ids.has(b.getAttribute('data-epic'))) b.classList.add('on'); });
    svg.classList.add('hot');
  }
  /* Bara när pekaren faktiskt rör sig: en rullning som fokus orsakar ska inte släppa kedjan. */
  var at = { x: -1, y: -1, el: null };
  document.addEventListener('mousemove', function (ev) {
    if (ev.clientX === at.x && ev.clientY === at.y) return;
    at.x = ev.clientX;
    at.y = ev.clientY;
    var el = ev.target.closest ? ev.target.closest('.gbar, .dep, .gantt') : null;
    if (el === at.el) return;
    at.el = el;
    hot(ev.target);
  });
  document.addEventListener('focusin', function (ev) { at.el = null; hot(ev.target); });

  /* Ett val i flödet ritas om. De flöden som hör till valet ritas ut på nytt, resten tonas ned. */
  OOS.actions['flow-select'] = function (el) {
    var id = el.getAttribute('data-id');
    OOS.state.flowSel = OOS.state.flowSel === id ? null : id;
    OOS.motion('quiet');
    OOS.refresh();
    var svg = document.querySelector('.flow');
    if (svg) OOSMotion.focusFlow(svg);
    var again = document.querySelector('.fnode[data-id="' + id.replace(/"/g, '') + '"]');
    if (again) again.focus({ preventScroll: true });
  };
})();
