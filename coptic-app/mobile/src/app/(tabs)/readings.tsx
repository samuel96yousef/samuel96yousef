import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Arch } from '../../components/Arch';
import { Chips } from '../../components/Chips';
import { DateBar } from '../../components/DateBar';
import { LargeTitle } from '../../components/LargeTitle';
import { Reader } from '../../components/Reader';
import { useReadings } from '../../data';
import { pickDay, useReadingDay } from '../../day';
import { STRINGS } from '../../i18n';
import { coptic, fromIso, isoDate, MONTHS } from '../../lib/coptic';
import { dayOutline, dayRows, sectionIndex } from '../../rows';
import { useSettings } from '../../settings';

export default function Readings() {
  const { t, lang, colors, spread } = useSettings();
  const params = useLocalSearchParams<{ section?: string; date?: string; at?: string }>();
  // The same day as on "Today": today, unless the reader picked another.
  const { day: date } = useReadingDay();
  const [jump, setJump] = useState<{ index: number; key: number } | null>(null);
  const { data, loading, error } = useReadings(date);
  const ar = lang === 'ar';
  const c = coptic(date);

  const rows = useMemo(() => (data ? dayRows(data, fromIso(data.iso), { ar: STRINGS.ar.holyWeek, sv: STRINGS.sv.holyWeek }) : []), [data]);
  const outline = useMemo(() => (data ? dayOutline(data, rows) : null), [data, rows]);

  // A link with ?date= opens that day.
  useEffect(() => { if (params.date) pickDay(fromIso(params.date)); }, [params.date]);

  // Arriving from "Today" with a section: jump there once that day's text is in (not the day shown before).
  const visit = params.section ? `${params.section}|${params.at ?? ''}` : '';
  const [jumpedTo, setJumpedTo] = useState('');
  if (visit && params.section && data?.iso === isoDate(date) && rows.length && jumpedTo !== visit) {
    setJumpedTo(visit);
    setJump({ index: sectionIndex(rows, params.section), key: -1 });
  }

  const chips = (
    <Chips
      items={(data?.sections ?? []).map((s) => ({ key: s.key, label: ar ? s.ar : s.sv }))}
      onPress={(key) => setJump({ index: sectionIndex(rows, key), key: Date.now() })}
      style={spread && styles.bookChips}
    />
  );
  // The open book's first spread keeps its room for the pages: one slim row
  // with the day and the sections. The pages carry the title and the date.
  const header = spread ? (
    <View style={[styles.bookHead, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
      <DateBar compact date={date} onChange={pickDay} />
      {chips}
      {loading && !data && <ActivityIndicator color={colors.crimson} />}
    </View>
  ) : (
    <View style={styles.header}>
      <LargeTitle title={t.readings} />
      <DateBar date={date} onChange={pickDay} />
      {chips}
      <Arch ar={`قراءات شهر ${MONTHS[c.month - 1][1]}`} sv={t.readingsArch(MONTHS[c.month - 1][0])} cop={MONTHS[c.month - 1][2]} />
      {loading && !data && <ActivityIndicator style={styles.loading} color={colors.crimson} />}
      {error && <Text style={[styles.note, { color: colors.crimson }]}>{error.message}</Text>}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={rows} header={header} scrollTo={jump} outline={outline} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  bookHead: { alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12 },
  bookChips: { flex: 1, marginHorizontal: 0, marginBottom: 0 },
  note: { fontSize: 13, marginBottom: 8 },
  loading: { marginVertical: 30 },
  right: { textAlign: 'right' },
});
