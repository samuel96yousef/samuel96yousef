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
      actions: UI.btn('Lägg till arbetare', 'worker-add', { cls: 'btn-primary' })
    });
    h += '<div class="kpis">' +
      UI.kpi('Arbetare', rows.length, ai + ' AI, ' + U.plural(rows.filter(function (r) { return r.w.consultant; }).length, 'konsult', 'konsulter')) +
      UI.kpi('I team', inTeams, U.plural(rows.length - inTeams, 'arbetare', 'arbetare') + ' utan team') +
      UI.kpi('Med domänroll', inClouds, 'Domänmoln och nyckelroller') +
      UI.kpi('Överallokerade', over, over ? 'Mer än 100 % av tillgänglig tid' : 'Ingen över 100 %') +
      '</div>';
    h += '<section class="card">' + UI.table({
      id: 'tbl-workers',
      rows: shown,
      title: UI.seg('workers-filter', FILTERS, filter),
      /* Utöver kolumnerna: alla kompetenser, alla team, domänroller, beskrivning och anställningsform. */
      search: {
        placeholder: 'Sök namn, roll, kompetens …',
        text: function (r) {
          return [r.w.description, r.w.consultant ? 'konsult' : 'anställd', r.w.type === 'ai' ? 'AI' : '']
            .concat(ctx.e.workerCompetences(r.id).map(function (x) { return x.competence.name + ' ' + x.competence.category; }))
            .concat(r.wc.teams.map(function (t) { return t.team.name + ' ' + (t.tw.role || ''); }))
            .concat(r.roles.map(function (x) { return x.ext.role + ' ' + x.target.name; }))
            .join(' ');
        }
      },
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
        { key: 'dd', label: 'Leveransdomän', opt: 2, sort: function (r) { return r.pd.deliveryDomain ? r.pd.deliveryDomain.name : 'ö'; }, render: function (r) { return r.pd.deliveryDomain ? esc(r.pd.deliveryDomain.name) : '<span class="muted">–</span>'; } },
        { key: 'team', label: 'Team', sort: function (r) { return r.pd.team ? r.pd.team.name : 'ö'; }, render: function (r) { return r.pd.team ? esc(r.pd.team.name) + (r.wc.teams.length > 1 ? ' <span class="muted small">+' + (r.wc.teams.length - 1) + '</span>' : '') : r.roles.length ? '<span class="muted">Domänroll</span>' : '<span class="muted">–</span>'; } },
        { key: 'comp', label: 'Primär kompetens', opt: 1, sort: function (r) { return r.main ? r.main.name : 'ö'; }, render: function (r) { return r.main ? esc(r.main.name) : '<span class="muted">–</span>'; } },
        { key: 'base', label: 'Tid i veckan', opt: 2, cls: 'num', sort: function (r) { return r.w.baseHoursPerWeek; }, render: function (r) { return U.fmtH(r.w.baseHoursPerWeek); } },
        { key: 'alloc', label: 'Allokering', sort: function (r) { return r.wc.allocationPct; }, render: function (r) { return UI.bar(r.wc.allocationPct, { warnAt: 1000, soft: true }); } },
        { key: 'load', label: 'Beläggning', sort: function (r) { return r.wc.loadPct; }, render: function (r) { return UI.bar(r.wc.loadPct); } }
      ]
    }) + '</section>';
    return h;
  }

  /*
   * Detaljsida för en arbetare. Överst det viktigaste: hur mycket tid personen har och hur
   * mycket som redan är lovat bort. Sedan var tiden går, kompetenserna och till sist uppgifterna.
   */
  function detail(w, ctx) {
    var e = ctx.e;
    var wc = e.workerCapacity(w.id, ctx.period);
    var pd = e.workerPrimaryDomains(w.id);
    var comps = e.workerCompetences(w.id);
    var over = wc.allocationPct > 100.5;
    var isAi = w.type === 'ai';
    var employment = isAi ? 'AI-arbetare' : w.consultant ? 'Konsult' : 'Anställd';

    var h = UI.pageHead({
      crumbs: C.link('workers', 'Arbetare') + '<span>›</span><span>' + esc(w.name) + '</span>',
      title: esc(w.name) + ' ' + UI.statusFlag(w.status),
      meta: [esc(w.title || ''), employment, pd.team ? esc(pd.team.name) : ''],
      sub: esc(w.description || ''),
      actions: UI.btn('Redigera', 'worker-edit', { data: { id: w.id } }) + UI.btn('Ta bort', 'worker-delete', { cls: 'btn-danger', data: { id: w.id } })
    });

    if (over) {
      h += '<div class="note crit"><strong>' + esc(w.name) + ' har lovats bort ' + U.fmtH(wc.committed - wc.available) + ' mer än det finns tid till i ' + esc(ctx.period.inText) + '.</strong> ' +
        'Minska allokeringen i ett team eller korta en domänroll. Till dess räknas alla åtaganden ned i samma proportion.</div>';
    }

    var cost = wc.committed * (w.costPerHour || 0);
    h += UI.facts([
      { label: 'Tillgänglig tid i ' + ctx.period.inText, value: U.fmtH(wc.available), note: U.fmtNum(U.round(wc.availableWeek, 1)) + ' h i veckan efter grundavdrag' },
      { label: 'Allokerat', value: U.fmtH(wc.committed), note: U.fmtPct(wc.allocationPct) + ' av tillgänglig tid', tone: over ? 'crit' : null },
      { label: 'Beläggning', value: U.fmtPct(wc.loadPct), note: U.fmtH(wc.loaded) + ' belastat av tillgänglig tid', tone: wc.loadPct > 100.5 ? 'crit' : wc.loadPct >= 90 ? 'warn' : null },
      w.costPerHour ? { label: 'Kostnad i perioden', value: U.fmtNum(cost) + ' kr', note: U.fmtNum(w.costPerHour) + ' kr per timme' } : null
    ]);

    /* Var tiden går: team och domänroller mot tillgänglig tid. */
    var parts = wc.teams.map(function (t) { return { label: t.team.name, hours: t.hours, kind: 'team' }; })
      .concat(wc.roles.map(function (r) { return { label: r.role.ext.role + ' i ' + r.role.target.name, hours: r.hours, kind: 'role' }; }));
    var main = '<section class="card"><div class="card-head"><div><div class="card-title">Så används tiden</div>' +
      '<div class="card-sub">Team och domänroller i ' + esc(ctx.period.inText) + ' jämfört med den tid som finns.</div></div>' +
      '<div class="row">' + UI.btn('Lägg till i team', 'worker-team-add', { cls: 'btn-sm', data: { id: w.id } }) + UI.btn('Lägg till domänroll', 'worker-role-add', { cls: 'btn-sm', data: { id: w.id } }) + '</div></div>';
    main += UI.budget(parts, wc.available);
    main += '<div class="commit-list">';
    wc.teams.forEach(function (t) {
      main += '<div class="commit"><span class="sw-team" aria-hidden="true"></span><div>' + C.teamRef(t.team) + '<div class="commit-sub">' + esc(t.tw.role || 'Medlem') + ' · ' + U.fmtPct(t.tw.allocation) + ' av tiden</div></div>' +
        '<span class="commit-hours">' + U.fmtH(t.hours) + '</span>' + UI.iconBtn('edit', 'member-edit', { id: t.tw.id }, 'Ändra ' + t.team.name) + '</div>';
    });
    wc.roles.forEach(function (r) {
      var x = r.role;
      main += '<div class="commit"><span class="sw-role" aria-hidden="true"></span><div>' + esc(x.ext.role) + ' i ' + (x.kind === 'delivery' ? C.ddRef(x.target) : C.domainRef(x.target)) +
        '<div class="commit-sub">' + (x.kind === 'delivery' ? 'Nyckelroll' : 'Domänmoln') + ' · ' + x.ext.hoursPerMonth + ' h/mån · ' + U.fmtDate(x.ext.from) + ' – ' + U.fmtDate(x.ext.to) + '</div></div>' +
        '<span class="commit-hours">' + U.fmtH(r.hours) + '</span>' + UI.iconBtn('edit', 'expert-edit', { kind: x.kind, id: x.ext.id }, 'Ändra ' + x.ext.role) + '</div>';
    });
    if (!parts.length) main += '<div class="empty">Inga åtaganden ännu. All tillgänglig tid är oallokerad.</div>';
    if (over) {
      main += '<div class="commit total crit"><span></span><span class="commit-label">Mer än tillgänglig tid</span><span class="commit-hours">' + U.fmtH(wc.committed - wc.available) + '</span><span></span></div>';
    } else {
      main += '<div class="commit total"><span class="sw-free" aria-hidden="true"></span><span class="commit-label">Oallokerat</span><span class="commit-hours">' + U.fmtH(wc.unallocated) + '</span><span></span></div>';
    }
    main += '</div>';
    main += UI.explain('Så räknas den tillgängliga tiden',
      '<div class="formula">' +
      '<div class="step"><span>Grundkapacitet</span><span>' + U.fmtH(wc.baseWeek) + ' i veckan</span></div>' +
      '<div class="step"><span>Grundavdrag' + (isAi ? ' (gäller inte AI)' : ': semester, kompetensutveckling, möten, administration') + '</span><span>− ' + U.fmtNum(U.round(wc.overheadWeek, 1)) + ' h</span></div>' +
      '<div class="step"><span>Tillgänglig per vecka</span><span>' + U.fmtNum(U.round(wc.availableWeek, 1)) + ' h</span></div>' +
      '<div class="step"><span>× ' + ctx.period.workdays + ' arbetsdagar i ' + esc(ctx.period.inText) + ' / 5</span><span>' + U.fmtH(wc.available) + '</span></div></div>');
    main += '</section>';

    main += '<section class="card"><div class="card-head"><div><div class="card-title">Kompetenser</div><div class="card-sub">Kapaciteten räknas på de primära kompetenserna.</div></div>' +
      UI.btn('Lägg till', 'wc-add', { cls: 'btn-sm', data: { id: w.id } }) + '</div>';
    main += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Kompetens</th><th>Nivå</th><th data-opt="1">Vikt</th><th class="actions"><span class="sr-only">Åtgärder</span></th></tr></thead><tbody>';
    comps.sort(function (a, b) { return (a.wc.weight === 'primary' ? 0 : 1) - (b.wc.weight === 'primary' ? 0 : 1) || b.wc.level - a.wc.level; }).forEach(function (x) {
      main += '<tr><td>' + C.compRef(x.competence) + '<div class="muted small">' + esc(x.competence.category) + '</div></td><td><span class="level-cell">' + UI.level(x.wc.level) + '<span>' + UI.LEVELS[x.wc.level] + '</span></span></td>' +
        '<td>' + (x.wc.weight === 'primary' ? 'Primär' : '<span class="muted">Sekundär</span>') + '</td><td class="actions">' + UI.iconBtn('edit', 'wc-edit', { id: x.wc.id }, 'Ändra ' + x.competence.name) + '</td></tr>';
    });
    if (!comps.length) main += '<tr><td colspan="4"><div class="empty">Inga kompetenser registrerade.</div></td></tr>';
    main += '</tbody></table></div></section>';

    var aside = UI.asideBlock('Uppgifter', UI.props([
      ['Roll', esc(w.title || '')],
      ['Typ', isAi ? 'AI' : 'Människa'],
      ['Anställningsform', isAi ? '' : w.consultant ? 'Konsult' : 'Anställd'],
      ['Grundkapacitet', U.fmtH(w.baseHoursPerWeek) + ' i veckan'],
      ['Kostnad per timme', w.costPerHour ? U.fmtNum(w.costPerHour) + ' kr' : '']
    ]));
    aside += UI.asideBlock('Hör hemma i', UI.props([
      ['Leveransdomän', C.ddRef(pd.deliveryDomain)],
      ['Verksamhetsdomän', C.domainRef(pd.business)],
      ['IT-domän', C.domainRef(pd.it)]
    ]) + '<p class="muted small" style="margin:6px 0 0">Härleds från arbetarens primära team.</p>');

    h += UI.detailLayout(main, aside);
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
