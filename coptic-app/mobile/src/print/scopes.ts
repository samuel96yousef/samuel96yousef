/** What each kind of screen offers to print, loaded only when printing. */
import type { Row } from '../components/Reader';
import type { PrintScope } from '../components/PrintSheet';
import { books, getReadings, holyWeek, loadBook, loadPrayers } from '../data';
import { holyWeekDayOn, holyWeekRows, printableRows, type HolyWeekDay } from '../holyweek';
import { STRINGS, type Strings } from '../i18n';
import { addDays, coptic, copticText, fromIso, gregorianText, toArDigits } from '../lib/coptic';
import type { BibleBook, Lang } from '../lib/types';
import { chapterRows, dayRows, liturgyRows, prayerRows } from '../rows';

const HOLY_WEEK = { ar: STRINGS.ar.holyWeek, sv: STRINGS.sv.holyWeek };
const AGPEYA = { ar: 'الأجبية', sv: 'Agpeya' };

async function dayPart(d: Date) {
  const r = await getReadings(d);
  // In Holy Week the day's readings are the Pascha's, as the Readings tab shows them.
  const pascha = r.season === 'holy_week' ? holyWeekDayOn(d, holyWeek) : null;
  return pascha ? paschaPart(pascha) : { rows: dayRows(r, fromIso(r.iso), HOLY_WEEK) };
}

const paschaPart = async (day: HolyWeekDay) => ({ rows: printableRows((await holyWeekRows(day, holyWeek, books, loadBook)).rows) });

export function paschaScopes(day: HolyWeekDay, t: Strings, lang: Lang): PrintScope[] {
  return [
    { key: 'day', label: t.printDay, title: `${t.pascha} – ${lang === 'ar' ? day.ar : day.sv}`, load: async () => [await paschaPart(day)] },
    // Each day from a new page, from Lazarus Saturday to Easter.
    { key: 'week', label: t.printPascha, sub: t.printBig, title: t.pascha, load: () => Promise.all(holyWeek.days.map(paschaPart)) },
  ];
}

export function readingScopes(day: Date, t: Strings, lang: Lang): PrintScope[] {
  const title = `${t.readings} ${copticText(coptic(day), lang)} – ${gregorianText(day, lang)}`;
  return [
    { key: 'day', label: t.printDay, title, load: async () => [await dayPart(day)] },
    {
      key: 'week', label: t.printWeek, title: `${title} (${t.printDays})`,
      // A day after day, each from a new page: for a week's services printed ahead.
      load: () => Promise.all(Array.from({ length: 7 }, (_, i) => dayPart(addDays(day, i)))),
    },
  ];
}

export function hourScopes(id: string, name: string, t: Strings, lang: Lang): PrintScope[] {
  return [
    { key: 'hour', label: t.printHour, title: `${AGPEYA[lang]} – ${name}`, load: async () => {
      const all = await loadPrayers('agpeya');
      const p = all.find((x) => x.id === id) ?? all[0];
      return [{ rows: prayerRows(p, AGPEYA) }];
    } },
    { key: 'agpeya', label: t.printAgpeya, sub: t.printBig, title: t.printAgpeya, load: async () =>
      (await loadPrayers('agpeya')).map((p) => ({ rows: prayerRows(p, AGPEYA) })) },
  ];
}

export function liturgyScopes(id: string, name: string, t: Strings): PrintScope[] {
  return [{ key: 'liturgy', label: t.printLiturgy, title: name, load: async () => {
    const all = await loadPrayers('kholagy');
    return [{ rows: liturgyRows(all.find((x) => x.id === id) ?? all[0]) }];
  } }];
}

export function bibleScopes(b: BibleBook, chapter: number, t: Strings, lang: Lang): PrintScope[] {
  const name = lang === 'ar' ? b.ar : b.sv;
  const psalter = b.sv === 'Psaltaren';
  return [
    {
      key: 'chapter', label: t.printChapter(`${name} ${lang === 'ar' ? toArDigits(chapter) : chapter}`), title: `${name} ${chapter}`,
      load: async () => [{ rows: chapterRows(b, chapter, (await loadBook(b.bid)).find(([c]) => c === chapter)?.[1] ?? []) }],
    },
    {
      key: 'book', label: t.printBook(name), sub: b.chapters > 20 ? t.printBig : undefined, title: name,
      // The whole book runs on, chapter after chapter, rather than a page each.
      load: async () => {
        const rows: Row[] = [{ k: 'run', ar: b.ar, sv: b.sv }, { k: 'cart', ar: b.ar, sv: b.sv }];
        for (const [c, verses] of await loadBook(b.bid)) {
          rows.push({ k: 'title', id: String(c), ar: `${psalter ? 'المزمور' : 'الأصحاح'} ${toArDigits(c)}`, sv: `${psalter ? 'Psalm' : 'Kapitel'} ${c}` });
          for (const [n, ar, sv] of verses) rows.push({ k: 'u', u: { t: 'v', c, n, ar, sv } });
        }
        return [{ rows }];
      },
    },
  ];
}
