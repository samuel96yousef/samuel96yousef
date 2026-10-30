/**
 * Holy Week, the Pascha: from Lazarus Saturday to Easter, each day with its
 * services and their readings, taken from the app's Bible. In the hours from
 * Monday to Good Friday the Pascha praise ("Thok te ti gom") follows the
 * prophecies, with the invocations added as the week goes on.
 */
import type { Row } from './components/Reader';
import { addDays, easter, toArDigits } from './lib/coptic';
import { parseRef, refLabel, versesOf } from './lib/refs';
import type { BibleBook, BookData, Unit } from './lib/types';
import type { Outline, OutlineItem } from './rows';

type Forms = { ar?: string; ca?: string; cop?: string };

export interface HolyWeekReading {
  kind: 'prophecy' | 'gospel' | 'psalm' | 'pauline' | 'catholic' | 'praxis' | 'ode';
  kindAr: string;
  kindSv: string;
  /** In the Katameros' form ("isa 5 : 1 - 9 / jer 9 : 12 - 19"); a psalm has `psalm` instead */
  ref?: string;
  /** A psalm in the church's numbering, shown without its text */
  psalm?: string;
  /** The source names the whole chapter, without verses */
  wholeChapter?: boolean;
}

export interface HolyWeekService {
  ar: string;
  sv: string;
  readings: HolyWeekReading[];
  /** In a Pascha hour: which invocations of the praise are said by then */
  praise?: string[];
  /** A hymn sung in the service (Tennav at Easter) */
  hymn?: { ar: string; stanzas: Forms[] };
}

export interface HolyWeekDay {
  id: string;
  ar: string;
  sv: string;
  /** Days from Easter (-8 for Lazarus Saturday, 0 for Easter) */
  offset: number;
  services: HolyWeekService[];
}

export interface HolyWeek {
  days: HolyWeekDay[];
  praise: { ar: string; repeat: number; stanza: Forms; invocations: (Forms & { from: string })[] };
}

/** The Holy Week to show: this year's until Easter is past, then next year's. */
export function holyWeekYear(today: Date): number {
  const y = today.getFullYear();
  return addDays(easter(y), 1) <= today ? y + 1 : y;
}

export const dateOf = (day: HolyWeekDay, year: number) => addDays(easter(year), day.offset);

/** A day's rows for the reader, its readings loaded from the Bible; and its services, as the outline. */
export async function holyWeekRows(day: HolyWeekDay, week: HolyWeek, books: BibleBook[], book: (bid: number) => Promise<BookData>): Promise<{ rows: Row[]; outline: Outline }> {
  const needed = new Set(day.services.flatMap((s) => s.readings.flatMap((r) => (r.ref ? parseRef(r.ref).map((p) => p.bid) : []))));
  const loaded = new Map<number, BookData>();
  await Promise.all([...needed].map(async (bid) => loaded.set(bid, await book(bid))));

  const rows: Row[] = [{ k: 'top' }, { k: 'run', ar: 'أسبوع الآلام', sv: 'Påskveckan' }, { k: 'cart', ar: day.ar, sv: day.sv }];
  const items: OutlineItem[] = [];
  const u = (unit: Unit, showC?: boolean) => rows.push({ k: 'u', u: unit, showC });

  day.services.forEach((s, si) => {
    items.push({ index: rows.length, level: 1, ar: s.ar, sv: s.sv });
    rows.push({ k: 'title', id: `s${si}`, ar: s.ar, sv: s.sv });
    // The praise follows the last prophecy of the hour (or opens it, where there is none).
    const lastProphecy = s.readings.reduce((at, r, i) => (r.kind === 'prophecy' ? i : at), -1);
    if (s.praise && lastProphecy < 0) praise(s.praise);
    s.readings.forEach((r, ri) => {
      if (r.psalm != null) {
        u({ t: 'ref', ar: `${r.kindAr}: مز ${toArDigits(r.psalm)}`, sv: `${r.kindSv} ${r.psalm}` });
        u({ t: 'note', ar: 'يُقرأ المزمور بترقيم الكنيسة من كتاب المزامير.', sv: 'Psalmen anges med kyrkans numrering, som skiljer sig från bibelns, så texten visas inte här.' });
      } else if (r.ref) {
        const label = refLabel(r.ref, books);
        u({ t: 'ref', ar: `${r.kindAr}: ${label.ar}`, sv: `${r.kindSv}: ${label.sv}` });
        if (r.wholeChapter) u({ t: 'note', ar: 'يذكر المصدر الأصحاح كاملاً دون تحديد الآيات.', sv: 'Källan anger hela kapitlet, utan verser.' });
        let prevC: number | null = null;
        for (const p of parseRef(r.ref)) {
          for (const { c, v } of versesOf(loaded.get(p.bid)!, p)) {
            u({ t: 'v', c, n: v[0], ar: v[1], sv: v[2] }, prevC !== null && c !== prevC);
            prevC = c;
          }
        }
      }
      if (s.praise && ri === lastProphecy) praise(s.praise);
    });
    if (s.hymn) {
      u({ t: 'h', ar: s.hymn.ar });
      for (const st of s.hymn.stanzas) u({ t: 'st', ...st });
    }
    if (si < day.services.length - 1) rows.push({ k: 'sep' });
  });
  rows.push({ k: 'bottom' });

  function praise(said: string[]) {
    const p = week.praise;
    u({ t: 'rubric', ar: `${p.ar} (${toArDigits(p.repeat)} مرة)`, sv: `Påskveckans lovsång, ${p.repeat} gånger` });
    u({ t: 'st', ...p.stanza });
    for (const inv of p.invocations) if (said.includes(inv.from)) u({ t: 'st', ar: inv.ar, ca: inv.ca, cop: inv.cop });
  }

  return { rows, outline: { kind: 'sections', title: { ar: day.ar, sv: day.sv }, items } };
}
