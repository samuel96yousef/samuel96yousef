/* Team: översikt och detaljvy med medlemmar, domäner, system och kapacitet. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  function list(ctx) {
    var e = ctx.e;
    var rows = S.db.teams.map(function (t) {
      return {
        id: t.id,
        team: t,
        dd: e.teamDeliveryDomain(t.id),
        bd: e.teamPrimaryDomain(t.id, 'business'),
        it: e.teamPrimaryDomain(t.id, 'it'),
        cap: e.teamCapacity(t.id, ctx.period)
      };
    });
    var people = new Set(S.db.teamWorkers.map(function (x) { return x.workerId; })).size;
    var totalCap = U.sum(rows, function (r) { return r.cap.capacity; });
    var totalLoaded = U.sum(rows, function (r) { return r.cap.loaded; });
    var h = UI.pageHead({
      title: 'Team',
      sub: 'Team är tvärfunktionella grupper av arbetare som tillsammans levererar värde inom en eller flera domäner. Producerande team arbetar mot en primär verksamhetsdomän, stödjande team mot flera.',
      actions: UI.btn('Lägg till team', 'team-add', { cls: 'btn-primary' })
    });
    h += '<div class="kpis">' +
      UI.kpi('Totalt antal team', rows.length, rows.filter(function (r) { return r.team.category === 'producing'; }).length + ' producerande, ' + rows.filter(function (r) { return r.team.category === 'supporting'; }).length + ' stödjande') +
      UI.kpi('Arbetare i team', people) +
      UI.kpi('Teamkapacitet ' + ctx.period.inText, U.fmtH(totalCap), U.fmtH(totalCap - totalLoaded) + ' ledigt') +
      UI.kpi('Genomsnittlig beläggning', U.fmtPct(totalCap ? (totalLoaded / totalCap) * 100 : 0)) +
      '</div>';
    h += '<section class="card">' + UI.table({
      id: 'tbl-teams',
      rows: rows,
      title: 'Alla team',
      /* Utöver kolumnerna: beskrivning, syfte, teamledare, medlemmar och system. */
      search: {
        placeholder: 'Sök team, domän, person, system …',
        text: function (r) {
          var e = ctx.e;
          var lead = r.team.leadId ? e.get('workers', r.team.leadId) : null;
          return [r.team.description, r.team.purpose, lead ? lead.name : '', C.categoryLabel(r.team.category)]
            .concat(e.teamMembers(r.team.id).map(function (m) { return m.worker ? m.worker.name : ''; }))
            .concat(e.teamSystems(r.team.id).map(function (x) { return x.system.name; }))
            .join(' ');
        }
      },
      rowGo: function (r) { return 'teams:' + r.id; },
      defaultSort: 'name',
      noun: 'team',
      columns: [
        { key: 'name', label: 'Teamnamn', sort: function (r) { return r.team.name; }, render: function (r) { return '<span class="name-cell">' + UI.avatar(r.team.name, r.id) + '<span><span class="name">' + esc(r.team.name) + '</span><br><span class="sub">' + C.categoryLabel(r.team.category) + '</span></span></span>'; } },
        { key: 'dd', label: 'Leveransdomän', opt: 1, sort: function (r) { return r.dd ? r.dd.name : 'ö'; }, render: function (r) { return r.dd ? esc(r.dd.name) : UI.badge('Saknas', 'warn'); } },
        { key: 'it', label: 'Primär IT-domän', opt: 2, sort: function (r) { return r.it ? r.it.name : 'ö'; }, render: function (r) { return r.it ? esc(r.it.name) : UI.badge('Saknas', 'warn'); } },
        { key: 'bd', label: 'Primär verksamhetsdomän', opt: 2, sort: function (r) { return r.bd ? r.bd.name : 'ö'; }, render: function (r) { return r.bd ? esc(r.bd.name) : UI.badge('Saknas', 'warn'); } },
        { key: 'n', label: 'Medlemmar', opt: 1, cls: 'num', sort: function (r) { return r.cap.headcount; }, render: function (r) { return r.cap.headcount; } },
        { key: 'cap', label: 'Kapacitet', cls: 'num', sort: function (r) { return r.cap.capacity; }, render: function (r) { return U.fmtH(r.cap.capacity); } },
        { key: 'load', label: 'Beläggning', sort: function (r) { return r.cap.loadPct; }, render: function (r) { return UI.bar(r.cap.loadPct); } }
      ]
    }) + '</section>';
    return h;
  }

  /* Ett avdrag i förhållande till perioden: pågår, kommande eller avslutat. */
  function reductionState(r, period) {
    if (r.to < period.start) return 'Avslutat';
    if (r.from > period.end) return 'Kommande';
    return 'Pågår';
  }

  /*
   * Detaljsida för ett team. Överst kapaciteten i perioden, sedan medlemmarna och var
   * kompetensen finns. Syfte, ledare, domäner, system och avdrag står i högerspalten.
   */
  function detail(t, ctx) {
    var e = ctx.e;
    var tc = e.teamCapacity(t.id, ctx.period);
    var nx = e.teamCapacity(t.id, ctx.next);
    var lead = t.leadId ? e.get('workers', t.leadId) : null;
    var dd = e.teamDeliveryDomain(t.id);
    var bd = e.teamPrimaryDomain(t.id, 'business');
    var it = e.teamPrimaryDomain(t.id, 'it');
    var supportive = e.teamDomains(t.id).filter(function (x) { return x.relationship === 'supportive'; });
    var scaled = tc.members.filter(function (m) { return m.scaled; });

    var h = UI.pageHead({
      crumbs: C.link('teams', 'Team') + '<span>›</span><span>' + esc(t.name) + '</span>',
      title: esc(t.name) + ' ' + UI.statusFlag(t.status),
      meta: [C.categoryLabel(t.category) + ' team', dd ? esc(dd.name) : '', bd ? esc(bd.name) : ''],
      sub: esc(t.description || ''),
      actions: UI.btn('Redigera', 'team-edit', { data: { id: t.id } }) + UI.btn('Ta bort', 'team-delete', { cls: 'btn-danger', data: { id: t.id } })
    });

    if (scaled.length) {
      h += '<div class="note warn"><strong>' + (scaled.length === 1 ? esc(scaled[0].worker.name) + ' är överallokerad.' : scaled.length + ' medlemmar är överallokerade.') + '</strong> ' +
        'Deras tid i teamet räknas ned så att kapaciteten inte blir större än den tid som finns.</div>';
    }
    if (!lead) h += '<div class="note warn"><strong>Teamet saknar teamledare.</strong> Välj en under Redigera.</div>';

    var diff = nx.capacity - tc.capacity;
    h += UI.facts([
      { label: 'Kapacitet i ' + ctx.period.inText, value: U.fmtH(tc.capacity), note: U.plural(tc.headcount, 'medlem', 'medlemmar') + ', efter avdrag' },
      { label: 'Beläggning', value: U.fmtPct(tc.loadPct), note: U.fmtH(tc.loaded) + ' är planerat', tone: tc.loadPct > 100.5 ? 'crit' : tc.loadPct >= 90 ? 'warn' : null },
      { label: 'Ledigt', value: U.fmtH(tc.free), note: 'Kan planeras i ' + ctx.period.inText },
      { label: ctx.next.label, value: U.fmtH(nx.capacity), note: U.fmtSigned(diff, ' h') + ' mot ' + ctx.period.inText }
    ]);

    var main = '<section class="card"><div class="card-head"><div><div class="card-title">Medlemmar</div>' +
      '<div class="card-sub">Allokering är hur stor del av sin tid personen ger teamet. Belastning är hur mycket av den tiden som är planerad.</div></div>' +
      UI.btn('Lägg till medlem', 'member-add', { cls: 'btn-sm', data: { id: t.id } }) + '</div>';
    main += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Namn och roll</th><th class="num">Allokering</th>' +
      '<th class="num">Kapacitet</th><th>Belastning</th><th data-opt="1">Allokering totalt</th><th data-opt="2">Primära kompetenser</th><th class="actions"><span class="sr-only">Åtgärder</span></th></tr></thead><tbody>';
    tc.members.sort(function (a, b) { return b.tw.allocation - a.tw.allocation || U.byName(a.worker, b.worker); }).forEach(function (m) {
      var who = [m.tw.role, m.worker.consultant ? 'Konsult' : m.worker.type === 'ai' ? 'AI' : ''].filter(Boolean).join(' · ');
      main += '<tr><td>' + C.workerRef(m.worker, who) + '</td>' +
        '<td class="num">' + U.fmtPct(m.tw.allocation) + '</td><td class="num"' + (m.scaled ? ' title="Minskad eftersom arbetaren är överallokerad"' : '') + '>' + U.fmtH(m.capacity) + (m.scaled ? ' <span class="badge badge-crit">minskad</span>' : '') + '</td>' +
        '<td>' + UI.bar(m.loadPct) + '</td><td>' + UI.bar(m.workerCap.allocationPct, { warnAt: 1000, soft: true, title: 'Allokering över alla team och domänroller' }) + '</td>' +
        '<td class="small">' + m.competences.map(C.compRef).join(', ') + '</td>' +
        '<td class="actions">' + UI.iconBtn('edit', 'member-edit', { id: m.tw.id }, 'Ändra ' + m.worker.name) + '</td></tr>';
    });
    if (!tc.members.length) main += '<tr><td colspan="7"><div class="empty">Teamet har inga medlemmar ännu.</div></td></tr>';
    main += '</tbody></table></div></section>';

    var compMode = OOS.segVal('team-comp', 'category');
    var rows = compMode === 'category' ? tc.byCategory : tc.byCompetence;
    main += '<section class="card"><div class="card-head"><div><div class="card-title">Kapacitet per ' + (compMode === 'category' ? 'kompetensområde' : 'kompetens') + '</div><div class="card-sub">Fördelad på varje medlems primära kompetenser, ' + esc(ctx.period.inText) + '.</div></div>' +
      UI.seg('team-comp', [{ key: 'category', label: 'Område' }, { key: 'competence', label: 'Kompetens' }], compMode) + '</div>';
    main += '<div class="table-wrap"><table class="tbl"><thead><tr><th>' + (compMode === 'category' ? 'Kompetensområde' : 'Kompetens') + '</th><th class="num">Kapacitet</th><th class="num" data-opt="1">Planerat</th><th>Beläggning</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      main += '<tr><td>' + (compMode === 'category' ? esc(r.name) : C.compRef(r.competence)) + '</td><td class="num">' + U.fmtH(r.capacity) + '</td><td class="num">' + U.fmtH(r.loaded) + '</td><td>' + UI.bar(r.loadPct) + '</td></tr>';
    });
    if (!rows.length) main += '<tr><td colspan="4"><div class="empty">Ingen kapacitet i perioden.</div></td></tr>';
    main += '</tbody></table></div></section>';

    /* Högerspalten */
    var aside = UI.asideBlock('Syfte', '<p class="aside-text">' + esc(t.purpose || 'Inget syfte angivet.') + '</p>');
    aside += UI.asideBlock('Teamledare', lead ? C.workerRef(lead, lead.title) : '<div>' + UI.badge('Ej utsedd', 'warn') + '</div>');
    aside += UI.asideBlock('Tillhör', UI.props([
      ['Leveransdomän', C.ddRef(dd)],
      ['Verksamhetsdomän', bd ? C.domainRef(bd) : UI.badge('Saknas', 'warn')],
      ['IT-domän', it ? C.domainRef(it) : UI.badge('Saknas', 'warn')]
    ]));

    var sup = '<div class="aside-list">';
    supportive.forEach(function (x) {
      sup += '<div class="list-item"><div class="grow">' + C.domainRef(x.domain) + '<div class="muted small">' + (x.domain.type === 'it' ? 'IT-domän' : 'Verksamhetsdomän') + '</div></div>' +
        UI.iconBtn('x', 'link-remove', { coll: 'teamDomains', id: x.link.id, msg: x.domain.name + ' kopplas bort från ' + t.name + '.' }, 'Koppla bort ' + x.domain.name, 'danger') + '</div>';
    });
    if (!supportive.length) sup += '<span class="muted small">Inga stödjande domäner.</span>';
    aside += UI.asideBlock('Stödjande domäner', sup + '</div>', UI.iconBtn('plus', 'team-domain-add', { id: t.id }, 'Koppla domän'));

    var sys = e.teamSystems(t.id);
    var sl = '<div class="aside-list">';
    sys.forEach(function (x) {
      sl += '<div class="list-item"><div class="grow">' + C.link('systems:' + x.system.id, x.system.name) + '<div class="muted small">' + (x.link.objective === 'owner' ? 'Ansvarar' : 'Bidrar') + '</div></div>' +
        UI.iconBtn('x', 'link-remove', { coll: 'teamSystems', id: x.link.id, msg: x.system.name + ' kopplas bort från ' + t.name + '.' }, 'Koppla bort ' + x.system.name, 'danger') + '</div>';
    });
    if (!sys.length) sl += '<span class="muted small">Inga system kopplade.</span>';
    aside += UI.asideBlock('System och tjänster', sl + '</div>', UI.iconBtn('plus', 'team-system-add', { id: t.id }, 'Koppla system'));

    var reds = S.db.teamReductions.filter(function (r) { return r.teamId === t.id; }).sort(function (a, b) { return a.from.localeCompare(b.from); });
    var rl = '<div class="aside-list">';
    reds.forEach(function (r) {
      var state = reductionState(r, ctx.period);
      rl += '<div class="list-item' + (state === 'Avslutat' ? ' is-past' : '') + '"><div class="grow">' + esc(r.type) + ' ' + U.fmtPct(r.percent) +
        '<div class="muted small">' + U.fmtDate(r.from) + ' – ' + U.fmtDate(r.to) + ' · ' + state + '</div>' + (r.comment ? '<div class="muted small">' + esc(r.comment) + '</div>' : '') + '</div>' +
        UI.iconBtn('edit', 'reduction-edit', { id: r.id }, 'Ändra avdrag') + '</div>';
    });
    if (!reds.length) rl += '<span class="muted small">Inga särskilda avdrag.</span>';
    aside += UI.asideBlock('Särskilda avdrag', rl + '</div>', UI.iconBtn('plus', 'reduction-add', { team: t.id }, 'Lägg till avdrag'));

    h += UI.detailLayout(main, aside);
    return h;
  }

  OOS.teamReductionState = reductionState;

  OOS.views.teams = function (ctx) {
    var t = ctx.id ? ctx.e.get('teams', ctx.id) : null;
    return t ? detail(t, ctx) : list(ctx);
  };

  var A = OOS.actions;
  A['team-add'] = function () { C.forms.team(null); };
  A['team-edit'] = function (el) { C.forms.team(S.engine().get('teams', el.dataset.id)); };
  A['team-delete'] = function (el) { C.removeEntity('teams', el.dataset.id, 'teams'); };
  A['team-domain-add'] = function (el) { C.forms.teamDomain(el.dataset.id); };
  A['team-system-add'] = function (el) { C.forms.teamSystem(el.dataset.id); };
  A['member-add'] = function (el) { C.forms.teamMember(el.dataset.id, null); };
  A['member-edit'] = function (el) {
    var tw = S.engine().get('teamWorkers', el.dataset.id);
    C.forms.teamMember(tw.teamId, tw);
  };
  A['reduction-add'] = function (el) { C.forms.teamReduction(null, el.dataset.team); };
  A['reduction-edit'] = function (el) { C.forms.teamReduction(S.engine().get('teamReductions', el.dataset.id)); };
})();
