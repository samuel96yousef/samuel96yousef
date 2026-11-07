import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../../../../../components/Icon';
import { Reader } from '../../../../../../components/Reader';
import { Segmented } from '../../../../../../components/Segmented';
import { hymnGroups, useHymns } from '../../../../../../data';
import type { Hymn, HymnMode } from '../../../../../../lib/types';
import { hymnRows } from '../../../../../../rows';
import { useSettings } from '../../../../../../settings';
import { FONTS } from '../../../../../../theme';

/** The forms a hymn can be shown in: those its stanzas have. */
function modesOf(h: Hymn): HymnMode[] {
  const has = (k: 'ar' | 'ca' | 'cop') => h.units.some((u) => u[k]);
  return (['arca', 'ar', 'ca', 'cop'] as const).filter((m) => (m === 'arca' ? has('ar') && has('ca') : has(m)));
}

/** One hymn text in the reader, in the forms chosen above it; at the end, the way on to the next hymn. */
export default function HymnPage() {
  const { group, hymn } = useLocalSearchParams<{ group: string; hymn: string }>();
  const { t, lang, colors, hymnMode, set } = useSettings();
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

  // The forms to choose between, where the hymn has the Coptic: as it is sung (in Arabic letters) and as it is written.
  const modes = h ? modesOf(h) : [];
  const header = !h ? <ActivityIndicator color={colors.crimson} style={styles.spin} /> : modes.length > 1 ? (
    <View style={styles.modes}>
      <Segmented label={t.hymnForms} value={modes.includes(hymnMode) ? hymnMode : modes[0]} onChange={(m) => set({ hymnMode: m })}
        options={modes.map((m) => ({ value: m, label: t.hymnMode[m], style: styles.modeText }))} />
    </View>
  ) : null;

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={rows} back={ar ? g.ar : g.sv} footer={footer} peek={false} header={header} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spin: { marginTop: 40 },
  modes: { paddingHorizontal: 16, paddingBottom: 6 },
  modeText: { fontFamily: FONTS.arBold, fontSize: 14 },
  next: { alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: 18 },
  nextText: { flex: 1, minWidth: 0 },
  nextLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  nextTitle: { fontFamily: FONTS.arBold, fontSize: 17, lineHeight: 28, textAlign: 'right', writingDirection: 'rtl' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
  dim: { opacity: 0.7 },
});
