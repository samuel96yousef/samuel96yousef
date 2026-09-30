/*
 * Lagring för POC:n. Data sparas i webbläsarens localStorage, så varje användare
 * har sin egen sandlåda. Alla ändringar loggas för spårbarhet.
 */
var OOSStore = (function () {
  var U = typeof OOSUtil !== 'undefined' ? OOSUtil : require('./util.js');
  var Seed = typeof OOSSeed !== 'undefined' ? OOSSeed : require('./seed.js');
  var Engine = typeof OOSEngine !== 'undefined' ? OOSEngine : require('./engine.js');

  var KEY = 'oos-poc-db-v1';
  var db = null;
  var engine = null;
  var persistent = true;

  /* Vad som ska tas bort eller nollställas när en post raderas. */
  var CASCADE = {
    workers: {
      remove: [['teamWorkers', 'workerId'], ['workerCompetences', 'workerId'], ['extendedDomainCompetences', 'workerId'], ['extendedDeliveryCompetences', 'workerId']],
      nullify: [['teams', 'leadId'], ['domains', 'ownerId'], ['deliveryDomains', 'ownerId']]
    },
    teams: { remove: [['teamWorkers', 'teamId'], ['teamDomains', 'teamId'], ['teamSystems', 'teamId'], ['teamReductions', 'teamId']] },
    domains: { remove: [['teamDomains', 'domainId'], ['domainClusters', 'domainId'], ['itDomainSystems', 'domainId'], ['extendedDomainCompetences', 'domainId']] },
    deliveryDomains: { remove: [['domainClusters', 'deliveryDomainId'], ['extendedDeliveryCompetences', 'deliveryDomainId']] },
    competences: { remove: [['workerCompetences', 'competenceId']] },
    systems: { remove: [['teamSystems', 'systemId'], ['itDomainSystems', 'systemId']] }
  };

  var LABELS = {
    workers: 'arbetare',
    teams: 'team',
    domains: 'domän',
    deliveryDomains: 'leveransdomän',
    competences: 'kompetens',
    systems: 'system',
    teamWorkers: 'teammedlem',
    teamDomains: 'domänkoppling',
    teamSystems: 'systemkoppling',
    domainClusters: 'domänkluster',
    workerCompetences: 'arbetarkompetens',
    extendedDomainCompetences: 'domänroll',
    extendedDeliveryCompetences: 'leveransdomänroll',
    teamReductions: 'teamavdrag',
    overheadReductions: 'grundavdrag',
    itDomainSystems: 'IT-domänkoppling'
  };

  function readStorage() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      persistent = false;
      return null;
    }
  }

  function writeStorage() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      persistent = true;
    } catch (e) {
      persistent = false;
    }
  }

  function ensureShape(d) {
    var fresh = Seed.build();
    Object.keys(fresh).forEach(function (k) {
      if (d[k] === undefined) d[k] = Array.isArray(fresh[k]) ? [] : fresh[k];
    });
    if (!d.changeLog) d.changeLog = [];
    return d;
  }

  function load() {
    var stored = typeof localStorage !== 'undefined' ? readStorage() : null;
    db = stored ? ensureShape(stored) : ensureShape(Seed.build());
    engine = null;
    return db;
  }

  function reset() {
    db = ensureShape(Seed.build());
    engine = null;
    log('Återställde', 'demodata', '');
    writeStorage();
    return db;
  }

  function getEngine() {
    if (!engine) engine = Engine.create(db);
    return engine;
  }

  function touch() {
    engine = null;
  }

  function nameOf(coll, obj) {
    if (!obj) return '';
    if (obj.name) return obj.name;
    var e = getEngine();
    if (obj.workerId && obj.teamId) {
      var w = e.get('workers', obj.workerId);
      var t = e.get('teams', obj.teamId);
      return (w ? w.name : '') + ' → ' + (t ? t.name : '');
    }
    if (obj.teamId && obj.domainId) {
      var t2 = e.get('teams', obj.teamId);
      var d2 = e.get('domains', obj.domainId);
      return (t2 ? t2.name : '') + ' → ' + (d2 ? d2.name : '');
    }
    if (obj.teamId && obj.systemId) {
      var t3 = e.get('teams', obj.teamId);
      var s3 = e.get('systems', obj.systemId);
      return (t3 ? t3.name : '') + ' → ' + (s3 ? s3.name : '');
    }
    if (obj.workerId && obj.competenceId) {
      var w4 = e.get('workers', obj.workerId);
      var c4 = e.get('competences', obj.competenceId);
      return (w4 ? w4.name : '') + ' → ' + (c4 ? c4.name : '');
    }
    if (obj.deliveryDomainId && obj.domainId) {
      var dd5 = e.get('deliveryDomains', obj.deliveryDomainId);
      var d5 = e.get('domains', obj.domainId);
      return (d5 ? d5.name : '') + ' → ' + (dd5 ? dd5.name : '');
    }
    if (obj.workerId) {
      var w6 = e.get('workers', obj.workerId);
      return (w6 ? w6.name : '') + (obj.role ? ' (' + obj.role + ')' : '');
    }
    if (obj.teamId) {
      var t7 = e.get('teams', obj.teamId);
      return (t7 ? t7.name : '') + (obj.type ? ': ' + obj.type : '');
    }
    return obj.id;
  }

  function log(action, what, name) {
    db.changeLog = db.changeLog || [];
    db.changeLog.unshift({ ts: new Date().toISOString(), action: action, what: what, name: name });
    if (db.changeLog.length > 300) db.changeLog.length = 300;
  }

  function insert(coll, obj) {
    var rec = Object.assign({ id: U.uid(coll.slice(0, 3)) }, obj);
    db[coll].push(rec);
    touch();
    log('Lade till', LABELS[coll] || coll, nameOf(coll, rec));
    writeStorage();
    return rec;
  }

  function update(coll, id, patch) {
    var rec = db[coll].filter(function (x) { return x.id === id; })[0];
    if (!rec) return null;
    Object.assign(rec, patch);
    if ('updated' in rec) rec.updated = U.todayISO();
    touch();
    log('Ändrade', LABELS[coll] || coll, nameOf(coll, rec));
    writeStorage();
    return rec;
  }

  function remove(coll, id) {
    var rec = db[coll].filter(function (x) { return x.id === id; })[0];
    if (!rec) return;
    var name = nameOf(coll, rec);
    db[coll] = db[coll].filter(function (x) { return x.id !== id; });
    var rules = CASCADE[coll];
    if (rules) {
      (rules.remove || []).forEach(function (r) {
        db[r[0]] = db[r[0]].filter(function (x) { return x[r[1]] !== id; });
      });
      (rules.nullify || []).forEach(function (r) {
        db[r[0]].forEach(function (x) {
          if (x[r[1]] === id) x[r[1]] = null;
        });
      });
    }
    touch();
    log('Tog bort', LABELS[coll] || coll, name);
    writeStorage();
  }

  function updateSettings(patch) {
    Object.assign(db.settings, patch);
    touch();
    log('Ändrade', 'inställningar', Object.keys(patch).join(', '));
    writeStorage();
  }

  function exportJSON() {
    return JSON.stringify(db, null, 2);
  }

  function importJSON(text) {
    var data = JSON.parse(text);
    if (!data || !Array.isArray(data.workers) || !Array.isArray(data.teams)) {
      throw new Error('Filen saknar arbetare eller team och ser inte ut att komma från OOS.');
    }
    db = ensureShape(data);
    engine = null;
    log('Importerade', 'data', '');
    writeStorage();
  }

  return {
    load: load,
    reset: reset,
    get db() { return db; },
    engine: getEngine,
    insert: insert,
    update: update,
    remove: remove,
    updateSettings: updateSettings,
    exportJSON: exportJSON,
    importJSON: importJSON,
    isPersistent: function () { return persistent; }
  };
})();

if (typeof module !== 'undefined') module.exports = OOSStore;
