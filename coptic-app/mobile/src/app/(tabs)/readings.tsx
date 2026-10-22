import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Arch } from '../../components/Arch';
import { Chips } from '../../components/Chips';
import { DateBar } from '../../components/DateBar';
import { LargeTitle } from '../../components/LargeTitle';
import { Reader } from '../../components/Reader';
import { ReaderActions } from '../../components/ReaderActions';
import { TopBar } from '../../components/TopBar';
import { useReadings } from '../../data';
import { STRINGS } from '../../i18n';
import { coptic, fromIso, MONTHS, startOfDay } from '../../lib/coptic';
import { dayOutline, dayRows, sectionIndex } from '../../rows';
import { useSettings } from '../../settings';

export default function Readings() {
  const { t, lang, colors, spread } = useSettings();
  const params = useLocalSearchParams<{ section?: string; date?: string }>();
  const [date, setDate] = useState(() => (params.date ? fromIso(params.date) : startOfDay(new Date())));
  const [jump, setJump] = useState<{ index: number; key: number } | null>(null);
  const { data, loading, error } = useReadings(date);
  const ar = lang === 'ar';
  const c = coptic(date);

  const rows = useMemo(() => (data ? dayRows(data, fromIso(data.iso), { ar: STRINGS.ar.holyWeek, sv: STRINGS.sv.holyWeek }) : []), [data]);
  const outline = useMemo(() => (data ? dayOutline(data, rows) : null), [data, rows]);

  // A link with ?date= moves the page to that day.
  const [linkedDate, setLinkedDate] = useState(params.date);
  if (params.date !== linkedDate) {
    setLinkedDate(params.date);
    if (params.date) setDate(fromIso(params.date));
  }

  // Arriving from "Today" with a section: jump there once the text is in.
  const [jumpedTo, setJumpedTo] = useState<string | undefined>(undefined);
  if (params.section && rows.length && jumpedTo !== params.section) {
    setJumpedTo(params.section);
    setJump({ index: sectionIndex(rows, params.section), key: -1 });
  }

  const header = (
    <View style={styles.header}>
      <LargeTitle title={t.readings} />
      <DateBar date={date} onChange={setDate} />
      <Chips
        items={(data?.sections ?? []).map((s) => ({ key: s.key, label: ar ? s.ar : s.sv }))}
        onPress={(key) => setJump({ index: sectionIndex(rows, key), key: Date.now() })}
      />
      {spread && <Text style={[styles.note, { color: colors.label2 }, ar && styles.right]}>{t.spreadNote}</Text>}
      <Arch ar={`قراءات شهر ${MONTHS[c.month - 1][1]}`} sv={t.readingsArch(MONTHS[c.month - 1][0])} cop={MONTHS[c.month - 1][2]} />
      {loading && !data && <ActivityIndicator style={styles.loading} color={colors.crimson} />}
      {error && <Text style={[styles.note, { color: colors.crimson }]}>{error.message}</Text>}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar><ReaderActions /></TopBar>
      <Reader rows={rows} header={header} scrollTo={jump} outline={outline} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 6 },
  note: { fontSize: 13, marginBottom: 8 },
  loading: { marginVertical: 30 },
  right: { textAlign: 'right' },
});
