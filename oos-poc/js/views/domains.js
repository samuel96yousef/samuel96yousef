/* Leveransdomäner, verksamhetsdomäner och IT-domäner: lista med detaljvy och flikar. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  var KINDS = {
    deliveryDomains: {
      coll: 'deliveryDomains',
      title: 'Leveransdomäner',
      singular: 'leveransdomän',
      addLabel: 'Lägg till leveransdomän',
      sub: 'En leveransdomän är den högsta nivån. Den delar upp verksamheten i större avgränsade delar och agerar beställare av utveckling.'
    },
    businessDomains: {
      coll: 'domains',
      type: 'business',
      title: 'Verksamhetsdomäner',
      singular: 'verksamhetsdomän',
      addLabel: 'Lägg till verksamhetsdomän',
      sub: 'En verksamhetsdomän är en sammanhängande del av verksamhetens processer och förmågor. Den bistår teamen med verksamhetskompetens för analys och kravställning.'
    },
    itDomains: {
      coll: 'domains',
      type: 'it',
      title: 'IT-domäner',
      singular: 'IT-domän',
      addLabel: 'Lägg till IT-domän',
      sub: 'En IT-domän grupperar system och tekniska tjänster med gemensamt syfte. Den bistår teamen med IT-kompetens för teknisk analys, utveckling och test.'
    }
  };

  function records(kind) {
    var k = KINDS[kind];
    return S.db[k.coll].filter(function (x) { return !k.type || x.type === k.type; });
  }

  function isDd(kind) {
    return kind === 'deliveryDomains';
  }

  function capOf(kind, id, period) {
    var e = S.engine();
    return isDd(kind) ? e.deliveryDomainCapacity(id, period) : e.domainCapacity(id, period);
  }

  function teamsOf(kind, id) {
    var e = S.engine();
    if (isDd(kind)) return e.teamsOfDeliveryDomain(id).map(function (t) { return { team: t, relationship: 'derived' }; });
    return e.teamsOfDomain(id);
  }

  function headcount(kind, id) {
    var e = S.engine();
    return isDd(kind) ? e.deliveryDomainHeadcount(id) : e.domainHeadcount(id);
  }

  function render(kind, ctx) {
    var k = KINDS[kind];
    var e = ctx.e;
    var recs = records(kind);
    var rows = recs.map(function (r) {
      var cap = capOf(kind, r.id, ctx.period);
      var teams = teamsOf(kind, r.id);
      return {
        id: r.id,
        rec: r,
        teams: teams.filter(function (t) { return t.relationship !== 'supportive'; }).length,
        supportTeams: teams.filter(function (t) { return t.relationship === 'supportive'; }).length,
        people: headcount(kind, r.id),
        cap: cap,
        dd: isDd(kind) ? null : e.deliveryDomainOfDomain(r.id)
      };
    });
    /* Den rad som är utfälld. Ingen från början: listan ger överblick, ett klick visar detaljerna. */
    var openId = ctx.id && rows.some(function (r) { return r.id === ctx.id; }) ? ctx.id : null;
    var totalTeams = isDd(kind) ? S.db.teams.length : new Set(rows.reduce(function (acc, r) {
      return acc.concat(e.teamsOfDomain(r.id).filter(function (t) { return t.relationship === 'primary'; }).map(function (t) { return t.team.id; }));
    }, [])).size;
    var totalCap = U.sum(rows, function (r) { return r.cap.capacity; });
    var totalLoaded = U.sum(rows, function (r) { return r.cap.loaded; });
    var totalReserved = U.sum(rows, function (r) { return r.cap.reserved || 0; });

    var cols = [
      {
        key: 'name', label: 'Namn', sort: function (r) { return r.rec.name; },
        render: function (r) { return '<span class="name-cell">' + UI.avatar(r.rec.name, r.id, isDd(kind) ? { text: r.rec.name[0] } : {}) + '<span class="name">' + esc(r.rec.name) + '</span></span>'; }
      },
      { key: 'desc', label: 'Beskrivning', cls: 'desc', opt: 2, render: function (r) { return '<span class="muted">' + esc(r.rec.description) + '</span>'; } }
    ];
    if (!isDd(kind)) {
      cols.push({ key: 'dd', label: 'Leveransdomän', opt: 1, sort: function (r) { return r.dd ? r.dd.name : 'ö'; }, render: function (r) { return r.dd ? esc(r.dd.name) : '<span class="muted">Saknas</span>'; } });
    } else {
      cols.push({ key: 'obj', label: 'Primärt uppdrag', opt: 2, render: function (r) { return r.rec.primaryObjective === 'it' ? 'IT-leverans' : 'Verksamhetsleverans'; } });
    }
    cols.push(
      { key: 'teams', label: 'Team', cls: 'num', opt: 1, sort: function (r) { return r.teams; }, render: function (r) { return r.teams + (r.supportTeams ? '<span class="muted small"> +' + r.supportTeams + '</span>' : ''); } },
      { key: 'people', label: 'Arbetare', cls: 'num', opt: 1, sort: function (r) { return r.people; }, render: function (r) { return r.people; } },
      { key: 'cap', label: 'Kapacitet', cls: 'num', sort: function (r) { return r.cap.capacity; }, render: function (r) { return U.fmtH(r.cap.capacity); } },
      { key: 'load', label: 'Beläggning', sort: function (r) { return r.cap.loadPct; }, render: function (r) { return r.cap.capacity ? UI.bar(r.cap.loadPct) : '<span class="muted">–</span>'; } }
    );

    var h = UI.pageHead({
      title: esc(k.title),
      sub: esc(k.sub),
      actions: UI.btn(k.addLabel, 'domain-add', { cls: 'btn-primary', data: { kind: kind } })
    });
    h += '<div class="kpis">' +
      UI.kpi(k.title, rows.length, isDd(kind) ? U.plural(S.db.domains.length, 'domän', 'domäner') + ' under dem' : U.plural(rows.filter(function (r) { return r.dd; }).length, 'med leveransdomän', 'med leveransdomän')) +
      UI.kpi('Team', totalTeams, isDd(kind) ? 'Alla team hör till en leveransdomän' : 'Med en av domänerna som primär') +
      UI.kpi('Kapacitet i ' + ctx.period.inText, U.fmtH(totalCap), 'Teamen, efter avdrag' + (totalReserved > 0.5 ? ' · ' + U.fmtH(totalReserved) + ' i domänroller' : '')) +
      UI.kpi('Beläggning', U.fmtPct(totalCap ? (totalLoaded / totalCap) * 100 : 0), U.fmtH(totalLoaded) + ' belastat, ' + U.fmtH(Math.max(0, totalCap - totalLoaded)) + ' ledigt') +
      '</div>';
    h += '<section class="card">' + UI.table({
      id: 'tbl-' + kind,
      title: 'Alla ' + esc(k.title.toLowerCase()),
      rows: rows,
      columns: cols,
      /* Utöver kolumnerna: syfte och ägare. */
      search: {
        placeholder: 'Sök ' + k.singular + ' …',
        text: function (r) {
          var owner = r.rec.ownerId ? e.get('workers', r.rec.ownerId) : null;
          return [r.rec.purpose, owner ? owner.name : ''].join(' ');
        }
      },
      rowGo: function (r) { return r.id === openId ? kind : kind + ':' + r.id; },
      expand: function (r) { return detail(kind, r.rec, ctx); },
      expandedId: openId,
      defaultSort: 'name',
      noun: k.title.toLowerCase()
    }) + '</section>';
    return h;
  }

  function detail(kind, d, ctx) {
    var e = ctx.e;
    var tab = OOS.tab(kind + '-detail', 'overview');
    var tabsList = [
      { key: 'overview', label: 'Översikt' },
      { key: 'links', label: 'Domänkopplingar' },
      { key: 'teams', label: 'Team' },
      { key: 'systems', label: 'System' },
      { key: 'experts', label: isDd(kind) ? 'Nyckelroller' : 'Domänmoln' },
      { key: 'capacity', label: 'Kapacitet' }
    ];
    var body;
    if (tab === 'overview') body = overview(kind, d, ctx);
    else if (tab === 'links') body = links(kind, d, ctx);
    else if (tab === 'teams') body = teams(kind, d, ctx);
    else if (tab === 'systems') body = systems(kind, d, ctx);
    else if (tab === 'experts') body = experts(kind, d, ctx);
    else body = capacity(kind, d, ctx);
    return C.drawer({
      title: d.name,
      tabs: UI.tabs(kind + '-detail', tabsList, tab),
      actions: C.drawerActions({ action: 'domain-edit', data: { kind: kind, id: d.id } }, { action: 'domain-delete', data: { kind: kind, id: d.id } }),
      body: body
    });
  }

  /* Översikten: vad domänen är till för, vem som äger den och hur kapaciteten fördelar sig. */
  function overview(kind, d, ctx) {
    var e = ctx.e;
    var owner = d.ownerId ? e.get('workers', d.ownerId) : null;
    var cap = capOf(kind, d.id, ctx.period);
    var ownerLabel = isDd(kind) ? 'Leveransdomänägare' : kind === 'itDomains' ? 'Domänansvarig' : 'Verksamhetsdomänansvarig';
    /*
     * Kapacitet, beläggning, team och arbetare står redan på raden ovanför. Här står det raden
     * inte visar: syfte, ägare och hur kapaciteten fördelar sig. Beskrivningen visas bara när
     * kolumnen är dold (klassen dup-2, se app.css).
     */
    var rows = [[ownerLabel, owner ? C.workerRef(owner, owner.title) : UI.badge('Ej utsedd', 'warn')]];
    if (isDd(kind)) rows.push(['Primärt uppdrag', d.primaryObjective === 'it' ? 'IT-leverans' : 'Verksamhetsleverans']);
    else {
      var dd = e.deliveryDomainOfDomain(d.id);
      rows.push(['Leveransdomän', dd ? C.ddRef(dd) : UI.badge('Saknas', 'warn')]);
    }
    rows.push(['Kapacitet i ' + ctx.period.inText, cap.capacity ? U.fmtH(cap.loaded) + ' belastat av ' + U.fmtH(cap.capacity) + (cap.free >= 0 ? ', ' + U.fmtH(cap.free) + ' ledigt' : '') : '–']);
    rows.push(['Status', d.status === 'inactive' ? UI.statusBadge(d.status) : 'Aktiv']);
    rows.push(['Senast ändrad', d.updated ? U.fmtDate(d.updated) : '']);
    return '<div class="drawer-grid two">' +
      '<div>' + C.drawerSection('Syfte', '<p class="drawer-text">' + esc(d.purpose || 'Inget syfte angivet.') + '</p>') +
      '<div class="dup-2">' + C.drawerSection('Beskrivning', '<p class="drawer-text">' + esc(d.description || '–') + '</p>') + '</div></div>' +
      C.drawerSection('Uppgifter', UI.props(rows)) + '</div>';
  }

  function links(kind, d, ctx) {
    var e = ctx.e;
    var h = '';
    if (isDd(kind)) {
      var list = e.domainsOfDeliveryDomain(d.id);
      h += '<div class="row-between" style="margin-bottom:12px"><p class="muted small">Domänklustret: de verksamhets- och IT-domäner som ingår i leveransdomänen.</p>' +
        UI.btn('Koppla domän', 'cluster-add-dd', { cls: 'btn-sm', data: { id: d.id } }) + '</div>';
      h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Domän</th><th data-opt="2">Typ</th><th>Relation</th><th class="num" data-opt="1">Team (primär)</th><th class="actions"><span class="sr-only">Åtgärder</span></th></tr></thead><tbody>';
      list.sort(function (a, b) { return a.domain.type === b.domain.type ? U.byName(a.domain, b.domain) : a.domain.type === 'business' ? -1 : 1; }).forEach(function (x) {
        var n = e.teamsOfDomain(x.domain.id).filter(function (t) { return t.relationship === 'primary'; }).length;
        h += '<tr><td>' + C.domainRef(x.domain) + '</td><td>' + (x.domain.type === 'it' ? 'IT-domän' : 'Verksamhetsdomän') + '</td><td>' + C.relLabel(x.relationship) + '</td><td class="num">' + n + '</td><td class="actions">' +
          UI.iconBtn('trash', 'link-remove', { coll: 'domainClusters', id: x.cluster.id, msg: x.domain.name + ' kopplas bort från ' + d.name + '.' }, 'Koppla bort', 'danger') + '</td></tr>';
      });
      if (!list.length) h += '<tr><td colspan="5"><div class="empty">Inga domäner kopplade ännu.</div></td></tr>';
      h += '</tbody></table></div>';
      return h;
    }
    var clusters = e.clustersOfDomain(d.id);
    h += '<div class="grid-2"><div class="stack"><div class="row-between"><h3 class="card-title">Leveransdomäner</h3>' + UI.btn('Koppla', 'cluster-add-domain', { cls: 'btn-sm', data: { id: d.id } }) + '</div>';
    h += '<div class="list">';
    clusters.forEach(function (c) {
      h += '<div class="list-item"><div class="grow">' + C.ddRef(c.deliveryDomain) + '</div>' + C.relLabel(c.relationship) +
        UI.iconBtn('trash', 'link-remove', { coll: 'domainClusters', id: c.cluster.id, msg: d.name + ' kopplas bort från ' + c.deliveryDomain.name + '.' }, 'Koppla bort', 'danger') + '</div>';
    });
    if (!clusters.length) h += '<div class="empty">Domänen tillhör ingen leveransdomän.</div>';
    h += '</div></div>';

    /* Relaterade domäner härleds från teamen: vilka andra domäner teamen i denna domän arbetar mot. */
    var related = new Map();
    e.teamsOfDomain(d.id).forEach(function (t) {
      e.teamDomains(t.team.id).forEach(function (x) {
        if (x.domain.id === d.id) return;
        if (!related.has(x.domain.id)) related.set(x.domain.id, { domain: x.domain, teams: [] });
        related.get(x.domain.id).teams.push(t.team.name);
      });
    });
    var rel = Array.from(related.values()).sort(function (a, b) { return a.domain.type === b.domain.type ? U.byName(a.domain, b.domain) : a.domain.type === 'business' ? -1 : 1; });
    h += '<div class="stack"><h3 class="card-title">' + (d.type === 'it' ? 'Motsvarande och relaterade domäner' : 'Motsvarande IT-domäner och relaterade domäner') + '</h3>' +
      '<p class="muted small">Härleds från de team som är kopplade till ' + esc(d.name) + '.</p><div class="list">';
    rel.forEach(function (r) {
      h += '<div class="list-item"><div class="grow">' + C.domainRef(r.domain) + '<div class="muted small">via ' + esc(r.teams.join(', ')) + '</div></div>' +
        UI.badge(r.domain.type === 'it' ? 'IT' : 'Verksamhet', r.domain.type === 'it' ? 'info' : 'muted') + '</div>';
    });
    if (!rel.length) h += '<div class="empty">Inga relaterade domäner.</div>';
    h += '</div></div></div>';
    return h;
  }

  function teams(kind, d, ctx) {
    var e = ctx.e;
    var list = teamsOf(kind, d.id);
    var h = '<div class="row-between" style="margin-bottom:12px"><p class="muted small">' +
      (isDd(kind) ? 'Team vars primära verksamhetsdomän tillhör leveransdomänen.' : 'Team med primär eller stödjande koppling. Kapaciteten räknas bara på primära team.') + '</p>' +
      (isDd(kind) ? '' : UI.btn('Koppla team', 'domain-team-add', { cls: 'btn-sm', data: { id: d.id } })) + '</div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Team</th>' + (isDd(kind) ? '<th>Primär verksamhetsdomän</th>' : '<th>Relation</th>') +
      '<th data-opt="2">Kategori</th><th class="num" data-opt="1">Medlemmar</th><th class="num">Kapacitet</th><th>Beläggning</th><th class="actions"><span class="sr-only">Åtgärder</span></th></tr></thead><tbody>';
    list.sort(function (a, b) {
      if (a.relationship !== b.relationship) return a.relationship === 'primary' ? -1 : 1;
      return U.byName(a.team, b.team);
    }).forEach(function (x) {
      var tc = e.teamCapacity(x.team.id, ctx.period);
      h += '<tr><td>' + C.teamRef(x.team) + '</td><td>' + (isDd(kind) ? C.domainRef(e.teamPrimaryDomain(x.team.id, 'business')) : C.relLabel(x.relationship)) + '</td>' +
        '<td>' + C.categoryLabel(x.team.category) + '</td><td class="num">' + tc.headcount + '</td><td class="num">' + U.fmtH(tc.capacity) + '</td><td>' + UI.bar(tc.loadPct) + '</td><td class="actions">' +
        (x.link && x.relationship === 'supportive' ? UI.iconBtn('trash', 'link-remove', { coll: 'teamDomains', id: x.link.id, msg: x.team.name + ' kopplas bort från ' + d.name + '.' }, 'Koppla bort', 'danger') : '') + '</td></tr>';
    });
    if (!list.length) h += '<tr><td colspan="7"><div class="empty">Inga team kopplade.</div></td></tr>';
    h += '</tbody></table></div>';
    return h;
  }

  function systems(kind, d, ctx) {
    var e = ctx.e;
    var list = isDd(kind) ? e.systemsOfDeliveryDomain(d.id) : e.systemsOfDomain(d.id);
    var h = '<div class="row-between" style="margin-bottom:12px"><p class="muted small">System som ' + esc(d.name) + ' ansvarar för via sina team' + (kind === 'itDomains' ? ' eller direkt som IT-domän.' : '.') + '</p>' +
      (kind === 'itDomains' ? UI.btn('Koppla system', 'itsys-add-domain', { cls: 'btn-sm', data: { id: d.id } }) : '') + '</div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>System</th><th data-opt="2">Typ</th><th>Ansvarigt team</th><th data-opt="1">Primär IT-domän</th><th data-opt="1">Status</th></tr></thead><tbody>';
    list.sort(function (a, b) { return U.byName(a.system, b.system); }).forEach(function (x) {
      h += '<tr><td>' + C.systemRef(x.system) + '</td><td>' + esc(x.system.kind) + '</td><td>' + C.teamRef(e.systemResponsibleTeam(x.system.id)) + '</td><td>' + C.domainRef(e.systemPrimaryItDomain(x.system.id)) + '</td><td>' + UI.statusBadge(x.system.status) + '</td></tr>';
    });
    if (!list.length) h += '<tr><td colspan="5"><div class="empty">Inga system.</div></td></tr>';
    h += '</tbody></table></div>';
    return h;
  }

  function experts(kind, d, ctx) {
    var e = ctx.e;
    var list = isDd(kind) ? e.deliveryDomainExperts(d.id) : e.domainExperts(d.id);
    var h = '<div class="row-between" style="margin-bottom:12px"><p class="muted small">' +
      (isDd(kind)
        ? 'Nyckelroller som arbetar för hela leveransdomänen, till exempel projektledare, arkitekter och ägare.'
        : 'Domänmolnet är kompetens som bistår teamen utan att vara teammedlem, till exempel system- och processexperter. Tiden räknas till domänens kapacitet.') + '</p>' +
      UI.btn(isDd(kind) ? 'Lägg till nyckelroll' : 'Lägg till i domänmolnet', 'expert-add', { cls: 'btn-sm', data: { kind: isDd(kind) ? 'delivery' : 'domain', id: d.id } }) + '</div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Arbetare</th><th data-opt="1">Roll</th><th data-opt="2">Primär kompetens</th><th class="num">h/mån</th><th class="num" data-opt="1">I perioden</th><th data-opt="2">Gäller</th><th class="actions"><span class="sr-only">Åtgärder</span></th></tr></thead><tbody>';
    list.forEach(function (x) {
      var comps = e.attributionCompetences(x.worker.id);
      var hrs = OOSEngine.monthlyHoursInPeriod(x.ext.hoursPerMonth, x.ext.from, x.ext.to, ctx.period);
      h += '<tr><td>' + C.workerRef(x.worker, x.worker.title) + '</td><td>' + esc(x.ext.role) + '</td><td>' + comps.map(C.compRef).join(', ') + '</td>' +
        '<td class="num">' + U.fmtNum(x.ext.hoursPerMonth) + '</td><td class="num">' + U.fmtH(hrs) + '</td><td class="small">' + U.fmtDate(x.ext.from) + ' – ' + U.fmtDate(x.ext.to) + '</td><td class="actions">' +
        UI.iconBtn('edit', 'expert-edit', { kind: isDd(kind) ? 'delivery' : 'domain', id: x.ext.id }, 'Ändra') + '</td></tr>';
    });
    if (!list.length) h += '<tr><td colspan="7"><div class="empty">Inga roller ännu.</div></td></tr>';
    h += '</tbody></table></div>';
    return h;
  }

  function capacity(kind, d, ctx) {
    var cur = capOf(kind, d.id, ctx.period);
    var nxt = capOf(kind, d.id, ctx.next);
    var h = '<div class="grid-4" style="margin-bottom:16px">' +
      '<div class="field-block"><span class="label">Kapacitet ' + esc(ctx.period.inText) + '</span><span class="big">' + U.fmtH(cur.capacity) + '</span></div>' +
      '<div class="field-block"><span class="label">Belastat</span><span class="big">' + U.fmtH(cur.loaded) + '</span></div>' +
      '<div class="field-block"><span class="label">Ledigt</span><span class="big">' + U.fmtH(cur.free) + '</span></div>' +
      '<div class="field-block"><span class="label">' + esc(ctx.next.label) + '</span><span class="big">' + U.fmtH(nxt.capacity) + '</span><span class="muted small">' + U.fmtSigned(nxt.capacity - cur.capacity, ' h') + ' mot denna period</span></div></div>';
    if (cur.reserved > 0.5) h += '<p class="muted small" style="margin:-4px 0 14px">' + U.fmtH(cur.reserved) + ' är reserverat i domänroller. Den tiden räknas inte i beläggning eller ledigt.</p>';
    h += '<div class="grid-2"><div><h3 class="card-title" style="margin-bottom:8px">Per team och domänroll</h3>' + capTable(cur.byTeam, true) + '</div>' +
      '<div><h3 class="card-title" style="margin-bottom:8px">Per kompetens</h3>' + capTable(cur.byCompetence, false) + '</div></div>';
    return h;
  }

  function capTable(rows, isTeam) {
    var h = '<div class="table-wrap"><table class="tbl"><thead><tr><th>' + (isTeam ? 'Team' : 'Kompetens') + '</th><th class="num" data-opt="1">Pers.</th><th class="num">Kapacitet</th><th class="num" data-opt="2">Ledigt</th><th>Beläggning</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var name = isTeam ? (r.team ? C.teamRef(r.team) : '<span class="name-cell"><span>' + esc(r.name) + '</span></span>') : C.compRef(r.competence);
      /* Domänroller är reserverad tid: timmarna står med, men ingen beläggning eller ledig tid. */
      if (!r.capacity && r.reserved > 0.5) {
        h += '<tr><td>' + name + '</td><td class="num">' + r.people + '</td><td class="num">' + U.fmtH(r.reserved) + '</td><td class="num"><span class="muted">–</span></td><td><span class="muted small">Reserverad</span></td></tr>';
        return;
      }
      h += '<tr><td>' + name + '</td><td class="num">' + r.people + '</td><td class="num">' + U.fmtH(r.capacity) + '</td><td class="num">' + U.fmtH(r.free) + '</td><td>' + UI.bar(r.loadPct) + '</td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="5"><div class="empty">Ingen kapacitet i perioden.</div></td></tr>';
    return h + '</tbody></table></div>';
  }

  Object.keys(KINDS).forEach(function (kind) {
    OOS.views[kind] = function (ctx) { return render(kind, ctx); };
  });

  var A = OOS.actions;
  A['domain-add'] = function (el) {
    var kind = el.dataset.kind;
    if (isDd(kind)) C.forms.deliveryDomain(null);
    else C.forms.domain(KINDS[kind].type, null);
  };
  A['domain-edit'] = function (el) {
    var kind = el.dataset.kind;
    var rec = S.engine().get(KINDS[kind].coll, el.dataset.id);
    if (isDd(kind)) C.forms.deliveryDomain(rec);
    else C.forms.domain(rec.type, rec);
  };
  A['domain-delete'] = function (el) {
    C.removeEntity(KINDS[el.dataset.kind].coll, el.dataset.id, el.dataset.kind);
  };
  A['cluster-add-dd'] = function (el) { C.forms.clusterFromDd(el.dataset.id); };
  A['cluster-add-domain'] = function (el) { C.forms.clusterFromDomain(el.dataset.id); };
  A['domain-team-add'] = function (el) { C.forms.domainTeam(el.dataset.id); };
  A['itsys-add-domain'] = function (el) { C.forms.itDomainSystem({ domainId: el.dataset.id }); };
  A['expert-add'] = function (el) { C.forms.expert(el.dataset.kind, el.dataset.id, null); };
  A['expert-edit'] = function (el) {
    var coll = el.dataset.kind === 'delivery' ? 'extendedDeliveryCompetences' : 'extendedDomainCompetences';
    var ext = S.engine().get(coll, el.dataset.id);
    C.forms.expert(el.dataset.kind, ext.domainId || ext.deliveryDomainId, ext, ext.workerId);
  };
  A['link-remove'] = function (el) { C.removeLink(el.dataset.coll, el.dataset.id, el.dataset.msg); };
})();
