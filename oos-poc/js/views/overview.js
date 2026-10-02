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

  /*
   * Signaler av samma slag samlas till en rad med antal och en länk till sidan där de löses, så att
   * listan visar vad som behöver göras och inte upprepar sig. Ett slag med en enda signal visas som den.
   */
  var GROUPS = {
    bottleneck: { key: 'competence', page: 'bottlenecks' },
    gap: { key: 'competence', page: 'bottlenecks' },
    dependency: { key: 'dependency', page: 'bottlenecks', title: function (n) { return n + ' beroenden med risk'; } },
    keyperson: { key: 'keyperson', page: 'competences', title: function (n) { return n + ' kompetenser bärs av en person'; } },
    overallocated: { key: 'overallocated', page: 'workers', seg: ['workers-filter', 'over'], title: function (n) { return n + ' personer är överallokerade'; } },
    unallocated: { key: 'unallocated', page: 'workers', seg: ['workers-filter', 'free'], title: function (n) { return n + ' personer saknar allokering'; } },
    untraced: { key: 'untraced', page: 'epics', title: function (n) { return n + ' utvecklingsepiker saknar initiativ'; } },
    investment: { key: 'investment', page: 'initiatives', title: function (n) { return n + ' initiativ går över investeringen'; } }
  };
  var RANK = { critical: 0, warning: 1, info: 2 };

  function groupSignals(sigs) {
    var out = [];
    var byKey = {};
    sigs.forEach(function (s) {
      var g = GROUPS[s.kind];
      if (!g) { out.push({ items: [s] }); return; }
      if (!byKey[g.key]) { byKey[g.key] = { group: g, items: [] }; out.push(byKey[g.key]); }
      byKey[g.key].items.push(s);
    });
    return out.map(function (x) {
      var worst = x.items.reduce(function (m, s) { return RANK[s.severity] < RANK[m] ? s.severity : m; }, 'info');
      if (x.items.length === 1) return { severity: worst, title: x.items[0].title, detail: x.items[0].detail, go: x.items[0].ref.page + ':' + x.items[0].ref.id };
      var g = x.group;
      var title;
      if (g.key === 'competence') {
        var b = x.items.filter(function (s) { return s.kind === 'bottleneck'; }).length;
        var gp = x.items.length - b;
        title = [b ? plural(b, 'flaskhals', 'flaskhalsar') : '', gp ? plural(gp, 'lucka', 'luckor') : ''].filter(Boolean).join(' och ') + ' i kompetens';
      } else {
        title = g.title(x.items.length);
      }
      return { severity: worst, title: title, detail: x.items.slice(0, 3).map(function (s) { return s.title; }).join(' · ') + (x.items.length > 3 ? ' · med flera' : ''), go: g.page, seg: g.seg, count: x.items.length };
    }).sort(function (a, b) { return RANK[a.severity] - RANK[b.severity] || (b.count || 1) - (a.count || 1); });
  }

  /* "a, b och c" */
  function joinSv(list) {
    return list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' och ' + list[list.length - 1];
  }

  OOS.views.overview = function (ctx) {
    var e = ctx.e;
    var org = e.orgCapacity(ctx.period);
    var nxt = e.orgCapacity(ctx.next);
    var sigs = e.signals(ctx.period);
    var unalloc = e.unallocated(ctx.period);
    var count = function (kind) { return sigs.filter(function (s) { return s.kind === kind; }).length; };
    var month = ctx.period.inText;

    var h = UI.pageHead({ title: 'Läget i ' + esc(month), actions: UI.btn('Öppna rapporter', 'go', { data: { to: 'reports' } }) });

    /* Läget i en mening: det ska gå att säga högt på ett möte. Först det som är kritiskt. */
    var crit = [];
    var nb = count('bottleneck');
    var ng = count('gap');
    if (nb || ng) crit.push([nb ? plural(nb, 'flaskhals', 'flaskhalsar') : '', ng ? plural(ng, 'lucka', 'luckor') : ''].filter(Boolean).join(' och ') + ' i kompetens');
    if (count('overallocated')) crit.push(plural(count('overallocated'), 'person är överallokerad', 'personer är överallokerade'));
    if (count('investment')) crit.push(plural(count('investment'), 'initiativ går', 'initiativ går') + ' över investeringen');
    var lede = 'Teamen har <strong>' + U.fmtH(org.capacity) + '</strong> i ' + esc(month) + '. ' +
      '<strong>' + U.fmtPct(org.loadPct) + '</strong> är belagt och <strong>' + U.fmtH(org.free) + '</strong> är ledigt.' +
      (crit.length ? ' <strong class="over">Att lösa: ' + joinSv(crit) + '.</strong>' : ' Inget kritiskt att lösa.') +
      (unalloc.hours > 0.5 ? ' ' + U.fmtH(unalloc.hours) + ' hos ' + plural(unalloc.people.length, 'person', 'personer') + ' är inte fördelad på något team.' : '');
    h += '<p class="lede">' + lede + '</p>';

    var lp = org.loadPct;
    h += '<div class="kpis">' +
      UI.kpi('Beläggning', U.fmtPct(lp), U.fmtH(org.loaded) + ' belastat av ' + U.fmtH(org.capacity), { crit: lp > 100.5, warn: lp >= 90 && lp <= 100.5 }) +
      UI.kpi('Ledigt', U.fmtH(org.free), 'I teamen, kan planeras') +
      UI.kpi('Inte fördelad', U.fmtH(unalloc.hours), unalloc.people.length ? 'Hos ' + plural(unalloc.people.length, 'person', 'personer') + ', i inget team' : 'All tid är fördelad') +
      UI.kpi('Kapacitet i ' + ctx.next.inText, U.fmtH(nxt.capacity), U.fmtSigned(nxt.capacity - org.capacity, ' h') + ' mot ' + esc(month)) +
      '</div>';

    var groups = groupSignals(sigs);
    var showAll = OOS.state.allSignals;
    var shown = showAll ? groups : groups.slice(0, 8);
    h += '<div class="split"><section class="card"><div class="card-head"><div><div class="card-title">Att titta på</div><div class="card-sub">Det som behöver lösas först, samlat per slag. Visa går till sidan där det löses.</div></div></div>';
    h += '<div class="signals">';
    shown.forEach(function (s) {
      h += '<div class="signal"><span class="dot ' + s.severity + '" title="' + SEVERITY[s.severity] + '"></span>' +
        '<div><div class="signal-title"><span class="sr-only">' + SEVERITY[s.severity] + ': </span>' + esc(s.title) + '</div><div class="signal-detail">' + esc(s.detail) + '</div></div>' +
        (s.seg ? '<button type="button" class="btn btn-sm" data-action="go-filtered" data-to="' + esc(s.go) + '" data-seg="' + esc(s.seg[0]) + '" data-key="' + esc(s.seg[1]) + '">Visa</button>'
          : '<button type="button" class="btn btn-sm" data-go="' + esc(s.go) + '">Visa</button>') + '</div>';
    });
    if (!sigs.length) h += '<div class="empty">Inget avviker. Modellen hänger ihop.</div>';
    h += '</div>';
    if (groups.length > 8) h += '<div class="pager"><span>' + shown.length + ' av ' + groups.length + '</span>' + UI.btn(showAll ? 'Visa färre' : 'Visa alla', 'signals-toggle', { cls: 'btn-sm' }) + '</div>';
    h += '</section>';

    var dds = S.db.deliveryDomains.map(function (d) {
      var c = e.deliveryDomainCapacity(d.id, ctx.period);
      var n = e.deliveryDomainCapacity(d.id, ctx.next);
      return { d: d, cap: c, next: n.capacity };
    }).sort(function (a, b) { return b.cap.capacity - a.cap.capacity; });
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Per leveransdomän</div><div class="card-sub">Timmar i ' + esc(month) + ' efter avdrag. Stapeln visar hur stor del av kapaciteten som är belastad.</div></div></div><div class="hbars">';
    dds.forEach(function (x) {
      var free = x.cap.capacity - x.cap.loaded;
      var change = x.next - x.cap.capacity;
      var line = U.fmtPct(x.cap.loadPct) + ' belagt · ' + (free < -0.5 ? '<span class="crit-text">' + U.fmtH(-free) + ' över</span>' : U.fmtH(free) + ' ledigt') + ' · ' + U.fmtSigned(change, ' h') + ' i ' + esc(ctx.next.inText);
      h += '<div class="hbar dd-bar" role="link" tabindex="0" aria-label="' + esc(x.d.name + ', ' + U.fmtH(x.cap.capacity) + ', ' + U.fmtPct(x.cap.loadPct) + ' belagt, ' + U.fmtH(Math.max(0, free)) + ' ledigt') + '" data-go="deliveryDomains:' + esc(x.d.id) + '">' +
        '<span class="hbar-name">' + esc(x.d.name) + '</span><span class="hbar-val">' + U.fmtH(x.cap.capacity) + '</span>' +
        '<div class="dd-bar-track">' + C.capBar({ capacity: x.cap.capacity, loaded: x.cap.loaded }, { noValue: true }) + '</div>' +
        '<span class="dd-bar-note">' + line + '</span></div>';
    });
    h += UI.barLegend(dds.some(function (x) { return x.cap.loaded > x.cap.capacity + 0.5; }));
    h += '</div></section></div>';

    h += recentChanges();
    return h;
  };

  /* Fabrikskarta: hur en leveransdomän är uppbyggd, från verksamhet till teknik. Visas i leveransdomänens låda. */
  OOS.factoryMap = function (dd, ctx) {
    var e = ctx.e;
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

    var h = '<p class="small muted" style="margin:0 0 12px">Hur ' + esc(dd.name) + ' är uppbyggd, från verksamhet till teknik.</p>';
    h += '<dl class="kv small" style="grid-template-columns:max-content minmax(0,1fr);margin-bottom:18px">' +
      '<dt>Ägare</dt><dd>' + (owner ? C.link('workers:' + owner.id, owner.name) : UI.badge('Ej utsedd', 'warn')) + '</dd>' +
      '<dt>Nyckelroller</dt><dd>' + (keyRoles.length ? keyRoles.map(function (k) { return C.link('workers:' + k.worker.id, k.worker.name) + ' <span class="muted">' + esc(k.ext.role.toLowerCase()) + ', ' + k.ext.hoursPerMonth + ' h/mån</span>'; }).join(' · ') : '<span class="muted">Inga</span>') + '</dd>' +
      (supportive.length ? '<dt>Stödjande domäner</dt><dd>' + supportive.map(function (s) { return C.link(C.domainPage(s.domain) + ':' + s.domain.id, s.domain.name); }).join(' · ') + '</dd>' : '') +
      '</dl>';
    if (!cols.length) return h + '<div class="empty">Leveransdomänen har inga verksamhetsdomäner eller team ännu.</div>';

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
    h += '</div></div>';
    return h;
  };

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
      '<dt>Organisationsnamn</dt><dd>' + esc(st.orgName) + '</dd><dt>Standardarbetstid</dt><dd>' + st.standardWeekHours + ' h/vecka</dd><dt>Rapporteringsperiod</dt><dd>' + esc(({ pi: 'PI', year: 'År', quarter: 'Kvartal', month: 'Månad' })[ctx.period.type] || 'Månad') + ' (' + esc(ctx.period.label) + ')</dd>' +
      '<dt>Lagring</dt><dd>' + (S.isPersistent() ? 'Sparas i den här webbläsaren' : UI.badge('Sparas inte', 'warn') + ' <span class="muted small">Webbläsaren blockerar lokal lagring. Ändringar försvinner när sidan laddas om.</span>') + '</dd></dl></div></section>';
    h += '<section class="card"><div class="card-head"><div class="card-title">Data</div></div><div class="card-body stack">' +
      '<p class="small">All data är påhittad demodata för organisationen Nordpension. Ändringar sparas bara i din webbläsare och syns inte för andra.</p>' +
      '<div class="row">' + UI.btn('Kopiera data som JSON', 'data-export', {}) + UI.btn('Importera JSON', 'data-import', {}) + UI.btn('Återställ demodata', 'data-reset', { cls: 'btn-danger' }) + '</div>' +
      '<input type="file" id="import-file" accept="application/json,.json" hidden data-change="data-import-file">' +
      '<div class="note"><span>Datamodellen följer ER-skissen för Prototyp 1: leveransdomän, domän, domänkluster, team, arbetare, kompetens, system och deras kopplingstabeller. Kapacitetssammanställningen räknas fram och lagras inte.</span></div></div></section>';
    h += '</div>';

    /* Var belastningen kommer ifrån. Epiker är standard; manuell belastning finns kvar för jämförelse. */
    var src = st.loadSource === 'manual' ? 'manual' : 'epics';
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Beläggning</div>' +
      '<div class="card-sub">Hur appen räknar ut hur mycket av kapaciteten som är planerad.</div></div>' +
      UI.seg('load-source', [{ key: 'epics', label: 'Ur epiker' }, { key: 'manual', label: 'Manuellt per teammedlem' }], src) + '</div>' +
      '<p class="aside-text">' + (src === 'epics'
        ? 'Beläggningen räknas fram ur teamens beslutade epiker: planerade och pågående epikers timmar i perioden delat med teamets kapacitet. Förslag räknas inte. Klara epiker räknas för den tid de pågick. Varje team har en förvaltningsepik som rymmer drift, utbildning och kompetensspridning.'
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
    UI.toast(key === 'manual' ? 'Beläggningen räknas nu från manuella procentsatser.' : 'Beläggningen räknas nu ur epikerna.');
  };

  var A = OOS.actions;
  /* Gå till en sida med ett filter förvalt, till exempel Arbetare med bara överallokerade. */
  A['go-filtered'] = function (el) {
    OOS.state.segs[el.dataset.seg] = el.dataset.key;
    OOS.go(el.dataset.to);
  };
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
