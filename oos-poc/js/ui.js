/* Gränssnittskomponenter: ikoner, tabeller, formulär, dialoger och små visualiseringar. */
var OOSUI = (function () {
  var U = OOSUtil;
  var esc = U.esc;

  /* Ikoner används bara där ikonen är själva knappen. */
  var ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
  };

  function icon(name, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* Bara personer har initialer. Domäner, team och system visas med namn. */
  function avatar(name, key, opts) {
    opts = opts || {};
    if (!opts.round) return '';
    var text = opts.text || U.initials(name);
    var cls = 'avatar' + (text === 'AI' ? ' ai' : '') + (opts.size ? ' ' + opts.size : '');
    return '<span class="' + cls + '" aria-hidden="true">' + esc(text) + '</span>';
  }

  /* Färg används bara för avvikelser: warn och crit. Övriga varianter är neutrala. */
  var BADGE_TONES = { warn: 1, crit: 1, ok: 1, info: 1 };

  function badge(text, kind) {
    var cls = BADGE_TONES[kind] ? ' badge-' + kind : '';
    return '<span class="badge' + cls + '">' + esc(text) + '</span>';
  }

  /*
   * Tal med sin etikett under. Formen kommer från förebilden: talet bär
   * vikten, etiketten står liten och grå direkt under det, och tre ryms
   * på en rad. Etiketten säger vad talet är — utan den är ett tal bara
   * ett tal.
   */
  function statRow(items) {
    return '<div class="statrow">' + items.filter(Boolean).map(function (x) {
      return '<div class="stat"><b' + (x.tone ? ' class="' + esc(x.tone) + '-text"' : '') + '>' +
        x.value + '</b><span>' + esc(x.label) + '</span></div>';
    }).join('') + '</div>';
  }

  /*
   * Mätarrad: etikett till vänster, läget i klartext till höger, stapeln
   * under båda. Den säger samma sak två gånger med flit — en gång som
   * form och en gång som ord — för den som läser det ena missar det andra.
   */
  function meter(opts) {
    return '<div class="meter"><div class="meter-head"><span>' + esc(opts.label) + '</span>' +
      (opts.right ? '<span class="meter-right">' + opts.right + '</span>' : '') + '</div>' +
      '<div class="meter-bar">' + opts.bar + '</div></div>';
  }

  /*
   * Frågeremsan: det som väntar på dig, i gul ton, med handlingen i samma
   * remsa. Den hör hemma i kortet där saken finns, inte i en egen kö — då
   * behöver man inte leta efter vad raden syftar på.
   */
  function askStrip(opts) {
    return '<div class="ask-strip"><span>' + opts.text + '</span>' +
      (opts.action ? '<span class="ask-action">' + opts.action + '</span>' : '') + '</div>';
  }

  var STATUS = { active: 'Aktiv', production: 'I drift', development: 'Under utveckling', inactive: 'Inaktiv' };

  /*
   * Läget som ord med en prick före: "I balans", "Nära taket", "Över
   * kapacitet". Ett ord säger vad man ska göra åt det; en procentsats
   * säger det inte. Pricken bär samma toner som avvikelser i övrigt, så
   * ordet och färgen säger samma sak.
   */
  function state(label, tone) {
    var cls = tone === 'warn' || tone === 'crit' ? ' state-' + tone : '';
    return '<span class="state' + cls + '"><span class="state-dot" aria-hidden="true"></span>' + esc(label) + '</span>';
  }

  /*
   * Förändring mellan två perioder, som bricka med riktning. Den är grå:
   * att kapaciteten rör sig mellan PI:n är ett faktum, inte en avvikelse,
   * och färg är reserverad för avvikelser.
   */
  function delta(n, unit) {
    if (Math.abs(n) < 0.5) return '<span class="delta">oförändrat</span>';
    return '<span class="delta">' + (n > 0 ? '↑ ' : '↓ ') + esc(U.fmtNum(Math.abs(n))) + (unit ? ' ' + esc(unit) : '') + '</span>';
  }

  function statusBadge(status) {
    if (status === 'active' || status === 'production') return esc(STATUS[status]);
    return badge(STATUS[status] || status || '–', 'muted');
  }

  /* Visas bara när något avviker från normalläget. */
  function statusFlag(status) {
    return status === 'active' || status === 'production' ? '' : statusBadge(status);
  }

  /*
   * Beläggningsstapel. Samma i hela appen, så att den går att läsa utan att tänka efter:
   *  - Stapeln är alltid lika lång och betyder 0–120 % av radens egen kapacitet. Korta och långa
   *    staplar finns inte; storleken i timmar står i egna kolumner.
   *  - Ljus del upp till strecket är kapaciteten (100 %). Blå del är belastat. Det som går över
   *    kapaciteten står randigt rött efter strecket.
   *  - part och rest delar det belastade: mörk del hör till ett val, ljusblå är annat arbete.
   * opts: key (delarna glider till nya värden vid ett nytt val), proposal (mörk del streckad),
   * soft (grå i stället för blå, för det som inte är teamarbete), band [min, max] i procent
   * (målet), share (en andel som inte kan gå över 100 %: hela stapeln är 100 %, inget streck).
   */
  var SCALE = 120;
  function loadTrack(part, rest, cap, opts) {
    opts = opts || {};
    var key = opts.key;
    var max = opts.share ? 100 : SCALE;
    var room = (100 / max) * 100;
    var p = 0, r = 0, over = 0;
    if (cap > 0) {
      p = Math.max(0, Math.min(part, cap)) / cap * 100;
      r = Math.max(0, Math.min(part + rest, cap) - Math.min(part, cap)) / cap * 100;
      over = opts.share ? 0 : Math.min(max - 100, Math.max(0, (part + rest - cap) / cap * 100));
    } else if (part + rest > 0) {
      over = max - 100;
    }
    function seg(cls, w, k, extra) {
      return '<span class="' + cls + '"' + (key ? ' data-morph="' + esc(key + '|' + k) + '"' : '') + ' style="width:' + w.toFixed(2) + '%' + (extra || '') + '"></span>';
    }
    var band = opts.band ? '<span class="lb-band" style="left:' + opts.band[0] + '%;width:' + Math.max(0, opts.band[1] - opts.band[0]) + '%"></span>' : '';
    return '<span class="lbar' + (opts.proposal ? ' proposal' : '') + (opts.soft ? ' soft' : '') + (opts.share ? ' share' : '') + (cap > 0 ? '' : ' none') + '" aria-hidden="true">' +
      '<span class="lb-room" style="width:' + room.toFixed(2) + '%">' + band + seg('lb-part', p, 'p') + seg('lb-rest', r, 'r') + '</span>' +
      /* Utan kapacitet är hela stapeln över, och det finns inget streck att mäta mot. */
      seg('lb-over', cap > 0 ? (over / max) * 100 : (over ? 100 : 0), 'o') +
      (opts.share || !(cap > 0) ? '' : '<span class="lb-cap" style="left:' + room.toFixed(2) + '%"></span>') + '</span>';
  }

  /*
   * Beläggning i procent med talet före stapeln, så att det står i linje i en tabell och aldrig
   * hamnar långt från stapeln. Talet blir gult från 90 % och rött över 100 %.
   * opts.label ersätter talet, opts.title är en längre förklaring vid pekaren.
   */
  function bar(pct, opts) {
    opts = opts || {};
    var v = isNaN(pct) ? 0 : pct;
    /*
     * Tonen döms på det tal som visas, inte på det råa. 89,6 % skrivs som
     * "90 %", och stod gränsen på det råa värdet läste raden "90 %" i lugn
     * ton bredvid ett lägesord som sa i balans — siffran och färgen sa
     * emot varandra. Nu gäller gränsen det man ser.
     */
    var shown = Math.round(v);
    var tone = opts.share ? '' : shown > 100 ? ' crit' : shown >= (opts.warnAt || 90) ? ' warn' : '';
    var label = opts.label !== undefined ? opts.label : U.fmtPct(v);
    return '<div class="bar"' + (opts.title === '' ? '' : ' title="' + esc(opts.title || label) + '"') + '>' +
      '<span class="bar-val' + tone + '">' + esc(label) + '</span>' + loadTrack(v, 0, 100, opts) + '</div>';
  }

  /* Förklaring till beläggningsstaplarna, för diagram där det inte står i rubriken. */
  function barLegend(withOver) {
    return '<div class="legend-line" aria-hidden="true"><span><span class="sw loaded"></span>Belastat</span><span><span class="sw free"></span>Ledigt</span>' +
      (withOver ? '<span><span class="sw over"></span>Över kapaciteten</span>' : '') + '<span><span class="sw-cap"></span>100 % av kapaciteten</span></div>';
  }

  var LEVELS = ['', 'Grundläggande', 'Erfaren', 'Avancerad', 'Expert'];

  function level(n) {
    var h = '<span class="level" title="' + esc(LEVELS[n] || '') + '">';
    for (var i = 1; i <= 4; i++) h += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return h + '</span>';
  }

  function donut(pct, opts) {
    opts = opts || {};
    var r = 54;
    var c = 2 * Math.PI * r;
    var v = Math.max(0, Math.min(100, pct || 0));
    var cls = pct > 100.5 ? ' crit' : pct >= 90 ? ' warn' : '';
    return (
      '<svg class="donut" viewBox="0 0 132 132" role="img" aria-label="' + esc(opts.label || U.fmtPct(pct)) + '">' +
      '<circle class="track" cx="66" cy="66" r="' + r + '" fill="none" stroke-width="9"/>' +
      '<circle class="val' + cls + '" cx="66" cy="66" r="' + r + '" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (c * v) / 100 + ' ' + c + '" transform="rotate(-90 66 66)"/>' +
      '<text x="66" y="73" text-anchor="middle">' + esc(U.fmtPct(pct)) + '</text></svg>'
    );
  }

  function kpi(label, value, note, opts) {
    opts = opts || {};
    var tone = opts.crit ? ' crit' : opts.warn ? ' warn' : '';
    return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value' + tone + '">' + value + '</div>' + (note ? '<div class="kpi-note">' + note + '</div>' : '') + '</div>';
  }

  /* ---------- Detaljsidor ---------- */

  /* De viktigaste talen för en enskild sak. items: [{ label, value, note, tone: 'crit' | 'warn' }] */
  function facts(items) {
    return '<div class="kpis">' + items.filter(Boolean).map(function (x) {
      return kpi(x.label, x.value, x.note, { crit: x.tone === 'crit', warn: x.tone === 'warn' });
    }).join('') + '</div>';
  }

  /* Uppgifter som etikett och värde. rows: [[etikett, html], ...]. Tomma rader hoppas över. */
  function props(rows) {
    return '<dl class="kv">' + rows.filter(Boolean).map(function (r) {
      var v = r[1] === '' || r[1] === null || r[1] === undefined ? '<span class="muted">–</span>' : r[1];
      return '<dt>' + esc(r[0]) + '</dt><dd>' + v + '</dd>';
    }).join('') + '</dl>';
  }

  /* Ett block i detaljsidans högerspalt, med rubrik och eventuell knapp. */
  function asideBlock(title, body, action) {
    return '<section class="aside-block"><div class="aside-head"><div class="aside-title">' + esc(title) + '</div>' + (action || '') + '</div>' + body + '</section>';
  }

  /* Huvudinnehåll till vänster, uppgifter till höger. Under 900 px hamnar uppgifterna under. */
  function detailLayout(main, aside) {
    return '<div class="detail"><div class="detail-main">' + main + '</div><div class="detail-aside">' + aside + '</div></div>';
  }

  /* Förklaring som är stängd från början: hur ett tal räknas fram. */
  function explain(summary, body) {
    return '<details class="explain"><summary>' + esc(summary) + '</summary><div class="explain-body">' + body + '</div></details>';
  }

  /*
   * Tidsbudget: åtaganden i ordning mot den tid som finns. parts: [{ label, hours, kind: 'team' | 'role' }].
   * Skalan är det största av tillgänglig tid och åtagandena, så att överallokering syns som det som sticker ut.
   */
  function budget(parts, available, opts) {
    var capLabel = (opts && opts.capLabel) || 'Tillgänglig tid';
    var committed = U.sum(parts, function (p) { return p.hours; });
    var scale = Math.max(available, committed) || 1;
    var pct = function (h) { return (h / scale) * 100; };
    var capAt = pct(available);
    var desc = capLabel + ' ' + U.fmtH(available) + ', åtaganden ' + U.fmtH(committed) + ': ' +
      parts.map(function (p) { return p.label + ' ' + U.fmtH(p.hours); }).join(', ');
    var h = '<div class="budget"><div class="budget-bar" role="img" aria-label="' + esc(desc) + '">';
    parts.forEach(function (p) {
      if (p.hours > 0) h += '<span class="budget-seg ' + p.kind + '" style="width:' + pct(p.hours) + '%" data-tip="' + esc(p.label + '\n' + U.fmtH(p.hours)) + '"></span>';
    });
    if (committed < available) h += '<span class="budget-seg free" style="width:' + pct(available - committed) + '%" data-tip="' + esc('Oallokerat\n' + U.fmtH(available - committed)) + '"></span>';
    if (committed > available) h += '<span class="budget-over" style="left:' + capAt + '%" data-tip="' + esc('Mer än tillgänglig tid\n' + U.fmtH(committed - available)) + '"></span>';
    h += '<span class="budget-cap" style="left:' + capAt + '%"></span></div>';
    var near = capAt > 70;
    h += '<div class="budget-axis" aria-hidden="true"><span style="left:0">0 h</span>' +
      '<span style="' + (near ? 'right:' + (100 - capAt) + '%' : 'left:' + capAt + '%;transform:translateX(-50%)') + '">' + esc(capLabel) + ' ' + U.fmtH(available) + '</span></div>';
    return h + '</div>';
  }

  function pageHead(opts) {
    return (
      '<div class="page-top">' +
      (opts.crumbs ? '<nav class="crumbs" aria-label="Brödsmulor">' + opts.crumbs + '</nav>' : '') +
      '<header class="page-head"><div class="page-head-text"><h1 class="page-title">' + opts.title + '</h1>' +
      (opts.meta && opts.meta.length ? '<p class="page-meta">' + opts.meta.filter(Boolean).map(function (m) { return '<span><span>' + m + '</span></span>'; }).join('') + '</p>' : '') +
      (opts.sub ? '<p class="page-sub">' + opts.sub + '</p>' : '') +
      /*
       * Uppdraget: vad saken är till för, med egen etikett. Det är en annan
       * sorts text än beskrivningen, som säger vad saken är. Står uppdraget
       * här står det ingen annanstans på sidan.
       */
      (opts.mission ? '<p class="page-mission"><span class="page-mission-lead">Uppdrag</span>' + opts.mission + '</p>' : '') +
      '</div>' + (opts.actions ? '<div class="page-actions">' + opts.actions + '</div>' : '') + '</header></div>'
    );
  }


  function btn(label, action, opts) {
    opts = opts || {};
    var attrs = ' data-action="' + esc(action) + '"';
    Object.keys(opts.data || {}).forEach(function (k) {
      attrs += ' data-' + k + '="' + esc(opts.data[k]) + '"';
    });
    return '<button type="button" class="btn ' + (opts.cls || '') + '"' + attrs + '>' + esc(label) + '</button>';
  }

  function iconBtn(iconName, action, data, title, cls) {
    var attrs = ' data-action="' + esc(action) + '"';
    Object.keys(data || {}).forEach(function (k) {
      attrs += ' data-' + k + '="' + esc(data[k]) + '"';
    });
    return '<button type="button" class="btn-icon ' + (cls || '') + '" title="' + esc(title) + '" aria-label="' + esc(title) + '"' + attrs + '>' + icon(iconName) + '</button>';
  }

  function tabs(id, items, current) {
    return (
      '<div class="tabs" role="tablist">' +
      items
        .map(function (t) {
          var on = t.key === current;
          return '<button type="button" role="tab" class="tab' + (on ? ' on' : '') + '" aria-selected="' + on + '" tabindex="' + (on ? 0 : -1) + '" id="tab-' + esc(id) + '-' + esc(t.key) + '" data-action="tab" data-tabs="' + esc(id) + '" data-key="' + esc(t.key) + '">' + esc(t.label) + '</button>';
        })
        .join('') +
      '</div>'
    );
  }

  function seg(id, items, current) {
    return (
      '<div class="seg" role="group">' +
      items
        .map(function (t) {
          return '<button type="button" class="' + (t.key === current ? 'on' : '') + '" aria-pressed="' + (t.key === current) + '" id="seg-' + esc(id) + '-' + esc(t.key) + '" data-action="seg" data-seg="' + esc(id) + '" data-key="' + esc(t.key) + '">' + esc(t.label) + '</button>';
        })
        .join('') +
      '</div>'
    );
  }

  /* ---------- Tabell med sök, sortering och sidor ---------- */

  var tableState = {};

  function tstate(id, defaults) {
    if (!tableState[id]) tableState[id] = Object.assign({ q: '', sortKey: null, dir: 1, page: 1 }, defaults || {});
    return tableState[id];
  }

  /* Sidnummer att visa. Många sidor kortas till första, sista och de närmaste (null = utelämnat). */
  function pageList(cur, pages) {
    var out = [];
    for (var p = 1; p <= pages; p++) {
      if (pages <= 7 || p === 1 || p === pages || Math.abs(p - cur) <= 1) out.push(p);
      else if (out[out.length - 1] !== null) out.push(null);
    }
    return out;
  }

  function table(cfg) {
    var st = tstate(cfg.id, { sortKey: cfg.defaultSort || null, dir: cfg.defaultDir || 1 });
    var rows = cfg.rows.slice();
    /*
     * Sökningen täcker allt som står i raden: varje kolumns synliga text, även kolumner som
     * är dolda på smal skärm, plus det som vyn lägger till i search.text (till exempel beskrivning).
     */
    if (cfg.search && st.q) {
      var match = U.matcher(st.q);
      rows = rows.filter(function (r) {
        var text = cfg.columns.map(function (c) { return c.render ? U.textOf(c.render(r)) : ''; }).join(' ');
        return match(text + ' ' + (cfg.search.text ? cfg.search.text(r) : ''));
      });
    }
    var sortCol = cfg.columns.filter(function (c) { return c.key === st.sortKey; })[0];
    if (sortCol && sortCol.sort) {
      rows.sort(function (a, b) {
        var va = sortCol.sort(a);
        var vb = sortCol.sort(b);
        if (typeof va === 'string') return va.localeCompare(vb, 'sv') * st.dir;
        return ((va || 0) - (vb || 0)) * st.dir;
      });
    }
    var size = cfg.pageSize || 10;
    /* En rad som öppnas utifrån (länk eller sökning) ska synas: hoppa till sidan där den står. */
    if (cfg.expand && cfg.expandedId && st.openId !== cfg.expandedId && cfg.pageSize !== 0) {
      var at = rows.map(function (r) { return r.id; }).indexOf(cfg.expandedId);
      if (at >= 0) st.page = Math.floor(at / size) + 1;
    }
    st.openId = cfg.expandedId || null;
    var pages = Math.max(1, Math.ceil(rows.length / size));
    if (st.page > pages) st.page = pages;
    var from = (st.page - 1) * size;
    var shown = cfg.pageSize === 0 ? rows : rows.slice(from, from + size);

    var h = '';
    if (cfg.search || cfg.title || cfg.tools) {
      h += '<div class="table-tools">';
      h += cfg.title ? '<div class="card-title">' + cfg.title + '</div>' : '<span></span>';
      h += '<div class="row">' + (cfg.tools || '');
      /* Sortering som lista. Visas bara när raderna är kort och kolumnrubrikerna därför dolda. */
      var sortable = cfg.columns.filter(function (c) { return c.sort && c.label; });
      if (sortable.length > 1) {
        var sortOpts = [];
        sortable.forEach(function (c) {
          sortOpts.push({ value: c.key + '|1', label: c.label + ' ↑' });
          sortOpts.push({ value: c.key + '|-1', label: c.label + ' ↓' });
        });
        h += '<label class="sort-pick"><span class="sr-only">Sortera efter</span><select id="sortpick-' + esc(cfg.id) + '" data-change="tbl-sort-pick" data-table="' + esc(cfg.id) + '">' +
          OOSSelect.optionsHtml(sortOpts, st.sortKey ? st.sortKey + '|' + st.dir : '', 'Sortera …') + '</select></label>';
      }
      if (cfg.search) {
        h += '<label class="search">' + icon('search') + '<input type="search" id="q-' + esc(cfg.id) + '" data-input="tbl-search" data-table="' + esc(cfg.id) + '" placeholder="' + esc(cfg.search.placeholder || 'Sök …') + '" value="' + esc(st.q) + '" aria-label="' + esc(cfg.search.placeholder || 'Sök') + '"></label>';
      }
      h += '</div></div>';
    }
    h += '<div class="table-wrap"><table class="tbl"' + (cfg.search && st.q ? ' data-q="' + esc(st.q) + '"' : '') + '><thead><tr>';
    cfg.columns.forEach(function (c) {
      var cls = (c.cls || '') + (c.sort ? ' sortable' : '');
      var arrow = st.sortKey === c.key ? (st.dir > 0 ? '↑' : '↓') : '';
      /* Sista ordet och sorteringspilen hålls ihop, så att pilen aldrig hamnar ensam på en rad. */
      var label = c.label ? esc(c.label) : '<span class="sr-only">Åtgärder</span>';
      if (c.label && c.sort) {
        var cut = c.label.lastIndexOf(' ');
        label = (cut > 0 ? esc(c.label.slice(0, cut)) + ' ' : '') + '<span class="nowrap">' + esc(c.label.slice(cut + 1)) + '<span class="sort">' + arrow + '</span></span>';
      }
      h += '<th class="' + cls + '"' + (c.opt ? ' data-opt="' + c.opt + '"' : '') + (c.sort ? ' data-action="tbl-sort" data-table="' + esc(cfg.id) + '" data-key="' + esc(c.key) + '" tabindex="0" id="sort-' + esc(cfg.id) + '-' + esc(c.key) + '"' : '') + (c.sort ? ' aria-sort="' + (arrow ? (st.dir > 0 ? 'ascending' : 'descending') : 'none') + '"' : '') + '>' + label + '</th>';
    });
    h += '</tr></thead><tbody>';
    if (!shown.length) {
      h += '<tr><td colspan="' + cfg.columns.length + '"><div class="empty">' + (st.q
        ? esc('Inga träffar på "' + st.q + '".') + ' <button type="button" class="link-btn" data-action="tbl-clear" data-table="' + esc(cfg.id) + '">Rensa sökningen</button>'
        : esc(cfg.emptyText || 'Inget att visa ännu.')) + '</div></td></tr>';
    }
    /*
     * Utfällbara rader (cfg.expand): ett klick på raden visar detaljerna direkt under den, i stället
     * för längre ned på sidan. Ett klick till fäller ihop. Bara en rad är öppen åt gången.
     */
    shown.forEach(function (r) {
      var click = cfg.rowGo ? cfg.rowGo(r) : null;
      var open = !!(cfg.expand && cfg.expandedId === r.id);
      var sel = open || (cfg.selectedId && r.id === cfg.selectedId);
      h += '<tr' + (cfg.expand ? ' id="row-' + esc(cfg.id) + '-' + esc(r.id) + '"' : '') + ' class="' + (click ? 'clickable' : '') + (sel ? ' selected' : '') + (cfg.expand ? ' expandable' : '') + (open ? ' is-open' : '') + (cfg.rowClass ? ' ' + cfg.rowClass(r) : '') + '"' +
        (click ? ' data-go="' + esc(click) + '" tabindex="0"' : '') + (sel && !cfg.expand ? ' aria-current="true"' : '') + '>';
      cfg.columns.forEach(function (c, ci) {
        /* aria-expanded är inte tillåtet på en vanlig tabellrad. Läget läses upp som text i stället. */
        var chev = cfg.expand && ci === 0 ? '<span class="row-chev" aria-hidden="true">' + icon('chevronRight') + '</span>' + (open ? '<span class="sr-only">Utfälld: </span>' : '') : '';
        h += '<td class="' + (c.cls || '') + (chev ? ' has-chev' : '') + '">' + chev + c.render(r) + '</td>';
      });
      h += '</tr>';
      if (open) {
        h += '<tr class="row-open"><td class="row-open-cell" colspan="' + cfg.columns.length + '"><div class="row-open-body">' + cfg.expand(r) + '</div></td></tr>';
      }
    });
    h += '</tbody></table></div>';
    if (cfg.pageSize !== 0) {
      var showing = st.q
        ? (rows.length ? 'Visar ' + (from + 1) + '–' + Math.min(from + size, rows.length) + ' av ' : '') + U.plural(rows.length, 'träff', 'träffar') + ' bland ' + cfg.rows.length + ' ' + esc(cfg.noun || '') +
          ' · <button type="button" class="link-btn" data-action="tbl-clear" data-table="' + esc(cfg.id) + '">Rensa</button>'
        : 'Visar ' + (rows.length ? from + 1 : 0) + '–' + Math.min(from + size, rows.length) + ' av ' + rows.length + ' ' + esc(cfg.noun || '');
      h += '<div class="pager"><span>' + showing + '</span>';
      if (pages > 1) {
        h += '<div class="pager-pages"><button type="button" data-action="tbl-page" data-table="' + esc(cfg.id) + '" data-page="' + (st.page - 1) + '" id="pg-' + esc(cfg.id) + '-prev"' + (st.page === 1 ? ' disabled' : '') + ' aria-label="Föregående sida">←</button>';
        pageList(st.page, pages).forEach(function (p) {
          if (p === null) {
            h += '<span class="pager-gap" aria-hidden="true">…</span>';
            return;
          }
          h += '<button type="button" class="' + (p === st.page ? 'on' : '') + '" id="pg-' + esc(cfg.id) + '-' + p + '" data-action="tbl-page" data-table="' + esc(cfg.id) + '" data-page="' + p + '"' + (p === st.page ? ' aria-current="page"' : '') + ' aria-label="Sida ' + p + '">' + p + '</button>';
        });
        h += '<button type="button" data-action="tbl-page" data-table="' + esc(cfg.id) + '" data-page="' + (st.page + 1) + '" id="pg-' + esc(cfg.id) + '-next"' + (st.page === pages ? ' disabled' : '') + ' aria-label="Nästa sida">→</button></div>';
      }
      h += '</div>';
    }
    return h;
  }

  /* ---------- Formulär i modal ---------- */

  var modalRoot = null;
  var activeForm = null;
  var pendingConfirm = null;
  var returnFocus = null;

  function root() {
    if (!modalRoot) modalRoot = document.getElementById('modal-root');
    return modalRoot;
  }

  /* Hjälptext kan vara en funktion av formulärets värden. Då syns den bara när den gäller. */
  function helpText(f, values) {
    return typeof f.help === 'function' ? f.help(values || {}) || '' : f.help || '';
  }

  function fieldHtml(f, value, values) {
    var id = 'f-' + f.key;
    /*
     * Eget fält: vyn ritar innehållet (render) och läser värdet (read). Används för listor som
     * kompetensbehov och beroenden, där ett vanligt fält inte räcker.
     */
    if (f.type === 'custom') {
      return '<div class="fld full custom" data-field="' + esc(f.key) + '" role="group" aria-labelledby="' + id + '-label">' +
        '<span id="' + id + '-label">' + esc(f.label) + '</span><div class="custom-body" id="' + id + '">' + f.render(value) + '</div>' +
        (f.help ? '<span class="help" data-help="' + esc(f.key) + '"' + (helpText(f, values) ? '' : ' hidden') + '>' + esc(helpText(f, values)) + '</span>' : '') + '<span class="err" hidden></span></div>';
    }
    /*
     * Graderat val: stegen står som kolumner med spåret under, i stället
     * för i en rullista. Hela skalan syns, och var det här valet ligger på
     * den. Radioknappar under ytan ger piltangenter och uppläsning gratis;
     * ifyllt spår ritas med :has() så att inget skript behövs.
     */
    if (f.type === 'grade') {
      var steps = f.options || [];
      var g = '<div class="fld full grade" data-field="' + esc(f.key) + '" role="radiogroup" aria-labelledby="' + id + '-label">' +
        '<span id="' + id + '-label">' + esc(f.label) + (f.required ? ' *' : '') + '</span>' +
        '<div class="grade-head">' + steps.map(function (s) { return '<span>' + esc(s.label) + '</span>'; }).join('') + '</div>' +
        '<div class="grade-track"><span class="grade-line" aria-hidden="true"></span><span class="grade-fill" aria-hidden="true"></span>';
      steps.forEach(function (s) {
        var on = String(s.value) === String(value);
        g += '<label class="grade-opt"><input type="radio" name="' + esc(f.key) + '" value="' + esc(s.value) + '"' + (on ? ' checked' : '') + '>' +
          '<span class="grade-dot" aria-hidden="true"></span><span class="sr-only">' + esc(s.label) + '</span></label>';
      });
      g += '</div>';
      if (f.help) g += '<span class="help" data-help="' + esc(f.key) + '"' + (helpText(f, values) ? '' : ' hidden') + '>' + esc(helpText(f, values)) + '</span>';
      return g + '<span class="err" hidden></span></div>';
    }
    var cls = 'fld' + (f.full || f.type === 'textarea' ? ' full' : '') + (f.type === 'checkbox' ? ' check' : '');
    var req = f.required ? ' required' : '';
    var h = '<label class="' + cls + '" data-field="' + esc(f.key) + '">';
    if (f.type === 'checkbox') {
      h += '<input type="checkbox" id="' + id + '" name="' + esc(f.key) + '"' + (value ? ' checked' : '') + '><span>' + esc(f.label) + '</span>';
    } else {
      h += '<span>' + esc(f.label) + (f.required ? ' *' : '') + '</span>';
      if (f.type === 'textarea') {
        h += '<textarea id="' + id + '" name="' + esc(f.key) + '"' + req + '>' + esc(value) + '</textarea>';
      } else if (f.type === 'select') {
        h += '<select id="' + id + '" name="' + esc(f.key) + '"' + req + '>' + OOSSelect.optionsHtml(f.options, value, f.placeholder) + '</select>';
      } else {
        var extra = '';
        if (f.min !== undefined) extra += ' min="' + f.min + '"';
        if (f.max !== undefined) extra += ' max="' + f.max + '"';
        if (f.step !== undefined) extra += ' step="' + f.step + '"';
        if (f.placeholder) extra += ' placeholder="' + esc(f.placeholder) + '"';
        if (f.datalist) extra += ' data-suggest="' + esc(JSON.stringify(f.datalist)) + '" autocomplete="off"';
        h += '<input type="' + (f.type || 'text') + '" id="' + id + '" name="' + esc(f.key) + '" value="' + esc(value) + '"' + req + extra + '>';
      }
      if (f.help) h += '<span class="help" data-help="' + esc(f.key) + '"' + (helpText(f, values) ? '' : ' hidden') + '>' + esc(helpText(f, values)) + '</span>';
    }
    h += '<span class="err" hidden></span></label>';
    return h;
  }

  /*
   * Formulär i dialog. Två storlekar (se DESIGN.md, Skrollning):
   *  - vanlig, 540 px: korta formulär som ryms utan att skrolla.
   *  - bred (cfg.wide): långa formulär med konsekvens, i tre spalter på breda skärmar: fälten,
   *    det som påverkar kapaciteten (cfg.side) och konsekvensen. Skrollar något är det bara
   *    dialogens innehåll, och fälten till vänster står still.
   */
  function openForm(cfg) {
    var values = cfg.values || {};
    var side = cfg.wide ? cfg.side || [] : [];
    function render(list) {
      return list.map(function (f) {
        var v = values[f.key];
        if (v === undefined || v === null) v = f.default !== undefined ? f.default : '';
        return fieldHtml(f, v, values);
      }).join('');
    }
    var mainFields = cfg.fields.filter(function (f) { return side.indexOf(f.key) < 0; });
    var sideFields = cfg.fields.filter(function (f) { return side.indexOf(f.key) >= 0; });
    var intro = cfg.intro ? '<p class="full muted small">' + cfg.intro + '</p>' : '';
    var bodyHtml = cfg.wide
      ? '<div class="modal-body wide"><div class="form-main">' + intro + render(mainFields) + '</div>' +
        (sideFields.length ? '<div class="form-mid">' + render(sideFields) + '</div>' : '') +
        (cfg.preview ? '<div class="form-side"></div>' : '') + '</div>'
      : '<div class="modal-body">' + intro + render(cfg.fields) + '</div>';
    var h =
      '<div class="modal-back" data-action="modal-backdrop"><div class="modal' + (cfg.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title"><form class="modal-form" novalidate>' +
      '<div class="modal-head"><h2 class="modal-title" id="modal-title">' + esc(cfg.title) + '</h2>' + iconBtn('x', 'modal-close', {}, 'Stäng') + '</div>' +
      bodyHtml +
      '<div class="modal-foot">' +
      (cfg.onDelete ? '<button type="button" class="btn btn-danger" data-action="modal-delete" style="margin-right:auto">Ta bort</button>' : '') +
      '<button type="button" class="btn" data-action="modal-close">Avbryt</button>' +
      '<button type="submit" class="btn btn-primary">' + esc(cfg.submitLabel || 'Spara') + '</button></div></form></div></div>';
    rememberFocus();
    root().innerHTML = h;
    OOSSelect.enhance(root());
    OOSMotion.dialogIn(root().querySelector('.modal'));
    activeForm = cfg;
    var form = root().querySelector('form');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      submitForm(form);
    });
    /*
     * Ett fel försvinner så snart det är rättat, inte först när man sparar igen. Felet räknas om
     * mot hela formuläret, eftersom det kan rättas i ett annat fält än det som visar det: en PI
     * som överlappar en annan visas på Från men kan rättas genom att ändra Till. Nya fel visas
     * aldrig medan man skriver, bara när man sparar.
     */
    var dropFixedErrors = function () {
      /* Datumväljaren kan skicka en sista händelse när dialogen just stängts. Då finns inget formulär att räkna på. */
      if (activeForm !== cfg) return;
      var bad = collectErrors(form);
      form.querySelectorAll('.fld.invalid').forEach(function (fld) {
        if (bad[fld.getAttribute('data-field')]) return;
        fld.classList.remove('invalid');
        var msg = fld.querySelector('.err');
        if (msg) { msg.hidden = true; msg.textContent = ''; }
      });
    };
    form.addEventListener('input', dropFixedErrors);
    form.addEventListener('change', dropFixedErrors);
    cfg.fields.forEach(function (f) {
      if (f.type === 'custom' && f.bind) f.bind(form.querySelector('[data-field="' + f.key + '"] .custom-body'), form);
    });
    /*
     * Förhandsvisning: formuläret kan visa konsekvensen av det man skriver innan man sparar,
     * till exempel hur teamets beläggning ändras av en ny epik.
     */
    if (cfg.preview) {
      var box = document.createElement('div');
      box.className = 'full form-preview';
      box.setAttribute('aria-live', 'polite');
      var sideBox = form.querySelector('.form-side');
      if (sideBox) sideBox.insertBefore(box, sideBox.firstChild);
      else form.querySelector('.modal-body').appendChild(box);
      var update = function () {
        var html = '';
        try { html = cfg.preview(readForm(form)) || ''; } catch (e) { html = ''; }
        box.innerHTML = html || (cfg.previewEmpty ? '<p class="preview-empty">' + esc(cfg.previewEmpty) + '</p>' : '');
      };
      form.addEventListener('input', update);
      form.addEventListener('change', update);
      update();
    }
    /* Hjälptexter som beror på andra fält uppdateras när man ändrar något. */
    if (cfg.fields.some(function (f) { return typeof f.help === 'function'; })) {
      var helps = function () {
        var v = readForm(form);
        cfg.fields.forEach(function (f) {
          if (typeof f.help !== 'function') return;
          var el = form.querySelector('[data-help="' + f.key + '"]');
          if (!el) return;
          var t = helpText(f, v);
          el.textContent = t;
          el.hidden = !t;
        });
      };
      form.addEventListener('change', helps);
      form.addEventListener('input', helps);
    }
    var first = form.querySelector('input:not([type=checkbox]), .sel-btn, textarea');
    if (first) first.focus();
  }

  function readForm(form) {
    var out = {};
    /* Datumväljaren kan skicka en sista händelse när dialogen just stängts. Då finns inga fält att läsa. */
    if (!activeForm) return out;
    activeForm.fields.forEach(function (f) {
      if (f.type === 'custom') {
        var box = form.querySelector('[data-field="' + f.key + '"] .custom-body');
        if (box) out[f.key] = f.read(box);
        return;
      }
      /* Graderat val: det är den förkryssade knappen som bär värdet. */
      if (f.type === 'grade') {
        var on = form.querySelector('[name="' + f.key + '"]:checked');
        out[f.key] = on ? Number(on.value) : null;
        return;
      }
      var el = form.querySelector('[name="' + f.key + '"]');
      if (!el) return;
      if (f.type === 'checkbox') out[f.key] = el.checked;
      else if (f.type === 'number') out[f.key] = el.value === '' ? null : Number(el.value);
      else out[f.key] = el.value.trim();
    });
    return out;
  }

  function showErrors(form, errors) {
    form.querySelectorAll('.fld').forEach(function (l) {
      l.classList.remove('invalid');
      var e = l.querySelector('.err');
      if (e) { e.hidden = true; e.textContent = ''; }
    });
    var firstBad = null;
    Object.keys(errors).forEach(function (k) {
      var l = form.querySelector('[data-field="' + k + '"]');
      if (!l) return;
      l.classList.add('invalid');
      var e = l.querySelector('.err');
      e.hidden = false;
      e.textContent = errors[k];
      if (!firstBad) firstBad = l.querySelector('.sel-btn') || l.querySelector('input,textarea');
    });
    if (firstBad) firstBad.focus();
  }

  /* Fälten var för sig, och sedan formulärets egen kontroll. Samma regler vid spara som när ett fel rättas. */
  function collectErrors(form) {
    var vals = readForm(form);
    var errors = {};
    activeForm.fields.forEach(function (f) {
      var v = vals[f.key];
      if (f.required && (v === '' || v === null || v === undefined)) errors[f.key] = 'Fyll i ' + f.label.toLowerCase() + '.';
      else if (f.type === 'number' && v !== null && v !== undefined) {
        if (f.min !== undefined && v < f.min) errors[f.key] = 'Minsta värde är ' + f.min + '.';
        if (f.max !== undefined && v > f.max) errors[f.key] = 'Högsta värde är ' + f.max + '.';
      }
    });
    if (!Object.keys(errors).length && activeForm.validate) {
      Object.assign(errors, activeForm.validate(vals) || {});
    }
    return errors;
  }

  function submitForm(form) {
    var errors = collectErrors(form);
    if (Object.keys(errors).length) {
      showErrors(form, errors);
      return;
    }
    var vals = readForm(form);
    var cfg = activeForm;
    closeModal();
    cfg.onSubmit(vals);
  }

  function rememberFocus() {
    if (!modalOpen()) returnFocus = document.activeElement;
  }

  /* Egen dialog, till exempel sökningen. Samma fokusregler som formulären. Returnerar dialogens rot. */
  function openDialog(html) {
    rememberFocus();
    root().innerHTML = html;
    activeForm = null;
    OOSMotion.dialogIn(root().querySelector('.modal'));
    return root();
  }

  /* Stänger dialogen, svarar nej på en öppen fråga och återställer fokus. */
  function closeModal() {
    OOSSelect.close();
    if (window.OOSDate) OOSDate.close();
    if (root()) root().innerHTML = '';
    activeForm = null;
    if (pendingConfirm) {
      var resolve = pendingConfirm;
      pendingConfirm = null;
      resolve(false);
    }
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  /* Håller tabbfokus inne i dialogen. */
  function trapFocus(ev) {
    if (ev.key !== 'Tab' || !modalOpen()) return;
    var items = Array.prototype.filter.call(
      root().querySelectorAll('button, input, select, textarea, [tabindex="0"]'),
      function (el) { return !el.disabled && el.offsetParent !== null; }
    );
    if (!items.length) return;
    var first = items[0];
    var last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }

  function confirmDialog(cfg) {
    return new Promise(function (resolve) {
      var h =
        '<div class="modal-back" data-action="modal-backdrop"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="modal-head"><h2 class="modal-title" id="modal-title">' + esc(cfg.title) + '</h2></div>' +
        '<div class="modal-body single">' + (cfg.body || '<p>' + cfg.message + '</p>') + '</div>' +
        '<div class="modal-foot"><button type="button" class="btn" data-confirm="no">Avbryt</button>' +
        '<button type="button" class="btn ' + (cfg.danger ? 'btn-danger-solid' : 'btn-primary') + '" data-confirm="yes">' + esc(cfg.confirmLabel || 'Bekräfta') + '</button></div></div></div>';
      rememberFocus();
      root().innerHTML = h;
      OOSMotion.dialogIn(root().querySelector('.modal'));
      activeForm = null;
      pendingConfirm = resolve;
      root().querySelector('[data-confirm="no"]').focus();
      root().querySelectorAll('[data-confirm]').forEach(function (b) {
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var yes = b.getAttribute('data-confirm') === 'yes';
          pendingConfirm = null;
          closeModal();
          resolve(yes);
        });
      });
    });
  }

  function modalDelete() {
    if (activeForm && activeForm.onDelete) {
      var fn = activeForm.onDelete;
      closeModal();
      fn();
    }
  }

  function modalOpen() {
    return !!(root() && root().innerHTML);
  }

  function toast(msg) {
    var box = document.getElementById('toasts');
    if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    box.appendChild(t);
    OOSMotion.toastIn(t);
    setTimeout(function () {
      OOSMotion.toastOut(t, function () { t.remove(); });
    }, 3200);
  }

  /* Tooltip för element med data-tip. */
  var tipEl = null;
  function showTip(target, x, y) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tooltip';
      /* Rutan visar samma text som elementets aria-label, så skärmläsare behöver den inte två gånger. */
      tipEl.setAttribute('aria-hidden', 'true');
      tipEl.hidden = true;
      document.body.appendChild(tipEl);
    }
    tipEl.innerHTML = esc(target.getAttribute('data-tip')).replace(/\n/g, '<br>');
    tipEl.hidden = false;
    var w = tipEl.offsetWidth;
    var hgt = tipEl.offsetHeight;
    var left = Math.min(window.innerWidth - w - 8, x + 14);
    var top = y + 16 + hgt > window.innerHeight ? y - hgt - 10 : y + 16;
    tipEl.style.left = Math.max(8, left) + 'px';
    tipEl.style.top = Math.max(8, top) + 'px';
  }
  function hideTip() {
    if (tipEl) tipEl.hidden = true;
  }

  return {
    icon: icon,
    avatar: avatar,
    badge: badge,
    statRow: statRow,
    meter: meter,
    askStrip: askStrip,
    state: state,
    delta: delta,
    statusBadge: statusBadge,
    statusFlag: statusFlag,
    bar: bar,
    loadTrack: loadTrack,
    barLegend: barLegend,
    level: level,
    LEVELS: LEVELS,
    donut: donut,
    kpi: kpi,
    facts: facts,
    props: props,
    asideBlock: asideBlock,
    detailLayout: detailLayout,
    explain: explain,
    budget: budget,
    pageHead: pageHead,
    btn: btn,
    iconBtn: iconBtn,
    tabs: tabs,
    seg: seg,
    table: table,
    tableState: tableState,
    tstate: tstate,
    openForm: openForm,
    openDialog: openDialog,
    closeModal: closeModal,
    modalDelete: modalDelete,
    modalOpen: modalOpen,
    trapFocus: trapFocus,
    confirm: confirmDialog,
    toast: toast,
    showTip: showTip,
    hideTip: hideTip
  };
})();
