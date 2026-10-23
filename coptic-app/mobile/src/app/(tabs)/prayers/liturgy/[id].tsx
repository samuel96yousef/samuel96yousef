import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Chips } from '../../../../components/Chips';
import { Glass } from '../../../../components/Glass';
import { LargeTitle } from '../../../../components/LargeTitle';
import { Reader } from '../../../../components/Reader';
import { kholagyIndex, usePrayer } from '../../../../data';
import { liturgyScopes } from '../../../../print/scopes';
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
  const print = useMemo(() => liturgyScopes(liturgy.id, ar ? liturgy.ar : liturgy.sv, t), [liturgy, ar, t]);

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
  // In the open book everything sits in the top bar, so the pages keep their
  // height: the roles beside the back button, the sections in the middle until
  // the reading pill (which names who is speaking) takes over.
  const header = spread ? (
    data ? null : <ActivityIndicator style={styles.loading} color={colors.crimson} />
  ) : (
    <View style={styles.header}>
      <LargeTitle title={ar ? liturgy.ar : liturgy.sv} subtitle={t.kholagy} />
      <View style={[styles.legend, { flexDirection: ar ? 'row-reverse' : 'row' }]}>{legend}</View>
      {chips}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={rows} header={header} scrollTo={jump} outline={outline} back={t.kholagy} print={print}
        barLead={spread ? (
          <Glass style={styles.leadGlass}>
            <View style={[styles.legend, styles.legendBook, { flexDirection: ar ? 'row-reverse' : 'row' }]}>{legend}</View>
          </Glass>
        ) : null}
        barCenter={spread && data ? chips : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16 },
  legend: { gap: 16, marginBottom: 12, flexWrap: 'wrap' },
  legendBook: { marginBottom: 0, flexWrap: 'nowrap', height: 44, alignItems: 'center', paddingHorizontal: 16, gap: 14 },
  leadGlass: { borderRadius: 22 },
  loading: { marginTop: 12 },
  bookChips: { flexGrow: 0, marginHorizontal: 0, marginBottom: 0 },
  legendItem: { alignItems: 'center', gap: 6 },
  bar: { width: 4, height: 16, borderRadius: 2 },
  legendText: { fontSize: 14, fontWeight: '600' },
});
