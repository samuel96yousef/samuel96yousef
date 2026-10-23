import * as Haptics from 'expo-haptics';
import { usePathname } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../settings';
import { SPRING_LIVELY, SPRING_SMOOTH } from '../theme';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { LangPill } from './LangPill';

const ICONS: Record<string, IconName> = { index: 'today', readings: 'readings', prayers: 'prayers', bible: 'bible' };
const LABEL_KEY = { index: 'today', readings: 'readings', prayers: 'prayers', bible: 'bible' } as const;

/** Screens where text is read; the tab bar compacts to make room for the language pill. */
export const isReaderPath = (p: string) =>
  p === '/readings' || /^\/prayers\/(hour|liturgy)\//.test(p) || /^\/bible\/\d+\/\d+/.test(p);

// The bar compacts without a bounce; only the lens under the active tab is lively.
const layout = LinearTransition.springify().damping(SPRING_SMOOTH.damping).stiffness(SPRING_SMOOTH.stiffness);

export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { t, colors, spread, lang } = useSettings();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const reading = isReaderPath(pathname) && !spread;
  // On the open book (an unfolded Duo) the bar moves onto one page, off the fold.
  const offFold = isReaderPath(pathname) && spread;
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const first = useRef(true);
  const active = state.routes[state.index]?.key;

  useEffect(() => {
    const l = active ? layouts[active] : undefined;
    if (!l) return;
    if (first.current) { x.set(l.x); w.set(l.width); first.current = false; return; }
    x.set(withSpring(l.x, SPRING_LIVELY));
    w.set(withSpring(l.width, SPRING_LIVELY));
  }, [active, layouts, x, w]);

  const lens = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], width: w.get() }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 10, paddingHorizontal: Math.max(14, insets.left) },
      { justifyContent: reading ? 'space-between' : offFold ? 'flex-start' : 'center', flexDirection: lang === 'ar' ? 'row-reverse' : 'row' },
      offFold && { paddingHorizontal: 28 }]}>
      <Animated.View layout={layout}>
        <Glass style={[styles.bar, reading && styles.barCompact]}>
          <Animated.View style={[styles.lens, reading && styles.lensCompact, { backgroundColor: colors.lens }, lens]} />
          <View accessibilityRole="tablist" style={[styles.row, { flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
            {state.routes.map((route) => {
              const focused = route.key === active;
              const name = route.name as keyof typeof LABEL_KEY;
              const label = t[LABEL_KEY[name] ?? 'today'];
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={label}
                  onLayout={(e) => { const l = e.nativeEvent.layout; setLayouts((p) => ({ ...p, [route.key]: l })); }}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                    navigateToTab(route.key);
                  }}
                  style={({ pressed }) => [styles.tab, reading && styles.tabCompact, pressed && { transform: [{ scale: 0.92 }] }]}
                >
                  <Icon name={ICONS[name] ?? 'today'} color={focused ? colors.crimson : colors.label} />
                  {!reading && <Text numberOfLines={1} style={[styles.label, { color: focused ? colors.crimson : colors.label }]}>{label}</Text>}
                </Pressable>
              );
            })}
          </View>
        </Glass>
      </Animated.View>
      {reading && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} layout={layout}>
          <LangPill />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: { borderRadius: 999, padding: 5 },
  barCompact: { padding: 4 },
  row: { flexDirection: 'row' },
  // Tab positions are measured inside the bar's padding, so the lens starts at the same inset.
  lens: { position: 'absolute', top: 5, left: 5, height: 54, borderRadius: 999 },
  lensCompact: { top: 4, left: 4, height: 44 },
  tab: { width: 78, height: 54, borderRadius: 999, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabCompact: { width: 54, height: 44 },
  label: { fontSize: 10.5, fontWeight: '600' },
});
