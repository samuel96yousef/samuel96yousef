import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { agpeya, bibleAssets, books, katameros, kholagy } from '../assets/data';
import { readingsFor } from './lib/lectionary';
import type { BookData, DayReadings } from './lib/types';

export { agpeya, books, katameros, kholagy };

// ---------- Bible books (assets, read on demand) ----------

const bookCache = new Map<number, Promise<BookData>>();

export function loadBook(bid: number): Promise<BookData> {
  let p = bookCache.get(bid);
  if (!p) {
    p = (async () => {
      const asset = Asset.fromModule(bibleAssets[bid]);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      const text = Platform.OS === 'web' ? await (await fetch(uri)).text() : await new File(uri).text();
      return JSON.parse(text) as BookData;
    })();
    p.catch(() => bookCache.delete(bid));
    bookCache.set(bid, p);
  }
  return p;
}

export const getReadings = (d: Date) => readingsFor(d, katameros, books, { book: loadBook });

/** Run an async loader when `deps` change. Keeps the previous data while the next loads. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState<{ key?: string; data?: T; error?: Error }>({});
  useEffect(() => {
    let live = true;
    fn().then(
      (data) => { if (live) setState({ key, data }); },
      (error: Error) => { if (live) setState((s) => ({ key, data: s.data, error })); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data: state.data, error: state.key === key ? state.error : undefined, loading: state.key !== key };
}

export const useReadings = (d: Date): { data?: DayReadings; error?: Error; loading: boolean } =>
  useAsync(() => getReadings(d), [d.getFullYear(), d.getMonth(), d.getDate()]);

// ---------- Search ----------

const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
export const normalizeAr = (s: string) =>
  s.replace(AR_MARKS, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
export const normalizeSv = (s: string) => s.toLocaleLowerCase('sv-SE');
export const isArabic = (s: string) => /[؀-ۿ]/.test(s);

interface IndexedVerse {
  bid: number;
  c: number;
  v: number;
  ar: string;
  sv: string;
  arN: string;
  svN: string;
}

let index: IndexedVerse[] | null = null;
let indexing: Promise<IndexedVerse[]> | null = null;

/** Load every book once and keep a normalised copy for searching. */
export function bibleIndex(onProgress?: (done: number, total: number) => void): Promise<IndexedVerse[]> {
  if (index) return Promise.resolve(index);
  if (!indexing) {
    indexing = (async () => {
      const out: IndexedVerse[] = [];
      let done = 0;
      const ids = books.map((b) => b.bid);
      // A few at a time keeps memory and file handles in check.
      for (let i = 0; i < ids.length; i += 6) {
        const batch = await Promise.all(ids.slice(i, i + 6).map(async (bid) => [bid, await loadBook(bid)] as const));
        for (const [bid, data] of batch) {
          for (const [c, verses] of data) {
            for (const [v, ar, sv] of verses) out.push({ bid, c, v, ar, sv, arN: normalizeAr(ar), svN: normalizeSv(sv) });
          }
          onProgress?.(++done, ids.length);
        }
      }
      index = out;
      return out;
    })();
    indexing.catch(() => { indexing = null; });
  }
  return indexing;
}

export interface SearchResult {
  hits: IndexedVerse[];
  more: boolean;
  arabic: boolean;
  terms: string[];
}

export async function searchBible(query: string, limit = 200): Promise<SearchResult> {
  const arabic = isArabic(query);
  const terms = (arabic ? normalizeAr(query) : normalizeSv(query)).split(/\s+/).filter((w) => w.length > 1);
  if (!terms.length) return { hits: [], more: false, arabic, terms };
  const all = await bibleIndex();
  const hits: IndexedVerse[] = [];
  for (const v of all) {
    const hay = arabic ? v.arN : v.svN;
    if (terms.every((w) => hay.includes(w))) {
      if (hits.length === limit) return { hits, more: true, arabic, terms };
      hits.push(v);
    }
  }
  return { hits, more: false, arabic, terms };
}
