/* Översikt: nyckeltal, signaler, kapacitet per leveransdomän och fabrikskarta. Inställningar och ändringslogg. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  var SIGNAL_ICON = { critical: 'alertCircle', warning: 'alert', info: 'info' };
  var SIGNAL_LABEL = { critical: 'Kritisk', warning: 'Varning', info: 'Info' };

  OOS.views.overview = function (ctx) {
    var e = ctx.e;
    var org = e.orgCapacity(ctx.period);
    var nxt = e.orgCapacity(ctx.next);
    var sigs = e.signals(ctx.period);
    var ai = S.db.workers.filter(function (w) { return w.type === 'ai'; }).length;
    var bdCount = S.db.domains.filter(function (d) { return d.type === 'business'; }).length;
    var itCount = S.db.domains.length - bdCount;

    var h = UI.pageHead({
      title: 'Översikt',
      sub: 'En gemensam bild av ' + esc(S.db.settings.orgName) + 's utvecklingsfabrik: domäner, team, kompetenser och verklig kapacitet ' + esc(ctx.period.label.toLowerCase()) + '.',
      actions: UI.btn('Öppna rapporter', 'go', { icon: 'chart', data: { to: 'reports' } })
    });
    h += '<div class="kpis">' +
      UI.kpi('layers', 'Leveransdomäner', S.db.deliveryDomains.length, bdCount + ' verksamhets- och ' + itCount + ' IT-domäner') +
      UI.kpi('users', 'Team', S.db.teams.length) +
      UI.kpi('user', 'Arbetare', S.db.workers.length, ai + ' AI-arbetare') +
      UI.kpi('gauge', 'Kapacitet ' + ctx.period.label.toLowerCase(), U.fmtH(org.capacity), U.fmtSigned(nxt.capacity - org.capacity, ' h') + ' nästa period') +
      UI.kpi('chart', 'Beläggningsgrad', U.fmtPct(org.loadPct), U.fmtH(org.free) + ' ledigt') +
      '</div>';

    var showAll = OOS.state.allSignals;
    var shown = showAll ? sigs : sigs.slice(0, 7);
    var counts = { critical: 0, warning: 0, info: 0 };
    sigs.forEach(function (s) { counts[s.severity]++; });
    h += '<div class="split"><section class="card"><div class="card-head"><div><div class="card-title">' + UI.icon('alert') + 'Signaler</div><div class="card-sub">Det modellen visar just nu, även när det är obekvämt.</div></div><div class="row">' +
      (counts.critical ? UI.badge(counts.critical + ' kritiska', 'crit', 'alertCircle') : '') + (counts.warning ? UI.badge(counts.warning + ' varningar', 'warn', 'alert') : '') + (counts.info ? UI.badge(counts.info + ' info', 'info', 'info') : '') + '</div></div>';
    h += '<div class="signals">';
    shown.forEach(function (s) {
      h += '<div class="signal ' + s.severity + '"><span class="stripe"></span>' + UI.icon(SIGNAL_ICON[s.severity], 'ic') +
        '<div><div class="signal-title"><span class="sr-only">' + SIGNAL_LABEL[s.severity] + ': </span>' + esc(s.title) + '</div><div class="signal-detail">' + esc(s.detail) + '</div></div>' +
        '<button type="button" class="btn btn-sm" data-go="' + esc(s.ref.page + ':' + s.ref.id) + '">Öppna</button></div>';
    });
    if (!sigs.length) h += '<div class="empty">Inga signaler. Modellen hänger ihop.</div>';
    h += '</div>';
    if (sigs.length > 7) h += '<div class="pager"><span>' + shown.length + ' av ' + sigs.length + ' signaler</span>' + UI.btn(showAll ? 'Visa färre' : 'Visa alla', 'signals-toggle', { cls: 'btn-sm' }) + '</div>';
    h += '</section>';

    var dds = S.db.deliveryDomains.map(function (d) {
      var c = e.deliveryDomainCapacity(d.id, ctx.period);
      var n = e.deliveryDomainCapacity(d.id, ctx.next);
      return { d: d, cap: c, next: n.capacity };
    });
    var max = Math.max.apply(null, dds.map(function (x) { return Math.max(x.cap.capacity, x.next); }).concat([1]));
    h += '<section class="card"><div class="card-head"><div><div class="card-title">' + UI.icon('layers') + 'Kapacitet per leveransdomän</div><div class="card-sub">' + esc(ctx.period.label) + ', timmar efter avdrag</div></div></div><div class="hbars">';
    h += '<div class="row small muted" style="gap:14px"><span class="row" style="gap:6px"><span class="sw loaded"></span>Belastad</span><span class="row" style="gap:6px"><span class="sw free"></span>Ledig</span><span class="row" style="gap:6px"><span style="width:2px;height:12px;background:var(--fg)"></span>Nästa period</span></div>';
    dds.forEach(function (x) {
      var tip = x.d.name + '\nKapacitet: ' + U.fmtH(x.cap.capacity) + '\nBelastad: ' + U.fmtH(x.cap.loaded) + ' (' + U.fmtPct(x.cap.loadPct) + ')\nLedig: ' + U.fmtH(x.cap.free) + '\n' + x.cap.headcount + ' arbetare i ' + x.cap.teamCount + ' team\nNästa period: ' + U.fmtH(x.next);
      h += '<div class="hbar" style="grid-template-columns:minmax(0,150px) minmax(0,1fr) 92px;cursor:pointer" data-go="deliveryDomains:' + esc(x.d.id) + '" data-tip="' + esc(tip) + '">' +
        '<span class="hbar-name">' + esc(x.d.name) + '</span><div class="hbar-track"><div class="hbar-loaded" style="width:' + (x.cap.loaded / max) * 100 + '%"></div><div class="hbar-free" style="width:' + (Math.max(0, x.cap.free) / max) * 100 + '%"></div><div class="hbar-next" style="left:calc(' + (x.next / max) * 100 + '% - 1px)"></div></div>' +
        '<span class="hbar-val">' + U.fmtH(x.cap.capacity) + '</span></div>';
    });
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

    var h = '<section class="card"><div class="card-head"><div><div class="card-title">' + UI.icon('map') + 'Fabrikskarta: ' + esc(dd.name) + '</div><div class="card-sub">Hur leveransdomänen är uppbyggd av verksamhetsdomäner, team och IT-domäner. Klicka för att öppna.</div></div>' +
      UI.seg('fmap', S.db.deliveryDomains.slice().sort(U.byName).map(function (d) { return { key: d.id, label: d.name }; }), dd.id) + '</div>';
    h += '<div class="card-body row small" style="gap:18px;border-bottom:1px solid var(--line)">' +
      '<span><span class="muted">Ägare:</span> ' + (owner ? C.link('workers:' + owner.id, owner.name) : UI.badge('Ej utsedd', 'warn')) + '</span>' +
      '<span><span class="muted">Nyckelroller:</span> ' + (keyRoles.length ? keyRoles.map(function (k) { return C.link('workers:' + k.worker.id, k.worker.name) + ' <span class="muted">(' + esc(k.ext.role) + ', ' + k.ext.hoursPerMonth + ' h/mån)</span>'; }).join(', ') : '<span class="muted">Inga</span>') + '</span>' +
      (supportive.length ? '<span><span class="muted">Stödjande domäner:</span> ' + supportive.map(function (s) { return C.link(C.domainPage(s.domain) + ':' + s.domain.id, s.domain.name); }).join(', ') + '</span>' : '') +
      '</div>';
    if (!cols.length) return h + '<div class="empty">Leveransdomänen har inga verksamhetsdomäner eller team ännu.</div></section>';

    h += '<div class="fmap"><div class="fmap-grid" style="--cols:' + cols.length + '">';
    h += '<div class="fmap-rowlabel">Verksamhets&shy;domän</div>';
    cols.forEach(function (c) {
      if (!c.bd) { h += '<button type="button" class="cloud dashed">Via IT-domän<span class="cloud-sub">Team utan verksamhetsdomän i leveransdomänen</span></button>'; return; }
      var ex = e.domainExperts(c.bd.id);
      h += '<button type="button" class="cloud" data-go="businessDomains:' + esc(c.bd.id) + '">' + esc(c.bd.name) + '<span class="cloud-sub">' + ex.length + ' i domänmolnet</span></button>';
    });
    h += '<div class="fmap-rowlabel">Utvecklings&shy;team</div>';
    cols.forEach(function (c) {
      h += '<div class="fcol">';
      c.teams.forEach(function (t) {
        var tc = e.teamCapacity(t.id, ctx.period);
        var sys = e.teamSystems(t.id).filter(function (x) { return x.link.objective === 'owner'; }).map(function (x) { return x.system.name; });
        var cats = tc.byCategory.slice(0, 3).map(function (x) { return x.name; });
        h += '<div class="fteam' + (t.category === 'supporting' ? ' supporting' : '') + '" role="button" tabindex="0" data-go="teams:' + esc(t.id) + '">' +
          '<span class="row-between"><span class="fteam-name">' + esc(t.name) + '</span>' + UI.badge(C.categoryLabel(t.category), 'muted') + '</span>' +
          '<span class="muted small">' + tc.headcount + ' pers. · ' + U.fmtH(tc.capacity) + '</span>' + UI.bar(tc.loadPct) +
          '<span class="small"><span class="muted">Kompetens:</span> ' + esc(cats.join(', ') || '–') + '</span>' +
          '<span class="small"><span class="muted">System:</span> ' + esc(sys.join(', ') || '–') + '</span></div>';
      });
      if (!c.teams.length) h += '<div class="muted small empty">Inga team med primär koppling</div>';
      h += '</div>';
    });
    h += '<div class="fmap-rowlabel">IT-domän</div>';
    cols.forEach(function (c) {
      var its = new Map();
      c.teams.forEach(function (t) { var it = e.teamPrimaryDomain(t.id, 'it'); if (it) its.set(it.id, it); });
      h += '<div class="fcol">';
      Array.from(its.values()).forEach(function (it) {
        var ex = e.domainExperts(it.id);
        h += '<button type="button" class="cloud it" data-go="itDomains:' + esc(it.id) + '">' + esc(it.name) + '<span class="cloud-sub">' + ex.length + ' i domänmolnet</span></button>';
      });
      if (!its.size) h += '<div class="muted small empty">–</div>';
      h += '</div>';
    });
    h += '</div></div></section>';
    return h;
  }

  function recentChanges() {
    var log = (S.db.changeLog || []).slice(0, 6);
    var h = '<section class="card"><div class="card-head"><div class="card-title">' + UI.icon('clock') + 'Senaste ändringar</div>' + UI.btn('Hela loggen', 'go', { cls: 'btn-sm', data: { to: 'settings' } }) + '</div><div class="card-body">';
    if (!log.length) return h + '<p class="muted">Inga ändringar ännu. Allt du lägger till, ändrar eller tar bort loggas här så att beslut går att följa upp.</p></div></section>';
    h += '<div class="list">';
    log.forEach(function (l) {
      h += '<div class="list-item"><span class="muted small" style="width:120px;flex:none">' + fmtTs(l.ts) + '</span><span class="grow">' + esc(l.action) + ' ' + esc(l.what) + (l.name ? ': <strong>' + esc(l.name) + '</strong>' : '') + '</span></div>';
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
    h += '<section class="card"><div class="card-head"><div class="card-title">' + UI.icon('settings') + 'Organisation</div>' + UI.btn('Redigera', 'org-edit', { cls: 'btn-sm', icon: 'edit' }) + '</div><div class="card-body"><dl class="kv">' +
      '<dt>Organisationsnamn</dt><dd>' + esc(st.orgName) + '</dd><dt>Standardarbetstid</dt><dd>' + st.standardWeekHours + ' h/vecka</dd><dt>Rapporteringsperiod</dt><dd>' + (st.periodType === 'quarter' ? 'Kvartal' : 'Månad') + ' (' + esc(ctx.period.label) + ')</dd>' +
      '<dt>Lagring</dt><dd>' + (S.isPersistent() ? 'Sparas i den här webbläsaren' : UI.badge('Sparas inte', 'warn') + ' <span class="muted small">Webbläsaren blockerar lokal lagring. Ändringar försvinner när sidan laddas om.</span>') + '</dd></dl></div></section>';
    h += '<section class="card"><div class="card-head"><div class="card-title">' + UI.icon('refresh') + 'Data</div></div><div class="card-body stack">' +
      '<p class="small">All data är påhittad demodata för organisationen Nordpension. Ändringar sparas bara i din webbläsare och syns inte för andra.</p>' +
      '<div class="row">' + UI.btn('Kopiera data som JSON', 'data-export', { icon: 'copy' }) + UI.btn('Importera JSON', 'data-import', { icon: 'upload' }) + UI.btn('Återställ demodata', 'data-reset', { cls: 'btn-danger', icon: 'refresh' }) + '</div>' +
      '<input type="file" id="import-file" accept="application/json,.json" hidden data-change="data-import-file">' +
      '<div class="note">' + UI.icon('info') + '<span>Datamodellen följer ER-skissen för Prototyp 1: leveransdomän, domän, domänkluster, team, arbetare, kompetens, system och deras kopplingstabeller. Kapacitetssammanställningen räknas fram och lagras inte.</span></div></div></section>';
    h += '</div>';

    var log = S.db.changeLog || [];
    h += '<section class="card"><div class="card-head"><div><div class="card-title">' + UI.icon('clock') + 'Ändringslogg</div><div class="card-sub">Spårbarhet för prioriteringar, ansvar och struktur. Sparar de senaste 300 ändringarna.</div></div></div>';
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
    var text = S.exportJSON();
    try {
      navigator.clipboard.writeText(text).then(function () { UI.toast('Datan kopierades som JSON.'); }, function () { UI.toast('Urklipp är blockerat i den här vyn.'); });
    } catch (e) {
      UI.toast('Urklipp är blockerat i den här vyn.');
    }
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
