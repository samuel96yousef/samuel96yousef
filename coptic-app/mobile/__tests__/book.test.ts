import { layoutBook, rowsIn, spreadOf, type BookRow, type Grid } from '../src/book';

const SV: Grid = { top: 5, lh: 29 };
const AR: Grid = { top: 5, lh: 45 };
const text = (svLines: number, arLines: number, keep = false): BookRow => ({
  sv: { h: SV.top * 2 + svLines * SV.lh, grid: SV },
  ar: { h: AR.top * 2 + arLines * AR.lh, grid: AR },
  keep,
});
const heading = (h = 60): BookRow => ({ sv: { h, grid: null }, ar: { h, grid: null }, keep: true });
const ROOM = 600;

/** Every spread follows on from the last, fits its room, and the spreads cover the whole text. */
function checkCover(rows: BookRow[], room = ROOM) {
  const { tops, spreads } = layoutBook(rows, () => room);
  const total = tops[tops.length - 1];
  spreads.forEach((sp, k) => {
    for (const l of ['sv', 'ar'] as const) {
      expect(sp[l].e - sp[l].s).toBeLessThanOrEqual(room + 0.001);
      expect(sp[l].e).toBeGreaterThanOrEqual(sp[l].s);
      if (k) expect(sp[l].s).toBe(spreads[k - 1][l].e);
    }
    expect(Math.max(sp.sv.e - sp.sv.s, sp.ar.e - sp.ar.s)).toBeGreaterThan(0);
  });
  expect(spreads[0].sv.s).toBe(0);
  expect(spreads[spreads.length - 1].sv.e).toBe(total);
  expect(spreads[spreads.length - 1].ar.e).toBe(total);
  return { tops, spreads };
}

describe('The open book', () => {
  it('ends spreads between rows, at the same place on both pages', () => {
    const rows = Array.from({ length: 30 }, (_, i) => text(1 + (i % 3), 1 + ((i + 1) % 3)));
    const { tops, spreads } = checkCover(rows);
    for (const sp of spreads) {
      expect(sp.sv.e).toBe(sp.ar.e);
      expect(tops).toContain(sp.sv.e);
    }
  });

  it('never ends a spread on a heading', () => {
    // The heading would just fit at the bottom of the first spread.
    const rows = [text(4, 3), text(4, 3), text(4, 3), heading(80), text(6, 4), text(2, 2)];
    const { tops, spreads } = checkCover(rows);
    expect(spreads[0].sv.e).toBe(tops[3]);
    expect(spreads[1].first).toBe(3);
  });

  it('lets a paragraph flow on rather than leave a page half empty, two lines either side', () => {
    const rows = [text(4, 3), text(4, 3), text(4, 3), text(12, 9), text(2, 2)];
    const { tops, spreads } = checkCover(rows);
    expect(spreads[0].sv.e).toBe(tops[3] + SV.top + 5 * SV.lh);
    expect(spreads[0].ar.e).toBe(tops[3] + AR.top + 3 * AR.lh);
    // Too short to leave two lines on each side: it moves whole.
    const short = checkCover([text(4, 3), text(4, 3), text(4, 3), text(3, 3), text(2, 2), text(2, 2)], 520);
    expect(short.spreads[0].sv.e).toBe(short.spreads[0].ar.e);
  });

  it('carries a row taller than a page over, breaking each side between its own lines', () => {
    const rows = [text(2, 2), text(40, 30), text(3, 2)];
    const { tops, spreads } = checkCover(rows);
    expect(spreads.length).toBeGreaterThan(2);
    for (const sp of spreads.slice(0, -1)) {
      for (const [l, g] of [['sv', SV], ['ar', AR]] as const) {
        const e = sp[l].e;
        if (e <= tops[1] || e >= tops[1] + rows[1][l].h) continue; // a row boundary or the blank below
        expect(((e - tops[1] - g.top) / g.lh) % 1).toBeCloseTo(0, 6);
      }
    }
  });

  it('finds the spread a row begins on', () => {
    const rows = Array.from({ length: 40 }, () => text(3, 2));
    const layout = checkCover(rows);
    for (let j = 0; j < rows.length; j++) {
      const k = spreadOf(layout, j);
      expect(rowsIn(layout.tops, layout.spreads[k].sv)).toContain(j);
    }
    expect(spreadOf(layout, 999)).toBe(-1);
  });

  it('leaves the first spread empty when the header leaves no room', () => {
    const rows = Array.from({ length: 10 }, () => text(3, 2));
    const { spreads } = layoutBook(rows, (k) => (k === 0 ? 40 : ROOM));
    expect(spreads[0].sv).toEqual({ s: 0, e: 0 });
    expect(spreads[1].sv.s).toBe(0);
  });

  it('holds back the last spread until every row is measured', () => {
    const rows = Array.from({ length: 40 }, () => text(3, 2));
    expect(layoutBook(rows, () => ROOM, false).spreads.length).toBe(layoutBook(rows, () => ROOM).spreads.length - 1);
  });
});
