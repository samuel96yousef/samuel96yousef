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

  var TYPE_ORDER = ['development', 'maintenance', 'investigation', 'training'];

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
    if (ep.type === 'development' && !init && counts) {
      h += '<div class="note warn"><strong>Utvecklingsarbete utan initiativ.</strong> Koppla epiken till den satsning den hör till, så att det går att se varför tiden används.</div>';
    }

    var months = Math.max(1, periodsIn(ep.from, ep.to, 60).length);
    var mine = team ? e.teamDemand(team.id, p).epics.filter(function (x) { return x.epic.id === ep.id; })[0] : null;
    h += UI.facts([
      { label: 'I ' + p.inText, value: U.fmtH(hrs), note: mine && mine.absorbed > 0.5
        ? U.fmtH(mine.absorbed) + ' ryms i grundavdraget för kompetensutveckling, ' + U.fmtH(mine.load) + ' belastar teamet'
        : tc && tc.capacity ? U.fmtPct((hrs / tc.capacity) * 100) + ' av teamets kapacitet' + (counts ? '' : ', räknas inte') : '' },
      { label: 'Ram', value: ep.effort === 'monthly' ? U.fmtNum(ep.hours) + ' h/mån' : U.fmtH(ep.hours), note: ep.effort === 'monthly' ? U.fmtH(frame) + ' under hela tiden' : 'Fördelas jämnt över tiden' },
      { label: 'Tid', value: U.plural(months, 'period', 'perioder'), note: monthSpan(ep) },
      tc ? { label: 'Teamets beläggning', value: U.fmtPct(tc.loadPct), note: 'I ' + p.inText + ', allt beslutat arbete', tone: loadTone(tc.loadPct) } : null
    ]);

    /* Period för period: epikens timmar och teamets beläggning. */
    var main = '<section class="card"><div class="card-head"><div><div class="card-title">Period för period</div>' +
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
    d.epics.forEach(function (x) {
      var init = x.epic.initiativeId ? e.get('initiatives', x.epic.initiativeId) : null;
      rows += '<div class="commit' + (x.counts ? '' : ' is-proposal') + '">' + C.typeSwatch(x.epic.type) + '<div>' + C.epicRef(x.epic) +
        '<div class="commit-sub">' + esc(C.EPIC_TYPE[x.epic.type] || '') + (init ? ' · ' + esc(init.name) : '') + (x.counts ? '' : ' · ' + esc(C.EPIC_STATUS[x.epic.status]) + ', räknas inte') +
        (x.absorbed > 0.5 ? ' · ' + U.fmtH(x.hours) + ', varav ' + U.fmtH(x.absorbed) + ' i kompetensutvecklingen' : '') + '</div></div>' +
        '<span class="commit-hours">' + (x.counts ? U.fmtH(x.load) : '(' + U.fmtH(x.hours) + ')') + '</span>' + UI.iconBtn('edit', 'epic-edit', { id: x.epic.id }, 'Ändra ' + x.epic.name) + '</div>';
    });
    if (!d.epics.length) rows += '<div class="empty">Inget arbete i perioden. Lägg till teamets förvaltning och de epiker teamet ska göra.</div>';
    h += workSplit(d.byType, tc.capacity, 'Kapacitet', rows);
    if (d.absorbed > 0.5) {
      h += '<p class="small muted">' + U.fmtH(d.absorbed) + ' utbildning ryms i grundavdraget för kompetensutveckling och belastar inte teamet. Det avdraget är redan draget från kapaciteten.</p>';
    }
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
