/*
 * Global sökning: hitta en person, ett team, en domän, ett system, en kompetens eller en sida
 * från var som helst i appen. Öppnas med Ctrl+K (⌘K på Mac), med / eller med knappen i menyn.
 *
 * Sökreglerna är desamma som i tabellerna (OOSUtil.matcher): alla ord måste finnas, i valfri
 * ordning. Träffar i namnet rankas före träffar i beskrivning, roller och kopplingar.
 */
(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;
  var C = OOS.common;

  var TYPES = [
    { key: 'page', label: 'Sidor' },
    { key: 'worker', label: 'Arbetare' },
    { key: 'team', label: 'Team' },
    { key: 'deliveryDomain', label: 'Leveransdomäner' },
    { key: 'domain', label: 'Verksamhets- och IT-domäner' },
    { key: 'system', label: 'System' },
    { key: 'initiative', label: 'Initiativ' },
    { key: 'epic', label: 'Epiker' },
    { key: 'competence', label: 'Kompetenser' }
  ];
  var PER_GROUP = 6;

  /* Allt som går att söka efter, byggt från datamodellen när sökningen öppnas. */
  function buildIndex() {
    var e = S.engine();
    var db = S.db;
    var out = [];
    function add(type, title, sub, go, text) {
      out.push({ type: type, title: title, sub: sub || '', go: go, title_n: U.searchNorm(title, true), text_n: U.searchNorm(title + ' ' + (sub || '') + ' ' + (text || ''), true) });
    }
    (OOS.NAV || []).forEach(function (g) {
      g.items.forEach(function (i) { add('page', i.label, g.label || 'Sida', i.page, ''); });
    });
    db.workers.forEach(function (w) {
      var pd = e.workerPrimaryDomains(w.id);
      var sub = [w.title, pd.team ? pd.team.name : '', w.type === 'ai' ? 'AI' : w.consultant ? 'Konsult' : ''].filter(Boolean).join(' · ');
      var text = [w.description]
        .concat(e.workerCompetences(w.id).map(function (x) { return x.competence.name; }))
        .concat(e.workerTeams(w.id).map(function (x) { return x.team.name + ' ' + (x.tw.role || ''); }))
        .concat(e.workerDomainRoles(w.id).map(function (x) { return x.ext.role + ' ' + x.target.name; }))
        .join(' ');
      add('worker', w.name, sub, 'workers:' + w.id, text);
    });
    db.teams.forEach(function (t) {
      var dd = e.teamDeliveryDomain(t.id);
      var lead = t.leadId ? e.get('workers', t.leadId) : null;
      var text = [t.description, t.purpose, lead ? lead.name : '']
        .concat(e.teamDomains(t.id).map(function (x) { return x.domain.name; }))
        .concat(e.teamSystems(t.id).map(function (x) { return x.system.name; }))
        .join(' ');
      add('team', t.name, C.categoryLabel(t.category) + ' team' + (dd ? ' · ' + dd.name : ''), 'teams:' + t.id, text);
    });
    db.deliveryDomains.forEach(function (d) {
      add('deliveryDomain', d.name, d.description, 'deliveryDomains:' + d.id, d.purpose);
    });
    db.domains.forEach(function (d) {
      var dd = e.deliveryDomainOfDomain(d.id);
      add('domain', d.name, (d.type === 'it' ? 'IT-domän' : 'Verksamhetsdomän') + (dd ? ' · ' + dd.name : ''), (d.type === 'it' ? 'itDomains:' : 'businessDomains:') + d.id, (d.description || '') + ' ' + (d.purpose || ''));
    });
    db.systems.forEach(function (s) {
      var owner = e.systemResponsibleTeam(s.id);
      add('system', s.name, [s.kind, owner ? owner.name : 'Saknar ansvarigt team'].filter(Boolean).join(' · '), 'systems:' + s.id, s.description);
    });
    (db.initiatives || []).forEach(function (x) {
      var dd = e.get('deliveryDomains', x.deliveryDomainId);
      var owner = x.ownerId ? e.get('workers', x.ownerId) : null;
      add('initiative', x.name, 'Initiativ' + (dd ? ' · ' + dd.name : ''), 'initiatives:' + x.id, (x.goal || '') + ' ' + (owner ? owner.name : ''));
    });
    (db.epics || []).forEach(function (ep) {
      var t = e.get('teams', ep.teamId);
      var init = ep.initiativeId ? e.get('initiatives', ep.initiativeId) : null;
      add('epic', ep.name, [C.EPIC_TYPE[ep.type], t ? t.name : '', C.EPIC_STATUS[ep.status]].filter(Boolean).join(' · '), 'epics:' + ep.id, (ep.description || '') + ' ' + (init ? init.name : ''));
    });
    db.competences.forEach(function (c) {
      add('competence', c.name, c.category, 'competences:' + c.id, (c.description || '') + ' ' + (c.details || ''));
    });
    return out;
  }

  /* Poäng: början av namnet väger tyngst, sedan början av ett ord i namnet, sedan var som helst. */
  function score(item, terms) {
    var s = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (item.text_n.indexOf(t) < 0) return -1;
      if (item.title_n.indexOf(t) === 0) s += 4;
      else if (item.title_n.indexOf(' ' + t) >= 0 || item.title_n.indexOf('-' + t) >= 0) s += 3;
      else if (item.title_n.indexOf(t) >= 0) s += 2;
      else s += 0.5;
    }
    return s;
  }

  /* Namnet med sökorden markerade. */
  function marked(text, terms) {
    var norm = U.searchNorm(text);
    if (norm.length !== text.length || !terms.length) return esc(text);
    var ranges = [];
    terms.forEach(function (t) {
      for (var i = norm.indexOf(t); i >= 0; i = norm.indexOf(t, i + t.length)) ranges.push([i, i + t.length]);
    });
    if (!ranges.length) return esc(text);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var h = '';
    var pos = 0;
    ranges.forEach(function (r) {
      if (r[0] < pos) return;
      h += esc(text.slice(pos, r[0])) + '<mark>' + esc(text.slice(r[0], r[1])) + '</mark>';
      pos = r[1];
    });
    return h + esc(text.slice(pos));
  }

  var state = null;

  function results(q) {
    var terms = U.matcher(q).terms;
    var groups = TYPES.map(function (t) { return { type: t, items: [] }; });
    var byType = {};
    groups.forEach(function (g) { byType[g.type.key] = g; });
    state.index.forEach(function (item) {
      if (!terms.length) {
        if (item.type === 'page') byType.page.items.push({ item: item, score: 0 });
        return;
      }
      var s = score(item, terms);
      if (s >= 0) byType[item.type].items.push({ item: item, score: s });
    });
    groups.forEach(function (g, i) {
      g.order = i;
      g.total = g.items.length;
      g.items.sort(function (a, b) { return b.score - a.score || a.item.title.localeCompare(b.item.title, 'sv'); });
      g.best = g.items.length ? g.items[0].score : 0;
      if (terms.length) g.items = g.items.slice(0, PER_GROUP);
    });
    /* Gruppen med den bästa träffen först. Träffar i namnet går före träffar i beskrivningar. */
    var shown = groups.filter(function (g) { return g.items.length; });
    shown.sort(function (a, b) { return b.best - a.best || a.order - b.order; });
    return { terms: terms, groups: shown };
  }

  function renderList() {
    var q = state.input.value;
    var res = results(q);
    state.flat = [];
    var h = '';
    res.groups.forEach(function (g) {
      h += '<div class="gs-group" role="presentation">' + esc(res.terms.length ? g.type.label : 'Gå till') +
        (g.total > g.items.length ? ' <span class="muted">' + g.items.length + ' av ' + g.total + '</span>' : '') + '</div>';
      g.items.forEach(function (x) {
        var i = state.flat.length;
        state.flat.push(x.item);
        h += '<div class="gs-opt" role="option" id="gs-o-' + i + '" data-i="' + i + '" aria-selected="false">' +
          '<span class="gs-title">' + marked(x.item.title, res.terms) + '</span>' +
          (x.item.sub ? '<span class="gs-sub">' + esc(x.item.sub) + '</span>' : '') +
          '<span class="sr-only">, ' + esc(g.type.label) + '</span></div>';
      });
    });
    if (!state.flat.length) {
      h = '<div class="gs-empty" role="presentation">Inga träffar på "' + esc(q.trim()) + '". Prova färre eller kortare ord.</div>';
    }
    state.list.innerHTML = h;
    state.status.textContent = res.terms.length ? U.plural(state.flat.length, 'träff', 'träffar') : '';
    setActive(state.flat.length ? 0 : -1);
  }

  function setActive(i) {
    state.active = i;
    state.list.querySelectorAll('.gs-opt').forEach(function (el) {
      var on = Number(el.getAttribute('data-i')) === i;
      el.classList.toggle('active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) el.scrollIntoView({ block: 'nearest' });
    });
    if (i >= 0) state.input.setAttribute('aria-activedescendant', 'gs-o-' + i);
    else state.input.removeAttribute('aria-activedescendant');
  }

  function choose(i) {
    var item = state && state.flat[i];
    if (!item) return;
    UI.closeModal();
    state = null;
    OOS.go(item.go);
  }

  function open() {
    if (UI.modalOpen()) return;
    var mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    var root = UI.openDialog(
      '<div class="modal-back search-back" data-action="modal-backdrop"><div class="modal search-modal" role="dialog" aria-modal="true" aria-label="Sök i Fabriken">' +
      '<div class="gs-head">' + UI.icon('search') +
      '<input id="gs-input" type="text" role="combobox" aria-expanded="true" aria-controls="gs-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" ' +
      'placeholder="Sök person, team, domän, system, kompetens …" aria-label="Sök i Fabriken">' +
      '<kbd>Esc</kbd></div>' +
      '<div id="gs-list" class="gs-list" role="listbox" aria-label="Sökresultat"></div>' +
      '<div class="gs-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> välj</span><span><kbd>Enter</kbd> öppna</span><span><kbd>' + (mac ? '⌘' : 'Ctrl') + '</kbd> <kbd>K</kbd> öppnar sökningen var som helst</span>' +
      '<span class="gs-status" role="status" aria-live="polite"></span></div>' +
      '</div></div>'
    );
    state = {
      index: buildIndex(),
      input: root.querySelector('#gs-input'),
      list: root.querySelector('#gs-list'),
      status: root.querySelector('.gs-status'),
      flat: [],
      active: -1
    };
    state.input.addEventListener('input', renderList);
    state.input.addEventListener('keydown', function (ev) {
      var n = state.flat.length;
      if (ev.key === 'ArrowDown' && n) { ev.preventDefault(); setActive((state.active + 1) % n); }
      else if (ev.key === 'ArrowUp' && n) { ev.preventDefault(); setActive((state.active - 1 + n) % n); }
      else if (ev.key === 'Home' && n && !state.input.value) { ev.preventDefault(); setActive(0); }
      else if (ev.key === 'End' && n && !state.input.value) { ev.preventDefault(); setActive(n - 1); }
      else if (ev.key === 'Enter') { ev.preventDefault(); choose(state.active); }
    });
    state.list.addEventListener('mousemove', function (ev) {
      var opt = ev.target.closest('.gs-opt');
      if (opt && Number(opt.getAttribute('data-i')) !== state.active) setActive(Number(opt.getAttribute('data-i')));
    });
    state.list.addEventListener('click', function (ev) {
      var opt = ev.target.closest('.gs-opt');
      if (opt) choose(Number(opt.getAttribute('data-i')));
    });
    renderList();
    state.input.focus();
  }

  OOS.openSearch = open;
  OOS.actions['global-search'] = function () { open(); };
})();
