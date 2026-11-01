import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useBackLabel } from '../../../../backLabel';
import { Icon } from '../../../../components/Icon';
import { LargeTitle } from '../../../../components/LargeTitle';
import { Reader } from '../../../../components/Reader';
import { holyWeek, hymnGroups, useHolyWeekDay } from '../../../../data';
import { dateOf, holyWeekYear, HYMN_GROUPS } from '../../../../holyweek';
import { gregorianText } from '../../../../lib/coptic';
import { paschaScopes } from '../../../../print/scopes';
import { sectionIndex } from '../../../../rows';
import { useSettings } from '../../../../settings';

/** One day of Holy Week: its services in order, each with its readings, the Pascha praise in its hours. */
export default function PaschaDay() {
  const { day, section, at } = useLocalSearchParams<{ day: string; section?: string; at?: string }>();
  const { t, lang, colors, spread } = useSettings();
  const back = useBackLabel(t);
  const d = holyWeek.days.find((x) => x.id === day) ?? holyWeek.days[0];
  const { data, loading } = useHolyWeekDay(d);
  const ar = lang === 'ar';
  const rows = useMemo(() => (loading ? [] : data?.rows ?? []), [data, loading]);
  const print = useMemo(() => paschaScopes(d, t, lang), [d, t, lang]);

  // Arriving from "Today" with a service: jump there once the day's text is in, as the Readings tab does.
  const visit = section ? `${section}|${at ?? ''}` : '';
  const [jumpedTo, setJumpedTo] = useState('');
  const [jump, setJump] = useState<{ index: number; key: number } | null>(null);
  if (visit && section && rows.length && jumpedTo !== visit) {
    setJumpedTo(visit);
    setJump({ index: sectionIndex(rows, section), key: -1 });
  }

  // In the open book the page's own cartouche is the title.
  const header = spread ? (!rows.length ? <ActivityIndicator color={colors.crimson} style={styles.spin} /> : null) : (
    <View style={styles.header}>
      <LargeTitle title={ar ? d.ar : d.sv} subtitle={`${gregorianText(dateOf(d, holyWeekYear(new Date())), lang, false)} · ${t.servicesCount(d.services.length)}`} />
      {/* The day's hymns as sung, in the hymn library. */}
      <View style={[styles.groups, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        {(HYMN_GROUPS[d.id] ?? []).map((id) => {
          const g = hymnGroups.find((x) => x.id === id);
          if (!g) return null;
          return (
            <Pressable key={id} accessibilityRole="button" onPress={() => router.push(`/prayers/alhan/g/${id}`)}
              style={({ pressed }) => [styles.group, { backgroundColor: colors.tint, flexDirection: ar ? 'row-reverse' : 'row' }, pressed && styles.dim]}>
              <Icon name="hymns" size={15} color={colors.crimson} strokeWidth={2.2} />
              <Text style={[styles.groupText, { color: colors.crimson }]}>{t.hymnsOf(ar ? g.ar : g.sv)}</Text>
            </Pressable>
          );
        })}
      </View>
      {!rows.length && <ActivityIndicator color={colors.crimson} style={styles.spin} />}
    </View>
  );
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={rows} outline={loading ? undefined : data?.outline} back={back} header={header} print={print} scrollTo={jump} sectionTabs />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16 },
  spin: { marginTop: 40 },
  groups: { flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 8 },
  group: { alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, height: 32 },
  groupText: { fontSize: 13.5, fontWeight: '600' },
  dim: { opacity: 0.6 },
});
