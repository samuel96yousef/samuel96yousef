import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LargeTitle } from '../../../../components/LargeTitle';
import { Reader } from '../../../../components/Reader';
import { agpeyaIndex, usePrayer } from '../../../../data';
import { HOURS } from '../../../../lib/coptic';
import { hourScopes } from '../../../../print/scopes';
import { headingOutline, prayerRows } from '../../../../rows';
import { useSettings } from '../../../../settings';

export default function Hour() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, colors, spread } = useSettings();
  const hour = agpeyaIndex.find((h) => h.id === id) ?? agpeyaIndex[0];
  const { data } = usePrayer('agpeya', hour.id);
  const rows = useMemo(() => (data ? prayerRows(data, { ar: 'الأجبية', sv: 'Agpeya' }) : []), [data]);
  const outline = useMemo(() => headingOutline(rows, { ar: hour.ar, sv: hour.sv }), [rows, hour]);
  const ar = lang === 'ar';
  const print = useMemo(() => hourScopes(hour.id, ar ? hour.ar : hour.sv, t, lang), [hour, ar, t, lang]);
  // In the open book the page's own cartouche is the title.
  const header = spread ? (!data ? <ActivityIndicator color={colors.crimson} /> : null) : (
    <View style={styles.header}>
      <LargeTitle title={ar ? hour.ar : hour.sv} subtitle={ar ? HOURS[hour.id]?.ar : HOURS[hour.id]?.sv} />
      {!data && <ActivityIndicator color={colors.crimson} />}
    </View>
  );
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={rows} outline={outline} back={t.agpeya} header={header} print={print} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16 },
});
