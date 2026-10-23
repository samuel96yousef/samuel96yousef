import { StyleSheet, Text, View } from 'react-native';

import { useSettings } from '../settings';

export function LargeTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors, lang } = useSettings();
  const align = lang === 'ar' ? ({ textAlign: 'right', writingDirection: 'rtl' } as const) : ({ textAlign: 'left' } as const);
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={[styles.title, align, { color: colors.label }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, align, { color: colors.label2 }]}>{subtitle}</Text> : null}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const { colors, lang } = useSettings();
  return (
    <Text style={[styles.label, { color: colors.label2 }, lang === 'ar' ? styles.labelAr : null]}>{children}</Text>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  title: { fontSize: 34, fontWeight: '700', lineHeight: 40 },
  sub: { fontSize: 15, marginTop: 2 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 24, marginBottom: 8, marginHorizontal: 4 },
  labelAr: { textAlign: 'right', letterSpacing: 0, textTransform: 'none', fontSize: 14 },
});
