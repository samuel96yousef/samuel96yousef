/**
 * Pages for the open book: the text as facing pages, Swedish on one and
 * Arabic on the other, like a printed bilingual service book.
 *
 * Rows stay aligned: a row starts at the same height on both pages and is as
 * tall as its longer side, as in the scrolling spread. A spread ends between
 * rows, and never just after a heading. Rather than leave much of a page
 * empty, a paragraph flows on to the next spread, keeping at least two lines
 * on each side of the break; a paragraph taller than a page always does.
 * Each side breaks between two of its own lines, so no line is cut in half.
 */

export type BookLang = 'sv' | 'ar';

/** Where the lines of one side of a row fall: the first starts at `top`, then one every `lh`. */
export interface Grid { top: number; lh: number }
export interface Cell { h: number; grid: Grid | null }
export interface BookRow { sv: Cell; ar: Cell; /** keep with the next row (headings) */ keep: boolean }

/** The part of the text a page shows, as positions in the aligned column. */
export interface Window { s: number; e: number }
export interface Spread { sv: Window; ar: Window; first: number; last: number }
export interface BookLayout { tops: number[]; spreads: Spread[] }

/** A spread with less room than this for text shows none (the first spread, under a tall header). */
export const MIN_PAGE = 96;
/** Leave no more of a page than this empty when a paragraph could flow on instead. */
const MAX_GAP = 0.2;

/**
 * Lay the rows out as spreads. `room(k)` is the height for text on spread k.
 * Until every row is measured the last spread may be cut short, so it is left out.
 */
export function layoutBook(rows: BookRow[], room: (k: number) => number, complete = true): BookLayout {
  const n = rows.length;
  const tops = [0];
  for (const r of rows) tops.push(tops[tops.length - 1] + Math.max(r.sv.h, r.ar.h));
  const total = tops[n];
  const spreads: Spread[] = [];
  if (!n) return { tops, spreads };

  // The row that position y falls in.
  const rowAt = (y: number) => {
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (tops[m] <= y) lo = m; else hi = m - 1;
    }
    return lo;
  };

  // The lowest place at or above y where one side's page can end without cutting a line.
  const snap = (lang: BookLang, y: number, from: number) => {
    if (y >= total) return total;
    const j = rowAt(y);
    const { h, grid } = rows[j][lang];
    const t = tops[j];
    if (y >= t + h) return y; // below this side's text the row is blank
    if (grid) {
      const lines = Math.floor((y - t - grid.top) / grid.lh + 1e-6);
      const b = t + grid.top + lines * grid.lh;
      if (lines >= 1 && b > from) return b;
    }
    return t > from ? t : y;
  };

  // Break row j at y, if that leaves at least two of its lines on each side of the break.
  const flow = (j: number, y: number) => {
    const row = rows[j];
    if (row.keep) return null;
    const t = tops[j];
    const out = { sv: y, ar: y };
    for (const l of ['sv', 'ar'] as const) {
      const { h, grid } = row[l];
      if (y >= t + h) continue; // this side's text ends above the break
      if (!grid) return null;
      const lines = Math.floor((y - t - grid.top) / grid.lh + 1e-6);
      const all = Math.floor((h - grid.top) / grid.lh + 1e-6);
      if (lines < 2 || all - lines < 2) return null;
      out[l] = t + grid.top + lines * grid.lh;
    }
    return out;
  };

  let s = { sv: 0, ar: 0 };
  for (let k = 0; (s.sv < total || s.ar < total) && k < 20000; k++) {
    const h = room(k);
    let end = s;
    if (h >= MIN_PAGE) {
      const lo = Math.max(s.sv, s.ar);
      const e = Math.min(s.sv, s.ar) + h;
      if (e >= total) end = { sv: total, ar: total };
      else {
        const r = rowAt(e);
        let j = r;
        // A heading stays with the text after it.
        while (j > 0 && rows[j - 1].keep && tops[j - 1] > lo) j--;
        if (tops[j] > lo) end = (e - tops[j] > h * MAX_GAP && flow(r, e)) || { sv: tops[j], ar: tops[j] };
        else end = { sv: snap('sv', e, s.sv), ar: snap('ar', e, s.ar) };
      }
      // Always move on, even past something that cannot be broken.
      if (end.sv <= s.sv && end.ar <= s.ar) end = { sv: Math.min(total, s.sv + h), ar: Math.min(total, s.ar + h) };
    }
    spreads.push({
      sv: { s: s.sv, e: end.sv },
      ar: { s: s.ar, e: end.ar },
      first: rowAt(Math.min(s.sv, s.ar)),
      last: rowAt(Math.max(Math.max(end.sv, end.ar) - 0.5, 0)),
    });
    s = end;
  }
  if (!complete) spreads.pop();
  return { tops, spreads };
}

/** The spread on which a row begins, or -1 if it is not laid out yet. */
export function spreadOf({ tops, spreads }: BookLayout, row: number): number {
  const y = tops[row];
  if (y === undefined) return -1;
  let lo = 0;
  let hi = spreads.length - 1;
  let found = -1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    const sp = spreads[m];
    if (Math.max(sp.sv.e, sp.ar.e) > y) { found = m; hi = m - 1; } else lo = m + 1;
  }
  return found;
}

/** The rows a page shows. */
export function rowsIn(tops: number[], w: Window): number[] {
  const out: number[] = [];
  for (let j = 0; j < tops.length - 1; j++) {
    if (tops[j] >= w.e) break;
    if (tops[j + 1] > w.s) out.push(j);
  }
  return out;
}
