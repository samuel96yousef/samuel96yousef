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

export function chapterRows(book: BibleBook, chapter: number, verses: Verse[], highlight?: number): Row[] {
  return [
    { k: 'top' },
    { k: 'run', ar: book.ar, sv: book.sv },
    { k: 'cart', ar: `الأصحاح ${toArDigits(chapter)}`, sv: `Kapitel ${chapter}` },
    ...verses.map(([n, ar, sv]): Row => ({ k: 'u', u: { t: 'v', c: chapter, n, ar, sv }, highlight: n === highlight })),
    { k: 'bottom' },
  ];
}
