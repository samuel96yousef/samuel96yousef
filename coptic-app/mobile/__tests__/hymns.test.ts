import fs from 'fs';
import path from 'path';

import { hymnGroupFor } from '../src/hymns';
import { addDays, easter } from '../src/lib/coptic';
import { readingsFor } from '../src/lib/lectionary';
import type { BibleBook, BookData, KatamerosData } from '../src/lib/types';

const d = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

describe('the hymns of the day', () => {
  const e = easter(2027); // 2 May 2027
  it.each([
    ['Lazarus Saturday', addDays(e, -8), '09'],
    ['Palm Sunday', addDays(e, -7), '12'],
    ['Covenant Thursday', addDays(e, -3), '20'],
    ['Holy Week', addDays(e, -2), '06'],
    ['Great Lent', addDays(e, -30), '05'],
    ['the fast of Nineveh', addDays(e, -68), '08'],
    ['Easter', e, '15'],
    ['Thomas Sunday', addDays(e, 7), '21'],
    ['the Ascension', addDays(e, 39), '11'],
    ['Pentecost', addDays(e, 49), '14'],
    ['the Apostles\' fast', addDays(e, 52), '07'],
  ])('%s', (_, day, group) => {
    expect(hymnGroupFor(day)).toBe(group);
  });

  it.each([
    ['2026-09-11', '25'], // Nayrouz, 1 Tout
    ['2026-09-27', '26'], // the Cross, 17 Tout
    ['2026-12-15', '04'], // Kiahk
    ['2027-01-07', '13'], // the Nativity
    ['2027-01-19', '16'], // Theophany, 11 Toba
    ['2027-04-07', '10'], // the Annunciation, 29 Baramhat
    ['2026-10-25', null], // an ordinary day in Baba
  ])('%s', (iso, group) => {
    expect(hymnGroupFor(d(iso))).toBe(group);
  });
});

const DATA = path.join(__dirname, '..', 'assets', 'data');
const hasData = fs.existsSync(path.join(DATA, 'katameros.json'));
const load = <T,>(name: string): T => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));

(hasData ? describe : describe.skip)('the Synaxarium in the day\'s readings', () => {
  const kat = hasData ? load<KatamerosData>('katameros.json') : ({} as KatamerosData);
  const books = hasData ? load<BibleBook[]>('books.json') : [];
  const book = async (bid: number) => load<BookData>(`bible/${bid}.bible`);
  const synax = async () => ({ '14': [{ title: 'نياحة القديس', paras: ['في مثل هذا اليوم'] }], '1': [{ title: 'تذكار', paras: ['نص'] }] });

  it('is read after the Praxis, before the gospel, in Arabic', async () => {
    const r = await readingsFor(d('2026-10-24'), kat, books, { book, synax }); // 14 Baba
    const keys = r.sections.map((s) => s.key);
    expect(keys.indexOf('synaxarium')).toBe(keys.indexOf('praxis') + 1);
    expect(keys[keys.length - 1]).toBe('liturgy');
    const s = r.sections.find((x) => x.key === 'synaxarium')!;
    expect(s.units).toEqual([{ t: 'h', ar: 'نياحة القديس' }, { t: 'p', ar: 'في مثل هذا اليوم' }]);
  });

  it('is not read in the Holy Fifty Days', async () => {
    const r = await readingsFor(addDays(easter(2027), 10), kat, books, { book, synax: async () => new Proxy({}, { get: () => [{ title: 't', paras: ['p'] }] }) });
    expect(r.sections.some((s) => s.key === 'synaxarium')).toBe(false);
  });
});
