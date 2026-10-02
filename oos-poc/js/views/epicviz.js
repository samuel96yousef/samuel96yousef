/*
 * Bilder av arbetet: tidslinje med beroenden, kopplingar från initiativ via team till
 * kompetensområde, beroendekedja för en epik och teamets arbete period för period.
 *
 * Allt är vanlig HTML som bryter text och följer bredden, så att inget behöver kortas eller
 * rullas. Bara linjerna mellan rutor ritas i svg, efter layouten (js/layout.js, connect).
 * Gråskala för identitet (arbetstyp), gult och rött bara för avvikelser. Det som syns i en bild
 * står också i text. Rörelsen finns i js/motion.js (drawChart).
 */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var E = OOSEngine;
  var S = OOSStore;
  var C = OOS.common;
  var esc = U.esc;

  function ms(iso) { return U.parseDate(iso).getTime(); }
  var DAY = 86400000;

  function slug(s) { return String(s).replace(/[^a-zA-Z0-9_-]+/g, '-'); }

  function toneOf(risks) {
    return risks.some(function (r) { return r.kind === 'late'; }) ? 'late' : risks.length ? 'risk' : '';
  }

  /* Områden som epiken behöver och som är fulla eller saknas i teamet. */
  function tightAreas(e, ep, p) {
    var needs = E.normNeeds(ep.needs);
    if (!needs || !e.counts(ep) || ep.status === 'done' || E.epicHoursInPeriod(ep, p) <= 0) return [];
    return e.teamCategoryLoad(ep.teamId, p).rows.filter(function (r) {
      return (r.gap || r.loadPct > 100.5) && needs.some(function (n) { return n.category === r.category; });
    });
  }

  function areaText(r) {
    return r.gap ? r.category + ' saknas i teamet' : r.category + ' är fullt, ' + U.fmtPct(r.loadPct);
  }

  /*
   * Belastning mot kapacitet: appens standardstapel (UI.loadTrack). Mörk del hör till valet, ljusblå
   * är annat arbete. key gör att delarna glider till nya värden vid ett nytt val.
   */
  function loadBar(part, rest, cap, key, opts) {
    return UI.loadTrack(part, rest, cap, Object.assign({ key: key }, opts || {}));
  }

  /*
   * Storlek utan kapacitet, för varifrån arbetet kommer: längden är timmar mot den största källan.
   * Ingen ljus del och inget streck, eftersom det inte finns någon kapacitet att jämföra med.
   */
  function sizeBar(part, rest, max, key) {
    function seg(cls, v, k) {
      return '<span class="' + cls + '" data-morph="' + esc(key + '|' + k) + '" style="width:' + (max ? (v / max) * 100 : 0).toFixed(2) + '%"></span>';
    }
    return '<span class="lbar size" aria-hidden="true">' + seg('lb-part', part, 'p') + seg('lb-rest', rest, 'r') + '</span>';
  }

  /* ---------- Tidslinje ---------- */

  /*
   * Epikerna på en tidsaxel. Standard är att gruppera efter beroendekedjor, så att det som hänger
   * ihop står under varandra i den ordning det måste göras. Ett beroende visas på den väntande
   * epikens rad som en romb där det den väntar på blir klart. Ligger romben efter epikens slut blir
   * beroendet klart för sent, och glappet ritas rött. En lodrät linje går upp till beroendet.
   * Ett klick på en rad fäller ut detaljerna under den.
   */
  function timeline(ctx, opts) {
    var e = ctx.e;
    var p = ctx.period;
    var group = opts.group || 'chain';
    var open = opts.open || null;
    var months = [];
    var m = E.prevPeriod(E.prevPeriod(E.periodOf(p.start, 'month')));
    for (var i = 0; i < 12; i++) { months.push(m); m = E.nextPeriod(m); }
    var t0 = ms(months[0].start);
    var t1 = ms(months[11].end) + DAY;
    function pct(t) { return Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) * 100; }
    function endOf(ep) { return ms(ep.to) + DAY; }
    var curMonth = E.periodOf(p.start, 'month').start;

    /* Förvaltningen löper hela tiden och har inga beroenden, så den står inte i tidslinjen. */
    var visible = S.db.epics.filter(function (ep) {
      return ep.type !== 'maintenance' && ms(ep.from) < t1 && endOf(ep) > t0;
    });
    if (!visible.length) return '<div class="empty">Inget arbete i perioden runt ' + esc(p.inText) + '.</div>';
    var byId = new Map(visible.map(function (ep) { return [ep.id, ep]; }));

    var edges = [];
    visible.forEach(function (ep) {
      e.epicDependencies(ep.id, p).forEach(function (d) {
        if (!byId.has(d.epic.id)) return;
        edges.push({ from: d.epic.id, to: ep.id, risks: d.risks, tone: toneOf(d.risks) });
      });
    });
    var tones = { late: 0, risk: 0 };
    edges.forEach(function (x) { if (x.tone) tones[x.tone]++; });

    /* Grupper */
    var groups = [];
    function byStart(a, b) { return a.from.localeCompare(b.from) || a.name.localeCompare(b.name, 'sv'); }
    if (group === 'chain') {
      var root = new Map(visible.map(function (ep) { return [ep.id, ep.id]; }));
      var find = function (x) { while (root.get(x) !== x) x = root.get(x); return x; };
      edges.forEach(function (x) { var a = find(x.from); var b = find(x.to); if (a !== b) root.set(a, b); });
      var comp = new Map();
      visible.forEach(function (ep) {
        var r = find(ep.id);
        if (!comp.has(r)) comp.set(r, []);
        comp.get(r).push(ep);
      });
      var loose = [];
      comp.forEach(function (list) {
        if (list.length < 2) { loose.push(list[0]); return; }
        var ids = new Set(list.map(function (x) { return x.id; }));
        var inner = edges.filter(function (x) { return ids.has(x.to); });
        /* Ordning: det som måste bli klart först överst, sedan efter start. */
        var indeg = new Map(list.map(function (x) { return [x.id, 0]; }));
        inner.forEach(function (x) { indeg.set(x.to, indeg.get(x.to) + 1); });
        var ready = list.filter(function (x) { return !indeg.get(x.id); }).sort(byStart);
        var order = [];
        while (ready.length) {
          var next = ready.shift();
          order.push(next);
          inner.filter(function (x) { return x.from === next.id; }).forEach(function (x) {
            indeg.set(x.to, indeg.get(x.to) - 1);
            if (!indeg.get(x.to)) { ready.push(byId.get(x.to)); ready.sort(byStart); }
          });
        }
        var inits = new Set(list.map(function (x) { return x.initiativeId || ''; }));
        var init = inits.size === 1 && list[0].initiativeId ? e.get('initiatives', list[0].initiativeId) : null;
        var sinks = list.filter(function (x) { return !inner.some(function (y) { return y.from === x.id; }); })
          .sort(function (a, b) { return b.to.localeCompare(a.to); });
        var worst = inner.some(function (x) { return x.tone === 'late'; }) ? 'late' : inner.some(function (x) { return x.tone === 'risk'; }) ? 'risk' : '';
        groups.push({
          key: 'k:' + order[0].id,
          name: init ? init.name : 'Kedja till ' + sinks[0].name,
          go: init ? 'initiatives:' + init.id : null,
          tone: worst === 'late' ? 'crit' : worst === 'risk' ? 'warn' : '',
          meta: U.plural(list.length, 'epik', 'epiker') + ', ' + (worst === 'late' ? 'något blir klart för sent' : worst === 'risk' ? 'risk i beroendena' : 'inga risker'),
          rank: worst === 'late' ? 0 : worst === 'risk' ? 1 : 2,
          start: order[0].from,
          epics: order
        });
      });
      groups.sort(function (a, b) { return a.rank - b.rank || a.start.localeCompare(b.start); });
      if (loose.length) {
        groups.push({ key: '~loose', name: 'Utan beroenden', meta: U.plural(loose.length, 'epik', 'epiker'), loose: true, epics: loose.sort(byStart) });
      }
    } else {
      var map = new Map();
      visible.forEach(function (ep) {
        var key, name, go;
        if (group === 'initiative') {
          var init2 = ep.initiativeId ? e.get('initiatives', ep.initiativeId) : null;
          key = init2 ? init2.id : '~none';
          name = init2 ? init2.name : 'Utan initiativ';
          go = init2 ? 'initiatives:' + init2.id : null;
        } else {
          var t = e.get('teams', ep.teamId);
          key = t ? t.id : '~none';
          name = t ? t.name : 'Utan team';
          go = t ? 'teams:' + t.id : null;
        }
        if (!map.has(key)) map.set(key, { key: key, name: name, go: go, epics: [] });
        map.get(key).epics.push(ep);
      });
      groups = Array.from(map.values()).sort(function (a, b) {
        return (a.key.charAt(0) === '~') - (b.key.charAt(0) === '~') || a.name.localeCompare(b.name, 'sv');
      });
      groups.forEach(function (g) {
        g.epics.sort(byStart);
        if (group === 'team' && g.go) {
          var tc = e.teamCapacity(g.key, p);
          var tight = (tc.categories || []).some(function (c) { return c.gap || c.loadPct > 100.5; });
          g.tone = tc.loadPct > 100.5 || tight ? 'crit' : tc.loadPct >= 90 ? 'warn' : '';
          g.meta = U.fmtPct(tc.loadPct) + ' belagt i ' + p.inText + (tight ? ', flaskhals' : '');
        } else if (g.go) {
          g.meta = U.fmtH(e.initiativeSummary(g.key, p).hoursInPeriod) + ' i ' + p.inText;
        } else {
          g.meta = U.plural(g.epics.length, 'epik', 'epiker');
        }
      });
    }

    /* Rutnät och axel: månader, aktuell månad och i dag. Rutnätet ligger under raderna. */
    var grid = '<div class="tl-grid" aria-hidden="true">';
    var axis = '<div class="tl-axis" aria-hidden="true">';
    months.forEach(function (mm, mi) {
      var a = pct(ms(mm.start));
      var b = pct(ms(mm.end) + DAY);
      var cur = mm.start === curMonth;
      var d = U.parseDate(mm.start);
      var name = U.MONTHS[d.getUTCMonth()];
      var year = d.getUTCMonth() === 0 || mi === 0 ? ' ' + d.getUTCFullYear() : '';
      if (cur) grid += '<span class="tl-cur" style="left:' + a.toFixed(3) + '%;width:' + (b - a).toFixed(3) + '%"></span>';
      if (mi) grid += '<span class="tl-line" style="left:' + a.toFixed(3) + '%"></span>';
      axis += '<span class="tl-month' + (cur ? ' cur' : '') + '" style="left:' + a.toFixed(3) + '%;width:' + (b - a).toFixed(3) + '%">' +
        '<span class="m3">' + esc(name) + '</span><span class="m1">' + esc(name.charAt(0)) + '</span>' + (year ? '<span class="yr">' + esc(year) + '</span>' : '') + '</span>';
    });
    var today = ms(U.todayISO());
    var hasToday = today >= t0 && today < t1;
    if (hasToday) grid += '<span class="tl-today" style="left:' + pct(today).toFixed(3) + '%"></span>';
    grid += '</div>';
    axis += '</div>';

    function rowTone(incoming) {
      return incoming.some(function (x) { return x.tone === 'late'; }) ? ' has-late' : incoming.some(function (x) { return x.tone; }) ? ' has-risk' : '';
    }

    /* Detaljer under raden: samma uppgifter som epiksidan, i kort form. */
    function panel(ep, tight) {
      var team = e.get('teams', ep.teamId);
      var waiting = e.epicDependents(ep.id, p);
      var deps = e.epicDependencies(ep.id, p);
      var hrs = E.epicHoursInPeriod(ep, p);
      function item(x) {
        var t = toneOf(x.risks);
        var tm = e.get('teams', x.epic.teamId);
        return '<li class="tl-dep' + (t ? ' ' + t : '') + '">' + C.epicRef(x.epic) +
          '<span class="tl-dep-sub">' + esc((tm ? tm.name + ' · ' : '') + 'klar ' + U.fmtDate(x.epic.to)) + '</span>' +
          x.risks.map(function (r) { return '<span class="tl-risk ' + (r.kind === 'late' ? 'late' : 'risk') + '">' + esc(r.text) + '</span>'; }).join('') + '</li>';
      }
      return '<div class="tl-panel" id="tl-panel-' + esc(slug(ep.id)) + '" role="region" aria-label="' + esc('Om ' + ep.name) + '">' +
        '<div class="tl-panel-head"><div><div class="tl-panel-title">' + esc(ep.name) + (ep.status === 'proposed' ? ' ' + C.epicStatus(ep.status) : '') + '</div>' +
        '<div class="tl-panel-sub">' + esc([C.EPIC_TYPE[ep.type], team ? team.name : '', U.fmtDate(ep.from) + ' – ' + U.fmtDate(ep.to), C.epicFrameText(ep)].filter(Boolean).join(' · ') +
          (hrs > 0 ? ' · ' + U.fmtH(hrs) + ' i ' + p.inText : '')) + '</div></div>' +
        UI.btn('Öppna epiken', 'go', { cls: 'btn-sm', data: { to: 'epics:' + ep.id } }) + '</div>' +
        '<div class="tl-panel-cols">' +
        '<div><div class="tl-ph">Väntar på</div>' + (deps.length ? '<ul class="tl-deps">' + deps.map(item).join('') + '</ul>' : '<p class="muted small">Inget.</p>') + '</div>' +
        '<div><div class="tl-ph">Väntar på den här</div>' + (waiting.length ? '<ul class="tl-deps">' + waiting.map(item).join('') + '</ul>' : '<p class="muted small">Inget.</p>') + '</div>' +
        '<div><div class="tl-ph">Kompetens i teamet</div>' + (tight.length ? '<ul class="tl-deps">' + tight.map(function (r) { return '<li class="tl-dep late"><span class="tl-risk late">' + esc(areaText(r)) + '</span></li>'; }).join('') + '</ul>' :
          '<p class="muted small">' + (E.normNeeds(ep.needs) ? 'Teamet har plats i de områden epiken behöver.' : 'Epiken har inget kompetensbehov angivet.') + '</p>') + '</div>' +
        '</div></div>';
    }

    function row(ep) {
      var a = pct(ms(ep.from));
      var b = pct(endOf(ep));
      var team = e.get('teams', ep.teamId);
      var tight = tightAreas(e, ep, p);
      var incoming = edges.filter(function (x) { return x.to === ep.id; });
      var isOpen = open === ep.id;
      var info = [C.EPIC_TYPE[ep.type], team ? team.name : '', C.EPIC_STATUS[ep.status]].filter(Boolean).join(' · ') +
        '\n' + U.fmtDate(ep.from) + ' – ' + U.fmtDate(ep.to) + ' · ' + C.epicFrameText(ep);
      var label = ep.name + ', ' + info.replace(/\n/g, ', ') +
        (incoming.length ? ', väntar på ' + U.plural(incoming.length, 'epik', 'epiker') + (incoming.some(function (x) { return x.tone === 'late'; }) ? ', något blir klart för sent' : incoming.some(function (x) { return x.tone; }) ? ', med risk' : '') : '') +
        (tight.length ? ', flaskhals: ' + tight.map(areaText).join(', ') : '');
      var track = '<span class="tl-bar ' + esc(ep.type) + (ep.status === 'proposed' ? ' proposed' : '') + (ep.status === 'done' ? ' done' : '') +
        (ms(ep.from) < t0 ? ' cut-l' : '') + (endOf(ep) > t1 ? ' cut-r' : '') + '" style="left:' + a.toFixed(3) + '%;width:' + Math.max(0.6, b - a).toFixed(3) + '%" data-tip="' + esc(ep.name + '\n' + info) + '"></span>';
      incoming.forEach(function (x) {
        var dep = byId.get(x.from);
        var at = pct(endOf(dep));
        if (x.tone === 'late' && at > b) track += '<span class="tl-delay" style="left:' + b.toFixed(3) + '%;width:' + (at - b).toFixed(3) + '%"></span>';
        track += '<span class="tl-mark' + (x.tone ? ' ' + x.tone : '') + '" data-from="' + esc(x.from) + '" style="left:' + at.toFixed(3) + '%" data-tip="' +
          esc('Väntar på ' + dep.name + '\nKlar ' + U.fmtDate(dep.to) + (x.risks.length ? '\n' + x.risks.map(function (r) { return r.text; }).join('\n') : '')) + '"></span>';
      });
      var h = '<div class="tl-row' + (isOpen ? ' is-open' : '') + rowTone(incoming) + '" data-node="' + esc(ep.id) + '" data-epic="' + esc(ep.id) + '" data-action="tl-open" data-id="' + esc(ep.id) + '">' +
        '<button type="button" class="tl-name" id="tl-' + esc(slug(ep.id)) + '" data-action="tl-open" data-id="' + esc(ep.id) + '" aria-expanded="' + isOpen + '" aria-controls="tl-panel-' + esc(slug(ep.id)) + '" aria-label="' + esc(label) + '">' +
        '<span class="tl-text">' + esc(ep.name) + '</span>' + (tight.length ? '<span class="tl-flag"></span>' : '') + '</button>' +
        '<div class="tl-track" aria-hidden="true">' + track + '</div></div>';
      if (isOpen) h += panel(ep, tight);
      return h;
    }

    var body = '';
    groups.forEach(function (g) {
      var collapsed = g.loose && !opts.loose;
      body += '<div class="tl-group' + (g.tone ? ' ' + g.tone : '') + '">' +
        '<div class="tl-gname">' + (g.go ? C.link(g.go, g.name) : esc(g.name)) + '</div>' +
        '<div class="tl-gmeta">' + esc(g.meta || '') +
        (g.loose ? ' <button type="button" class="btn btn-sm" data-action="tl-loose" aria-expanded="' + !collapsed + '">' + (collapsed ? 'Visa' : 'Dölj') + '</button>' : '') + '</div></div>';
      if (!collapsed) g.epics.forEach(function (ep) { body += row(ep); });
    });

    /* Den utfällda epikens kedja ritas alltid, också när linjerna annars bara syns för pekaren. */
    var pinned = new Set();
    if (open) {
      var ends = edges.map(function (x) { return { x: x, a: x.from, b: x.to }; });
      chainOf(ends, open, 'b', 'a').on.forEach(function (o) { pinned.add(o.x); });
      chainOf(ends, open, 'a', 'b').on.forEach(function (o) { pinned.add(o.x); });
    }
    var lines = '<svg class="tl-links" data-connect="drop" aria-hidden="true">';
    edges.forEach(function (x) {
      lines += '<g class="tl-link' + (x.tone ? ' ' + x.tone : '') + (pinned.has(x) ? ' pin' : '') + '" data-a="' + esc(x.from) + '" data-b="' + esc(x.to) + '"><path class="cline"/></g>';
    });
    lines += '</svg>';

    var legend = '<div class="legend-line chart-legend" aria-hidden="true">' +
      '<span><span class="sw-k development"></span>Utveckling</span><span><span class="sw-k investigation"></span>Utredning</span>' +
      '<span><span class="sw-k proposal"></span>Förslag</span>' +
      (edges.length ? '<span><span class="sw-mark"></span>Beroende blir klart</span>' : '') +
      (tones.risk ? '<span><span class="sw-mark risk"></span>Med risk</span>' : '') +
      (tones.late ? '<span><span class="sw-mark late"></span>Klart för sent</span>' : '') +
      '<span><span class="sw-dot crit"></span>Flaskhals i teamet</span>' +
      (hasToday ? '<span><span class="sw-line today"></span>I dag</span>' : '') + '</div>';

    var key = 'tl-' + group + '-' + p.start;
    return legend +
      '<div class="tl' + (group === 'chain' ? '' : ' lines-on-hover') + '" data-chart="' + esc(key) + '" role="group" aria-label="' + esc('Tidslinje, ' + months[0].label + ' till ' + months[11].label) + '">' +
      '<div class="tl-head"><span></span>' + axis + '</div>' +
      '<div class="tl-body">' + grid + lines + body + '</div>' +
      (hasToday ? '<div class="tl-foot" aria-hidden="true"><span></span><div class="tl-foot-axis"><span class="tl-today-label" style="left:' + pct(today).toFixed(3) + '%">I dag</span></div></div>' : '') +
      '</div>' +
      '<p class="card-note">' + U.plural(visible.length, 'epik', 'epiker') + ' och ' + U.plural(edges.length, 'beroende', 'beroenden') +
      (tones.late || tones.risk ? ': ' + [tones.late ? tones.late + ' blir klara för sent' : '', tones.risk ? tones.risk + ' med risk' : ''].filter(Boolean).join(', ') : '') +
      '. Klicka på en epik för att se vad den väntar på och vad som väntar på den.</p>';
  }

  /* ---------- Kopplingar: initiativ, team och kompetensområde ---------- */

  /*
   * Tre listor som går att läsa var för sig: varifrån arbetet kommer, vilka team som gör det och
   * vilka kompetensområden det kräver. Teamen och områdena står med mest belagt först, så att
   * flaskhalsarna syns direkt. Väljer man en rad visar de andra listorna bara det som hänger ihop
   * med den, och staplarna visar valets del. Linjer ritas bara för valet, så att bilden förblir läsbar.
   */
  function links(ctx, sel) {
    var e = ctx.e;
    var p = ctx.period;
    var src = new Map();
    var teams = new Map();
    var flows = [];
    S.db.teams.forEach(function (t) {
      var cl = e.teamCategoryLoad(t.id, p);
      if (!cl.epics.length) return;
      var tc = e.teamCapacity(t.id, p);
      var areas = new Map(cl.rows.map(function (r) { return ['c:' + r.category, r]; }));
      var tight = cl.rows.filter(function (r) { return r.demand > 0.5 && (r.gap || r.loadPct > 100.5); });
      teams.set('t:' + t.id, { key: 't:' + t.id, name: t.name, go: 'teams:' + t.id, cap: tc.capacity, loaded: tc.loaded, pct: tc.loadPct, tight: tight, areas: areas });
      cl.epics.forEach(function (x) {
        var ep = x.epic;
        var init = ep.initiativeId ? e.get('initiatives', ep.initiativeId) : null;
        var sk = 's:' + (init ? init.id : ep.type === 'maintenance' ? '~maint' : '~none');
        if (!src.has(sk)) src.set(sk, { key: sk, name: init ? init.name : ep.type === 'maintenance' ? 'Förvaltning' : 'Utan initiativ', go: init ? 'initiatives:' + init.id : null, hours: 0, special: !init });
        src.get(sk).hours += x.load;
        Object.keys(x.categories).forEach(function (c) {
          flows.push({ s: sk, t: 't:' + t.id, c: 'c:' + c, h: x.categories[c] });
        });
      });
    });
    if (!teams.size) return '<div class="empty">Inget beslutat arbete i ' + esc(p.inText) + '.</div>';
    var cats = new Map();
    e.orgCategoryLoad(p).forEach(function (r) {
      if (r.demand <= 0.5) return;
      var gapTeams = (r.teams || []).filter(function (x) { return x.row.gap && x.row.demand > 0.5; }).length;
      cats.set('c:' + r.category, { key: 'c:' + r.category, name: r.category, supply: r.supply, demand: r.demand, pct: r.supply ? (r.demand / r.supply) * 100 : Infinity, gapTeams: gapTeams });
    });
    function sum(f) { return flows.filter(f).reduce(function (a, x) { return a + x.h; }, 0); }
    if (sel && !src.has(sel) && !teams.has(sel) && !cats.has(sel)) sel = null;
    var kind = sel ? sel.charAt(0) : '';
    var total = U.sum(Array.from(src.values()), function (x) { return x.hours; });

    var srcList = Array.from(src.values()).sort(function (a, b) { return a.special - b.special || b.hours - a.hours; });
    var teamList = Array.from(teams.values()).sort(function (a, b) { return b.pct - a.pct; });
    var catList = Array.from(cats.values()).sort(function (a, b) { return b.pct - a.pct; });
    var maxSrc = Math.max.apply(null, srcList.map(function (x) { return x.hours; }));

    function pctText(v) { return isFinite(v) ? U.fmtPct(v) : 'saknas'; }
    function freeText(r) { return r.free >= 0 ? U.fmtH(r.free) + ' ledigt' : U.fmtH(-r.free) + ' för mycket'; }
    function rowHtml(key, name, value, bar, opts) {
      var on = key === sel;
      var dim = sel && !on && opts.col === kind;
      return '<button type="button" class="lk-row' + (on ? ' sel' : '') + (dim ? ' dim' : '') + (opts.tone ? ' ' + opts.tone : '') + '" id="lk-' + esc(slug(key)) + '" data-node="' + esc(key) + '" data-id="' + esc(key) + '" ' +
        'data-action="links-select" data-key="' + esc(key) + '" aria-pressed="' + on + '" aria-label="' + esc(name + ', ' + opts.say) + '">' +
        '<span class="lk-name">' + esc(name) + (opts.flag ? '<span class="tl-flag"></span>' : '') + '</span>' +
        '<span class="lk-val' + (opts.tone ? ' ' + opts.tone : '') + '">' + value + '</span>' + bar + '</button>';
    }
    /* En filtrerad lista sorteras efter det den visar. Den valda listan står kvar i sin ordning. */
    function byShown(list, value) {
      return list.map(function (x) { return { x: x, v: value(x) }; }).sort(function (a, b) { return b.v - a.v; }).map(function (o) { return o.x; });
    }
    function areaLoad(r) { return r.gap ? Infinity : r.loadPct; }
    function areaRow(key, name, r) {
      var tone = r.gap || r.loadPct > 100.5 ? 'crit' : r.loadPct >= 90 ? 'warn' : '';
      var v = r.gap ? 'saknas i teamet' : esc(pctText(r.loadPct)) + '<span class="lk-of"> · ' + esc(freeText(r)) + '</span>';
      return rowHtml(key, name, v, loadBar(r.demand, 0, r.supply, key), {
        col: key.charAt(0), tone: tone, flag: tone === 'crit',
        say: r.gap ? 'saknas i teamet, ' + U.fmtH(r.demand) + ' arbete' : U.fmtPct(r.loadPct) + ' belagt, ' + freeText(r)
      });
    }

    /* Varifrån arbetet kommer */
    var colS = [];
    var srcOrder = !kind || kind === 's' ? srcList : byShown(srcList, function (x) {
      return kind === 't' ? sum(function (f) { return f.s === x.key && f.t === sel; }) : sum(function (f) { return f.s === x.key && f.c === sel; });
    });
    srcOrder.forEach(function (x) {
      var part = !kind || kind === 's' ? x.hours : kind === 't' ? sum(function (f) { return f.s === x.key && f.t === sel; }) : sum(function (f) { return f.s === x.key && f.c === sel; });
      var filtered = kind && kind !== 's';
      if (filtered && part <= 0.5) return;
      var value = esc(U.fmtH(part)) + (filtered ? '<span class="lk-of"> av ' + esc(U.fmtH(x.hours)) + '</span>' : '');
      colS.push(rowHtml(x.key, x.name, value, sizeBar(part, filtered ? x.hours - part : 0, maxSrc, x.key), {
        col: 's', say: U.fmtH(part) + (filtered ? ' av ' + U.fmtH(x.hours) : '')
      }));
    });

    /* Team */
    var colT = [];
    var teamOrder = kind === 'c' ? byShown(teamList, function (x) { var r = x.areas.get(sel); return r ? areaLoad(r) : -1; }) :
      kind === 's' ? byShown(teamList, function (x) { return sum(function (f) { return f.s === sel && f.t === x.key; }); }) : teamList;
    teamOrder.forEach(function (x) {
      if (kind === 'c') {
        /* Teamets läge i det valda området, också team som har ledig tid där. */
        var r = x.areas.get(sel);
        if (!r || (r.demand <= 0.5 && r.supply <= 0.5)) return;
        colT.push(areaRow(x.key, x.name, r));
        return;
      }
      var part = kind === 's' ? sum(function (f) { return f.s === sel && f.t === x.key; }) : x.loaded;
      if (kind === 's' && part <= 0.5) return;
      var tone = x.pct > 100.5 || x.tight.length ? 'crit' : x.pct >= 90 ? 'warn' : '';
      var val = kind === 's' ? esc(U.fmtH(part)) + '<span class="lk-of"> · ' + esc(U.fmtPct(x.pct)) + ' belagt</span>' : esc(U.fmtPct(x.pct)) + '<span class="lk-of"> · ' + esc(U.fmtH(x.loaded)) + '</span>';
      colT.push(rowHtml(x.key, x.name, val, loadBar(part, x.loaded - part, x.cap, x.key), {
        col: 't', tone: tone, flag: x.tight.length > 0,
        say: (kind === 's' ? U.fmtH(part) + ' från valet, ' : '') + U.fmtPct(x.pct) + ' belagt' + (x.tight.length ? ', flaskhals i ' + x.tight.map(function (r) { return r.category; }).join(' och ') : '')
      }));
    });

    /* Kompetensområden */
    var colC = [];
    if (kind === 't') {
      /* Teamets områden: arbete mot teamets kapacitet i området, också där det finns plats. */
      Array.from(teams.get(sel).areas.values()).filter(function (r) { return r.demand > 0.5 || r.supply > 0.5; })
        .sort(function (a, b) { return areaLoad(b) - areaLoad(a); })
        .forEach(function (r) { colC.push(areaRow('c:' + r.category, r.category, r)); });
    } else {
      (kind === 's' ? byShown(catList, function (x) { return sum(function (f) { return f.s === sel && f.c === x.key; }); }) : catList).forEach(function (x) {
        var part = kind === 's' ? sum(function (f) { return f.s === sel && f.c === x.key; }) : x.demand;
        if (kind === 's' && part <= 0.5) return;
        var tone = x.pct > 100.5 || x.gapTeams ? 'crit' : x.pct >= 90 ? 'warn' : '';
        var val = kind === 's' ? esc(U.fmtH(part)) + '<span class="lk-of"> · ' + esc(pctText(x.pct)) + ' belagt</span>' : esc(pctText(x.pct)) + '<span class="lk-of"> · ' + esc(U.fmtH(x.demand)) + ' av ' + esc(U.fmtH(x.supply)) + '</span>';
        colC.push(rowHtml(x.key, x.name, val, loadBar(part, x.demand - part, x.supply, x.key), {
          col: 'c', tone: tone, flag: tone === 'crit',
          say: (kind === 's' ? U.fmtH(part) + ' från valet, ' : '') + pctText(x.pct) + ' belagt i organisationen' + (x.gapTeams ? ', saknas i ' + U.plural(x.gapTeams, 'team', 'team') : '')
        }));
      });
    }

    /* Linjer för valet: tjocklek efter timmar, röd till ett område som är fullt i teamet. */
    var agg = new Map();
    flows.forEach(function (f) {
      if (!kind || (kind === 's' && f.s !== sel) || (kind === 't' && f.t !== sel) || (kind === 'c' && f.c !== sel)) return;
      agg.set(f.s + '>' + f.t, (agg.get(f.s + '>' + f.t) || 0) + f.h);
      agg.set(f.t + '>' + f.c, (agg.get(f.t + '>' + f.c) || 0) + f.h);
    });
    var lines = [];
    agg.forEach(function (h, k) {
      if (h <= 0.5) return;
      var ab = k.split('>');
      var r = ab[1].charAt(0) === 'c' && teams.get(ab[0]) ? teams.get(ab[0]).areas.get(ab[1]) : null;
      lines.push({ a: ab[0], b: ab[1], h: h, tight: !!r && (r.gap || r.loadPct > 100.5) });
    });
    var maxH = Math.max.apply(null, lines.map(function (l) { return l.h; }).concat([1]));
    var svg = '<svg class="lk-links" data-connect="flow" aria-hidden="true">' + lines.map(function (l) {
      return '<g class="lk-link' + (l.tight ? ' tight' : '') + '" data-a="' + esc(l.a) + '" data-b="' + esc(l.b) + '" data-c="' + (l.a.charAt(0) === 's' ? 0 : 1) + '">' +
        '<path class="cline" style="stroke-width:' + Math.max(1.5, (l.h / maxH) * 10).toFixed(1) + 'px"/></g>';
    }).join('') + '</svg>';

    function col(cls, title, sub, rows, hidden) {
      return '<div class="lk-col ' + cls + '"><div class="lk-head"><div class="lk-title">' + title + '</div><div class="lk-sub">' + esc(sub) + '</div></div>' +
        '<div class="lk-list">' + rows.join('') + (hidden > 0 ? '<div class="lk-more">' + esc(U.plural(hidden, 'rad', 'rader') + ' utan koppling till valet') + '</div>' : '') + '</div></div>';
    }
    var chosen = sel ? (src.get(sel) || teams.get(sel) || cats.get(sel)) : null;
    var head = chosen ? '<div class="lk-focus"><span>Det som hänger ihop med <strong>' + esc(chosen.name) + '</strong></span><span class="row">' +
      (chosen.go ? UI.btn(kind === 't' ? 'Öppna teamet' : 'Öppna initiativet', 'go', { cls: 'btn-sm', data: { to: chosen.go } }) : '') +
      UI.btn('Visa allt', 'links-clear', { cls: 'btn-sm' }) + '</span></div>' :
      '<div class="lk-focus idle"><span>Välj ett initiativ, ett team eller ett kompetensområde för att se vad det hänger ihop med.</span></div>';

    return head + '<div class="lk' + (kind ? ' focused' : '') + '" data-chart="' + esc('lk-' + p.start + '-' + (sel || 'all')) + '">' + svg +
      col('s', 'Varifrån arbetet kommer', kind && kind !== 's' ? 'Timmar som hör till valet, flest först' : 'Störst först', colS, kind && kind !== 's' ? srcList.length - colS.length : 0) +
      '<div class="lk-gutter" aria-hidden="true"></div>' +
      col('t', 'Team', kind === 'c' ? 'Läget i ' + chosen.name + ', mest belagt först' : kind === 's' ? 'Timmar som hör till valet, flest först' : 'Mest belagt först', colT, kind === 's' || kind === 'c' ? teamList.length - colT.length : 0) +
      '<div class="lk-gutter" aria-hidden="true"></div>' +
      col('c', 'Kompetensområde', kind === 't' ? 'Läget i teamet, mest belagt först' : kind === 's' ? 'Timmar som hör till valet, flest först' : 'Hela organisationen, mest belagt först', colC, kind === 's' ? catList.length - colC.length : 0) +
      '</div>' +
      '<p class="card-note">' + U.fmtH(total) + ' beslutat arbete i ' + esc(p.inText) + '. Stapeln för team och kompetensområden är 0–120 % av kapaciteten, och strecket är 100 %. Mörk del hör till valet, ljusblå är annat arbete, ljus del ledigt och randig röd det som går över.</p>';
  }

  /* ---------- Beroendekedja för en epik ---------- */

  /*
   * Det epiken väntar på till vänster, epiken i mitten och det som väntar på den till höger.
   * Pilarna ritas efter layouten i js/layout.js (connect), från rutornas faktiska läge.
   * I en smal ruta staplas kolumnerna och pilarna pekar nedåt.
   */
  function chain(ep, deps, waiting, ctx) {
    var e = ctx.e;
    function tone(risks) {
      var t = toneOf(risks);
      return t ? ' ' + t : '';
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

  /* ---------- Period för period ---------- */

  /*
   * En stapel per period i tabellen, i appens standard: 0–120 % av teamets kapacitet i perioden.
   * Mörk del är epiken, ljusblå annat arbete i teamet och randig röd del det som går över.
   * Ett förslag ritas streckat, som det skulle bli.
   */
  function periodBar(mine, other, cap, max, proposal, key, label) {
    return '<span class="pbar" role="img" aria-label="' + esc(label) + '">' + loadBar(mine, other, cap, key, { proposal: proposal }) + '</span>';
  }

  function periodLegend(proposal) {
    return '<div class="legend-line chart-legend" aria-hidden="true"><span><span class="' + (proposal ? 'sw-k proposal' : 'sw loaded') + '"></span>Epiken' + (proposal ? ' om den beslutas' : '') + '</span>' +
      '<span><span class="sw other"></span>Annat arbete i teamet</span><span><span class="sw free"></span>Ledigt</span><span><span class="sw over"></span>Över kapaciteten</span>' +
      '<span><span class="sw-cap"></span>Teamets kapacitet</span></div>';
  }

  OOS.epicViz = { timeline: timeline, links: links, chain: chain, periodBar: periodBar, periodLegend: periodLegend };

  /* ---------- Pekare och fokus ---------- */

  /*
   * I tidslinjen lyser epikens hela kedja upp när man pekar på den eller ger den fokus: allt den
   * väntar på, bakåt i flera led, och allt som väntar på den, framåt. Resten tonas ned.
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
    var box = target && target.closest ? target.closest('.tl') : null;
    document.querySelectorAll('.tl.hot').forEach(function (g) {
      if (g === box) return;
      g.classList.remove('hot');
      g.querySelectorAll('.on').forEach(function (x) { x.classList.remove('on'); });
    });
    if (!box) return;
    var rowEl = target.closest('.tl-row');
    box.querySelectorAll('.on').forEach(function (x) { x.classList.remove('on'); });
    if (!rowEl) { box.classList.remove('hot'); return; }
    var id = rowEl.getAttribute('data-epic');
    var edges = Array.prototype.map.call(box.querySelectorAll('.tl-link'), function (g) {
      return { el: g, a: g.getAttribute('data-a'), b: g.getAttribute('data-b') };
    });
    var up = chainOf(edges, id, 'b', 'a');
    var down = chainOf(edges, id, 'a', 'b');
    if (up.on.size + down.on.size === 0) { box.classList.remove('hot'); return; }
    var ids = new Set(Array.from(up.ids).concat(Array.from(down.ids)));
    up.on.forEach(function (ed) { ed.el.classList.add('on'); });
    down.on.forEach(function (ed) { ed.el.classList.add('on'); });
    box.querySelectorAll('.tl-row').forEach(function (r) { if (ids.has(r.getAttribute('data-epic'))) r.classList.add('on'); });
    box.classList.add('hot');
  }

  /* Bara när pekaren faktiskt rör sig: en rullning som fokus orsakar ska inte släppa kedjan. */
  var at = { x: -1, y: -1, el: null };
  document.addEventListener('mousemove', function (ev) {
    if (ev.clientX === at.x && ev.clientY === at.y) return;
    at.x = ev.clientX;
    at.y = ev.clientY;
    var el = ev.target.closest ? ev.target.closest('.tl-row, .tl') : null;
    if (el === at.el) return;
    at.el = el;
    hot(ev.target);
  });
  document.addEventListener('focusin', function (ev) { at.el = null; hot(ev.target); });

  /* ---------- Handlingar ---------- */

  /* En rad i tidslinjen fälls ut under sig själv. Fokus stannar på raden. */
  OOS.actions['tl-open'] = function (el) {
    var id = el.getAttribute('data-id');
    OOS.state.tlOpen = OOS.state.tlOpen === id ? null : id;
    OOS.motion('quiet');
    OOS.refresh();
    var panel = OOS.state.tlOpen ? document.getElementById('tl-panel-' + slug(id)) : null;
    if (panel) OOSMotion.reveal(panel);
    var btn = document.getElementById('tl-' + slug(id));
    if (btn) btn.focus({ preventScroll: true });
  };

  /* Epikerna utan beroenden fälls ut under kedjorna och tonas fram. */
  OOS.actions['tl-loose'] = function () {
    OOS.state.tlLoose = !OOS.state.tlLoose;
    OOS.motion('quiet');
    OOS.refresh();
    var btn = document.querySelector('[data-action="tl-loose"]');
    if (btn) btn.focus({ preventScroll: true });
    if (!OOS.state.tlLoose || !btn) return;
    var rows = [];
    var el = btn.closest('.tl-group').nextElementSibling;
    while (el && el.classList.contains('tl-row')) { rows.push(el); el = el.nextElementSibling; }
    OOSMotion.reveal(rows);
  };

  /* Ett val i kopplingarna: listorna filtreras, staplarna glider till valets del och linjerna ritas ut. */
  OOS.actions['links-select'] = function (el) {
    var key = el.getAttribute('data-key');
    OOS.state.linkSel = OOS.state.linkSel === key ? null : key;
    OOS.motion('update');
    OOS.refresh();
    var again = document.getElementById('lk-' + slug(key));
    if (again) again.focus({ preventScroll: true });
  };

  OOS.actions['links-clear'] = function () {
    var was = OOS.state.linkSel;
    OOS.state.linkSel = null;
    OOS.motion('update');
    OOS.refresh();
    var again = was && document.getElementById('lk-' + slug(was));
    if (again) again.focus({ preventScroll: true });
  };
})();
