/**
 * The Alhan section's hymn books: where each item starts, which item a page
 * belongs to, and the page last read in each book, for "continue". The place
 * is kept apart from the settings, like the Bible's last chapter, so turning
 * a page does not re-render every screen that reads the settings.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { AlhanBook } from './lib/types';
import type { Outline } from './rows';

export interface AlhanItem {
  ar: string;
  sv: string;
  /** Index into the book's pages */
  page: number;
  /** The part it belongs to */
  part: number;
}

/** Every item of the book, in the book's order. */
export const itemsOf = (book: AlhanBook): AlhanItem[] =>
  book.parts.flatMap((p, part) => p.items.map((it) => ({ ...it, part })));

/** The item a page belongs to: the last one that starts on or before it; -1 before the first. */
export function itemAt(items: AlhanItem[], page: number): number {
  let at = -1;
  for (let i = 0; i < items.length && items[i].page <= page; i++) at = i;
  return at;
}

/** The book's items as the reader's outline, for the sidebar's table of contents; an item's index is its page. */
export const alhanOutline = (book: AlhanBook): Outline => ({
  kind: 'sections',
  title: { ar: book.ar, sv: book.sv },
  items: itemsOf(book).map((it) => ({ index: it.page, level: 1, ar: it.ar, sv: it.sv })),
});

const KEY = 'alhanPlace.v1';
let places: Record<string, number> = {};
let loaded = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      places = { ...JSON.parse(raw), ...places };
      notify();
    })
    .catch(() => {});
}

/** Remember the page being read in a book. */
export function markPlace(book: string, page: number) {
  load();
  if (places[book] === page) return;
  places = { ...places, [book]: page };
  notify();
  AsyncStorage.setItem(KEY, JSON.stringify(places)).catch(() => {});
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** The page last read in a book, if any. */
export function usePlace(book: string): number | undefined {
  load();
  return useSyncExternalStore(subscribe, () => places[book], () => places[book]);
}
