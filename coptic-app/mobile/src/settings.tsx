import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColorScheme, useWindowDimensions } from 'react-native';

import { STRINGS, type Strings } from './i18n';
import type { Lang } from './lib/types';
import { DARK, LIGHT, PAGES, SPREAD_MIN_HEIGHT, SPREAD_MIN_WIDTH, type PagePalette, type Palette, type ReadTheme } from './theme';

export type Show = Lang | 'both';
export type SpreadPref = 'auto' | 'on' | 'off';
/** Where the reader's side dock rests: the screen edge, and how far down between the bars (0–1). */
export interface DockPlace { side: 'left' | 'right'; y: number }

export interface Settings {
  lang: Lang;
  /** The language a single page is read in. */
  primary: Lang;
  show: Show;
  scale: number;
  read: ReadTheme;
  spreadPref: SpreadPref;
  /** One-time hints already shown. Kept out of React state: marking one must not re-render every page. */
  hints: Record<string, boolean>;
  dock: DockPlace;
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
// The dock starts on the right, a little below the middle: where a right thumb rests.
const DEFAULTS: Settings = { lang: deviceLang, primary: deviceLang, show: deviceLang, scale: 1, read: 'auto', spreadPref: 'auto', hints: {}, dock: { side: 'right', y: 0.62 } };

const Ctx = createContext<SettingsContext | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();
  const { width, height } = useWindowDimensions();
  const hints = useRef<Record<string, boolean>>({});
  const latest = useRef(s);
  useEffect(() => { latest.current = s; }, [s]);

  const save = useCallback((next: Settings) => {
    AsyncStorage.setItem(KEY, JSON.stringify({ ...next, hints: hints.current })).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const stored: Settings = { ...DEFAULTS, ...JSON.parse(raw) };
        hints.current = stored.hints ?? {};
        setS(stored);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const set = useCallback((patch: Partial<Settings>) => {
    setS((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, [save]);

  const setLang = useCallback((lang: Lang) => {
    setS((prev) => {
      const next: Settings = { ...prev, lang, primary: lang, show: prev.show === 'both' ? 'both' : lang };
      save(next);
      return next;
    });
  }, [save]);

  const hintOnce = useCallback((key: string) => {
    if (hints.current[key]) return false;
    hints.current = { ...hints.current, [key]: true };
    save(latest.current);
    return true;
  }, [save]);

  const value = useMemo<SettingsContext>(() => {
    const dark = scheme === 'dark';
    const page = PAGES[s.read === 'auto' ? (dark ? 'night' : 'paper') : s.read];
    const spread = s.spreadPref === 'on' || (s.spreadPref === 'auto' && width >= SPREAD_MIN_WIDTH && height >= SPREAD_MIN_HEIGHT);
    return { ...s, ready, t: STRINGS[s.lang], colors: dark ? DARK : LIGHT, page, dark, spread, set, setLang, hintOnce };
  }, [s, ready, scheme, width, height, set, setLang, hintOnce]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside SettingsProvider');
  return v;
}
