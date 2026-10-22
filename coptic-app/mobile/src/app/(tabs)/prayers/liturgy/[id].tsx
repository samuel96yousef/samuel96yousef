import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Chips } from '../../../../components/Chips';
import { LargeTitle } from '../../../../components/LargeTitle';
import { Reader } from '../../../../components/Reader';
import { kholagyIndex, usePrayer } from '../../../../data';
import { headingIndexes, headingOutline, liturgyRows } from '../../../../rows';
import { useSettings } from '../../../../settings';
import { FONTS } from '../../../../theme';

/** A liturgy from the Kholagy, with the priest's, deacon's and people's parts set apart. */
export default function Liturgy() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, colors, page, spread } = useSettings();
  const liturgy = kholagyIndex.find((p) => p.id === id) ?? kholagyIndex[0];
  const { data } = usePrayer('kholagy', liturgy.id);
  const rows = useMemo(() => (data ? liturgyRows(data) : []), [data]);
  const headings = useMemo(() => headingIndexes(rows), [rows]);
  const outline = useMemo(() => headingOutline(rows, { ar: liturgy.ar, sv: liturgy.sv }), [rows, liturgy]);
  const [jump, setJump] = useState<{ index: number; key: number } | null>(null);
  const ar = lang === 'ar';

  const legend = (['priest', 'deacon', 'people'] as const).map((r) => {
    const color = r === 'priest' ? page.rule : r === 'deacon' ? page.gold : colors.label;
    return (
      <View key={r} style={[styles.legendItem, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <View style={[styles.bar, { backgroundColor: r === 'priest' ? 'transparent' : r === 'deacon' ? page.gold : page.rule, borderColor: page.rule }]} />
        <Text style={[styles.legendText, { color }, r === 'people' && { fontFamily: FONTS.svSemi }]}>{t.roles[r]}</Text>
      </View>
    );
  });

  const chips = data
    ? <Chips items={headings.map((h) => ({ key: String(h.i), label: ar ? h.ar : h.sv || h.ar }))} onPress={(k) => setJump({ index: Number(k), key: Date.now() })} style={spread && styles.bookChips} />
    : <ActivityIndicator color={colors.crimson} />;
  // In the open book the page's cartouche is the title: the roles and the sections share one slim row.
  const header = spread ? (
    <View style={[styles.bookHead, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
      <View style={[styles.legend, styles.legendBook, { flexDirection: ar ? 'row-reverse' : 'row' }]}>{legend}</View>
      {chips}
    </View>
  ) : (
    <View style={styles.header}>
      <LargeTitle title={ar ? liturgy.ar : liturgy.sv} subtitle={t.kholagy} />
      <View style={[styles.legend, { flexDirection: ar ? 'row-reverse' : 'row' }]}>{legend}</View>
      {chips}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={rows} header={header} scrollTo={jump} outline={outline} back={t.prayers} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16 },
  legend: { gap: 16, marginBottom: 12, flexWrap: 'wrap' },
  legendBook: { marginBottom: 0, flexWrap: 'nowrap' },
  bookHead: { alignItems: 'center', gap: 18, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12 },
  bookChips: { flex: 1, marginHorizontal: 0, marginBottom: 0 },
  legendItem: { alignItems: 'center', gap: 6 },
  bar: { width: 4, height: 16, borderRadius: 2 },
  legendText: { fontSize: 14, fontWeight: '600' },
});
