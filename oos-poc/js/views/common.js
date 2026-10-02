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

  /*
   * Utfälld rad i en lista (en låda). Samma mall överallt: raden ovanför är rubriken, så lådan
   * upprepar inte namnet synligt (bara för skärmläsare). Överst flikar eller en ingress till
   * vänster och handlingarna till höger, sedan innehållet. Ytan och kanten sätts i app.css.
   */
  C.drawer = function (o) {
    return '<section class="drawer" id="detail" aria-labelledby="detail-title">' +
      '<h2 class="sr-only" id="detail-title">' + esc(o.title) + '</h2>' +
      '<div class="drawer-bar' + (o.tabs ? ' has-tabs' : '') + '"><div class="drawer-lead">' + (o.tabs || o.lead || '') + '</div>' +
      '<div class="drawer-actions">' + (o.actions || '') + '</div></div>' +
      (o.note || '') + '<div class="drawer-body">' + o.body + '</div></section>';
  };

  /* Redigera och Ta bort i lådan. Att ta bort är den lugnare knappen, den frågar ändå först. */
  C.drawerActions = function (edit, remove) {
    return UI.btn('Redigera', edit.action, { cls: 'btn-sm', data: edit.data }) +
      (remove ? UI.btn(remove.label || 'Ta bort', remove.action, { cls: 'btn-sm btn-quiet-danger', data: remove.data }) : '');
  };

  /* En del av lådan med rubrik och en knapp med text, till exempel Koppla team. */
  C.drawerSection = function (title, body, add) {
    return '<section class="drawer-sec"><div class="drawer-sec-head"><h3 class="drawer-sec-title">' + esc(title) + '</h3>' +
      (add ? '<button type="button" class="btn-add" data-action="' + esc(add.action) + '"' +
        Object.keys(add.data || {}).map(function (k) { return ' data-' + k + '="' + esc(add.data[k]) + '"'; }).join('') + '>' +
        UI.icon('plus') + '<span>' + esc(add.label) + '</span></button>' : '') + '</div>' + body + '</section>';
  };

  /*
   * Kopplingar i lådan: namn, en etikett för rollen (mörk för den viktigaste, till exempel
   * Ansvarar eller Primär) och en knapp för att koppla bort som syns när man pekar eller fokuserar.
   */
  C.relList = function (items, empty) {
    if (!items.length) return '<p class="drawer-empty">' + esc(empty) + '</p>';
    return '<ul class="rel-list">' + items.map(function (x) {
      return '<li class="rel-item">' + '<span class="rel-name">' + x.ref + '</span>' +
        (x.tag ? '<span class="rel-tag' + (x.strong ? ' strong' : '') + '">' + esc(x.tag) + '</span>' : '') +
        (x.remove || '') + '</li>';
    }).join('') + '</ul>';
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

  /*
   * Omvänd estimering: vad initiativets investering räcker till när alla dess epiker räknas in,
   * både beslutade och förslag. epic är en epik som ändras i ett formulär och ersätter sin sparade version.
   * null när initiativet saknar investering.
   */
  C.investmentLeft = function (initiativeId, epic) {
    var x = initiativeId ? S.db.initiatives.filter(function (i) { return i.id === initiativeId; })[0] : null;
    if (!x || !(x.investment > 0)) return null;
    var eps = S.db.epics.filter(function (ep) { return ep.initiativeId === x.id && (!epic || ep.id !== epic.id); });
    if (epic && epic.hours && epic.from && epic.to && epic.from <= epic.to) eps = eps.concat([epic]);
    return x.investment - U.sum(eps, OOSEngine.epicFrame);
  };

  /* Konsekvensen i epikformuläret för initiativets investering, under konsekvensen för teamet. */
  C.investmentImpactHtml = function (v, original) {
    var left = C.investmentLeft(v.initiativeId, Object.assign({}, original || {}, v, { id: original ? original.id : '_ny' }));
    if (left === null) return '';
    /* Alla initiativets epiker räknas in, även förslag, så att man ser om allt som är på väg ryms. */
    if (left >= -0.5) return '<div class="note inv-impact">Initiativets investering: ' + U.fmtH(left) + ' kvar med epiken.</div>';
    return '<div class="note warn inv-impact"><strong>Initiativet går ' + U.fmtH(-left) + ' över investeringen</strong> med epiken.</div>';
  };

  /* Hjälptext till initiativets investering, en rad: vad som blir kvar när epikerna och förslagen räknas in. */
  C.investmentFormHelp = function (v, original) {
    var eps = original ? S.db.epics.filter(function (ep) { return ep.initiativeId === original.id; }) : [];
    var decided = U.sum(eps.filter(function (ep) { return OOSEngine.epicCounts(ep.status); }), OOSEngine.epicFrame);
    var used = U.sum(eps, OOSEngine.epicFrame);
    if (!used) return 'Ett beslut, inte ett estimat.';
    if (!(v.investment > 0)) return 'Epikerna är ' + U.fmtH(used) + ' i dag.';
    if (decided > v.investment + 0.5) return 'Beslutade epiker går ' + U.fmtH(decided - v.investment) + ' över.';
    if (used > v.investment + 0.5) return 'Med förslagen går epikerna ' + U.fmtH(used - v.investment) + ' över.';
    return U.fmtH(v.investment - used) + ' kvar efter epikerna.';
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
  C.epicImpact = function (v, original, patch) {
    if (!v.teamId || !v.hours || !v.from || !v.to || v.from > v.to) return null;
    /* patch: en ändring av datan som följer med beslutet, till exempel ett avdrag som tas bort. */
    var db = patch ? patch(S.db) : S.db;
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
        /* Per kompetensområde: ett område kan bli fullt även när teamet som helhet har plats. */
        var bc = {};
        before.teamCategoryLoad(cand.teamId, p).rows.forEach(function (r) { bc[r.category] = r; });
        var cats = after.teamCategoryLoad(cand.teamId, p).rows.map(function (r) {
          var o = bc[r.category];
          return { category: r.category, before: o ? o.loadPct : 0, after: r.loadPct, gap: r.gap, over: r.gap ? r.demand : -r.free, changed: !o || Math.abs((o.demand || 0) - r.demand) > 0.5 };
        });
        var worstCat = cats.filter(function (c) { return c.changed; }).sort(function (x, y) { return y.after - x.after; })[0] || null;
        rows.push({ period: p, hours: OOSEngine.epicHoursInPeriod(cand, p), before: b.loadPct, after: a.loadPct, capacity: a.capacity, loaded: a.loaded, cats: cats, worstCat: worstCat });
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
    /* Den period där ett berört kompetensområde blir mest belagt. */
    var tight = imp.rows.filter(function (r) { return r.worstCat; }).reduce(function (m, r) { return !m || r.worstCat.after > m.worstCat.after ? r : m; }, null);
    var bottleneck = !over && tight && (tight.worstCat.gap || tight.worstCat.after > 100.5) ? tight : null;
    var h = '<div class="impact' + (over || bottleneck ? ' crit' : '') + '"><div class="impact-head"><strong>' + (imp.decided ? 'Konsekvens för ' : 'Om förslaget beslutas: ') + esc(imp.team.name) + '</strong>';
    if (over) {
      h += '<span>Överplanerat i ' + esc(worst.period.inText) + ': ' + U.fmtH(worst.loaded - worst.capacity) + ' mer än kapaciteten. Något annat arbete behöver flyttas, minskas eller få mer kapacitet.</span>';
    } else if (bottleneck) {
      var c = bottleneck.worstCat;
      h += '<span>Teamet har plats totalt, men ' + esc(c.category) + (c.gap ? ' finns inte i teamet' : ' blir en flaskhals: ' + U.fmtPct(c.after)) + ' i ' + esc(bottleneck.period.inText) + '. ' + U.fmtH(c.over) + ' behöver någon annanstans ifrån, eller så flyttas arbete.</span>';
    } else {
      h += '<span>Teamet har plats för arbetet. Högst ' + U.fmtPct(worst.after) + ' beläggning, i ' + esc(worst.period.inText) + '.</span>';
    }
    h += '</div><table class="impact-tbl"><thead><tr><th>Period</th><th class="num">Epiken</th><th class="num">Före</th><th class="num">Efter</th></tr></thead><tbody>';
    imp.rows.forEach(function (r) {
      h += '<tr><td>' + esc(r.period.label) + '</td><td class="num">' + U.fmtH(r.hours) + '</td><td class="num">' + pctCell(r.before) + '</td><td class="num"><strong>' + pctCell(r.after) + '</strong></td></tr>';
    });
    h += '</tbody></table>';
    if (tight) {
      var shown = tight.cats.filter(function (c) { return c.changed; });
      h += '<table class="impact-tbl impact-cats"><caption>Kompetensområden som epiken använder, ' + esc(tight.period.inText) + '</caption><thead><tr><th>Område</th><th class="num">Före</th><th class="num">Efter</th></tr></thead><tbody>';
      shown.forEach(function (c) {
        h += '<tr><td>' + esc(c.category) + '</td><td class="num">' + (c.gap ? '–' : pctCell(c.before)) + '</td><td class="num"><strong>' + (c.gap ? '<span class="crit">Saknas</span>' : pctCell(c.after)) + '</strong></td></tr>';
      });
      h += '</tbody></table>';
    }
    return h + '</div>';
  };

  /* ---------- Kompetensbehov och beroenden i epikformuläret ---------- */

  /* Raderna i behovsredigeraren: teamets områden först, sedan andra områden som epiken behöver. */
  function needsHtml(teamId, needs, focusCat) {
    var e = S.engine();
    var p = OOS.period();
    var rows = teamId ? e.teamCategoryLoad(teamId, p).rows.filter(function (r) { return r.supply > 0.5; }) : [];
    var byCat = {};
    rows.forEach(function (r) { byCat[r.category] = r; });
    var share = {};
    (needs || []).forEach(function (n) { share[n.category] = n.share; });
    var cats = rows.map(function (r) { return r.category; });
    (needs || []).forEach(function (n) { if (cats.indexOf(n.category) < 0) cats.push(n.category); });
    var sum = U.sum(needs || [], function (n) { return Number(n.share) || 0; });
    var h = '<div class="needs">';
    cats.forEach(function (cat) {
      var r = byCat[cat];
      var id = 'need-' + cat.replace(/[^a-zA-Z0-9]+/g, '-');
      h += '<div class="need-row"><label class="need-cat" for="' + id + '">' + esc(cat) + '</label>' +
        '<span class="need-in"><input type="number" id="' + id + '" min="0" max="100" step="5" inputmode="numeric" data-cat="' + esc(cat) + '" value="' + (share[cat] ? esc(share[cat]) : '') + '"' + (cat === focusCat ? ' data-focus="1"' : '') + '><span aria-hidden="true">%</span></span>' +
        '<span class="need-free">' + (r ? (r.free >= 0 ? U.fmtH(r.free) + ' ledigt' : '<span class="crit-text">' + U.fmtH(-r.free) + ' över</span>') : '<span class="crit-text">Saknas i teamet</span>') + '</span></div>';
    });
    var others = C.categories().filter(function (c) { return cats.indexOf(c) < 0; }).map(function (c) { return { value: c, label: c }; });
    h += '<div class="need-foot"><span class="need-sum" data-need-sum>' + needSumText(sum) + '</span>' +
      (others.length ? '<label class="need-add"><span class="sr-only">Lägg till kompetensområde</span><select data-need-add>' + OOSSelect.optionsHtml(others, '', 'Lägg till område …') + '</select></label>' : '') + '</div>';
    return h + '</div>';
  }

  function needSumText(sum) {
    if (!sum) return 'Tomt: fördelas som teamets sammansättning';
    return 'Summa ' + U.fmtNum(sum) + ' %' + (Math.abs(sum - 100) > 0.5 ? ' (ska vara 100 %)' : '');
  }

  function readNeeds(box, keepZero) {
    return Array.prototype.map.call(box.querySelectorAll('input[data-cat]'), function (i) {
      return { category: i.getAttribute('data-cat'), share: Number(i.value) || 0 };
    }).filter(function (n) { return keepZero || n.share > 0; });
  }

  C.needsField = function () {
    return {
      key: 'needs', label: 'Kompetensbehov', type: 'custom',
      help: 'Andel av epikens timmar per område. Ledigt är vad teamet har kvar.',
      render: function (value) { return needsHtml(null, value || []); },
      read: function (box) { return readNeeds(box, false); },
      bind: function (box, form) {
        var teamSel = form.querySelector('[name="teamId"]');
        function redraw(focusCat, list) {
          box.innerHTML = needsHtml(teamSel.value, list || readNeeds(box, true), focusCat);
          OOSSelect.enhance(box);
          var f = box.querySelector('[data-focus]');
          if (f) f.focus();
        }
        /* Första ritningen saknar team. Rita om med teamets områden och de värden som redan finns. */
        box.innerHTML = needsHtml(teamSel.value, readNeeds(box, true));
        OOSSelect.enhance(box);
        teamSel.addEventListener('change', function () { redraw(); });
        box.addEventListener('change', function (ev) {
          if (ev.target.matches('[data-need-add]') && ev.target.value) {
            var list = readNeeds(box, true);
            list.push({ category: ev.target.value, share: 0 });
            redraw(ev.target.value, list);
          }
        });
        box.addEventListener('input', function () {
          var el = box.querySelector('[data-need-sum]');
          if (el) el.textContent = needSumText(U.sum(readNeeds(box, false), function (n) { return n.share; }));
        });
      }
    };
  };

  /* Epiker som direkt eller indirekt beror på den här. De kan inte bli dess beroenden, då blir det en cirkel. */
  function dependentsOf(id) {
    var out = new Set();
    var queue = [id];
    while (queue.length) {
      var cur = queue.shift();
      S.db.epics.forEach(function (x) {
        if ((x.dependsOn || []).indexOf(cur) >= 0 && !out.has(x.id)) { out.add(x.id); queue.push(x.id); }
      });
    }
    return out;
  }

  function depsHtml(ids, selfId) {
    var e = S.engine();
    var h = '<ul class="dep-list">';
    ids.forEach(function (id) {
      var ep = e.get('epics', id);
      if (!ep) return;
      var t = e.get('teams', ep.teamId);
      h += '<li class="dep-item" data-dep-id="' + esc(id) + '"><span class="grow"><span class="dep-name">' + esc(ep.name) + '</span><span class="muted small">' + (t ? esc(t.name) + ' · ' : '') + 'klar ' + U.fmtDate(ep.to) + '</span></span>' +
        '<button type="button" class="btn-icon" data-dep-remove="' + esc(id) + '" aria-label="Ta bort beroendet ' + esc(ep.name) + '">' + UI.icon('x') + '</button></li>';
    });
    h += '</ul>';
    var blocked = selfId ? dependentsOf(selfId) : new Set();
    var opts = S.db.epics.filter(function (x) { return x.id !== selfId && ids.indexOf(x.id) < 0 && !blocked.has(x.id) && x.status !== 'done'; })
      .map(function (x) { var t = e.get('teams', x.teamId); return { value: x.id, label: x.name, group: t ? t.name : 'Utan team', sub: 'Klar ' + U.fmtDate(x.to) }; })
      .sort(function (a, b) { return a.group.localeCompare(b.group, 'sv') || a.label.localeCompare(b.label, 'sv'); });
    h += '<label class="dep-add"><span class="sr-only">Lägg till beroende</span><select data-dep-add>' + OOSSelect.optionsHtml(opts, '', 'Lägg till en epik som måste leverera först …') + '</select></label>';
    return h;
  }

  function readDeps(box) {
    return Array.prototype.map.call(box.querySelectorAll('[data-dep-id]'), function (li) { return li.getAttribute('data-dep-id'); });
  }

  C.depsField = function (selfId) {
    return {
      key: 'dependsOn', label: 'Beror på', type: 'custom',
      help: 'Epiker som måste bli klara först. Risker syns på epiken.',
      render: function (value) { return depsHtml(value || [], selfId); },
      read: readDeps,
      bind: function (box, form) {
        function redraw(list, focusSel) {
          box.innerHTML = depsHtml(list, selfId);
          OOSSelect.enhance(box);
          var target = focusSel ? box.querySelector(focusSel) : null;
          if (target) target.focus();
          form.dispatchEvent(new Event('change'));
        }
        box.addEventListener('click', function (ev) {
          var btn = ev.target.closest('[data-dep-remove]');
          if (!btn) return;
          redraw(readDeps(box).filter(function (id) { return id !== btn.getAttribute('data-dep-remove'); }), '.sel-btn');
        });
        box.addEventListener('change', function (ev) {
          if (ev.target.matches('[data-dep-add]') && ev.target.value) redraw(readDeps(box).concat([ev.target.value]), '.sel-btn');
        });
      }
    };
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

  /*
   * Gör om ett avdrag som egentligen är arbete till en epik. Timmarna blir avdragets andel av
   * teamets kapacitet under avdragets dagar, räknat utan avdraget. Avdraget tas bort när epiken sparas.
   */
  C.reductionToEpic = function (r) {
    var db = S.db;
    function without(d) { return Object.assign({}, d, { teamReductions: d.teamReductions.filter(function (x) { return x.id !== r.id; }) }); }
    var e2 = OOSEngine.create(without(db));
    var hours = 0;
    var p = OOSEngine.periodOf(r.from, 'month');
    for (var i = 0; i < 36 && p.start <= r.to; i++) {
      var days = OOSEngine.overlapWorkdays(r.from, r.to, p.start, p.end);
      if (days && p.workdays) hours += (e2.teamCapacity(r.teamId, p).capacity * days) / p.workdays;
      p = OOSEngine.nextPeriod(p);
    }
    hours = Math.max(1, Math.round((hours * (r.percent || 0)) / 100));
    var t = r.type || '';
    /*
     * Utbildning, underhåll, införanden och uppgraderingar hör till teamets förvaltning. Avdraget tas
     * bort och tiden ryms i förvaltningsramen. Räcker inte ramen höjs den, i stället för en ny epik.
     */
    if (/utbild|kurs|kompetens|underhåll|förvalt|verktyg|uppgrader|inför/i.test(t)) {
      var team = S.engine().get('teams', r.teamId);
      var mt = S.db.epics.filter(function (x) { return x.teamId === r.teamId && x.type === 'maintenance' && x.status !== 'done' && x.status !== 'proposed'; })[0];
      var common = {
        title: 'Lägg avdraget i förvaltningen',
        intro: esc(t) + ' är arbete, inte frånvaro, och hör till ' + (team ? esc(team.name) + 's' : 'teamets') + ' förvaltning. Avdraget tas bort när du sparar. Det motsvarade ' + U.fmtH(hours) + ' under perioden. Höj ramen om den inte räcker.',
        patch: without,
        savedText: 'Avdraget togs bort och ryms i förvaltningen.',
        afterSave: function () { S.remove('teamReductions', r.id); }
      };
      if (mt) F.epic(mt, null, common);
      else F.epic(null, { teamId: r.teamId, name: 'Förvaltning' + (team ? ' – ' + team.name : ''), type: 'maintenance', effort: 'monthly', hours: hours, status: 'active', from: U.todayISO(), to: (Number(U.todayISO().slice(0, 4)) + 1) + '-12-31' }, common);
      return;
    }
    var type = /utred/i.test(t) ? 'investigation' : 'development';
    F.epic(null, {
      teamId: r.teamId, name: r.comment || t, type: type, effort: 'total', hours: hours, from: r.from, to: r.to,
      status: r.to < U.todayISO() ? 'done' : 'planned',
      description: 'Tidigare avdrag: ' + t + ' ' + U.fmtPct(r.percent) + '.'
    }, {
      title: 'Gör om avdraget till en epik',
      intro: esc(t) + ' är arbete, inte frånvaro. Som epik belastar det teamet i stället för att minska kapaciteten, och avdraget tas bort när du sparar.',
      patch: without,
      savedText: 'Avdraget blev en epik.',
      afterSave: function () { S.remove('teamReductions', r.id); }
    });
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
      intro: 'Ett avdrag är tid som inte finns, till exempel föräldraledighet eller långtidsfrånvaro. Arbete läggs som epik: utbildning och underhåll i teamets förvaltning, systembyten och annat i egna epiker. Annars räknas samma tid två gånger.',
      values: r || { teamId: teamId || '', percent: 10, from: p.start, to: p.end },
      fields: [
        { key: 'teamId', label: 'Team', type: 'select', required: true, placeholder: 'Välj team …', options: C.opts.teams(), full: true },
        { key: 'type', label: 'Avdragstyp', required: true, datalist: ['Frånvaro', 'Föräldraledighet', 'Sjukfrånvaro', 'Tjänstledighet', 'Vakans'] },
        { key: 'percent', label: 'Värde (%)', type: 'number', min: 0, max: 100, required: true },
        { key: 'from', label: 'Gäller från', type: 'date', required: true },
        { key: 'to', label: 'Gäller till', type: 'date', required: true },
        { key: 'comment', label: 'Orsak/kommentar', full: true }
      ],
      validate: function (v) {
        if (OOSEngine.isWorkReduction(v.type)) return { type: 'Det här är arbete. Utbildning och underhåll ryms i teamets förvaltning, annat arbete läggs som en epik. Annars räknas tiden två gånger.' };
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
  F.epic = function (r, defaults, opts) {
    opts = opts || {};
    var isNew = !r;
    var p = OOS.period();
    UI.openForm({
      title: opts.title || (isNew ? 'Lägg till epik' : 'Ändra ' + r.name),
      intro: opts.intro || 'Timmarna är teamets estimat tills epiken beslutas.',
      /* Långt formulär: bred dialog med konsekvensen, kompetensbehovet och beroendena till höger. */
      wide: true,
      side: ['needs', 'dependsOn'],
      previewEmpty: 'Välj team för att se vad epiken betyder för teamets beläggning.',
      values: r || Object.assign({ type: 'development', status: 'planned', effort: 'total', hours: 200, from: p.start, to: C.defaultEnd(p, 1), needs: [], dependsOn: [] }, defaults || {}),
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'teamId', label: 'Team', type: 'select', required: true, placeholder: 'Välj team …', options: C.opts.teams() },
        /* Hjälptexterna syns när de gäller, inte hela tiden. */
        { key: 'type', label: 'Arbetstyp', type: 'select', required: true, options: C.opts.epicTypes, help: function (v) { return v.type === 'maintenance' ? 'Förvaltning rymmer drift, rättningar, utbildning och kompetensspridning. En per team.' : ''; } },
        { key: 'initiativeId', label: 'Initiativ', type: 'select', placeholder: 'Inget initiativ', options: C.opts.initiatives(), help: function (v) { return v.type === 'development' && !v.initiativeId ? 'Utveckling bör höra till ett beslutat initiativ.' : ''; } },
        { key: 'status', label: 'Status', type: 'select', required: true, options: C.opts.epicStatus, help: function (v) { return v.status === 'proposed' ? 'Ett förslag belastar inte teamet förrän det beslutas.' : v.status === 'done' ? 'Klara epiker räknas för den tid de pågick.' : ''; } },
        { key: 'effort', label: 'Ram', type: 'select', required: true, options: C.opts.effort },
        { key: 'hours', label: 'Timmar', type: 'number', min: 1, max: 100000, required: true },
        { key: 'from', label: 'Från', type: 'date', required: true },
        { key: 'to', label: 'Till', type: 'date', required: true },
        C.needsField(),
        C.depsField(r ? r.id : null),
        { key: 'description', label: 'Beskrivning', type: 'textarea' }
      ],
      preview: function (v) { return C.impactHtml(C.epicImpact(v, r, opts.patch)) + (v.teamId ? C.investmentImpactHtml(v, r) : ''); },
      validate: function (v) {
        if (v.from && v.to && v.from > v.to) return { to: 'Slutdatum måste vara efter startdatum.' };
        /* Förvaltning är en löpande ram, och varje team har en. Mer förvaltning = högre ram, inte en till epik. */
        if (v.type === 'maintenance') {
          if (v.effort !== 'monthly') return { effort: 'Förvaltning är löpande. Välj ram per månad.' };
          var other = S.db.epics.filter(function (x) {
            return x.teamId === v.teamId && x.type === 'maintenance' && (!r || x.id !== r.id) && x.status !== 'done' && x.from <= v.to && x.to >= v.from;
          })[0];
          if (other) return { type: 'Teamet har redan förvaltningen ' + other.name + '. Höj dess ram i stället, utbildning och kompetensspridning ryms där.' };
        }
        var sum = U.sum(v.needs || [], function (n) { return n.share; });
        if (sum && Math.abs(sum - 100) > 0.5) return { needs: 'Andelarna ska bli 100 %. Nu är de ' + U.fmtNum(sum) + ' %.' };
      },
      onSubmit: function (v) {
        v.initiativeId = v.initiativeId || null;
        /* En epik som blir klar i förtid slutar i dag. Annars skulle den belasta teamet framåt. */
        var today = U.todayISO();
        var trimmed = v.status === 'done' && v.to > today && v.from <= today;
        if (trimmed) v.to = today;
        var rec = isNew ? S.insert('epics', v) : S.update('epics', r.id, v);
        if (opts.afterSave) opts.afterSave(rec);
        UI.toast((opts.savedText || (isNew ? 'Epiken lades till.' : 'Epiken sparades.')) + (trimmed ? ' Slutdatum sattes till i dag eftersom den är klar.' : ''));
        if (isNew) OOS.go('epics:' + rec.id);
        else OOS.refresh();
      },
      onDelete: isNew ? null : function () { C.removeEntity('epics', r.id, 'epics'); }
    });
  };

  /*
   * Initiativ: en beslutad satsning som en leveransdomän äger och som bryts ned i teamens epiker.
   * Investeringen är hur mycket tid satsningen får kosta (omvänd estimering). Teamen estimerar epikerna.
   */
  F.initiative = function (r) {
    var isNew = !r;
    var p = OOS.period();
    UI.openForm({
      title: isNew ? 'Lägg till initiativ' : 'Ändra ' + r.name,
      intro: 'Leveransdomänen beslutar initiativet och hur mycket tid det får kosta. Teamen bryter ned det i epiker och estimerar dem.',
      values: r || { status: 'planned', from: p.start, to: C.defaultEnd(p, 2) },
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'deliveryDomainId', label: 'Leveransdomän', type: 'select', required: true, placeholder: 'Välj leveransdomän …', options: C.opts.deliveryDomains() },
        { key: 'ownerId', label: 'Ägare', type: 'select', placeholder: 'Välj ägare …', options: C.opts.workers() },
        { key: 'status', label: 'Status', type: 'select', required: true, options: C.opts.epicStatus },
        { key: 'investment', label: 'Investering, timmar', type: 'number', min: 1, max: 1000000, placeholder: 'Inte beslutad', help: function (v) { return C.investmentFormHelp(v, r); } },
        { key: 'from', label: 'Från', type: 'date', required: true },
        { key: 'to', label: 'Till', type: 'date', required: true },
        { key: 'goal', label: 'Mål', type: 'textarea', help: 'Vad ska vara annorlunda när initiativet är klart?' }
      ],
      validate: function (v) {
        if (v.from && v.to && v.from > v.to) return { to: 'Slutdatum måste vara efter startdatum.' };
      },
      onSubmit: function (v) {
        v.ownerId = v.ownerId || null;
        v.investment = v.investment > 0 ? v.investment : null;
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

  /*
   * Förslag på slutdatum för nytt arbete som börjar med perioden: n PI:er när perioden är en PI,
   * annars tre månader. Ett år är för långt som förslag för en epik.
   */
  C.defaultEnd = function (p, n) {
    if (p.type === 'pi') {
      var q = p;
      for (var i = 1; i < n; i++) q = OOSEngine.nextPeriod(q);
      return q.end;
    }
    var m = OOSEngine.periodOf(p.start, 'month');
    return OOSEngine.nextPeriod(OOSEngine.nextPeriod(m)).end;
  };

  /*
   * En PI i PI-kalendern. En ny PI föreslås direkt efter den sista, lika lång och med nästa namn,
   * så att kalendern går att fylla på med några klick. PI:er får inte överlappa.
   */
  F.pi = function (r) {
    var isNew = !r;
    var last = S.db.pis.slice().sort(function (a, b) { return a.end.localeCompare(b.end); }).pop();
    var values = r;
    if (isNew) {
      var start = last ? U.addDays(last.end, 1) : OOS.period().start;
      var end;
      /* Följer den sista PI:n hela månader blir förslaget lika många hela månader, annars lika många dagar. */
      var ls = last && U.parseDate(last.start);
      var le = last && U.parseDate(last.end);
      if (last && ls.getUTCDate() === 1 && U.addDays(last.end, 1).slice(8) === '01') {
        var months = (le.getUTCFullYear() - ls.getUTCFullYear()) * 12 + le.getUTCMonth() - ls.getUTCMonth() + 1;
        var sd = U.parseDate(start);
        end = U.toISO(new Date(Date.UTC(sd.getUTCFullYear(), sd.getUTCMonth() + months, 0)));
      } else {
        end = U.addDays(start, last ? Math.round((le - ls) / 864e5) : 90);
      }
      var m = last && /^PI (\d+) (\d{4})$/.exec(last.name);
      var year = start.slice(0, 4);
      var name = m ? (m[2] === year && +m[1] < 4 ? 'PI ' + (+m[1] + 1) + ' ' + year : 'PI 1 ' + year) : '';
      values = { name: name, start: start, end: end };
    }
    UI.openForm({
      title: isNew ? 'Lägg till PI' : 'Ändra ' + r.name,
      intro: 'En PI är en planeringsperiod. Alla siffror i Fabriken kan visas per PI.',
      values: values,
      fields: [
        { key: 'name', label: 'Namn', required: true, full: true },
        { key: 'start', label: 'Från', type: 'date', required: true },
        { key: 'end', label: 'Till', type: 'date', required: true, help: function (v) { return v.start && v.end && v.start <= v.end ? OOSEngine.workdays(v.start, v.end) + ' arbetsdagar.' : ''; } }
      ],
      validate: function (v) {
        if (v.start && v.end && v.start > v.end) return { end: 'Slutdatum måste vara efter startdatum.' };
        var clash = S.db.pis.filter(function (x) { return (!r || x.id !== r.id) && x.start <= v.end && x.end >= v.start; })[0];
        if (clash) return { start: 'Överlappar ' + clash.name + ', ' + U.fmtDate(clash.start) + ' – ' + U.fmtDate(clash.end) + '.' };
      },
      onSubmit: function (v) {
        if (isNew) S.insert('pis', v);
        else S.update('pis', r.id, v);
        UI.toast(isNew ? 'PI:n lades till.' : 'PI:n sparades.');
        OOS.refresh();
      },
      onDelete: isNew ? null : function () {
        UI.confirm({ title: 'Ta bort ' + r.name + '?', message: 'Datumen räknas då inte till någon PI. Siffrorna i Fabriken ändras inte, bara hur perioderna delas.', confirmLabel: 'Ta bort', danger: true }).then(function (ok) {
          if (!ok) return;
          S.remove('pis', r.id);
          UI.toast('PI:n togs bort.');
          OOS.refresh();
        });
      }
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
