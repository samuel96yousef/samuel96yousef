import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Arch } from '../../components/Arch';
import { Chips } from '../../components/Chips';
import { DateBar } from '../../components/DateBar';
import { DayPicker } from '../../components/DayPicker';
import { Icon } from '../../components/Icon';
import { Reader } from '../../components/Reader';
import { ReaderActions } from '../../components/ReaderActions';
import { WeekStrip } from '../../components/WeekStrip';
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
  const { day: date, isToday } = useReadingDay();
  const [picking, setPicking] = useState(false);
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
      {/* As on "Today": the title, the day and the reader's buttons in one card, the same week below. */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={[styles.titleRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: colors.label }, ar && styles.right]}>{t.readings}</Text>
          {!isToday && (
            <Pressable accessibilityRole="button" onPress={() => pickDay(new Date())}
              style={({ pressed }) => [styles.todayPill, { backgroundColor: colors.tint }, pressed && styles.dim]}>
              <Text style={[styles.todayText, { color: colors.crimson }]}>{t.goToday}</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel={t.pickDay} onPress={() => setPicking(true)} hitSlop={6} style={({ pressed }) => pressed && styles.dim}>
            <View style={[styles.round, { backgroundColor: colors.tint }]}><Icon name="calendar" size={19} color={colors.crimson} strokeWidth={2} /></View>
          </Pressable>
          <ReaderActions inline />
        </View>
        <WeekStrip day={date} onPick={pickDay} />
      </View>
      {chips}
      <Arch ar={`قراءات شهر ${MONTHS[c.month - 1][1]}`} sv={t.readingsArch(MONTHS[c.month - 1][0])} cop={MONTHS[c.month - 1][2]} />
      {loading && !data && <ActivityIndicator style={styles.loading} color={colors.crimson} />}
      {error && <Text style={[styles.note, { color: colors.crimson }]}>{error.message}</Text>}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={rows} header={header} scrollTo={jump} outline={outline} ownHeader />
      <DayPicker visible={picking} day={date} onPick={(d) => { setPicking(false); pickDay(d); }} onClose={() => setPicking(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  card: { borderRadius: 24, paddingTop: 14, paddingBottom: 10, paddingHorizontal: 14, gap: 8, marginBottom: 14 },
  titleRow: { alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 24, fontWeight: '700', lineHeight: 30 },
  todayPill: { borderRadius: 999, paddingHorizontal: 11, height: 34, justifyContent: 'center' },
  todayText: { fontSize: 14, fontWeight: '700' },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.6 },
  bookHead: { alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 2, paddingBottom: 12 },
  bookChips: { flex: 1, marginHorizontal: 0, marginBottom: 0 },
  note: { fontSize: 13, marginBottom: 8 },
  loading: { marginVertical: 30 },
  right: { textAlign: 'right' },
});
