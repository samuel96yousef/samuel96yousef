/**
 * Holy Week, the Pascha: from Lazarus Saturday to Easter, each day with its
 * services and their readings, taken from the app's Bible. In the hours from
 * Monday to Good Friday the Pascha praise ("Thok te ti gom") follows the
 * prophecies, with the invocations added as the week goes on.
 */
import type { Row } from './components/Reader';
import { addDays, dayDiff, easter, toArDigits } from './lib/coptic';
import { parseRef, psalmLabel, refLabel, versesOf } from './lib/refs';
import type { BibleBook, BookData, Role, Unit } from './lib/types';
import { roleRows, type Outline, type OutlineItem } from './rows';

type Forms = { ar?: string; ca?: string; cop?: string };

export interface HolyWeekReading {
  kind: 'prophecy' | 'gospel' | 'psalm' | 'pauline' | 'catholic' | 'praxis' | 'ode' | 'reading';
  kindAr: string;
  kindSv: string;
  /** In the Katameros' form ("isa 5 : 1 - 9 / jer 9 : 12 - 19"), a psalm in the Bible's numbering as there */
  ref?: string;
  /** A psalm that can't be renumbered: in the church's numbering, shown without its text */
  psalm?: string;
  /** The source names the whole chapter, without verses */
  wholeChapter?: boolean;
}

type Texts = { ar: string; sv: string };

/** One thing read, said or sung in a service, in its order (scripts/holy_week_order.py). */
export type HolyWeekItem =
  | ({ t: 'reading' } & HolyWeekReading)
  | { t: 'praise' }
  /** A fixed text: said by the priest, deacon or people; `f` a formula, as before and after a reading */
  | ({ t: 'say'; r?: Role; f?: boolean } & Texts)
  | ({ t: 'rubric' | 'note' | 'h' } & Texts)
  /** A text from the hymn library, as it is there (Arabic, the Coptic in Arabic letters) */
  | { t: 'lib'; ar: string; units: Unit[] };

export interface HolyWeekService {
  /** The title in the day: "Third hour", under its night or day */
  ar: string;
  sv: string;
  /** The name on its own, in a list or a printed title: "The night to Monday, third hour" */
  listAr: string;
  listSv: string;
  /** Short, for the tabs */
  tabAr?: string;
  tabSv?: string;
  /** A Pascha hour: of the night (prayed the evening before) or of the day */
  part?: { night: boolean } & Texts;
  /** In a Pascha hour: which invocations of the praise are said by then */
  praise?: string[];
  items: HolyWeekItem[];
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

/** The day of Holy Week a date is, if it is one. */
export const holyWeekDayOn = (d: Date, week: HolyWeek) => week.days.find((x) => x.offset === dayDiff(d, easter(d.getFullYear()))) ?? null;

/** A reading's reference, as the Katameros' are shown: a psalm by the church's number in Arabic. */
export function readingLabel(r: HolyWeekReading, books: BibleBook[]): { ar: string; sv: string } {
  if (r.psalm != null) return { ar: `مز ${toArDigits(r.psalm)}`, sv: `Ps ${r.psalm}` };
  if (r.kind !== 'psalm') return refLabel(r.ref!, books);
  const parts = r.ref!.split('/').map((p) => psalmLabel(p));
  return { ar: parts.map((p) => p.ar.replace('مزمور ', 'مز ')).join(' ؛ '), sv: parts.map((p) => p.sv.replace('Psaltaren ', 'Ps ')).join(' / ') };
}

const readingsOf = (s: HolyWeekService) => s.items.flatMap((i) => (i.t === 'reading' ? [i] : []));

/** A day's services as a list, as "Today" lists the sections: each with its gospel, else its first reading. */
export function serviceList(day: HolyWeekDay, books: BibleBook[]) {
  return day.services.map((s, i) => {
    const rs = readingsOf(s);
    const r = rs.find((x) => x.kind === 'gospel') ?? rs[0];
    const label = r ? readingLabel(r, books) : null;
    const hymn = s.items.find((x) => x.t === 'lib');
    return { key: `s${i}`, ar: s.listAr, sv: s.listSv, subAr: label ? toArDigits(label.ar) : hymn?.t === 'lib' ? hymn.ar : '', subSv: label?.sv ?? '' };
  });
}

/** The hymn library's groups that belong to a day of Holy Week, for its hymns as sung. */
export const HYMN_GROUPS: Record<string, string[]> = {
  lazarus_saturday: ['09'], palm_sunday: ['12', '06'], holy_monday: ['06'], holy_tuesday: ['06'], holy_wednesday: ['06'],
  covenant_thursday: ['20', '06'], good_friday: ['06'], bright_saturday: ['06'], resurrection_sunday: ['15'],
};

/**
 * A day's rows for the reader, its readings loaded from the Bible; and its
 * services, as the outline. A Pascha day's hours come under their night,
 * prayed the evening before, and their day.
 */
export async function holyWeekRows(day: HolyWeekDay, week: HolyWeek, books: BibleBook[], book: (bid: number) => Promise<BookData>): Promise<{ rows: Row[]; outline: Outline }> {
  const needed = new Set(day.services.flatMap((s) => readingsOf(s).flatMap((r) => (r.ref ? parseRef(r.ref).map((p) => p.bid) : []))));
  const loaded = new Map<number, BookData>();
  await Promise.all([...needed].map(async (bid) => loaded.set(bid, await book(bid))));

  const rows: Row[] = [{ k: 'top' }, { k: 'run', ar: 'أسبوع الآلام', sv: 'Påskveckan' }, { k: 'cart', ar: day.ar, sv: day.sv }];
  const items: OutlineItem[] = [];
  const list = serviceList(day, books);
  const u = (unit: Unit, showC?: boolean) => rows.push({ k: 'u', u: unit, showC });

  day.services.forEach((s, si) => {
    const prev = day.services[si - 1];
    if (s.part && (!prev?.part || prev.part.ar !== s.part.ar)) {
      if (si > 0) rows.push({ k: 'sep' });
      u({ t: 'H', ar: s.part.ar, sv: s.part.sv });
      if (s.part.night) u({ t: 'note', ar: 'تُصلّى ساعات الليل مساء اليوم السابق.', sv: 'Nattens timmar bes kvällen före.' });
    } else if (si > 0) rows.push({ k: 'sep' });
    items.push({ index: rows.length, level: 1, ar: s.tabAr ?? s.ar, sv: s.tabSv ?? s.sv, subAr: list[si].subAr, subSv: list[si].subSv });
    rows.push({ k: 'title', id: `s${si}`, ar: s.ar, sv: s.sv });
    let role: Role | undefined;
    for (const it of s.items) {
      if (it.t === 'say') {
        if (it.r && it.r !== role) rows.push({ k: 'role', r: it.r });
        role = it.r;
        rows.push({ k: 'u', u: { t: it.f ? 'f' : 'p', ar: it.ar, sv: it.sv }, role: it.r });
        continue;
      }
      role = undefined;
      if (it.t === 'reading') reading(it);
      else if (it.t === 'praise') praise(s.praise ?? []);
      else if (it.t === 'lib') {
        u({ t: 'h', ar: it.ar, sv: '' });
        rows.push(...roleRows(it.units));
      } else u({ t: it.t, ar: it.ar, sv: it.sv });
    }
  });
  rows.push({ k: 'bottom' });

  function reading(r: HolyWeekReading) {
    if (r.psalm != null) {
      u({ t: 'ref', ar: `${r.kindAr}: مز ${toArDigits(r.psalm)}`, sv: `${r.kindSv} ${r.psalm}` });
      u({ t: 'note', ar: 'يُقرأ المزمور بترقيم الكنيسة من كتاب المزامير.', sv: 'Psalmen anges med kyrkans numrering, som skiljer sig från bibelns, så texten visas inte här.' });
      return;
    }
    if (!r.ref) return;
    // A reference line before each passage, as the Katameros' prophecies have; the reading's kind before the first.
    const parts = r.ref.split('/');
    for (const [pi, p] of parseRef(r.ref).entries()) {
      const label = readingLabel({ ...r, ref: parts[pi] }, books);
      u({ t: 'ref', ar: pi ? label.ar : `${r.kindAr}: ${label.ar}`, sv: pi ? label.sv : `${r.kindSv}: ${label.sv}` });
      if (r.wholeChapter && !pi && r.kind !== 'reading') u({ t: 'note', ar: 'يذكر المصدر الأصحاح كاملاً دون تحديد الآيات.', sv: 'Källan anger hela kapitlet, utan verser.' });
      let prevC: number | null = null;
      for (const { c, v } of versesOf(loaded.get(p.bid)!, p)) {
        u({ t: 'v', c, n: v[0], ar: v[1], sv: v[2] }, prevC !== null && c !== prevC);
        prevC = c;
      }
    }
  }

  function praise(said: string[]) {
    const p = week.praise;
    u({ t: 'rubric', ar: `${p.ar} (${toArDigits(p.repeat)} مرة)`, sv: `Påskveckans lovsång, ${p.repeat} gånger` });
    u({ t: 'st', ...p.stanza });
    for (const inv of p.invocations) if (said.includes(inv.from)) u({ t: 'st', ar: inv.ar, ca: inv.ca, cop: inv.cop });
  }

  return { rows, outline: { kind: 'sections', title: { ar: day.ar, sv: day.sv }, items } };
}

/**
 * For print, which sets text in two languages: a hymn stanza as its Arabic,
 * and under it the Coptic in Arabic letters as a line of its own.
 */
export function printableRows(rows: Row[]): Row[] {
  return rows.flatMap((r): Row[] => {
    if (r.k !== 'u' || r.u.t !== 'st') return [r];
    const { ar, ca, cop } = r.u;
    return [
      ...(ar ? [{ ...r, u: { t: 'p' as const, ar, sv: '' } }] : []),
      ...(ca || cop ? [{ ...r, u: { t: 'f' as const, ar: ca ?? cop, sv: '' } }] : []),
    ];
  });
}
