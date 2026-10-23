import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../settings';

/** The floating tab bar and the language pill, with a little air. */
const TAB_CLEARANCE = 92;

const Ctx = createContext<(msg: string, ms?: number) => void>(() => {});

/**
 * A short message just above the tab bar, where it never covers a screen's
 * own header or the first lines of text.
 */
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
        <Animated.View entering={FadeInDown.springify()} exiting={FadeOutDown} style={[styles.wrap, { bottom: insets.bottom + TAB_CLEARANCE }]} pointerEvents="none">
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
