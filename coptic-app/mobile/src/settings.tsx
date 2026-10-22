import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';

import { STRINGS, type Strings } from './i18n';
import type { Lang } from './lib/types';
import { DARK, LIGHT, PAGES, SPREAD_MIN_WIDTH, type PagePalette, type Palette, type ReadTheme } from './theme';

export type Show = Lang | 'both';
export type SpreadPref = 'auto' | 'on' | 'off';

export interface Settings {
  lang: Lang;
  /** The language a single page is read in. */
  primary: Lang;
  show: Show;
  scale: number;
  read: ReadTheme;
  spreadPref: SpreadPref;
  hints: Record<string, boolean>;
}

interface SettingsContext extends Settings {
  ready: boolean;
  t: Strings;
  colors: Palette;
  page: PagePalette;
  dark: boolean;
  /** Wide enough (or forced) to show the open-book spread. */
  spread: boolean;
  set: (patch: Partial<Settings>) => void;
  /** Switch the app language; the reading language follows. */
  setLang: (lang: Lang) => void;
  /** Mark a one-time hint as shown. Returns true the first time. */
  hintOnce: (key: string) => boolean;
}

const KEY = 'settings.v1';
const deviceLang: Lang = getLocales().some((l) => l.languageCode === 'ar') ? 'ar' : 'sv';
const DEFAULTS: Settings = { lang: deviceLang, primary: deviceLang, show: deviceLang, scale: 1, read: 'auto', spreadPref: 'auto', hints: {} };

const Ctx = createContext<SettingsContext | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();
  const { width } = useWindowDimensions();

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) setS({ ...DEFAULTS, ...JSON.parse(raw) }); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const set = useCallback((patch: Partial<Settings>) => {
    setS((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setLang = useCallback((lang: Lang) => {
    setS((prev) => {
      const next: Settings = { ...prev, lang, primary: lang, show: prev.show === 'both' ? 'both' : lang };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const hintOnce = useCallback((key: string) => {
    if (s.hints[key]) return false;
    set({ hints: { ...s.hints, [key]: true } });
    return true;
  }, [s.hints, set]);

  const value = useMemo<SettingsContext>(() => {
    const dark = scheme === 'dark';
    const page = PAGES[s.read === 'auto' ? (dark ? 'night' : 'paper') : s.read];
    const spread = s.spreadPref === 'on' || (s.spreadPref === 'auto' && width >= SPREAD_MIN_WIDTH);
    return { ...s, ready, t: STRINGS[s.lang], colors: dark ? DARK : LIGHT, page, dark, spread, set, setLang, hintOnce };
  }, [s, ready, scheme, width, set, setLang, hintOnce]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside SettingsProvider');
  return v;
}
