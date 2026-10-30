import fs from 'fs';
import path from 'path';

import { alhanOutline, itemAt, itemsOf } from '../src/alhan';
import type { AlhanBook } from '../src/lib/types';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}) }));

const page = (no: number) => ({ src: 0, w: 1000, h: 1500, no });
// Two parts; two items share a page, as in the book (page 27).
const book: AlhanBook = {
  id: 'test', ar: 'كتاب', sv: 'Bok', subAr: '', subSv: '', source: '', cover: { src: 0, w: 1, h: 1 },
  pages: [1, 2, 3, 4, 5, 6].map(page),
  parts: [
    { ar: 'أ', sv: 'A', page: 0, items: [{ ar: 'a1', sv: 'a1', page: 1 }, { ar: 'a2', sv: 'a2', page: 3 }, { ar: 'a3', sv: 'a3', page: 3 }] },
    { ar: 'ب', sv: 'B', page: 4, items: [{ ar: 'b1', sv: 'b1', page: 5 }] },
  ],
};

describe('alhan', () => {
  const items = itemsOf(book);

  test('items keep the book order and know their part', () => {
    expect(items.map((it) => [it.sv, it.part])).toEqual([['a1', 0], ['a2', 0], ['a3', 0], ['b1', 1]]);
  });

  test('a page belongs to the last item that starts on or before it', () => {
    expect(itemAt(items, 0)).toBe(-1);
    expect(itemAt(items, 1)).toBe(0);
    expect(itemAt(items, 2)).toBe(0);
    // Two items on one page: the page is the later one's.
    expect(itemAt(items, 3)).toBe(2);
    expect(itemAt(items, 4)).toBe(2);
    expect(itemAt(items, 5)).toBe(3);
  });

  test('the outline jumps to pages', () => {
    expect(alhanOutline(book).items.map((it) => it.index)).toEqual([1, 3, 3, 5]);
  });

  test('the fast book lists its contents in page order, as its register does', () => {
    const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '../scripts/alhan/lent.json'), 'utf8'));
    const pages: number[] = spec.parts.flatMap((p: { items: { page: number }[] }) => p.items.map((it) => it.page));
    expect(pages).toHaveLength(55);
    expect(pages).toEqual([...pages].sort((a, b) => a - b));
    expect(Math.max(...pages)).toBeLessThanOrEqual(130);
  });
});
