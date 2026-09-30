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
      label = y + '-Q' + (q + 1);
    } else {
      start = U.toISO(new Date(Date.UTC(y, m, 1)));
      end = lastDayOfMonth(y, m);
      label = U.MONTHS_LONG[m] + ' ' + y;
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    /* inText används mitt i meningar: "i september 2026", "i 2026-Q3". */
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
      var teams = workerTeams(workerId).map(function (x) {
        var hours = (available * x.tw.allocation) / 100;
        return { tw: x.tw, team: x.team, hours: hours, loaded: (hours * (x.tw.plannedLoad || 0)) / 100 };
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
        var people = new Set(entry[1].map(function (f) { return f.workerId; }));
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
      teamMembers(teamId).forEach(function (m) {
        var wc = workerCapacity(m.worker.id, period);
        var gross = ((wc.available * m.tw.allocation) / 100) * wc.scale;
        var cap = gross * (1 - red.share);
        var loaded = (cap * (m.tw.plannedLoad || 0)) / 100;
        var comps = attributionCompetences(m.worker.id);
        comps.forEach(function (c) {
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
            loaded: loaded / comps.length
          });
        });
      });
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
        var loaded = (cap * (m.tw.plannedLoad || 0)) / 100;
        return {
          tw: m.tw,
          worker: m.worker,
          workerCap: wc,
          gross: gross,
          scaled: wc.scale < 1,
          capacity: cap,
          loaded: loaded,
          free: cap - loaded,
          loadPct: m.tw.plannedLoad || 0,
          competences: attributionCompetences(m.worker.id)
        };
      });
      var facts = allFacts(period).filter(function (f) {
        return f.teamId === teamId;
      });
      var s = summarize(members);
      return Object.assign(s, {
        period: period,
        reduction: red,
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
      if (level === 'team') {
        if (f.teamId) return f.teamName;
        if (f.source === 'domain') {
          var d = get('domains', f.domainId);
          return 'Domänmoln: ' + (d ? d.name : '');
        }
        var dd = get('deliveryDomains', f.deliveryDomainId);
        return 'Nyckelroller: ' + (dd ? dd.name : '');
      }
      var coll = level === 'delivery' ? 'deliveryDomains' : 'domains';
      var id = f[LEVEL_KEYS[level]];
      var x = id ? get(coll, id) : null;
      if (x) return x.name;
      return { business: 'Utan verksamhetsdomän', it: 'Utan IT-domän', delivery: 'Utan leveransdomän' }[level];
    }

    function groupKey(level, f) {
      if (level === 'team' && !f.teamId) return '_cloud_' + (f.domainId || 'dd_' + f.deliveryDomainId);
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
          s.people.add(f.workerId);
        });
        nxtFacts.forEach(function (f) {
          var s = slot(f);
          s.nextCapacity += f.capacity;
          s.people.add(f.workerId);
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
          return { key: g.key, name: g.name, rows: rows, total: total, isCloud: String(g.key).indexOf('_cloud_') === 0, isOther: g.key === '_none' };
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
        if (tc.capacity > 0 && tc.loadPct >= 90) {
          out.push({
            kind: 'highload',
            severity: 'warning',
            title: t.name + ' har ' + Math.round(tc.loadPct) + ' % beläggning',
            detail: 'Endast ' + U.fmtH(tc.free) + ' ledigt av ' + U.fmtH(tc.capacity) + ' i perioden.',
            ref: { page: 'teams', id: t.id }
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
      db.competences.forEach(function (c) {
        var holders = competenceHolders(c.id).filter(function (h) { return h.wc.level >= 3; });
        var any = competenceHolders(c.id);
        if (any.length > 0 && holders.length === 1) {
          out.push({
            kind: 'keyperson',
            severity: 'warning',
            title: c.name + ': bara en person på nivå 3–4',
            detail: holders[0].worker.name + ' bär kunskapen. ' + (any.length - 1 ? (any.length - 1) + ' till har kompetensen på lägre nivå.' : 'Ingen annan har kompetensen.'),
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
      domainCapacity: domainCapacity,
      deliveryDomainCapacity: deliveryDomainCapacity,
      domainHeadcount: domainHeadcount,
      deliveryDomainHeadcount: deliveryDomainHeadcount,
      orgCapacity: orgCapacity,
      allFacts: allFacts,
      report: report,
      signals: signals
    };
  }

  return {
    create: create,
    workdays: workdays,
    overlapWorkdays: overlapWorkdays,
    monthlyHoursInPeriod: monthlyHoursInPeriod,
    periodOf: periodOf,
    nextPeriod: nextPeriod,
    prevPeriod: prevPeriod,
    UNSPECIFIED: UNSPECIFIED
  };
})();

if (typeof module !== 'undefined') module.exports = OOSEngine;
