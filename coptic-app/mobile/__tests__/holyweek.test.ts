import { dateOf, holyWeekDayOn, holyWeekRows, holyWeekYear, printableRows, readingLabel, serviceList, type HolyWeek } from '../src/holyweek';
import { isoDate } from '../src/lib/coptic';
import type { BookData } from '../src/lib/types';

// Isaiah (bid 26) chapter 5 and John (bid 49) chapter 12, a few verses each.
const BOOKS: Record<number, BookData> = {
  26: [[5, [[1, 'إش ١', 'Jes 1'], [2, 'إش ٢', 'Jes 2'], [3, 'إش ٣', 'Jes 3']]]],
  49: [[12, [[20, 'يو ٢٠', 'Joh 20'], [21, 'يو ٢١', 'Joh 21']]]],
};
const week: HolyWeek = {
  days: [{
    id: 'holy_tuesday', ar: 'الثلاثاء من البصخة', sv: 'Tisdag i påskveckan', offset: -5,
    services: [{
      ar: 'الحادية عشرة', sv: 'Elfte timmen', praise: ['default', 'tuesday_11th_hour'],
      readings: [
        { kind: 'prophecy', kindAr: 'نبوة', kindSv: 'Profetia', ref: 'isa 5 : 1 - 2' },
        { kind: 'psalm', kindAr: 'مزمور', kindSv: 'Psalm', psalm: '50:7' },
        { kind: 'gospel', kindAr: 'إنجيل', kindSv: 'Evangelium', ref: 'john 12 : 20 - 21' },
      ],
    }],
  }],
  praise: {
    ar: 'تسبحة البصخة', repeat: 12, stanza: { ar: 'لك القوة', ca: 'ثوك تي تي جوم' },
    invocations: [
      { ar: 'عمانوئيل', ca: 'إممانوئيل', from: 'default' },
      { ar: 'مخلصي الصالح', ca: 'باسوتير', from: 'tuesday_11th_hour' },
      { ar: 'قوتي وتسبحتي', ca: 'تاجوم', from: 'good_friday_eve' },
    ],
  },
};

describe('Holy Week', () => {
  test('shows this year until Easter is past, then next year', () => {
    expect(holyWeekYear(new Date(2027, 4, 2))).toBe(2027); // Easter 2027
    expect(holyWeekYear(new Date(2027, 4, 3))).toBe(2028);
    expect(isoDate(dateOf(week.days[0], 2027))).toBe('2027-04-27');
  });

  test('the praise follows the prophecies, with the invocations said by then', async () => {
    const { rows, outline } = await holyWeekRows(week.days[0], week, [], async (bid) => BOOKS[bid]);
    const units = rows.flatMap((r) => (r.k === 'u' ? [r.u] : []));
    const kinds = units.map((u) => (u.t === 'v' ? `v${u.n}` : u.t === 'st' ? `st:${u.ar}` : u.t));
    expect(kinds).toEqual(['ref', 'v1', 'v2', 'rubric', 'st:لك القوة', 'st:عمانوئيل', 'st:مخلصي الصالح', 'ref', 'note', 'ref', 'v20', 'v21']);
    expect(outline.items.map((i) => i.sv)).toEqual(['Elfte timmen']);
  });

  test('finds the day a date is, and lists its services by their gospel', () => {
    expect(holyWeekDayOn(new Date(2027, 3, 27), week)?.id).toBe('holy_tuesday');
    expect(holyWeekDayOn(new Date(2027, 3, 28), week)).toBeNull();
    const [s] = serviceList(week.days[0], []);
    expect(s.key).toBe('s0');
    expect(s.subAr).toMatch(/١٢/);
  });

  test('a psalm is shown by the church\'s number in Arabic, the Bible\'s in Swedish', () => {
    expect(readingLabel({ kind: 'psalm', kindAr: 'مزمور', kindSv: 'Psalm', ref: 'ps 51 : 7 - 10' }, [])).toEqual({ ar: 'مز 50:7–10', sv: 'Ps 51:7–10' });
    expect(readingLabel({ kind: 'psalm', kindAr: 'مزمور', kindSv: 'Psalm', psalm: '9:1' }, []).sv).toBe('Ps 9:1');
  });

  test('prints a stanza as its Arabic, and the Coptic in Arabic letters under it', () => {
    const rows = printableRows([{ k: 'u', u: { t: 'st', ar: 'لك القوة', ca: 'ثوك تي تي جوم' } }, { k: 'sep' }]);
    expect(rows).toEqual([{ k: 'u', u: { t: 'p', ar: 'لك القوة', sv: '' } }, { k: 'u', u: { t: 'f', ar: 'ثوك تي تي جوم', sv: '' } }, { k: 'sep' }]);
  });
});
