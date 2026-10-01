/* Appskal: navigation, routing och händelsehantering. */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;

  var NAV = [
    { items: [{ page: 'overview', label: 'Översikt' }, { page: 'insights', label: 'Insikter' }, { page: 'reports', label: 'Rapporter' }] },
    {
      label: 'Struktur',
      items: [
        { page: 'deliveryDomains', label: 'Leveransdomäner', count: function () { return S.db.deliveryDomains.length; } },
        { page: 'businessDomains', label: 'Verksamhetsdomäner', count: function () { return S.db.domains.filter(function (d) { return d.type === 'business'; }).length; } },
        { page: 'itDomains', label: 'IT-domäner', count: function () { return S.db.domains.filter(function (d) { return d.type === 'it'; }).length; } },
        { page: 'teams', label: 'Team', count: function () { return S.db.teams.length; } },
        { page: 'systems', label: 'System', count: function () { return S.db.systems.length; } }
      ]
    },
    {
      label: 'Resurser',
      items: [
        { page: 'workers', label: 'Arbetare', count: function () { return S.db.workers.length; } },
        { page: 'competences', label: 'Kompetenser', count: function () { return S.db.competences.length; } },
        { page: 'capacity', label: 'Kapacitet' }
      ]
    },
    { items: [{ page: 'settings', label: 'Inställningar' }] }
  ];

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

  function renderNav() {
    var nav = document.getElementById('nav');
    var p = OOS.period();
    var h = '<div class="brand"><div class="brand-name">Fabriken</div><div class="brand-sub">Organisationens operativsystem</div></div>';
    h += '<button type="button" class="nav-search" data-action="global-search" aria-keyshortcuts="Control+K Meta+K">' + UI.icon('search') + '<span>Sök</span><kbd>' + (IS_MAC ? '⌘K' : 'Ctrl K') + '</kbd></button>';
    NAV.forEach(function (g) {
      h += '<div class="nav-group">' + (g.label ? '<div class="nav-label">' + esc(g.label) + '</div>' : '');
      g.items.forEach(function (i) {
        var on = st.page === i.page;
        h += '<button type="button" class="nav-item' + (on ? ' active' : '') + '" data-go="' + i.page + '"' + (on ? ' aria-current="page"' : '') + '><span>' + esc(i.label) + '</span>' +
          (i.count ? '<span class="nav-count">' + i.count() + '</span>' : '') + '</button>';
      });
      h += '</div>';
    });
    h += '<div class="nav-foot"><div class="nav-period">Period <strong>' + esc(p.label) + '</strong></div><div>Prototyp 1 · ' + esc(S.db.settings.orgName) + ' (demodata)</div></div>';
    nav.innerHTML = h;
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
