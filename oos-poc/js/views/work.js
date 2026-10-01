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
    var org = e.orgCapacity(p);
    var byType = e.workByType(p);
    var decided = U.sum(Object.keys(byType), function (k) { return byType[k]; });
    var proposals = all.filter(function (r) { return r.ep.status === 'proposed'; });
    var untraced = all.filter(function (r) { return r.ep.type === 'development' && !r.ep.initiativeId && E.epicCounts(r.ep.status) && r.hours > 0; });

    var h = UI.pageHead({
      title: 'Epiker',
      sub: 'Epiker är teamens arbete: utveckling, förvaltning, utredning och utbildning. Varje epik har en beslutad ram i timmar, och det är den som belastar teamets kapacitet.',
      actions: UI.btn('Lägg till epik', 'epic-add', { cls: 'btn-primary' })
    });
    h += UI.facts([
      { label: 'Beslutat arbete i ' + p.inText, value: U.fmtH(decided), note: U.fmtPct(org.capacity ? (decided / org.capacity) * 100 : 0) + ' av teamens kapacitet' },
      { label: 'Utveckling', value: U.fmtPct(decided ? ((byType.development || 0) / decided) * 100 : 0), note: U.fmtH(byType.development || 0) + ' av arbetet' },
      { label: 'Förvaltning', value: U.fmtPct(decided ? ((byType.maintenance || 0) / decided) * 100 : 0), note: U.fmtH(byType.maintenance || 0) + ' av arbetet' },
      { label: 'Förslag', value: proposals.length, note: proposals.length ? 'Väntar på beslut, belastar inte' : 'Inga förslag just nu' }
    ]);
    if (untraced.length) {
      h += '<div class="note warn"><strong>' + U.plural(untraced.length, 'utvecklingsepik', 'utvecklingsepiker') + ' saknar initiativ.</strong> ' +
        'Utveckling bör gå att spåra till en beslutad satsning, annars syns inte varför tiden används: ' +
        untraced.map(function (r) { return C.epicRef(r.ep); }).join(', ') + '.</div>';
    }

    h += '<section class="card"><div class="card-head"><div><div class="card-title">Var tiden går i ' + esc(p.inText) + '</div>' +
      '<div class="card-sub">Beslutat arbete per typ mot alla teams kapacitet. Domänmoln och nyckelroller ingår inte.</div></div></div>';
    var teamCap = U.sum(S.db.teams, function (t) { return e.teamCapacity(t.id, p).capacity; });
    h += workSplit(byType, teamCap, 'Teamens kapacitet') + '</section>';

    var segs = [{ key: 'all', label: 'Alla' }].concat(TYPE_ORDER.map(function (t) { return { key: t, label: C.EPIC_TYPE[t] }; }));
    h += '<section class="card">' + UI.table({
      id: 'tbl-epics',
      title: 'Alla epiker',
      tools: UI.seg('epic-type', segs, filter),
      rows: rows,
      search: {
        placeholder: 'Sök epik, team, initiativ …',
        text: function (r) { return [r.ep.description, C.EPIC_TYPE[r.ep.type], r.init ? r.init.name : 'utan initiativ'].join(' '); }
      },
      rowGo: function (r) { return 'epics:' + r.id; },
      defaultSort: 'hours',
      defaultDir: -1,
      noun: 'epiker',
      rowClass: function (r) { return r.ep.status === 'done' ? 'is-past' : ''; },
      columns: [
        {
          key: 'name', label: 'Epik', sort: function (r) { return r.ep.name; },
          render: function (r) { return '<span class="name-cell wrap">' + C.typeSwatch(r.ep.type) + '<span><span class="name">' + esc(r.ep.name) + '</span><br><span class="sub">' + esc(C.EPIC_TYPE[r.ep.type] || '') + '</span></span></span>'; }
        },
        { key: 'team', label: 'Team', sort: function (r) { return r.team ? r.team.name : 'ö'; }, render: function (r) { return r.team ? esc(r.team.name) : '<span class="muted">–</span>'; } },
        { key: 'init', label: 'Initiativ', opt: 1, sort: function (r) { return r.init ? r.init.name : 'ö'; }, render: function (r) { return r.init ? esc(r.init.name) : '<span class="muted">–</span>'; } },
        { key: 'status', label: 'Status', sort: function (r) { return r.ep.status; }, render: function (r) { return C.epicStatus(r.ep.status); } },
        { key: 'span', label: 'Gäller', opt: 2, sort: function (r) { return r.ep.from; }, render: function (r) { return '<span class="nowrap">' + U.fmtDate(r.ep.from) + ' –</span> <span class="nowrap">' + U.fmtDate(r.ep.to) + '</span>'; } },
        { key: 'frame', label: 'Ram', cls: 'num', opt: 2, sort: function (r) { return r.frame; }, render: function (r) { return C.epicFrameText(r.ep); } },
        {
          key: 'hours', label: 'I perioden', cls: 'num', sort: function (r) { return r.hours; },
          render: function (r) { return r.hours ? (E.epicCounts(r.ep.status) ? U.fmtH(r.hours) : '<span class="muted">(' + U.fmtH(r.hours) + ')</span>') : '<span class="muted">–</span>'; }
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
    var max = Math.max.apply(null, needs.map(function (n) { var r = byCat[n.category]; return r ? Math.max(r.supply, r.demand) : 0; }).concat([1]));
    needs.slice().sort(function (a, b) { return b.share - a.share; }).forEach(function (n) {
      var r = byCat[n.category] || { supply: 0, demand: 0, free: 0, loadPct: 0, gap: true, people: [] };
      var tight = r.gap || r.loadPct > 100.5;
      var state = r.gap ? UI.badge('Saknas i teamet', 'crit') : r.loadPct > 100.5 ? UI.badge('Flaskhals', 'crit') : r.loadPct >= 90 ? UI.badge('Nästan fullt', 'warn') : '';
      h += '<div class="need-block' + (tight ? ' is-tight' : '') + '"><div class="need-block-head"><span class="need-block-name"><strong>' + esc(n.category) + '</strong> ' + state + '</span>' +
        '<span class="muted small">' + (n.derived ? '' : U.fmtPct(n.share * 100) + ' av epiken · ') + U.fmtH(base * n.share) + ' i ' + esc(p.inText) + '</span></div>';
      if (r.gap) {
        h += '<p class="small">Ingen i teamet har ' + esc(n.category) + ' som primär kompetens. ' + freeIn(n.category, team.id, e, p) + '</p>';
      } else {
        h += '<div class="need-block-bar">' + C.capBar({ capacity: r.supply, loaded: r.demand }, max) +
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
  function freeIn(category, exceptTeamId, e, p) {
    var spots = [];
    S.db.teams.forEach(function (t) {
      if (t.id === exceptTeamId) return;
      e.teamCategoryLoad(t.id, p).rows.forEach(function (r) {
        if (r.category === category && !r.gap && r.free > 20) spots.push({ team: t, free: r.free });
      });
    });
    spots.sort(function (a, b) { return b.free - a.free; });
    if (!spots.length) return 'Inget annat team har ledig tid inom ' + esc(category) + ' i ' + esc(p.inText) + '.';
    return 'Ledigt i andra team: ' + spots.slice(0, 3).map(function (x) { return C.link('teams:' + x.team.id, x.team.name) + ' ' + U.fmtH(x.free); }).join(', ') + '.';
  }

  /* Beroenden åt båda hållen, med de risker som gör att arbetet kan bli försenat. */
  function dependencyCard(ep, ctx) {
    var e = ctx.e;
    var deps = e.epicDependencies(ep.id, ctx.period);
    var waiting = e.epicDependents(ep.id, ctx.period);
    var h = '<section class="card"><div class="card-head"><div><div class="card-title">Beroenden</div>' +
      '<div class="card-sub">Arbete som måste bli klart först, och arbete som väntar på den här epiken.</div></div></div>';
    function item(x, dir) {
      var t = e.get('teams', x.epic.teamId);
      return '<div class="dep-row' + (x.risks.length ? ' has-risk' : '') + '"><div class="grow">' + C.epicRef(x.epic) +
        '<div class="muted small">' + (t ? esc(t.name) + ' · ' : '') + esc(C.EPIC_STATUS[x.epic.status] || '') + ' · klar ' + U.fmtDate(x.epic.to) + '</div>' +
        (x.risks.length ? '<ul class="risk-list">' + x.risks.map(function (r) { return '<li>' + esc(r.text) + '</li>'; }).join('') + '</ul>' : '') + '</div>' +
        (x.risks.length ? UI.badge(dir === 'in' ? 'Risk' : 'Påverkas', 'warn') : '') + '</div>';
    }
    h += '<div class="dep-cols"><div><div class="dep-head">Väntar på</div>';
    h += deps.length ? deps.map(function (x) { return item(x, 'in'); }).join('') : '<p class="muted small">Inget. Epiken kan göras utan att vänta på annat arbete.</p>';
    h += '</div><div><div class="dep-head">Väntar på den här</div>';
    h += waiting.length ? waiting.map(function (x) { return item(x, 'out'); }).join('') : '<p class="muted small">Inget annat arbete väntar på epiken.</p>';
    return h + '</div></div></section>';
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
    var counts = E.epicCounts(ep.status);

    var h = UI.pageHead({
      crumbs: C.link('epics', 'Epiker') + '<span>›</span><span>' + esc(ep.name) + '</span>',
      title: esc(ep.name) + (ep.status === 'proposed' || ep.status === 'done' ? ' ' + C.epicStatus(ep.status) : ''),
      meta: [esc(C.EPIC_TYPE[ep.type] || ''), team ? esc(team.name) : '', init ? esc(init.name) : ''],
      sub: esc(ep.description || ''),
      actions: UI.btn('Redigera', 'epic-edit', { data: { id: ep.id } }) + UI.btn('Ta bort', 'epic-delete', { cls: 'btn-danger', data: { id: ep.id } })
    });

    if (ep.status === 'proposed') {
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
      { label: 'Ram', value: ep.effort === 'monthly' ? U.fmtNum(ep.hours) + ' h/mån' : U.fmtH(ep.hours), note: ep.effort === 'monthly' ? U.fmtH(frame) + ' under hela tiden' : 'Fördelas jämnt över tiden' },
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
      main += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Period</th><th class="num">Epiken</th><th class="num" data-opt="1">Teamets arbete</th><th class="num" data-opt="2">Kapacitet</th><th>Teamets beläggning</th>' +
        (imp ? '<th class="num">Om beslutad</th>' : '') + '</tr></thead><tbody>';
      periods.forEach(function (pp) {
        var t = e.teamCapacity(team.id, pp);
        var mine = E.epicHoursInPeriod(ep, pp);
        var a = after[pp.start];
        main += '<tr' + (pp.start === p.start ? ' class="selected"' : '') + '><td>' + esc(pp.label) + '</td><td class="num">' + (counts ? U.fmtH(mine) : '<span class="muted">(' + U.fmtH(mine) + ')</span>') + '</td>' +
          '<td class="num">' + U.fmtH(t.loaded) + '</td><td class="num">' + U.fmtH(t.capacity) + '</td><td>' + UI.bar(t.loadPct) + '</td>' +
          (imp ? '<td class="num">' + (a === undefined ? '<span class="muted">–</span>' : '<strong' + (a > 100.5 ? ' class="crit-text"' : '') + '>' + U.fmtPct(a) + '</strong>') + '</td>' : '') + '</tr>';
      });
      main += '</tbody></table></div>';
      if (!counts) main += '<p class="muted small">Epikens timmar står inom parentes eftersom den inte är beslutad. Om beslutad visar teamets beläggning med epiken.</p>';
    }
    main += '</section>';

    var aside = UI.asideBlock('Uppgifter', UI.props([
      ['Team', C.teamRef(team)],
      ['Initiativ', init ? C.initiativeRef(init) : (ep.type === 'development' ? UI.badge('Saknas', 'warn') : '')],
      ['Leveransdomän', C.ddRef(dd)],
      ['Arbetstyp', esc(C.EPIC_TYPE[ep.type] || '')],
      ['Status', C.epicStatus(ep.status)],
      ['Ram', C.epicFrameText(ep)],
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
      if (!E.epicCounts(ep.status) || ep.status === 'done' || ep.to < p.start) return;
      e.epicDependencies(ep.id, p).forEach(function (d) { if (d.risks.length) risks.push({ epic: ep, dep: d }); });
    });
    var org = e.orgCategoryLoad(p);
    var free = U.sum(org, function (c) { return Math.max(0, c.free); });
    /* Behov spelar roll när teamet har flera kompetensområden. Utbildning gäller hela teamet. */
    var noNeeds = S.db.epics.filter(function (ep) {
      if (!E.epicCounts(ep.status) || ep.status === 'done' || E.epicHoursInPeriod(ep, p) <= 0 || E.normNeeds(ep.needs)) return false;
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
        (r.gap ? '' : '<div class="spot-bar">' + C.capBar({ capacity: r.supply, loaded: r.demand }, Math.max(r.supply, r.demand)) + '</div>') +
        '<p class="small">' + (drivers.length ? 'Arbete som behöver ' + esc(r.category) + ': ' + drivers.map(function (d) { return C.epicRef(d.epic); }).join(', ') + '. ' : '') + freeIn(r.category, x.team.id, e, p) + '</p></div>';
    });
    h += '</section>';

    /* Hela organisationen per kompetensområde. */
    var maxOrg = Math.max.apply(null, org.map(function (c) { return Math.max(c.supply, c.demand); }).concat([1]));
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Kompetensområden i hela organisationen</div>' +
      '<div class="card-sub">Ett område kan ha tid över totalt men vara fullt i enskilda team. Då handlar det om att flytta arbete eller låna kompetens.</div></div></div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Kompetensområde</th><th class="num">Kapacitet</th><th class="num" data-opt="1">Arbete</th><th class="num">Ledigt</th><th class="cbar-col">Belastat och ledigt</th><th data-opt="2">Fullt i</th></tr></thead><tbody>';
    org.slice().sort(function (a, b) { return b.loadPct - a.loadPct; }).forEach(function (c) {
      var full = c.teams.filter(function (x) { return x.row.gap || x.row.loadPct > 100.5; });
      h += '<tr><td>' + esc(c.category) + '</td><td class="num">' + U.fmtH(c.supply) + '</td><td class="num">' + U.fmtH(c.demand) + '</td>' +
        '<td class="num">' + (c.free < -0.5 ? '<span class="crit-text">' + U.fmtSigned(c.free, ' h') + '</span>' : U.fmtH(c.free)) + '</td>' +
        '<td class="cbar-col">' + C.capBar({ capacity: c.supply, loaded: c.demand }, maxOrg) + '</td>' +
        '<td class="small">' + (full.length ? full.map(function (x) { return C.link('teams:' + x.team.id, x.team.name); }).join(', ') : '<span class="muted">–</span>') + '</td></tr>';
    });
    h += '</tbody></table></div></section>';

    /* Matris: team och kompetensområden. Färg bara där det avviker. */
    var cols = org.filter(function (c) { return c.supply > 0.5 || c.demand > 0.5; }).sort(function (a, b) { return b.supply - a.supply; }).map(function (c) { return c.category; });
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Team och kompetensområden</div>' +
      '<div class="card-sub">Beläggning per område i ' + esc(p.inText) + '. Gult från 90 %, rött över 100 % eller när teamet saknar kompetensen.</div></div></div>';
    h += '<div class="table-wrap"><table class="tbl heat lmx" data-fit="scroll"><thead><tr><th>Team</th>';
    cols.forEach(function (c) { h += '<th class="num heat-col">' + esc(c) + '</th>'; });
    h += '</tr></thead><tbody>';
    S.db.teams.slice().sort(U.byName).forEach(function (t) {
      var by = {};
      e.teamCategoryLoad(t.id, p).rows.forEach(function (r) { by[r.category] = r; });
      h += '<tr><td>' + C.link('teams:' + t.id, t.name) + '</td>';
      cols.forEach(function (c) {
        var r = by[c];
        if (!r || (r.supply < 0.5 && r.demand < 0.5)) { h += '<td class="num heat-cell"><span class="heat-empty">–</span></td>'; return; }
        var cls = r.gap || r.loadPct > 100.5 ? ' lx-crit' : r.loadPct >= 90 ? ' lx-warn' : '';
        var tip = t.name + ' · ' + c + '\n' + (r.gap ? U.fmtH(r.demand) + ' arbete, ingen kapacitet' : U.fmtH(r.demand) + ' arbete av ' + U.fmtH(r.supply) + ' (' + U.fmtPct(r.loadPct) + ')');
        h += '<td class="num heat-cell' + cls + '" data-tip="' + esc(tip) + '">' + (r.gap ? 'Saknas' : U.fmtNum(Math.round(r.loadPct)) + ' %') + '</td>';
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

    var h = UI.pageHead({
      title: 'Initiativ',
      sub: 'Initiativ är satsningar som leveransdomänerna har beslutat. De bryts ned i teamens epiker, och initiativets ram är summan av epikerna. Så syns det hur mycket av organisationens kapacitet varje satsning använder.',
      actions: UI.btn('Lägg till initiativ', 'initiative-add', { cls: 'btn-primary' })
    });
    h += UI.facts([
      { label: 'Pågående och planerade', value: active.length, note: U.plural(rows.length, 'initiativ', 'initiativ') + ' totalt' },
      { label: 'Beslutad ram', value: U.fmtH(U.sum(rows, function (r) { return r.sum.frame; })), note: 'Summan av initiativens epiker' },
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
        { key: 'teams', label: 'Team', cls: 'num', opt: 1, sort: function (r) { return r.sum.teams.length; }, render: function (r) { return r.sum.teams.length; } },
        { key: 'frame', label: 'Ram', cls: 'num', opt: 1, sort: function (r) { return r.sum.frame; }, render: function (r) { return U.fmtH(r.sum.frame); } },
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
    h += UI.facts([
      { label: 'Beslutad ram', value: U.fmtH(sum.frame), note: U.plural(sum.decided.length, 'beslutad epik', 'beslutade epiker') },
      { label: 'I ' + p.inText, value: U.fmtH(sum.hoursInPeriod), note: 'Av ramen' },
      { label: 'Team', value: sum.teams.length, note: 'Bär arbetet' },
      { label: 'Förslag', value: U.fmtH(sum.proposedFrame), note: sum.proposedFrame ? 'Väntar på beslut' : 'Inga förslag', tone: null }
    ]);

    var main = '<section class="card"><div class="card-head"><div><div class="card-title">Team som bär initiativet</div>' +
      '<div class="card-sub">Initiativets timmar i ' + esc(p.inText) + ' och teamets beläggning med allt annat arbete.</div></div></div>';
    main += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Team</th><th class="num" data-opt="2">Epiker</th><th class="num" data-opt="1">Ram</th><th class="num">I perioden</th><th>Teamets beläggning</th></tr></thead><tbody>';
    sum.teams.forEach(function (t) {
      var tc = e.teamCapacity(t.team.id, p);
      main += '<tr class="clickable" data-go="teams:' + t.team.id + '" tabindex="0"><td>' + esc(t.team.name) + '</td><td class="num">' + t.epics + '</td><td class="num">' + U.fmtH(t.frame) + '</td><td class="num">' + U.fmtH(t.hours) + '</td><td>' + UI.bar(tc.loadPct) + '</td></tr>';
    });
    if (!sum.teams.length) main += '<tr><td colspan="5"><div class="empty">Inga beslutade epiker ännu. Lägg till en epik för varje team som ska bära arbetet.</div></td></tr>';
    main += '</tbody></table></div></section>';

    main += '<section class="card"><div class="card-head"><div class="card-title">Epiker</div>' + UI.btn('Lägg till epik', 'epic-add', { cls: 'btn-sm', data: { initiative: x.id } }) + '</div>';
    main += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Epik</th><th>Status</th><th class="num" data-opt="1">Ram</th><th class="num">I perioden</th></tr></thead><tbody>';
    sum.epics.slice().sort(function (a, b) { return a.from.localeCompare(b.from); }).forEach(function (ep) {
      var t = e.get('teams', ep.teamId);
      var hrs = E.epicHoursInPeriod(ep, p);
      main += '<tr class="clickable' + (ep.status === 'done' ? ' is-past' : '') + '" data-go="epics:' + ep.id + '" tabindex="0"><td>' + esc(ep.name) + '<div class="muted small">' + [t ? esc(t.name) : '', esc(C.EPIC_TYPE[ep.type] || ''), monthSpan(ep)].filter(Boolean).join(' · ') + '</div></td><td>' + C.epicStatus(ep.status) + '</td>' +
        '<td class="num">' + C.epicFrameText(ep) + '</td><td class="num">' + (hrs ? (E.epicCounts(ep.status) ? U.fmtH(hrs) : '<span class="muted">(' + U.fmtH(hrs) + ')</span>') : '<span class="muted">–</span>') + '</td></tr>';
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
        '<span class="commit-hours">' + (x.counts ? U.fmtH(x.load) : '(' + U.fmtH(x.hours) + ')') + '</span>' + UI.iconBtn('edit', 'epic-edit', { id: x.epic.id }, 'Ändra ' + x.epic.name) + '</div>';
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
  A['epic-delete'] = function (el) { C.removeEntity('epics', el.dataset.id, 'epics'); };
  A['initiative-add'] = function () { C.forms.initiative(null); };
  A['initiative-edit'] = function (el) { C.forms.initiative(S.engine().get('initiatives', el.dataset.id)); };
  A['initiative-delete'] = function (el) { C.removeEntity('initiatives', el.dataset.id, 'initiatives'); };
})();
