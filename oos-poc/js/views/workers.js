/* Arbetare: översikt med filter och detaljvy med kompetenser, team, domänroller och kapacitet. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  var FILTERS = [
    { key: 'all', label: 'Alla' },
    { key: 'team', label: 'I team' },
    { key: 'cloud', label: 'Domänroller' },
    { key: 'over', label: 'Överallokerade' },
    { key: 'free', label: 'Ej allokerade' },
    { key: 'ai', label: 'AI' }
  ];

  function list(ctx) {
    var e = ctx.e;
    var rows = S.db.workers.map(function (w) {
      var wc = e.workerCapacity(w.id, ctx.period);
      var pd = e.workerPrimaryDomains(w.id);
      var comps = e.workerCompetences(w.id);
      return { id: w.id, w: w, wc: wc, pd: pd, main: comps[0] ? comps[0].competence : null, roles: e.workerDomainRoles(w.id) };
    });
    var filter = OOS.segVal('workers-filter', 'all');
    var shown = rows.filter(function (r) {
      if (filter === 'team') return r.wc.teams.length > 0;
      if (filter === 'cloud') return r.roles.length > 0;
      if (filter === 'over') return r.wc.allocationPct > 100.5;
      if (filter === 'free') return r.wc.committed === 0;
      if (filter === 'ai') return r.w.type === 'ai';
      return true;
    });
    var inTeams = rows.filter(function (r) { return r.wc.teams.length; }).length;
    var inClouds = rows.filter(function (r) { return r.roles.length; }).length;
    var over = rows.filter(function (r) { return r.wc.allocationPct > 100.5; }).length;
    var ai = rows.filter(function (r) { return r.w.type === 'ai'; }).length;
    var h = UI.pageHead({
      title: 'Arbetare',
      sub: 'Arbetare är de personer eller AI-resurser som bidrar med kompetens och kapacitet i ett eller flera team och domäner.',
      actions: UI.btn('Lägg till arbetare', 'worker-add', { cls: 'btn-primary', icon: 'plus' })
    });
    h += '<div class="kpis">' +
      UI.kpi('users', 'Totalt antal arbetare', rows.length, ai + ' AI, ' + rows.filter(function (r) { return r.w.consultant; }).length + ' konsulter') +
      UI.kpi('user', 'Arbetare i team', inTeams) +
      UI.kpi('cloud', 'Arbetare med domänroll', inClouds, 'Domänmoln och nyckelroller') +
      UI.kpi('alert', 'Överallokerade', over, over ? 'Mer än 100 % av tillgänglig tid' : 'Ingen över 100 %') +
      '</div>';
    h += '<section class="card">' + UI.table({
      id: 'tbl-workers',
      rows: shown,
      title: UI.seg('workers-filter', FILTERS, filter),
      search: { placeholder: 'Sök arbetare, roll eller kompetens …', text: function (r) { return r.w.name + ' ' + (r.w.title || '') + ' ' + (r.main ? r.main.name : '') + ' ' + (r.pd.team ? r.pd.team.name : ''); } },
      rowGo: function (r) { return 'workers:' + r.id; },
      defaultSort: 'name',
      noun: 'arbetare',
      columns: [
        {
          key: 'name', label: 'Namn', sort: function (r) { return r.w.name; },
          render: function (r) {
            var sub = (r.w.title || '') + (r.w.type === 'ai' ? ' · AI' : r.w.consultant ? ' · Konsult' : '');
            return '<span class="name-cell">' + UI.avatar(r.w.name, r.id, { round: true, text: r.w.type === 'ai' ? 'AI' : null }) + '<span><span class="name">' + esc(r.w.name) + '</span><br><span class="sub">' + esc(sub) + '</span></span></span>';
          }
        },
        { key: 'dd', label: 'Leveransdomän', sort: function (r) { return r.pd.deliveryDomain ? r.pd.deliveryDomain.name : 'ö'; }, render: function (r) { return r.pd.deliveryDomain ? esc(r.pd.deliveryDomain.name) : '<span class="muted">–</span>'; } },
        { key: 'team', label: 'Team', sort: function (r) { return r.pd.team ? r.pd.team.name : 'ö'; }, render: function (r) { return r.pd.team ? esc(r.pd.team.name) + (r.wc.teams.length > 1 ? ' <span class="muted small">+' + (r.wc.teams.length - 1) + '</span>' : '') : r.roles.length ? '<span class="muted">Domänroll</span>' : '<span class="muted">–</span>'; } },
        { key: 'comp', label: 'Huvudkompetens', sort: function (r) { return r.main ? r.main.name : 'ö'; }, render: function (r) { return r.main ? esc(r.main.name) : '<span class="muted">–</span>'; } },
        { key: 'base', label: 'Grundkap./v', cls: 'num', sort: function (r) { return r.w.baseHoursPerWeek; }, render: function (r) { return U.fmtH(r.w.baseHoursPerWeek); } },
        { key: 'alloc', label: 'Allokering', sort: function (r) { return r.wc.allocationPct; }, render: function (r) { return UI.bar(r.wc.allocationPct, { warnAt: 1000 }); } },
        { key: 'load', label: 'Belastning (period)', sort: function (r) { return r.wc.loadPct; }, render: function (r) { return UI.bar(r.wc.loadPct); } }
      ]
    }) + '</section>';
    return h;
  }

  function detail(w, ctx) {
    var e = ctx.e;
    var wc = e.workerCapacity(w.id, ctx.period);
    var pd = e.workerPrimaryDomains(w.id);
    var comps = e.workerCompetences(w.id);
    var roles = e.workerDomainRoles(w.id);
    var h = UI.pageHead({
      crumbs: C.link('workers', 'Arbetare') + '<span>›</span><span>' + esc(w.name) + '</span>',
      title: esc(w.name) + ' ' + UI.statusBadge(w.status) + (w.type === 'ai' ? ' ' + UI.badge('AI', 'info', 'sparkle') : ''),
      sub: esc(w.description || ''),
      actions: UI.btn('Tillbaka', 'back', { icon: 'arrowLeft', data: { to: 'workers' } }) + UI.btn('Redigera', 'worker-edit', { cls: 'btn-primary', icon: 'edit', data: { id: w.id } }) + UI.btn('Ta bort', 'worker-delete', { cls: 'btn-danger', icon: 'trash', data: { id: w.id } })
    });

    if (wc.allocationPct > 100.5) {
      h += '<div class="note warn">' + UI.icon('alert') + '<div><strong>' + esc(w.name) + ' är allokerad till ' + U.fmtPct(wc.allocationPct) + '.</strong> Team och domänroller kräver ' + U.fmtH(wc.committed) + ' men tillgänglig kapacitet är ' + U.fmtH(wc.available) + ' i perioden. Minska allokeringen i något team eller korta en domänroll.</div></div>';
    }

    h += '<div class="grid-3">';
    h += '<section class="card"><div class="card-head"><div class="card-title">' + UI.icon('user') + 'Grundinformation</div></div><div class="card-body"><dl class="kv">' +
      '<dt>Namn</dt><dd>' + esc(w.name) + '</dd>' +
      '<dt>Typ</dt><dd>' + (w.type === 'ai' ? 'AI' : 'Människa') + '</dd>' +
      '<dt>Anställningsform</dt><dd>' + (w.type === 'ai' ? '–' : w.consultant ? 'Konsult' : 'Anställd') + '</dd>' +
      '<dt>Roll</dt><dd>' + esc(w.title || '–') + '</dd>' +
      '<dt>Beskrivning</dt><dd>' + esc(w.description || '–') + '</dd></dl></div></section>';

    h += '<section class="card"><div class="card-head"><div class="card-title">' + UI.icon('box') + 'Domäner</div>' + UI.iconBtn('plus', 'worker-role-add', { id: w.id }, 'Lägg till domänroll') + '</div><div class="card-body stack">' +
      '<dl class="kv"><dt>Primär leveransdomän</dt><dd>' + C.ddRef(pd.deliveryDomain) + '</dd><dt>Verksamhetsdomän</dt><dd>' + C.domainRef(pd.business) + '</dd><dt>IT-domän</dt><dd>' + C.domainRef(pd.it) + '</dd></dl>' +
      '<div class="stack" style="gap:4px"><span class="label">Domänroller</span>';
    if (!roles.length) h += '<span class="muted small">Inga roller i domänmoln eller leveransdomän.</span>';
    roles.forEach(function (r) {
      var hrs = OOSEngine.monthlyHoursInPeriod(r.ext.hoursPerMonth, r.ext.from, r.ext.to, ctx.period);
      h += '<div class="list-item"><div class="grow"><strong>' + esc(r.ext.role) + '</strong> i ' + (r.kind === 'delivery' ? C.ddRef(r.target) : C.domainRef(r.target)) +
        '<div class="muted small">' + r.ext.hoursPerMonth + ' h/mån · ' + U.fmtH(hrs) + ' i perioden · ' + U.fmtDate(r.ext.from) + ' – ' + U.fmtDate(r.ext.to) + '</div></div>' +
        UI.iconBtn('edit', 'expert-edit', { kind: r.kind, id: r.ext.id }, 'Ändra') + '</div>';
    });
    h += '</div></div></section>';

    h += '<section class="card"><div class="card-head"><div class="card-title">' + UI.icon('badge') + 'Kompetenser</div>' + UI.btn('Lägg till', 'wc-add', { cls: 'btn-sm', icon: 'plus', data: { id: w.id } }) + '</div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Kompetens</th><th>Nivå</th><th>Vikt</th><th class="actions"></th></tr></thead><tbody>';
    comps.forEach(function (x) {
      h += '<tr><td>' + C.compRef(x.competence) + '</td><td>' + UI.level(x.wc.level) + '<br><span class="small muted">' + UI.LEVELS[x.wc.level] + '</span></td><td>' + (x.wc.weight === 'primary' ? UI.badge('Primär', 'accent') : '<span class="muted small">Sekundär</span>') + '</td><td class="actions">' + UI.iconBtn('edit', 'wc-edit', { id: x.wc.id }, 'Ändra') + '</td></tr>';
    });
    if (!comps.length) h += '<tr><td colspan="4"><div class="empty">Inga kompetenser registrerade.</div></td></tr>';
    h += '</tbody></table></div></section>';
    h += '</div>';

    h += '<div class="grid-3">';
    h += '<section class="card"><div class="card-head"><div class="card-title">' + UI.icon('clock') + 'Kapacitet <span class="card-sub">(' + esc(ctx.period.label.toLowerCase()) + ', ' + ctx.period.workdays + ' arbetsdagar)</span></div></div><div class="card-body stack">' +
      '<div class="formula">' +
      '<div class="step"><span>Grundkapacitet</span><span>' + U.fmtH(wc.baseWeek) + ' / vecka</span></div>' +
      '<div class="step"><span>Grundavdrag' + (w.type === 'ai' ? ' (gäller ej AI)' : '') + '</span><span>− ' + U.fmtNum(U.round(wc.overheadWeek, 1)) + ' h / vecka</span></div>' +
      '<div class="step"><span>Tillgänglig per vecka</span><span>' + U.fmtNum(U.round(wc.availableWeek, 1)) + ' h</span></div>' +
      '<div class="step"><span>Tillgänglig kapacitet i perioden</span><span>' + U.fmtH(wc.available) + '</span></div></div>' +
      '<div class="field-block"><span class="label">Allokering</span>' + UI.bar(wc.allocationPct, { warnAt: 1000 }) + '<span class="muted small">' + U.fmtH(wc.teamHours) + ' i team, ' + U.fmtH(wc.domainHours) + ' i domänroller, ' + U.fmtH(wc.unallocated) + ' oallokerat</span></div>' +
      '<div class="field-block"><span class="label">Belastning</span>' + UI.bar(wc.loadPct) + '</div>' +
      '<dl class="kv"><dt>Kostnad per timme</dt><dd>' + U.fmtNum(w.costPerHour) + ' kr</dd></dl>' +
      '<div class="note">' + UI.icon('info') + '<span>Tillgänglig kapacitet är grundkapacitet minus grundavdrag (semester, kompetensutveckling, interna möten och administration).</span></div>' +
      '</div></section>';

    h += '<section class="card"><div class="card-head"><div class="card-title">' + UI.icon('users') + 'Team</div>' + UI.btn('Lägg till i team', 'worker-team-add', { cls: 'btn-sm', icon: 'plus', data: { id: w.id } }) + '</div>';
    h += '<div class="card-body"><div class="list">';
    wc.teams.forEach(function (t) {
      h += '<div class="list-item"><div class="grow">' + C.teamRef(t.team) + '<div class="muted small">' + esc(t.tw.role) + ' · ' + U.fmtH(t.hours) + ' i perioden</div></div>' +
        '<strong class="num">' + U.fmtPct(t.tw.allocation) + '</strong>' + UI.iconBtn('edit', 'member-edit', { id: t.tw.id }, 'Ändra') + '</div>';
    });
    if (!wc.teams.length) h += '<div class="empty">Ingår inte i något team.</div>';
    h += '</div></div></section>';

    var costPeriod = wc.committed * (w.costPerHour || 0);
    h += '<section class="card"><div class="card-head"><div class="card-title">' + UI.icon('chart') + 'Sammanfattning</div></div><div class="card-body"><dl class="kv">' +
      '<dt>Antal team</dt><dd>' + wc.teams.length + '</dd>' +
      '<dt>Antal domänroller</dt><dd>' + roles.length + '</dd>' +
      '<dt>Total allokering</dt><dd>' + U.fmtPct(wc.allocationPct) + '</dd>' +
      '<dt>Tillgänglig kapacitet</dt><dd>' + U.fmtH(wc.available) + '</dd>' +
      '<dt>Belastning</dt><dd>' + U.fmtPct(wc.loadPct) + '</dd>' +
      '<dt>Allokerad kostnad</dt><dd>' + U.fmtNum(costPeriod) + ' kr</dd>' +
      '<dt>Antal kompetenser</dt><dd>' + comps.length + '</dd>' +
      '<dt>Primär verksamhetsdomän</dt><dd>' + (pd.business ? esc(pd.business.name) : '–') + '</dd>' +
      '<dt>Primär IT-domän</dt><dd>' + (pd.it ? esc(pd.it.name) : '–') + '</dd></dl></div></section>';
    h += '</div>';
    return h;
  }

  OOS.views.workers = function (ctx) {
    var w = ctx.id ? ctx.e.get('workers', ctx.id) : null;
    return w ? detail(w, ctx) : list(ctx);
  };

  var A = OOS.actions;
  A['worker-add'] = function () { C.forms.worker(null); };
  A['worker-edit'] = function (el) { C.forms.worker(S.engine().get('workers', el.dataset.id)); };
  A['worker-delete'] = function (el) { C.removeEntity('workers', el.dataset.id, 'workers'); };
  A['worker-team-add'] = function (el) { C.forms.workerTeam(el.dataset.id); };
  A['worker-role-add'] = function (el) {
    var id = el.dataset.id;
    UI.openForm({
      title: 'Lägg till domänroll',
      values: { kind: 'domain' },
      fields: [{ key: 'kind', label: 'Var ska rollen ligga?', type: 'select', full: true, options: [{ value: 'domain', label: 'I en verksamhets- eller IT-domän (domänmoln)' }, { value: 'delivery', label: 'I en leveransdomän (nyckelroll)' }] }],
      submitLabel: 'Fortsätt',
      onSubmit: function (v) { C.forms.expert(v.kind, null, null, id); }
    });
  };
  A['wc-add'] = function (el) { C.forms.workerCompetence(el.dataset.id, null); };
  A['wc-edit'] = function (el) {
    var wc = S.engine().get('workerCompetences', el.dataset.id);
    C.forms.workerCompetence(wc.workerId, wc);
  };
})();
