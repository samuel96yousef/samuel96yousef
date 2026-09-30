/* Kapacitet: arbetstid, period, grundavdrag och särskilda avdrag per team. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  OOS.views.capacity = function (ctx) {
    var e = ctx.e;
    var st = S.db.settings;
    var ohTotal = U.sum(S.db.overheadReductions, function (r) { return r.hoursPerWeek; });
    var h = UI.pageHead({
      title: 'Kapacitet',
      sub: 'Här styrs hur verklig kapacitet räknas: standardarbetstid, rapporteringsperiod, grundavdrag för alla och särskilda avdrag per team.'
    });

    h += '<div class="grid-3">';
    h += '<section class="card"><div class="card-head"><div class="card-title">Standardarbetstid</div>' + UI.btn('Redigera', 'std-edit', { cls: 'btn-sm' }) + '</div><div class="card-body stack">' +
      '<p class="muted small">Standardarbetstid per arbetare och vecka, före avdrag. Grundavdragen skalas mot den.</p>' +
      '<div><span class="kpi-value">' + U.fmtNum(st.standardWeekHours) + ' h</span> <span class="muted">/ vecka</span></div></div></section>';

    h += '<section class="card"><div class="card-head"><div class="card-title">Rapporteringsperiod</div></div><div class="card-body stack">' +
      '<p class="muted small">Styr vilken period som används för planering och uppföljning i hela OOS.</p>' +
      '<label class="fld"><span>Periodtyp</span><select id="period-type" data-change="period-type"><option value="month"' + (st.periodType === 'month' ? ' selected' : '') + '>Månad</option><option value="quarter"' + (st.periodType === 'quarter' ? ' selected' : '') + '>Kvartal</option></select></label>' +
      '<div class="row-between"><span class="muted">Aktuell period</span><span class="row">' + UI.iconBtn('arrowLeft', 'period-shift', { dir: -1 }, 'Föregående period') + '<strong>' + U.fmtDate(ctx.period.start) + ' – ' + U.fmtDate(ctx.period.end) + '</strong>' + UI.iconBtn('arrowRight', 'period-shift', { dir: 1 }, 'Nästa period') + '</span></div>' +
      '<div class="row-between"><span class="muted">Nästa period</span><span>' + U.fmtDate(ctx.next.start) + ' – ' + U.fmtDate(ctx.next.end) + '</span></div>' +
      '<div class="row-between"><span class="muted">Arbetsdagar</span><span>' + ctx.period.workdays + ' / ' + ctx.next.workdays + '</span></div>' +
      (st.periodAnchor ? UI.btn('Gå till dagens period', 'period-today', { cls: 'btn-sm' }) : '') +
      '</div></section>';

    h += '<section class="card"><div class="card-head"><div class="card-title">Grundavdrag <span class="card-sub">(alla team och arbetare)</span></div>' + UI.btn('Lägg till', 'overhead-add', { cls: 'btn-sm' }) + '</div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Avdragstyp</th><th class="num">Värde</th><th>AI</th><th class="actions"><span class="sr-only">Åtgärder</span></th></tr></thead><tbody>';
    S.db.overheadReductions.forEach(function (r) {
      h += '<tr><td>' + esc(r.name) + '</td><td class="num">' + U.fmtNum(r.hoursPerWeek) + ' h/v</td><td>' + (r.appliesToAI ? 'Ja' : '<span class="muted">Nej</span>') + '</td><td class="actions">' + UI.iconBtn('edit', 'overhead-edit', { id: r.id }, 'Ändra') + '</td></tr>';
    });
    h += '<tr class="total"><td>Summa</td><td class="num">' + U.fmtNum(ohTotal) + ' h/v</td><td colspan="2" class="muted small">' + U.fmtPct((ohTotal / st.standardWeekHours) * 100) + ' av arbetstiden</td></tr>';
    h += '</tbody></table></div></section>';
    h += '</div>';

    var reds = S.db.teamReductions.slice().sort(function (a, b) { return a.from.localeCompare(b.from); });
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Särskilda avdrag per team</div><p class="card-sub">Avdrag som gäller ett team under en viss period, till exempel planerad frånvaro eller utbildning. Avdraget räknas om per arbetsdag som överlappar perioden.</p></div>' +
      UI.btn('Lägg till avdrag', 'reduction-add', { cls: 'btn-primary' }) + '</div>';
    h += UI.table({
      id: 'tbl-reductions',
      rows: reds,
      defaultSort: 'from',
      noun: 'avdrag',
      columns: [
        { key: 'team', label: 'Teamnamn', sort: function (r) { var t = e.get('teams', r.teamId); return t ? t.name : ''; }, render: function (r) { return C.teamRef(e.get('teams', r.teamId)); } },
        { key: 'type', label: 'Avdragstyp', sort: function (r) { return r.type; }, render: function (r) { return esc(r.type); } },
        { key: 'pct', label: 'Värde', cls: 'num', sort: function (r) { return r.percent; }, render: function (r) { return U.fmtPct(r.percent); } },
        { key: 'from', label: 'Gäller från', sort: function (r) { return r.from; }, render: function (r) { return esc(r.from); } },
        { key: 'to', label: 'Gäller till', sort: function (r) { return r.to; }, render: function (r) { return esc(r.to); } },
        {
          key: 'eff', label: 'Effekt i perioden', cls: 'num', sort: function (r) { return effect(e, r, ctx.period); },
          render: function (r) { var v = effect(e, r, ctx.period); return v ? '− ' + U.fmtH(v) : '<span class="muted">–</span>'; }
        },
        { key: 'comment', label: 'Orsak/kommentar', render: function (r) { return '<span class="muted">' + esc(r.comment || '') + '</span>'; } },
        { key: 'act', label: '', cls: 'actions', render: function (r) { return UI.iconBtn('edit', 'reduction-edit', { id: r.id }, 'Ändra'); } }
      ]
    }) + '</section>';

    /* Förklaring av beräkningen med en standardarbetare som exempel. */
    var perWeek = st.standardWeekHours - ohTotal;
    h += '<section class="card"><div class="card-head"><div class="card-title">Så räknas verklig kapacitet</div></div><div class="card-body grid-2">' +
      '<div class="formula">' +
      '<div class="step"><span>Grundkapacitet (heltid)</span><span>' + U.fmtH(st.standardWeekHours) + ' / vecka</span></div>' +
      '<div class="step"><span>− Grundavdrag</span><span>' + U.fmtH(ohTotal) + ' / vecka</span></div>' +
      '<div class="step"><span>= Tillgänglig kapacitet</span><span>' + U.fmtNum(perWeek) + ' h / vecka</span></div>' +
      '<div class="step"><span>× ' + ctx.period.workdays + ' arbetsdagar i ' + esc(ctx.period.inText) + ' / 5</span><span>' + U.fmtH((perWeek / 5) * ctx.period.workdays) + '</span></div>' +
      '<div class="step"><span>× Allokering i teamet × (1 − teamets avdrag)</span><span>Teamets kapacitet</span></div>' +
      '</div>' +
      '<div class="stack small">' +
      '<p><strong>Timmar som gemensam valuta.</strong> All kapacitet uttrycks i timmar så att team, ledning och verksamhet kan förhandla om samma sak.</p>' +
      '<p><strong>Domänmoln räknas med.</strong> Experter i verksamhets- och IT-domäner bidrar med h/månad utan att vara teammedlemmar. Tiden räknas till domänens och leveransdomänens kapacitet.</p>' +
      '<p><strong>Belastning är manuell i Prototyp 1.</strong> Planerad belastning anges per teammedlem. När utvecklingsprocessen (arbetsblock) byggs ska belastningen räknas fram därifrån.</p>' +
      '<p class="muted">Förenkling: helgdagar räknas inte bort i POC:n.</p>' +
      '</div></div></section>';
    return h;
  };

  function effect(e, r, period) {
    var ov = OOSEngine.overlapWorkdays(r.from, r.to, period.start, period.end);
    if (!ov || !period.workdays) return 0;
    var tc = e.teamCapacity(r.teamId, period);
    var gross = U.sum(tc.members, function (m) { return m.gross; });
    return (gross * (r.percent / 100) * ov) / period.workdays;
  }

  var A = OOS.actions;
  A['std-edit'] = function () {
    UI.openForm({
      title: 'Standardarbetstid',
      values: { standardWeekHours: S.db.settings.standardWeekHours },
      fields: [{ key: 'standardWeekHours', label: 'Timmar per vecka', type: 'number', min: 1, max: 60, required: true, full: true, help: 'Påverkar hur grundavdragen skalas för deltid.' }],
      onSubmit: function (v) {
        S.updateSettings({ standardWeekHours: v.standardWeekHours });
        UI.toast('Standardarbetstiden är nu ' + v.standardWeekHours + ' h/vecka.');
        OOS.refresh();
      }
    });
  };
  A['overhead-add'] = function () { C.forms.overhead(null); };
  A['overhead-edit'] = function (el) { C.forms.overhead(S.engine().get('overheadReductions', el.dataset.id)); };
  A['period-shift'] = function (el) {
    var p = OOS.period();
    var np = Number(el.dataset.dir) > 0 ? OOSEngine.nextPeriod(p) : OOSEngine.prevPeriod(p);
    S.updateSettings({ periodAnchor: np.start });
    OOS.refresh();
  };
  A['period-today'] = function () {
    S.updateSettings({ periodAnchor: null });
    OOS.refresh();
  };
  OOS.inputs['period-type'] = function (el) {
    S.updateSettings({ periodType: el.value });
    OOS.refresh();
  };
})();
