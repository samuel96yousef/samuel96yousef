import fs from 'fs';
import path from 'path';

import type { Row } from '../src/components/Reader';
import { headingOutline, itemAt, liturgyRows, prayerRows, roleAt, verseOutline } from '../src/rows';
import type { Prayer } from '../src/lib/types';

const DATA = path.join(__dirname, '..', 'assets', 'data');
const hasData = fs.existsSync(path.join(DATA, 'kholagy.json'));
const load = <T,>(name: string): T => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

const title = { ar: 'ع', sv: 'T' };
const liturgy: Prayer = {
  id: 'x', ar: 'ق', sv: 'L',
  units: [
    { t: 'H', ar: 'أ', sv: 'A' },
    { t: 'role', r: 'priest' },
    { t: 'p', ar: '١', sv: 'one' },
    { t: 'role', r: 'people' },
    { t: 'p', ar: '٢', sv: 'two' },
    { t: 'H', ar: 'ب', sv: '' },
    { t: 'p', ar: '٣', sv: 'three' },
  ],
};

describe('Wayfinding outlines', () => {
  it('lists headings and subheadings', () => {
    const rows = prayerRows({ id: 'h', ar: 'س', sv: 'H', units: [
      { t: 'H', ar: 'م', sv: 'Main' }, { t: 'p', ar: 'ن', sv: 'text' }, { t: 'h', ar: 'ف', sv: 'Sub' }, { t: 'p', ar: 'ن', sv: 'text' },
    ] }, title);
    const o = headingOutline(rows, title);
    expect(o.items.map((i) => [i.sv, i.level])).toEqual([['Main', 1], ['Sub', 2]]);
    o.items.forEach((i) => expect(rows[i.index]).toMatchObject({ k: 'u', u: { sv: i.sv } }));
  });

  it('falls back to Arabic when a heading has no Swedish', () => {
    const o = headingOutline(liturgyRows(liturgy), title);
    expect(o.items.map((i) => i.sv)).toEqual(['A', 'ب']);
  });

  it('finds who is speaking at a row of a liturgy', () => {
    const rows = liturgyRows(liturgy);
    const at = (sv: string) => rows.findIndex((r) => r.k === 'u' && r.u.sv === sv);
    expect(roleAt(rows, at('one'))).toBe('priest');
    expect(roleAt(rows, at('two'))).toBe('people');
  });

  it('marks every fifth verse as a landmark', () => {
    const rows: Row[] = Array.from({ length: 12 }, (_, i) => ({ k: 'u', u: { t: 'v', c: 1, n: i + 1, ar: 'آ', sv: 'v' } }));
    const o = verseOutline(rows, title);
    expect(o.kind).toBe('verses');
    expect(o.items.filter((i) => i.level === 1).map((i) => i.sv)).toEqual(['1', '5', '10']);
    expect(o.items[9].ar).toBe('١٠');
  });

  it('finds the item a row belongs to', () => {
    const items = [5, 9, 20].map((index) => ({ index, level: 1 as const, ar: '', sv: '' }));
    expect([0, 4, 5, 8, 9, 19, 20, 99].map((r) => itemAt(items, r))).toEqual([-1, -1, 0, 0, 1, 1, 2, 2]);
  });

  (hasData ? it : it.skip)('outlines every hour and liturgy in the data', () => {
    for (const p of load<Prayer[]>('agpeya.json')) {
      const o = headingOutline(prayerRows(p, title), title);
      expect(o.items.length).toBeGreaterThan(5);
    }
    for (const p of load<Prayer[]>('kholagy.json')) {
      const rows = liturgyRows(p);
      const o = headingOutline(rows, title);
      expect(o.items.length).toBeGreaterThan(5);
      o.items.forEach((i) => expect(i.sv.length).toBeGreaterThan(0));
    }
  });
});
