/* Delat stöd för vyerna: länkar, urvalslistor, formulär för alla entiteter och borttagning. */
var OOS = { views: {}, actions: {}, inputs: {}, state: {} };

(function () {
  var U = OOSUtil;
  var UI = OOSUI;
  var esc = U.esc;
  var S = OOSStore;

  var C = (OOS.common = {});

  C.link = function (target, text, cls) {
    return '<button type="button" class="link ' + (cls || '') + '" data-go="' + esc(target) + '">' + esc(text) + '</button>';
  };

  C.domainPage = function (d) {
    return d && d.type === 'it' ? 'itDomains' : 'businessDomains';
  };

  C.domainRef = function (d) {
    if (!d) return '<span class="muted">–</span>';
    return '<span class="name-cell">' + UI.avatar(d.name, d.id, { size: 'sm' }) + C.link(C.domainPage(d) + ':' + d.id, d.name) + '</span>';
  };

  C.ddRef = function (dd) {
    if (!dd) return '<span class="muted">–</span>';
    return '<span class="name-cell">' + UI.avatar(dd.name, dd.id, { size: 'sm', text: dd.name[0] }) + C.link('deliveryDomains:' + dd.id, dd.name) + '</span>';
  };

  C.teamRef = function (t) {
    if (!t) return '<span class="muted">–</span>';
    return '<span class="name-cell">' + UI.avatar(t.name, t.id, { size: 'sm' }) + C.link('teams:' + t.id, t.name) + '</span>';
  };

  C.workerRef = function (w, sub) {
    if (!w) return '<span class="muted">–</span>';
    return (
      '<span class="name-cell">' + UI.avatar(w.name, w.id, { round: true, size: 'sm', text: w.type === 'ai' ? 'AI' : null }) +
      '<span>' + C.link('workers:' + w.id, w.name) + (sub ? '<br><span class="sub">' + esc(sub) + '</span>' : '') + '</span></span>'
    );
  };

  C.systemRef = function (s) {
    if (!s) return '<span class="muted">–</span>';
    return C.link('systems:' + s.id, s.name);
  };

  C.compRef = function (c) {
    if (!c) return '<span class="muted">–</span>';
    if (c.id === '_none') return '<span class="muted">' + esc(c.name) + '</span>';
    return C.link('competences:' + c.id, c.name);
  };

  /* ---------- Arbete ---------- */

  C.EPIC_TYPE = {};
  OOSEngine.EPIC_TYPES.forEach(function (t) { C.EPIC_TYPE[t.value] = t.label; });
  C.EPIC_STATUS = {};
  OOSEngine.EPIC_STATUS.forEach(function (t) { C.EPIC_STATUS[t.value] = t.label; });

  /* Status visas bara som märke när den avviker från normalläget: förslag och klar. */
  C.epicStatus = function (status) {
    var label = C.EPIC_STATUS[status] || status || '–';
    return status === 'proposed' || status === 'done' ? UI.badge(label, 'muted') : esc(label);
  };

  /* Ramen i klartext: "200 h/mån" eller "1 100 h totalt". */
  C.epicFrameText = function (ep) {
    return ep.effort === 'monthly' ? U.fmtNum(ep.hours) + '\u00a0h/mån' : U.fmtH(ep.hours) + ' totalt';
  };

  C.epicRef = function (ep) {
    if (!ep) return '<span class="muted">–</span>';
    return C.link('epics:' + ep.id, ep.name);
  };

  C.initiativeRef = function (x) {
    if (!x) return '<span class="muted">–</span>';
    return C.link('initiatives:' + x.id, x.name);
  };

  /* Färgruta för arbetstyp. Gråskala, eftersom färg är reserverad för avvikelser. */
  C.typeSwatch = function (type) {
    return '<span class="sw-k ' + esc(type) + '" aria-hidden="true"></span>';
  };

  /*
   * Konsekvensen av en epik för teamet, period för period (problem 17: konsekvenser ska synas direkt).
   * Jämför teamets beläggning utan epiken (eller med dess gamla värden) med beläggningen med den.
   * Ett förslag räknas som beslutat, så att man ser vad ett beslut skulle innebära.
   */
  C.epicImpact = function (v, original) {
    if (!v.teamId || !v.hours || !v.from || !v.to || v.from > v.to) return null;
    var db = S.db;
    var others = db.epics.filter(function (x) { return !original || x.id !== original.id; });
    var cand = Object.assign({}, original || {}, v, { id: original ? original.id : '_ny' });
    if (!OOSEngine.epicCounts(cand.status)) cand.status = 'planned';
    var before = OOSEngine.create(Object.assign({}, db, { epics: others }));
    var after = OOSEngine.create(Object.assign({}, db, { epics: others.concat([cand]) }));
    var rows = [];
    var p = OOS.period();
    for (var i = 0; i < 18 && rows.length < 6; i++) {
      if (p.start > cand.to) break;
      if (p.end >= cand.from) {
        var b = before.teamCapacity(cand.teamId, p);
        var a = after.teamCapacity(cand.teamId, p);
        rows.push({ period: p, hours: OOSEngine.epicHoursInPeriod(cand, p), before: b.loadPct, after: a.loadPct, capacity: a.capacity, loaded: a.loaded });
      }
      p = OOSEngine.nextPeriod(p);
    }
    return { team: S.engine().get('teams', cand.teamId), rows: rows, decided: OOSEngine.epicCounts(v.status) };
  };

  function pctCell(v) {
    var cls = v > 100.5 ? ' class="crit"' : v >= 90 ? ' class="warn"' : '';
    return '<span' + cls + '>' + U.fmtPct(v) + '</span>';
  }

  C.impactHtml = function (imp) {
    if (!imp || !imp.team) return '';
    if (!imp.rows.length) return '<div class="note">Epiken ligger utanför de närmaste perioderna och påverkar inte beläggningen nu.</div>';
    var worst = imp.rows.reduce(function (m, r) { return r.after > m.after ? r : m; }, imp.rows[0]);
    var over = worst.after > 100.5;
    var h = '<div class="impact' + (over ? ' crit' : '') + '"><div class="impact-head"><strong>' + (imp.decided ? 'Konsekvens för ' : 'Om förslaget beslutas: ') + esc(imp.team.name) + '</strong>';
    h += over
      ? '<span>Överplanerat i ' + esc(worst.period.inText) + ': ' + U.fmtH(worst.loaded - worst.capacity) + ' mer än kapaciteten. Något annat arbete behöver flyttas, minskas eller få mer kapacitet.</span>'
      : '<span>Teamet har plats för arbetet. Högst ' + U.fmtPct(worst.after) + ' beläggning, i ' + esc(worst.period.inText) + '.</span>';
    h += '</div><table class="impact-tbl"><thead><tr><th>Period</th><th class="num">Epiken</th><th class="num">Före</th><th class="num">Efter</th></tr></thead><tbody>';
    imp.rows.forEach(function (r) {
      h += '<tr><td>' + esc(r.period.label) + '</td><td class="num">' + U.fmtH(r.hours) + '</td><td class="num">' + pctCell(r.before) + '</td><td class="num"><strong>' + pctCell(r.after) + '</strong></td></tr>';
    });
    return h + '</tbody></table></div>';
  };

  /*
   * Kapacitetsstapel: längden är kapaciteten i förhållande till max, mörk del belastat, ljus del
   * ledigt och randig röd del det som är planerat utöver kapaciteten. Hela stapeln växer som en enhet.
   */
  C.capBar = function (x, max, decorative) {
    var total = Math.max(x.capacity, x.loaded, 0);
    if (!total) return '<span class="muted">–</span>';
    var inside = Math.min(Math.max(0, x.loaded), x.capacity);
    var over = Math.max(0, x.loaded - x.capacity);
    var free = Math.max(0, x.capacity - x.loaded);
    function pct(v) { return (v / total) * 100; }
    var label = decorative ? ' aria-hidden="true"' : ' role="img" aria-label="' + esc(U.fmtH(x.loaded) + ' belastat av ' + U.fmtH(x.capacity) + (over > 0.5 ? ', ' + U.fmtH(over) + ' över kapaciteten' : '')) + '"';
    return '<div class="cbar" style="width:' + (total / max) * 100 + '%"' + label + '>' +
      (inside > 0 ? '<span class="cbar-load" style="width:' + pct(inside) + '%"></span>' : '') +
      (free > 0.5 ? '<span class="cbar-free" style="width:' + pct(free) + '%"></span>' : '') +
      (over > 0.5 ? '<span class="cbar-over" style="width:' + pct(over) + '%"></span>' : '') + '</div>';
  };

  C.relLabel = function (r) {
    return r === 'primary' ? 'Primär' : '<span class="quiet">Stödjande</span>';
  };

  C.categoryLabel = function (c) {
    return c === 'supporting' ? 'Stödjande' : 'Producerande';
  };

  C.objectiveLabel = function (o) {
    return o === 'owner' ? 'Ansvarar' : '<span class="quiet">Bidrar</span>';
  };

  C.byName = function (a, b) {
    return U.byName(a, b);
  };

  /* Kopierar text till urklipp. Om urklipp är blockerat visas texten så att den kan markeras. */
  C.copyText = function (text, what) {
    function fallback() {
      UI.openForm({
        title: 'Kopiera ' + what,
        intro: 'Urklipp är blockerat här. Markera texten och kopiera den med Ctrl+C eller ⌘C.',
        values: { text: text },
        fields: [{ key: 'text', label: what.charAt(0).toUpperCase() + what.slice(1), type: 'textarea', full: true }],
        submitLabel: 'Klar',
        onSubmit: function () {}
      });
      var ta = document.getElementById('f-text');
      if (ta) ta.select();
    }
    try {
      navigator.clipboard.writeText(text).then(function () { UI.toast(what.charAt(0).toUpperCase() + what.slice(1) + ' kopierades.'); }, fallback);
    } catch (e) {
      fallback();
    }
  };

  /* ---------- Urvalslistor ---------- */

  C.opts = {
    workers: function (exclude) {
      var ex = new Set(exclude || []);
      return S.db.workers.filter(function (w) { return !ex.has(w.id); }).sort(U.byName).map(function (w) {
        return { value: w.id, label: w.name, sub: w.title || '' };
      });
    },
    teams: function (exclude) {
      var ex = new Set(exclude || []);
      return S.db.teams.filter(function (t) { return !ex.has(t.id); }).sort(U.byName).map(function (t) { return { value: t.id, label: t.name }; });
    },
    domains: function (type, exclude) {
      var ex = new Set(exclude || []);
      return S.db.domains
        .filter(function (d) { return (!type || d.type === type) && !ex.has(d.id); })
        .sort(function (a, b) { return a.type === b.type ? U.byName(a, b) : a.type === 'business' ? -1 : 1; })
        .map(function (d) { return { value: d.id, label: d.name, group: type ? '' : d.type === 'it' ? 'IT-domäner' : 'Verksamhetsdomäner' }; });
    },
    deliveryDomains: function (exclude) {
      var ex = new Set(exclude || []);
      return S.db.deliveryDomains.filter(function (d) { return !ex.has(d.id); }).sort(U.byName).map(function (d) { return { value: d.id, label: d.name }; });
    },
    competences: function (exclude) {
      var ex = new Set(exclude || []);
      return S.db.competences.filter(function (c) { return !ex.has(c.id); })
        .sort(function (a, b) { return a.category.localeCompare(b.category, 'sv') || U.byName(a, b); })
        .map(function (c) { return { value: c.id, label: c.name, group: c.category }; });
    },
    initiatives: function () {
      var e = S.engine();
      return S.db.initiatives.slice().sort(U.byName).map(function (x) {
        var dd = e.get('deliveryDomains', x.deliveryDomainId);
        return { value: x.id, label: x.name, sub: dd ? dd.name : '' };
      });
    },
    epicTypes: OOSEngine.EPIC_TYPES,
    epicStatus: OOSEngine.EPIC_STATUS,
    effort: [{ value: 'monthly', label: 'Per månad (löpande)' }, { value: 'total', label: 'Totalt (avgränsat)' }],
    systems: function (exclude) {
      var ex = new Set(exclude || []);
      return S.db.systems.filter(function (s) { return !ex.has(s.id); }).sort(U.byName).map(function (s) { return { value: s.id, label: s.name }; });
    },
    relationship: [{ value: 'primary', label: 'Primär' }, { value: 'supportive', label: 'Stödjande' }],
    levels: [1, 2, 3, 4].map(function (n) { return { value: n, label: n + ' – ' + UI.LEVELS[n] }; }),
    status: [{ value: 'active', label: 'Aktiv' }, { value: 'inactive', label: 'Inaktiv' }]
  };

  C.categories = function () {
    return Array.from(new Set(S.db.competences.map(function (c) { return c.category; }))).sort();
  };

  /* ---------- Hjälpare för primära kopplingar ---------- */

  C.setTeamPrimary = function (teamId, type, domainId) {
    var e = S.engine();
    var current = e.teamDomains(teamId).filter(function (x) { return x.domain.type === type && x.relationship === 'primary'; })[0];
    if (current && current.domain.id === domainId) return;
    if (current) S.remove('teamDomains', current.link.id);
    if (!domainId) return;
    var existing = S.db.teamDomains.filter(function (x) { return x.teamId === teamId && x.domainId === domainId; })[0];
    if (existing) S.update('teamDomains', existing.id, { relationship: 'primary' });
    else S.insert('teamDomains', { teamId: teamId, domainId: domainId, relationship: 'primary' });
  };

  C.setDomainPrimaryDd = function (domainId, ddId) {
    var current = S.db.domainClusters.filter(function (c) { return c.domainId === domainId && c.relationship === 'primary'; })[0];
    if (current && current.deliveryDomainId === ddId) return;
    if (current) S.remove('domainClusters', current.id);
    if (!ddId) return;
    var existing = S.db.domainClusters.filter(function (c) { return c.domainId === domainId && c.deliveryDomainId === ddId; })[0];
    if (existing) S.update('domainClusters', existing.id, { relationship: 'primary' });
    else S.insert('domainClusters', { deliveryDomainId: ddId, domainId: domainId, relationship: 'primary' });
  };

  C.setSystemOwner = function (systemId, teamId) {
    S.db.teamSystems
      .filter(function (x) { return x.systemId === systemId && x.objective === 'owner' && x.teamId !== teamId; })
      .forEach(function (x) { S.update('teamSystems', x.id, { objective: 'contributor' }); });
    if (!teamId) return;
    var existing = S.db.teamSystems.filter(function (x) { return x.systemId === systemId && x.teamId === teamId; })[0];
    if (existing) S.update('teamSystems', existing.id, { objective: 'owner' });
    else S.insert('teamSystems', { teamId: teamId, systemId: systemId, objective: 'owner' });
  };

  C.setSystemPrimaryIt = function (systemId, domainId) {
    var current = S.db.itDomainSystems.filter(function (x) { return x.systemId === systemId && x.relationship === 'primary'; })[0];
    if (current && current.domainId === domainId) return;
    if (current) S.remove('itDomainSystems', current.id);
    if (!domainId) return;
    var existing = S.db.itDomainSystems.filter(function (x) { return x.systemId === systemId && x.domainId === domainId; })[0];
    if (existing) S.update('itDomainSystems', existing.id, { relationship: 'primary' });
    else S.insert('itDomainSystems', { domainId: domainId, systemId: systemId, relationship: 'primary' });
  };

  /* ---------- Formulär ---------- */

  var F = (C.forms = {});

  F.worker = function (w) {
    var isNew = !w;
    UI.openForm({
      title: isNew ? 'Lägg till arbetare' : 'Redigera ' + w.name,
      intro: 'En arbetare är en person eller en AI-resurs som bidrar med kompetens och kapacitet.',
      values: w || { type: 'person', baseHoursPerWeek: S.db.settings.standardWeekHours, status: 'active', costPerHour: 850 },
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'title', label: 'Roll/titel' },
        { key: 'type', label: 'Typ', type: 'select', options: [{ value: 'person', label: 'Människa' }, { value: 'ai', label: 'AI' }] },
        { key: 'baseHoursPerWeek', label: 'Grundkapacitet (h/vecka)', type: 'number', min: 0, max: 80, required: true },
        { key: 'costPerHour', label: 'Kostnad per timme (kr)', type: 'number', min: 0 },
        { key: 'consultant', label: 'Konsult', type: 'checkbox' },
        { key: 'status', label: 'Status', type: 'select', options: C.opts.status },
        { key: 'description', label: 'Beskrivning', type: 'textarea' }
      ],
      onSubmit: function (v) {
        if (isNew) {
          var rec = S.insert('workers', v);
          UI.toast(v.name + ' lades till.');
          OOS.go('workers:' + rec.id);
        } else {
          S.update('workers', w.id, v);
          UI.toast('Ändringarna sparades.');
          OOS.refresh();
        }
      }
    });
  };

  F.team = function (t) {
    var isNew = !t;
    var e = S.engine();
    var bd = t ? e.teamPrimaryDomain(t.id, 'business') : null;
    var it = t ? e.teamPrimaryDomain(t.id, 'it') : null;
    var values = t ? Object.assign({}, t, { bd: bd ? bd.id : '', it: it ? it.id : '' }) : { category: 'producing', status: 'active' };
    var memberOpts = t
      ? e.teamMembers(t.id).map(function (m) { return { value: m.worker.id, label: m.worker.name + ' – ' + m.tw.role }; })
      : [];
    UI.openForm({
      title: isNew ? 'Lägg till team' : 'Redigera ' + t.name,
      intro: 'Teamets leveransdomän räknas fram från den primära verksamhetsdomänen.',
      values: values,
      fields: [
        { key: 'name', label: 'Teamnamn', required: true, full: true },
        { key: 'category', label: 'Kategori', type: 'select', options: [{ value: 'producing', label: 'Producerande' }, { value: 'supporting', label: 'Stödjande' }], help: 'Producerande team arbetar mot en primär verksamhetsdomän. Stödjande team arbetar mot flera.' },
        { key: 'status', label: 'Status', type: 'select', options: C.opts.status },
        { key: 'bd', label: 'Primär verksamhetsdomän', type: 'select', placeholder: 'Välj …', options: C.opts.domains('business') },
        { key: 'it', label: 'Primär IT-domän', type: 'select', placeholder: 'Välj …', options: C.opts.domains('it') },
        isNew ? null : { key: 'leadId', label: 'Teamledare', type: 'select', placeholder: 'Ingen utsedd', options: memberOpts, full: true },
        { key: 'description', label: 'Beskrivning', type: 'textarea' },
        { key: 'purpose', label: 'Syfte', type: 'textarea' }
      ].filter(Boolean),
      onSubmit: function (v) {
        var core = { name: v.name, category: v.category, status: v.status, description: v.description, purpose: v.purpose };
        var id;
        if (isNew) {
          id = S.insert('teams', Object.assign(core, { leadId: null })).id;
        } else {
          id = t.id;
          core.leadId = v.leadId || null;
          S.update('teams', id, core);
        }
        C.setTeamPrimary(id, 'business', v.bd || null);
        C.setTeamPrimary(id, 'it', v.it || null);
        UI.toast(isNew ? v.name + ' skapades.' : 'Ändringarna sparades.');
        if (isNew) OOS.go('teams:' + id);
        else OOS.refresh();
      }
    });
  };

  F.domain = function (type, d) {
    var isNew = !d;
    var e = S.engine();
    var dd = d ? e.deliveryDomainOfDomain(d.id) : null;
    var noun = type === 'it' ? 'IT-domän' : 'verksamhetsdomän';
    UI.openForm({
      title: isNew ? 'Lägg till ' + noun : 'Redigera ' + d.name,
      values: d ? Object.assign({}, d, { dd: dd ? dd.id : '' }) : { status: 'active' },
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'dd', label: 'Tillhör leveransdomän', type: 'select', placeholder: 'Välj …', options: C.opts.deliveryDomains() },
        { key: 'ownerId', label: type === 'it' ? 'Domänansvarig' : 'Verksamhetsdomänansvarig', type: 'select', placeholder: 'Ingen utsedd', options: C.opts.workers() },
        { key: 'status', label: 'Status', type: 'select', options: C.opts.status },
        { key: 'description', label: 'Beskrivning', type: 'textarea' },
        { key: 'purpose', label: 'Syfte', type: 'textarea' }
      ],
      onSubmit: function (v) {
        var core = { name: v.name, ownerId: v.ownerId || null, status: v.status, description: v.description, purpose: v.purpose };
        var id;
        if (isNew) {
          id = S.insert('domains', Object.assign(core, { type: type, updated: U.todayISO() })).id;
        } else {
          id = d.id;
          S.update('domains', id, core);
        }
        C.setDomainPrimaryDd(id, v.dd || null);
        UI.toast(isNew ? v.name + ' skapades.' : 'Ändringarna sparades.');
        OOS.go((type === 'it' ? 'itDomains:' : 'businessDomains:') + id);
      }
    });
  };

  F.deliveryDomain = function (d) {
    var isNew = !d;
    UI.openForm({
      title: isNew ? 'Lägg till leveransdomän' : 'Redigera ' + d.name,
      intro: 'Leveransdomäner är den högsta nivån. De delar upp verksamheten och agerar beställare av utveckling.',
      values: d || { primaryObjective: 'business', status: 'active' },
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'primaryObjective', label: 'Primärt uppdrag', type: 'select', options: [{ value: 'business', label: 'Verksamhetsleverans' }, { value: 'it', label: 'IT-leverans' }] },
        { key: 'ownerId', label: 'Leveransdomänägare', type: 'select', placeholder: 'Ingen utsedd', options: C.opts.workers() },
        { key: 'status', label: 'Status', type: 'select', options: C.opts.status },
        { key: 'description', label: 'Beskrivning', type: 'textarea' },
        { key: 'purpose', label: 'Syfte', type: 'textarea' }
      ],
      onSubmit: function (v) {
        v.ownerId = v.ownerId || null;
        if (isNew) {
          var rec = S.insert('deliveryDomains', Object.assign(v, { updated: U.todayISO() }));
          UI.toast(v.name + ' skapades.');
          OOS.go('deliveryDomains:' + rec.id);
        } else {
          S.update('deliveryDomains', d.id, v);
          UI.toast('Ändringarna sparades.');
          OOS.refresh();
        }
      }
    });
  };

  F.competence = function (c) {
    var isNew = !c;
    UI.openForm({
      title: isNew ? 'Lägg till kompetens' : 'Redigera ' + c.name,
      values: c || { type: 'it' },
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'category', label: 'Kategori', required: true, datalist: C.categories(), help: 'Välj en befintlig eller skriv en ny.' },
        { key: 'type', label: 'Typ', type: 'select', options: [{ value: 'it', label: 'IT' }, { value: 'business', label: 'Verksamhet' }] },
        { key: 'description', label: 'Kort beskrivning', full: true },
        { key: 'details', label: 'Detaljerad beskrivning', type: 'textarea' }
      ],
      onSubmit: function (v) {
        if (isNew) {
          var rec = S.insert('competences', v);
          UI.toast(v.name + ' lades till.');
          OOS.go('competences:' + rec.id);
        } else {
          S.update('competences', c.id, v);
          UI.toast('Ändringarna sparades.');
          OOS.refresh();
        }
      }
    });
  };

  F.system = function (s) {
    var isNew = !s;
    var e = S.engine();
    var it = s ? e.systemPrimaryItDomain(s.id) : null;
    var owner = s ? e.systemResponsibleTeam(s.id) : null;
    var kinds = Array.from(new Set(S.db.systems.map(function (x) { return x.kind; }))).sort();
    UI.openForm({
      title: isNew ? 'Lägg till system' : 'Redigera ' + s.name,
      values: s ? Object.assign({}, s, { it: it ? it.id : '', owner: owner ? owner.id : '' }) : { category: 'system', status: 'production' },
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'kind', label: 'Typ', datalist: kinds, help: 'Till exempel verksamhetssystem eller webbapplikation.' },
        { key: 'category', label: 'Kategori', type: 'select', options: [{ value: 'system', label: 'System' }, { value: 'service', label: 'Tjänst' }, { value: 'interface', label: 'Gränssnitt' }, { value: 'function', label: 'Funktion' }] },
        { key: 'it', label: 'Primär IT-domän', type: 'select', placeholder: 'Välj …', options: C.opts.domains('it') },
        { key: 'owner', label: 'Ansvarigt team', type: 'select', placeholder: 'Inget', options: C.opts.teams() },
        { key: 'status', label: 'Status', type: 'select', options: [{ value: 'production', label: 'I drift' }, { value: 'development', label: 'Under utveckling' }, { value: 'inactive', label: 'Avvecklad' }] },
        { key: 'description', label: 'Kort beskrivning', type: 'textarea' }
      ],
      onSubmit: function (v) {
        var core = { name: v.name, kind: v.kind, category: v.category, status: v.status, description: v.description };
        var id = isNew ? S.insert('systems', core).id : (S.update('systems', s.id, core), s.id);
        C.setSystemPrimaryIt(id, v.it || null);
        C.setSystemOwner(id, v.owner || null);
        UI.toast(isNew ? v.name + ' lades till.' : 'Ändringarna sparades.');
        OOS.go('systems:' + id);
      }
    });
  };

  F.teamMember = function (teamId, tw) {
    var e = S.engine();
    var isNew = !tw;
    var existing = e.teamMembers(teamId).map(function (m) { return m.worker.id; });
    var roles = Array.from(new Set(S.db.teamWorkers.map(function (x) { return x.role; }))).sort();
    var w = tw ? e.get('workers', tw.workerId) : null;
    UI.openForm({
      title: isNew ? 'Lägg till medlem i ' + e.get('teams', teamId).name : 'Ändra ' + w.name + ' i teamet',
      values: tw || { allocation: 100, plannedLoad: 0 },
      fields: [
        isNew ? { key: 'workerId', label: 'Arbetare', type: 'select', required: true, placeholder: 'Välj arbetare …', options: C.opts.workers(existing), full: true } : null,
        { key: 'role', label: 'Roll i teamet', required: true, datalist: roles },
        { key: 'allocation', label: 'Allokering (%)', type: 'number', min: 0, max: 100, required: true, help: 'Andel av arbetarens tillgängliga kapacitet.' },
        { key: 'plannedLoad', label: 'Planerad belastning (%)', type: 'number', min: 0, max: 100, full: true, help: 'Anges manuellt i Prototyp 1. Ska ersättas av arbetsblock från utvecklingsprocessen.' }
      ].filter(Boolean),
      onSubmit: function (v) {
        if (isNew) {
          S.insert('teamWorkers', { teamId: teamId, workerId: v.workerId, role: v.role, allocation: v.allocation, plannedLoad: v.plannedLoad || 0 });
          var ww = S.engine().get('workers', v.workerId);
          var pct = S.engine().workerCapacity(v.workerId, OOS.period()).allocationPct;
          UI.toast(ww.name + ' lades till.' + (pct > 100.5 ? ' Obs: nu allokerad till ' + Math.round(pct) + ' %.' : ''));
        } else {
          S.update('teamWorkers', tw.id, { role: v.role, allocation: v.allocation, plannedLoad: v.plannedLoad || 0 });
          UI.toast('Ändringarna sparades.');
        }
        OOS.refresh();
      },
      onDelete: isNew ? null : function () { C.removeLink('teamWorkers', tw.id, w.name + ' tas bort från teamet. Arbetaren finns kvar.'); }
    });
  };

  F.workerTeam = function (workerId) {
    var e = S.engine();
    var existing = e.workerTeams(workerId).map(function (x) { return x.team.id; });
    var roles = Array.from(new Set(S.db.teamWorkers.map(function (x) { return x.role; }))).sort();
    var w = e.get('workers', workerId);
    var free = Math.max(0, 100 - Math.round(e.workerCapacity(workerId, OOS.period()).allocationPct));
    UI.openForm({
      title: 'Lägg ' + w.name + ' i team',
      values: { role: w.title, allocation: free || 50, plannedLoad: 0 },
      fields: [
        { key: 'teamId', label: 'Team', type: 'select', required: true, placeholder: 'Välj team …', options: C.opts.teams(existing), full: true },
        { key: 'role', label: 'Roll i teamet', required: true, datalist: roles },
        { key: 'allocation', label: 'Allokering (%)', type: 'number', min: 0, max: 100, required: true, help: 'Ledigt just nu: ' + free + ' %.' },
        { key: 'plannedLoad', label: 'Planerad belastning (%)', type: 'number', min: 0, max: 100, full: true }
      ],
      onSubmit: function (v) {
        S.insert('teamWorkers', { teamId: v.teamId, workerId: workerId, role: v.role, allocation: v.allocation, plannedLoad: v.plannedLoad || 0 });
        UI.toast(w.name + ' lades till i teamet.');
        OOS.refresh();
      }
    });
  };

  F.teamDomain = function (teamId) {
    var e = S.engine();
    var existing = e.teamDomains(teamId).map(function (x) { return x.domain.id; });
    UI.openForm({
      title: 'Koppla domän till ' + e.get('teams', teamId).name,
      intro: 'Stödjande kopplingar visar var teamet också bidrar. Kapaciteten räknas bara på den primära domänen.',
      values: { relationship: 'supportive' },
      fields: [
        { key: 'domainId', label: 'Domän', type: 'select', required: true, placeholder: 'Välj domän …', options: C.opts.domains(null, existing), full: true },
        { key: 'relationship', label: 'Relation', type: 'select', options: C.opts.relationship, full: true }
      ],
      onSubmit: function (v) {
        if (v.relationship === 'primary') {
          var d = S.engine().get('domains', v.domainId);
          C.setTeamPrimary(teamId, d.type, v.domainId);
        } else {
          S.insert('teamDomains', { teamId: teamId, domainId: v.domainId, relationship: 'supportive' });
        }
        UI.toast('Domänen kopplades.');
        OOS.refresh();
      }
    });
  };

  F.domainTeam = function (domainId) {
    var e = S.engine();
    var existing = e.teamsOfDomain(domainId).map(function (x) { return x.team.id; });
    var d = e.get('domains', domainId);
    UI.openForm({
      title: 'Koppla team till ' + d.name,
      values: { relationship: 'supportive' },
      fields: [
        { key: 'teamId', label: 'Team', type: 'select', required: true, placeholder: 'Välj team …', options: C.opts.teams(existing), full: true },
        { key: 'relationship', label: 'Relation', type: 'select', options: C.opts.relationship, full: true, help: 'Primär ersätter teamets nuvarande primära ' + (d.type === 'it' ? 'IT-domän' : 'verksamhetsdomän') + '.' }
      ],
      onSubmit: function (v) {
        if (v.relationship === 'primary') C.setTeamPrimary(v.teamId, d.type, domainId);
        else S.insert('teamDomains', { teamId: v.teamId, domainId: domainId, relationship: 'supportive' });
        UI.toast('Teamet kopplades.');
        OOS.refresh();
      }
    });
  };

  F.teamSystem = function (teamId) {
    var e = S.engine();
    var existing = e.teamSystems(teamId).map(function (x) { return x.system.id; });
    UI.openForm({
      title: 'Koppla system till ' + e.get('teams', teamId).name,
      values: { objective: 'contributor' },
      fields: [
        { key: 'systemId', label: 'System', type: 'select', required: true, placeholder: 'Välj system …', options: C.opts.systems(existing), full: true },
        { key: 'objective', label: 'Teamets uppdrag', type: 'select', options: [{ value: 'owner', label: 'Ansvarar (förvaltning och utveckling)' }, { value: 'contributor', label: 'Bidrar' }], full: true, help: 'Ett system har ett ansvarigt team. Väljer du Ansvarar flyttas ansvaret hit.' }
      ],
      onSubmit: function (v) {
        if (v.objective === 'owner') C.setSystemOwner(v.systemId, teamId);
        else S.insert('teamSystems', { teamId: teamId, systemId: v.systemId, objective: 'contributor' });
        UI.toast('Systemet kopplades.');
        OOS.refresh();
      }
    });
  };

  F.systemTeam = function (systemId) {
    var e = S.engine();
    var existing = e.systemTeams(systemId).map(function (x) { return x.team.id; });
    UI.openForm({
      title: 'Koppla team till ' + e.get('systems', systemId).name,
      values: { objective: 'contributor' },
      fields: [
        { key: 'teamId', label: 'Team', type: 'select', required: true, placeholder: 'Välj team …', options: C.opts.teams(existing), full: true },
        { key: 'objective', label: 'Teamets uppdrag', type: 'select', options: [{ value: 'owner', label: 'Ansvarar (förvaltning och utveckling)' }, { value: 'contributor', label: 'Bidrar' }], full: true }
      ],
      onSubmit: function (v) {
        if (v.objective === 'owner') C.setSystemOwner(systemId, v.teamId);
        else S.insert('teamSystems', { teamId: v.teamId, systemId: systemId, objective: 'contributor' });
        UI.toast('Teamet kopplades.');
        OOS.refresh();
      }
    });
  };

  F.itDomainSystem = function (opts) {
    var e = S.engine();
    var fromSystem = !!opts.systemId;
    var existing = fromSystem
      ? e.systemItDomains(opts.systemId).map(function (x) { return x.domain.id; })
      : e.itDomainSystems(opts.domainId).map(function (x) { return x.system.id; });
    UI.openForm({
      title: fromSystem ? 'Koppla IT-domän' : 'Koppla system till ' + e.get('domains', opts.domainId).name,
      values: { relationship: 'supportive' },
      fields: [
        fromSystem
          ? { key: 'domainId', label: 'IT-domän', type: 'select', required: true, placeholder: 'Välj …', options: C.opts.domains('it', existing), full: true }
          : { key: 'systemId', label: 'System', type: 'select', required: true, placeholder: 'Välj …', options: C.opts.systems(existing), full: true },
        { key: 'relationship', label: 'Relation', type: 'select', options: C.opts.relationship, full: true }
      ],
      onSubmit: function (v) {
        var sid = fromSystem ? opts.systemId : v.systemId;
        var did = fromSystem ? v.domainId : opts.domainId;
        if (v.relationship === 'primary') C.setSystemPrimaryIt(sid, did);
        else S.insert('itDomainSystems', { domainId: did, systemId: sid, relationship: 'supportive' });
        UI.toast('Kopplingen sparades.');
        OOS.refresh();
      }
    });
  };

  F.workerCompetence = function (workerId, wc) {
    var e = S.engine();
    var isNew = !wc;
    var existing = e.workerCompetences(workerId).map(function (x) { return x.competence.id; });
    var comp = wc ? e.get('competences', wc.competenceId) : null;
    UI.openForm({
      title: isNew ? 'Lägg till kompetens' : 'Ändra ' + comp.name,
      values: wc || { level: 2, weight: 'secondary' },
      fields: [
        isNew ? { key: 'competenceId', label: 'Kompetens', type: 'select', required: true, placeholder: 'Välj kompetens …', options: C.opts.competences(existing), full: true } : null,
        { key: 'level', label: 'Nivå', type: 'select', options: C.opts.levels },
        { key: 'weight', label: 'Vikt', type: 'select', options: [{ value: 'primary', label: 'Primär' }, { value: 'secondary', label: 'Sekundär' }], help: 'Kapaciteten räknas på primära kompetenser.' }
      ].filter(Boolean),
      onSubmit: function (v) {
        v.level = Number(v.level);
        if (isNew) S.insert('workerCompetences', { workerId: workerId, competenceId: v.competenceId, level: v.level, weight: v.weight });
        else S.update('workerCompetences', wc.id, { level: v.level, weight: v.weight });
        UI.toast('Kompetensen sparades.');
        OOS.refresh();
      },
      onDelete: isNew ? null : function () { C.removeLink('workerCompetences', wc.id, comp.name + ' tas bort från arbetaren.'); }
    });
  };

  /* kind: 'domain' (ExtendedDomain_Competence) eller 'delivery' (ExtendedDeliveryCompetence) */
  F.expert = function (kind, targetId, ext, workerId) {
    var e = S.engine();
    var coll = kind === 'delivery' ? 'extendedDeliveryCompetences' : 'extendedDomainCompetences';
    var key = kind === 'delivery' ? 'deliveryDomainId' : 'domainId';
    var isNew = !ext;
    var target = targetId ? e.get(kind === 'delivery' ? 'deliveryDomains' : 'domains', targetId) : null;
    var roles = Array.from(new Set(S.db.extendedDomainCompetences.concat(S.db.extendedDeliveryCompetences).map(function (x) { return x.role; }))).sort();
    var fields = [];
    if (!targetId) {
      fields.push(kind === 'delivery'
        ? { key: 'target', label: 'Leveransdomän', type: 'select', required: true, placeholder: 'Välj …', options: C.opts.deliveryDomains(), full: true }
        : { key: 'target', label: 'Domän', type: 'select', required: true, placeholder: 'Välj …', options: C.opts.domains(null), full: true });
    }
    if (!workerId && isNew) fields.push({ key: 'workerId', label: 'Arbetare', type: 'select', required: true, placeholder: 'Välj arbetare …', options: C.opts.workers(), full: true });
    fields.push(
      { key: 'role', label: 'Roll', required: true, datalist: roles },
      { key: 'hoursPerMonth', label: 'Allokerad kapacitet (h/mån)', type: 'number', min: 0, max: 200, required: true },
      { key: 'from', label: 'Gäller från', type: 'date', required: true },
      { key: 'to', label: 'Gäller till', type: 'date', required: true }
    );
    var period = OOS.period();
    UI.openForm({
      title: isNew ? (kind === 'delivery' ? 'Lägg till nyckelroll' : 'Lägg till i domänmolnet') + (target ? ' – ' + target.name : '') : 'Ändra roll',
      intro: kind === 'delivery'
        ? 'Nyckelroller arbetar för hela leveransdomänen, till exempel projektledare och arkitekter.'
        : 'Domänmolnet är verksamhets- eller IT-kompetens som bistår teamen utan att vara teammedlem.',
      values: ext || { from: period.start, to: U.addDays(U.addDays(period.start, 365), -1), hoursPerMonth: 40 },
      fields: fields,
      validate: function (v) {
        if (v.from && v.to && v.from > v.to) return { to: 'Slutdatum måste vara efter startdatum.' };
      },
      onSubmit: function (v) {
        var rec = { role: v.role, hoursPerMonth: v.hoursPerMonth, from: v.from, to: v.to };
        if (isNew) {
          rec[key] = targetId || v.target;
          rec.workerId = workerId || v.workerId;
          S.insert(coll, rec);
        } else {
          S.update(coll, ext.id, rec);
        }
        UI.toast('Rollen sparades.');
        OOS.refresh();
      },
      onDelete: isNew ? null : function () { C.removeLink(coll, ext.id, 'Rollen tas bort. Arbetaren finns kvar.'); }
    });
  };

  F.clusterFromDd = function (ddId) {
    var e = S.engine();
    var existing = e.domainsOfDeliveryDomain(ddId).map(function (x) { return x.domain.id; });
    UI.openForm({
      title: 'Koppla domän till ' + e.get('deliveryDomains', ddId).name,
      values: { relationship: 'primary' },
      fields: [
        { key: 'domainId', label: 'Domän', type: 'select', required: true, placeholder: 'Välj domän …', options: C.opts.domains(null, existing), full: true },
        { key: 'relationship', label: 'Relation', type: 'select', options: C.opts.relationship, full: true, help: 'En domän har en primär leveransdomän. Väljer du Primär flyttas domänen hit.' }
      ],
      onSubmit: function (v) {
        if (v.relationship === 'primary') C.setDomainPrimaryDd(v.domainId, ddId);
        else S.insert('domainClusters', { deliveryDomainId: ddId, domainId: v.domainId, relationship: 'supportive' });
        UI.toast('Domänen kopplades.');
        OOS.refresh();
      }
    });
  };

  F.clusterFromDomain = function (domainId) {
    var e = S.engine();
    var existing = e.clustersOfDomain(domainId).map(function (x) { return x.deliveryDomain.id; });
    UI.openForm({
      title: 'Koppla leveransdomän',
      values: { relationship: 'supportive' },
      fields: [
        { key: 'ddId', label: 'Leveransdomän', type: 'select', required: true, placeholder: 'Välj …', options: C.opts.deliveryDomains(existing), full: true },
        { key: 'relationship', label: 'Relation', type: 'select', options: C.opts.relationship, full: true }
      ],
      onSubmit: function (v) {
        if (v.relationship === 'primary') C.setDomainPrimaryDd(domainId, v.ddId);
        else S.insert('domainClusters', { deliveryDomainId: v.ddId, domainId: domainId, relationship: 'supportive' });
        UI.toast('Kopplingen sparades.');
        OOS.refresh();
      }
    });
  };

  F.teamReduction = function (r, teamId) {
    var isNew = !r;
    var p = OOS.period();
    UI.openForm({
      title: isNew ? 'Lägg till avdrag' : 'Ändra avdrag',
      intro: 'Ett särskilt avdrag minskar teamets kapacitet under en period, till exempel utbildning eller planerad frånvaro.',
      values: r || { teamId: teamId || '', percent: 10, from: p.start, to: p.end },
      fields: [
        { key: 'teamId', label: 'Team', type: 'select', required: true, placeholder: 'Välj team …', options: C.opts.teams(), full: true },
        { key: 'type', label: 'Avdragstyp', required: true, datalist: ['Utbildning', 'Frånvaro', 'Föräldraledighet', 'Systembyte', 'Planerat underhåll', 'Verktygsinförande'] },
        { key: 'percent', label: 'Värde (%)', type: 'number', min: 0, max: 100, required: true },
        { key: 'from', label: 'Gäller från', type: 'date', required: true },
        { key: 'to', label: 'Gäller till', type: 'date', required: true },
        { key: 'comment', label: 'Orsak/kommentar', full: true }
      ],
      validate: function (v) {
        if (v.from && v.to && v.from > v.to) return { to: 'Slutdatum måste vara efter startdatum.' };
      },
      onSubmit: function (v) {
        if (isNew) S.insert('teamReductions', v);
        else S.update('teamReductions', r.id, v);
        UI.toast('Avdraget sparades.');
        OOS.refresh();
      },
      onDelete: isNew ? null : function () { C.removeLink('teamReductions', r.id, 'Avdraget tas bort och teamets kapacitet räknas om.'); }
    });
  };

  /* Epik: teamets arbete. Formuläret visar direkt vad epiken gör med teamets beläggning. */
  F.epic = function (r, defaults) {
    var isNew = !r;
    var p = OOS.period();
    UI.openForm({
      title: isNew ? 'Lägg till epik' : 'Ändra ' + r.name,
      intro: 'En epik är ett avgränsat eller löpande arbete som ett team gör. Ramen är den tid som är beslutad för arbetet, inte ett estimat.',
      values: r || Object.assign({ type: 'development', status: 'planned', effort: 'total', hours: 200, from: p.start, to: OOSEngine.nextPeriod(OOSEngine.nextPeriod(p)).end }, defaults || {}),
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'teamId', label: 'Team', type: 'select', required: true, placeholder: 'Välj team …', options: C.opts.teams() },
        { key: 'type', label: 'Arbetstyp', type: 'select', required: true, options: C.opts.epicTypes },
        { key: 'initiativeId', label: 'Initiativ', type: 'select', placeholder: 'Inget initiativ', options: C.opts.initiatives(), help: 'Utvecklingsarbete bör höra till ett beslutat initiativ.' },
        { key: 'status', label: 'Status', type: 'select', required: true, options: C.opts.epicStatus, help: 'Förslag och klara epiker belastar inte teamet.' },
        { key: 'effort', label: 'Ram', type: 'select', required: true, options: C.opts.effort },
        { key: 'hours', label: 'Timmar', type: 'number', min: 1, max: 100000, required: true },
        { key: 'from', label: 'Från', type: 'date', required: true },
        { key: 'to', label: 'Till', type: 'date', required: true },
        { key: 'description', label: 'Beskrivning', type: 'textarea' }
      ],
      preview: function (v) { return C.impactHtml(C.epicImpact(v, r)); },
      validate: function (v) {
        if (v.from && v.to && v.from > v.to) return { to: 'Slutdatum måste vara efter startdatum.' };
      },
      onSubmit: function (v) {
        v.initiativeId = v.initiativeId || null;
        var rec = isNew ? S.insert('epics', v) : S.update('epics', r.id, v);
        UI.toast(isNew ? 'Epiken lades till.' : 'Epiken sparades.');
        if (isNew) OOS.go('epics:' + rec.id);
        else OOS.refresh();
      },
      onDelete: isNew ? null : function () { C.removeEntity('epics', r.id, 'epics'); }
    });
  };

  /* Initiativ: en beslutad satsning som en leveransdomän äger och som bryts ned i teamens epiker. */
  F.initiative = function (r) {
    var isNew = !r;
    var p = OOS.period();
    UI.openForm({
      title: isNew ? 'Lägg till initiativ' : 'Ändra ' + r.name,
      intro: 'Ett initiativ är en satsning som leveransdomänen har beslutat. Arbetet görs i teamens epiker, och initiativets ram är summan av dem.',
      values: r || { status: 'planned', from: p.start, to: OOSEngine.nextPeriod(OOSEngine.nextPeriod(p)).end },
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'deliveryDomainId', label: 'Leveransdomän', type: 'select', required: true, placeholder: 'Välj leveransdomän …', options: C.opts.deliveryDomains() },
        { key: 'ownerId', label: 'Ägare', type: 'select', placeholder: 'Välj ägare …', options: C.opts.workers() },
        { key: 'status', label: 'Status', type: 'select', required: true, options: C.opts.epicStatus },
        { key: 'from', label: 'Från', type: 'date', required: true },
        { key: 'to', label: 'Till', type: 'date', required: true },
        { key: 'goal', label: 'Mål', type: 'textarea', help: 'Vad ska vara annorlunda när initiativet är klart?' }
      ],
      validate: function (v) {
        if (v.from && v.to && v.from > v.to) return { to: 'Slutdatum måste vara efter startdatum.' };
      },
      onSubmit: function (v) {
        v.ownerId = v.ownerId || null;
        var rec = isNew ? S.insert('initiatives', v) : S.update('initiatives', r.id, v);
        UI.toast(isNew ? 'Initiativet lades till.' : 'Initiativet sparades.');
        if (isNew) OOS.go('initiatives:' + rec.id);
        else OOS.refresh();
      },
      onDelete: isNew ? null : function () { C.removeEntity('initiatives', r.id, 'initiatives'); }
    });
  };

  F.overhead = function (r) {
    var isNew = !r;
    UI.openForm({
      title: isNew ? 'Lägg till grundavdrag' : 'Ändra ' + r.name,
      intro: 'Grundavdrag gäller alla arbetare och skalas mot deras grundkapacitet.',
      values: r || { hoursPerWeek: 1, appliesToAI: false },
      fields: [
        { key: 'name', label: 'Avdragstyp', required: true, full: true },
        { key: 'hoursPerWeek', label: 'Värde (h/vecka vid heltid)', type: 'number', min: 0, max: 40, step: 0.5, required: true },
        { key: 'appliesToAI', label: 'Gäller även AI-arbetare', type: 'checkbox' }
      ],
      onSubmit: function (v) {
        if (isNew) S.insert('overheadReductions', v);
        else S.update('overheadReductions', r.id, v);
        UI.toast('Grundavdraget sparades.');
        OOS.refresh();
      },
      onDelete: isNew ? null : function () { C.removeLink('overheadReductions', r.id, r.name + ' tas bort från grundavdragen.'); }
    });
  };

  /* ---------- Borttagning ---------- */

  C.removeLink = function (coll, id, message) {
    UI.confirm({ title: 'Ta bort koppling?', message: esc(message), confirmLabel: 'Ta bort', danger: true }).then(function (ok) {
      if (!ok) return;
      S.remove(coll, id);
      UI.toast('Borttaget.');
      OOS.refresh();
    });
  };

  C.removeEntity = function (coll, id, backTo) {
    var e = S.engine();
    var rec = e.get(coll, id);
    if (!rec) return;
    var msg = '';
    if (coll === 'workers') {
      msg = rec.name + ' tas bort ur ' + e.workerTeams(id).length + ' team, ' + U.plural(e.workerDomainRoles(id).length, 'domänroll', 'domänroller') + ' och ' + U.plural(e.workerCompetences(id).length, 'kompetens', 'kompetenser') + '.';
    } else if (coll === 'teams') {
      msg = rec.name + ' tas bort med ' + e.teamMembers(id).length + ' medlemskap, ' + e.teamSystems(id).length + ' systemkopplingar och ' + U.plural(e.where('epics', 'teamId', id).length, 'epik', 'epiker') + '. Arbetarna finns kvar.';
    } else if (coll === 'initiatives') {
      msg = rec.name + ' tas bort. ' + U.plural(e.initiativeEpics(id).length, 'epik', 'epiker') + ' finns kvar hos teamen men utan initiativ.';
    } else if (coll === 'epics') {
      msg = rec.name + ' tas bort och teamets beläggning räknas om.';
    } else if (coll === 'domains') {
      msg = rec.name + ' tas bort med ' + e.teamsOfDomain(id).length + ' teamkopplingar och ' + e.domainExperts(id).length + ' roller i domänmolnet. Teamen finns kvar.';
    } else if (coll === 'deliveryDomains') {
      msg = rec.name + ' tas bort med ' + e.domainsOfDeliveryDomain(id).length + ' domänkopplingar. Domänerna och teamen finns kvar.';
    } else if (coll === 'competences') {
      msg = rec.name + ' tas bort från ' + e.competenceHolders(id).length + ' arbetare.';
    } else if (coll === 'systems') {
      msg = rec.name + ' tas bort med ' + e.systemTeams(id).length + ' teamkopplingar.';
    }
    UI.confirm({ title: 'Ta bort ' + rec.name + '?', message: esc(msg) + '<br><br>Ändringen loggas men kan inte ångras.', confirmLabel: 'Ta bort', danger: true }).then(function (ok) {
      if (!ok) return;
      S.remove(coll, id);
      UI.toast(rec.name + ' togs bort.');
      OOS.go(backTo);
    });
  };
})();
