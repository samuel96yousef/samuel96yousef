/* Tester för kapacitetsmotorn och lagringen. Kör med: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const Seed = require('../js/seed.js');
const E = require('../js/engine.js');

const SEP = E.periodOf('2026-09-15', 'month');

function near(actual, expected, tol = 0.01) {
  assert.ok(Math.abs(actual - expected) <= tol, `väntade ${expected}, fick ${actual}`);
}

test('arbetsdagar räknas utan helger', () => {
  assert.equal(E.workdays('2026-09-01', '2026-09-30'), 22);
  assert.equal(E.workdays('2026-10-01', '2026-10-31'), 22);
  assert.equal(E.workdays('2026-09-05', '2026-09-06'), 0);
  assert.equal(SEP.workdays, 22);
});

test('perioder för månad och kvartal', () => {
  assert.deepEqual([SEP.start, SEP.end, SEP.label], ['2026-09-01', '2026-09-30', 'September 2026']);
  const q = E.periodOf('2026-08-10', 'quarter');
  assert.deepEqual([q.start, q.end, q.label], ['2026-07-01', '2026-09-30', 'Q3 2026']);
  assert.equal(E.nextPeriod(SEP).start, '2026-10-01');
  assert.equal(E.nextPeriod(E.periodOf('2026-12-03', 'month')).start, '2027-01-01');
});

test('timmar per månad fördelas på överlappande arbetsdagar', () => {
  near(E.monthlyHoursInPeriod(60, '2026-01-01', '2026-12-31', SEP), 60);
  near(E.monthlyHoursInPeriod(60, '2026-10-01', '2026-12-31', SEP), 0);
  /* 1–15 sep = 11 av 22 arbetsdagar */
  near(E.monthlyHoursInPeriod(60, '2026-09-01', '2026-09-15', SEP), 30);
  const q = E.periodOf('2026-08-10', 'quarter');
  near(E.monthlyHoursInPeriod(40, '2026-01-01', '2026-12-31', q), 120);
});

test('arbetarens tillgängliga kapacitet är grundkapacitet minus grundavdrag', () => {
  const db = Seed.build();
  const e = E.create(db);
  const anna = e.workerCapacity('w_anna', SEP);
  near(anna.availableWeek, 31);
  near(anna.available, (31 / 5) * 22);
  near(anna.allocationPct, 100);

  const atlas = e.workerCapacity('w_atlas', SEP);
  near(atlas.overheadWeek, 0, 1e-9);
  near(atlas.available, (40 / 5) * 22);

  /* Deltid (32 h) får grundavdraget skalat: 9 × 32/40 = 7,2 h */
  const jonas = e.workerCapacity('w_jonas', SEP);
  near(jonas.overheadWeek, 7.2);
});

test('teamavdrag minskar teamets kapacitet pro rata', () => {
  const db = Seed.build();
  const e = E.create(db);
  const tc = e.teamCapacity('t_kundportal', SEP);
  near(tc.reduction.share, 0.1);
  const gross = tc.members.reduce((s, m) => s + m.gross, 0);
  near(tc.capacity, gross * 0.9);

  /* Infrastruktur har 15 % under 15–22 sep = 6 av 22 arbetsdagar */
  const infra = e.teamReductionShare('t_infra', SEP);
  near(infra.share, (0.15 * 6) / 22);
});

test('överallokering flaggas som kritisk signal', () => {
  const db = Seed.build();
  const e = E.create(db);
  const emma = e.workerCapacity('w_emma', SEP);
  assert.ok(emma.allocationPct > 100);
  const sig = e.signals(SEP).find((s) => s.kind === 'overallocated' && s.ref.id === 'w_emma');
  assert.equal(sig.severity, 'critical');
});

test('leveransdomänernas kapacitet summerar till organisationens', () => {
  const db = Seed.build();
  const e = E.create(db);
  const org = e.orgCapacity(SEP).capacity;
  const sum = db.deliveryDomains.reduce((s, d) => s + e.deliveryDomainCapacity(d.id, SEP).capacity, 0);
  near(sum, org, 0.5);
});

test('rapporten stämmer mot teamens och domänmolnens kapacitet', () => {
  const db = Seed.build();
  const e = E.create(db);
  const rep = e.report({ period: SEP, level: 'team' });
  near(rep.total.capacity, e.orgCapacity(SEP).capacity, 0.5);
  const kp = rep.groups.find((g) => g.key === 't_kundportal');
  near(kp.total.capacity, e.teamCapacity('t_kundportal', SEP).capacity, 0.01);
  const next = E.nextPeriod(SEP);
  near(kp.total.nextCapacity, e.teamCapacity('t_kundportal', next).capacity, 0.01);

  const onlyTeams = e.report({ period: SEP, level: 'delivery', filters: { source: 'team' } });
  const teamSum = db.teams.reduce((s, t) => s + e.teamCapacity(t.id, SEP).capacity, 0);
  near(onlyTeams.total.capacity, teamSum, 0.5);
});

test('teamets leveransdomän härleds från primär verksamhetsdomän', () => {
  const db = Seed.build();
  const e = E.create(db);
  assert.equal(e.teamDeliveryDomain('t_sapcrm').id, 'dd_ag');
  assert.equal(e.teamDeliveryDomain('t_kundportal').id, 'dd_km');
  /* Utan primär verksamhetsdomän används IT-domänens leveransdomän */
  db.teamDomains = db.teamDomains.filter((x) => !(x.teamId === 't_api' && x.domainId === 'd_rapport'));
  const e2 = E.create(db);
  assert.equal(e2.teamDeliveryDomain('t_api').id, 'dd_uf');
});

test('överallokerade arbetare bidrar aldrig med mer än sin tillgängliga tid', () => {
  const db = Seed.build();
  const e = E.create(db);
  const facts = e.allFacts(SEP);
  for (const w of db.workers) {
    const given = facts.filter((f) => f.workerId === w.id).reduce((s, f) => s + f.capacity, 0);
    const available = e.workerCapacity(w.id, SEP).available;
    assert.ok(given <= available + 0.01, `${w.name} bidrar med ${given} h av ${available} h`);
  }
  const emma = e.workerCapacity('w_emma', SEP);
  assert.ok(emma.scale < 1);
  const kp = e.teamCapacity('t_kundportal', SEP).members.find((m) => m.worker.id === 'w_emma');
  assert.equal(kp.scaled, true);
});

test('en teamledare som tas bort ur teamet slutar vara teamledare', () => {
  const Store = require('../js/store.js');
  Store.load();
  const tw = Store.db.teamWorkers.find((x) => x.teamId === 't_kundportal' && x.workerId === 'w_martin');
  assert.equal(Store.db.teams.find((t) => t.id === 't_kundportal').leadId, 'w_martin');
  Store.remove('teamWorkers', tw.id);
  assert.equal(Store.db.teams.find((t) => t.id === 't_kundportal').leadId, null);
});

test('borttagning av team tar bort dess kopplingar men inte arbetarna', () => {
  const Store = require('../js/store.js');
  Store.reset();
  const workersBefore = Store.db.workers.length;
  Store.remove('teams', 't_sapcrm');
  assert.equal(Store.db.teamWorkers.filter((x) => x.teamId === 't_sapcrm').length, 0);
  assert.equal(Store.db.teamSystems.filter((x) => x.teamId === 't_sapcrm').length, 0);
  assert.equal(Store.db.teamDomains.filter((x) => x.teamId === 't_sapcrm').length, 0);
  assert.equal(Store.db.workers.length, workersBefore);
  assert.ok(Store.db.changeLog.length >= 1);
});

test('kvartal visas med versaler även mitt i en mening', () => {
  const q = E.periodOf('2026-08-10', 'quarter');
  assert.equal(q.inText, 'Q3 2026');
  assert.equal(SEP.inText, 'september 2026');
});

test('KPI:er har värde, mål och status som stämmer med målen', () => {
  const e = E.create(Seed.build());
  const list = e.kpis(SEP);
  const byKey = Object.fromEntries(list.map((k) => [k.key, k]));
  assert.equal(byKey.overallocated.value, 1);
  assert.equal(byKey.overallocated.status, 'above');
  assert.equal(byKey.overallocated.severity, 'critical');
  assert.equal(byKey.load.status, 'ok');
  assert.equal(byKey.aiShare.status, 'none');
  const org = e.orgCapacity(SEP);
  near(byKey.load.value, org.loadPct);
});

test('egna målnivåer i inställningarna styr KPI-status', () => {
  const db = Seed.build();
  db.settings.kpiTargets = { load: { min: 90, max: 95 } };
  const k = E.create(db).kpis(SEP).find((x) => x.key === 'load');
  assert.equal(k.status, 'below');
  assert.equal(k.severity, 'warning');
});

test('kompetensmatrisen summerar till teamens kapacitet', () => {
  const db = Seed.build();
  const e = E.create(db);
  const m = e.competenceMatrix(SEP, 'team');
  const teamSum = db.teams.reduce((s, t) => s + e.teamCapacity(t.id, SEP).capacity, 0);
  near(m.total, teamSum, 0.5);
  const byDd = e.competenceMatrix(SEP, 'delivery');
  near(byDd.total, e.orgCapacity(SEP).capacity, 0.5);
});

test('sammansättningen summerar till 100 procent', () => {
  const c = E.create(Seed.build()).composition(SEP);
  near(c.source.reduce((s, p) => s + p.pct, 0), 100, 0.01);
  near(c.employment.reduce((s, p) => s + p.pct, 0), 100, 0.01);
});

test('kopplingskartan har alla noder och hittar luckorna', () => {
  const db = Seed.build();
  const g = E.create(db).connectionGraph();
  const count = (key) => g.columns.find((c) => c.key === key).nodes.length;
  assert.equal(count('dd'), db.deliveryDomains.length);
  assert.equal(count('team'), db.teams.length);
  assert.equal(count('system'), db.systems.length);
  const issues = g.columns.flatMap((c) => c.nodes.filter((n) => n.issues.length).map((n) => n.name));
  assert.deepEqual(issues.sort(), ['Dokumenthantering', 'Premier och Fakturering']);
  const ids = new Set(g.columns.flatMap((c) => c.nodes.map((n) => n.id)));
  assert.ok(g.edges.every((ed) => ids.has(ed.from) && ids.has(ed.to)));
});

test('val i kopplingskartan följer primära kopplingar och stannar vid stödjande', () => {
  const e = E.create(Seed.build());
  const g = e.connectionGraph();
  assert.deepEqual(g.columns.map((c) => c.key), ['dd', 'bd', 'team', 'system', 'it']);
  const km = E.connectionFocus(g, 'dd:dd_km');
  assert.ok(km.nodes.has('team:t_kundportal'));
  assert.ok(km.nodes.has('system:s_kundportal'));
  assert.ok(km.nodes.has('it:d_digital'));
  /* Arbetsgivarportalen ligger i samma IT-domän men hör inte till Kund och Marknad. */
  assert.ok(!km.nodes.has('system:s_agportal'));
  /* Test och Kvalitet stödjer Kundservice: teamet visas men följs inte vidare till dess system. */
  assert.ok(km.nodes.has('team:t_test'));
  assert.ok(!km.nodes.has('system:s_testplat'));
  const sys = E.connectionFocus(g, 'system:s_sapcrm');
  assert.ok(sys.nodes.has('team:t_sapcrm') && sys.nodes.has('dd:dd_ag'));
  assert.ok(sys.nodes.has('team:t_kundportal'));
  assert.ok(!sys.nodes.has('dd:dd_km'));
});

test('sökning: alla ord i valfri ordning, utan hänsyn till versaler och å, ä, ö', () => {
  const U = require('../js/util.js');
  const m = U.matcher('PORTAL kund');
  assert.ok(m('Kundportal Team'));
  assert.ok(!m('Kundservice'));
  assert.deepEqual(m.terms, ['portal', 'kund']);
  assert.ok(U.matcher('doman')('Verksamhetsdomän'));
  assert.ok(U.matcher('domän')('Verksamhetsdoman'));
  assert.ok(U.matcher('')('vad som helst'));
});

test('sökning: tal hittas med och utan mellanslag för tusental', () => {
  const U = require('../js/util.js');
  assert.ok(U.matcher('1042')('1 042 h'));
  assert.ok(U.matcher('1 042')('1042 h'));
  assert.ok(U.matcher('−22')('−22 h'));
  assert.ok(!U.matcher('1042')('104 2'));
});

test('sökning: markering behåller textens längd och synlig text tas ur HTML', () => {
  const U = require('../js/util.js');
  const s = 'Åsa Öberg, Kundtjänst';
  assert.equal(U.searchNorm(s).length, s.length);
  assert.equal(U.textOf('<span data-tip="dold">Data &amp; Analys</span><button aria-label="Ändra"></button>').trim(), 'Data & Analys');
  assert.equal(U.plural(1, 'medlem', 'medlemmar'), '1 medlem');
  assert.equal(U.plural(3, 'medlem', 'medlemmar'), '3 medlemmar');
});

/* ---------- Arbete: initiativ och epiker ---------- */

const OCT = E.periodOf('2026-10-15', 'month');

test('epikens timmar: månadsram per månad, totalram jämnt fördelad på arbetsdagar', () => {
  const monthly = { effort: 'monthly', hours: 200, from: '2026-01-01', to: '2027-12-31' };
  near(E.epicHoursInPeriod(monthly, OCT), 200);
  const total = { effort: 'total', hours: 440, from: '2026-10-01', to: '2026-11-30' };
  /* 22 + 21 arbetsdagar: oktober får 22/43 av ramen. */
  near(E.epicHoursInPeriod(total, OCT), (440 * 22) / 43);
  near(E.epicHoursInPeriod(total, E.periodOf('2026-12-15', 'month')), 0);
  near(E.epicFrame(total), 440);
  near(E.epicFrame({ effort: 'monthly', hours: 100, from: '2026-10-01', to: '2026-12-31' }), 300);
});

test('bara beslutat arbete belastar teamet, förslag redovisas för sig', () => {
  const db = Seed.build();
  db.epics = [
    { id: 'a', teamId: 't_webb', type: 'maintenance', status: 'active', effort: 'monthly', hours: 100, from: '2026-01-01', to: '2026-12-31' },
    { id: 'b', teamId: 't_webb', type: 'development', status: 'planned', effort: 'monthly', hours: 50, from: '2026-01-01', to: '2026-12-31' },
    { id: 'c', teamId: 't_webb', type: 'development', status: 'proposed', effort: 'monthly', hours: 70, from: '2026-01-01', to: '2026-12-31' },
    { id: 'd', teamId: 't_webb', type: 'training', status: 'done', effort: 'monthly', hours: 40, from: '2026-01-01', to: '2026-12-31' }
  ];
  const e = E.create(db);
  const d = e.teamDemand('t_webb', OCT);
  near(d.hours, 150);
  near(d.proposed, 70);
  near(d.byType.maintenance, 100);
  near(d.byType.development, 50);
  const tc = e.teamCapacity('t_webb', OCT);
  near(tc.loaded, 150);
  near(tc.loadPct, (150 / tc.capacity) * 100);
});

test('beläggningen räknas ur epikerna och kan bli över 100 procent', () => {
  const db = Seed.build();
  const e0 = E.create(db);
  const cap = e0.teamCapacity('t_webb', OCT).capacity;
  db.epics = [{ id: 'x', teamId: 't_webb', type: 'development', status: 'active', effort: 'monthly', hours: cap * 1.2, from: '2026-01-01', to: '2026-12-31' }];
  const e = E.create(db);
  const tc = e.teamCapacity('t_webb', OCT);
  near(tc.loadPct, 120, 0.5);
  assert.ok(e.signals(OCT).some((s) => s.kind === 'overplanned' && s.severity === 'critical'));
  /* Medlemmarnas planerade timmar summerar till teamets. */
  near(tc.members.reduce((a, m) => a + m.loaded, 0), tc.loaded);
});

test('manuell belastning finns kvar som val', () => {
  const db = Seed.build();
  db.settings.loadSource = 'manual';
  const e = E.create(db);
  const tc = e.teamCapacity('t_kundportal', OCT);
  const manual = tc.members.reduce((a, m) => a + (m.capacity * m.tw.plannedLoad) / 100, 0);
  near(tc.loaded, manual);
});

test('initiativet summerar ramen för sina beslutade epiker per team', () => {
  const e = E.create(Seed.build());
  const s = e.initiativeSummary('in_itp1', OCT);
  near(s.frame, 2800 + 1300 + 1200 + 700 + 500);
  assert.equal(s.teams[0].team.id, 't_pensionbackend');
  assert.ok(s.hoursInPeriod > 0);
});

test('utvecklingsarbete utan initiativ flaggas för spårbarhet', () => {
  const e = E.create(Seed.build());
  const titles = e.signals(OCT).filter((s) => s.kind === 'untraced').map((s) => s.title);
  assert.ok(titles.some((t) => t.includes('Pensionsveckan')));
});

test('team som tas bort tar sina epiker med sig, initiativ lämnar epikerna kvar', () => {
  const Store = require('../js/store.js');
  Store.reset();
  const before = Store.db.epics.filter((x) => x.initiativeId === 'in_dora').length;
  assert.ok(before > 0);
  Store.remove('initiatives', 'in_dora');
  assert.equal(Store.db.epics.filter((x) => x.initiativeId === 'in_dora').length, 0);
  assert.equal(Store.db.epics.filter((x) => x.teamId === 't_sakerhet').length, 3);
  Store.remove('teams', 't_sakerhet');
  assert.equal(Store.db.epics.filter((x) => x.teamId === 't_sakerhet').length, 0);
  Store.reset();
});
