/*
 * Arbete: initiativ och epiker.
 *
 * Ett initiativ är en beslutad satsning som en leveransdomän äger. Det bryts ned i epiker, och
 * varje epik ägs av ett team. Epiker kan också vara förvaltning, utbildning eller utredning utan
 * initiativ. Epikernas timmar är teamens efterfrågan: de belastar kapaciteten, så att beläggningen
 * räknas fram ur verkligt arbete i stället för att skrivas in för hand.
 *
 * Timmarna är beslutade ramar, inte estimat (omvänd estimering, problem 17). Konsekvensen av en
 * ram syns direkt: i formuläret, på epiken, på teamet och i initiativet.
 */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;
  var E = OOSEngine;

  var TYPE_ORDER = ['development', 'maintenance', 'investigation'];

  function monthSpan(ep) {
    return U.fmtDate(ep.from) + ' – ' + U.fmtDate(ep.to);
  }

  function loadTone(pct) {
    return pct > 100.5 ? 'crit' : pct >= 90 ? 'warn' : null;
  }

  /* Perioder från och med den aktuella som överlappar ett datumintervall, högst max stycken. */
  function periodsIn(from, to, max) {
    var out = [];
    var p = OOS.period();
    /* Börja vid intervallets start om det ligger före den aktuella perioden. */
    var guard = 0;
    while (p.start > from && p.end >= from && guard++ < 36) {
      var prev = E.prevPeriod(p);
      if (prev.end < from) break;
      p = prev;
    }
    for (var i = 0; i < 36 && out.length < max; i++) {
      if (p.start > to) break;
      if (p.end >= from) out.push(p);
      p = E.nextPeriod(p);
    }
    return out;
  }

  /* Var tiden går: beslutat arbete per typ mot en kapacitet, med förklaring per typ. */
  function workSplit(byType, capacity, capLabel, rowsHtml) {
    var parts = TYPE_ORDER.filter(function (t) { return byType[t] > 0; }).map(function (t) {
      return { label: C.EPIC_TYPE[t], hours: byType[t], kind: t };
    });
    var decided = U.sum(parts, function (p) { return p.hours; });
    var h = UI.budget(parts, capacity, { capLabel: capLabel || 'Kapacitet' });
    h += '<div class="commit-list">';
    /* Egna rader (till exempel teamets epiker) ersätter sammanställningen per typ. */
    if (rowsHtml !== undefined) h += rowsHtml;
    else parts.forEach(function (p) {
      h += '<div class="commit">' + C.typeSwatch(p.kind) + '<div>' + esc(p.label) +
        (capacity ? '<div class="commit-sub">' + U.fmtPct((p.hours / capacity) * 100) + ' av kapaciteten</div>' : '') + '</div>' +
        '<span class="commit-hours">' + U.fmtH(p.hours) + '</span><span></span></div>';
    });
    if (decided > capacity) {
      h += '<div class="commit total crit"><span></span><span class="commit-label">Mer än kapaciteten</span><span class="commit-hours">' + U.fmtH(decided - capacity) + '</span><span></span></div>';
    } else {
      h += '<div class="commit total"><span class="sw-k free" aria-hidden="true"></span><span class="commit-label">Ledigt</span><span class="commit-hours">' + U.fmtH(capacity - decided) + '</span><span></span></div>';
    }
    return h + '</div>';
  }

  /* ---------- Epiker ---------- */

  function timelineCard(ctx) {
    var group = OOS.segVal('tl-group', 'chain');
    return '<section class="card"><div class="card-head"><div><div class="card-title">Tidslinje</div>' +
      '<div class="card-sub">Utveckling och utredning, två månader bakåt och nio framåt. Ett beroende är en romb på epikens rad, där det den väntar på blir klart.</div></div>' +
      UI.seg('tl-group', [{ key: 'chain', label: 'Kedjor' }, { key: 'team', label: 'Team' }, { key: 'initiative', label: 'Initiativ' }], group) + '</div>' +
      OOS.epicViz.timeline(ctx, { group: group, open: OOS.state.tlOpen, loose: OOS.state.tlLoose }) + '</section>';
  }

  function linksCard(ctx) {
    return '<section class="card" id="links-section"><div class="card-head"><div><div class="card-title">Kopplingar i ' + esc(ctx.period.inText) + '</div>' +
      '<div class="card-sub">Varifrån arbetet kommer, vilka team som gör det och vilken kompetens det kräver.</div></div></div>' +
      OOS.epicViz.links(ctx, OOS.state.linkSel) + '</section>';
  }

  function epicList(ctx) {
    var e = ctx.e;
    var p = ctx.period;
    var filter = OOS.segVal('epic-type', 'all');
    var all = S.db.epics.map(function (ep) {
      return {
        id: ep.id,
        ep: ep,
        team: e.get('teams', ep.teamId),
        init: ep.initiativeId ? e.get('initiatives', ep.initiativeId) : null,
        hours: E.epicHoursInPeriod(ep, p),
        frame: E.epicFrame(ep)
      };
    });
    var rows = all.filter(function (r) { return filter === 'all' || r.ep.type === filter; });
    var teamCap = U.sum(S.db.teams, function (t) { return e.teamCapacity(t.id, p).capacity; });
    var byType = e.workByType(p);
    var decided = U.sum(Object.keys(byType), function (k) { return byType[k]; });
    var proposals = all.filter(function (r) { return r.ep.status === 'proposed'; });
    var untraced = all.filter(function (r) { return r.ep.type === 'development' && !r.ep.initiativeId && e.counts(r.ep) && r.hours > 0; });

    var h = UI.pageHead({
      title: 'Epiker',
      sub: 'Epiker är teamens arbete: utveckling, förvaltning och utredning. Varje team har en förvaltningsepik för drift, utbildning och kompetensspridning. Ett förslag är teamets estimat. När epiken beslutas blir estimatet dess ram och belastar teamet.',
      actions: UI.btn('Lägg till epik', 'epic-add', { cls: 'btn-primary' })
    });
    /* Tre sätt att se samma arbete: som lista, över tid med beroenden, och som flöde till kompetens. */
    var view = OOS.tab('epics-view', 'list');
    h += UI.tabs('epics-view', [{ key: 'list', label: 'Lista' }, { key: 'timeline', label: 'Tidslinje' }, { key: 'flow', label: 'Kopplingar' }], view);
    h += UI.facts([
      { label: 'Beslutat arbete i ' + p.inText, value: U.fmtH(decided), note: U.fmtPct(teamCap ? (decided / teamCap) * 100 : 0) + ' av teamens kapacitet' },
      { label: 'Utveckling', value: U.fmtPct(decided ? ((byType.development || 0) / decided) * 100 : 0), note: U.fmtH(byType.development || 0) + ' av arbetet' },
      { label: 'Förvaltning', value: U.fmtPct(decided ? ((byType.maintenance || 0) / decided) * 100 : 0), note: U.fmtH(byType.maintenance || 0) + ' av arbetet' },
      { label: 'Förslag', value: proposals.length, note: proposals.length ? 'Väntar på beslut, belastar inte' : 'Inga förslag just nu' }
    ]);
    if (untraced.length) {
      h += '<div class="note warn"><strong>' + U.plural(untraced.length, 'utvecklingsepik', 'utvecklingsepiker') + ' saknar initiativ.</strong> ' +
        'Utveckling bör gå att spåra till en beslutad satsning, annars syns inte varför tiden används: ' +
        untraced.map(function (r) { return C.epicRef(r.ep); }).join(', ') + '.</div>';
    }

    if (view === 'timeline') return h + timelineCard(ctx);
    if (view === 'flow') return h + linksCard(ctx);

    h += '<section class="card"><div class="card-head"><div><div class="card-title">Var tiden går i ' + esc(p.inText) + '</div>' +
      '<div class="card-sub">Beslutat arbete per typ mot alla teams kapacitet. Domänmoln och nyckelroller ingår inte.</div></div></div>';
    h += workSplit(byType, teamCap, 'Teamens kapacitet') + '</section>';

    var segs = [{ key: 'all', label: 'Alla' }].concat(TYPE_ORDER.map(function (t) { return { key: t, label: C.EPIC_TYPE[t] }; }));
    h += '<section class="card">' + UI.table({
      id: 'tbl-epics',
      title: 'Alla epiker',
      tools: UI.seg('epic-type', segs, filter),
      rows: rows,
      search: {
        placeholder: 'Sök epik, team, initiativ …',
        text: function (r) { return [r.ep.description, C.EPIC_TYPE[r.ep.type], C.EPIC_STATUS[r.ep.status], r.init ? r.init.name : 'utan initiativ'].join(' '); }
      },
      rowGo: function (r) { return 'epics:' + r.id; },
      defaultSort: 'hours',
      defaultDir: -1,
      noun: 'epiker',
      rowClass: function (r) { return r.ep.status === 'done' ? 'is-past' : ''; },
      columns: [
        {
          key: 'name', label: 'Epik', sort: function (r) { return r.ep.name; },
          render: function (r) { return '<span class="name-cell wrap">' + C.typeSwatch(r.ep.type) + '<span><span class="name">' + esc(r.ep.name) + '</span><br><span class="sub">' + esc(C.EPIC_TYPE[r.ep.type] || '') + '</span>' + (r.ep.status === 'proposed' || r.ep.status === 'done' ? ' ' + C.epicStatus(r.ep.status) : '') + '</span></span>'; }
        },
        { key: 'team', label: 'Team', sort: function (r) { return r.team ? r.team.name : 'ö'; }, render: function (r) { return r.team ? esc(r.team.name) : '<span class="muted">–</span>'; } },
        { key: 'init', label: 'Initiativ', opt: 1, sort: function (r) { return r.init ? r.init.name : 'ö'; }, render: function (r) { return r.init ? esc(r.init.name) : '<span class="muted">–</span>'; } },
        { key: 'span', label: 'Gäller', opt: 2, sort: function (r) { return r.ep.from; }, render: function (r) { return '<span class="nowrap">' + U.fmtDate(r.ep.from) + ' –</span> <span class="nowrap">' + U.fmtDate(r.ep.to) + '</span>'; } },
        { key: 'frame', label: 'Timmar', cls: 'num', opt: 2, sort: function (r) { return r.frame; }, render: function (r) { return C.epicFrameText(r.ep); } },
        {
          key: 'hours', label: 'I perioden', cls: 'num', sort: function (r) { return r.hours; },
          render: function (r) { return r.hours ? (e.counts(r.ep) ? U.fmtH(r.hours) : '<span class="muted">(' + U.fmtH(r.hours) + ')</span>') : '<span class="muted">–</span>'; }
        }
      ]
    }) + '</section>';
    return h;
  }

  /*
   * Vem gör jobbet: epikens timmar per kompetensområde, teamets läge i varje område och personerna
   * som har kompetensen. Här syns flaskhalsen, till exempel att utvecklarna har tid men inte testarna.
   */
  function whoDoesTheWork(ep, team, tc, mine, hrs, ctx) {
    var e = ctx.e;
    var p = ctx.period;
    var h = '<section class="card"><div class="card-head"><div><div class="card-title">Vem gör jobbet</div>' +
      '<div class="card-sub">Epikens timmar i ' + esc(p.inText) + ' per kompetensområde, och hur mycket ' + (team ? esc(team.name) : 'teamet') + ' har kvar i varje område.</div></div>' +
      UI.btn('Ändra behov', 'epic-edit', { cls: 'btn-sm', data: { id: ep.id } }) + '</div>';
    if (!team || !tc) return h + '<div class="empty">Epiken saknar team.</div></section>';
    var needs = E.normNeeds(ep.needs);
    var cl = e.teamCategoryLoad(team.id, p);
    var byCat = {};
    cl.rows.forEach(function (r) { byCat[r.category] = r; });
    var base = mine && mine.counts ? mine.load : hrs;
    if (!needs) {
      h += '<div class="note">Kompetensbehovet är inte angivet. Timmarna fördelas som teamets sammansättning, och då syns inga flaskhalsar för just den här epiken.</div>';
      needs = cl.rows.filter(function (r) { return r.supply > 0.5; }).map(function (r) { return { category: r.category, share: r.supply / (tc.capacity || 1), derived: true }; });
    }
    needs.slice().sort(function (a, b) { return b.share - a.share; }).forEach(function (n) {
      var r = byCat[n.category] || { supply: 0, demand: 0, free: 0, loadPct: 0, gap: true, people: [] };
      var tight = r.gap || r.loadPct > 100.5;
      var state = r.gap ? UI.badge('Saknas i teamet', 'crit') : r.loadPct > 100.5 ? UI.badge('Flaskhals', 'crit') : r.loadPct >= 90 ? UI.badge('Nästan fullt', 'warn') : '';
      h += '<div class="need-block' + (tight ? ' is-tight' : '') + '"><div class="need-block-head"><span class="need-block-name"><strong>' + esc(n.category) + '</strong> ' + state + '</span>' +
        '<span class="muted small">' + (n.derived ? '' : U.fmtPct(n.share * 100) + ' av epiken · ') + U.fmtH(base * n.share) + ' i ' + esc(p.inText) + '</span></div>';
      if (r.gap) {
        h += '<p class="small">Ingen i teamet har ' + esc(n.category) + ' som primär kompetens. ' + freeIn(n.category, team.id, e, p) + '</p>';
      } else {
        h += '<div class="need-block-bar">' + C.capBar({ capacity: r.supply, loaded: r.demand }) +
          '<span class="small' + (r.free < -0.5 ? ' crit-text' : ' muted') + '">' + (r.free < -0.5 ? U.fmtH(-r.free) + ' för mycket' : U.fmtH(r.free) + ' ledigt') + ' av ' + U.fmtH(r.supply) + '</span></div>';
        if (r.free < -0.5) h += '<p class="small muted">' + freeIn(n.category, team.id, e, p) + '</p>';
        h += '<div class="need-people">';
        r.people.forEach(function (x) {
          var m = tc.members.filter(function (mm) { return mm.worker.id === x.worker.id; })[0];
          var pct = m ? m.loadPct : 0;
          h += '<div class="need-person">' + C.workerRef(x.worker, x.tw.role || x.worker.title) +
            '<span class="small"><span class="' + (pct > 100.5 ? 'crit-text' : pct >= 90 ? 'warn-text' : 'muted') + '">' + U.fmtPct(pct) + ' belagd</span></span></div>';
        });
        h += '</div>';
      }
      h += '</div>';
    });
    return h + '</section>';
  }

  /* Ledig tid i samma område i andra team, som text. */
  /*
   * Var kompetensen finns: först personer med kompetensen och tid som inte är fördelad, eftersom
   * det är det närmaste sättet att lösa en flaskhals, sedan ledig tid i andra team.
   */
  function freeParts(category, exceptTeamId, e, p) {
    var people = e.unallocatedIn(category, p).slice(0, 3);
    var spots = [];
    S.db.teams.forEach(function (t) {
      if (t.id === exceptTeamId) return;
      e.teamCategoryLoad(t.id, p).rows.forEach(function (r) {
        if (r.category === category && !r.gap && r.free > 20) spots.push({ team: t, free: r.free });
      });
    });
    spots.sort(function (a, b) { return b.free - a.free; });
    return {
      people: people.length ? people.map(function (x) { return C.link('workers:' + x.worker.id, x.worker.name) + ' ' + U.fmtH(x.hours); }).join(', ') : '',
      teams: spots.length ? spots.slice(0, 3).map(function (x) { return C.link('teams:' + x.team.id, x.team.name) + ' ' + U.fmtH(x.free); }).join(', ') : ''
    };
  }

  /* Som löptext, till exempel under ett kompetensbehov på epiken. */
  function freeIn(category, exceptTeamId, e, p) {
    var f = freeParts(category, exceptTeamId, e, p);
    return (f.people ? 'Inte fördelad tid med ' + esc(category) + ': ' + f.people + '. ' : '') +
      (f.teams ? 'Ledigt i andra team: ' + f.teams + '.' : 'Inget annat team har ledig tid inom ' + esc(category) + ' i ' + esc(p.inText) + '.');
  }

  /* Som lista med etiketter, för det som behöver lösas: lättare att läsa än ett stycke. */
  function freeList(category, exceptTeamId, e, p, drivers) {
    var f = freeParts(category, exceptTeamId, e, p);
    var rows = [];
    if (drivers) rows.push(['Arbete som behöver ' + category, drivers]);
    rows.push(['Inte fördelad tid', f.people || '<span class="muted">Ingen med ' + esc(category) + '</span>']);
    rows.push(['Ledigt i andra team', f.teams || '<span class="muted">Inget annat team har ledig tid</span>']);
    return '<dl class="spot-list">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>';
  }

  /* Beroenden åt båda hållen, med de risker som gör att arbetet kan bli försenat. */
  function dependencyCard(ep, ctx) {
    var e = ctx.e;
    var deps = e.epicDependencies(ep.id, ctx.period);
    var waiting = e.epicDependents(ep.id, ctx.period);
    var h = '<section class="card"><div class="card-head"><div><div class="card-title">Beroenden</div>' +
      '<div class="card-sub">Arbete som måste bli klart först, och arbete som väntar på den här epiken.</div></div></div>';
    /* Kedjan bär allt: status, slutdatum och risk står i rutorna, så ingen lista upprepar dem. */
    if (deps.length || waiting.length) return h + OOS.epicViz.chain(ep, deps, waiting, ctx) + '</section>';
    return h + '<p class="muted small">Epiken väntar inte på annat arbete, och inget annat arbete väntar på den.</p></section>';
  }

  function epicDetail(ep, ctx) {
    var e = ctx.e;
    var p = ctx.period;
    var team = e.get('teams', ep.teamId);
    var init = ep.initiativeId ? e.get('initiatives', ep.initiativeId) : null;
    var dd = team ? e.teamDeliveryDomain(team.id) : null;
    var hrs = E.epicHoursInPeriod(ep, p);
    var frame = E.epicFrame(ep);
    var tc = team ? e.teamCapacity(team.id, p) : null;
    var counts = e.counts(ep);

    var h = UI.pageHead({
      crumbs: C.link('epics', 'Epiker') + '<span>›</span><span>' + esc(ep.name) + '</span>',
      title: esc(ep.name) + (ep.status === 'proposed' || ep.status === 'done' ? ' ' + C.epicStatus(ep.status) : ''),
      meta: [esc(C.EPIC_TYPE[ep.type] || ''), team ? esc(team.name) : '', init ? esc(init.name) : ''],
      sub: esc(ep.description || ''),
      actions: (ep.status === 'proposed' ? UI.btn('Besluta', 'epic-decide', { cls: 'btn-primary', data: { id: ep.id } }) : '') +
        UI.btn('Redigera', 'epic-edit', { data: { id: ep.id } }) + UI.btn('Ta bort', 'epic-delete', { cls: 'btn-danger', data: { id: ep.id } })
    });

    if (E.epicCounts(ep.status) && !counts && init && init.status === 'proposed') {
      h += '<div class="note warn"><strong>Initiativet är inte beslutat.</strong> Epiken belastar inte ' + (team ? esc(team.name) : 'teamet') + ' förrän ' + C.initiativeRef(init) + ' beslutas av leveransdomänen.</div>';
    } else if (ep.status === 'proposed') {
      var imp = C.epicImpact(ep, ep);
      var worst = imp && imp.rows.length ? imp.rows.reduce(function (m, r) { return r.after > m.after ? r : m; }, imp.rows[0]) : null;
      h += '<div class="note' + (worst && worst.after > 100.5 ? ' crit' : '') + '"><strong>Förslag som väntar på beslut.</strong> Epiken belastar inte teamet ännu.' +
        (worst ? ' Om den beslutas får ' + esc(team.name) + ' ' + U.fmtPct(worst.after) + ' beläggning i ' + esc(worst.period.inText) + (worst.after > 100.5 ? ', mer än teamet har.' : '.') : '') + '</div>';
    } else if (tc && tc.loadPct > 100.5 && counts && hrs > 0) {
      h += '<div class="note crit"><strong>' + esc(team.name) + ' är överplanerat i ' + esc(p.inText) + '.</strong> Beslutat arbete kräver ' + U.fmtH(tc.loaded - tc.capacity) + ' mer än teamets kapacitet.</div>';
    }
    /* Flaskhals: ett område som epiken behöver är fullt, även om teamet totalt har plats. */
    if (team && counts && hrs > 0 && ep.status !== 'done') {
      var nn = E.normNeeds(ep.needs) || [];
      var tightRows = e.teamCategoryLoad(team.id, p).rows.filter(function (r) {
        return (r.gap || r.loadPct > 100.5) && nn.some(function (n) { return n.category === r.category; });
      });
      if (tightRows.length) {
        h += '<div class="note crit"><strong>' + tightRows.map(function (r) { return esc(r.category); }).join(' och ') + (tightRows.length > 1 ? ' är flaskhalsar' : ' är en flaskhals') + ' för epiken i ' + esc(p.inText) + '.</strong> ' +
          tightRows.map(function (r) { return r.gap ? esc(team.name) + ' saknar ' + esc(r.category) + ' (' + U.fmtH(r.demand) + ' behövs)' : esc(r.category) + ' är belagt till ' + U.fmtPct(r.loadPct) + ' (' + U.fmtH(-r.free) + ' för mycket)'; }).join('. ') +
          (tc && tc.loadPct <= 100.5 ? ', trots att teamet totalt har ' + U.fmtPct(tc.loadPct) + ' beläggning.' : '.') + '</div>';
      }
    }
    if (ep.type === 'development' && !init && counts) {
      h += '<div class="note warn"><strong>Utvecklingsarbete utan initiativ.</strong> Koppla epiken till den satsning den hör till, så att det går att se varför tiden används.</div>';
    }

    var months = Math.max(1, periodsIn(ep.from, ep.to, 60).length);
    var mine = team ? e.teamDemand(team.id, p).epics.filter(function (x) { return x.epic.id === ep.id; })[0] : null;
    h += UI.facts([
      { label: 'I ' + p.inText, value: U.fmtH(hrs), note: tc && tc.capacity ? U.fmtPct((hrs / tc.capacity) * 100) + ' av teamets kapacitet' + (counts ? '' : ', räknas inte') : '' },
      { label: ep.status === 'proposed' ? 'Estimat' : 'Ram', value: ep.effort === 'monthly' ? U.fmtNum(ep.hours) + ' h/mån' : U.fmtH(ep.hours), note: (ep.effort === 'monthly' ? U.fmtH(frame) + ' under hela tiden' : 'Fördelas jämnt över tiden') + (ep.status === 'proposed' ? ', teamets estimat' : '') },
      { label: 'Tid', value: U.plural(months, 'period', 'perioder'), note: monthSpan(ep) },
      tc ? { label: 'Teamets beläggning', value: U.fmtPct(tc.loadPct), note: 'I ' + p.inText + ', allt beslutat arbete', tone: loadTone(tc.loadPct) } : null
    ]);

    var main = whoDoesTheWork(ep, team, tc, mine, hrs, ctx) + dependencyCard(ep, ctx);

    /* Period för period: epikens timmar och teamets beläggning. */
    main += '<section class="card"><div class="card-head"><div><div class="card-title">Period för period</div>' +
      '<div class="card-sub">Epikens timmar och vad de betyder för ' + (team ? esc(team.name) : 'teamet') + '.</div></div></div>';
    var periods = periodsIn(ep.from, ep.to, 12);
    if (!periods.length || !team) {
      main += '<div class="empty">Epiken ligger utanför de närmaste perioderna.</div>';
    } else {
      /* Ett förslag visar också vad beläggningen blir om det beslutas. */
      var imp = counts ? null : C.epicImpact(ep, ep);
      var after = {};
      if (imp) imp.rows.forEach(function (r) { after[r.period.start] = r.after; });
      /*
       * En rad per period med appens standardstapel mot teamets kapacitet: mörk del epiken och
       * ljusblå del annat arbete. Ett förslag ritas streckat, som beläggningen skulle bli.
       */
      var rowsP = periods.map(function (pp) {
        var t = e.teamCapacity(team.id, pp);
        var mine = E.epicHoursInPeriod(ep, pp);
        var other = Math.max(0, t.loaded - (counts ? mine : 0));
        return { pp: pp, t: t, mine: mine, other: other, after: after[pp.start] };
      });
      main += OOS.epicViz.periodLegend(!counts);
      main += '<div class="table-wrap"><table class="tbl period-tbl"><thead><tr><th>Period</th><th class="pbar-col">Teamets arbete mot kapaciteten</th><th class="num">' + (counts ? 'Beläggning' : 'Om beslutad') + '</th>' +
        '<th class="num" data-opt="1">Epiken</th><th class="num" data-opt="2">Annat arbete</th><th class="num" data-opt="2">Kapacitet</th></tr></thead><tbody>';
      rowsP.forEach(function (r) {
        var pctNow = r.t.capacity ? ((r.mine + r.other) / r.t.capacity) * 100 : 0;
        var shown = counts ? r.t.loadPct : (r.after !== undefined ? r.after : pctNow);
        var tone = shown > 100.5 ? ' class="crit-text"' : '';
        var say = r.pp.label + ': epiken ' + U.fmtH(r.mine) + ', annat arbete ' + U.fmtH(r.other) + ', kapacitet ' + U.fmtH(r.t.capacity) + ', ' + U.fmtPct(shown) + (counts ? ' belagt' : ' belagt om den beslutas');
        main += '<tr' + (r.pp.start === p.start ? ' class="selected"' : '') + ' data-id="' + esc('pp-' + r.pp.start) + '"><td>' + esc(r.pp.label) + '</td>' +
          '<td class="pbar-col">' + OOS.epicViz.periodBar(r.mine, r.other, r.t.capacity, null, !counts, 'pp-' + r.pp.start, say) + '</td>' +
          '<td class="num"><strong' + tone + '>' + U.fmtPct(shown) + '</strong></td>' +
          '<td class="num">' + (counts ? U.fmtH(r.mine) : '<span class="muted">(' + U.fmtH(r.mine) + ')</span>') + '</td>' +
          '<td class="num">' + U.fmtH(r.other) + '</td><td class="num">' + U.fmtH(r.t.capacity) + '</td></tr>';
      });
      main += '</tbody></table></div>';
      if (!counts) main += '<p class="muted small">Epiken är inte beslutad. Dess timmar står inom parentes och är streckade i stapeln. Om beslutad visar teamets beläggning med epiken.</p>';
    }
    main += '</section>';

    var aside = UI.asideBlock('Uppgifter', UI.props([
      ['Team', C.teamRef(team)],
      ['Initiativ', init ? C.initiativeRef(init) : (ep.type === 'development' ? UI.badge('Saknas', 'warn') : '')],
      ['Leveransdomän', C.ddRef(dd)],
      ['Arbetstyp', esc(C.EPIC_TYPE[ep.type] || '')],
      ['Status', C.epicStatus(ep.status)],
      [ep.status === 'proposed' ? 'Estimat' : 'Ram', C.epicFrameText(ep)],
      ['Gäller', monthSpan(ep)]
    ]));
    if (team) {
      var others = e.teamDemand(team.id, p).epics.filter(function (x) { return x.epic.id !== ep.id; });
      var ol = '<div class="aside-list">';
      others.forEach(function (x) {
        ol += '<div class="list-item"><div class="grow">' + C.epicRef(x.epic) + '<div class="muted small">' + esc(C.EPIC_TYPE[x.epic.type] || '') + (x.counts ? '' : ' · ' + esc(C.EPIC_STATUS[x.epic.status])) + '</div></div><span class="num">' + U.fmtH(x.hours) + '</span></div>';
      });
      if (!others.length) ol += '<span class="muted small">Inget annat arbete i perioden.</span>';
      aside += UI.asideBlock('Annat arbete i teamet, ' + p.inText, ol + '</div>');
    }
    h += UI.detailLayout(main, aside);
    return h;
  }

  OOS.views.epics = function (ctx) {
    var ep = ctx.id ? ctx.e.get('epics', ctx.id) : null;
    return ep ? epicDetail(ep, ctx) : epicList(ctx);
  };

  /* ---------- Flaskhalsar ---------- */

  /*
   * Helhetsbilden: var arbetet tar slut på kompetens, var det finns ledig tid och vilka beroenden som
   * riskerar att försena annat arbete. Räknas ur epikernas kompetensbehov och teamens kapacitet.
   */
  OOS.views.bottlenecks = function (ctx) {
    var e = ctx.e;
    var p = ctx.period;
    var spots = [];
    S.db.teams.forEach(function (t) {
      e.teamCategoryLoad(t.id, p).rows.forEach(function (r) {
        if (r.gap || r.loadPct > 100.5) spots.push({ team: t, row: r, over: r.gap ? r.demand : -r.free });
      });
    });
    spots.sort(function (a, b) { return b.over - a.over; });
    var gaps = spots.filter(function (x) { return x.row.gap; });
    var risks = [];
    S.db.epics.forEach(function (ep) {
      if (!e.counts(ep) || ep.status === 'done' || ep.to < p.start) return;
      e.epicDependencies(ep.id, p).forEach(function (d) { if (d.risks.length) risks.push({ epic: ep, dep: d }); });
    });
    var org = e.orgCategoryLoad(p);
    var free = U.sum(org, function (c) { return Math.max(0, c.free); });
    /* Behov spelar roll när teamet har flera kompetensområden. Utbildning gäller hela teamet. */
    var noNeeds = S.db.epics.filter(function (ep) {
      if (!e.counts(ep) || ep.status === 'done' || E.epicHoursInPeriod(ep, p) <= 0 || E.normNeeds(ep.needs)) return false;
      return e.teamCategoryLoad(ep.teamId, p).rows.filter(function (r) { return r.supply > 0.5; }).length > 1;
    });

    var h = UI.pageHead({
      title: 'Flaskhalsar',
      sub: 'Var arbetet tar slut på kompetens, var det finns ledig tid och vilka beroenden som kan försena annat arbete. Räknat ur epikernas kompetensbehov och teamens kapacitet i ' + esc(p.inText) + '.'
    });
    h += UI.facts([
      { label: 'Flaskhalsar', value: spots.length - gaps.length, note: 'Kompetensområden över 100 % i ett team', tone: spots.length - gaps.length ? 'crit' : null },
      { label: 'Luckor', value: gaps.length, note: 'Arbete som teamet saknar kompetens för', tone: gaps.length ? 'crit' : null },
      { label: 'Beroenden med risk', value: risks.length, note: 'Arbete som kan bli försenat', tone: risks.length ? 'warn' : null },
      { label: 'Ledigt i ' + p.inText, value: U.fmtH(free), note: 'Summa av områden med tid kvar' }
    ]);
    if (noNeeds.length) {
      h += '<div class="note">' + U.plural(noNeeds.length, 'epik', 'epiker') + ' i ' + esc(p.inText) + ' saknar kompetensbehov och fördelas som sitt teams sammansättning. Ange behovet så blir bilden skarpare: ' +
        noNeeds.slice(0, 4).map(function (ep) { return C.epicRef(ep); }).join(', ') + (noNeeds.length > 4 ? ' med flera' : '') + '.</div>';
    }

    /* Det som behöver lösas, störst först. */
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Det som behöver lösas</div>' +
      '<div class="card-sub">Kompetensområden där beslutat arbete kräver mer än teamet har, och var samma kompetens finns ledig.</div></div></div>';
    if (!spots.length) h += '<div class="empty">Inga flaskhalsar i ' + esc(p.inText) + '. Alla kompetensområden har plats för det beslutade arbetet.</div>';
    spots.forEach(function (x) {
      var r = x.row;
      var drivers = e.teamDemand(x.team.id, p).epics.filter(function (d) {
        var nn = E.normNeeds(d.epic.needs);
        return d.counts && nn && nn.some(function (n) { return n.category === r.category; });
      }).slice(0, 3);
      h += '<div class="spot"><div class="spot-head"><span><strong>' + esc(r.category) + '</strong> i ' + C.link('teams:' + x.team.id, x.team.name) + ' ' +
        (r.gap ? UI.badge('Saknas i teamet', 'crit') : UI.badge(U.fmtPct(r.loadPct), 'crit')) + '</span>' +
        '<span class="crit-text">' + U.fmtH(x.over) + ' för mycket</span></div>' +
        (r.gap ? '' : '<div class="spot-bar">' + C.capBar({ capacity: r.supply, loaded: r.demand }, { noValue: true }) + '</div>') +
        freeList(r.category, x.team.id, e, p, drivers.length ? drivers.map(function (d) { return C.epicRef(d.epic); }).join(', ') : '') + '</div>';
    });
    h += '</section>';

    /* Hela organisationen per kompetensområde. */
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Kompetensområden i hela organisationen</div>' +
      '<div class="card-sub">Ett område kan ha tid över totalt men vara fullt i enskilda team. Då handlar det om att flytta arbete eller låna kompetens.</div></div></div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Kompetensområde</th><th class="num">Kapacitet</th><th class="num" data-opt="1">Belastat</th><th class="num">Ledigt</th><th class="cbar-col">Beläggning</th><th data-opt="2">Fullt i</th></tr></thead><tbody>';
    org.slice().sort(function (a, b) { return b.loadPct - a.loadPct; }).forEach(function (c) {
      var full = c.teams.filter(function (x) { return x.row.gap || x.row.loadPct > 100.5; });
      h += '<tr><td>' + esc(c.category) + '</td><td class="num">' + U.fmtH(c.supply) + '</td><td class="num">' + U.fmtH(c.demand) + '</td>' +
        '<td class="num">' + (c.free < -0.5 ? '<span class="crit-text">' + U.fmtSigned(c.free, ' h') + '</span>' : U.fmtH(c.free)) + '</td>' +
        '<td class="cbar-col">' + C.capBar({ capacity: c.supply, loaded: c.demand }) + '</td>' +
        '<td class="small">' + (full.length ? full.map(function (x) { return '<div class="full-in">' + C.link('teams:' + x.team.id, x.team.name) + '</div>'; }).join('') : '<span class="muted">–</span>') + '</td></tr>';
    });
    h += '</tbody></table></div></section>';

    /*
     * Matris: team och kompetensområden. En liten beläggningsstapel per cell, samma som i resten
     * av appen, så att det trånga syns utan att man läser talen. Teamen står mest ansträngt först
     * och områdena i samma ordning som tabellen ovanför. Har teamet inte området är rutan tom.
     */
    var cols = org.slice().sort(function (a, b) { return b.loadPct - a.loadPct; })
      .filter(function (c) { return c.supply > 0.5 || c.demand > 0.5; }).map(function (c) { return c.category; });
    var mtx = S.db.teams.map(function (t) {
      var by = {};
      e.teamCategoryLoad(t.id, p).rows.forEach(function (r) { if (r.supply >= 0.5 || r.demand >= 0.5) by[r.category] = r; });
      var strain = -1;
      Object.keys(by).forEach(function (k) { strain = Math.max(strain, by[k].gap ? Infinity : by[k].loadPct); });
      return { t: t, by: by, strain: strain };
    }).sort(function (a, b) { return b.strain - a.strain || U.byName(a.t, b.t); });
    var mtxOver = mtx.some(function (x) { return Object.keys(x.by).some(function (k) { return x.by[k].gap || x.by[k].loadPct > 100.5; }); });
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Team och kompetensområden</div>' +
      '<div class="card-sub">Beläggning per område i ' + esc(p.inText) + '. Mest ansträngt team först, områdena i samma ordning som tabellen ovanför.</div></div></div>';
    h += UI.barLegend(mtxOver).replace('class="legend-line"', 'class="legend-line chart-legend"').replace(/<\/div>$/, '<span>Tom ruta: teamet har inte området</span></div>');
    h += '<div class="table-wrap"><table class="tbl lmx" data-fit="scroll"><thead><tr><th>Team</th>';
    cols.forEach(function (c) { h += '<th class="lmx-th">' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    mtx.forEach(function (x) {
      h += '<tr><td>' + C.link('teams:' + x.t.id, x.t.name) + '</td>';
      cols.forEach(function (c) {
        var r = x.by[c];
        if (!r) { h += '<td class="lmx-td"><span class="sr-only">Inte i teamet</span></td>'; return; }
        var cls = r.gap ? ' lx-gap' : r.loadPct > 100.5 ? ' lx-crit' : r.loadPct >= 90 ? ' lx-warn' : '';
        var tip = x.t.name + ' · ' + c + '\n' + (r.gap ? U.fmtH(r.demand) + ' arbete, ingen i teamet har kompetensen' : U.fmtH(r.demand) + ' arbete av ' + U.fmtH(r.supply) + ', ' + U.fmtPct(r.loadPct));
        h += '<td class="lmx-td' + cls + '" data-tip="' + esc(tip) + '"><span class="lmx-cell"><span class="lmx-val">' + (r.gap ? 'Saknas' : U.fmtPct(r.loadPct)) + '</span>' +
          UI.loadTrack(r.demand, 0, r.gap ? 0 : r.supply) + '</span></td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div></section>';

    /* Beroenden med risk. */
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Beroenden med risk</div>' +
      '<div class="card-sub">Arbete som väntar på annat arbete som blir klart för sent, inte är beslutat eller ligger hos ett team med flaskhals.</div></div></div>';
    if (!risks.length) h += '<div class="empty">Inga beroenden med risk.</div>';
    risks.forEach(function (x) {
      var ta = e.get('teams', x.epic.teamId);
      var tb = e.get('teams', x.dep.epic.teamId);
      h += '<div class="dep-row has-risk"><div class="grow">' + C.epicRef(x.epic) + ' <span class="muted">väntar på</span> ' + C.epicRef(x.dep.epic) +
        '<div class="muted small">' + (ta ? esc(ta.name) : '') + ' → ' + (tb ? esc(tb.name) : '') + ' · ' + esc(x.dep.epic.name) + ' klar ' + U.fmtDate(x.dep.epic.to) + '</div>' +
        '<ul class="risk-list">' + x.dep.risks.map(function (r) { return '<li>' + esc(r.text) + '</li>'; }).join('') + '</ul></div>' + UI.badge('Risk', 'warn') + '</div>';
    });
    h += '</section>';
    return h;
  };

  /* ---------- Initiativ ---------- */

  /* Under det beslutade: hur mycket som är kvar av investeringen, eller hur mycket det går över. */
  function investmentNote(sum) {
    if (sum.investment === null) return '';
    if (sum.over) return '<br>' + UI.badge(U.fmtH(-sum.room) + ' över', 'warn');
    return '<br><span class="sub">' + U.fmtH(sum.room) + ' kvar</span>';
  }

  /*
   * Omvänd estimering (problem 17): leveransdomänens investering mot teamens epiker. Beslutade epiker
   * fyller stapeln per team, förslagen står streckade efter, och det som går över investeringen
   * sticker ut efter markeringen. Talen står i faktarutan, här syns proportionerna och förslagen.
   */
  function investmentCard(x, sum) {
    var h = '<section class="card"><div class="card-head"><div><div class="card-title">Investering</div>' +
      '<div class="card-sub">Leveransdomänens beslut om hur mycket tid initiativet får kosta, mot teamens epiker.</div></div>' +
      UI.btn(sum.investment === null ? 'Sätt investering' : 'Ändra', 'initiative-edit', { cls: 'btn-sm', data: { id: x.id } }) + '</div>';
    if (sum.investment === null) {
      return h + '<p class="muted">Ingen investering är beslutad. Då går det inte att se om epikerna kostar mer än satsningen är värd.</p></section>';
    }
    var parts = sum.teams.map(function (t) { return { label: t.team.name, hours: t.frame, kind: 'team' }; });
    if (sum.proposedFrame) parts.push({ label: 'Förslag från team', hours: sum.proposedFrame, kind: 'proposal' });
    h += UI.budget(parts, sum.investment, { capLabel: 'Investering' });
    var legend = [];
    if (sum.frame) legend.push('<span><span class="sw loaded"></span>Beslutat i epiker, per team</span>');
    if (sum.proposedFrame) legend.push('<span><span class="sw-k proposal"></span>Förslag från team</span>');
    if (sum.roomAfterProposals > 0.5) legend.push('<span><span class="sw free"></span>Kvar</span>');
    if (sum.roomAfterProposals < -0.5) legend.push('<span><span class="sw over"></span>Över investeringen</span>');
    h += '<div class="legend-line" aria-hidden="true">' + legend.join('') + '</div>';
    /* Över är ett beslut som ska fattas, inte ett fel: texten säger vilka val som finns. */
    var choice = ' Minska omfattningen, öka investeringen eller stoppa annat arbete.';
    var text = '';
    if (sum.over) text = 'Epikerna går över investeringen.' + choice;
    else if (sum.proposedFrame && sum.roomAfterProposals < -0.5) text = 'Förslagen ryms inte. Beslutas de går initiativet ' + U.fmtH(-sum.roomAfterProposals) + ' över.' + choice;
    else if (sum.proposedFrame) text = 'Förslagen ryms. Beslutas de återstår ' + U.fmtH(sum.roomAfterProposals) + '.';
    if (text) h += '<p class="small inv-note ' + (sum.roomAfterProposals < -0.5 ? 'warn-text' : 'muted') + '">' + text + '</p>';
    return h + '</section>';
  }

  function initiativeList(ctx) {
    var e = ctx.e;
    var p = ctx.period;
    var rows = S.db.initiatives.map(function (x) {
      var sum = e.initiativeSummary(x.id, p);
      return { id: x.id, x: x, dd: e.get('deliveryDomains', x.deliveryDomainId), owner: x.ownerId ? e.get('workers', x.ownerId) : null, sum: sum };
    });
    var active = rows.filter(function (r) { return r.x.status === 'active' || r.x.status === 'planned'; });
    var inPeriod = U.sum(rows, function (r) { return r.sum.hoursInPeriod; });
    var org = e.orgCapacity(p);
    var teamsInvolved = new Set();
    rows.forEach(function (r) { r.sum.teams.forEach(function (t) { if (t.hours > 0) teamsInvolved.add(t.team.id); }); });

    var over = rows.filter(function (r) { return r.sum.over; }).length;
    var missing = rows.filter(function (r) { return r.sum.investment === null && r.x.status !== 'done'; }).length;

    var h = UI.pageHead({
      title: 'Initiativ',
      sub: 'Leveransdomänerna beslutar initiativen och hur mycket tid de får kosta. Teamen bryter ned dem i epiker och estimerar dem.',
      actions: UI.btn('Lägg till initiativ', 'initiative-add', { cls: 'btn-primary' })
    });
    h += UI.facts([
      { label: 'Pågående och planerade', value: active.length, note: U.plural(rows.length, 'initiativ', 'initiativ') + ' totalt' },
      {
        label: 'Beslutat i epiker',
        value: U.fmtH(U.sum(rows, function (r) { return r.sum.frame; })),
        note: [over ? U.plural(over, 'initiativ', 'initiativ') + ' över investeringen' : '', missing ? U.plural(missing, 'initiativ', 'initiativ') + ' utan investering' : ''].filter(Boolean).join(' · ') || 'Inom investeringarna'
      },
      { label: 'I ' + p.inText, value: U.fmtH(inPeriod), note: U.fmtPct(org.capacity ? (inPeriod / org.capacity) * 100 : 0) + ' av kapaciteten' },
      { label: 'Team som bär initiativ', value: teamsInvolved.size, note: 'Av ' + S.db.teams.length + ' team' }
    ]);
    h += '<section class="card">' + UI.table({
      id: 'tbl-initiatives',
      title: 'Alla initiativ',
      rows: rows,
      search: { placeholder: 'Sök initiativ, domän, ägare …', text: function (r) { return [r.x.goal, r.sum.teams.map(function (t) { return t.team.name; }).join(' ')].join(' '); } },
      rowGo: function (r) { return 'initiatives:' + r.id; },
      defaultSort: 'period',
      defaultDir: -1,
      noun: 'initiativ',
      rowClass: function (r) { return r.x.status === 'done' ? 'is-past' : ''; },
      columns: [
        { key: 'name', label: 'Initiativ', sort: function (r) { return r.x.name; }, render: function (r) { return '<span class="name">' + esc(r.x.name) + '</span><br><span class="sub">' + (r.dd ? esc(r.dd.name) : '') + '</span>'; } },
        { key: 'owner', label: 'Ägare', opt: 2, sort: function (r) { return r.owner ? r.owner.name : 'ö'; }, render: function (r) { return r.owner ? esc(r.owner.name) : UI.badge('Saknas', 'warn'); } },
        { key: 'status', label: 'Status', sort: function (r) { return r.x.status; }, render: function (r) { return C.epicStatus(r.x.status); } },
        { key: 'teams', label: 'Team', cls: 'num', opt: 2, sort: function (r) { return r.sum.teams.length; }, render: function (r) { return r.sum.teams.length; } },
        { key: 'investment', label: 'Investering', cls: 'num', opt: 1, sort: function (r) { return r.sum.investment === null ? -1 : r.sum.investment; }, render: function (r) { return r.sum.investment === null ? '<span class="muted">–</span>' : U.fmtH(r.sum.investment); } },
        { key: 'frame', label: 'Beslutat', cls: 'num', opt: 1, sort: function (r) { return r.sum.frame; }, render: function (r) { return U.fmtH(r.sum.frame) + investmentNote(r.sum); } },
        { key: 'period', label: 'I perioden', cls: 'num', sort: function (r) { return r.sum.hoursInPeriod; }, render: function (r) { return U.fmtH(r.sum.hoursInPeriod); } }
      ]
    }) + '</section>';
    return h;
  }

  function initiativeDetail(x, ctx) {
    var e = ctx.e;
    var p = ctx.period;
    var sum = e.initiativeSummary(x.id, p);
    var dd = e.get('deliveryDomains', x.deliveryDomainId);
    var owner = x.ownerId ? e.get('workers', x.ownerId) : null;
    var over = sum.teams.filter(function (t) { return t.hours > 0 && e.teamCapacity(t.team.id, p).loadPct > 100.5; });

    var h = UI.pageHead({
      crumbs: C.link('initiatives', 'Initiativ') + '<span>›</span><span>' + esc(x.name) + '</span>',
      title: esc(x.name) + (x.status === 'proposed' || x.status === 'done' ? ' ' + C.epicStatus(x.status) : ''),
      meta: [dd ? esc(dd.name) : '', owner ? 'Ägare: ' + esc(owner.name) : ''],
      sub: esc(x.goal || ''),
      actions: UI.btn('Lägg till epik', 'epic-add', { data: { initiative: x.id } }) + UI.btn('Redigera', 'initiative-edit', { data: { id: x.id } }) + UI.btn('Ta bort', 'initiative-delete', { cls: 'btn-danger', data: { id: x.id } })
    });
    if (over.length) {
      h += '<div class="note crit"><strong>' + over.map(function (t) { return esc(t.team.name); }).join(' och ') + (over.length === 1 ? ' är' : ' är') + ' överplanerat i ' + esc(p.inText) + '.</strong> Initiativet konkurrerar med annat arbete om samma tid.</div>';
    }
    /* Ett initiativ som bara är ett förslag gör sina epiker till förslag, också de som är beslutade. */
    var waiting = x.status === 'proposed' ? sum.epics.filter(function (ep) { return E.epicCounts(ep.status) && ep.status !== 'done'; }) : [];
    if (waiting.length) {
      h += '<div class="note warn"><strong>Initiativet är ett förslag.</strong> ' + U.plural(waiting.length, 'beslutad epik', 'beslutade epiker') + ' belastar inte teamen förrän initiativet beslutas.</div>';
    }
    var invested = sum.investment !== null;
    h += UI.facts([
      { label: 'Investering', value: invested ? U.fmtH(sum.investment) : '–', note: invested ? 'Beslutad av leveransdomänen' : 'Inte beslutad' },
      { label: 'Beslutat i epiker', value: U.fmtH(sum.frame), note: U.plural(sum.decided.length, 'beslutad epik', 'beslutade epiker') + ' i ' + U.plural(sum.teams.length, 'team', 'team') },
      invested
        ? { label: sum.over ? 'Över investeringen' : 'Kvar', value: U.fmtH(Math.abs(sum.room)), tone: sum.over ? 'warn' : null, note: sum.proposedFrame ? U.fmtH(sum.proposedFrame) + ' i förslag' + (sum.roomAfterProposals >= -0.5 ? ', ryms' : ', ryms inte') : 'Inga förslag' }
        : { label: 'Förslag från team', value: U.fmtH(sum.proposedFrame), note: sum.proposedFrame ? 'Teamens estimat, väntar på beslut' : 'Inga förslag' },
      { label: 'I ' + p.inText, value: U.fmtH(sum.hoursInPeriod), note: 'Av ' + U.fmtH(sum.frame) + ' beslutat' }
    ]);

    var main = investmentCard(x, sum);
    main += '<section class="card"><div class="card-head"><div><div class="card-title">Team som bär initiativet</div>' +
      '<div class="card-sub">Initiativets timmar i ' + esc(p.inText) + ' och teamets beläggning med allt annat arbete.</div></div></div>';
    main += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Team</th><th class="num" data-opt="2">Epiker</th><th class="num" data-opt="1">Ram</th><th class="num">I perioden</th><th>Teamets beläggning</th></tr></thead><tbody>';
    sum.teams.forEach(function (t) {
      var tc = e.teamCapacity(t.team.id, p);
      main += '<tr class="clickable" data-go="teams:' + t.team.id + '" tabindex="0"><td>' + esc(t.team.name) + '</td><td class="num">' + t.epics + '</td><td class="num">' + U.fmtH(t.frame) + '</td><td class="num">' + U.fmtH(t.hours) + '</td><td>' + UI.bar(tc.loadPct) + '</td></tr>';
    });
    if (!sum.teams.length) main += '<tr><td colspan="5"><div class="empty">Inga beslutade epiker ännu. Lägg till en epik för varje team som ska bära arbetet.</div></td></tr>';
    main += '</tbody></table></div></section>';

    main += '<section class="card"><div class="card-head"><div><div class="card-title">Epiker</div>' +
      '<div class="card-sub">Ett förslag är teamets estimat. När det beslutas blir det epikens ram och belastar teamet.</div></div>' +
      UI.btn('Lägg till epik', 'epic-add', { cls: 'btn-sm', data: { initiative: x.id } }) + '</div>';
    main += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Epik</th><th>Status</th><th class="num" data-opt="1">Timmar</th><th class="num">I perioden</th></tr></thead><tbody>';
    sum.epics.slice().sort(function (a, b) { return a.from.localeCompare(b.from); }).forEach(function (ep) {
      var t = e.get('teams', ep.teamId);
      var hrs = E.epicHoursInPeriod(ep, p);
      main += '<tr class="clickable' + (ep.status === 'done' ? ' is-past' : '') + '" data-go="epics:' + ep.id + '" tabindex="0"><td>' + esc(ep.name) + '<div class="muted small">' + [t ? esc(t.name) : '', esc(C.EPIC_TYPE[ep.type] || ''), monthSpan(ep)].filter(Boolean).join(' · ') + '</div></td><td>' + C.epicStatus(ep.status) +
        (ep.status === 'proposed' ? ' ' + UI.btn('Besluta', 'epic-decide', { cls: 'btn-sm', data: { id: ep.id } }) : '') + '</td>' +
        '<td class="num">' + C.epicFrameText(ep) + '</td><td class="num">' + (hrs ? (e.counts(ep) ? U.fmtH(hrs) : '<span class="muted">(' + U.fmtH(hrs) + ')</span>') : '<span class="muted">–</span>') + '</td></tr>';
    });
    if (!sum.epics.length) main += '<tr><td colspan="4"><div class="empty">Initiativet har inga epiker ännu.</div></td></tr>';
    main += '</tbody></table></div></section>';

    /* Beroenden mellan initiativets epiker och till annat arbete. */
    var links = [];
    sum.epics.forEach(function (ep) {
      e.epicDependencies(ep.id, p).forEach(function (d) { links.push({ from: ep, dep: d }); });
    });
    if (links.length) {
      main += '<section class="card"><div class="card-head"><div><div class="card-title">Beroenden</div>' +
        '<div class="card-sub">Ordningen arbetet måste göras i. En risk här kan försena hela initiativet.</div></div></div>';
      links.forEach(function (x) {
        var ta = e.get('teams', x.from.teamId);
        var tb = e.get('teams', x.dep.epic.teamId);
        main += '<div class="dep-row' + (x.dep.risks.length ? ' has-risk' : '') + '"><div class="grow">' + C.epicRef(x.from) + ' <span class="muted">väntar på</span> ' + C.epicRef(x.dep.epic) +
          '<div class="muted small">' + (ta ? esc(ta.name) : '') + ' → ' + (tb ? esc(tb.name) : '') + ' · klar ' + U.fmtDate(x.dep.epic.to) + '</div>' +
          (x.dep.risks.length ? '<ul class="risk-list">' + x.dep.risks.map(function (r) { return '<li>' + esc(r.text) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
          (x.dep.risks.length ? UI.badge('Risk', 'warn') : '') + '</div>';
      });
      main += '</section>';
    }

    var aside = UI.asideBlock('Uppgifter', UI.props([
      ['Leveransdomän', C.ddRef(dd)],
      ['Ägare', owner ? C.workerRef(owner, owner.title) : UI.badge('Saknas', 'warn')],
      ['Status', C.epicStatus(x.status)],
      ['Gäller', U.fmtDate(x.from) + ' – ' + U.fmtDate(x.to)]
    ]));
    aside += UI.asideBlock('Mål', '<p class="aside-text">' + esc(x.goal || 'Inget mål angivet.') + '</p>');
    h += UI.detailLayout(main, aside);
    return h;
  }

  OOS.views.initiatives = function (ctx) {
    var x = ctx.id ? ctx.e.get('initiatives', ctx.id) : null;
    return x ? initiativeDetail(x, ctx) : initiativeList(ctx);
  };

  /* Teamets arbete: används på teamsidan. */
  OOS.teamWork = function (team, ctx) {
    var e = ctx.e;
    var p = ctx.period;
    var tc = e.teamCapacity(team.id, p);
    var d = tc.demand;
    var h = '<section class="card"><div class="card-head"><div><div class="card-title">Arbete i ' + esc(p.inText) + '</div>' +
      '<div class="card-sub">Beslutade epiker mot teamets kapacitet. Det är de som ger teamets beläggning.</div></div>' +
      UI.btn('Lägg till epik', 'epic-add', { cls: 'btn-sm', data: { team: team.id } }) + '</div>';
    var rows = '';
    /* Förvaltningen först: den löpande ramen för drift, utbildning och kompetensspridning. */
    var list = d.epics.slice().sort(function (a, b) { return (b.epic.type === 'maintenance') - (a.epic.type === 'maintenance') || b.hours - a.hours; });
    if (!e.teamMaintenance(team.id, p).length) {
      rows += '<div class="commit is-missing">' + C.typeSwatch('maintenance') + '<div><strong>Förvaltning saknas</strong>' +
        '<div class="commit-sub">Varje team har en förvaltningsepik för drift, utbildning och kompetensspridning.</div></div>' +
        '<span></span>' + UI.btn('Lägg till', 'epic-add', { cls: 'btn-sm', data: { team: team.id, kind: 'maintenance' } }) + '</div>';
    }
    list.forEach(function (x) {
      var init = x.epic.initiativeId ? e.get('initiatives', x.epic.initiativeId) : null;
      var what = x.epic.type === 'maintenance' ? 'Förvaltning: drift, utbildning och kompetensspridning' : esc(C.EPIC_TYPE[x.epic.type] || '');
      rows += '<div class="commit' + (x.counts ? '' : ' is-proposal') + '">' + C.typeSwatch(x.epic.type) + '<div>' + C.epicRef(x.epic) +
        '<div class="commit-sub">' + what + (init ? ' · ' + esc(init.name) : '') + (x.counts ? '' : ' · ' + esc(C.EPIC_STATUS[x.epic.status]) + ', räknas inte') + '</div></div>' +
        '<span class="commit-hours">' + (x.counts ? U.fmtH(x.load) : '(' + U.fmtH(x.hours) + ')') + '</span>' +
        '<span class="commit-acts">' + (x.epic.status === 'proposed' ? UI.btn('Besluta', 'epic-decide', { cls: 'btn-sm', data: { id: x.epic.id } }) : '') + UI.iconBtn('edit', 'epic-edit', { id: x.epic.id }, 'Ändra ' + x.epic.name) + '</span></div>';
    });
    if (!d.epics.length) rows += '<div class="empty">Inget annat arbete i perioden.</div>';
    h += workSplit(d.byType, tc.capacity, 'Kapacitet', rows);
    if (d.proposed > 0 && tc.capacity) {
      var after = ((tc.loaded + d.proposed) / tc.capacity) * 100;
      h += '<p class="small' + (after > 100.5 ? ' crit-text' : ' muted') + '">Om förslagen beslutas blir beläggningen ' + U.fmtPct(after) + (after > 100.5 ? ', mer än teamet har.' : '.') + '</p>';
    }
    return h + '</section>';
  };

  var A = OOS.actions;
  A['epic-add'] = function (el) {
    var defaults = {};
    if (el && el.dataset.team) defaults.teamId = el.dataset.team;
    /* Förvaltning: löpande ram per månad. Förslaget är en femtedel av teamets kapacitet. */
    if (el && el.dataset.kind === 'maintenance') {
      var t = S.engine().get('teams', el.dataset.team);
      var cap = S.engine().teamCapacity(el.dataset.team, OOS.period()).capacity;
      var today = U.todayISO();
      Object.assign(defaults, {
        type: 'maintenance', effort: 'monthly', status: 'active', name: 'Förvaltning' + (t ? ' – ' + t.name : ''),
        hours: Math.max(10, Math.round((cap * 0.2) / 10) * 10), from: today, to: (Number(today.slice(0, 4)) + 1) + '-12-31',
        description: 'Drift, rättningar, utbildning och kompetensspridning.'
      });
    }
    if (el && el.dataset.initiative) {
      defaults.initiativeId = el.dataset.initiative;
      defaults.type = 'development';
    }
    C.forms.epic(null, defaults);
  };
  A['epic-edit'] = function (el) { C.forms.epic(S.engine().get('epics', el.dataset.id)); };
  A['epic-decide'] = function (el) { C.decideEpic(S.engine().get('epics', el.dataset.id)); };
  A['epic-delete'] = function (el) { C.removeEntity('epics', el.dataset.id, 'epics'); };
  A['initiative-add'] = function (el) { C.forms.initiative(null, el && el.dataset.dd ? { deliveryDomainId: el.dataset.dd } : null); };
  A['initiative-edit'] = function (el) { C.forms.initiative(S.engine().get('initiatives', el.dataset.id)); };
  A['initiative-delete'] = function (el) { C.removeEntity('initiatives', el.dataset.id, 'initiatives'); };
})();
