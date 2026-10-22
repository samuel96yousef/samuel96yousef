import { Pressable, ScrollView, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useSettings } from '../settings';

/** Horizontal row of jump targets (sections, headings). */
export function Chips({ items, onPress, style }: { items: { key: string; label: string }[]; onPress: (key: string) => void; style?: StyleProp<ViewStyle> }) {
  const { colors, lang } = useSettings();
  if (!items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, lang === 'ar' && styles.rtl]} style={[styles.scroll, style]}>
      {items.map((it) => (
        <Pressable key={it.key} accessibilityRole="button" onPress={() => onPress(it.key)}
          style={({ pressed }) => [styles.chip, { backgroundColor: colors.surface, borderColor: colors.sep }, pressed && { backgroundColor: colors.bg2 }]}>
          <Text numberOfLines={1} style={[styles.text, { color: colors.label }]}>{it.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -16, marginBottom: 12 },
  row: { gap: 8, paddingHorizontal: 16 },
  rtl: { flexDirection: 'row-reverse' },
  chip: { height: 36, borderRadius: 999, paddingHorizontal: 14, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, maxWidth: 260 },
  text: { fontSize: 14, fontWeight: '600' },
});
