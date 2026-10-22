import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { Lang } from '../lib/types';
import { useSettings } from '../settings';
import { FONTS, SPRING_LIVELY } from '../theme';
import { Glass } from './Glass';
import { useToast } from './Toast';

const haptic = (heavy = false) => {
  if (Platform.OS === 'web') return;
  (heavy ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium) : Haptics.selectionAsync()).catch(() => {});
};

/**
 * The reading-language switch (ع | Sv) that floats next to the tab bar while
 * reading. Tap a language to read in it; hold to show both languages.
 */
export function LangPill() {
  const { show, primary, set, t, colors, hintOnce, lang } = useSettings();
  const toast = useToast();
  const [layouts, setLayouts] = useState<Partial<Record<Lang, LayoutRectangle>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const a = layouts.ar, s = layouts.sv;
    if (!a || !s) return;
    const on = show === 'both' ? [a, s] : [show === 'ar' ? a : s];
    const left = Math.min(...on.map((l) => l.x));
    const right = Math.max(...on.map((l) => l.x + l.width));
    x.set(withSpring(left, SPRING_LIVELY));
    w.set(withSpring(right - left, SPRING_LIVELY));
  }, [show, layouts, x, w]);

  const lens = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], width: w.get() }));
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const pick = (l: Lang) => {
    if (show === l) {
      scale.set(withSequence(withTiming(1.07, { duration: 120 }), withSpring(1, SPRING_LIVELY)));
      return;
    }
    haptic();
    const wasSingle = show !== 'both';
    set({ primary: l, show: l });
    if (wasSingle && hintOnce('both')) toast(t.hintBoth);
  };

  const toggleBoth = () => {
    haptic(true);
    hintOnce('both');
    set({ show: show === 'both' ? primary : 'both' });
  };

  const order: Lang[] = lang === 'ar' ? ['sv', 'ar'] : ['ar', 'sv'];

  return (
    <Animated.View style={pop}>
      <Glass style={styles.pill} interactive>
        <Animated.View style={[styles.lens, { backgroundColor: colors.lens }, lens]} />
        <View accessibilityRole="radiogroup" accessibilityLabel={t.langSwitch} style={styles.row}>
          {order.map((l) => {
            const on = show === 'both' || show === l;
            return (
              <Pressable
                key={l}
                accessibilityRole="button"
                accessibilityLabel={l === 'ar' ? 'العربية' : 'Svenska'}
                accessibilityState={{ selected: on }}
                accessibilityHint={t.hintBoth}
                onLayout={(e) => { const lay = e.nativeEvent.layout; setLayouts((p) => ({ ...p, [l]: lay })); }}
                onPress={() => pick(l)}
                onLongPress={toggleBoth}
                delayLongPress={420}
                style={({ pressed }) => [styles.btn, pressed && { transform: [{ scale: 0.9 }] }]}
              >
                {l === 'ar'
                  ? <Text style={[styles.ar, { color: on ? colors.crimson : colors.label2 }]}>ع</Text>
                  : <Text style={[styles.sv, { color: on ? colors.crimson : colors.label2 }]}>Sv</Text>}
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: { borderRadius: 999, padding: 4 },
  row: { flexDirection: 'row' },
  lens: { position: 'absolute', top: 4, left: 0, height: 44, borderRadius: 999 },
  btn: { width: 52, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ar: { fontFamily: FONTS.arBold, fontSize: 25, lineHeight: 34, marginTop: -6 },
  sv: { fontSize: 16, fontWeight: '700' },
});
