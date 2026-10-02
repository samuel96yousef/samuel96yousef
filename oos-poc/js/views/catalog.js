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

  /*
   * Lådan under en kompetens: flikar för översikt, nivåer och arbetare. Risken att kunskapen bara
   * finns hos en person står först.
   */
  function panel(c, ctx, cap) {
    var e = ctx.e;
    var holders = e.competenceHolders(c.id);
    var adv = holders.filter(function (h) { return h.wc.level >= 3; });
    var tab = OOS.tab('comp-panel', 'overview');
    var body = '';
    var note = '';
    if (tab === 'overview') {
      if (adv.length === 1) {
        note = '<div class="note warn">' + esc(adv[0].worker.name) + ' är ensam om nivå 3–4. Kunskapen riskerar att försvinna vid rollbyte eller frånvaro.</div>';
      } else if (holders.length && !adv.length) {
        note = '<div class="note">Ingen har kompetensen på nivå 3–4 ännu.</div>';
      }
      /* Arbetare, nivå 3–4 och kapacitet står redan på raden ovanför. */
      body += '<div class="drawer-grid two">' +
        C.drawerSection('Beskrivning', '<div class="prose">' + (c.description ? '<p>' + esc(c.description) + '</p>' : '<p class="muted">Ingen beskrivning.</p>') + (c.details ? '<p class="muted">' + esc(c.details) + '</p>' : '') + '</div>') +
        C.drawerSection('Uppgifter', UI.props([['Kategori', esc(c.category)], ['Område', c.type === 'business' ? 'Verksamhet' : 'IT'], ['Kapacitet räknas på', 'Primär kompetens, ' + esc(ctx.period.inText)]])) +
        '</div>';
    } else if (tab === 'levels') {
      body += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Nivå</th><th>Namn</th><th>Beskrivning</th><th class="num">Antal</th></tr></thead><tbody>';
      var desc = ['', 'Har grundläggande kunskap och kan utföra enklare uppgifter med stöd.', 'Kan arbeta självständigt med vanliga uppgifter.', 'Har djup kunskap och kan hantera komplexa uppgifter.', 'Mycket hög kompetens och kan leda och coacha andra.'];
      [1, 2, 3, 4].forEach(function (n) {
        body += '<tr><td>' + UI.level(n) + '</td><td>' + UI.LEVELS[n] + '</td><td class="small">' + desc[n] + '</td><td class="num">' + holders.filter(function (x) { return x.wc.level === n; }).length + '</td></tr>';
      });
      body += '</tbody></table></div><p class="muted small">Nivåerna är gemensamma för alla kompetenser i Prototyp 1.</p>';
    } else {
      var items = holders.slice().sort(function (a, b) { return b.wc.level - a.wc.level || U.byName(a.worker, b.worker); }).map(function (x) {
        var pd = e.workerPrimaryDomains(x.worker.id);
        return { ref: C.workerRef(x.worker, (pd.team ? pd.team.name : x.worker.title) || ''), tag: x.wc.weight === 'primary' ? 'Primär' : '', strong: true, remove: UI.level(x.wc.level) };
      });
      body += C.relList(items, 'Ingen har kompetensen ännu.');
    }
    return C.drawer({
      title: c.name,
      tabs: UI.tabs('comp-panel', [{ key: 'overview', label: 'Översikt' }, { key: 'levels', label: 'Nivåer' }, { key: 'workers', label: 'Arbetare (' + holders.length + ')' }], tab),
      actions: C.drawerActions({ action: 'comp-edit', data: { id: c.id } }, { action: 'comp-delete', data: { id: c.id } }),
      note: note,
      body: body
    });
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

  /*
   * Lådan under ett system: beskrivningen överst, sedan vilka team som ansvarar och bidrar, vilka
   * IT-domäner systemet hör till och de övriga uppgifterna. Det ansvariga teamet står bara en gång,
   * först i listan med en mörk etikett.
   */
  function systemDetail(s, ctx) {
    var e = ctx.e;
    var teams = e.systemTeams(s.id).slice().sort(function (a, b) {
      return (b.link.objective === 'owner') - (a.link.objective === 'owner') || U.byName(a.team, b.team);
    });
    var doms = e.systemItDomains(s.id).slice().sort(function (a, b) {
      return (b.relationship === 'primary') - (a.relationship === 'primary') || U.byName(a.domain, b.domain);
    });
    var owner = e.systemResponsibleTeam(s.id);
    var CATEGORY = { system: 'System', service: 'Tjänst', interface: 'Gränssnitt', function: 'Funktion' };
    var category = CATEGORY[s.category] || '';
    var teamItems = teams.map(function (x) {
      var own = x.link.objective === 'owner';
      return {
        ref: C.teamRef(x.team), tag: own ? 'Ansvarar' : 'Bidrar', strong: own,
        remove: UI.iconBtn('x', 'link-remove', { coll: 'teamSystems', id: x.link.id, msg: x.team.name + ' kopplas bort från ' + s.name + '.' }, 'Koppla bort ' + x.team.name, 'danger rel-remove')
      };
    });
    var domItems = doms.map(function (x) {
      var primary = x.relationship === 'primary';
      return {
        ref: C.domainRef(x.domain), tag: primary ? 'Primär' : 'Stödjande', strong: primary,
        remove: UI.iconBtn('x', 'link-remove', { coll: 'itDomainSystems', id: x.link.id, msg: s.name + ' kopplas bort från ' + x.domain.name + '.' }, 'Koppla bort ' + x.domain.name, 'danger rel-remove')
      };
    });
    /* Typ och kategori står bara båda när de säger olika saker. */
    var facts = [['Typ', esc(s.kind || '')]];
    if (category && category !== s.kind) facts.push(['Kategori', category]);
    facts.push(['Status', UI.statusBadge(s.status)]);
    var body = '<div class="drawer-grid">' +
      C.drawerSection('Team', C.relList(teamItems, 'Inga team kopplade.'), { label: 'Koppla team', action: 'system-team-add', data: { id: s.id } }) +
      C.drawerSection('IT-domäner', C.relList(domItems, 'Ingen IT-domän kopplad.'), { label: 'Koppla IT-domän', action: 'system-it-add', data: { id: s.id } }) +
      C.drawerSection('Uppgifter', UI.props(facts)) +
      '</div>';
    return C.drawer({
      title: s.name,
      /* Beskrivningen står i en kolumn på raden när det finns plats. Annars står den här. */
      lead: '<p class="drawer-text dup-2">' + esc(s.description || 'Ingen beskrivning.') + '</p>',
      actions: C.drawerActions({ action: 'system-edit', data: { id: s.id } }, { action: 'system-delete', data: { id: s.id } }),
      note: owner ? '' : '<div class="note warn"><strong>Systemet saknar ansvarigt team.</strong> Koppla ett team och ange att det ansvarar.</div>',
      body: body
    });
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
