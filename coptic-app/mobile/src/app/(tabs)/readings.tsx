import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Chips } from '../../components/Chips';
import { DayPicker } from '../../components/DayPicker';
import { Glass } from '../../components/Glass';
import { Icon } from '../../components/Icon';
import { Reader } from '../../components/Reader';
import { useReadings } from '../../data';
import { pickDay, useReadingDay } from '../../day';
import { STRINGS } from '../../i18n';
import { addDays, coptic, copticText, dayMonthText, fromIso, gregorianText, isoDate, toArDigits, weekdayText } from '../../lib/coptic';
import { readingScopes } from '../../print/scopes';
import { dayOutline, dayRows, sectionIndex } from '../../rows';
import { useSettings } from '../../settings';
import { FONTS } from '../../theme';

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
  const print = useMemo(() => readingScopes(date, t, lang), [date, t, lang]);

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
  // The day: a step back, the Coptic date over the civil one (a tap opens the
  // calendar), a step on. On the phone it heads the page in a card; in the open
  // book it sits in the top bar, so the pages keep their full height.
  const dayNav = (
    <>
    <Step n={-1} onPress={() => pickDay(addDays(date, -1))} />
    <Pressable accessibilityRole="button" accessibilityLabel={`${gregorianText(date, lang)}. ${t.pickDay}`} onPress={() => setPicking(true)}
      style={({ pressed }) => [styles.when, pressed && styles.dim]}>
      {/* The Coptic day on top, with a way back to today beside it when another day is shown. */}
      <View style={[styles.subRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <Text numberOfLines={1} style={[ar ? styles.dayAr : styles.day, ar ? styles.dayArSmall : styles.daySmall, { color: colors.label }, ar && styles.right]}>{copticText(c, lang)}</Text>
        {!isToday && (
          <Pressable accessibilityRole="button" onPress={() => pickDay(new Date())} hitSlop={6}
            style={({ pressed }) => [styles.todayPill, { backgroundColor: colors.tint }, pressed && styles.dim]}>
            <Text style={[styles.todayText, { color: colors.crimson }]}>{t.goToday}</Text>
          </Pressable>
        )}
      </View>
      <View style={[styles.subRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <Text numberOfLines={1} style={[styles.sub, { color: isToday ? colors.crimson : colors.label2 }]}>
          {isToday ? `${t.today} · ` : `${capital(weekdayText(date, lang))} `}{dayMonthText(date, lang)}
          {date.getFullYear() !== new Date().getFullYear() ? ` ${ar ? toArDigits(date.getFullYear()) : date.getFullYear()}` : ''}
        </Text>
        <Icon name="chevD" size={12} color={colors.label2} strokeWidth={2.4} />
      </View>
    </Pressable>
    <Step n={1} onPress={() => pickDay(addDays(date, 1))} />
    </>
  );
  // The day sits in the top bar between its steps, in the open book and on the
  // phone alike, so the page starts with the sections and then the text.
  const header = (loading && !data) || error ? (
    <View style={styles.header}>
      {loading && !data && <ActivityIndicator style={styles.loading} color={colors.crimson} />}
      {error && <Text style={[styles.note, { color: colors.crimson }]}>{error.message}</Text>}
    </View>
  ) : null;
  const barLead = (
    <Glass style={styles.leadGlass}>
      <View style={[styles.lead, spread && styles.leadWide, { flexDirection: ar ? 'row-reverse' : 'row' }]}>{dayNav}</View>
    </Glass>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <Reader rows={rows} header={header} scrollTo={jump} outline={outline} print={print} barLead={barLead} barCenter={spread ? chips : null} sectionTabs />
      <DayPicker visible={picking} day={date} onPick={(d) => { setPicking(false); pickDay(d); }} onClose={() => setPicking(false)} />
    </View>
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A quiet chevron to the day before or after; it points the reading way in Arabic too. */
function Step({ n, onPress }: { n: number; onPress: () => void }) {
  const { t, lang, colors } = useSettings();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={n < 0 ? t.prevDay : t.nextDay} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.step, pressed && { backgroundColor: colors.bg2 }]}>
      <View style={lang === 'ar' && styles.flip}><Icon name={n < 0 ? 'chevL' : 'chevR'} size={18} color={colors.label2} strokeWidth={2.4} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 2 },
  bar: { alignItems: 'center', gap: 6, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 8, marginBottom: 12 },
  step: { width: 30, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  when: { flex: 1, minWidth: 0, paddingHorizontal: 2 },
  day: { flexShrink: 1, fontFamily: FONTS.svSemi, fontSize: 19, lineHeight: 25 },
  dayAr: { flexShrink: 1, fontFamily: FONTS.arBold, fontSize: 21, lineHeight: 30, writingDirection: 'rtl' },
  subRow: { alignItems: 'center', gap: 8, marginTop: 2 },
  sub: { flexShrink: 1, fontSize: 12.5, fontWeight: '600' },
  todayPill: { marginHorizontal: 4, borderRadius: 999, paddingHorizontal: 9, height: 22, justifyContent: 'center' },
  todayText: { fontSize: 12, fontWeight: '700' },
  dim: { opacity: 0.6 },
  flip: { transform: [{ scaleX: -1 }] },
  leadGlass: { borderRadius: 22 },
  lead: { alignItems: 'center', height: 44, paddingHorizontal: 4, gap: 2, flexShrink: 1 },
  leadWide: { minWidth: 220 },
  daySmall: { fontSize: 15, lineHeight: 19 },
  dayArSmall: { fontSize: 17, lineHeight: 24 },
  bookChips: { flexGrow: 0, marginHorizontal: 0, marginBottom: 0 },
  note: { fontSize: 13, marginBottom: 8 },
  loading: { marginVertical: 30 },
  right: { textAlign: 'right' },
});
