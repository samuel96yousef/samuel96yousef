import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../../../../../components/Icon';
import { Reader } from '../../../../../../components/Reader';
import { hymnGroups, useHymns } from '../../../../../../data';
import { hymnRows } from '../../../../../../rows';
import { useSettings } from '../../../../../../settings';
import { FONTS } from '../../../../../../theme';

/** One hymn text in the reader: each Coptic line with its Arabic; at the end, the way on to the next hymn. */
export default function HymnPage() {
  const { group, hymn } = useLocalSearchParams<{ group: string; hymn: string }>();
  const { t, lang, colors } = useSettings();
  const g = hymnGroups.find((x) => x.id === group) ?? hymnGroups[0];
  const { data } = useHymns(g.id);
  const at = data ? data.findIndex((h) => h.id === hymn) : -1;
  const h = data?.[at];
  const next = data?.[at + 1];
  const rows = useMemo(() => (h ? hymnRows(h, { ar: g.ar, sv: g.sv }) : []), [h, g]);
  const ar = lang === 'ar';

  const footer = next ? (
    <Pressable accessibilityRole="button" onPress={() => router.replace(`/prayers/alhan/g/${g.id}/${next.id}`)}
      style={({ pressed }) => [styles.next, { backgroundColor: colors.surface, flexDirection: ar ? 'row-reverse' : 'row' }, pressed && styles.dim]}>
      <View style={styles.nextText}>
        <Text style={[styles.nextLabel, { color: colors.crimson }, ar && styles.right]}>{t.nextHymn}</Text>
        <Text numberOfLines={2} style={[styles.nextTitle, { color: colors.label }]}>{next.ar}</Text>
      </View>
      <View style={ar && styles.flip}><Icon name="chevR" size={18} color={colors.label2} strokeWidth={2.2} /></View>
    </Pressable>
  ) : null;

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={rows} back={ar ? g.ar : g.sv} footer={footer} peek={false}
        header={!h ? <ActivityIndicator color={colors.crimson} style={styles.spin} /> : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spin: { marginTop: 40 },
  next: { alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: 18 },
  nextText: { flex: 1, minWidth: 0 },
  nextLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  nextTitle: { fontFamily: FONTS.arBold, fontSize: 17, lineHeight: 28, textAlign: 'right', writingDirection: 'rtl' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
  dim: { opacity: 0.7 },
});
