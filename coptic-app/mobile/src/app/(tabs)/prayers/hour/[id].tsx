import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LargeTitle } from '../../../../components/LargeTitle';
import { Reader } from '../../../../components/Reader';
import { ReaderActions } from '../../../../components/ReaderActions';
import { TopBar } from '../../../../components/TopBar';
import { agpeya } from '../../../../data';
import { HOURS } from '../../../../lib/coptic';
import { prayerRows } from '../../../../rows';
import { useSettings } from '../../../../settings';

export default function Hour() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang, colors } = useSettings();
  const hour = agpeya.find((h) => h.id === id) ?? agpeya[0];
  const rows = useMemo(() => prayerRows(hour, { ar: 'الأجبية', sv: 'Agpeya' }), [hour]);
  const ar = lang === 'ar';
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={t.prayers}><ReaderActions /></TopBar>
      <Reader rows={rows} header={<View style={styles.header}><LargeTitle title={ar ? hour.ar : hour.sv} subtitle={ar ? HOURS[hour.id]?.ar : HOURS[hour.id]?.sv} /></View>} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16 },
});
