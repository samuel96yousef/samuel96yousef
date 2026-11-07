/**
 * The text open in the reader, for the sidebar on a large screen: its
 * landmarks, where the reader is, and a way to jump. The reader publishes
 * itself here while it shows; the sidebar lists the landmarks as the table of
 * contents, with the current one marked.
 */
import { useSyncExternalStore } from 'react';

import type { WayStore } from './components/Wayfinder';
import type { Outline } from './rows';

export interface ReaderLink {
  outline: Outline;
  store: WayStore;
  jump: (index: number, fade: boolean) => void;
}

let link: ReaderLink | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** Publish a reader; returns the function that withdraws it again. */
export function publishReader(next: ReaderLink) {
  link = next;
  emit();
  return () => {
    if (link === next) { link = null; emit(); }
  };
}

export const useReaderLink = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => link, () => link);
