/* Rapporter: kapacitet och belastning per grupp och kompetens, denna och nästa period. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  var LEVELS = [
    { value: 'team', label: 'Team' },
    { value: 'business', label: 'Verksamhetsdomän' },
    { value: 'it', label: 'IT-domän' },
    { value: 'delivery', label: 'Leveransdomän' }
  ];

  function rs() {
    if (!OOS.state.report) OOS.state.report = { level: 'team', dd: '', bd: '', it: '', team: '', comp: '', cat: '', clouds: true, view: 'table', mode: 'groups', collapsed: {} };
    return OOS.state.report;
  }

  function select(key, label, options, value, all) {
    return '<label class="fld"><span>' + esc(label) + '</span><select id="rf-' + key + '" data-change="report-filter" data-key="' + key + '">' +
      OOSSelect.optionsHtml(options, value, all || undefined) + '</select></label>';
  }

  function build(ctx) {
    var r = rs();
    return ctx.e.report({
      period: ctx.period,
      level: r.level,
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

  OOS.views.reports = function (ctx) {
    var r = rs();
    var rep = build(ctx);
    var teamOpts = S.db.teams.filter(function (t) {
      if (!r.dd) return true;
      var dd = ctx.e.teamDeliveryDomain(t.id);
      return dd && dd.id === r.dd;
    }).sort(U.byName).map(function (t) { return { value: t.id, label: t.name }; });

    var h = UI.pageHead({
      title: 'Rapporter',
      sub: 'Analysera kapacitet och belastning aggregerat över leveransdomäner, verksamhetsdomäner, IT-domäner och team. Allt räknas fram ur samma datamodell.',
      actions: UI.btn('Kopiera som CSV', 'report-csv', {})
    });

    h += '<section class="card"><div class="filters">';
    h += '<div class="fld"><span>Tidsperiod</span><div class="row" style="gap:4px">' + UI.iconBtn('arrowLeft', 'period-shift', { dir: -1 }, 'Föregående period') +
      '<strong style="min-width:130px;text-align:center">' + esc(ctx.period.label) + '</strong>' + UI.iconBtn('arrowRight', 'period-shift', { dir: 1 }, 'Nästa period') + '</div></div>';
    h += select('level', 'Aggregeringsnivå', LEVELS, r.level);
    h += select('dd', 'Leveransdomän', C.opts.deliveryDomains(), r.dd, 'Alla');
    h += select('bd', 'Verksamhetsdomän', C.opts.domains('business'), r.bd, 'Alla');
    h += select('it', 'IT-domän', C.opts.domains('it'), r.it, 'Alla');
    h += select('team', 'Team', teamOpts, r.team, r.dd ? 'Alla team inom leveransdomänen' : 'Alla team');
    h += select('cat', 'Kompetensområde', C.categories().map(function (c) { return { value: c, label: c }; }), r.cat, 'Alla områden');
    h += select('comp', 'Kompetens', C.opts.competences(), r.comp, 'Alla kompetenser');
    h += '<label class="fld check"><input type="checkbox" id="rf-clouds" data-change="report-clouds"' + (r.clouds ? ' checked' : '') + '><span>Ta med domänmoln och nyckelroller</span></label>';
    h += '<div class="fld"><span>Visa som</span>' + UI.seg('report-view', [{ key: 'table', label: 'Tabell' }, { key: 'chart', label: 'Diagram' }], r.view) + '</div>';
    h += '<div class="fld"><span>&nbsp;</span>' + UI.btn('Rensa filter', 'report-clear', {}) + '</div>';
    h += '</div></section>';

    var levelLabel = LEVELS.filter(function (l) { return l.value === r.level; })[0].label.toLowerCase();
    var t = rep.total;
    h += '<div class="kpis">' +
      UI.kpi('Kapacitet ' + ctx.period.inText, U.fmtH(t.capacity), t.peopleCount + ' arbetare i urvalet') +
      UI.kpi('Belastat', U.fmtH(t.loaded), U.fmtPct(t.loadPct) + ' beläggning') +
      UI.kpi('Ledigt', U.fmtH(t.free)) +
      UI.kpi(ctx.next.label + ' (grundkapacitet)', U.fmtH(t.nextCapacity), U.fmtSigned(t.change, ' h') + ' (' + U.fmtSigned(t.changePct, ' %') + ')') +
      '</div>';

    h += '<section class="card"><div class="card-head"><div><div class="card-title">' + (r.mode === 'groups' ? 'Kapacitet och belastning per kompetens – per ' + esc(levelLabel) : 'Kapacitet och belastning per kompetens – över alla grupper') + '</div>' +
      '<div class="card-sub">' + esc(ctx.period.label) + ' (' + U.fmtDate(ctx.period.start) + ' – ' + U.fmtDate(ctx.period.end) + ') jämfört med ' + esc(ctx.next.inText) + '</div></div>' +
      UI.seg('report-mode', [{ key: 'groups', label: 'Per ' + levelLabel }, { key: 'competence', label: 'Per kompetens' }], r.mode) + '</div>';
    h += r.view === 'chart' ? chart(rep, r) : tableView(rep, r, levelLabel);
    h += '</section>';
    h += '<p class="muted small">Grundkapacitet för nästa period räknas utan belastning. Förändringen beror på antal arbetsdagar, teamavdrag och domänroller som börjar eller slutar.</p>';
    return h;
  };

  function numCells(x) {
    return '<td class="num bl">' + U.fmtH(x.capacity) + '</td><td class="num">' + U.fmtH(x.loaded) + '</td><td class="num">' + U.fmtH(x.free) + '</td>' +
      '<td class="num bl">' + U.fmtH(x.nextCapacity) + '</td><td class="bl">' + UI.bar(x.loadPct) + '</td>' +
      '<td class="num bl">' + U.fmtSigned(x.change, ' h') + '</td><td class="num">' + U.fmtSigned(x.changePct, ' %') + '</td>';
  }

  function head(first) {
    return '<thead><tr><th rowspan="2">' + first + '</th>' + (first === 'Kompetens' ? '' : '<th rowspan="2">Kompetens</th>') +
      '<th colspan="3" class="th-group">Befintlig kapacitet (denna period)</th><th class="th-group">Grundkapacitet (nästa period)</th><th class="th-group">Beläggningsgrad</th><th colspan="2" class="th-group">Förändring grundkapacitet</th></tr>' +
      '<tr><th class="num bl">Kapacitet</th><th class="num">Belastad</th><th class="num">Ledig</th><th class="num bl">Total kapacitet</th><th class="bl">Denna period</th><th class="num bl">h</th><th class="num">%</th></tr></thead>';
  }

  function tableView(rep, r, levelLabel) {
    var h = '<div class="table-wrap"><table class="tbl">';
    if (r.mode === 'competence') {
      h += head('Kompetens') + '<tbody>';
      rep.byCompetence.forEach(function (x) {
        h += '<tr><td>' + esc(x.name) + ' <span class="muted small">' + x.peopleCount + ' pers.</span></td>' + numCells(x) + '</tr>';
      });
      if (!rep.byCompetence.length) h += '<tr><td colspan="8"><div class="empty">Inget i urvalet.</div></td></tr>';
      h += '<tr class="grand"><td>Totalt i urvalet</td>' + numCells(rep.total) + '</tr>';
      return h + '</tbody></table></div>';
    }
    h += head(levelLabel.charAt(0).toUpperCase() + levelLabel.slice(1)) + '<tbody>';
    rep.groups.forEach(function (g) {
      var collapsed = !!r.collapsed[g.key];
      var span = collapsed ? 1 : g.rows.length + 1;
      var toggle = '<button type="button" class="btn-icon" data-action="report-toggle" data-key="' + esc(g.key) + '" aria-expanded="' + !collapsed + '" aria-label="' + (collapsed ? 'Visa' : 'Dölj') + ' kompetenser för ' + esc(g.name) + '">' + UI.icon(collapsed ? 'chevronRight' : 'chevronDown') + '</button>';
      var nameCell = '<td rowspan="' + span + '" style="vertical-align:top;border-right:1px solid var(--line)"><div class="row" style="gap:4px;flex-wrap:nowrap">' + toggle +
        '<div><strong>' + (g.isCloud ? ' ' : '') + esc(g.name) + '</strong><br><span class="muted small">' + g.total.peopleCount + ' personer</span></div></div></td>';
      if (!collapsed) {
        g.rows.forEach(function (x, i) {
          h += '<tr>' + (i === 0 ? nameCell : '') + '<td>' + esc(x.name) + '</td>' + numCells(x) + '</tr>';
        });
        h += '<tr class="total"><td>Totalt</td>' + numCells(g.total) + '</tr>';
      } else {
        h += '<tr class="total">' + nameCell + '<td>Totalt (' + g.rows.length + ' kompetenser)</td>' + numCells(g.total) + '</tr>';
      }
    });
    if (!rep.groups.length) h += '<tr><td colspan="9"><div class="empty">Inget i urvalet. Prova att rensa filtren.</div></td></tr>';
    h += '<tr class="grand"><td colspan="2">Totalt i urvalet (' + rep.groups.length + ' ' + (r.level === 'team' ? 'grupper' : 'domäner') + ')</td>' + numCells(rep.total) + '</tr>';
    return h + '</tbody></table></div>';
  }

  function chart(rep, r) {
    var items = r.mode === 'competence'
      ? rep.byCompetence
      : rep.groups.map(function (g) { return Object.assign({ name: g.name }, g.total); });
    if (!items.length) return '<div class="empty">Inget i urvalet.</div>';
    var max = Math.max.apply(null, items.map(function (x) { return Math.max(x.capacity, x.nextCapacity); })) || 1;
    var h = '<div class="hbars" role="list">';
    h += '<div class="legend-line"><span><span class="sw loaded"></span>Planerat</span><span><span class="sw free"></span>Ledigt</span><span><span class="sw next"></span>Grundkapacitet nästa period</span></div>';
    items.forEach(function (x) {
      var tip = x.name + '\nKapacitet: ' + U.fmtH(x.capacity) + '\nBelastad: ' + U.fmtH(x.loaded) + ' (' + U.fmtPct(x.loadPct) + ')\nLedig: ' + U.fmtH(x.free) + '\nNästa period: ' + U.fmtH(x.nextCapacity) + ' (' + U.fmtSigned(x.change, ' h') + ')';
      h += '<div class="hbar" role="listitem" data-tip="' + esc(tip) + '"><span class="hbar-name" title="' + esc(x.name) + '">' + esc(x.name) + '</span>' +
        '<div class="hbar-track"><div class="hbar-loaded" style="width:' + (x.loaded / max) * 100 + '%"></div><div class="hbar-free" style="width:' + (Math.max(0, x.free) / max) * 100 + '%"></div>' +
        '<div class="hbar-next" style="left:calc(' + (x.nextCapacity / max) * 100 + '% - 1px)"></div></div>' +
        '<span class="hbar-val">' + U.fmtH(x.capacity) + ' · ' + U.fmtPct(x.loadPct) + '</span></div>';
    });
    return h + '</div>';
  }

  function csv(ctx) {
    var r = rs();
    var rep = build(ctx);
    var lines = [['Grupp', 'Kompetens', 'Kapacitet (h)', 'Belastad (h)', 'Ledig (h)', 'Grundkapacitet nästa period (h)', 'Beläggningsgrad (%)', 'Förändring (h)', 'Förändring (%)'].join(';')];
    function line(g, x) {
      return [g, x.name, Math.round(x.capacity), Math.round(x.loaded), Math.round(x.free), Math.round(x.nextCapacity), Math.round(x.loadPct), Math.round(x.change), Math.round(x.changePct)].join(';');
    }
    if (r.mode === 'competence') rep.byCompetence.forEach(function (x) { lines.push(line('Alla', x)); });
    else rep.groups.forEach(function (g) { g.rows.forEach(function (x) { lines.push(line(g.name, x)); }); lines.push(line(g.name, g.total)); });
    lines.push(line('Totalt', rep.total));
    return lines.join('\n');
  }

  var A = OOS.actions;
  A['report-toggle'] = function (el) {
    var r = rs();
    r.collapsed[el.dataset.key] = !r.collapsed[el.dataset.key];
    OOS.refresh();
  };
  A['report-clear'] = function () {
    var r = rs();
    Object.assign(r, { dd: '', bd: '', it: '', team: '', comp: '', cat: '', clouds: true, collapsed: {} });
    OOS.refresh();
  };
  A['report-csv'] = function () {
    C.copyText(csv(OOS.ctx()), 'rapporten');
  };
  OOS.inputs['report-filter'] = function (el) {
    var r = rs();
    r[el.dataset.key] = el.value;
    if (el.dataset.key === 'dd') r.team = '';
    OOS.refresh();
  };
  OOS.inputs['report-clouds'] = function (el) {
    rs().clouds = el.checked;
    OOS.refresh();
  };
  OOS.segHandlers = OOS.segHandlers || {};
  OOS.segHandlers['report-view'] = function (key) { rs().view = key; };
  OOS.segHandlers['report-mode'] = function (key) { rs().mode = key; };
  OOS.reportState = rs;
})();
