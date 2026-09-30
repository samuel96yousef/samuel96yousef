/* Gränssnittskomponenter: ikoner, tabeller, formulär, dialoger och små visualiseringar. */
var OOSUI = (function () {
  var U = OOSUtil;
  var esc = U.esc;

  var ICONS = {
    home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.8a3.2 3.2 0 010 6.4"/><path d="M18 14.5c1.9.7 3.1 2.6 3.5 5.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-7M21 20H3"/>',
    gauge: '<path d="M4 18a8 8 0 1116 0"/><path d="M12 18l4-6"/><path d="M4 18h16"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    badge: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3z"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M2.5 12h3M18.5 12h3M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<path d="M12 3.5l9.5 16.5h-19L12 3.5z"/><path d="M12 10v4.5M12 17.2h.01"/>',
    alertCircle: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M4 4h16"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12h.01"/>',
    box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    cloud: '<path d="M7 18h10a4 4 0 00.6-7.95A6 6 0 006.2 9.1 4.5 4.5 0 007 18z"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z"/>',
    map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><path d="M9 3v15M15 6v15"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    refresh: '<path d="M20 11a8 8 0 00-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0014.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
    minus: '<path d="M5 12h14"/>'
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
  function badge(text, kind) {
    var cls = kind === 'warn' || kind === 'crit' ? ' badge-' + kind : '';
    return '<span class="badge' + cls + '">' + esc(text) + '</span>';
  }

  var STATUS = { active: 'Aktiv', production: 'I drift', development: 'Under utveckling', inactive: 'Inaktiv' };

  function statusBadge(status) {
    if (status === 'active' || status === 'production') return esc(STATUS[status]);
    return badge(STATUS[status] || status || '–', 'muted');
  }

  /* Visas bara när något avviker från normalläget. */
  function statusFlag(status) {
    return status === 'active' || status === 'production' ? '' : statusBadge(status);
  }

  /* Stapel för andel. Varning från 90 %, kritisk över 100 % (t.ex. överallokering). */
  function bar(pct, opts) {
    opts = opts || {};
    var v = isNaN(pct) ? 0 : pct;
    var cls = v > 100.5 ? ' crit' : v >= (opts.warnAt || 90) ? ' warn' : opts.soft ? ' soft' : '';
    var w = Math.max(0, Math.min(100, v));
    var label = opts.label !== undefined ? opts.label : U.fmtPct(v);
    return '<div class="bar" title="' + esc(opts.title || label) + '"><div class="bar-track"><div class="bar-fill' + cls + '" style="width:' + w + '%"></div></div><span class="bar-val' + (cls === ' crit' ? ' crit' : '') + '">' + esc(label) + '</span></div>';
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

  function kpi(iconName, label, value, note, opts) {
    opts = opts || {};
    return '<div class="kpi"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value' + (opts.crit ? ' crit' : '') + '">' + value + '</div>' + (note ? '<div class="kpi-note">' + note + '</div>' : '') + '</div>';
  }

  function pageHead(opts) {
    return (
      (opts.crumbs ? '<nav class="crumbs" aria-label="Brödsmulor">' + opts.crumbs + '</nav>' : '') +
      '<header class="page-head"><div class="page-head-text"><h1 class="page-title">' + opts.title + '</h1>' +
      (opts.sub ? '<p class="page-sub">' + opts.sub + '</p>' : '') +
      '</div>' + (opts.actions ? '<div class="page-actions">' + opts.actions + '</div>' : '') + '</header>'
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
          return '<button type="button" role="tab" class="tab' + (t.key === current ? ' on' : '') + '" aria-selected="' + (t.key === current) + '" data-action="tab" data-tabs="' + esc(id) + '" data-key="' + esc(t.key) + '">' + esc(t.label) + '</button>';
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
          return '<button type="button" class="' + (t.key === current ? 'on' : '') + '" aria-pressed="' + (t.key === current) + '" data-action="seg" data-seg="' + esc(id) + '" data-key="' + esc(t.key) + '">' + esc(t.label) + '</button>';
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

  function table(cfg) {
    var st = tstate(cfg.id, { sortKey: cfg.defaultSort || null, dir: cfg.defaultDir || 1 });
    var rows = cfg.rows.slice();
    if (cfg.search && st.q) {
      var q = st.q.toLowerCase();
      rows = rows.filter(function (r) {
        return cfg.search.text(r).toLowerCase().indexOf(q) >= 0;
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
    var pages = Math.max(1, Math.ceil(rows.length / size));
    if (st.page > pages) st.page = pages;
    var from = (st.page - 1) * size;
    var shown = cfg.pageSize === 0 ? rows : rows.slice(from, from + size);

    var h = '';
    if (cfg.search || cfg.title || cfg.tools) {
      h += '<div class="table-tools">';
      h += cfg.title ? '<div class="card-title">' + cfg.title + '</div>' : '<span></span>';
      h += '<div class="row">' + (cfg.tools || '');
      if (cfg.search) {
        h += '<label class="search">' + icon('search') + '<input type="search" id="q-' + esc(cfg.id) + '" data-input="tbl-search" data-table="' + esc(cfg.id) + '" placeholder="' + esc(cfg.search.placeholder || 'Sök …') + '" value="' + esc(st.q) + '" aria-label="' + esc(cfg.search.placeholder || 'Sök') + '"></label>';
      }
      h += '</div></div>';
    }
    h += '<div class="table-wrap"><table class="tbl"><thead><tr>';
    cfg.columns.forEach(function (c) {
      var cls = (c.cls || '') + (c.sort ? ' sortable' : '');
      var arrow = st.sortKey === c.key ? (st.dir > 0 ? '↑' : '↓') : '';
      h += '<th class="' + cls + '"' + (c.sort ? ' data-action="tbl-sort" data-table="' + esc(cfg.id) + '" data-key="' + esc(c.key) + '" tabindex="0"' : '') + (c.sort ? ' aria-sort="' + (arrow ? (st.dir > 0 ? 'ascending' : 'descending') : 'none') + '"' : '') + '>' + esc(c.label) + (c.sort ? '<span class="sort">' + arrow + '</span>' : '') + '</th>';
    });
    h += '</tr></thead><tbody>';
    if (!shown.length) {
      h += '<tr><td colspan="' + cfg.columns.length + '"><div class="empty">' + esc(st.q ? 'Inga träffar på "' + st.q + '".' : cfg.emptyText || 'Inget att visa ännu.') + '</div></td></tr>';
    }
    shown.forEach(function (r) {
      var click = cfg.rowGo ? cfg.rowGo(r) : null;
      var sel = cfg.selectedId && r.id === cfg.selectedId;
      h += '<tr class="' + (click ? 'clickable' : '') + (sel ? ' selected' : '') + '"' + (click ? ' data-go="' + esc(click) + '"' : '') + '>';
      cfg.columns.forEach(function (c) {
        h += '<td class="' + (c.cls || '') + '">' + c.render(r) + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    if (cfg.pageSize !== 0) {
      h += '<div class="pager"><span>Visar ' + (rows.length ? from + 1 : 0) + '–' + Math.min(from + size, rows.length) + ' av ' + rows.length + ' ' + esc(cfg.noun || '') + '</span>';
      if (pages > 1) {
        h += '<div class="pager-pages"><button type="button" data-action="tbl-page" data-table="' + esc(cfg.id) + '" data-page="' + (st.page - 1) + '"' + (st.page === 1 ? ' disabled' : '') + ' aria-label="Föregående sida">←</button>';
        for (var p = 1; p <= pages; p++) {
          h += '<button type="button" class="' + (p === st.page ? 'on' : '') + '" data-action="tbl-page" data-table="' + esc(cfg.id) + '" data-page="' + p + '">' + p + '</button>';
        }
        h += '<button type="button" data-action="tbl-page" data-table="' + esc(cfg.id) + '" data-page="' + (st.page + 1) + '"' + (st.page === pages ? ' disabled' : '') + ' aria-label="Nästa sida">→</button></div>';
      }
      h += '</div>';
    }
    return h;
  }

  /* ---------- Formulär i modal ---------- */

  var modalRoot = null;
  var activeForm = null;

  function root() {
    if (!modalRoot) modalRoot = document.getElementById('modal-root');
    return modalRoot;
  }

  function fieldHtml(f, value) {
    var id = 'f-' + f.key;
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
        h += '<select id="' + id + '" name="' + esc(f.key) + '"' + req + '>';
        if (f.placeholder !== undefined) h += '<option value="">' + esc(f.placeholder) + '</option>';
        (f.options || []).forEach(function (o) {
          h += '<option value="' + esc(o.value) + '"' + (String(o.value) === String(value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        });
        h += '</select>';
      } else {
        var extra = '';
        if (f.min !== undefined) extra += ' min="' + f.min + '"';
        if (f.max !== undefined) extra += ' max="' + f.max + '"';
        if (f.step !== undefined) extra += ' step="' + f.step + '"';
        if (f.datalist) extra += ' list="dl-' + esc(f.key) + '" autocomplete="off"';
        h += '<input type="' + (f.type || 'text') + '" id="' + id + '" name="' + esc(f.key) + '" value="' + esc(value) + '"' + req + extra + '>';
        if (f.datalist) {
          h += '<datalist id="dl-' + esc(f.key) + '">' + f.datalist.map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join('') + '</datalist>';
        }
      }
      if (f.help) h += '<span class="help">' + esc(f.help) + '</span>';
    }
    h += '<span class="err" hidden></span></label>';
    return h;
  }

  function openForm(cfg) {
    var values = cfg.values || {};
    var body = cfg.fields
      .map(function (f) {
        var v = values[f.key];
        if (v === undefined || v === null) v = f.default !== undefined ? f.default : '';
        return fieldHtml(f, v);
      })
      .join('');
    var h =
      '<div class="modal-back" data-action="modal-backdrop"><form class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" novalidate>' +
      '<div class="modal-head"><h2 class="modal-title" id="modal-title">' + esc(cfg.title) + '</h2>' + iconBtn('x', 'modal-close', {}, 'Stäng') + '</div>' +
      '<div class="modal-body">' + (cfg.intro ? '<p class="full muted small">' + cfg.intro + '</p>' : '') + body + '</div>' +
      '<div class="modal-foot">' +
      (cfg.onDelete ? '<button type="button" class="btn btn-danger" data-action="modal-delete" style="margin-right:auto">Ta bort</button>' : '') +
      '<button type="button" class="btn" data-action="modal-close">Avbryt</button>' +
      '<button type="submit" class="btn btn-primary">' + esc(cfg.submitLabel || 'Spara') + '</button></div></form></div>';
    root().innerHTML = h;
    activeForm = cfg;
    var form = root().querySelector('form');
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      submitForm(form);
    });
    var first = form.querySelector('input:not([type=checkbox]), select, textarea');
    if (first) first.focus();
  }

  function readForm(form) {
    var out = {};
    activeForm.fields.forEach(function (f) {
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
      if (!firstBad) firstBad = l.querySelector('input,select,textarea');
    });
    if (firstBad) firstBad.focus();
  }

  function submitForm(form) {
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
    if (Object.keys(errors).length) {
      showErrors(form, errors);
      return;
    }
    var cfg = activeForm;
    closeModal();
    cfg.onSubmit(vals);
  }

  function closeModal() {
    if (root()) root().innerHTML = '';
    activeForm = null;
  }

  function confirmDialog(cfg) {
    return new Promise(function (resolve) {
      var h =
        '<div class="modal-back" data-action="modal-backdrop"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="modal-head"><h2 class="modal-title" id="modal-title">' + esc(cfg.title) + '</h2></div>' +
        '<div class="modal-body single"><p>' + cfg.message + '</p></div>' +
        '<div class="modal-foot"><button type="button" class="btn" data-confirm="no">Avbryt</button>' +
        '<button type="button" class="btn ' + (cfg.danger ? 'btn-danger-solid' : 'btn-primary') + '" data-confirm="yes">' + esc(cfg.confirmLabel || 'Bekräfta') + '</button></div></div></div>';
      root().innerHTML = h;
      activeForm = null;
      var yes = root().querySelector('[data-confirm="yes"]');
      yes.focus();
      root().querySelectorAll('[data-confirm]').forEach(function (b) {
        b.addEventListener('click', function (ev) {
          ev.stopPropagation();
          closeModal();
          resolve(b.getAttribute('data-confirm') === 'yes');
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
    setTimeout(function () {
      t.remove();
    }, 3200);
  }

  /* Tooltip för element med data-tip. */
  var tipEl = null;
  function showTip(target, x, y) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tooltip';
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
    statusBadge: statusBadge,
    statusFlag: statusFlag,
    bar: bar,
    level: level,
    LEVELS: LEVELS,
    donut: donut,
    kpi: kpi,
    pageHead: pageHead,
    btn: btn,
    iconBtn: iconBtn,
    tabs: tabs,
    seg: seg,
    table: table,
    tableState: tableState,
    tstate: tstate,
    openForm: openForm,
    closeModal: closeModal,
    modalDelete: modalDelete,
    modalOpen: modalOpen,
    confirm: confirmDialog,
    toast: toast,
    showTip: showTip,
    hideTip: hideTip
  };
})();
