import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { alhanBooks } from '../assets/alhan';
import { hymnAssets, hymnGroups, synaxAssets } from '../assets/hymns';
import { agpeyaIndex, bibleAssets, books, katameros, kholagyIndex, prayerAssets } from '../assets/data';
import { holyWeekRows, type HolyWeek, type HolyWeekDay } from './holyweek';
import { isoDate } from './lib/coptic';
import { dayOverview, readingsFor } from './lib/lectionary';
import type { BookData, DayOverview, DayReadings, Hymn, Prayer, SynaxEntry } from './lib/types';

export { agpeyaIndex, alhanBooks, books, hymnGroups, katameros, kholagyIndex };

/** Holy Week's order (days, services, readings as references): small, so it ships with the code. */
export const holyWeek: HolyWeek = require('../assets/holyweek/holyweek.json');

/** One day of Holy Week as reader rows, its readings loaded from the Bible. */
export const useHolyWeekDay = (day: HolyWeekDay) => useAsync(() => holyWeekRows(day, holyWeek, books, loadBook), [day.id]);

// ---------- Bible books and prayers (assets, read on demand) ----------

async function readAsset<T>(module: number): Promise<T> {
  const asset = Asset.fromModule(module);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const text = Platform.OS === 'web' ? await (await fetch(uri)).text() : await new File(uri).text();
  return JSON.parse(text) as T;
}

/** Load an asset once; a failed load is forgotten so it can be tried again. */
function cached<K, T>(cache: Map<K, Promise<T>>, key: K, load: () => Promise<T>): Promise<T> {
  let p = cache.get(key);
  if (!p) {
    p = load();
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

const bookCache = new Map<number, Promise<BookData>>();
export const loadBook = (bid: number) => cached(bookCache, bid, () => readAsset<BookData>(bibleAssets[bid]));

export type PrayerBook = keyof typeof prayerAssets;
const prayerCache = new Map<PrayerBook, Promise<Prayer[]>>();
export const loadPrayers = (kind: PrayerBook) => cached(prayerCache, kind, () => readAsset<Prayer[]>(prayerAssets[kind]));

const hymnCache = new Map<string, Promise<Hymn[]>>();
export const loadHymns = (group: string) => cached(hymnCache, group, () => readAsset<Hymn[]>(hymnAssets[group]));

/** One Coptic month of the Synaxarium: day of the month → its commemorations. */
const synaxCache = new Map<number, Promise<Record<string, SynaxEntry[]>>>();
export const loadSynax = (month: number) => cached(synaxCache, month, () => readAsset<Record<string, SynaxEntry[]>>(synaxAssets[month]));

export const getReadings = (d: Date) => readingsFor(d, katameros, books, { book: loadBook, synax: loadSynax });

/** The day's sections as titles and references: at once, with no Bible books loaded. Kept per day. */
let overview: DayOverview | null = null;
export function getOverview(d: Date): DayOverview {
  if (overview?.iso !== isoDate(d)) overview = dayOverview(d, katameros, books);
  return overview;
}

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

/** One hour of the Agpeya or one liturgy, loaded when opened. */
export const usePrayer = (kind: PrayerBook, id: string) =>
  useAsync(() => loadPrayers(kind).then((all) => all.find((p) => p.id === id) ?? all[0]), [kind, id]);

/** A hymn whose title or text (Arabic, or Coptic in Arabic letters) holds a normalised Arabic query. */
export const hymnMatches = (h: Hymn, q: string) =>
  normalizeAr(h.ar).includes(q) || h.units.some((u) => (u.ar && normalizeAr(u.ar).includes(q)) || (u.ca && normalizeAr(u.ca).includes(q)));

/** Every hymn text whose title or text holds the query, with its group; loads the groups not yet read. */
export async function searchHymns(query: string, limit = 80): Promise<{ hits: { group: string; hymn: Hymn }[]; more: boolean }> {
  const q = normalizeAr(query.trim());
  const hits: { group: string; hymn: Hymn }[] = [];
  if (q.length < 2) return { hits, more: false };
  const all = await Promise.all(hymnGroups.map(async (g) => [g.id, await loadHymns(g.id)] as const));
  for (const [group, hymns] of all) {
    for (const hymn of hymns) {
      if (!hymnMatches(hymn, q)) continue;
      if (hits.length === limit) return { hits, more: true };
      hits.push({ group, hymn });
    }
  }
  return { hits, more: false };
}

/** One group of hymn texts, loaded when opened. */
export const useHymns = (group: string) => useAsync(() => loadHymns(group), [group]);

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
