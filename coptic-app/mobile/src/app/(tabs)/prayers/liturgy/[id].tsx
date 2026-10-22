import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Chips } from '../../../../components/Chips';
import { LargeTitle } from '../../../../components/LargeTitle';
import { Reader } from '../../../../components/Reader';
import { ReaderActions } from '../../../../components/ReaderActions';
import { TopBar } from '../../../../components/TopBar';
import { kholagy } from '../../../../data';
import { headingIndexes, headingOutline, liturgyRows } from '../../../../rows';
import { useSettings } from '../../../../settings';
import { FONTS } from '../../../../theme';

/** A liturgy from the Kholagy, with the priest's, deacon's and people's parts set apart. */
export default function Liturgy() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, colors, page } = useSettings();
  const liturgy = kholagy.find((p) => p.id === id) ?? kholagy[0];
  const rows = useMemo(() => liturgyRows(liturgy), [liturgy]);
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

  const header = (
    <View style={styles.header}>
      <LargeTitle title={ar ? liturgy.ar : liturgy.sv} subtitle={t.kholagy} />
      <View style={[styles.legend, { flexDirection: ar ? 'row-reverse' : 'row' }]}>{legend}</View>
      <Chips items={headings.map((h) => ({ key: String(h.i), label: ar ? h.ar : h.sv || h.ar }))} onPress={(k) => setJump({ index: Number(k), key: Date.now() })} />
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={t.prayers}><ReaderActions /></TopBar>
      <Reader rows={rows} header={header} scrollTo={jump} outline={outline} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16 },
  legend: { gap: 16, marginBottom: 12, flexWrap: 'wrap' },
  legendItem: { alignItems: 'center', gap: 6 },
  bar: { width: 4, height: 16, borderRadius: 2 },
  legendText: { fontSize: 14, fontWeight: '600' },
});
