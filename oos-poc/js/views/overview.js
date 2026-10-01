/* Översikt: nyckeltal, signaler, kapacitet per leveransdomän och fabrikskarta. Inställningar och ändringslogg. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  var SEVERITY = { critical: 'Kritisk', warning: 'Varning', info: 'Info' };

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  OOS.views.overview = function (ctx) {
    var e = ctx.e;
    var org = e.orgCapacity(ctx.period);
    var nxt = e.orgCapacity(ctx.next);
    var sigs = e.signals(ctx.period);
    var over = sigs.filter(function (s) { return s.kind === 'overallocated'; }).length;
    var keyp = sigs.filter(function (s) { return s.kind === 'keyperson'; }).length;
    var ai = S.db.workers.filter(function (w) { return w.type === 'ai'; }).length;
    var bdCount = S.db.domains.filter(function (d) { return d.type === 'business'; }).length;
    var itCount = S.db.domains.length - bdCount;
    var month = ctx.period.inText;

    var h = UI.pageHead({ title: esc(ctx.period.label), actions: UI.btn('Öppna rapporter', 'go', { data: { to: 'reports' } }) });

    /* Läget i en mening: det är den som ska gå att säga högt på ett möte. */
    var lede = esc(S.db.settings.orgName) + ' har <strong>' + U.fmtH(org.capacity) + '</strong> verklig kapacitet i ' + esc(month) + '. ' +
      '<strong>' + U.fmtPct(org.loadPct) + '</strong> är planerat och <strong>' + U.fmtH(org.free) + '</strong> är ledigt.';
    if (over) lede += ' <strong class="over">' + plural(over, 'person är', 'personer är') + ' överallokerad' + (over === 1 ? '' : 'e') + '.</strong>';
    if (keyp) lede += ' ' + plural(keyp, 'kompetens', 'kompetenser') + ' har bara en person på nivå 3–4.';
    h += '<p class="lede">' + lede + '</p>';

    h += '<div class="kpis">' +
      UI.kpi('Leveransdomäner', S.db.deliveryDomains.length, bdCount + ' verksamhets- och ' + U.plural(itCount, 'IT-domän', 'IT-domäner')) +
      UI.kpi('Team', S.db.teams.length, S.db.teams.filter(function (t) { return t.category === 'producing'; }).length + ' producerande') +
      UI.kpi('Arbetare', S.db.workers.length, ai ? ai + ' AI' : '') +
      UI.kpi(ctx.next.label, U.fmtH(nxt.capacity), U.fmtSigned(nxt.capacity - org.capacity, ' h') + ' mot ' + esc(month)) +
      '</div>';

    var showAll = OOS.state.allSignals;
    var shown = showAll ? sigs : sigs.slice(0, 6);
    h += '<div class="split"><section class="card"><div class="card-head"><div><div class="card-title">Att titta på</div><div class="card-sub">Det modellen visar just nu, även när det är obekvämt.</div></div></div>';
    h += '<div class="signals">';
    shown.forEach(function (s) {
      h += '<div class="signal"><span class="dot ' + s.severity + '" title="' + SEVERITY[s.severity] + '"></span>' +
        '<div><div class="signal-title"><span class="sr-only">' + SEVERITY[s.severity] + ': </span>' + esc(s.title) + '</div><div class="signal-detail">' + esc(s.detail) + '</div></div>' +
        '<button type="button" class="btn btn-sm" data-go="' + esc(s.ref.page + ':' + s.ref.id) + '">Visa</button></div>';
    });
    if (!sigs.length) h += '<div class="empty">Inget avviker. Modellen hänger ihop.</div>';
    h += '</div>';
    if (sigs.length > 6) h += '<div class="pager"><span>' + shown.length + ' av ' + sigs.length + '</span>' + UI.btn(showAll ? 'Visa färre' : 'Visa alla', 'signals-toggle', { cls: 'btn-sm' }) + '</div>';
    h += '</section>';

    var dds = S.db.deliveryDomains.map(function (d) {
      var c = e.deliveryDomainCapacity(d.id, ctx.period);
      var n = e.deliveryDomainCapacity(d.id, ctx.next);
      return { d: d, cap: c, next: n.capacity };
    }).sort(function (a, b) { return b.cap.capacity - a.cap.capacity; });
    var max = Math.max.apply(null, dds.map(function (x) { return Math.max(x.cap.capacity, x.next); }).concat([1]));
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Per leveransdomän</div><div class="card-sub">Timmar i ' + esc(month) + ' efter avdrag</div></div></div><div class="hbars">';
    dds.forEach(function (x) {
      var tip = x.d.name + '\nKapacitet: ' + U.fmtH(x.cap.capacity) + '\nPlanerat: ' + U.fmtH(x.cap.loaded) + ' (' + U.fmtPct(x.cap.loadPct) + ')\nLedigt: ' + U.fmtH(x.cap.free) + '\n' + x.cap.headcount + ' arbetare i ' + x.cap.teamCount + ' team\n' + ctx.next.label + ': ' + U.fmtH(x.next);
      h += '<div class="hbar" style="grid-template-columns:minmax(0,1fr) auto" role="link" tabindex="0" aria-label="' + esc(x.d.name + ', ' + U.fmtH(x.cap.capacity) + ', ' + U.fmtPct(x.cap.loadPct) + ' planerat') + '" data-go="deliveryDomains:' + esc(x.d.id) + '" data-tip="' + esc(tip) + '">' +
        '<span class="hbar-name">' + esc(x.d.name) + '</span><span class="hbar-val">' + U.fmtH(x.cap.capacity) + '</span>' +
        '<div class="hbar-track" style="grid-column:1 / -1"><div class="hbar-loaded" style="width:' + (x.cap.loaded / max) * 100 + '%"></div><div class="hbar-free" style="width:' + (Math.max(0, x.cap.free) / max) * 100 + '%"></div><div class="hbar-next" style="left:calc(' + (x.next / max) * 100 + '% - 1px)"></div></div></div>';
    });
    h += '<div class="legend-line"><span><span class="sw loaded"></span>Planerat</span><span><span class="sw free"></span>Ledigt</span><span><span class="sw next"></span>' + esc(ctx.next.label) + '</span></div>';
    h += '</div></section></div>';

    h += factoryMap(ctx);
    h += recentChanges();
    return h;
  };

  function factoryMap(ctx) {
    var e = ctx.e;
    var ddId = OOS.segVal('fmap', 'dd_ag');
    var dd = e.get('deliveryDomains', ddId) || S.db.deliveryDomains[0];
    if (!dd) return '';
    var teams = e.teamsOfDeliveryDomain(dd.id);
    var primaryBds = e.domainsOfDeliveryDomain(dd.id, 'business').filter(function (x) { return x.relationship === 'primary'; }).map(function (x) { return x.domain; }).sort(U.byName);
    var cols = primaryBds.map(function (bd) {
      return { bd: bd, teams: teams.filter(function (t) { var p = e.teamPrimaryDomain(t.id, 'business'); return p && p.id === bd.id; }) };
    });
    var placed = new Set();
    cols.forEach(function (c) { c.teams.forEach(function (t) { placed.add(t.id); }); });
    var rest = teams.filter(function (t) { return !placed.has(t.id); });
    if (rest.length) cols.push({ bd: null, teams: rest });
    var supportive = e.domainsOfDeliveryDomain(dd.id).filter(function (x) { return x.relationship === 'supportive'; });
    var keyRoles = e.deliveryDomainExperts(dd.id);
    var owner = dd.ownerId ? e.get('workers', dd.ownerId) : null;

    var h = '<section class="card"><div class="card-head"><div><div class="card-title">Fabrikskarta</div><div class="card-sub">Hur en leveransdomän är uppbyggd, från verksamhet till teknik.</div></div>' +
      UI.seg('fmap', S.db.deliveryDomains.slice().sort(U.byName).map(function (d) { return { key: d.id, label: d.name }; }), dd.id) + '</div>';
    h += '<dl class="kv small" style="grid-template-columns:max-content minmax(0,1fr);margin-bottom:18px">' +
      '<dt>Ägare</dt><dd>' + (owner ? C.link('workers:' + owner.id, owner.name) : UI.badge('Ej utsedd', 'warn')) + '</dd>' +
      '<dt>Nyckelroller</dt><dd>' + (keyRoles.length ? keyRoles.map(function (k) { return C.link('workers:' + k.worker.id, k.worker.name) + ' <span class="muted">' + esc(k.ext.role.toLowerCase()) + ', ' + k.ext.hoursPerMonth + ' h/mån</span>'; }).join(' · ') : '<span class="muted">Inga</span>') + '</dd>' +
      (supportive.length ? '<dt>Stödjande domäner</dt><dd>' + supportive.map(function (s) { return C.link(C.domainPage(s.domain) + ':' + s.domain.id, s.domain.name); }).join(' · ') + '</dd>' : '') +
      '</dl>';
    if (!cols.length) return h + '<div class="empty">Leveransdomänen har inga verksamhetsdomäner eller team ännu.</div></section>';

    h += '<div class="fmap"><div class="fmap-grid" style="--cols:' + cols.length + '">';
    cols.forEach(function (c) {
      h += '<div class="fcol"><div class="fcol-label">Verksamhetsdomän</div>';
      if (c.bd) {
        var ex = e.domainExperts(c.bd.id);
        h += '<button type="button" class="fdomain" data-go="businessDomains:' + esc(c.bd.id) + '">' + esc(c.bd.name) + '</button>' +
          '<span class="meta">' + (ex.length ? plural(ex.length, 'expert', 'experter') + ' i domänmolnet' : 'Inget domänmoln') + '</span>';
      } else {
        h += '<span class="fdomain" style="cursor:default">Övriga</span><span class="meta">Team som når leveransdomänen via IT-domän</span>';
      }
      h += '<div class="fcol-label">Team</div>';
      c.teams.forEach(function (t) {
        var tc = e.teamCapacity(t.id, ctx.period);
        var sys = e.teamSystems(t.id).filter(function (x) { return x.link.objective === 'owner'; }).map(function (x) { return x.system.name; });
        h += '<div class="fteam" role="button" tabindex="0" data-go="teams:' + esc(t.id) + '">' +
          '<span class="fteam-name">' + esc(t.name) + '</span>' +
          '<span class="meta">' + tc.headcount + ' pers. · ' + U.fmtH(tc.capacity) + (t.category === 'supporting' ? ' · stödjande' : '') + '</span>' + UI.bar(tc.loadPct) +
          (sys.length ? '<span class="meta">' + esc(sys.join(', ')) + '</span>' : '') + '</div>';
      });
      if (!c.teams.length) h += '<span class="meta">Inget team har domänen som primär.</span>';
      var its = new Map();
      c.teams.forEach(function (t) { var it = e.teamPrimaryDomain(t.id, 'it'); if (it) its.set(it.id, it); });
      h += '<div class="fcol-label">IT-domän</div>';
      Array.from(its.values()).forEach(function (it) {
        h += '<button type="button" class="fdomain it" data-go="itDomains:' + esc(it.id) + '">' + esc(it.name) + '</button>';
      });
      if (!its.size) h += '<span class="meta">–</span>';
      h += '</div>';
    });
    h += '</div></div></section>';
    return h;
  }

  function recentChanges() {
    var log = (S.db.changeLog || []).slice(0, 6);
    var h = '<section class="card"><div class="card-head"><div class="card-title">Senaste ändringar</div>' + UI.btn('Hela loggen', 'go', { cls: 'btn-sm', data: { to: 'settings' } }) + '</div><div class="card-body">';
    if (!log.length) return h + '<p class="muted">Inga ändringar ännu. Allt du lägger till, ändrar eller tar bort loggas här, så att beslut går att följa upp.</p></div></section>';
    h += '<div class="list">';
    log.forEach(function (l) {
      h += '<div class="list-item"><span class="muted small num" style="width:120px;flex:none;text-align:left">' + fmtTs(l.ts) + '</span><span class="grow">' + esc(l.action) + ' ' + esc(l.what) + (l.name ? ' <span class="muted">·</span> ' + esc(l.name) : '') + '</span></div>';
    });
    return h + '</div></div></section>';
  }

  function fmtTs(ts) {
    var d = new Date(ts);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* ---------- Inställningar ---------- */

  OOS.views.settings = function (ctx) {
    var st = S.db.settings;
    var h = UI.pageHead({ title: 'Inställningar', sub: 'Organisation, data och ändringslogg för POC:n.' });
    h += '<div class="grid-2">';
    h += '<section class="card"><div class="card-head"><div class="card-title">Organisation</div>' + UI.btn('Redigera', 'org-edit', { cls: 'btn-sm' }) + '</div><div class="card-body"><dl class="kv">' +
      '<dt>Organisationsnamn</dt><dd>' + esc(st.orgName) + '</dd><dt>Standardarbetstid</dt><dd>' + st.standardWeekHours + ' h/vecka</dd><dt>Rapporteringsperiod</dt><dd>' + (st.periodType === 'quarter' ? 'Kvartal' : 'Månad') + ' (' + esc(ctx.period.label) + ')</dd>' +
      '<dt>Lagring</dt><dd>' + (S.isPersistent() ? 'Sparas i den här webbläsaren' : UI.badge('Sparas inte', 'warn') + ' <span class="muted small">Webbläsaren blockerar lokal lagring. Ändringar försvinner när sidan laddas om.</span>') + '</dd></dl></div></section>';
    h += '<section class="card"><div class="card-head"><div class="card-title">Data</div></div><div class="card-body stack">' +
      '<p class="small">All data är påhittad demodata för organisationen Nordpension. Ändringar sparas bara i din webbläsare och syns inte för andra.</p>' +
      '<div class="row">' + UI.btn('Kopiera data som JSON', 'data-export', {}) + UI.btn('Importera JSON', 'data-import', {}) + UI.btn('Återställ demodata', 'data-reset', { cls: 'btn-danger' }) + '</div>' +
      '<input type="file" id="import-file" accept="application/json,.json" hidden data-change="data-import-file">' +
      '<div class="note"><span>Datamodellen följer ER-skissen för Prototyp 1: leveransdomän, domän, domänkluster, team, arbetare, kompetens, system och deras kopplingstabeller. Kapacitetssammanställningen räknas fram och lagras inte.</span></div></div></section>';
    h += '</div>';

    /* Var belastningen kommer ifrån. Epiker är standard; manuell belastning finns kvar för jämförelse. */
    var src = st.loadSource === 'manual' ? 'manual' : 'epics';
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Belastning</div>' +
      '<div class="card-sub">Hur appen räknar ut hur mycket av kapaciteten som är planerad.</div></div>' +
      UI.seg('load-source', [{ key: 'epics', label: 'Ur epiker' }, { key: 'manual', label: 'Manuellt per teammedlem' }], src) + '</div>' +
      '<p class="aside-text">' + (src === 'epics'
        ? 'Belastningen räknas fram ur teamens beslutade epiker: planerade och pågående epikers timmar i perioden delat med teamets kapacitet. Förslag och klara epiker räknas inte.'
        : 'Belastningen anges som en procentsats på varje medlemskap i teamet. Epikerna visas men påverkar inte beläggningen.') + '</p></section>';

    var log = S.db.changeLog || [];
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Ändringslogg</div><div class="card-sub">Spårbarhet för prioriteringar, ansvar och struktur. Sparar de senaste 300 ändringarna.</div></div></div>';
    h += UI.table({
      id: 'tbl-log',
      rows: log.map(function (l, i) { return Object.assign({ id: 'l' + i }, l); }),
      noun: 'ändringar',
      emptyText: 'Inga ändringar ännu.',
      search: { placeholder: 'Sök i loggen …', text: function (r) { return r.action + ' ' + r.what + ' ' + r.name; } },
      columns: [
        { key: 'ts', label: 'Tid', render: function (r) { return '<span class="muted">' + fmtTs(r.ts) + '</span>'; } },
        { key: 'action', label: 'Händelse', render: function (r) { return esc(r.action) + ' ' + esc(r.what); } },
        { key: 'name', label: 'Vad', render: function (r) { return esc(r.name); } }
      ]
    }) + '</section>';
    return h;
  };

  OOS.segHandlers = OOS.segHandlers || {};
  OOS.segHandlers['load-source'] = function (key) {
    S.updateSettings({ loadSource: key === 'manual' ? 'manual' : 'epics' });
    UI.toast(key === 'manual' ? 'Belastningen räknas nu från manuella procentsatser.' : 'Belastningen räknas nu ur epikerna.');
  };

  var A = OOS.actions;
  A['signals-toggle'] = function () {
    OOS.state.allSignals = !OOS.state.allSignals;
    OOS.refresh();
  };
  A['org-edit'] = function () {
    UI.openForm({
      title: 'Organisation',
      values: { orgName: S.db.settings.orgName },
      fields: [{ key: 'orgName', label: 'Organisationsnamn', required: true, full: true }],
      onSubmit: function (v) {
        S.updateSettings({ orgName: v.orgName });
        OOS.refresh();
      }
    });
  };
  A['data-reset'] = function () {
    UI.confirm({ title: 'Återställ demodata?', message: 'All data du har lagt till eller ändrat ersätts med ursprunglig demodata.', confirmLabel: 'Återställ', danger: true }).then(function (ok) {
      if (!ok) return;
      S.reset();
      OOS.state.report = null;
      UI.toast('Demodatan är återställd.');
      OOS.go('overview');
    });
  };
  A['data-export'] = function () {
    C.copyText(S.exportJSON(), 'datan');
  };
  A['data-import'] = function () {
    var input = document.getElementById('import-file');
    if (input) input.click();
  };
  OOS.inputs['data-import-file'] = function (el) {
    var file = el.files && el.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        S.importJSON(String(reader.result));
        UI.toast('Datan importerades.');
        OOS.go('overview');
      } catch (err) {
        UI.toast('Importen misslyckades: ' + err.message);
      }
    };
    reader.readAsText(file);
  };
})();
