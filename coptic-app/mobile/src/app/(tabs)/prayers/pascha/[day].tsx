import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useBackLabel } from '../../../../backLabel';
import { Reader } from '../../../../components/Reader';
import { holyWeek, useHolyWeekDay } from '../../../../data';
import { useSettings } from '../../../../settings';

/** One day of Holy Week: its services in order, each with its readings, the Pascha praise in its hours. */
export default function PaschaDay() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const { t, colors } = useSettings();
  const back = useBackLabel(t);
  const d = holyWeek.days.find((x) => x.id === day) ?? holyWeek.days[0];
  const { data } = useHolyWeekDay(d);
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={data?.rows ?? []} outline={data?.outline} back={back} sectionTabs
        header={!data ? <ActivityIndicator color={colors.crimson} style={styles.spin} /> : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spin: { marginTop: 40 },
});
