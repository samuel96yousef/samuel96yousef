import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutRectangle } from 'react-native';

import type { Outline } from '../rows';
import { useSettings } from '../settings';
import { useWay, type WayStore } from './Wayfinder';

/**
 * The day's sections as a row of tabs, the one being read underlined in
 * crimson, like the segment tabs in Apple's apps. Under the large title it
 * scrolls with the page; `pinned`, it stays under the top bar while reading.
 * A tap jumps to the section; the row keeps the current tab in view.
 */
export function SectionTabs({ outline, store, onJump, pinned }: { outline: Outline; store: WayStore; onJump: (index: number, fade: boolean) => void; pinned?: boolean }) {
  const { colors, lang } = useSettings();
  const ar = lang === 'ar';
  const current = useWay(store, (s) => s.current);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [layouts, setLayouts] = useState<Record<number, LayoutRectangle>>({});
  const [width, setWidth] = useState(0);
  // Before the first section (the date and the title on the page), the first tab is the one ahead.
  const on = Math.max(0, current);

  useEffect(() => {
    const l = layouts[on];
    if (l && width) scroll.current?.scrollTo({ x: Math.max(0, l.x - (width - l.width) / 2), animated: true });
  }, [on, layouts, width]);

  return (
    <View style={[styles.wrap, pinned && { backgroundColor: colors.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.sep }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, ar && styles.rtl]}
        // In Arabic the row runs from the right, so it starts at that end.
        onContentSizeChange={() => { if (ar && current < 1) scroll.current?.scrollToEnd({ animated: false }); }}>
        {outline.items.map((it, i) => {
          const sel = i === on;
          return (
            <Pressable key={i} accessibilityRole="tab" accessibilityState={{ selected: sel }} onPress={() => onJump(it.index, true)}
              onLayout={(e) => { const l = e.nativeEvent.layout; setLayouts((p) => ({ ...p, [i]: l })); }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
              <Text numberOfLines={1} style={[styles.text, { color: sel ? colors.label : colors.label2 }, sel && styles.textOn]}>{ar ? it.ar : it.sv}</Text>
              <View style={[styles.line, { backgroundColor: sel ? colors.crimson : 'transparent' }]} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 46 },
  row: { paddingHorizontal: 12, gap: 4 },
  rtl: { flexDirection: 'row-reverse' },
  tab: { height: 46, paddingHorizontal: 10, justifyContent: 'center' },
  text: { fontSize: 15, fontWeight: '600' },
  textOn: { fontWeight: '700' },
  line: { position: 'absolute', left: 10, right: 10, bottom: 4, height: 2.5, borderRadius: 2 },
  pressed: { opacity: 0.6 },
});
