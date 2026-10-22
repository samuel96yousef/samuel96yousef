import fs from 'fs';
import path from 'path';

import { addDays, coptic, easter, isoDate, observances, season } from '../src/lib/coptic';
import { readingsFor, selectReadings } from '../src/lib/lectionary';
import { parseRef } from '../src/lib/refs';
import type { BibleBook, BookData, KatamerosData } from '../src/lib/types';

const DATA = path.join(__dirname, '..', 'assets', 'data');
const hasData = fs.existsSync(path.join(DATA, 'katameros.json'));
const load = <T,>(name: string): T => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
const d = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

describe('Coptic calendar', () => {
  it.each([
    ['2026-09-11', [1743, 1, 1]],
    ['2026-10-22', [1743, 2, 12]],
    ['2027-01-07', [1743, 4, 29]],
    ['2027-09-12', [1744, 1, 1]], // 2028 is a leap year, so the new year moves to 12 September
    ['2028-01-07', [1744, 4, 28]],
    ['2028-09-11', [1745, 1, 1]],
  ])('%s', (iso, [year, month, day]) => {
    expect(coptic(d(iso))).toEqual({ year, month, day });
  });

  it.each([[2025, '2025-04-20'], [2026, '2026-04-12'], [2027, '2027-05-02'], [2028, '2028-04-16']])('Easter %i', (y, iso) => {
    expect(isoDate(easter(y))).toBe(iso);
  });

  it('marks the Nativity on 7 January even when it is 28 Kiahk', () => {
    expect(observances(d('2028-01-07')).map((o) => o.sv)).toContain('Kristi födelse');
  });

  it('puts the Nativity fast between 16 Hatour and 6 January', () => {
    expect(season(d('2026-11-25'))?.sv).toBe('Julfastan');
    expect(season(d('2027-01-06'))?.sv).toBe('Julfastan');
    expect(season(d('2027-01-07'))).toBeNull();
  });
});

(hasData ? describe : describe.skip)('Katameros selection', () => {
  const kat = hasData ? load<KatamerosData>('katameros.json') : ({} as KatamerosData);
  const pick = (iso: string) => {
    const s = selectReadings(d(iso), kat);
    return `${s.season} ${s.source}`;
  };

  it('uses days_relations on ordinary weekdays', () => {
    expect(pick('2026-10-22')).toBe('weekday days 2-12');
    expect(selectReadings(d('2026-10-22'), kat).row?.vespers_gospel).toBe('matt 9 : 9 - 13');
  });

  it('uses the Sunday table by week of the Coptic month', () => {
    expect(pick('2026-10-25')).toBe('sunday sundays 2-3'); // 15 Baba
  });

  it('gives the Nativity paramoun on 6 January and the feast on 7 January', () => {
    expect(pick('2027-01-06')).toBe('nativity_paramoun days 4-28');
    expect(pick('2027-01-07')).toBe('feast days 4-29');
  });

  it('moves the Nativity readings to 28 Kiahk in leap years', () => {
    expect(pick('2028-01-06')).toBe('nativity_paramoun days 4-28');
    expect(pick('2028-01-07')).toBe('nativity days 4-29');
  });

  it('extends the Nativity paramoun to Friday when the feast is on a Monday', () => {
    // 7 January 2030 is a Monday
    expect(pick('2030-01-03')).not.toMatch(/paramoun/);
    expect(pick('2030-01-04')).toBe('nativity_paramoun days 4-28');
    expect(pick('2030-01-05')).toBe('nativity_paramoun days 4-28');
    expect(pick('2030-01-06')).toBe('nativity_paramoun days 4-28');
  });

  it('counts the Kiahk Sundays from the Nativity when it falls on a Monday', () => {
    expect(pick('2029-12-09')).toBe('kiahk_sunday sundays 4-1'); // 30 Hatour
    expect(pick('2029-12-16')).toBe('kiahk_sunday sundays 4-2');
    expect(pick('2029-12-23')).toBe('kiahk_sunday sundays 4-3');
    expect(pick('2029-12-30')).toBe('kiahk_sunday sundays 4-4');
    expect(pick('2026-12-13')).toBe('sunday sundays 4-1'); // an ordinary year: 4 Kiahk
  });

  it('gives the Theophany paramoun on 10 Touba, and from Friday when extended', () => {
    expect(pick('2026-01-18')).toBe('feast days 5-10'); // 10 Touba, a Sunday
    expect(pick('2026-01-16')).toBe('theophany_paramoun days 5-10'); // 8 Touba, a Friday, Theophany on Monday
    expect(pick('2026-01-17')).toBe('theophany_paramoun days 5-10'); // 9 Touba, a Saturday
    expect(pick('2030-01-17')).not.toMatch(/paramoun/); // 9 Touba, a Thursday
  });

  it('keeps fixed feasts in Lent', () => {
    expect(pick('2027-04-07')).toBe('feast days 7-29'); // Annunciation, 29 Baramhat
  });

  it('follows Easter for Jonah, Lent, Holy Week and the fifty days', () => {
    expect(pick('2027-02-22')).toBe('jonah great_lent 52'); // Monday of Jonah's fast
    expect(pick('2027-02-25')).toBe('jonah great_lent 55');
    expect(pick('2027-03-08')).toBe('lent great_lent 3');
    expect(pick('2027-04-25')).toBe('lent great_lent 51'); // Palm Sunday
    expect(pick('2027-04-27')).toBe('holy_week pascha');
    expect(pick('2027-05-02')).toBe('fifty fifty_feast 1');
    expect(pick('2027-06-20')).toBe('fifty fifty_feast 50'); // Pentecost
  });
});

(hasData ? describe : describe.skip)('Every day has complete readings', () => {
  const kat = hasData ? load<KatamerosData>('katameros.json') : ({} as KatamerosData);
  const books = hasData ? load<BibleBook[]>('books.json') : [];
  const cache = new Map<number, BookData>();
  const source = { book: async (bid: number) => {
    if (!cache.has(bid)) cache.set(bid, load<BookData>(`bible/${bid}.bible`));
    return cache.get(bid)!;
  } };

  it('resolves 2026–2030 with text for every reference', async () => {
    const problems: string[] = [];
    for (let day = d('2026-01-01'); day < d('2031-01-01'); day = addDays(day, 1)) {
      const r = await readingsFor(day, kat, books, source);
      const iso = isoDate(day);
      if (r.season === 'holy_week') continue;
      if (r.sections.length < 5) problems.push(`${iso}: ${r.sections.length} sections (${r.source})`);
      for (const s of r.sections) {
        if (s.units.some((u) => u.t === 'v')) continue;
        // Known error in the source data: fifty_feast 10 has "matt 17 : 29 - 23".
        if (r.source === 'fifty_feast 10' && s.key === 'vespers' && s.units.some((u) => u.t === 'note')) continue;
        problems.push(`${iso} ${s.key}: no verses (${s.refs.sv.join(', ')})`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('parses every reference in the data', () => {
    const rows = [...Object.values(kat.days), ...kat.sundays, ...Object.values(kat.lent), ...Object.values(kat.fifty)];
    const refs = rows.flatMap((r) => [r.vespers_gospel, r.matins_gospel, r.pauline, r.catholic, r.praxis, r.gospel, r.prophecies]);
    for (const ref of refs) if (ref) expect(() => parseRef(ref)).not.toThrow();
  });
});
