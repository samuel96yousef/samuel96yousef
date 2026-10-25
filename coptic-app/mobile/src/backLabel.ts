/**
 * The back button's label names the screen it goes back to: the page in this
 * stack before the current one, or, when the screen was opened from another
 * tab (Today's "Be nu"), that tab.
 */
import { useNavigation } from 'expo-router';

import type { Strings } from './i18n';

const SCREENS: Record<string, keyof Pick<Strings, 'agpeya' | 'kholagy' | 'alhan' | 'prayers' | 'bible' | 'today' | 'readings'>> = {
  agpeya: 'agpeya',
  kholagy: 'kholagy',
  'alhan/index': 'alhan',
  index: 'prayers',
};

export function useBackLabel(t: Strings): string {
  const nav = useNavigation();
  const state = nav.getState();
  const prev = state && state.index > 0 ? state.routes[state.index - 1]?.name : undefined;
  if (prev && SCREENS[prev]) return t[SCREENS[prev]];
  // First in its stack: back leaves the tab, for the one it came from.
  const tabs = nav.getParent()?.getState();
  const history = (tabs as { history?: { type: string; key: string }[] } | undefined)?.history;
  const from = history && history.length > 1 ? history[history.length - 2]?.key : undefined;
  const tab = from ? tabs?.routes.find((r) => r.key === from)?.name : undefined;
  return tab === 'index' ? t.today : tab === 'readings' ? t.readings : tab === 'bible' ? t.bible : t.prayers;
}
