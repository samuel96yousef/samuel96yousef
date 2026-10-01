/*
 * OOS-motorn: relationer och kapacitetsberäkning ovanpå datamodellen.
 *
 * Datamodellen följer ER-skissen för Prototyp 1 (DeliveryDomain, Domain, DomainCluster,
 * Team, Team_Domain, Worker, Team_Worker, WorkerCompetence, Worker_Competence,
 * ExtendedDomain_Competence, ExtendedDeliveryCompetence, Systems, Team_System,
 * ITDomain_System, OverheadReduction). CapacitySummary räknas fram i stället för att lagras.
 *
 * Allt här är rena funktioner utan DOM, så att beräkningarna kan testas i Node.
 */
var OOSEngine = (function () {
  var U = typeof OOSUtil !== 'undefined' ? OOSUtil : require('./util.js');

  var UNSPECIFIED = { id: '_none', name: 'Ospecificerad kompetens', category: 'Ospecificerad', type: 'it' };

  /* Förslag på målnivåer. De kan ändras under Insikter och sparas i inställningarna. */
  var DEFAULT_TARGETS = {
    load: { min: 70, max: 85 },
    overallocated: { max: 0 },
    producingShare: { min: 60 },
    consultantShare: { max: 25 },
    keypersons: { max: 0 },
    coverage: { min: 95 },
    nextChange: { min: -10 },
    aiShare: {}
  };

  /* ---------- Perioder och arbetsdagar ---------- */

  function workdays(start, end) {
    if (!start || !end || start > end) return 0;
    var d = U.parseDate(start);
    var e = U.parseDate(end);
    var count = 0;
    while (d <= e) {
      var wd = d.getUTCDay();
      if (wd !== 0 && wd !== 6) count++;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return count;
  }

  function overlapWorkdays(aStart, aEnd, bStart, bEnd) {
    var s = aStart > bStart ? aStart : bStart;
    var e = aEnd < bEnd ? aEnd : bEnd;
    return s <= e ? workdays(s, e) : 0;
  }

  function lastDayOfMonth(y, m) {
    return U.toISO(new Date(Date.UTC(y, m + 1, 0)));
  }

  function periodOf(anchor, type) {
    var d = U.parseDate(anchor);
    var y = d.getUTCFullYear();
    var m = d.getUTCMonth();
    var start, end, label;
    if (type === 'quarter') {
      var q = Math.floor(m / 3);
      start = U.toISO(new Date(Date.UTC(y, q * 3, 1)));
      end = lastDayOfMonth(y, q * 3 + 2);
      label = 'Q' + (q + 1) + ' ' + y;
    } else {
      start = U.toISO(new Date(Date.UTC(y, m, 1)));
      end = lastDayOfMonth(y, m);
      label = U.MONTHS_LONG[m] + ' ' + y;
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    /* inText används mitt i meningar: "i september 2026", "i Q3 2026". */
    var inText = type === 'quarter' ? label : label.toLowerCase();
    return { type: type || 'month', start: start, end: end, label: label, inText: inText, workdays: workdays(start, end) };
  }

  function nextPeriod(p) {
    return periodOf(U.addDays(p.end, 1), p.type);
  }

  function prevPeriod(p) {
    return periodOf(U.addDays(p.start, -1), p.type);
  }

  /* Timmar per månad fördelas månad för månad efter överlappande arbetsdagar. */
  function monthlyHoursInPeriod(hoursPerMonth, from, to, period) {
    var s = from && from > period.start ? from : period.start;
    var e = to && to < period.end ? to : period.end;
    if (s > e) return 0;
    var total = 0;
    var cursor = U.parseDate(s);
    cursor.setUTCDate(1);
    while (U.toISO(cursor) <= e) {
      var y = cursor.getUTCFullYear();
      var m = cursor.getUTCMonth();
      var ms = U.toISO(cursor);
      var me = lastDayOfMonth(y, m);
      var wdMonth = workdays(ms, me);
      var ov = overlapWorkdays(ms, me, s, e);
      if (wdMonth > 0) total += (hoursPerMonth * ov) / wdMonth;
      cursor = new Date(Date.UTC(y, m + 1, 1));
    }
    return total;
  }

  /* ---------- Motorinstans med index ---------- */

  function create(db) {
    var byId = {};
    Object.keys(db).forEach(function (k) {
      if (Array.isArray(db[k])) {
        var m = new Map();
        db[k].forEach(function (x) {
          m.set(x.id, x);
        });
        byId[k] = m;
      }
    });

    function get(coll, id) {
      return (byId[coll] && byId[coll].get(id)) || null;
    }

    function where(coll, key, value) {
      return (db[coll] || []).filter(function (x) {
        return x[key] === value;
      });
    }

    var settings = db.settings || {};
    var standardWeek = settings.standardWeekHours || 40;

    /* ----- Relationer ----- */

    function clustersOfDomain(domainId) {
      return where('domainClusters', 'domainId', domainId).map(function (c) {
        return { cluster: c, deliveryDomain: get('deliveryDomains', c.deliveryDomainId), relationship: c.relationship };
      });
    }

    function deliveryDomainOfDomain(domainId) {
      var cs = clustersOfDomain(domainId);
      var primary = cs.filter(function (c) {
        return c.relationship === 'primary';
      })[0];
      return primary ? primary.deliveryDomain : cs[0] ? cs[0].deliveryDomain : null;
    }

    function domainsOfDeliveryDomain(ddId, type) {
      return where('domainClusters', 'deliveryDomainId', ddId)
        .map(function (c) {
          return { cluster: c, domain: get('domains', c.domainId), relationship: c.relationship };
        })
        .filter(function (x) {
          return x.domain && (!type || x.domain.type === type);
        });
    }

    function teamDomains(teamId) {
      return where('teamDomains', 'teamId', teamId)
        .map(function (td) {
          return { link: td, domain: get('domains', td.domainId), relationship: td.relationship };
        })
        .filter(function (x) {
          return x.domain;
        });
    }

    function teamPrimaryDomain(teamId, type) {
      var hit = teamDomains(teamId).filter(function (x) {
        return x.domain.type === type && x.relationship === 'primary';
      })[0];
      return hit ? hit.domain : null;
    }

    /* Teamets leveransdomän härleds: primär verksamhetsdomän i första hand, annars primär IT-domän. */
    function teamDeliveryDomain(teamId) {
      var bd = teamPrimaryDomain(teamId, 'business');
      var dd = bd ? deliveryDomainOfDomain(bd.id) : null;
      if (dd) return dd;
      var it = teamPrimaryDomain(teamId, 'it');
      return it ? deliveryDomainOfDomain(it.id) : null;
    }

    function teamsOfDomain(domainId) {
      return where('teamDomains', 'domainId', domainId)
        .map(function (td) {
          return { link: td, team: get('teams', td.teamId), relationship: td.relationship };
        })
        .filter(function (x) {
          return x.team;
        });
    }

    function teamsOfDeliveryDomain(ddId) {
      return db.teams.filter(function (t) {
        var dd = teamDeliveryDomain(t.id);
        return dd && dd.id === ddId;
      });
    }

    function teamMembers(teamId) {
      return where('teamWorkers', 'teamId', teamId)
        .map(function (tw) {
          return { tw: tw, worker: get('workers', tw.workerId) };
        })
        .filter(function (x) {
          return x.worker;
        });
    }

    function workerTeams(workerId) {
      return where('teamWorkers', 'workerId', workerId)
        .map(function (tw) {
          return { tw: tw, team: get('teams', tw.teamId) };
        })
        .filter(function (x) {
          return x.team;
        });
    }

    function workerCompetences(workerId) {
      return where('workerCompetences', 'workerId', workerId)
        .map(function (wc) {
          return { wc: wc, competence: get('competences', wc.competenceId) };
        })
        .filter(function (x) {
          return x.competence;
        })
        .sort(function (a, b) {
          if (a.wc.weight !== b.wc.weight) return a.wc.weight === 'primary' ? -1 : 1;
          return b.wc.level - a.wc.level;
        });
    }

    function competenceHolders(competenceId) {
      return where('workerCompetences', 'competenceId', competenceId)
        .map(function (wc) {
          return { wc: wc, worker: get('workers', wc.workerId) };
        })
        .filter(function (x) {
          return x.worker;
        })
        .sort(function (a, b) {
          return b.wc.level - a.wc.level;
        });
    }

    /* Kapaciteten attribueras till arbetarens primära kompetenser, jämnt fördelat. */
    function attributionCompetences(workerId) {
      var list = workerCompetences(workerId);
      var primary = list.filter(function (x) {
        return x.wc.weight === 'primary';
      });
      if (primary.length) return primary.map(function (x) { return x.competence; });
      if (list.length) return [list[0].competence];
      return [UNSPECIFIED];
    }

    function teamSystems(teamId) {
      return where('teamSystems', 'teamId', teamId)
        .map(function (ts) {
          return { link: ts, system: get('systems', ts.systemId) };
        })
        .filter(function (x) {
          return x.system;
        });
    }

    function systemTeams(systemId) {
      return where('teamSystems', 'systemId', systemId)
        .map(function (ts) {
          return { link: ts, team: get('teams', ts.teamId) };
        })
        .filter(function (x) {
          return x.team;
        });
    }

    function systemResponsibleTeam(systemId) {
      var hit = systemTeams(systemId).filter(function (x) {
        return x.link.objective === 'owner';
      })[0];
      return hit ? hit.team : null;
    }

    function systemItDomains(systemId) {
      return where('itDomainSystems', 'systemId', systemId)
        .map(function (l) {
          return { link: l, domain: get('domains', l.domainId), relationship: l.relationship };
        })
        .filter(function (x) {
          return x.domain;
        });
    }

    function systemPrimaryItDomain(systemId) {
      var hit = systemItDomains(systemId).filter(function (x) {
        return x.relationship === 'primary';
      })[0];
      return hit ? hit.domain : null;
    }

    function itDomainSystems(domainId) {
      return where('itDomainSystems', 'domainId', domainId)
        .map(function (l) {
          return { link: l, system: get('systems', l.systemId), relationship: l.relationship };
        })
        .filter(function (x) {
          return x.system;
        });
    }

    /* System som en domän "äger" via sina team, plus direkta IT-domänkopplingar. */
    function systemsOfDomain(domainId) {
      var seen = new Map();
      teamsOfDomain(domainId).forEach(function (t) {
        teamSystems(t.team.id).forEach(function (s) {
          if (!seen.has(s.system.id)) seen.set(s.system.id, { system: s.system, team: t.team, via: 'team' });
        });
      });
      itDomainSystems(domainId).forEach(function (s) {
        if (!seen.has(s.system.id)) seen.set(s.system.id, { system: s.system, team: systemResponsibleTeam(s.system.id), via: 'domain' });
      });
      return Array.from(seen.values());
    }

    function systemsOfDeliveryDomain(ddId) {
      var seen = new Map();
      teamsOfDeliveryDomain(ddId).forEach(function (t) {
        teamSystems(t.id).forEach(function (s) {
          if (!seen.has(s.system.id)) seen.set(s.system.id, { system: s.system, team: t });
        });
      });
      return Array.from(seen.values());
    }

    function domainExperts(domainId) {
      return where('extendedDomainCompetences', 'domainId', domainId)
        .map(function (x) {
          return { ext: x, worker: get('workers', x.workerId), domain: get('domains', domainId) };
        })
        .filter(function (x) {
          return x.worker;
        });
    }

    function deliveryDomainExperts(ddId) {
      return where('extendedDeliveryCompetences', 'deliveryDomainId', ddId)
        .map(function (x) {
          return { ext: x, worker: get('workers', x.workerId), deliveryDomain: get('deliveryDomains', ddId) };
        })
        .filter(function (x) {
          return x.worker;
        });
    }

    function workerDomainRoles(workerId) {
      var d = where('extendedDomainCompetences', 'workerId', workerId).map(function (x) {
        return { ext: x, kind: 'domain', target: get('domains', x.domainId) };
      });
      var dd = where('extendedDeliveryCompetences', 'workerId', workerId).map(function (x) {
        return { ext: x, kind: 'delivery', target: get('deliveryDomains', x.deliveryDomainId) };
      });
      return d.concat(dd).filter(function (x) {
        return x.target;
      });
    }

    /* Arbetarens primära domäner: via primärt team (högst allokering) eller domänroll. */
    function workerPrimaryDomains(workerId) {
      var teams = workerTeams(workerId).sort(function (a, b) {
        return b.tw.allocation - a.tw.allocation;
      });
      var res = { deliveryDomain: null, business: null, it: null, team: teams[0] ? teams[0].team : null };
      if (teams[0]) {
        res.business = teamPrimaryDomain(teams[0].team.id, 'business');
        res.it = teamPrimaryDomain(teams[0].team.id, 'it');
        res.deliveryDomain = teamDeliveryDomain(teams[0].team.id);
      }
      workerDomainRoles(workerId).forEach(function (r) {
        if (r.kind === 'domain') {
          if (r.target.type === 'business' && !res.business) res.business = r.target;
          if (r.target.type === 'it' && !res.it) res.it = r.target;
          if (!res.deliveryDomain) res.deliveryDomain = deliveryDomainOfDomain(r.target.id);
        } else if (!res.deliveryDomain) {
          res.deliveryDomain = r.target;
        }
      });
      return res;
    }

    /* ----- Kapacitet ----- */

    function overheadPerWeek(worker) {
      var scale = (worker.baseHoursPerWeek || 0) / standardWeek;
      return U.sum(
        (db.overheadReductions || []).filter(function (r) {
          return worker.type !== 'ai' || r.appliesToAI;
        }),
        function (r) {
          return r.hoursPerWeek * scale;
        }
      );
    }

    function weekToPeriod(hoursPerWeek, period) {
      return (hoursPerWeek / 5) * period.workdays;
    }

    /* Summan av teamets särskilda avdrag som andel, viktad på arbetsdagar i perioden. */
    function teamReductionShare(teamId, period) {
      if (!period.workdays) return { share: 0, active: [] };
      var active = [];
      var weighted = 0;
      where('teamReductions', 'teamId', teamId).forEach(function (r) {
        var ov = overlapWorkdays(r.from, r.to, period.start, period.end);
        if (ov > 0) {
          active.push({ reduction: r, workdays: ov });
          weighted += (r.percent / 100) * ov;
        }
      });
      return { share: Math.min(1, weighted / period.workdays), active: active };
    }

    var workerCache = new Map();
    var workerHoursCache = new Map();
    var epicMode = settings.loadSource !== 'manual';

    /* ---------- Arbete: initiativ och epiker ---------- */

    var demandCache = new Map();

    /*
     * Teamets efterfrågan i perioden: timmarna i beslutade epiker (planerade och pågående),
     * per arbetstyp. Förslag räknas inte, men redovisas för sig så att konsekvensen syns.
     */
    function teamDemand(teamId, period) {
      var key = teamId + '|' + period.start + '|' + period.end;
      if (demandCache.has(key)) return demandCache.get(key);
      var byType = {};
      var list = [];
      var hours = 0;
      var proposed = 0;
      where('epics', 'teamId', teamId).forEach(function (ep) {
        var h = epicHoursInPeriod(ep, period);
        if (h <= 0) return;
        var counts = !!COUNTS[ep.status];
        list.push({ epic: ep, hours: h, counts: counts });
        if (counts) {
          hours += h;
          byType[ep.type] = (byType[ep.type] || 0) + h;
        } else if (ep.status === 'proposed') {
          proposed += h;
        }
      });
      list.forEach(function (x) { x.load = x.counts ? x.hours : 0; });
      list.sort(function (a, b) { return b.hours - a.hours; });
      var res = { hours: hours, byType: byType, epics: list, proposed: proposed };
      demandCache.set(key, res);
      return res;
    }

    /*
     * Teamets förvaltning: drift, rättningar, utbildning och kompetensspridning. Varje team har en
     * förvaltningsepik med en löpande ram per månad. Utbildning är ingen egen epik utan ryms i ramen.
     */
    function teamMaintenance(teamId, period) {
      return where('epics', 'teamId', teamId).filter(function (ep) {
        return ep.type === 'maintenance' && COUNTS[ep.status] && ep.from <= period.end && ep.to >= period.start;
      });
    }

    var supplyCache = new Map();

    /* Teamets kapacitet utan belastning. Används för att räkna beläggning ur epikerna. */
    function teamSupply(teamId, period) {
      var key = teamId + '|' + period.start + '|' + period.end;
      if (supplyCache.has(key)) return supplyCache.get(key);
      var red = teamReductionShare(teamId, period);
      var cap = U.sum(teamMembers(teamId), function (m) {
        var wh = workerHours(m.worker.id, period);
        return ((wh.available * m.tw.allocation) / 100) * wh.scale * (1 - red.share);
      });
      supplyCache.set(key, cap);
      return cap;
    }

    /*
     * Hur stor del av teamets kapacitet som är planerad. Med epiker: efterfrågan delat med kapacitet,
     * samma andel för varje medlem eftersom arbetet fördelas inom teamet. Kan bli mer än 1 (överplanerat).
     */
    function teamLoadRatio(teamId, period) {
      var supply = teamSupply(teamId, period);
      if (!supply) return 0;
      return teamDemand(teamId, period).hours / supply;
    }

    /*
     * En medlems planerade timmar i teamet. Med epiker fördelas arbetet efter kompetens: medlemmens
     * tid på varje kompetens gånger beläggningen för kompetensområdet i teamet. En testare blir alltså
     * fullbelagd när teamets testarbete är det, även om utvecklarna har tid över.
     * Manuellt läge använder procentsatsen på medlemskapet.
     */
    function memberLoaded(tw, cap, period) {
      if (!epicMode) return (cap * (tw.plannedLoad || 0)) / 100;
      return cap * memberRatio(tw, period);
    }

    function memberRatio(tw, period) {
      var cl = teamCategoryLoad(tw.teamId, period);
      var comps = attributionCompetences(tw.workerId);
      return U.sum(comps, function (c) { return cl.ratio[catOf(c)] || 0; }) / comps.length;
    }

    function memberLoadPct(tw, period) {
      return epicMode ? memberRatio(tw, period) * 100 : tw.plannedLoad || 0;
    }

    function catOf(c) {
      return (c && c.category) || 'Ospecificerad';
    }

    var catCache = new Map();

    /*
     * Teamets kapacitet och beslutade arbete per kompetensområde. Epikens kompetensbehov styr var
     * timmarna hamnar. En epik utan angivet behov fördelas som teamets sammansättning. Arbete inom ett
     * område som teamet saknar är en lucka: det belastar teamet men kan inte bäras av någon i det.
     */
    function teamCategoryLoad(teamId, period) {
      var key = teamId + '|' + period.start + '|' + period.end;
      if (catCache.has(key)) return catCache.get(key);
      var red = teamReductionShare(teamId, period);
      var supply = {};
      var people = {};
      teamMembers(teamId).forEach(function (m) {
        var wh = workerHours(m.worker.id, period);
        var cap = ((wh.available * m.tw.allocation) / 100) * wh.scale * (1 - red.share);
        var comps = attributionCompetences(m.worker.id);
        comps.forEach(function (c) {
          var k = catOf(c);
          supply[k] = (supply[k] || 0) + cap / comps.length;
          (people[k] = people[k] || []).push({ worker: m.worker, tw: m.tw, hours: cap / comps.length });
        });
      });
      var demand = {};
      var unspecified = 0;
      teamDemand(teamId, period).epics.forEach(function (x) {
        if (!x.counts || x.load <= 0) return;
        var needs = normNeeds(x.epic.needs);
        if (!needs) { unspecified += x.load; return; }
        needs.forEach(function (n) { demand[n.category] = (demand[n.category] || 0) + x.load * n.share; });
      });
      var totalSupply = U.sum(Object.keys(supply), function (k) { return supply[k]; });
      if (unspecified) {
        if (totalSupply) Object.keys(supply).forEach(function (k) { demand[k] = (demand[k] || 0) + (unspecified * supply[k]) / totalSupply; });
        else demand.Ospecificerad = (demand.Ospecificerad || 0) + unspecified;
      }
      var cats = Array.from(new Set(Object.keys(supply).concat(Object.keys(demand))));
      var ratio = {};
      var gap = 0;
      var rows = cats.map(function (k) {
        var sup = supply[k] || 0;
        var dem = demand[k] || 0;
        var isGap = sup < 0.5 && dem > 0.5;
        if (isGap) gap += dem;
        ratio[k] = sup ? dem / sup : 0;
        return { category: k, supply: sup, demand: dem, free: sup - dem, loadPct: sup ? (dem / sup) * 100 : dem > 0.5 ? Infinity : 0, gap: isGap, people: people[k] || [] };
      }).sort(function (a, b) { return b.supply - a.supply || b.demand - a.demand; });
      var res = { rows: rows, ratio: ratio, gap: gap, unspecified: unspecified };
      catCache.set(key, res);
      return res;
    }

    /* Var samma kompetensområde har ledig tid i andra team, som text till en signal. */
    function freeElsewhere(category, exceptTeamId, period) {
      var spots = [];
      db.teams.forEach(function (t) {
        if (t.id === exceptTeamId) return;
        teamCategoryLoad(t.id, period).rows.forEach(function (r) {
          if (r.category === category && !r.gap && r.free > 20) spots.push({ team: t, free: r.free });
        });
      });
      spots.sort(function (a, b) { return b.free - a.free; });
      if (!spots.length) return ' Inget annat team har ledig tid inom ' + category + '.';
      return ' Ledigt i andra team: ' + spots.slice(0, 2).map(function (x) { return x.team.name + ' ' + U.fmtH(x.free); }).join(', ') + '.';
    }

    /* Organisationens kompetensområden: kapacitet, beslutat arbete och ledigt, summerat över teamen. */
    function orgCategoryLoad(period) {
      var map = {};
      db.teams.forEach(function (t) {
        teamCategoryLoad(t.id, period).rows.forEach(function (r) {
          var m = map[r.category] = map[r.category] || { category: r.category, supply: 0, demand: 0, teams: [] };
          m.supply += r.supply;
          m.demand += r.demand;
          m.teams.push({ team: t, row: r });
        });
      });
      return Object.keys(map).map(function (k) {
        var m = map[k];
        m.free = m.supply - m.demand;
        m.loadPct = m.supply ? (m.demand / m.supply) * 100 : 0;
        return m;
      }).sort(function (a, b) { return b.supply - a.supply; });
    }

    /*
     * Epikens beroenden: andra epiker som måste leverera först. Risker: beroendet blir klart efter
     * epiken, är bara ett förslag, eller ligger hos ett team som är överplanerat i det området.
     */
    function epicDependencies(epicId, period) {
      var ep = get('epics', epicId);
      if (!ep) return [];
      return (ep.dependsOn || []).map(function (id) { return get('epics', id); }).filter(Boolean).map(function (dep) {
        return { epic: dep, risks: dependencyRisks(ep, dep, period) };
      });
    }

    function epicDependents(epicId, period) {
      return (db.epics || []).filter(function (x) { return (x.dependsOn || []).indexOf(epicId) >= 0; }).map(function (x) {
        var dep = get('epics', epicId);
        return { epic: x, risks: dep ? dependencyRisks(x, dep, period) : [] };
      });
    }

    function dependencyRisks(ep, dep, period) {
      var risks = [];
      if (dep.to > ep.to) risks.push({ kind: 'late', text: 'Blir klar efter att epiken ska vara klar' });
      if (COUNTS[ep.status] && !COUNTS[dep.status]) risks.push({ kind: 'undecided', text: 'Är bara ett förslag' });
      if (COUNTS[dep.status] && dep.status !== 'done' && epicHoursInPeriod(dep, period) > 0) {
        var cl = teamCategoryLoad(dep.teamId, period);
        var needs = normNeeds(dep.needs);
        var cats = needs ? needs.map(function (n) { return n.category; }) : cl.rows.map(function (r) { return r.category; });
        var tight = cl.rows.filter(function (r) { return cats.indexOf(r.category) >= 0 && (r.gap || r.loadPct > 100.5); });
        if (tight.length) {
          var t = get('teams', dep.teamId);
          var over = tight.filter(function (r) { return !r.gap; }).map(function (r) { return r.category; });
          var missing = tight.filter(function (r) { return r.gap; }).map(function (r) { return r.category; });
          risks.push({
            kind: 'capacity',
            text: (t ? t.name : 'Teamet') + (over.length ? ' är överplanerat i ' + over.join(' och ') : '') + (over.length && missing.length ? ' och' : '') + (missing.length ? ' saknar ' + missing.join(' och ') : '')
          });
        }
      }
      return risks;
    }

    function initiativeEpics(initiativeId) {
      return where('epics', 'initiativeId', initiativeId);
    }

    /* Initiativet i siffror: timmar i perioden, hela ramen och vilka team som bär arbetet. */
    function initiativeSummary(initiativeId, period) {
      var eps = initiativeEpics(initiativeId);
      var decided = eps.filter(function (ep) { return COUNTS[ep.status]; });
      var teams = new Map();
      decided.forEach(function (ep) {
        var t = get('teams', ep.teamId);
        if (!t) return;
        var cur = teams.get(t.id) || { team: t, hours: 0, frame: 0, epics: 0 };
        cur.hours += epicHoursInPeriod(ep, period);
        cur.frame += epicFrame(ep);
        cur.epics += 1;
        teams.set(t.id, cur);
      });
      return {
        epics: eps,
        decided: decided,
        teams: Array.from(teams.values()).sort(function (a, b) { return b.frame - a.frame; }),
        hoursInPeriod: U.sum(decided, function (ep) { return epicHoursInPeriod(ep, period); }),
        frame: U.sum(decided, epicFrame),
        proposedFrame: U.sum(eps.filter(function (ep) { return ep.status === 'proposed'; }), epicFrame),
        done: eps.filter(function (ep) { return ep.status === 'done'; }).length
      };
    }

    /* Allt beslutat arbete i perioden, per arbetstyp, för hela organisationen. */
    /* Beslutat arbete per typ i hela organisationen, efter att utbildning har räknats mot grundavdraget. */
    function workByType(period) {
      var out = {};
      db.teams.forEach(function (t) {
        var d = teamDemand(t.id, period);
        Object.keys(d.byType).forEach(function (k) { out[k] = (out[k] || 0) + d.byType[k]; });
      });
      return out;
    }

    /*
     * Arbetarens timmar i perioden, utan belastning. Är arbetaren överallokerad skalas alla
     * åtaganden ned med "scale" så att summan aldrig blir mer än de timmar personen faktiskt har.
     */
    function workerHours(workerId, period) {
      var key = workerId + '|' + period.start + '|' + period.end;
      if (workerHoursCache.has(key)) return workerHoursCache.get(key);
      var w = get('workers', workerId);
      if (!w) return null;
      var baseWeek = w.baseHoursPerWeek || 0;
      var ohWeek = overheadPerWeek(w);
      var available = Math.max(0, weekToPeriod(baseWeek, period) - weekToPeriod(ohWeek, period));
      var teamHours = U.sum(workerTeams(workerId), function (x) { return (available * x.tw.allocation) / 100; });
      var domainHours = U.sum(workerDomainRoles(workerId), function (r) { return monthlyHoursInPeriod(r.ext.hoursPerMonth || 0, r.ext.from, r.ext.to, period); });
      var committed = teamHours + domainHours;
      var res = { available: available, scale: committed > available ? available / committed : 1 };
      workerHoursCache.set(key, res);
      return res;
    }

    /*
     * Arbetarens kapacitet i perioden. Är arbetaren överallokerad skalas alla åtaganden ned
     * med "scale" så att summan aldrig blir mer än de timmar personen faktiskt har.
     */
    function workerCapacity(workerId, period) {
      var key = workerId + '|' + period.start + '|' + period.end;
      if (workerCache.has(key)) return workerCache.get(key);
      var w = get('workers', workerId);
      if (!w) return null;
      var baseWeek = w.baseHoursPerWeek || 0;
      var ohWeek = overheadPerWeek(w);
      var availWeek = Math.max(0, baseWeek - ohWeek);
      var base = weekToPeriod(baseWeek, period);
      var overhead = weekToPeriod(ohWeek, period);
      var available = Math.max(0, base - overhead);
      var wh = workerHours(workerId, period);
      var teams = workerTeams(workerId).map(function (x) {
        var hours = (available * x.tw.allocation) / 100;
        /* Med epiker: personens tid i teamet (efter nedskalning och teamavdrag) gånger teamets beläggning. */
        var loaded = epicMode
          ? memberLoaded(x.tw, hours * wh.scale * (1 - teamReductionShare(x.team.id, period).share), period)
          : (hours * (x.tw.plannedLoad || 0)) / 100;
        return { tw: x.tw, team: x.team, hours: hours, loaded: loaded };
      });
      var roles = workerDomainRoles(workerId).map(function (r) {
        return { role: r, hours: monthlyHoursInPeriod(r.ext.hoursPerMonth || 0, r.ext.from, r.ext.to, period) };
      });
      var teamHours = U.sum(teams, function (t) { return t.hours; });
      var domainHours = U.sum(roles, function (r) { return r.hours; });
      var committed = teamHours + domainHours;
      var loaded = U.sum(teams, function (t) { return t.loaded; }) + domainHours;
      var result = {
        worker: w,
        baseWeek: baseWeek,
        overheadWeek: ohWeek,
        availableWeek: availWeek,
        base: base,
        overhead: overhead,
        available: available,
        teams: teams,
        roles: roles,
        teamHours: teamHours,
        domainHours: domainHours,
        committed: committed,
        allocationPct: available ? (committed / available) * 100 : 0,
        scale: committed > available ? available / committed : 1,
        unallocated: Math.max(0, available - committed),
        loaded: loaded,
        loadPct: available ? (loaded / available) * 100 : 0
      };
      workerCache.set(key, result);
      return result;
    }

    function summarize(items) {
      var capacity = U.sum(items, function (x) { return x.capacity; });
      var loaded = U.sum(items, function (x) { return x.loaded; });
      return { capacity: capacity, loaded: loaded, free: capacity - loaded, loadPct: capacity ? (loaded / capacity) * 100 : 0 };
    }

    function aggregateBy(facts, keyFn, metaFn) {
      var groups = U.groupBy(facts, keyFn);
      return Array.from(groups.entries()).map(function (entry) {
        var s = summarize(entry[1]);
        var people = new Set(entry[1].map(function (f) { return f.workerId; }).filter(Boolean));
        return Object.assign({ key: entry[0], people: people.size }, metaFn(entry[1][0]), s);
      });
    }

    /* Fakta per team-medlem och kompetens: motsvarar CapacitySummary i datamodellen. */
    function teamFacts(teamId, period) {
      var red = teamReductionShare(teamId, period);
      var team = get('teams', teamId);
      var bd = teamPrimaryDomain(teamId, 'business');
      var it = teamPrimaryDomain(teamId, 'it');
      var dd = teamDeliveryDomain(teamId);
      var facts = [];
      var cl = epicMode ? teamCategoryLoad(teamId, period) : null;
      teamMembers(teamId).forEach(function (m) {
        var wc = workerCapacity(m.worker.id, period);
        var gross = ((wc.available * m.tw.allocation) / 100) * wc.scale;
        var cap = gross * (1 - red.share);
        var loaded = memberLoaded(m.tw, cap, period);
        var comps = attributionCompetences(m.worker.id);
        comps.forEach(function (c) {
          /* Med epiker får varje kompetens beläggningen för sitt område, inte ett snitt för personen. */
          var compLoaded = cl ? (cap / comps.length) * (cl.ratio[catOf(c)] || 0) : loaded / comps.length;
          facts.push({
            source: 'team',
            teamId: teamId,
            teamName: team ? team.name : '',
            deliveryDomainId: dd ? dd.id : null,
            businessDomainId: bd ? bd.id : null,
            itDomainId: it ? it.id : null,
            workerId: m.worker.id,
            competenceId: c.id,
            competence: c,
            capacity: cap / comps.length,
            loaded: compLoaded
          });
        });
      });
      /* Arbete inom ett område som teamet saknar: ingen kapacitet, men belastningen finns. */
      if (cl) {
        cl.rows.filter(function (r) { return r.gap; }).forEach(function (r) {
          facts.push({
            source: 'team', teamId: teamId, teamName: team ? team.name : '',
            deliveryDomainId: dd ? dd.id : null, businessDomainId: bd ? bd.id : null, itDomainId: it ? it.id : null,
            workerId: null,
            competenceId: '_gap_' + r.category,
            competence: { id: '_gap_' + r.category, name: r.category + ' (saknas i teamet)', category: r.category, type: 'it' },
            capacity: 0,
            loaded: r.demand
          });
        });
      }
      return facts;
    }

    function expertFacts(period) {
      var facts = [];
      (db.extendedDomainCompetences || []).forEach(function (x) {
        var w = get('workers', x.workerId);
        var d = get('domains', x.domainId);
        if (!w || !d) return;
        var hours = monthlyHoursInPeriod(x.hoursPerMonth || 0, x.from, x.to, period) * workerCapacity(w.id, period).scale;
        if (!hours) return;
        var dd = deliveryDomainOfDomain(d.id);
        var comps = attributionCompetences(w.id);
        comps.forEach(function (c) {
          facts.push({
            source: 'domain',
            domainId: d.id,
            teamId: null,
            deliveryDomainId: dd ? dd.id : null,
            businessDomainId: d.type === 'business' ? d.id : null,
            itDomainId: d.type === 'it' ? d.id : null,
            workerId: w.id,
            competenceId: c.id,
            competence: c,
            capacity: hours / comps.length,
            loaded: hours / comps.length
          });
        });
      });
      (db.extendedDeliveryCompetences || []).forEach(function (x) {
        var w = get('workers', x.workerId);
        var dd = get('deliveryDomains', x.deliveryDomainId);
        if (!w || !dd) return;
        var hours = monthlyHoursInPeriod(x.hoursPerMonth || 0, x.from, x.to, period) * workerCapacity(w.id, period).scale;
        if (!hours) return;
        var comps = attributionCompetences(w.id);
        comps.forEach(function (c) {
          facts.push({
            source: 'delivery',
            teamId: null,
            deliveryDomainId: dd.id,
            businessDomainId: null,
            itDomainId: null,
            workerId: w.id,
            competenceId: c.id,
            competence: c,
            capacity: hours / comps.length,
            loaded: hours / comps.length
          });
        });
      });
      return facts;
    }

    var factCache = new Map();
    function allFacts(period) {
      var key = period.start + '|' + period.end;
      if (factCache.has(key)) return factCache.get(key);
      var facts = [];
      db.teams.forEach(function (t) {
        facts = facts.concat(teamFacts(t.id, period));
      });
      facts = facts.concat(expertFacts(period));
      factCache.set(key, facts);
      return facts;
    }

    function competenceMeta(f) {
      return { competence: f.competence, name: f.competence.name, category: f.competence.category };
    }

    function categoryMeta(f) {
      return { name: f.competence.category || 'Ospecificerad' };
    }

    function teamCapacity(teamId, period) {
      var red = teamReductionShare(teamId, period);
      var members = teamMembers(teamId).map(function (m) {
        var wc = workerCapacity(m.worker.id, period);
        var gross = ((wc.available * m.tw.allocation) / 100) * wc.scale;
        var cap = gross * (1 - red.share);
        var loaded = memberLoaded(m.tw, cap, period);
        return {
          tw: m.tw,
          worker: m.worker,
          workerCap: wc,
          gross: gross,
          scaled: wc.scale < 1,
          capacity: cap,
          loaded: loaded,
          free: cap - loaded,
          loadPct: memberLoadPct(m.tw, period),
          competences: attributionCompetences(m.worker.id)
        };
      });
      var facts = allFacts(period).filter(function (f) {
        return f.teamId === teamId;
      });
      var s = summarize(members);
      var cl = epicMode ? teamCategoryLoad(teamId, period) : null;
      /* Arbete inom områden som teamet saknar belastar teamet, även om ingen medlem kan bära det. */
      if (cl && cl.gap) {
        s.loaded += cl.gap;
        s.free = s.capacity - s.loaded;
        s.loadPct = s.capacity ? (s.loaded / s.capacity) * 100 : 0;
      }
      return Object.assign(s, {
        period: period,
        reduction: red,
        categories: cl ? cl.rows : [],
        gap: cl ? cl.gap : 0,
        demand: teamDemand(teamId, period),
        loadSource: epicMode ? 'epics' : 'manual',
        members: members,
        headcount: members.length,
        avgAllocation: members.length ? U.sum(members, function (m) { return m.tw.allocation; }) / members.length : 0,
        byCompetence: aggregateBy(facts, function (f) { return f.competenceId; }, competenceMeta).sort(function (a, b) { return b.capacity - a.capacity; }),
        byCategory: aggregateBy(facts, function (f) { return f.competence.category || 'Ospecificerad'; }, categoryMeta).sort(function (a, b) { return b.capacity - a.capacity; })
      });
    }

    /* Domänens kapacitet: team med domänen som primär + domänmolnets kompetenser. */
    function domainCapacity(domainId, period) {
      var d = get('domains', domainId);
      var key = d && d.type === 'it' ? 'itDomainId' : 'businessDomainId';
      var facts = allFacts(period).filter(function (f) {
        return f[key] === domainId && (f.source === 'team' || f.domainId === domainId);
      });
      return domainSummary(facts);
    }

    function deliveryDomainCapacity(ddId, period) {
      var facts = allFacts(period).filter(function (f) {
        return f.deliveryDomainId === ddId;
      });
      return domainSummary(facts);
    }

    function domainSummary(facts) {
      var s = summarize(facts);
      var teamIds = new Set(facts.filter(function (f) { return f.teamId; }).map(function (f) { return f.teamId; }));
      var byTeam = aggregateBy(
        facts,
        function (f) { return f.teamId || '_cloud_' + (f.domainId || f.deliveryDomainId); },
        function (f) {
          if (f.teamId) return { team: get('teams', f.teamId), name: f.teamName, source: 'team' };
          if (f.source === 'domain') {
            var dm = get('domains', f.domainId);
            return { team: null, name: 'Domänmoln: ' + (dm ? dm.name : ''), source: 'domain' };
          }
          return { team: null, name: 'Leveransdomänens nyckelroller', source: 'delivery' };
        }
      ).sort(function (a, b) {
        if (a.source !== b.source) return a.source === 'team' ? -1 : 1;
        return b.capacity - a.capacity;
      });
      return Object.assign(s, {
        headcount: new Set(facts.map(function (f) { return f.workerId; })).size,
        teamCount: teamIds.size,
        byTeam: byTeam,
        byCompetence: aggregateBy(facts, function (f) { return f.competenceId; }, competenceMeta).sort(function (a, b) { return b.capacity - a.capacity; })
      });
    }

    function domainHeadcount(domainId) {
      var people = new Set();
      teamsOfDomain(domainId).forEach(function (t) {
        if (t.relationship !== 'primary') return;
        teamMembers(t.team.id).forEach(function (m) { people.add(m.worker.id); });
      });
      domainExperts(domainId).forEach(function (x) { people.add(x.worker.id); });
      return people.size;
    }

    function deliveryDomainHeadcount(ddId) {
      var people = new Set();
      teamsOfDeliveryDomain(ddId).forEach(function (t) {
        teamMembers(t.id).forEach(function (m) { people.add(m.worker.id); });
      });
      db.domains.forEach(function (d) {
        var dd = deliveryDomainOfDomain(d.id);
        if (!dd || dd.id !== ddId) return;
        domainExperts(d.id).forEach(function (x) { people.add(x.worker.id); });
      });
      deliveryDomainExperts(ddId).forEach(function (x) { people.add(x.worker.id); });
      return people.size;
    }

    function orgCapacity(period) {
      return summarize(allFacts(period));
    }

    /* ----- Rapport: kapacitet per grupp och kompetens, denna och nästa period ----- */

    var LEVEL_KEYS = {
      team: 'teamId',
      business: 'businessDomainId',
      it: 'itDomainId',
      delivery: 'deliveryDomainId'
    };

    function groupName(level, f) {
      /* Per team samlas domänmolnen och nyckelrollerna i var sin grupp. De är inte team. */
      if (level === 'team') {
        if (f.teamId) return f.teamName;
        return f.source === 'domain' ? 'Domänmoln' : 'Nyckelroller';
      }
      var coll = level === 'delivery' ? 'deliveryDomains' : 'domains';
      var id = f[LEVEL_KEYS[level]];
      var x = id ? get(coll, id) : null;
      if (x) return x.name;
      return { business: 'Utan verksamhetsdomän', it: 'Utan IT-domän', delivery: 'Utan leveransdomän' }[level];
    }

    function groupKey(level, f) {
      if (level === 'team' && !f.teamId) return f.source === 'domain' ? '_cloud' : '_roles';
      return f[LEVEL_KEYS[level]] || '_none';
    }

    function report(opts) {
      var period = opts.period;
      var next = nextPeriod(period);
      var level = opts.level || 'team';
      var flt = opts.filters || {};
      function pass(f) {
        if (flt.deliveryDomainId && f.deliveryDomainId !== flt.deliveryDomainId) return false;
        if (flt.businessDomainId && f.businessDomainId !== flt.businessDomainId) return false;
        if (flt.itDomainId && f.itDomainId !== flt.itDomainId) return false;
        if (flt.teamId && f.teamId !== flt.teamId) return false;
        if (flt.competenceId && f.competenceId !== flt.competenceId) return false;
        if (flt.competenceCategory && (f.competence.category || '') !== flt.competenceCategory) return false;
        if (flt.source === 'team' && f.source !== 'team') return false;
        return true;
      }
      var cur = allFacts(period).filter(pass);
      var nxt = allFacts(next).filter(pass);

      function rowsFor(curFacts, nxtFacts, keyFn, nameFn) {
        var map = new Map();
        function slot(f) {
          var k = keyFn(f);
          if (!map.has(k)) map.set(k, { key: k, name: nameFn(f), capacity: 0, loaded: 0, nextCapacity: 0, people: new Set() });
          return map.get(k);
        }
        curFacts.forEach(function (f) {
          var s = slot(f);
          s.capacity += f.capacity;
          s.loaded += f.loaded;
          if (f.workerId) s.people.add(f.workerId);
        });
        nxtFacts.forEach(function (f) {
          var s = slot(f);
          s.nextCapacity += f.capacity;
          if (f.workerId) s.people.add(f.workerId);
        });
        return Array.from(map.values()).map(finishRow);
      }

      function finishRow(r) {
        r.free = r.capacity - r.loaded;
        r.loadPct = r.capacity ? (r.loaded / r.capacity) * 100 : 0;
        r.change = r.nextCapacity - r.capacity;
        r.changePct = r.capacity ? (r.change / r.capacity) * 100 : 0;
        r.peopleCount = r.people instanceof Set ? r.people.size : r.peopleCount;
        delete r.people;
        return r;
      }

      function compKey(f) { return f.competenceId; }
      function compName(f) { return f.competence.name; }

      var groups;
      if (opts.flat) {
        groups = [];
      } else {
        var gmap = new Map();
        cur.concat(nxt).forEach(function (f) {
          var k = groupKey(level, f);
          if (!gmap.has(k)) gmap.set(k, { key: k, name: groupName(level, f), cur: [], nxt: [] });
        });
        cur.forEach(function (f) { gmap.get(groupKey(level, f)).cur.push(f); });
        nxt.forEach(function (f) { gmap.get(groupKey(level, f)).nxt.push(f); });
        groups = Array.from(gmap.values()).map(function (g) {
          var rows = rowsFor(g.cur, g.nxt, compKey, compName).sort(function (a, b) { return b.capacity - a.capacity; });
          var total = rowsFor(g.cur, g.nxt, function () { return 'total'; }, function () { return 'Totalt'; })[0];
          return { key: g.key, name: g.name, rows: rows, total: total, isCloud: g.key === '_cloud' || g.key === '_roles', isOther: g.key === '_none' };
        });
        groups.sort(function (a, b) {
          if (a.isOther !== b.isOther) return a.isOther ? 1 : -1;
          if (a.isCloud !== b.isCloud) return a.isCloud ? 1 : -1;
          return a.name.localeCompare(b.name, 'sv');
        });
      }
      var byCompetence = rowsFor(cur, nxt, compKey, compName).sort(function (a, b) { return b.capacity - a.capacity; });
      var grand = rowsFor(cur, nxt, function () { return 'total'; }, function () { return 'Totalt'; })[0] || finishRow({ key: 'total', name: 'Totalt', capacity: 0, loaded: 0, nextCapacity: 0, people: new Set() });
      return { period: period, next: next, level: level, groups: groups, byCompetence: byCompetence, total: grand };
    }

    /* ----- Signaler: det som behöver uppmärksamhet ----- */

    function signals(period) {
      var out = [];
      db.workers.forEach(function (w) {
        var wc = workerCapacity(w.id, period);
        if (wc.allocationPct > 100.5) {
          out.push({
            kind: 'overallocated',
            severity: 'critical',
            title: w.name + ' är allokerad till ' + Math.round(wc.allocationPct) + ' %',
            detail: 'Team och domänroller kräver ' + U.fmtH(wc.committed) + ' men tillgänglig kapacitet är ' + U.fmtH(wc.available) + '.',
            ref: { page: 'workers', id: w.id }
          });
        } else if (wc.committed === 0) {
          out.push({
            kind: 'unallocated',
            severity: 'info',
            title: w.name + ' är inte allokerad',
            detail: 'Arbetaren saknar team och domänroll. Kapaciteten syns inte i någon domän.',
            ref: { page: 'workers', id: w.id }
          });
        }
      });
      db.teams.forEach(function (t) {
        var tc = teamCapacity(t.id, period);
        if (tc.capacity > 0 && tc.loadPct > 100.5) {
          out.push({
            kind: 'overplanned',
            severity: 'critical',
            title: t.name + ' är överplanerat: ' + Math.round(tc.loadPct) + ' %',
            detail: 'Beslutat arbete kräver ' + U.fmtH(tc.loaded - tc.capacity) + ' mer än teamets kapacitet i perioden.',
            ref: { page: 'teams', id: t.id }
          });
        } else if (tc.capacity > 0 && tc.loadPct >= 90) {
          out.push({
            kind: 'highload',
            severity: 'warning',
            title: t.name + ' har ' + Math.round(tc.loadPct) + ' % beläggning',
            detail: 'Endast ' + U.fmtH(tc.free) + ' ledigt av ' + U.fmtH(tc.capacity) + ' i perioden.',
            ref: { page: 'teams', id: t.id }
          });
        }
        if (epicMode && !tc.capacity && tc.demand.hours > 0) {
          out.push({
            kind: 'overplanned',
            severity: 'critical',
            title: t.name + ' har arbete men ingen kapacitet',
            detail: U.fmtH(tc.demand.hours) + ' beslutat arbete i perioden, men teamet har inga medlemmar med tid.',
            ref: { page: 'teams', id: t.id }
          });
        }
        /* Varje team har en förvaltningsepik. Utan den syns inte drift, utbildning och kompetensspridning. */
        if (epicMode && tc.capacity > 0) {
          var mt = teamMaintenance(t.id, period);
          if (!mt.length) {
            out.push({
              kind: 'nomaintenance',
              severity: 'warning',
              title: t.name + ' saknar förvaltning',
              detail: 'Teamet har ingen förvaltningsepik i perioden. Drift, utbildning och kompetensspridning syns då inte i beläggningen.',
              ref: { page: 'teams', id: t.id }
            });
          } else if (mt.length > 1) {
            out.push({
              kind: 'structure',
              severity: 'warning',
              title: t.name + ' har ' + mt.length + ' förvaltningsepiker',
              detail: 'Förvaltning är en epik per team med en löpande ram. Slå ihop ' + mt.map(function (x) { return x.name; }).join(' och ') + '.',
              ref: { page: 'teams', id: t.id }
            });
          }
        }
        /* Flaskhalsar: ett kompetensområde kan vara fullt även när teamet som helhet har tid. */
        if (epicMode && tc.capacity > 0) {
          tc.categories.forEach(function (r) {
            if (r.gap) {
              out.push({
                kind: 'gap',
                severity: 'critical',
                title: t.name + ' saknar ' + r.category,
                detail: U.fmtH(r.demand) + ' beslutat arbete kräver ' + r.category + ', men ingen i teamet har det som primär kompetens.' + freeElsewhere(r.category, t.id, period),
                ref: { page: 'teams', id: t.id }
              });
            } else if (r.loadPct > 100.5) {
              var room = tc.categories.filter(function (x) { return !x.gap && x.free > 10; }).slice(0, 2);
              out.push({
                kind: 'bottleneck',
                severity: 'critical',
                title: r.category + ' är en flaskhals i ' + t.name + ': ' + Math.round(r.loadPct) + ' %',
                detail: 'Arbetet kräver ' + U.fmtH(-r.free) + ' mer än teamet har inom ' + r.category + '.' +
                  (room.length ? ' Teamet har ledigt i ' + room.map(function (x) { return x.category + ' ' + U.fmtH(x.free); }).join(' och ') + '.' : '') +
                  freeElsewhere(r.category, t.id, period),
                ref: { page: 'teams', id: t.id }
              });
            }
          });
        }
        if (!teamPrimaryDomain(t.id, 'business') || !teamPrimaryDomain(t.id, 'it')) {
          out.push({
            kind: 'structure',
            severity: 'warning',
            title: t.name + ' saknar primär ' + (!teamPrimaryDomain(t.id, 'business') ? 'verksamhetsdomän' : 'IT-domän'),
            detail: 'Utan primär domän kan teamets kapacitet inte räknas till rätt leveransdomän.',
            ref: { page: 'teams', id: t.id }
          });
        }
        if (!t.leadId) {
          out.push({ kind: 'structure', severity: 'info', title: t.name + ' saknar teamledare', detail: 'Ansvaret för teamet är inte utpekat.', ref: { page: 'teams', id: t.id } });
        }
      });
      if (epicMode) {
        (db.teamReductions || []).forEach(function (r) {
          if (!isWorkReduction(r.type) || r.to < period.start || r.from > period.end) return;
          var t = get('teams', r.teamId);
          if (!t) return;
          out.push({
            kind: 'double',
            severity: 'warning',
            title: r.type + ' i ' + t.name + ' är arbete, men ligger som avdrag',
            detail: 'Avdrag är tid som inte finns, till exempel frånvaro. Utbildning och underhåll hör till teamets förvaltning, annat arbete till en epik. Annars kan samma tid räknas två gånger: först som minskad kapacitet, sedan som belastning.',
            ref: { page: 'teams', id: t.id }
          });
        });
      }
      /* Beroenden med risk, för beslutat arbete som pågår nu eller senare. */
      (db.epics || []).forEach(function (ep) {
        if (!COUNTS[ep.status] || ep.status === 'done' || ep.to < period.start || !(ep.dependsOn || []).length) return;
        var risky = epicDependencies(ep.id, period).filter(function (d) { return d.risks.length; });
        if (!risky.length) return;
        var first = risky[0];
        out.push({
          kind: 'dependency',
          severity: 'warning',
          title: ep.name + ' väntar på ' + first.epic.name + (risky.length > 1 ? ' och ' + (risky.length - 1) + ' till' : ''),
          detail: first.risks.map(function (r) { return r.text; }).join('. ') + '.',
          ref: { page: 'epics', id: ep.id }
        });
      });
      (db.epics || []).forEach(function (ep) {
        if (ep.type !== 'development' || ep.initiativeId || !COUNTS[ep.status] || !epicHoursInPeriod(ep, period)) return;
        var t = get('teams', ep.teamId);
        out.push({
          kind: 'untraced',
          severity: 'info',
          title: ep.name + ' saknar initiativ',
          detail: 'Utvecklingsarbete i ' + (t ? t.name : 'okänt team') + ' som inte går att spåra till ett beslutat initiativ.',
          ref: { page: 'epics', id: ep.id }
        });
      });
      db.competences.forEach(function (c) {
        var holders = competenceHolders(c.id).filter(function (h) { return h.wc.level >= 3; });
        var any = competenceHolders(c.id);
        if (any.length > 0 && holders.length === 1) {
          out.push({
            kind: 'keyperson',
            severity: 'warning',
            title: c.name + ': bara en person på nivå 3–4',
            detail: holders[0].worker.name + ' bär kunskapen. ' + (any.length - 1 ? (any.length - 1) + ' till har kompetensen på lägre nivå.' : 'Ingen annan har kompetensen.') + ' Kompetensspridning planeras inom teamets förvaltning.',
            ref: { page: 'competences', id: c.id }
          });
        }
      });
      db.systems.forEach(function (s) {
        if (!systemResponsibleTeam(s.id)) {
          out.push({ kind: 'structure', severity: 'warning', title: s.name + ' saknar ansvarigt team', detail: 'Ingen har förvaltningsansvar för systemet.', ref: { page: 'systems', id: s.id } });
        }
      });
      db.domains.concat(db.deliveryDomains).forEach(function (d) {
        if (!d.ownerId) {
          var isDd = !d.type;
          out.push({
            kind: 'structure',
            severity: 'info',
            title: d.name + ' saknar ägare',
            detail: 'Mandatet för ' + (isDd ? 'leveransdomänen' : 'domänen') + ' är inte utpekat.',
            ref: { page: isDd ? 'deliveryDomains' : d.type === 'it' ? 'itDomains' : 'businessDomains', id: d.id }
          });
        }
      });
      var rank = { critical: 0, warning: 1, info: 2 };
      return out.sort(function (a, b) { return rank[a.severity] - rank[b.severity]; });
    }

    /* ---------- Insikter: KPI:er, mätvärden och kopplingar ---------- */

    function sumCap(facts, pred) {
      return U.sum(facts.filter(pred), function (f) { return f.capacity; });
    }

    function evaluate(value, target) {
      if (!target || (target.min === undefined && target.max === undefined)) return 'none';
      if (target.min !== undefined && value < target.min - 1e-9) return 'below';
      if (target.max !== undefined && value > target.max + 1e-9) return 'above';
      return 'ok';
    }

    /* Modellens täckning: hur stor andel av de kopplingar som ska finnas som faktiskt finns. */
    function coverage() {
      var checks = [];
      db.teams.forEach(function (t) {
        checks.push({ ok: !!teamPrimaryDomain(t.id, 'business'), what: 'Team med primär verksamhetsdomän' });
        checks.push({ ok: !!teamPrimaryDomain(t.id, 'it'), what: 'Team med primär IT-domän' });
        checks.push({ ok: !!t.leadId, what: 'Team med teamledare' });
      });
      db.domains.forEach(function (d) {
        checks.push({ ok: !!d.ownerId, what: 'Domäner med ägare' });
        checks.push({ ok: !!deliveryDomainOfDomain(d.id), what: 'Domäner i en leveransdomän' });
      });
      db.deliveryDomains.forEach(function (d) {
        checks.push({ ok: !!d.ownerId, what: 'Leveransdomäner med ägare' });
      });
      db.systems.forEach(function (x) {
        checks.push({ ok: !!systemResponsibleTeam(x.id), what: 'System med ansvarigt team' });
        checks.push({ ok: !!systemPrimaryItDomain(x.id), what: 'System med primär IT-domän' });
      });
      var passed = checks.filter(function (c) { return c.ok; }).length;
      var byWhat = U.groupBy(checks, function (c) { return c.what; });
      return {
        pct: checks.length ? (passed / checks.length) * 100 : 100,
        passed: passed,
        total: checks.length,
        parts: Array.from(byWhat.entries()).map(function (e) {
          return { what: e[0], ok: e[1].filter(function (c) { return c.ok; }).length, total: e[1].length };
        })
      };
    }

    function kpis(period) {
      var next = nextPeriod(period);
      var facts = allFacts(period);
      var org = summarize(facts);
      var nextCap = summarize(allFacts(next)).capacity;
      var sig = signals(period);
      var targets = Object.assign({}, DEFAULT_TARGETS, settings.kpiTargets || {});
      var total = org.capacity || 1;
      function workerOf(f) { return get('workers', f.workerId) || {}; }
      var producing = sumCap(facts, function (f) { var t = f.teamId && get('teams', f.teamId); return t && t.category === 'producing'; });
      var consultant = sumCap(facts, function (f) { var w = workerOf(f); return w.type !== 'ai' && w.consultant; });
      var ai = sumCap(facts, function (f) { return workerOf(f).type === 'ai'; });
      var cov = coverage();
      var list = [
        { key: 'load', label: 'Beläggning', value: org.loadPct, unit: '%', scale: [0, 100],
          definition: 'Beslutat arbete delat med kapacitet. För lågt betyder outnyttjad tid, för högt betyder att ingen marginal finns.' },
        { key: 'overallocated', label: 'Överallokerade arbetare', value: sig.filter(function (x) { return x.kind === 'overallocated'; }).length, unit: 'st', severity: 'critical',
          definition: 'Arbetare vars team och domänroller kräver mer tid än de har.' },
        { key: 'producingShare', label: 'Kapacitet i producerande team', value: (producing / total) * 100, unit: '%', scale: [0, 100],
          definition: 'Andel av kapaciteten som ligger i team med en primär verksamhetsdomän. Resten är stödjande team, domänmoln och nyckelroller.' },
        { key: 'consultantShare', label: 'Konsultandel', value: (consultant / total) * 100, unit: '%', scale: [0, 100],
          definition: 'Andel av kapaciteten som kommer från konsulter. Hög andel gör kompetensen mer flyktig.' },
        { key: 'keypersons', label: 'Nyckelpersonsberoenden', value: sig.filter(function (x) { return x.kind === 'keyperson'; }).length, unit: 'st',
          definition: 'Kompetenser där bara en person har nivå 3–4.' },
        { key: 'coverage', label: 'Modellens täckning', value: cov.pct, unit: '%', scale: [0, 100], detail: cov,
          definition: 'Andel av de kopplingar som ska finnas som faktiskt är registrerade: ägare, teamledare, primära domäner och ansvariga team.' },
        { key: 'nextChange', label: 'Förändring nästa period', value: org.capacity ? ((nextCap - org.capacity) / org.capacity) * 100 : 0, unit: '%', scale: [-30, 30],
          definition: 'Hur grundkapaciteten förändras till nästa period, av arbetsdagar, avdrag och domänroller.' },
        { key: 'aiShare', label: 'AI-andel', value: (ai / total) * 100, unit: '%', scale: [0, 100],
          definition: 'Andel av kapaciteten som kommer från AI-arbetare. Inget mål satt i Prototyp 1.' }
      ];
      list.forEach(function (k) {
        k.target = targets[k.key] || {};
        k.status = evaluate(k.value, k.target);
        if (!k.scale) {
          var hi = Math.max(5, Math.ceil(k.value * 1.4), (k.target.max || 0) + 5);
          k.scale = [0, hi];
        }
        if (k.status === 'below' || k.status === 'above') k.severity = k.severity || 'warning';
        else k.severity = null;
      });
      return list;
    }

    function capacityTrend(period, back, forward) {
      var periods = [period];
      var p = period;
      for (var i = 0; i < back; i++) { p = prevPeriod(p); periods.unshift(p); }
      p = period;
      for (var j = 0; j < forward; j++) { p = nextPeriod(p); periods.push(p); }
      return periods.map(function (x) {
        var s = summarize(allFacts(x));
        return { period: x, capacity: s.capacity, current: x.start === period.start, future: x.start > period.start };
      });
    }

    /* Kompetensmatris: timmar per rad (team eller leveransdomän) och kompetensområde. */
    function competenceMatrix(period, rowsBy) {
      var facts = allFacts(period).filter(function (f) { return rowsBy === 'delivery' || f.source === 'team'; });
      var rowKey = rowsBy === 'delivery' ? 'deliveryDomainId' : 'teamId';
      var rowColl = rowsBy === 'delivery' ? 'deliveryDomains' : 'teams';
      var cells = new Map();
      var rowTotals = new Map();
      var colTotals = new Map();
      facts.forEach(function (f) {
        var r = f[rowKey] || '_none';
        var c = f.competence.category || 'Ospecificerad';
        var k = r + '|' + c;
        cells.set(k, (cells.get(k) || 0) + f.capacity);
        rowTotals.set(r, (rowTotals.get(r) || 0) + f.capacity);
        colTotals.set(c, (colTotals.get(c) || 0) + f.capacity);
      });
      var cols = Array.from(colTotals.entries()).sort(function (a, b) { return b[1] - a[1]; }).map(function (e) { return { name: e[0], total: e[1] }; });
      var rows = Array.from(rowTotals.entries()).sort(function (a, b) { return b[1] - a[1]; }).map(function (e) {
        var rec = get(rowColl, e[0]);
        return {
          id: e[0],
          name: rec ? rec.name : 'Utan leveransdomän',
          total: e[1],
          values: cols.map(function (c) { return cells.get(e[0] + '|' + c.name) || 0; })
        };
      });
      var max = 0;
      rows.forEach(function (r) { r.values.forEach(function (v) { if (v > max) max = v; }); });
      return { rows: rows, cols: cols, max: max, total: U.sum(rows, function (r) { return r.total; }) };
    }

    /* Kompetensdjup: antal personer per kompetensområde och högsta nivå inom området. */
    function competenceDepth() {
      var best = new Map();
      db.workerCompetences.forEach(function (wc) {
        var c = get('competences', wc.competenceId);
        if (!c || !get('workers', wc.workerId)) return;
        var k = (c.category || 'Ospecificerad') + '|' + wc.workerId;
        best.set(k, Math.max(best.get(k) || 0, wc.level));
      });
      var cats = new Map();
      best.forEach(function (level, k) {
        var cat = k.split('|')[0];
        if (!cats.has(cat)) cats.set(cat, [0, 0, 0, 0]);
        cats.get(cat)[level - 1]++;
      });
      return Array.from(cats.entries()).map(function (e) {
        return { category: e[0], levels: e[1], total: U.sum(e[1]), advanced: e[1][2] + e[1][3] };
      }).sort(function (a, b) { return b.advanced - a.advanced || b.total - a.total; });
    }

    /* Kapacitetens sammansättning efter källa och anställningsform. */
    function composition(period) {
      var facts = allFacts(period);
      var total = summarize(facts).capacity || 1;
      function part(label, pred) {
        var v = sumCap(facts, pred);
        return { label: label, value: v, pct: (v / total) * 100 };
      }
      function teamCat(f) { var t = f.teamId && get('teams', f.teamId); return t ? t.category : null; }
      function worker(f) { return get('workers', f.workerId) || {}; }
      return {
        source: [
          part('Producerande team', function (f) { return teamCat(f) === 'producing'; }),
          part('Stödjande team', function (f) { return teamCat(f) === 'supporting'; }),
          part('Domänmoln', function (f) { return f.source === 'domain'; }),
          part('Nyckelroller', function (f) { return f.source === 'delivery'; })
        ],
        employment: [
          part('Anställda', function (f) { var w = worker(f); return w.type !== 'ai' && !w.consultant; }),
          part('Konsulter', function (f) { var w = worker(f); return w.type !== 'ai' && w.consultant; }),
          part('AI', function (f) { return worker(f).type === 'ai'; })
        ]
      };
    }

    /*
     * Kopplingsgraf i fem kolumner: leveransdomän → verksamhetsdomän → team → system → IT-domän.
     * Kedjan följer verkliga kopplingar: team kopplas till de system de arbetar med, och system
     * till sin IT-domän. Noderna sorteras så att kopplade noder hamnar nära varandra.
     */
    function connectionGraph() {
      var edges = [];
      function node(col, rec, kind) {
        return { id: col + ':' + rec.id, refId: rec.id, col: col, name: rec.name, kind: kind, issues: [] };
      }
      db.domainClusters.forEach(function (c) {
        var d = get('domains', c.domainId);
        if (d && d.type === 'business') edges.push({ from: 'dd:' + c.deliveryDomainId, to: 'bd:' + c.domainId, rel: c.relationship });
      });
      db.teamDomains.forEach(function (td) {
        var d = get('domains', td.domainId);
        if (d && d.type === 'business') edges.push({ from: 'bd:' + d.id, to: 'team:' + td.teamId, rel: td.relationship });
      });
      db.teamSystems.forEach(function (ts) {
        edges.push({ from: 'team:' + ts.teamId, to: 'system:' + ts.systemId, rel: ts.objective === 'owner' ? 'primary' : 'supportive', label: ts.objective === 'owner' ? 'Ansvarar' : 'Bidrar' });
      });
      db.itDomainSystems.forEach(function (l) {
        edges.push({ from: 'system:' + l.systemId, to: 'it:' + l.domainId, rel: l.relationship });
      });

      /* Barycentrisk ordning: varje nod placeras nära medelpositionen för noderna den kopplas från. */
      function orderBy(recs, col, kind, upstream) {
        var nodes = recs.map(function (r) { return node(col, r, kind); });
        var pos = new Map();
        upstream.forEach(function (n, i) { pos.set(n.id, i); });
        nodes.forEach(function (n) {
          var ins = edges.filter(function (e) { return e.to === n.id && pos.has(e.from); });
          var prim = ins.filter(function (e) { return e.rel === 'primary'; });
          var use = prim.length ? prim : ins;
          n.rank = use.length ? U.sum(use, function (e) { return pos.get(e.from); }) / use.length : upstream.length + 1;
        });
        return nodes.sort(function (a, b) { return a.rank - b.rank || a.name.localeCompare(b.name, 'sv'); });
      }
      var dd = db.deliveryDomains.slice().sort(U.byName).map(function (d) { return node('dd', d, 'deliveryDomains'); });
      var bd = orderBy(db.domains.filter(function (d) { return d.type === 'business'; }), 'bd', 'businessDomains', dd);
      var team = orderBy(db.teams, 'team', 'teams', bd);
      var system = orderBy(db.systems, 'system', 'systems', team);
      var it = orderBy(db.domains.filter(function (d) { return d.type === 'it'; }), 'it', 'itDomains', system);

      /* Luckor: noder som saknar en koppling de borde ha. */
      function has(id, dir, rel) {
        return edges.some(function (e) { return (dir === 'in' ? e.to : e.from) === id && (!rel || e.rel === rel); });
      }
      dd.forEach(function (n) { if (!has(n.id, 'out')) n.issues.push('Inga verksamhetsdomäner'); });
      bd.forEach(function (n) {
        if (!has(n.id, 'in')) n.issues.push('Ingen leveransdomän');
        if (!has(n.id, 'out', 'primary')) n.issues.push('Inget team har domänen som primär');
      });
      team.forEach(function (n) {
        if (!has(n.id, 'in', 'primary')) n.issues.push('Ingen primär verksamhetsdomän');
        if (!teamPrimaryDomain(n.refId, 'it')) n.issues.push('Ingen primär IT-domän');
        if (!has(n.id, 'out')) n.issues.push('Arbetar inte med något system');
      });
      system.forEach(function (n) {
        if (!has(n.id, 'in', 'primary')) n.issues.push('Inget ansvarigt team');
        if (!has(n.id, 'out')) n.issues.push('Ingen IT-domän');
      });
      it.forEach(function (n) { if (!has(n.id, 'in')) n.issues.push('Inga system'); });
      return {
        columns: [
          { key: 'dd', label: 'Leveransdomän', nodes: dd },
          { key: 'bd', label: 'Verksamhetsdomän', nodes: bd },
          { key: 'team', label: 'Team', nodes: team },
          { key: 'system', label: 'System', nodes: system },
          { key: 'it', label: 'IT-domän', nodes: it }
        ],
        edges: edges
      };
    }

    return {
      db: db,
      get: get,
      where: where,
      clustersOfDomain: clustersOfDomain,
      deliveryDomainOfDomain: deliveryDomainOfDomain,
      domainsOfDeliveryDomain: domainsOfDeliveryDomain,
      teamDomains: teamDomains,
      teamPrimaryDomain: teamPrimaryDomain,
      teamDeliveryDomain: teamDeliveryDomain,
      teamsOfDomain: teamsOfDomain,
      teamsOfDeliveryDomain: teamsOfDeliveryDomain,
      teamMembers: teamMembers,
      workerTeams: workerTeams,
      workerCompetences: workerCompetences,
      competenceHolders: competenceHolders,
      attributionCompetences: attributionCompetences,
      teamSystems: teamSystems,
      systemTeams: systemTeams,
      systemResponsibleTeam: systemResponsibleTeam,
      systemItDomains: systemItDomains,
      systemPrimaryItDomain: systemPrimaryItDomain,
      itDomainSystems: itDomainSystems,
      systemsOfDomain: systemsOfDomain,
      systemsOfDeliveryDomain: systemsOfDeliveryDomain,
      domainExperts: domainExperts,
      deliveryDomainExperts: deliveryDomainExperts,
      workerDomainRoles: workerDomainRoles,
      workerPrimaryDomains: workerPrimaryDomains,
      overheadPerWeek: overheadPerWeek,
      teamReductionShare: teamReductionShare,
      workerCapacity: workerCapacity,
      teamCapacity: teamCapacity,
      teamDemand: teamDemand,
      teamMaintenance: teamMaintenance,
      teamCategoryLoad: teamCategoryLoad,
      orgCategoryLoad: orgCategoryLoad,
      epicDependencies: epicDependencies,
      epicDependents: epicDependents,
      teamSupply: teamSupply,
      initiativeEpics: initiativeEpics,
      initiativeSummary: initiativeSummary,
      workByType: workByType,
      epicMode: epicMode,
      domainCapacity: domainCapacity,
      deliveryDomainCapacity: deliveryDomainCapacity,
      domainHeadcount: domainHeadcount,
      deliveryDomainHeadcount: deliveryDomainHeadcount,
      orgCapacity: orgCapacity,
      allFacts: allFacts,
      report: report,
      signals: signals,
      kpis: kpis,
      coverage: coverage,
      capacityTrend: capacityTrend,
      competenceMatrix: competenceMatrix,
      competenceDepth: competenceDepth,
      composition: composition,
      connectionGraph: connectionGraph
    };
  }

  /*
   * Vad hör till ett val i kopplingskartan? Primära kopplingar följs hela vägen uppåt och nedåt.
   * Stödjande kopplingar visas, men följs inte vidare, så att kartan inte fylls av indirekta samband.
   */
  function connectionFocus(graph, start) {
    var nodes = new Set([start]);
    var edgeIdx = new Set();
    function walk(down) {
      var expanded = new Set([start]);
      var queue = [start];
      while (queue.length) {
        var cur = queue.shift();
        graph.edges.forEach(function (e, i) {
          var a = down ? e.from : e.to;
          var b = down ? e.to : e.from;
          if (a !== cur) return;
          edgeIdx.add(i);
          nodes.add(b);
          if (e.rel === 'primary' && !expanded.has(b)) {
            expanded.add(b);
            queue.push(b);
          }
        });
      }
    }
    walk(true);
    walk(false);
    return { nodes: nodes, edges: edgeIdx };
  }

  /*
   * Arbetstyper och status för epiker. Förslag belastar inte kapaciteten. Klara epiker räknas för
   * den tid de pågick, så att historiken står kvar. Formuläret flyttar slutdatum till i dag när en
   * epik blir klar i förtid, så att den inte belastar framtiden.
   */
  var EPIC_TYPES = [
    { value: 'development', label: 'Utveckling' },
    { value: 'maintenance', label: 'Förvaltning', help: 'Drift, rättningar, utbildning och kompetensspridning. En per team, med löpande ram per månad.' },
    { value: 'investigation', label: 'Utredning' }
  ];
  var EPIC_STATUS = [
    { value: 'proposed', label: 'Förslag', counts: false },
    { value: 'planned', label: 'Planerad', counts: true },
    { value: 'active', label: 'Pågår', counts: true },
    { value: 'done', label: 'Klar', counts: true }
  ];
  var COUNTS = {};
  EPIC_STATUS.forEach(function (x) { COUNTS[x.value] = x.counts; });

  /*
   * Ett teamavdrag ska vara tid som inte finns, till exempel frånvaro. Arbete, som utbildning,
   * systembyte eller underhåll, är en epik. Annars räknas samma tid två gånger: först som minskad
   * kapacitet och sedan som belastning.
   */
  var WORK_REDUCTION = /utbild|kurs|system|migrer|underhåll|verktyg|inför|projekt|uppgrader|utveckl|arbete/i;
  function isWorkReduction(type) {
    return WORK_REDUCTION.test(type || '');
  }

  /*
   * Epikens kompetensbehov som andelar som summerar till 1, till exempel Utveckling 0,6, Test 0,25 och
   * Analys 0,15. null betyder att behovet inte är angivet.
   */
  function normNeeds(needs) {
    var list = (needs || []).filter(function (n) { return n && n.category && n.share > 0; });
    var sum = list.reduce(function (a, n) { return a + Number(n.share); }, 0);
    if (!sum) return null;
    return list.map(function (n) { return { category: n.category, share: Number(n.share) / sum }; });
  }

  /* Epikens timmar i en period. Månadsram räknas per månad, totalram fördelas jämnt på arbetsdagarna. */
  function epicHoursInPeriod(epic, period) {
    if (!epic || !epic.hours || !epic.from || !epic.to) return 0;
    if (epic.effort === 'monthly') return monthlyHoursInPeriod(epic.hours, epic.from, epic.to, period);
    var total = workdays(epic.from, epic.to);
    if (!total) return 0;
    return (epic.hours * overlapWorkdays(epic.from, epic.to, period.start, period.end)) / total;
  }

  /* Hela ramen i timmar, oavsett period. */
  function epicFrame(epic) {
    if (!epic || !epic.hours) return 0;
    if (epic.effort === 'monthly') return monthlyHoursInPeriod(epic.hours, epic.from, epic.to, { start: epic.from, end: epic.to });
    return epic.hours;
  }

  return {
    create: create,
    connectionFocus: connectionFocus,
    EPIC_TYPES: EPIC_TYPES,
    EPIC_STATUS: EPIC_STATUS,
    epicCounts: function (status) { return !!COUNTS[status]; },
    isWorkReduction: isWorkReduction,
    normNeeds: normNeeds,
    epicHoursInPeriod: epicHoursInPeriod,
    epicFrame: epicFrame,
    workdays: workdays,
    overlapWorkdays: overlapWorkdays,
    monthlyHoursInPeriod: monthlyHoursInPeriod,
    periodOf: periodOf,
    nextPeriod: nextPeriod,
    prevPeriod: prevPeriod,
    UNSPECIFIED: UNSPECIFIED,
    DEFAULT_TARGETS: DEFAULT_TARGETS
  };
})();

if (typeof module !== 'undefined') module.exports = OOSEngine;
