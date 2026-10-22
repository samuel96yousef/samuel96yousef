/** Turns readings, prayers and Bible chapters into reader rows. */
import type { Row } from './components/Reader';
import { copticText, dayTitle, gregorianText, observances, toArDigits } from './lib/coptic';
import type { BibleBook, DayReadings, Prayer, Role, Unit, Verse } from './lib/types';

function unitRows(units: Unit[]): Row[] {
  const rows: Row[] = [];
  let prevC: number | null = null;
  for (const u of units) {
    rows.push({ k: 'u', u, showC: u.t === 'v' && prevC !== null && u.c !== prevC });
    if (u.t === 'v') prevC = u.c ?? null;
  }
  return rows;
}

export function dayRows(r: DayReadings, d: Date, holyWeek: { ar: string; sv: string }): Row[] {
  const c = r.coptic;
  const rows: Row[] = [
    { k: 'top' },
    { k: 'run', ar: copticText(c, 'ar'), sv: `${copticText(c, 'sv')} · ${gregorianText(d, 'sv', false).toLowerCase()}` },
    { k: 'cart', ar: dayTitle(c, 'ar'), sv: dayTitle(c, 'sv') },
  ];
  const obs = observances(d);
  if (obs.length) rows.push({ k: 'feast', items: obs.map((o) => ({ ar: o.ar, sv: o.sv })) });
  if (r.season === 'holy_week') rows.push({ k: 'u', u: { t: 'note', ...holyWeek } });
  r.sections.forEach((s, i) => {
    rows.push({ k: 'title', id: s.key, ar: s.ar, sv: s.sv, capAr: s.captionAr, capSv: s.captionSv });
    rows.push(...unitRows(s.units));
    if (i < r.sections.length - 1) rows.push({ k: 'sep' });
  });
  rows.push({ k: 'bottom' });
  return rows;
}

export const sectionIndex = (rows: Row[], id: string) => rows.findIndex((r) => r.k === 'title' && r.id === id);

export function prayerRows(p: Prayer, run: { ar: string; sv: string }): Row[] {
  return [{ k: 'top' }, { k: 'run', ...run }, { k: 'cart', ar: p.ar, sv: p.sv }, ...unitRows(p.units), { k: 'bottom' }];
}

/** Liturgy rows: a role marker opens a block; the role colours the text until the next marker. */
export function liturgyRows(p: Prayer): Row[] {
  const rows: Row[] = [{ k: 'top' }, { k: 'run', ar: 'الخولاجي', sv: 'Kholagy' }, { k: 'cart', ar: p.ar, sv: p.sv }];
  let role: Role | undefined;
  let pending: Role | undefined;
  for (const u of p.units) {
    if (u.t === 'role') { pending = u.r; continue; }
    if (u.t === 'H') { rows.push({ k: 'u', u }); continue; }
    if (pending && (u.t === 'p' || u.t === 'secret')) {
      rows.push({ k: 'role', r: pending });
      role = pending;
      pending = undefined;
    }
    rows.push({ k: 'u', u, role: u.t === 'p' || u.t === 'secret' ? role : undefined });
  }
  rows.push({ k: 'bottom' });
  return rows;
}

/** Headings in a liturgy, for the jump chips. */
export const headingIndexes = (rows: Row[]) =>
  rows.flatMap((r, i) => (r.k === 'u' && r.u.t === 'H' ? [{ i, ar: r.u.ar ?? '', sv: r.u.sv ?? '' }] : []));

// ---------- Outlines: the landmarks of a text, for the wayfinder ----------

export interface OutlineItem {
  /** Row the item starts at */
  index: number;
  /** 1 for a section or main heading, 2 for a subheading or a verse */
  level: 1 | 2;
  ar: string;
  sv: string;
  subAr?: string;
  subSv?: string;
}

export interface Outline {
  kind: 'sections' | 'verses';
  title: { ar: string; sv: string };
  items: OutlineItem[];
}

/** The day's readings, each with its references. */
export function dayOutline(r: DayReadings, rows: Row[]): Outline {
  return {
    kind: 'sections',
    title: { ar: dayTitle(r.coptic, 'ar'), sv: dayTitle(r.coptic, 'sv') },
    items: r.sections.map((s) => ({
      index: sectionIndex(rows, s.key), level: 1, ar: s.ar, sv: s.sv,
      subAr: toArDigits(s.refs.ar.join(' · ')), subSv: s.refs.sv.join(' · '),
    })),
  };
}

/**
 * Headings in a prayer or liturgy. Subheadings are not tied to the heading
 * above them: in the Agpeya data the psalms follow "Our Father", which is
 * not what they belong to.
 */
export function headingOutline(rows: Row[], title: { ar: string; sv: string }): Outline {
  const items = rows.flatMap((r, index): OutlineItem[] => {
    if (r.k !== 'u' || (r.u.t !== 'H' && r.u.t !== 'h')) return [];
    const ar = r.u.ar ?? '';
    return [{ index, level: r.u.t === 'H' ? 1 : 2, ar, sv: r.u.sv || ar }];
  });
  return { kind: 'sections', title, items };
}

/** Every verse of a chapter; every fifth one is a landmark on the rail. */
export function verseOutline(rows: Row[], title: { ar: string; sv: string }): Outline {
  const items = rows.flatMap((r, index): OutlineItem[] =>
    r.k === 'u' && r.u.t === 'v' && r.u.n != null
      ? [{ index, level: r.u.n === 1 || r.u.n % 5 === 0 ? 1 : 2, ar: toArDigits(r.u.n), sv: String(r.u.n) }]
      : []);
  return { kind: 'verses', title, items };
}

/** Who is speaking at a row of a liturgy: the nearest role at or after it, else before it. */
export function roleAt(rows: Row[], i: number, span = 12): Role | undefined {
  for (let j = i; j < Math.min(rows.length, i + span); j++) {
    const r = rows[j];
    if (r.k === 'role') return r.r;
    if (r.k === 'u' && r.role) return r.role;
    if (r.k === 'u' && r.u.t === 'H') break;
  }
  for (let j = i - 1; j >= Math.max(0, i - span); j--) {
    const r = rows[j];
    if (r.k === 'role') return r.r;
    if (r.k === 'u' && r.role) return r.role;
  }
  return undefined;
}

/** Index of the last item that starts at or before a row; -1 before the first. */
export function itemAt(items: OutlineItem[], row: number) {
  let lo = 0;
  let hi = items.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (items[mid].index <= row) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

/**
 * Rough height of every row, so the rail can space its marks like the text:
 * a long reading gets a long stretch, a short one a short stretch.
 * Returns the running total, one longer than `rows`.
 */
export function rowWeights(rows: Row[], primary: 'ar' | 'sv', both: boolean): number[] {
  const lines = (s: string | undefined, perLine: number) => (s ? Math.ceil(s.length / perLine) : 0);
  const cum = [0];
  for (const r of rows) {
    let w = 1;
    if (r.k === 'title' || r.k === 'cart') w = 3;
    else if (r.k === 'sep' || r.k === 'run') w = 2;
    else if (r.k === 'feast') w = 1.5 * r.items.length;
    else if (r.k === 'u') {
      const main = primary === 'ar' ? lines(r.u.ar, 34) * 1.55 : lines(r.u.sv, 40);
      const alt = both ? (primary === 'ar' ? lines(r.u.sv, 46) * 0.9 : lines(r.u.ar, 40) * 1.2) : 0;
      w = 0.4 + main + alt;
    }
    cum.push(cum[cum.length - 1] + w);
  }
  return cum;
}

export function chapterRows(book: BibleBook, chapter: number, verses: Verse[], highlight?: number): Row[] {
  return [
    { k: 'top' },
    { k: 'run', ar: book.ar, sv: book.sv },
    { k: 'cart', ar: `الأصحاح ${toArDigits(chapter)}`, sv: `Kapitel ${chapter}` },
    ...verses.map(([n, ar, sv]): Row => ({ k: 'u', u: { t: 'v', c: chapter, n, ar, sv }, highlight: n === highlight })),
    { k: 'bottom' },
  ];
}
