/* Översikt: nyckeltal, signaler, kapacitet per leveransdomän och fabrikskarta. Inställningar och ändringslogg. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  /*
   * Allvaret står som ord i varje korts huvud. Förut bar raden en prick på
   * 7 px och ingenting annat, så en varning och en upplysning såg likadana
   * ut: färgen var hela skillnaden, och den är den svagaste markören som
   * finns.
   */
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

  function signalCard(s) {
    var attrs = s.seg
      ? 'data-action="go-filtered" data-to="' + esc(s.go) + '" data-seg="' + esc(s.seg[0]) + '" data-key="' + esc(s.seg[1]) + '"'
      : 'data-go="' + esc(s.go) + '"';
    return '<button type="button" class="sigcard sev-' + s.severity + '" ' + attrs + '>' +
      '<span class="sigcard-head"><span class="dot ' + s.severity + '" aria-hidden="true"></span>' +
      '<span class="sigcard-sev">' + SEVERITY[s.severity] + '</span>' +
      UI.icon('chevronRight', 'sigcard-go') + '</span>' +
      '<span class="sigcard-title">' + esc(s.title) + '</span>' +
      '<span class="sigcard-detail">' + esc(s.detail) + '</span></button>';
  }

  /*
   * Signalerna som kort i rutnät. Som lista låg varje förklaring ensam på
   * en rad som var 700 px bred i ett kort som var 1 070 — två tredjedelar
   * av ytan var tom till höger — och de tre allvarsbanden tog en rad var
   * ovanpå det. Som kort fyller de bredden, allvaret står i varje korts
   * eget huvud, och formen är den samma som leveransdomänerna under: en
   * sak man kan gå in i är ett kort, inte en rad text.
   *
   * Kapningen följer allvaret i stället för ett tal: kritiskt göms aldrig,
   * och foten säger hur många som står kvar. "8 av 10" var ett godtyckligt
   * snitt mitt i varningarna.
   */
  function signalsCard(groups, any) {
    var h = '<section class="card"><div class="card-head"><div><div class="card-title">Att titta på</div>' +
      '<div class="card-sub">Det som behöver lösas först, samlat per slag.</div></div></div>';
    if (!any) return h + '<div class="empty">Inget avviker. Modellen hänger ihop.</div></section>';

    /*
     * Som standard står det som kräver en åtgärd: kritiskt och varningar.
     * Info är sådant man vill veta, inte sådant man gör något åt i dag,
     * och det ligger en knapp bort. Finns ingen åtgärd kvar visas info,
     * annars står kortet tomt mitt i en lista som inte är tom.
     */
    var showAll = OOS.state.allSignals;
    var crit = groups.filter(function (g) { return g.severity === 'critical'; }).length;
    var act = groups.filter(function (g) { return g.severity !== 'info'; });
    var shown = showAll ? groups : (act.length ? act : groups).slice(0, Math.max(10, crit));
    var hidden = groups.length - shown.length;

    h += '<div class="sigcards">';
    shown.forEach(function (s) { h += signalCard(s); });
    h += '</div>';
    if (hidden > 0 || showAll) {
      h += '<div class="pager sig-pager">' + UI.btn(showAll ? 'Visa färre' : 'Visa ' + hidden + ' till', 'signals-toggle', { cls: 'btn-sm' }) + '</div>';
    }
    return h + '</section>';
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

    /*
     * Ingressen är en bedömning, inte en rapport. Varje tal den skulle kunna
     * räkna upp står redan i nyckeltalen under den, och varje problem den
     * skulle kunna lista står i Att titta på. Den säger därför det de två
     * inte kan: vad läget betyder. En mening, så att den går att säga högt
     * på ett möte, och ingen fet stil eller röd text inuti stycket.
     *
     * Den mest talande sanna meningen vinner. Ordningen är avsiktlig: att
     * vara överbokad slår allt annat, och ledig tid som ändå inte hjälper
     * är det som oftast förklarar varför siffrorna ser lugna ut.
     */
    var nb = count('bottleneck');
    var ng = count('gap');
    var lede;
    if (org.loadPct > 100.5) {
      lede = 'Mer är planerat än det finns tid till.';
    } else if ((nb || ng) && org.free > 0.5) {
      lede = 'Det finns ledig kapacitet, men inte i de kompetenser som saknas.';
    } else if (nb || ng) {
      lede = 'Kompetens saknas där arbetet ligger.';
    } else if (count('overallocated')) {
      lede = 'Arbetet ligger på för få personer.';
    } else if (count('investment')) {
      lede = 'Initiativ kostar mer än de har fått.';
    } else if (unalloc.hours > org.capacity * 0.1) {
      lede = 'Mycket tid ligger hos personer utan team.';
    } else {
      lede = 'Inget avviker. Modellen hänger ihop.';
    }
    h += '<p class="lede">' + esc(lede) + '</p>';

    var lp = org.loadPct;
    h += '<div class="kpis">' +
      UI.kpi('Beläggning', U.fmtPct(lp), U.fmtH(org.loaded) + ' belastat av ' + U.fmtH(org.capacity), { crit: lp > 100.5, warn: lp >= 90 && lp <= 100.5 }) +
      UI.kpi('Ledigt', U.fmtH(org.free), 'I teamen, kan planeras') +
      UI.kpi('Inte fördelad', U.fmtH(unalloc.hours), unalloc.people.length ? 'Hos ' + plural(unalloc.people.length, 'person', 'personer') + ', i inget team' : 'All tid är fördelad') +
      UI.kpi('Kapacitet i ' + ctx.next.inText, U.fmtH(nxt.capacity), UI.delta(nxt.capacity - org.capacity, 'h') + ' mot ' + esc(month)) +
      '</div>';

    /*
     * Åtgärderna före läget. Sidan visar både vad som behöver lösas och
     * hur det står till; läget är bakgrund, åtgärderna är det man är här
     * för. Listan stod förut under ett 650 px högt kort med leveransdomäner,
     * så det man kom för låg under skärmkanten.
     */
    h += signalsCard(groupSignals(sigs), sigs.length);

    /*
     * Leveransdomänerna som rutnät av kort i stället för en lista med
     * staplar. Varje domän är en sak man kan gå in i, och kortet säger
     * samma fyra ting om var och en: läget, uppdraget, beläggningen och
     * vad som händer härnäst. Sorterade efter beläggning, så det som är
     * närmast taket läses först.
     */
    var dds = S.db.deliveryDomains.map(function (d) {
      var c = e.deliveryDomainCapacity(d.id, ctx.period);
      var n = e.deliveryDomainCapacity(d.id, ctx.next);
      return { d: d, cap: c, next: n.capacity };
    }).sort(function (a, b) { return b.cap.loadPct - a.cap.loadPct; });

    h += '<section class="card"><div class="card-head"><div><div class="card-title">Per leveransdomän</div>' +
      '<p class="card-sub">Timmar efter avdrag.</p></div></div><div class="ocards">';
    dds.forEach(function (x) {
      var free = x.cap.capacity - x.cap.loaded;
      h += C.objectCard({
        go: 'deliveryDomains:' + x.d.id,
        icon: 'layers',
        name: x.d.name,
        state: C.loadState(x.cap),
        mission: x.d.purpose || '',
        meter: { label: 'Beläggning', right: 'av ' + U.fmtH(x.cap.capacity), bar: UI.bar(x.cap.loadPct, { title: '' }) },
        stats: [
          { value: U.fmtH(x.cap.capacity), label: 'kapacitet' },
          { value: U.fmtH(x.cap.loaded), label: 'belastat' },
          { value: free < -0.5 ? U.fmtH(-free) : U.fmtH(free), label: free < -0.5 ? 'över' : 'ledigt', tone: free < -0.5 ? 'crit' : null }
        ],
        foot: 'Nästa: ' + esc(ctx.next.inText) + ' · ' + UI.delta(x.next - x.cap.capacity, 'h')
      });
    });
    h += '</div></section>';

    /*
     * Bottenraden: kort av olika slag, inte flera av samma. En andel som
     * ring och en rangordning som lista. Olika former för olika frågor —
     * ögat hittar snabbare när korten inte ser lika ut.
     *
     * Ändringsloggen stod här som ett tredje kort. Den är spårbarhet, inte
     * läge: den säger vem som ändrade vad, inte hur det står till i dag.
     * Hela loggen finns i Inställningar, dit knappen pekade ändå.
     *
     * Ringen behöver inte bredd, listan gör det — teamnamn och staplar på
     * samma rad. Därför smal spalt först, bred sedan.
     */
    var tops = S.db.teams.map(function (t) {
      return { t: t, cap: e.teamCapacity(t.id, ctx.period) };
    }).filter(function (x) { return x.cap.capacity > 0.5; })
      .sort(function (a2, b2) { return b2.cap.loadPct - a2.cap.loadPct; }).slice(0, 6);

    h += '<div class="split narrow-first">';

    h += '<section class="card"><div class="card-head"><div><div class="card-title">Beläggning</div>' +
      '<p class="card-sub">Hela organisationen i ' + esc(month) + '.</p></div></div>' +
      '<div class="donut-wrap">' + UI.donut(org.loadPct) + '<div class="donut-legend">' +
      '<div><span class="dot-sq bar"></span>' + U.fmtH(org.loaded) + ' belastat</div>' +
      '<div><span class="dot-sq track"></span>' + U.fmtH(org.free) + ' ledigt</div>' +
      '</div></div></section>';

    h += '<section class="card"><div class="card-head"><div><div class="card-title">Närmast taket</div>' +
      '<p class="card-sub">Teamen med högst beläggning.</p></div></div><div class="ranked">';
    tops.forEach(function (x) {
      h += '<button type="button" class="ranked-row" data-go="teams:' + esc(x.t.id) + '">' +
        '<span class="ranked-name">' + esc(x.t.name) + '</span>' +
        '<span class="ranked-bar">' + UI.bar(x.cap.loadPct, { title: '' }) + '</span></button>';
    });
    h += '</div></section>';

    h += '</div>';
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
    /*
     * Samma faktapanel som i lådans översikt, i stället för en egen
     * definitionslista. Två mallar för samma sak — etikett och värde —
     * gör att man läser om formen varje gång man byter flik.
     */
    h += C.factPanel([
      { icon: 'users', label: 'Ägare', value: owner ? C.link('workers:' + owner.id, owner.name) : UI.badge('Ej utsedd', 'warn') },
      supportive.length ? { icon: 'layers', label: 'Stödjande domäner', value: supportive.map(function (s) { return C.link(C.domainPage(s.domain) + ':' + s.domain.id, s.domain.name); }).join(' · ') } : null,
      { icon: 'users', label: 'Nyckelroller', span: true, value: keyRoles.length ? keyRoles.map(function (k) { return C.link('workers:' + k.worker.id, k.worker.name) + ' <span class="muted">' + esc(k.ext.role.toLowerCase()) + ', ' + k.ext.hoursPerMonth + ' h/mån</span>'; }).join(' · ') : '<span class="muted">Inga</span>' }
    ]);
    if (!cols.length) return h + '<div class="empty" style="margin-top:18px">Leveransdomänen har inga verksamhetsdomäner eller team ännu.</div>';

    /*
     * Kartan läser från vänster till höger, som meningen ovanför säger:
     * verksamhet, team, teknik. Förut stod de tre stegen under varandra
     * i en spalt per verksamhetsdomän, så kartan läste uppifrån och ned
     * och lät två tredjedelar av bredden stå tom när domänerna var få.
     * En rad per verksamhetsdomän, tre steg i bredd.
     */
    h += '<div class="fmap">';
    cols.forEach(function (c) {
      h += '<div class="fmap-row"><div class="fstage"><div class="fstage-label">Verksamhetsdomän</div>';
      if (c.bd) {
        var ex = e.domainExperts(c.bd.id);
        h += '<button type="button" class="fdomain" data-go="businessDomains:' + esc(c.bd.id) + '">' + esc(c.bd.name) + '</button>' +
          '<span class="meta">' + (ex.length ? plural(ex.length, 'expert', 'experter') + ' i domänmolnet' : 'Inget domänmoln') + '</span>';
      } else {
        h += '<span class="fdomain" style="cursor:default">Övriga</span><span class="meta">Team som når leveransdomänen via IT-domän</span>';
      }
      h += '</div><div class="fstage"><div class="fstage-label">Team</div>';
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
      h += '</div><div class="fstage"><div class="fstage-label">IT-domän</div>';
      Array.from(its.values()).forEach(function (it) {
        h += '<button type="button" class="fdomain it" data-go="itDomains:' + esc(it.id) + '">' + esc(it.name) + '</button>';
      });
      if (!its.size) h += '<span class="meta">–</span>';
      h += '</div></div>';
    });
    h += '</div>';
    return h;
  };

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
