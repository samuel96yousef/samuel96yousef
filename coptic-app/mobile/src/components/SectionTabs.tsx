import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutRectangle, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import type { Outline } from '../rows';
import { useSettings } from '../settings';
import { useWay, type WayStore } from './Wayfinder';

/**
 * The day's sections as a row of capsules, the one being read filled in
 * crimson. Under the large title it scrolls with the page; `pinned`, it stays
 * under the top bar while reading. A tap jumps to the section; the row keeps
 * the current tab in view, and fades at an edge where there are more tabs.
 */
export function SectionTabs({ outline, store, onJump, pinned }: { outline: Outline; store: WayStore; onJump: (index: number, fade: boolean) => void; pinned?: boolean }) {
  // The tabs speak the language being read, as the wayfinder does.
  const { colors, primary } = useSettings();
  const ar = primary === 'ar';
  const current = useWay(store, (s) => s.current);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [layouts, setLayouts] = useState<Record<number, LayoutRectangle>>({});
  const [width, setWidth] = useState(0);
  const [content, setContent] = useState(0);
  const [x, setX] = useState(0);
  // Before the first section (the date and the title on the page), the first tab is the one ahead.
  const on = Math.max(0, current);

  useEffect(() => {
    const l = layouts[on];
    if (l && width) scroll.current?.scrollTo({ x: Math.max(0, l.x - (width - l.width) / 2), animated: true });
  }, [on, layouts, width]);

  return (
    <View style={[styles.wrap, pinned && { backgroundColor: colors.bg }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, ar && styles.rtl, content <= width && styles.centred]}
        scrollEventThrottle={32}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => setX(e.nativeEvent.contentOffset.x)}
        // In Arabic the row runs from the right, so it starts at that end.
        onContentSizeChange={(w) => { setContent(w); if (ar && current < 1) scroll.current?.scrollToEnd({ animated: false }); }}>
        {outline.items.map((it, i) => {
          const sel = i === on;
          return (
            <Pressable key={i} accessibilityRole="tab" accessibilityState={{ selected: sel }} onPress={() => onJump(it.index, true)}
              onLayout={(e) => { const l = e.nativeEvent.layout; setLayouts((p) => ({ ...p, [i]: l })); }}
              style={({ pressed }) => [styles.tab, sel ? { backgroundColor: colors.crimson } : { backgroundColor: colors.tint }, pressed && styles.pressed]}>
              <Text numberOfLines={1} style={[ar ? styles.textAr : styles.text, { color: sel ? '#FFFFFF' : colors.label }, sel && styles.textOn]}>{ar ? it.ar : it.sv}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* More tabs beyond an edge: the row fades out there. */}
      {x > 4 && <LinearGradient pointerEvents="none" colors={[colors.bg, `${colors.bg}00`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.fadeLeft]} />}
      {content - width - x > 4 && <LinearGradient pointerEvents="none" colors={[`${colors.bg}00`, colors.bg]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fade, styles.fadeRight]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 46, justifyContent: 'center' },
  // The same side margin as the page, so the first tab lines up with its frame.
  row: { paddingHorizontal: 16, gap: 6, alignItems: 'center' },
  centred: { flexGrow: 1, justifyContent: 'center' },
  rtl: { flexDirection: 'row-reverse' },
  tab: { height: 32, paddingHorizontal: 14, borderRadius: 16, justifyContent: 'center' },
  text: { fontSize: 14, fontWeight: '600' },
  textAr: { fontSize: 15, fontWeight: '600', writingDirection: 'rtl' },
  textOn: { fontWeight: '700' },
  fade: { position: 'absolute', top: 0, bottom: 0, width: 36 },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
  pressed: { opacity: 0.6 },
});
