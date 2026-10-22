import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../settings';
import { BAR_HEIGHT } from './TopBar';

const Ctx = createContext<(msg: string, ms?: number) => void>(() => {});

/** A short message at the top of the screen, like an iOS banner, just below the top bar's buttons. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((m: string, ms = 3600) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), ms);
  }, []);

  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <Animated.View entering={FadeInUp.springify()} exiting={FadeOutUp} style={[styles.wrap, { top: insets.top + BAR_HEIGHT + 4 }]} pointerEvents="none">
          <ToastBody text={msg} />
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

function ToastBody({ text }: { text: string }) {
  const { colors } = useSettings();
  // Solid rather than glass: a banner has to stay readable over any text.
  return (
    <View style={[styles.toast, { backgroundColor: colors.surface, borderColor: colors.sep, boxShadow: `0 12px 30px -12px ${colors.shadow}` }]}>
      <Text accessibilityLiveRegion="polite" style={[styles.text, { color: colors.label }]}>{text}</Text>
    </View>
  );
}

export const useToast = () => useContext(Ctx);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center', zIndex: 100 },
  toast: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, maxWidth: 520, borderWidth: StyleSheet.hairlineWidth },
  text: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
