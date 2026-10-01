/* Appskal: navigation, routing och händelsehantering. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;

  /*
   * Menyn i tre namngivna grupper. Inställningar ligger för sig längst ned.
   * Ikonerna är enkla linjeikoner som hjälper ögat att hitta rätt, inte dekoration.
   */
  var NAV = [
    {
      label: 'Uppföljning',
      items: [
        { page: 'overview', label: 'Översikt', icon: 'home' },
        { page: 'insights', label: 'Insikter', icon: 'chart' },
        { page: 'reports', label: 'Rapporter', icon: 'table' }
      ]
    },
    {
      label: 'Organisation',
      items: [
        { page: 'deliveryDomains', label: 'Leveransdomäner', icon: 'layers', count: function () { return S.db.deliveryDomains.length; } },
        { page: 'businessDomains', label: 'Verksamhetsdomäner', icon: 'briefcase', count: function () { return S.db.domains.filter(function (d) { return d.type === 'business'; }).length; } },
        { page: 'itDomains', label: 'IT-domäner', icon: 'server', count: function () { return S.db.domains.filter(function (d) { return d.type === 'it'; }).length; } },
        { page: 'teams', label: 'Team', icon: 'users', count: function () { return S.db.teams.length; } },
        { page: 'systems', label: 'System', icon: 'box', count: function () { return S.db.systems.length; } }
      ]
    },
    {
      label: 'Resurser',
      items: [
        { page: 'workers', label: 'Arbetare', icon: 'user', count: function () { return S.db.workers.length; } },
        { page: 'competences', label: 'Kompetenser', icon: 'star', count: function () { return S.db.competences.length; } },
        { page: 'capacity', label: 'Kapacitet', icon: 'gauge' }
      ]
    },
    { label: '', foot: true, items: [{ page: 'settings', label: 'Inställningar', icon: 'sliders' }] }
  ];

  var NAV_ICONS = {
    home: '<path d="M4 11l8-6.5 8 6.5v8a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    chart: '<path d="M4 20h16"/><path d="M6 16l4-4.5 3.5 3L19 8"/>',
    table: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M10 10v9"/>',
    layers: '<path d="M12 4l8.5 4.25L12 12.5 3.5 8.25z"/><path d="M3.5 12.25L12 16.5l8.5-4.25"/><path d="M3.5 16.25L12 20.5l8.5-4.25"/>',
    briefcase: '<rect x="3.5" y="7" width="17" height="12.5" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
    server: '<rect x="4" y="4" width="16" height="7" rx="1.5"/><rect x="4" y="13" width="16" height="7" rx="1.5"/><path d="M8 7.5h.01M8 16.5h.01"/>',
    users: '<circle cx="9" cy="8.5" r="3.25"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8M21 19.5a6 6 0 0 0-3.5-5.45"/>',
    box: '<path d="M12 3.5l8 4.25v8.5L12 20.5l-8-4.25v-8.5z"/><path d="M4 7.75l8 4.25 8-4.25M12 12v8.5"/>',
    user: '<circle cx="12" cy="8.5" r="3.75"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
    star: '<path d="M12 4l2.45 5 5.5.8-4 3.9.95 5.5L12 16.6l-4.9 2.6.95-5.5-4-3.9 5.5-.8z"/>',
    gauge: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.25"/><circle cx="10" cy="17" r="2.25"/>'
  };

  function navIcon(name) {
    return '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (NAV_ICONS[name] || '') + '</svg>';
  }

  OOS.NAV = NAV;
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  var PAGES = {};
  NAV.forEach(function (g) { g.items.forEach(function (i) { PAGES[i.page] = i; }); });

  var st = OOS.state;
  st.page = 'overview';
  st.id = null;
  st.tabs = {};
  st.segs = {};
  st.navOpen = false;

  OOS.tab = function (key, def) { return st.tabs[key] || def; };
  OOS.segVal = function (key, def) { return st.segs[key] || def; };

  OOS.period = function () {
    var s = S.db.settings;
    return OOSEngine.periodOf(s.periodAnchor || U.todayISO(), s.periodType || 'month');
  };

  OOS.ctx = function () {
    var p = OOS.period();
    return { e: S.engine(), db: S.db, period: p, next: OOSEngine.nextPeriod(p), id: st.id, page: st.page };
  };

  function navItem(i) {
    var on = st.page === i.page;
    return '<button type="button" class="nav-item' + (on ? ' active' : '') + '" id="nav-' + i.page + '" data-go="' + i.page + '"' + (on ? ' aria-current="page"' : '') + '>' +
      navIcon(i.icon) + '<span class="nav-text">' + esc(i.label) + '</span>' +
      (i.count ? '<span class="nav-count">' + i.count() + '</span>' : '') + '</button>';
  }

  function renderNav() {
    var nav = document.getElementById('nav');
    var p = OOS.period();
    /* Fokus i menyn ska ligga kvar när menyn ritas om, till exempel efter byte av period. */
    var focusId = document.activeElement && nav.contains(document.activeElement) ? document.activeElement.id : null;
    var h = '<div class="brand"><span class="brand-mark" aria-hidden="true">F</span><div><div class="brand-name">Fabriken</div><div class="brand-sub">Organisationens operativsystem</div></div></div>';
    h += '<button type="button" class="nav-search" id="nav-search" data-action="global-search" aria-keyshortcuts="Control+K Meta+K">' + UI.icon('search') + '<span>Sök</span><kbd>' + (IS_MAC ? '⌘K' : 'Ctrl K') + '</kbd></button>';
    h += '<div class="nav-groups">';
    NAV.forEach(function (g, gi) {
      if (g.foot) return;
      h += '<div class="nav-group" role="group" aria-labelledby="nav-g-' + gi + '"><div class="nav-label" id="nav-g-' + gi + '">' + esc(g.label) + '</div>';
      g.items.forEach(function (i) { h += navItem(i); });
      h += '</div>';
    });
    h += '</div>';
    h += '<div class="nav-foot">';
    NAV.filter(function (g) { return g.foot; }).forEach(function (g) { g.items.forEach(function (i) { h += navItem(i); }); });
    h += '<div class="nav-period" role="group" aria-label="Period">' +
      '<div class="nav-period-label">Period</div><div class="nav-period-row">' +
      '<button type="button" class="btn-icon" id="nav-prev" data-action="period-shift" data-dir="-1" aria-label="Föregående period">' + UI.icon('arrowLeft') + '</button>' +
      '<strong aria-live="polite">' + esc(p.label) + '</strong>' +
      '<button type="button" class="btn-icon" id="nav-next" data-action="period-shift" data-dir="1" aria-label="Nästa period">' + UI.icon('arrowRight') + '</button></div></div>';
    h += '<div class="nav-org">Prototyp 1 · ' + esc(S.db.settings.orgName) + ' (demodata)</div></div>';
    nav.innerHTML = h;
    if (focusId) {
      var again = document.getElementById(focusId);
      if (again) again.focus();
    }
    nav.classList.toggle('open', st.navOpen);
    document.getElementById('nav-scrim').hidden = !st.navOpen;
    document.getElementById('topbar-title').textContent = PAGES[st.page] ? PAGES[st.page].label : '';
  }

  /*
   * Vilken sorts rörelse nästa omritning ska få, se js/motion.js.
   * Sätts av den som orsakar omritningen. Utan angivelse tolkas den som en dataändring.
   */
  OOS.motion = function (hint, tablist) {
    motionHint = hint;
    motionTabs = tablist || null;
  };
  var motionHint = 'nav';
  var motionTabs = null;

  function render() {
    var main = document.getElementById('main-inner');
    var hint = motionHint || 'update';
    var tabsId = motionTabs;
    motionHint = null;
    motionTabs = null;
    var snap = hint === 'update' || hint === 'detail' ? OOSMotion.snapshot(main) : null;
    widthSensitive = false;
    var active = document.activeElement;
    var focusId = active && active.id && main.contains(active) ? active.id : null;
    var caret = focusId && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    var view = OOS.views[st.page] || OOS.views.overview;
    var html;
    try {
      html = view(OOS.ctx());
    } catch (err) {
      console.error(err);
      html = '<div class="card card-body"><h2>Något gick fel i vyn</h2><p class="muted">' + esc(err.message) + '</p><p>' + UI.btn('Till översikten', 'go', { data: { to: 'overview' } }) + '</p></div>';
    }
    OOSSelect.close();
    main.innerHTML = html;
    OOSSelect.enhance(main);
    renderNav();
    renderedWidth = main.clientWidth;
    OOSLayout.fit(main, true);
    var tablist = tabsId && main.querySelector('[data-tabs="' + tabsId + '"]');
    OOSMotion.play(main, snap, hint, tablist ? tablist.closest('[role="tablist"]') : null);
    document.title = (PAGES[st.page] ? PAGES[st.page].label + ' · ' : '') + 'Fabriken';
    if (focusId) {
      var el = document.getElementById(focusId);
      if (el) {
        el.focus();
        if (caret !== null && el.setSelectionRange) {
          try { el.setSelectionRange(caret, caret); } catch (e) { /* inte alla fälttyper stöder markering */ }
        }
      }
    }
  }

  /*
   * Innehållsytans bredd för vyer som räknar ut sin layout själva, till exempel kopplingskartan.
   * En vy som frågar ritas om när bredden ändras.
   */
  var widthSensitive = false;
  var renderedWidth = 0;
  OOS.measure = function () {
    widthSensitive = true;
    return document.getElementById('main-inner').clientWidth;
  };

  function watchWidth() {
    OOSLayout.watch(document.getElementById('main-inner'), function (w) {
      if (!widthSensitive || Math.abs(w - renderedWidth) < 4) return;
      motionHint = 'quiet';
      render();
    });
  }

  OOS.refresh = render;

  var LIST_DETAIL = { deliveryDomains: 1, businessDomains: 1, itDomains: 1, systems: 1, competences: 1 };

  function currentTarget() {
    return st.page + (st.id ? ':' + st.id : '');
  }

  /* Webbläsarens bakåtknapp ska fungera. Inramade vyer kan blockera historiken, därav try. */
  function remember(target, replace) {
    try {
      var url = '#' + target.split(':')[0];
      if (replace) history.replaceState({ target: target }, '', url);
      else history.pushState({ target: target }, '', url);
    } catch (e) { /* historiken är inte tillgänglig här */ }
  }

  OOS.go = function (target, opts) {
    opts = opts || {};
    var parts = String(target).split(':');
    var page = PAGES[parts[0]] ? parts[0] : 'overview';
    var samePage = page === st.page;
    var changed = currentTarget() !== page + (parts[1] ? ':' + parts[1] : '');
    st.page = page;
    st.id = parts[1] || null;
    st.navOpen = false;
    UI.hideTip();
    if (!changed) motionHint = 'quiet';
    else if (samePage && LIST_DETAIL[page]) motionHint = 'detail';
    else motionHint = 'nav';
    render();
    if (changed && !opts.fromHistory) remember(currentTarget());
    if (samePage && LIST_DETAIL[page] && st.id) {
      var d = document.getElementById('detail');
      if (d && d.getBoundingClientRect().top > window.innerHeight - 120) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (changed) {
      window.scrollTo(0, 0);
      /* Flytta fokus till sidans rubrik så att skärmläsare och tangentbord följer med. */
      var h1 = document.querySelector('#main-inner h1');
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.focus({ preventScroll: true });
      }
    }
  };

  window.addEventListener('popstate', function (ev) {
    var target = ev.state && ev.state.target;
    if (!target) {
      var hash = '';
      try { hash = (location.hash || '').replace('#', ''); } catch (e) { hash = ''; }
      target = PAGES[hash] ? hash : 'overview';
    }
    UI.closeModal();
    OOS.go(target, { fromHistory: true });
  });

  function handleAction(el, ev) {
    var name = el.getAttribute('data-action');
    var ds = el.dataset;
    switch (name) {
      case 'tab':
        if (st.tabs[ds.tabs] === ds.key) return;
        st.tabs[ds.tabs] = ds.key;
        OOS.motion('tab', ds.tabs);
        render();
        return;
      case 'seg':
        st.segs[ds.seg] = ds.key;
        if (OOS.segHandlers && OOS.segHandlers[ds.seg]) OOS.segHandlers[ds.seg](ds.key);
        if (ds.seg === 'workers-filter') UI.tstate('tbl-workers').page = 1;
        render();
        return;
      case 'tbl-sort': {
        var t = UI.tstate(ds.table);
        if (t.sortKey === ds.key) t.dir = -t.dir;
        else { t.sortKey = ds.key; t.dir = 1; }
        render();
        return;
      }
      case 'tbl-clear': {
        var tq = UI.tstate(ds.table);
        tq.q = '';
        tq.page = 1;
        OOS.motion('quiet');
        render();
        var box = document.getElementById('q-' + ds.table);
        if (box) box.focus();
        return;
      }
      case 'tbl-page':
        UI.tstate(ds.table).page = Number(ds.page);
        OOS.motion('quiet');
        render();
        return;
      case 'go':
        OOS.go(ds.to);
        return;
      case 'modal-close':
        UI.closeModal();
        return;
      case 'modal-backdrop':
        /* Stäng bara om både tryck och släpp skedde utanför dialogen, inte vid markering av text. */
        if (ev.target === el && pressedOn === el) UI.closeModal();
        return;
      case 'modal-delete':
        UI.modalDelete();
        return;
      case 'global-search':
        if (st.navOpen) { st.navOpen = false; renderNav(); }
        OOS.openSearch();
        return;
      case 'nav-toggle':
        st.navOpen = !st.navOpen;
        renderNav();
        return;
      default:
        if (OOS.actions[name]) OOS.actions[name](el, ev);
        else console.warn('Okänd åtgärd', name);
    }
  }

  var pressedOn = null;
  document.addEventListener('mousedown', function (ev) {
    pressedOn = ev.target;
  });

  document.addEventListener('click', function (ev) {
    var actEl = ev.target.closest('[data-action]');
    var goEl = ev.target.closest('[data-go]');
    if (actEl && (!goEl || goEl.contains(actEl))) {
      if (actEl.hasAttribute('disabled')) return;
      handleAction(actEl, ev);
      return;
    }
    if (goEl) {
      ev.preventDefault();
      OOS.go(goEl.getAttribute('data-go'));
    }
  });

  document.addEventListener('keydown', function (ev) {
    /* Global sökning: Ctrl+K eller ⌘K var som helst, / när man inte skriver i ett fält. */
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.isContentEditable;
    if ((ev.key === 'k' || ev.key === 'K') && (ev.ctrlKey || ev.metaKey) && !ev.altKey) {
      ev.preventDefault();
      if (st.navOpen) { st.navOpen = false; renderNav(); }
      OOS.openSearch();
      return;
    }
    if (ev.key === '/' && !typing && !UI.modalOpen() && !ev.ctrlKey && !ev.metaKey) {
      ev.preventDefault();
      OOS.openSearch();
      return;
    }
    /* Esc i ett sökfält tömmer det först. Nästa Esc gör det vanliga. */
    if (ev.key === 'Escape' && ev.target.getAttribute && ev.target.getAttribute('data-input') === 'tbl-search' && ev.target.value) {
      ev.preventDefault();
      var tq = UI.tstate(ev.target.dataset.table);
      tq.q = '';
      tq.page = 1;
      OOS.motion('quiet');
      render();
      return;
    }
    if (ev.key === 'Escape') {
      if (UI.modalOpen()) UI.closeModal();
      else if (st.navOpen) { st.navOpen = false; renderNav(); }
      return;
    }
    UI.trapFocus(ev);
    /* Piltangenter mellan flikar, enligt WAI-ARIA-mönstret för flikar. */
    if ((ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') && ev.target.getAttribute('role') === 'tab') {
      var tabs = Array.prototype.slice.call(ev.target.parentNode.querySelectorAll('[role="tab"]'));
      var i = tabs.indexOf(ev.target) + (ev.key === 'ArrowRight' ? 1 : -1);
      var next = tabs[(i + tabs.length) % tabs.length];
      ev.preventDefault();
      handleAction(next, ev);
      var again = document.getElementById(next.id);
      if (again) again.focus();
      return;
    }
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var t = ev.target;
    if (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'A') return;
    if (t.hasAttribute('data-go')) {
      ev.preventDefault();
      OOS.go(t.getAttribute('data-go'));
    } else if (t.hasAttribute('data-action')) {
      ev.preventDefault();
      handleAction(t, ev);
    }
  });

  document.addEventListener('input', function (ev) {
    var el = ev.target.closest('[data-input]');
    if (!el) return;
    var name = el.getAttribute('data-input');
    if (name === 'tbl-search') {
      var t = UI.tstate(el.dataset.table);
      t.q = el.value;
      t.page = 1;
      OOS.motion('quiet');
      render();
      return;
    }
    if (OOS.inputs[name]) OOS.inputs[name](el, ev);
  });

  document.addEventListener('change', function (ev) {
    var el = ev.target.closest('[data-change]');
    if (!el) return;
    var name = el.getAttribute('data-change');
    if (name === 'tbl-sort-pick') {
      var parts = el.value.split('|');
      var t = UI.tstate(el.dataset.table);
      if (!parts[0]) return;
      t.sortKey = parts[0];
      t.dir = Number(parts[1]) || 1;
      render();
      return;
    }
    if (OOS.inputs[name]) OOS.inputs[name](el, ev);
  });

  document.addEventListener('mousemove', function (ev) {
    var el = ev.target.closest && ev.target.closest('[data-tip]');
    if (el) UI.showTip(el, ev.clientX, ev.clientY);
    else UI.hideTip();
  });

  function boot() {
    S.load();
    var hash = '';
    try { hash = (location.hash || '').replace('#', ''); } catch (e) { hash = ''; }
    if (PAGES[hash]) st.page = hash;
    render();
    remember(currentTarget(), true);
    watchWidth();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
