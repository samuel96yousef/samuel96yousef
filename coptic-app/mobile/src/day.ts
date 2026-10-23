/**
 * The day the readings are for, shared by "Today" and "Readings": pick a day
 * on one and the other follows. It is today unless the reader picks another
 * day, and a pick does not linger: at midnight, or when the app comes back
 * after half an hour away, it is today again.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { fromIso, isoDate } from './lib/coptic';

const AWAY_MS = 30 * 60 * 1000;

/** The day picked, and the real day it was picked on. */
let picked: { iso: string; on: string } | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

/** Read another day; picking today goes back to following the clock. */
export function pickDay(d: Date) {
  const today = isoDate(new Date());
  const iso = isoDate(d);
  const next = iso === today ? null : { iso, on: today };
  if (next?.iso === picked?.iso && next?.on === picked?.on) return;
  picked = next;
  notify();
}

let awayAt = 0;
AppState.addEventListener('change', (state) => {
  if (state !== 'active') { awayAt = Date.now(); return; }
  if (picked && awayAt && Date.now() - awayAt > AWAY_MS) { picked = null; notify(); }
  awayAt = 0;
});

/** Today's date as "YYYY-MM-DD", updated at midnight and when the app comes back. */
export function useTodayIso() {
  const [today, setToday] = useState(() => isoDate(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const n = new Date();
      const midnight = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => { setToday(isoDate(new Date())); arm(); }, midnight.getTime() - n.getTime());
    };
    arm();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setToday(isoDate(new Date())); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, []);
  return today;
}

/** The day to show readings for, and whether it is today. */
export function useReadingDay(): { day: Date; isToday: boolean } {
  const today = useTodayIso();
  const p = useSyncExternalStore(subscribe, () => picked, () => picked);
  // A day picked yesterday has lapsed.
  const iso = p && p.on === today ? p.iso : today;
  const day = useMemo(() => fromIso(iso), [iso]);
  return { day, isToday: iso === today };
}
