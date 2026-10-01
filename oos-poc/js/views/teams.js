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
      search: { placeholder: 'Sök team …', text: function (r) { return r.team.name + ' ' + (r.dd ? r.dd.name : '') + ' ' + (r.bd ? r.bd.name : '') + ' ' + (r.it ? r.it.name : ''); } },
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

  function detail(t, ctx) {
    var e = ctx.e;
    var tc = e.teamCapacity(t.id, ctx.period);
    var nx = e.teamCapacity(t.id, ctx.next);
    var lead = t.leadId ? e.get('workers', t.leadId) : null;
    var dd = e.teamDeliveryDomain(t.id);
    var bd = e.teamPrimaryDomain(t.id, 'business');
    var it = e.teamPrimaryDomain(t.id, 'it');
    var supportive = e.teamDomains(t.id).filter(function (x) { return x.relationship === 'supportive'; });
    var h = UI.pageHead({
      crumbs: C.link('teams', 'Team') + '<span>›</span><span>' + esc(t.name) + '</span>',
      title: esc(t.name) + ' ' + UI.statusFlag(t.status),
      sub: esc(t.description || ''),
      actions: UI.btn('Redigera', 'team-edit', { data: { id: t.id } }) + UI.btn('Ta bort', 'team-delete', { cls: 'btn-danger', data: { id: t.id } })
    });

    h += '<div class="grid-4 facts">';
    h += '<section class="stack"><div class="label">Syfte</div><p>' + esc(t.purpose || 'Inget syfte angivet.') + '</p></section>';
    h += '<section class="stack"><div class="label">Teamledare</div>' +
      (lead ? C.workerRef(lead, lead.title) : '<div>' + UI.badge('Ej utsedd', 'warn') + '</div><p class="muted small">Välj teamledare under Redigera.</p>') + '</section>';
    h += '<section class="stack"><div class="label">Tillhör</div><div class="stack-tight">' +
      '<div class="field-block"><span class="label">Leveransdomän</span>' + C.ddRef(dd) + '</div>' +
      '<div class="field-block"><span class="label">Verksamhetsdomän (primär)</span>' + (bd ? C.domainRef(bd) : UI.badge('Saknas', 'warn')) + '</div>' +
      '<div class="field-block"><span class="label">IT-domän (primär)</span>' + (it ? C.domainRef(it) : UI.badge('Saknas', 'warn')) + '</div></div></section>';
    h += '<section class="stack"><div class="row-between nowrap"><div class="label">Relaterade domäner</div>' + UI.iconBtn('plus', 'team-domain-add', { id: t.id }, 'Koppla domän') + '</div>';
    ['business', 'it'].forEach(function (type) {
      var items = supportive.filter(function (x) { return x.domain.type === type; });
      h += '<div class="field-block"><span class="label">' + (type === 'it' ? 'IT-domäner' : 'Verksamhetsdomäner') + '</span>';
      if (!items.length) h += '<span class="muted small">Inga</span>';
      items.forEach(function (x) {
        h += '<div class="list-item" style="padding:4px 0;border:0"><div class="grow">' + C.domainRef(x.domain) + '</div>' + UI.iconBtn('x', 'link-remove', { coll: 'teamDomains', id: x.link.id, msg: x.domain.name + ' kopplas bort från ' + t.name + '.' }, 'Koppla bort', 'danger') + '</div>';
      });
      h += '</div>';
    });
    h += '</section></div>';

    var sys = e.teamSystems(t.id);
    h += '<section class="card"><div class="card-head"><div class="card-title">System och tjänster</div><div class="chips">';
    sys.forEach(function (x) {
      /* Namnet och borttagningen är två separata knappar, så att de inte hamnar i varandra. */
      h += '<span class="chip">' + C.link('systems:' + x.system.id, x.system.name) + (x.link.objective === 'owner' ? ' <span class="owner">ansvar</span>' : '') +
        '<button type="button" class="btn-icon x" style="width:20px;height:20px" data-action="link-remove" data-coll="teamSystems" data-id="' + esc(x.link.id) + '" data-msg="' + esc(x.system.name + ' kopplas bort från ' + t.name + '.') + '" aria-label="Koppla bort ' + esc(x.system.name) + '">' + UI.icon('x') + '</button></span>';
    });
    h += UI.btn('Lägg till system', 'team-system-add', { cls: 'btn-sm', data: { id: t.id } }) + '</div></div></section>';

    h += '<section class="card"><div class="card-head"><div><div class="card-title">Teammedlemmar (' + tc.headcount + ')</div>' +
      '<div class="card-sub">Allokering är andel av arbetarens tid. Belastning är hur mycket av den tiden som är planerad.</div></div>' +
      UI.btn('Lägg till medlem', 'member-add', { cls: 'btn-sm', data: { id: t.id } }) + '</div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Namn</th><th data-opt="1">Roll i teamet</th><th data-opt="2">Primära kompetenser</th><th class="num">Allokering i teamet</th>' +
      '<th class="num">Tillgänglig kapacitet<br><span class="muted small">(denna period)</span></th><th>Belastning<br><span class="muted small">(denna period)</span></th><th data-opt="1">Total allokering<br><span class="muted small">(alla team och roller)</span></th><th class="actions"><span class="sr-only">Åtgärder</span></th></tr></thead><tbody>';
    tc.members.sort(function (a, b) { return b.tw.allocation - a.tw.allocation || U.byName(a.worker, b.worker); }).forEach(function (m) {
      h += '<tr><td>' + C.workerRef(m.worker, m.worker.consultant ? 'Konsult' : m.worker.type === 'ai' ? 'AI' : '') + '</td><td>' + esc(m.tw.role) + '</td>' +
        '<td class="small">' + m.competences.map(C.compRef).join(', ') + '</td><td class="num">' + U.fmtPct(m.tw.allocation) + '</td><td class="num"' + (m.scaled ? ' title="Minskad eftersom arbetaren är överallokerad"' : '') + '>' + U.fmtH(m.capacity) + (m.scaled ? ' <span class="badge badge-crit">minskad</span>' : '') + '</td>' +
        '<td>' + UI.bar(m.loadPct) + '</td><td>' + UI.bar(m.workerCap.allocationPct, { warnAt: 1000, soft: true, title: 'Allokering över alla team och domänroller' }) + '</td>' +
        '<td class="actions">' + UI.iconBtn('edit', 'member-edit', { id: m.tw.id }, 'Ändra') + '</td></tr>';
    });
    if (!tc.members.length) h += '<tr><td colspan="8"><div class="empty">Teamet har inga medlemmar ännu.</div></td></tr>';
    h += '</tbody></table></div></section>';

    var compMode = OOS.segVal('team-comp', 'category');
    var rows = compMode === 'category' ? tc.byCategory : tc.byCompetence;
    h += '<div class="split"><section class="card"><div class="card-head"><div><div class="card-title">Kapacitet per ' + (compMode === 'category' ? 'kompetensområde' : 'kompetens') + '</div><div class="card-sub">' + esc(ctx.period.label) + '</div></div>' +
      UI.seg('team-comp', [{ key: 'category', label: 'Område' }, { key: 'competence', label: 'Kompetens' }], compMode) + '</div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>' + (compMode === 'category' ? 'Kompetensområde' : 'Kompetens') + '</th><th class="num">Tillgänglig kapacitet</th><th class="num" data-opt="1">Belastning</th><th>Beläggningsgrad</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td>' + (compMode === 'category' ? esc(r.name) : C.compRef(r.competence)) + '</td><td class="num">' + U.fmtH(r.capacity) + '</td><td class="num">' + U.fmtH(r.loaded) + '</td><td>' + UI.bar(r.loadPct) + '</td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="4"><div class="empty">Ingen kapacitet i perioden.</div></td></tr>';
    h += '</tbody></table></div><div class="card-body"><p class="muted small">Kapaciteten fördelas på varje medlems primära kompetenser.</p></div></section>';

    h += '<section class="card"><div class="card-head"><div><div class="card-title">Total kapacitet och belastning</div><div class="card-sub">' + esc(ctx.period.label) + '</div></div></div><div class="card-body stack">';
    h += '<div class="donut-wrap">' + UI.donut(tc.loadPct, { label: 'Beläggningsgrad ' + U.fmtPct(tc.loadPct) }) +
      '<div class="legend"><div class="legend-row"><span class="sw loaded"></span><span>Belastad kapacitet</span><strong class="num">' + U.fmtH(tc.loaded) + '</strong></div>' +
      '<div class="legend-row"><span class="sw free"></span><span>Ledig kapacitet</span><strong class="num">' + U.fmtH(tc.free) + '</strong></div>' +
      '<div class="legend-row"><span></span><span>Total kapacitet</span><strong class="num">' + U.fmtH(tc.capacity) + '</strong></div></div></div>';
    h += '<dl class="kv"><dt>Antal teammedlemmar</dt><dd>' + tc.headcount + '</dd><dt>Genomsnittlig allokering</dt><dd>' + U.fmtPct(tc.avgAllocation) + '</dd>' +
      '<dt>' + esc(ctx.next.label) + '</dt><dd>' + U.fmtH(nx.capacity) + ' <span class="muted">(' + U.fmtSigned(nx.capacity - tc.capacity, ' h') + ')</span></dd></dl>';
    var reds = S.db.teamReductions.filter(function (r) { return r.teamId === t.id; });
    h += '<div class="stack" style="gap:6px"><div class="row-between"><span class="label">Särskilda avdrag</span>' + UI.btn('Lägg till', 'reduction-add', { cls: 'btn-sm', data: { team: t.id } }) + '</div>';
    if (!reds.length) h += '<span class="muted small">Inga avdrag registrerade.</span>';
    reds.forEach(function (r) {
      var active = tc.reduction.active.some(function (a) { return a.reduction.id === r.id; });
      h += '<div class="list-item"><div class="grow"><strong>' + esc(r.type) + ' ' + U.fmtPct(r.percent) + '</strong>' + (active ? ' <span class="muted small">· gäller i perioden</span>' : '') +
        '<div class="muted small">' + U.fmtDate(r.from) + ' – ' + U.fmtDate(r.to) + (r.comment ? ' · ' + esc(r.comment) : '') + '</div></div>' +
        UI.iconBtn('edit', 'reduction-edit', { id: r.id }, 'Ändra') + '</div>';
    });
    h += '</div></div></section></div>';
    return h;
  }

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
