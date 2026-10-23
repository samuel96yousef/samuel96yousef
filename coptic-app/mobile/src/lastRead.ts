/**
 * The chapter last opened in each Bible book, for "continue reading".
 * Kept apart from the settings, so marking a chapter does not re-render
 * every page that reads the settings.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'lastRead.v1';
let chapters: Record<number, number> = {};
let loaded = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

function load() {
  if (loaded) return;
  loaded = true;
  AsyncStorage.getItem(KEY)
    .then((raw) => {
      if (!raw) return;
      // Chapters marked before the stored ones arrived win.
      chapters = { ...JSON.parse(raw), ...chapters };
      notify();
    })
    .catch(() => {});
}

export function markRead(bid: number, chapter: number) {
  load();
  if (chapters[bid] === chapter) return;
  chapters = { ...chapters, [bid]: chapter };
  notify();
  AsyncStorage.setItem(KEY, JSON.stringify(chapters)).catch(() => {});
}

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** The chapter last opened in a book, if any. */
export function useLastRead(bid: number): number | undefined {
  load();
  return useSyncExternalStore(subscribe, () => chapters[bid], () => chapters[bid]);
}
