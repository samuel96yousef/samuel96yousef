/* Tester för kapacitetsmotorn. Kör med: node --test tests/ */
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
  assert.deepEqual([q.start, q.end, q.label], ['2026-07-01', '2026-09-30', '2026-Q3']);
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
