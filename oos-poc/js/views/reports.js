/*
 * Rapporter: kapacitet, belastning och ledig tid för valfri del av organisationen,
 * grupperad efter team, domän eller kompetens och jämförd med nästa period.
 */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  /* Ordningen är densamma som förut, så att tangentbordsval i listan fungerar som man är van vid. */
  var LEVELS = [
    { value: 'team', label: 'Team', noun: 'team', page: 'teams' },
    { value: 'business', label: 'Verksamhetsdomän', noun: 'verksamhetsdomän', page: 'businessDomains' },
    { value: 'it', label: 'IT-domän', noun: 'IT-domän', page: 'itDomains' },
    { value: 'delivery', label: 'Leveransdomän', noun: 'leveransdomän', page: 'deliveryDomains' },
    { value: 'competence', label: 'Kompetens', noun: 'kompetens', page: 'competences' }
  ];

  function rs() {
    if (!OOS.state.report) OOS.state.report = { level: 'team', dd: '', bd: '', it: '', team: '', comp: '', cat: '', clouds: true, view: 'table', open: {}, allOpen: false };
    var r = OOS.state.report;
    /* Äldre läge: "Per kompetens" var en egen knapp. Nu är det ett val bland grupperingarna. */
    if (r.mode === 'competence') r.level = 'competence';
    delete r.mode;
    if (!r.open) r.open = {};
    return r;
  }

  function levelOf(r) {
    return LEVELS.filter(function (l) { return l.value === r.level; })[0] || LEVELS[0];
  }

  function select(key, label, options, value, all) {
    return '<label class="fld"><span>' + esc(label) + '</span><select id="rf-' + key + '" data-change="report-filter" data-key="' + key + '">' +
      OOSSelect.optionsHtml(options, value, all || undefined) + '</select></label>';
  }

  function build(ctx) {
    var r = rs();
    var flat = r.level === 'competence';
    return ctx.e.report({
      period: ctx.period,
      level: flat ? 'team' : r.level,
      flat: flat,
      filters: {
        deliveryDomainId: r.dd || null,
        businessDomainId: r.bd || null,
        itDomainId: r.it || null,
        teamId: r.team || null,
        competenceId: r.comp || null,
        competenceCategory: r.cat || null,
        source: r.clouds ? null : 'team'
      }
    });
  }

  /* De filter som är satta, i klartext. Används i resultatets underrubrik och för att räkna dem. */
  function activeFilters(ctx) {
    var r = rs();
    var e = ctx.e;
    var out = [];
    function name(coll, id) { var x = id ? e.get(coll, id) : null; return x ? x.name : null; }
    if (r.dd) out.push(name('deliveryDomains', r.dd));
    if (r.bd) out.push(name('domains', r.bd));
    if (r.it) out.push(name('domains', r.it));
    if (r.team) out.push(name('teams', r.team));
    if (r.cat) out.push(r.cat);
    if (r.comp) out.push(name('competences', r.comp));
    if (!r.clouds) out.push('bara team');
    return out.filter(Boolean);
  }

  function loadTone(pct) {
    return pct > 100.5 ? 'crit' : pct >= 90 ? 'warn' : null;
  }

  function cap(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  OOS.views.reports = function (ctx) {
    var r = rs();
    var lvl = levelOf(r);
    var rep = build(ctx);
    var filters = activeFilters(ctx);
    var teamOpts = S.db.teams.filter(function (t) {
      if (!r.dd) return true;
      var dd = ctx.e.teamDeliveryDomain(t.id);
      return dd && dd.id === r.dd;
    }).sort(U.byName).map(function (t) { return { value: t.id, label: t.name }; });

    var h = UI.pageHead({
      title: 'Rapporter',
      sub: 'Kapacitet, belastning och ledig tid för den del av organisationen du väljer, jämfört med nästa period. Allt räknas fram ur samma datamodell.',
      actions: UI.btn('Kopiera som CSV', 'report-csv', {})
    });

    /* Vad som visas och hur, sedan vilket urval. */
    h += '<section class="card report-controls"><div class="rc-main">';
    /* Periodtypen gäller hela Fabriken, som perioden i menyn. PI är standard. */
    h += '<div class="fld"><span>Visa per</span>' + UI.seg('period-type', OOSEngine.PERIOD_TYPES.map(function (t) { return { key: t.value, label: t.label }; }), ctx.period.type) + '</div>';
    /* Datumen står i etiketten, så att fälten står i linje. En PI säger inget om datum utan dem. */
    h += '<div class="fld"><span>Period <span class="muted">' + (ctx.period.type === 'month' ? ctx.period.workdays + ' arbetsdagar' : U.fmtDate(ctx.period.start) + ' – ' + U.fmtDate(ctx.period.end)) + '</span></span>' +
      '<div class="period-step">' + UI.iconBtn('arrowLeft', 'period-shift', { dir: -1 }, 'Föregående period') +
      '<strong>' + esc(ctx.period.label) + '</strong>' + UI.iconBtn('arrowRight', 'period-shift', { dir: 1 }, 'Nästa period') + '</div></div>';
    h += select('level', 'Gruppera efter', LEVELS, r.level);
    h += '<div class="fld"><span>Visa som</span>' + UI.seg('report-view', [{ key: 'table', label: 'Tabell' }, { key: 'chart', label: 'Diagram' }], r.view) + '</div>';
    h += '</div><div class="rc-filters"><div class="rc-filters-head"><span class="rc-title">Avgränsa urvalet</span>' +
      (filters.length ? '<span class="rc-active">' + U.plural(filters.length, 'filter', 'filter') + ' · <button type="button" class="link-btn" data-action="report-clear">Rensa filter</button></span>' : '<span class="rc-active">Hela organisationen</span>') +
      '</div><div class="filters">';
    h += select('dd', 'Leveransdomän', C.opts.deliveryDomains(), r.dd, 'Alla');
    h += select('bd', 'Verksamhetsdomän', C.opts.domains('business'), r.bd, 'Alla');
    h += select('it', 'IT-domän', C.opts.domains('it'), r.it, 'Alla');
    h += select('team', 'Team', teamOpts, r.team, 'Alla');
    h += select('cat', 'Kompetensområde', C.categories().map(function (c) { return { value: c, label: c }; }), r.cat, 'Alla');
    h += select('comp', 'Kompetens', C.opts.competences(), r.comp, 'Alla');
    h += '</div><label class="fld check"><input type="checkbox" id="rf-clouds" data-change="report-clouds"' + (r.clouds ? ' checked' : '') + '><span>Ta med domänmoln och nyckelroller</span></label>';
    h += '</div></section>';

    var t = rep.total;
    var tone = loadTone(t.loadPct);
    var unalloc = ctx.e.unallocated(ctx.period);
    h += UI.facts([
      { label: 'Kapacitet i ' + ctx.period.inText, value: U.fmtH(t.capacity), note: 'Teamen, ' + U.plural(t.peopleCount, 'person', 'personer') + (t.reserved > 0.5 ? ' · ' + U.fmtH(t.reserved) + ' i domänroller' : '') },
      { label: 'Belastat', value: U.fmtH(t.loaded), note: U.fmtPct(t.loadPct) + ' beläggning', tone: tone },
      t.free < 0
        ? { label: 'Överplanerat', value: U.fmtH(-t.free), note: 'Mer än kapaciteten', tone: 'crit' }
        : { label: 'Ledigt', value: U.fmtH(t.free), note: 'Kan planeras i ' + ctx.period.inText },
      { label: 'Kapacitet i ' + ctx.next.inText, value: U.fmtH(t.nextCapacity), note: U.fmtSigned(t.change, ' h') + ' mot ' + ctx.period.inText + ' (' + U.fmtSigned(t.changePct, ' %') + ')' }
    ]);

    var grouped = r.level !== 'competence';
    var anyOpen = grouped && rep.groups.some(function (g) { return isOpen(r, g.key); });
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Per ' + esc(lvl.noun) + '</div>' +
      '<div class="card-sub">' + esc(ctx.period.label) + ' jämfört med ' + esc(ctx.next.inText) + (filters.length ? ' · Urval: ' + esc(filters.join(', ')) : '') + '</div></div>' +
      (r.view === 'table' && grouped && rep.groups.length ? UI.btn(anyOpen ? 'Dölj kompetenserna' : 'Visa kompetenserna', 'report-toggle-all', { cls: 'btn-sm', data: { open: anyOpen ? '0' : '1' } }) : '') +
      '</div>';
    h += r.view === 'chart' ? chart(rep, r, lvl, ctx) : tableView(rep, r, lvl, ctx);
    h += '<p class="card-note">Förändring är kapaciteten i ' + esc(ctx.next.inText) + ' jämfört med ' + esc(ctx.period.inText) + ', utan hänsyn till belastning. ' +
      'Den beror på antal arbetsdagar, teamavdrag och domänroller som börjar eller slutar.' +
      (t.reserved > 0.5 ? ' Domänmoln och nyckelroller är reserverad tid (' + U.fmtH(t.reserved) + ') och räknas inte i totalens beläggning.' : '') +
      (unalloc.hours > 0.5 && !filters.filter(function (f) { return f !== 'bara team'; }).length ? ' Utöver det har ' + U.plural(unalloc.people.length, 'person', 'personer') + ' ' + U.fmtH(unalloc.hours) + ' som inte är fördelad på något team eller någon roll (' + C.link('workers', 'se Arbetare') + ').' : '') + '</p>';
    h += '</section>';
    return h;
  };

  function isOpen(r, key) {
    return key in r.open ? r.open[key] : !!r.allOpen;
  }

  /* Sidan som en grupp eller kompetens leder till. Domänmoln, nyckelroller och "Utan …" saknar egen sida. */
  function pageOf(lvl, key) {
    if (!key || String(key).charAt(0) === '_') return null;
    return lvl.page + ':' + key;
  }

  function freeCell(x) {
    return x.free < -0.5 ? '<span class="crit-text">' + U.fmtSigned(x.free, ' h') + '</span>' : U.fmtH(x.free);
  }

  /* Tal för en rad. Ledig och nästa periods kapacitet är mindre viktiga och döljs först på smal yta. */
  /* Domänmoln och nyckelroller är reserverad tid: timmarna står med, men ingen beläggning eller ledig tid. */
  function numCells(x, quiet) {
    if (!x.capacity && x.reserved > 0.5) {
      return '<td class="num">' + U.fmtH(x.reserved) + '</td><td class="num"><span class="muted">–</span></td><td class="num"><span class="muted">–</span></td>' +
        '<td><span class="muted small">Reserverad</span></td><td class="num">' + U.fmtH(x.nextReserved) + '</td><td class="num">' + U.fmtSigned(x.change, ' h') + '</td>';
    }
    return '<td class="num">' + U.fmtH(x.capacity) + '</td><td class="num">' + U.fmtH(x.loaded) + '</td><td class="num">' + freeCell(x) + '</td>' +
      '<td>' + UI.bar(x.loadPct, quiet ? { warnAt: 101, soft: true } : undefined) + '</td><td class="num">' + U.fmtH(x.nextCapacity) + '</td>' +
      '<td class="num">' + U.fmtSigned(x.change, ' h') + '</td>';
  }

  function head(first, next) {
    return '<thead><tr><th>' + esc(first) + '</th><th class="num">Kapacitet</th><th class="num">Belastat</th><th class="num" data-opt="2">Ledigt</th>' +
      '<th>Beläggning</th><th class="num" data-opt="2">' + esc(next) + '</th><th class="num" data-opt="1">Förändring</th></tr></thead>';
  }

  /*
   * Trädtabell: varje grupp är en rad med gruppens summor. Kompetenserna ligger indragna under den
   * och visas när man öppnar gruppen, så att sidan först ger överblick och sedan detaljer.
   */
  function tableView(rep, r, lvl, ctx) {
    var next = cap(ctx.next.label);
    var h = '<div class="table-wrap"><table class="tbl report">';
    if (r.level === 'competence') {
      h += head('Kompetens', next) + '<tbody>';
      rep.byCompetence.forEach(function (x) {
        h += '<tr><td>' + C.link('competences:' + x.key, x.name) + '<div class="muted small">' + U.plural(x.peopleCount, 'person', 'personer') + '</div></td>' + numCells(x) + '</tr>';
      });
      if (!rep.byCompetence.length) h += '<tr><td colspan="7"><div class="empty">Inget i urvalet. Prova att rensa filtren.</div></td></tr>';
      h += '<tr class="grand"><td>Totalt i urvalet</td>' + numCells(rep.total) + '</tr>';
      return h + '</tbody></table></div>';
    }
    h += head(lvl.label + ' och kompetens', next) + '<tbody>';
    rep.groups.forEach(function (g, gi) {
      var open = isOpen(r, g.key);
      var toggle = '<button type="button" class="btn-icon" id="rt-' + gi + '" data-action="report-toggle" data-key="' + esc(g.key) + '" aria-expanded="' + open + '" aria-label="' + (open ? 'Dölj' : 'Visa') + ' kompetenser för ' + esc(g.name) + '">' + UI.icon(open ? 'chevronDown' : 'chevronRight') + '</button>';
      var go = pageOf(lvl, g.key);
      h += '<tr class="group-row' + (open ? ' is-open' : '') + '"><td><div class="group-name">' + toggle +
        '<div><strong>' + (go ? C.link(go, g.name) : esc(g.name)) + '</strong><div class="muted small">' + U.plural(g.total.peopleCount, 'person', 'personer') + ' · ' + U.plural(g.rows.length, 'kompetens', 'kompetenser') + '</div></div></div></td>' + numCells(g.total, g.isCloud) + '</tr>';
      if (open) {
        g.rows.forEach(function (x) {
          h += '<tr class="child"><td>' + esc(x.name) + '</td>' + numCells(x, g.isCloud) + '</tr>';
        });
      }
    });
    if (!rep.groups.length) h += '<tr><td colspan="7"><div class="empty">Inget i urvalet. Prova att rensa filtren.</div></td></tr>';
    h += '<tr class="grand"><td>Totalt i urvalet (' + U.plural(rep.groups.length, lvl.noun === 'team' ? 'grupp' : 'domän', lvl.noun === 'team' ? 'grupper' : 'domäner') + ')</td>' + numCells(rep.total) + '</tr>';
    return h + '</tbody></table></div>';
  }

  /*
   * Diagram: en stapel per grupp, mest belagd först. Stapeln är appens standard: alltid lika lång,
   * 0–120 % av gruppens egen kapacitet med ett streck vid 100 %. Timmarna står i egna kolumner,
   * så att stapeln bara behöver svara på en sak: hur full är gruppen.
   */
  function chart(rep, r, lvl, ctx) {
    var items = r.level === 'competence'
      ? rep.byCompetence.map(function (x) { return Object.assign({ id: x.key, go: pageOf(lvl, x.key) }, x); })
      : rep.groups.map(function (g) { return Object.assign({}, g.total, { id: g.key, key: g.key, name: g.name, go: pageOf(lvl, g.key), quiet: g.isCloud }); });
    if (!items.length) return '<div class="empty">Inget i urvalet. Prova att rensa filtren.</div>';
    var anyOver = items.some(function (x) { return x.loaded > x.capacity + 0.5; });
    return UI.table({
      id: 'tbl-report-chart',
      rows: items,
      pageSize: 0,
      tools: UI.barLegend(anyOver),
      rowGo: function (x) { return x.go; },
      defaultSort: 'bar',
      defaultDir: -1,
      columns: [
        {
          key: 'name', label: lvl.label, sort: function (x) { return x.name; },
          render: function (x) { return '<span class="name">' + esc(x.name) + '</span><div class="muted small">' + U.plural(x.peopleCount, 'person', 'personer') + '</div>'; }
        },
        {
          key: 'bar', label: 'Beläggning', cls: 'cbar-col', sort: function (x) { return x.loadPct; },
          render: function (x) { return !x.capacity && x.reserved > 0.5 ? '<span class="muted small">Reserverad tid för domänerna</span>' : C.capBar(x); }
        },
        {
          key: 'free', label: 'Ledigt', cls: 'num', sort: function (x) { return x.free; },
          render: function (x) { return !x.capacity && x.reserved > 0.5 ? '<span class="muted">–</span>' : freeCell(x); }
        },
        {
          key: 'cap', label: 'Kapacitet', cls: 'num', opt: 1, sort: function (x) { return x.capacity + x.reserved; },
          render: function (x) { return U.fmtH(x.capacity || x.reserved); }
        },
        {
          key: 'change', label: 'Förändring', cls: 'num', opt: 2, sort: function (x) { return x.change; },
          render: function (x) { return U.fmtSigned(x.change, ' h'); }
        }
      ]
    });
  }

  function csv(ctx) {
    var r = rs();
    var rep = build(ctx);
    var lines = [['Grupp', 'Kompetens', 'Kapacitet (h)', 'Belastat (h)', 'Ledigt (h)', 'Kapacitet nästa period (h)', 'Beläggning (%)', 'Förändring (h)', 'Förändring (%)', 'Reserverat i domänroller (h)'].join(';')];
    function line(g, x) {
      return [g, x.name, Math.round(x.capacity), Math.round(x.loaded), Math.round(x.free), Math.round(x.nextCapacity), Math.round(x.loadPct), Math.round(x.change), Math.round(x.changePct), Math.round(x.reserved || 0)].join(';');
    }
    if (r.level === 'competence') rep.byCompetence.forEach(function (x) { lines.push(line('Alla', x)); });
    else rep.groups.forEach(function (g) { g.rows.forEach(function (x) { lines.push(line(g.name, x)); }); lines.push(line(g.name, g.total)); });
    lines.push(line('Totalt', rep.total));
    return lines.join('\n');
  }

  var A = OOS.actions;
  A['report-toggle'] = function (el) {
    var r = rs();
    r.open[el.dataset.key] = el.getAttribute('aria-expanded') !== 'true';
    OOS.refresh();
  };
  A['report-toggle-all'] = function (el) {
    var r = rs();
    r.allOpen = el.dataset.open === '1';
    r.open = {};
    OOS.refresh();
  };
  A['report-clear'] = function () {
    var r = rs();
    Object.assign(r, { dd: '', bd: '', it: '', team: '', comp: '', cat: '', clouds: true });
    OOS.refresh();
    var lvl = document.getElementById('rf-level-btn') || document.getElementById('rf-level');
    if (lvl) lvl.focus();
  };
  A['report-csv'] = function () {
    C.copyText(csv(OOS.ctx()), 'rapporten');
  };
  OOS.inputs['report-filter'] = function (el) {
    var r = rs();
    r[el.dataset.key] = el.value;
    if (el.dataset.key === 'dd') r.team = '';
    if (el.dataset.key === 'level') r.open = {};
    OOS.refresh();
  };
  OOS.inputs['report-clouds'] = function (el) {
    rs().clouds = el.checked;
    OOS.refresh();
  };
  OOS.segHandlers = OOS.segHandlers || {};
  OOS.segHandlers['report-view'] = function (key) { rs().view = key; };
  OOS.segHandlers['period-type'] = function (key) { S.updateSettings({ periodType: key }); };
  OOS.reportState = rs;
})();
