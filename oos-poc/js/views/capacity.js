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
      '<label class="fld"><span>Periodtyp</span><select id="period-type" data-change="period-type">' + OOSEngine.PERIOD_TYPES.map(function (t) {
        return '<option value="' + t.value + '"' + (ctx.period.type === t.value ? ' selected' : '') + '>' + esc(t.label) + '</option>';
      }).join('') + '</select></label>' +
      (ctx.period.outside ? '<p class="note warn small">' + esc(ctx.period.label) + ' ligger utanför PI-kalendern och visas som kvartal. Lägg till PI:er nedan.</p>' : '') +
      '<div class="field-block"><span class="label">Aktuell period</span><div class="row" style="gap:6px;flex-wrap:nowrap">' + UI.iconBtn('arrowLeft', 'period-shift', { dir: -1 }, 'Föregående period') +
      '<strong class="period-now">' + esc(ctx.period.label) + '</strong>' + UI.iconBtn('arrowRight', 'period-shift', { dir: 1 }, 'Nästa period') + '</div></div>' +
      UI.props([
        ['Datum', U.fmtDate(ctx.period.start) + ' – ' + U.fmtDate(ctx.period.end)],
        ['Arbetsdagar', ctx.period.workdays + ' <span class="muted">(måndag–fredag)</span>'],
        ['Nästa period', esc(ctx.next.label) + ', ' + ctx.next.workdays + ' arbetsdagar']
      ]) +
      (st.periodAnchor ? UI.btn('Gå till dagens period', 'period-today', { cls: 'btn-sm' }) : '') +
      '</div></section>';

    h += '<section class="card"><div class="card-head"><div><div class="card-title">Grundavdrag</div><div class="card-sub">Gäller alla team och arbetare</div></div>' + UI.btn('Lägg till', 'overhead-add', { cls: 'btn-sm' }) + '</div>';
    h += '<div class="table-wrap"><table class="tbl"><thead><tr><th>Avdragstyp</th><th class="num">Värde</th><th>AI</th><th class="actions"><span class="sr-only">Åtgärder</span></th></tr></thead><tbody>';
    S.db.overheadReductions.forEach(function (r) {
      h += '<tr><td>' + esc(r.name) + (r.id === 'oh_kompetens' || /kompetensutveckling/i.test(r.name) ? '<div class="muted small">Personlig utveckling. Teamets utbildning och kompetensspridning ligger i förvaltningen.</div>' : '') + '</td><td class="num">' + U.fmtNum(r.hoursPerWeek) + ' h/v</td><td>' + (r.appliesToAI ? 'Ja' : '<span class="muted">Nej</span>') + '</td><td class="actions">' + UI.iconBtn('edit', 'overhead-edit', { id: r.id }, 'Ändra') + '</td></tr>';
    });
    h += '<tr class="total"><td>Summa</td><td class="num">' + U.fmtNum(ohTotal) + ' h/v</td><td colspan="2" class="muted small">' + U.fmtPct((ohTotal / st.standardWeekHours) * 100) + ' av arbetstiden</td></tr>';
    h += '</tbody></table></div></section>';
    h += '</div>';

    h += piCalendar(ctx);

    var reds = S.db.teamReductions.slice().sort(function (a, b) { return a.from.localeCompare(b.from); });
    h += '<section class="card"><div class="card-head"><div><div class="card-title">Särskilda avdrag per team</div><p class="card-sub">Tid som inte finns i ett team under en period, till exempel föräldraledighet eller långtidsfrånvaro. Arbete läggs som epik: utbildning och underhåll i teamets förvaltning, systembyten och annat i egna epiker. Då räknas inget två gånger. Avdraget räknas om per arbetsdag som överlappar perioden.</p></div>' +
      UI.btn('Lägg till avdrag', 'reduction-add', { cls: 'btn-primary' }) + '</div>';
    h += UI.table({
      id: 'tbl-reductions',
      rows: reds,
      defaultSort: 'from',
      noun: 'avdrag',
      rowClass: function (r) { return r.to < ctx.period.start ? 'is-past' : ''; },
      columns: [
        { key: 'team', label: 'Teamnamn', sort: function (r) { var t = e.get('teams', r.teamId); return t ? t.name : ''; }, render: function (r) { return C.teamRef(e.get('teams', r.teamId)); } },
        { key: 'type', label: 'Avdragstyp', opt: 1, sort: function (r) { return r.type; }, render: function (r) { return esc(r.type) + (OOSEngine.isWorkReduction(r.type) ? ' ' + UI.badge('Arbete', 'warn') + '<div><button type="button" class="link-btn small" data-action="reduction-to-epic" data-id="' + esc(r.id) + '">Gör om till epik</button></div>' : ''); } },
        { key: 'pct', label: 'Värde', cls: 'num', sort: function (r) { return r.percent; }, render: function (r) { return U.fmtPct(r.percent); } },
        { key: 'from', label: 'Gäller', sort: function (r) { return r.from; }, render: function (r) { return '<span class="nowrap">' + U.fmtDate(r.from) + ' –</span> <span class="nowrap">' + U.fmtDate(r.to) + '</span>'; } },
        { key: 'state', label: 'Läge', opt: 1, sort: function (r) { return r.from; }, render: function (r) { return OOS.teamReductionState(r, ctx.period); } },
        {
          key: 'eff', label: 'Effekt i perioden', cls: 'num', sort: function (r) { return effect(e, r, ctx.period); },
          render: function (r) { var v = effect(e, r, ctx.period); return v ? '− ' + U.fmtH(v) : '<span class="muted">–</span>'; }
        },
        { key: 'comment', label: 'Orsak/kommentar', opt: 2, render: function (r) { return '<span class="muted">' + esc(r.comment || '') + '</span>'; } },
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
      '<p><strong>Beläggningen räknas ur epikerna.</strong> Teamens beslutade epiker belastar kapaciteten, fördelat efter kompetensbehov. Var det blir trångt syns under Flaskhalsar.</p>' +
      '<p class="muted">Förenkling: helgdagar räknas inte bort i POC:n.</p>' +
      '</div></div></section>';
    return h;
  };

  /*
   * PI-kalendern: PI är standardperioden. Datumen ska följa organisationens planering, till exempel
   * ett sommaruppehåll mellan två PI:er. Som standard visas PI:erna från i år och framåt.
   */
  function piCalendar(ctx) {
    var today = U.todayISO();
    var range = OOS.segVal('pi-range', 'ahead');
    var fromYear = today.slice(0, 4) + '-01-01';
    var all = S.db.pis.slice().sort(function (a, b) { return a.start.localeCompare(b.start); });
    var rows = range === 'all' ? all : all.filter(function (x) { return x.end >= fromYear; });
    function state(x) {
      if (x.end < today) return '<span class="muted">Klar</span>';
      if (x.start > today) return '<span class="muted">Kommande</span>';
      return 'Pågår';
    }
    var h = '<section class="card" id="pi-calendar"><div class="card-head"><div><div class="card-title">PI-kalender</div>' +
      '<p class="card-sub">PI är standardperioden i hela Fabriken. Ändra datumen så att de följer er planering. Ett uppehåll mellan två PI:er, till exempel på sommaren, räknas inte till någon PI.</p></div>' +
      '<div class="page-actions">' + UI.seg('pi-range', [{ key: 'ahead', label: 'Från i år' }, { key: 'all', label: 'Alla' }], range) + UI.btn('Lägg till PI', 'pi-add', { cls: 'btn-sm' }) + '</div></div>';
    h += UI.table({
      id: 'tbl-pis',
      rows: rows,
      defaultSort: 'start',
      noun: 'PI',
      pageSize: 0,
      rowClass: function (x) { return x.end < today ? 'is-past' : ''; },
      columns: [
        { key: 'name', label: 'PI', sort: function (x) { return x.start; }, render: function (x) { return '<span class="name">' + esc(x.name) + '</span>' + (x.id === ctx.period.piId ? ' ' + UI.badge('Vald period', 'muted') : ''); } },
        { key: 'start', label: 'Gäller', sort: function (x) { return x.start; }, render: function (x) { return '<span class="nowrap">' + U.fmtDate(x.start) + ' –</span> <span class="nowrap">' + U.fmtDate(x.end) + '</span>'; } },
        { key: 'days', label: 'Arbetsdagar', cls: 'num', opt: 1, sort: function (x) { return OOSEngine.workdays(x.start, x.end); }, render: function (x) { return OOSEngine.workdays(x.start, x.end); } },
        { key: 'state', label: 'Läge', opt: 2, render: state },
        { key: 'act', label: '', cls: 'actions', render: function (x) { return UI.iconBtn('edit', 'pi-edit', { id: x.id }, 'Ändra ' + x.name); } }
      ]
    });
    if (!all.length) h += '<p class="muted">Ingen PI-kalender. Perioden blir kalenderkvartal tills du lägger till PI:er.</p>';
    return h + '</section>';
  }

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
  A['pi-add'] = function () { C.forms.pi(null); };
  A['pi-edit'] = function (el) { C.forms.pi(S.engine().get('pis', el.dataset.id)); };
})();
