/* Kompetenser och system. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  /* ---------- Kompetenser ---------- */

  OOS.views.competences = function (ctx) {
    var e = ctx.e;
    var facts = e.allFacts(ctx.period);
    var capBy = new Map();
    facts.forEach(function (f) { capBy.set(f.competenceId, (capBy.get(f.competenceId) || 0) + f.capacity); });
    var rows = S.db.competences.map(function (c) {
      var holders = e.competenceHolders(c.id);
      return {
        id: c.id,
        c: c,
        holders: holders.length,
        advanced: holders.filter(function (h) { return h.wc.level >= 3; }).length,
        cap: capBy.get(c.id) || 0
      };
    });
    var withComp = new Set(S.db.workerCompetences.map(function (x) { return x.workerId; })).size;
    var tab = OOS.tab('competences', 'all');
    var selected = ctx.id ? e.get('competences', ctx.id) : null;
    /* Samma definition som signalen på översikten: exakt en person på nivå 3–4. */
    var risky = rows.filter(function (r) { return r.advanced === 1; }).length;

    var h = UI.pageHead({
      title: 'Kompetenser',
      sub: 'Kompetenser beskriver vad arbetarna kan och på vilken nivå. De används för att räkna kapacitet per kompetens och för att hitta kunskap som bara finns hos en person.',
      actions: UI.btn('Lägg till kompetens', 'comp-add', { cls: 'btn-primary' })
    });
    h += '<div class="kpis">' +
      UI.kpi('Kompetenser', rows.length, U.plural(C.categories().length, 'kategori', 'kategorier')) +
      UI.kpi('Arbetare med kompetens', withComp, 'Av ' + S.db.workers.length + ' arbetare') +
      UI.kpi('Bärs av en person', risky, 'Bara en person på nivå 3–4') +
      UI.kpi('Utan kapacitet', rows.filter(function (r) { return !r.cap; }).length, 'Ingen har den som primär kompetens') +
      '</div>';

    h += '<section class="card">';
    h += UI.tabs('competences', [{ key: 'all', label: 'Alla kompetenser' }, { key: 'categories', label: 'Kompetenskategorier' }], tab);
    if (tab === 'all') {
      h += UI.table({
        id: 'tbl-comp',
        rows: rows,
        search: { placeholder: 'Sök kompetens, kategori …', text: function (r) { return [r.c.category, r.c.description, r.c.details].join(' '); } },
        rowGo: function (r) { return selected && r.id === selected.id ? 'competences' : 'competences:' + r.id; },
        expand: function (r) { return panel(r.c, ctx, capBy.get(r.id) || 0); },
        expandedId: selected ? selected.id : null,
        defaultSort: 'name',
        noun: 'kompetenser',
        columns: [
          { key: 'name', label: 'Kompetens', sort: function (r) { return r.c.name; }, render: function (r) { return '<span class="name-cell">' + UI.avatar(r.c.name, r.c.category, { size: 'sm' }) + '<span><span class="name">' + esc(r.c.name) + '</span><br><span class="sub">' + esc(r.c.category) + '</span></span></span>'; } },
          { key: 'holders', label: 'Arbetare', cls: 'num', sort: function (r) { return r.holders; }, render: function (r) { return r.holders; } },
          {
            key: 'adv', label: 'Nivå 3–4', cls: 'num', sort: function (r) { return r.advanced; },
            render: function (r) { return r.advanced === 1 ? UI.badge('1', 'warn') : r.advanced; }
          },
          { key: 'cap', label: 'Kapacitet', cls: 'num', sort: function (r) { return r.cap; }, render: function (r) { return r.cap ? U.fmtH(r.cap) : '<span class="muted">–</span>'; } }
        ]
      });
    } else {
      var cats = U.groupBy(rows, function (r) { return r.c.category; });
      var catRows = Array.from(cats.entries()).map(function (entry) {
        var people = new Set();
        entry[1].forEach(function (r) { e.competenceHolders(r.id).forEach(function (hh) { people.add(hh.worker.id); }); });
        return { id: entry[0], name: entry[0], count: entry[1].length, people: people.size, cap: U.sum(entry[1], function (r) { return r.cap; }), names: entry[1].map(function (r) { return r.c.name; }).sort().join(', ') };
      });
      h += UI.table({
        id: 'tbl-comp-cat',
        rows: catRows,
        defaultSort: 'name',
        pageSize: 0,
        columns: [
          { key: 'name', label: 'Kategori', sort: function (r) { return r.name; }, render: function (r) { return '<strong>' + esc(r.name) + '</strong><br><span class="muted small">' + esc(r.names) + '</span>'; } },
          { key: 'count', label: 'Kompetenser', cls: 'num', sort: function (r) { return r.count; }, render: function (r) { return r.count; } },
          { key: 'people', label: 'Arbetare', cls: 'num', sort: function (r) { return r.people; }, render: function (r) { return r.people; } },
          { key: 'cap', label: 'Kapacitet (period)', cls: 'num', sort: function (r) { return r.cap; }, render: function (r) { return U.fmtH(r.cap); } }
        ]
      });
    }
    h += '</section>';
    return h;
  };

  function panel(c, ctx, cap) {
    var e = ctx.e;
    var holders = e.competenceHolders(c.id);
    var adv = holders.filter(function (h) { return h.wc.level >= 3; });
    var tab = OOS.tab('comp-panel', 'overview');
    var h = '<section class="card"><div class="panel-head">' + UI.avatar(c.name, c.category, { size: 'lg' }) +
      '<div class="grow"><h2 style="font-size:18px">' + esc(c.name) + '</h2><span class="muted">' + esc(c.category) + ' · ' + (c.type === 'business' ? 'Verksamhet' : 'IT') + '</span></div>' +
      UI.btn('Redigera', 'comp-edit', { cls: 'btn-sm', data: { id: c.id } }) + '</div>';
    h += UI.tabs('comp-panel', [{ key: 'overview', label: 'Översikt' }, { key: 'levels', label: 'Nivåer' }, { key: 'workers', label: 'Arbetare (' + holders.length + ')' }], tab);
    h += '<div class="card-body stack">';
    if (tab === 'overview') {
      if (adv.length === 1) {
        h += '<div class="note warn">' + esc(adv[0].worker.name) + ' är ensam om nivå 3–4. Kunskapen riskerar att försvinna vid rollbyte eller frånvaro.</div>';
      } else if (holders.length && !adv.length) {
        h += '<div class="note">Ingen har kompetensen på nivå 3–4 ännu.</div>';
      }
      h += '<div class="facts-mini"><div><span class="label">Arbetare</span><strong>' + holders.length + '</strong></div><div><span class="label">På nivå 3–4</span><strong' + (adv.length === 1 ? ' class="warn"' : '') + '>' + adv.length + '</strong></div>' +
        '<div><span class="label">Kapacitet</span><strong>' + U.fmtH(cap) + '</strong></div></div>';
      if (c.description) h += '<p class="aside-text">' + esc(c.description) + '</p>';
      if (c.details) h += '<p class="aside-text muted">' + esc(c.details) + '</p>';
      h += UI.props([['Kategori', esc(c.category)], ['Område', c.type === 'business' ? 'Verksamhet' : 'IT'], ['Kapacitet räknas på', 'Primär kompetens, ' + esc(ctx.period.inText)]]);
    } else if (tab === 'levels') {
      h += '<table class="tbl"><thead><tr><th>Nivå</th><th>Namn</th><th>Beskrivning</th><th class="num">Antal</th></tr></thead><tbody>';
      var desc = ['', 'Har grundläggande kunskap och kan utföra enklare uppgifter med stöd.', 'Kan arbeta självständigt med vanliga uppgifter.', 'Har djup kunskap och kan hantera komplexa uppgifter.', 'Mycket hög kompetens och kan leda och coacha andra.'];
      [1, 2, 3, 4].forEach(function (n) {
        h += '<tr><td>' + UI.level(n) + '</td><td>' + UI.LEVELS[n] + '</td><td class="small">' + desc[n] + '</td><td class="num">' + holders.filter(function (x) { return x.wc.level === n; }).length + '</td></tr>';
      });
      h += '</tbody></table><p class="muted small">Nivåerna är gemensamma för alla kompetenser i Prototyp 1.</p>';
    } else {
      h += '<div class="list">';
      holders.forEach(function (x) {
        var pd = e.workerPrimaryDomains(x.worker.id);
        h += '<div class="list-item"><div class="grow">' + C.workerRef(x.worker, (pd.team ? pd.team.name : x.worker.title) || '') + '</div>' +
          (x.wc.weight === 'primary' ? UI.badge('Primär', 'accent') : '') + UI.level(x.wc.level) + '</div>';
      });
      if (!holders.length) h += '<div class="empty">Ingen har kompetensen ännu.</div>';
      h += '</div>';
    }
    h += '</div><div class="card-body" style="border-top:1px solid var(--line)">' + UI.btn('Ta bort kompetens', 'comp-delete', { cls: 'btn-sm btn-danger', data: { id: c.id } }) + '</div></section>';
    return h;
  }

  /* ---------- System ---------- */

  OOS.views.systems = function (ctx) {
    var e = ctx.e;
    var rows = S.db.systems.map(function (s) {
      return { id: s.id, s: s, it: e.systemPrimaryItDomain(s.id), owner: e.systemResponsibleTeam(s.id), teams: e.systemTeams(s.id).length };
    });
    var h = UI.pageHead({
      title: 'System',
      sub: 'System och tjänster kopplas till team och IT-domäner. Varje system ska ha ett ansvarigt team.',
      actions: UI.btn('Lägg till system', 'system-add', { cls: 'btn-primary' })
    });
    var orphan = rows.filter(function (r) { return !r.owner; }).length;
    h += '<div class="kpis">' +
      UI.kpi('System', rows.length, U.plural(new Set(rows.map(function (r) { return r.s.kind; })).size, 'typ', 'typer')) +
      UI.kpi('I drift', rows.filter(function (r) { return r.s.status === 'production'; }).length, 'Används i verksamheten') +
      UI.kpi('Under utveckling', rows.filter(function (r) { return r.s.status === 'development'; }).length, 'Inte i drift ännu') +
      UI.kpi('Utan ansvarigt team', orphan, orphan ? 'Behöver en ägare' : 'Alla har ett ansvarigt team') +
      '</div>';
    var selected = ctx.id ? e.get('systems', ctx.id) : null;
    h += '<section class="card">' + UI.table({
      id: 'tbl-systems',
      rows: rows,
      title: 'Alla system',
      /* Utöver kolumnerna: alla kopplade team och IT-domäner. */
      search: {
        placeholder: 'Sök system, team, domän …',
        text: function (r) {
          return e.systemTeams(r.id).map(function (x) { return x.team.name; })
            .concat(e.systemItDomains(r.id).map(function (x) { return x.domain.name; }))
            .join(' ');
        }
      },
      rowGo: function (r) { return selected && r.id === selected.id ? 'systems' : 'systems:' + r.id; },
      expand: function (r) { return systemDetail(r.s, ctx); },
      expandedId: selected ? selected.id : null,
      defaultSort: 'name',
      noun: 'system',
      columns: [
        { key: 'name', label: 'Namn', sort: function (r) { return r.s.name; }, render: function (r) { return '<span class="name-cell">' + UI.avatar(r.s.name, r.id) + '<span class="name">' + esc(r.s.name) + '</span></span>'; } },
        { key: 'desc', label: 'Kort beskrivning', cls: 'desc', opt: 2, render: function (r) { return '<span class="muted">' + esc(r.s.description) + '</span>'; } },
        { key: 'kind', label: 'Typ', opt: 2, sort: function (r) { return r.s.kind; }, render: function (r) { return r.s.kind ? esc(r.s.kind) : '<span class="muted">–</span>'; } },
        { key: 'it', label: 'Primär IT-domän', opt: 1, sort: function (r) { return r.it ? r.it.name : 'ö'; }, render: function (r) { return r.it ? esc(r.it.name) : UI.badge('Saknas', 'warn'); } },
        { key: 'owner', label: 'Ansvarigt team', sort: function (r) { return r.owner ? r.owner.name : 'ö'; }, render: function (r) { return r.owner ? esc(r.owner.name) : UI.badge('Saknas', 'warn'); } },
        { key: 'status', label: 'Status', opt: 1, sort: function (r) { return r.s.status; }, render: function (r) { return UI.statusBadge(r.s.status); } }
      ]
    }) + '</section>';
    return h;
  };

  /* Detaljkort för ett system: vad det är, vem som ansvarar och var det hör hemma. */
  function systemDetail(s, ctx) {
    var e = ctx.e;
    var teams = e.systemTeams(s.id);
    var doms = e.systemItDomains(s.id);
    var owner = e.systemResponsibleTeam(s.id);
    var h = '<section class="card" id="detail" aria-labelledby="detail-title">';
    h += '<div class="detail-head"><div><div class="eyebrow">System</div><h2 class="detail-title" id="detail-title">' + esc(s.name) + ' ' + UI.statusFlag(s.status) + '</h2></div><div class="row">' +
      UI.btn('Redigera', 'system-edit', { data: { id: s.id } }) + UI.btn('Ta bort', 'system-delete', { cls: 'btn-danger', data: { id: s.id } }) + '</div></div>';
    if (!owner) h += '<div class="note warn" style="margin-bottom:24px"><strong>Systemet saknar ansvarigt team.</strong> Koppla ett team och ange att det ansvarar.</div>';
    h += '<div class="detail-cols">';

    var tl = '<div class="aside-list">';
    teams.forEach(function (x) {
      tl += '<div class="list-item"><div class="grow">' + C.teamRef(x.team) + '<div class="muted small">' + (x.link.objective === 'owner' ? 'Ansvarar för systemet' : 'Bidrar') + '</div></div>' +
        UI.iconBtn('x', 'link-remove', { coll: 'teamSystems', id: x.link.id, msg: x.team.name + ' kopplas bort från ' + s.name + '.' }, 'Koppla bort ' + x.team.name, 'danger') + '</div>';
    });
    if (!teams.length) tl += '<span class="muted small">Inga team kopplade.</span>';
    h += '<div class="stack-lg" style="gap:28px"><div class="prose"><div class="field-block"><span class="label">Beskrivning</span><p>' + esc(s.description || '–') + '</p></div></div>' +
      UI.asideBlock('Team', tl + '</div>', UI.iconBtn('plus', 'system-team-add', { id: s.id }, 'Koppla team')) + '</div>';

    var dl = '<div class="aside-list">';
    doms.forEach(function (x) {
      dl += '<div class="list-item"><div class="grow">' + C.domainRef(x.domain) + '<div class="muted small">' + (x.relationship === 'primary' ? 'Primär' : 'Stödjande') + '</div></div>' +
        UI.iconBtn('x', 'link-remove', { coll: 'itDomainSystems', id: x.link.id, msg: s.name + ' kopplas bort från ' + x.domain.name + '.' }, 'Koppla bort ' + x.domain.name, 'danger') + '</div>';
    });
    if (!doms.length) dl += '<span class="muted small">Ingen IT-domän kopplad.</span>';
    h += '<div class="stack-lg" style="gap:28px">' + UI.props([
      ['Ansvarigt team', owner ? C.teamRef(owner) : UI.badge('Saknas', 'warn')],
      ['Typ', esc(s.kind || '')],
      ['Kategori', { system: 'System', service: 'Tjänst', interface: 'Gränssnitt', function: 'Funktion' }[s.category] || ''],
      ['Status', s.status === 'production' ? 'I drift' : UI.statusBadge(s.status)]
    ]) + UI.asideBlock('IT-domäner', dl + '</div>', UI.iconBtn('plus', 'system-it-add', { id: s.id }, 'Koppla IT-domän')) + '</div>';
    h += '</div></section>';
    return h;
  }

  var A = OOS.actions;
  A['comp-add'] = function () { C.forms.competence(null); };
  A['comp-edit'] = function (el) { C.forms.competence(S.engine().get('competences', el.dataset.id)); };
  A['comp-delete'] = function (el) { C.removeEntity('competences', el.dataset.id, 'competences'); };
  A['system-add'] = function () { C.forms.system(null); };
  A['system-edit'] = function (el) { C.forms.system(S.engine().get('systems', el.dataset.id)); };
  A['system-delete'] = function (el) { C.removeEntity('systems', el.dataset.id, 'systems'); };
  A['system-team-add'] = function (el) { C.forms.systemTeam(el.dataset.id); };
  A['system-it-add'] = function (el) { C.forms.itDomainSystem({ systemId: el.dataset.id }); };
})();
