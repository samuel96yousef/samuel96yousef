import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CopticCross } from '../../components/CopticCross';
import { DayCard } from '../../components/DayCard';
import { DayPicker } from '../../components/DayPicker';
import { Icon } from '../../components/Icon';
import { SectionLabel } from '../../components/LargeTitle';
import { FramedCard } from '../../components/Page';
import { BarButton, TopBar } from '../../components/TopBar';
import { WeekStrip } from '../../components/WeekStrip';
import { agpeyaIndex, getOverview, katameros } from '../../data';
import { pickDay, useReadingDay } from '../../day';
import { dayDiff, dayMonthText, HOURS, hourNow, toArDigits, weekdayText } from '../../lib/coptic';
import { useSettings } from '../../settings';
import { FONTS, HOUR_SKY } from '../../theme';

function useMinute() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function Today() {
  const { t, lang, colors, page, primary } = useSettings();
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width >= 720;
  const now = useMinute();
  // The day shown is today unless the reader picks another; the prayer hour is always now.
  const { day, isToday } = useReadingDay();
  const [picking, setPicking] = useState(false);
  // Nothing here waits for a Bible book: the readings are titles and
  // references, and the word of the day ships with the lectionary.
  const overview = getOverview(day);
  const hid = hourNow(now);
  const hour = agpeyaIndex.find((h) => h.id === hid);
  const sky = HOUR_SKY[hid];
  const lit = overview.sections.find((s) => s.key === 'liturgy');
  const verse = lit ? katameros.openings?.[lit.ref] : undefined;
  const ar = lang === 'ar';
  const row = ar ? ('row-reverse' as const) : ('row' as const);
  const second = primary === 'ar' ? 'sv' : 'ar';

  const diff = dayDiff(day, now);
  const sameYear = day.getFullYear() === now.getFullYear();
  const year = sameYear ? '' : ` ${ar ? toArDigits(day.getFullYear()) : day.getFullYear()}`;
  // "Idag torsdag 22 oktober"; another day reads "7 november lördag", with
  // the year in the small text when it is another year, so the title stays on one line.
  const relative = isToday ? t.today : diff === 1 ? t.tomorrow : diff === -1 ? t.yesterday : '';
  const title = relative || dayMonthText(day, lang);
  const subtitle = relative ? `${weekdayText(day, lang)} ${dayMonthText(day, lang)}${year}` : `${weekdayText(day, lang)}${year}`;

  // The date as a week: a short title line with the calendar, the week with
  // the Coptic day under each date, and one line with the Coptic date and
  // what the day keeps. Swipe the week for others; the calendar goes further.
  const header = (
    <View style={[styles.head, { backgroundColor: colors.surface }, wide && styles.headWide, wide && ar && styles.headWideRtl]}>
      <View style={[styles.titleRow, { flexDirection: row }]}>
        <View style={[styles.titleText, { flexDirection: row }]}>
          <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: colors.label }]}>{title}</Text>
          <Text numberOfLines={1} style={[styles.subtitle, { color: colors.label2 }]}>{subtitle}</Text>
        </View>
        {!isToday && (
          <Pressable accessibilityRole="button" onPress={() => pickDay(new Date())}
            style={({ pressed }) => [styles.todayPill, { backgroundColor: colors.tint }, pressed && styles.dim]}>
            <Text style={[styles.todayText, { color: colors.crimson }]}>{t.goToday}</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" accessibilityLabel={t.pickDay} onPress={() => setPicking(true)} hitSlop={6}
          style={({ pressed }) => pressed && styles.dim}>
          <View style={[styles.calendar, { backgroundColor: colors.tint }]}><Icon name="calendar" size={19} color={colors.crimson} strokeWidth={2} /></View>
        </Pressable>
      </View>
      <WeekStrip day={day} onPick={pickDay} />
    </View>
  );

  // The word of the day is the page of the Katameros here: on paper, in the
  // double crimson frame. A tap opens the gospel it begins.
  const word = lit && verse ? (
    <Pressable accessibilityRole="button" accessibilityHint={ar ? lit.ar : lit.sv}
      onPress={() => router.push({ pathname: '/readings', params: { section: 'liturgy', at: String(Date.now()) } })}
      style={({ pressed }) => pressed && styles.pressed}>
      <FramedCard style={styles.wordCard}>
        <View style={[styles.wordHead, { flexDirection: row }]}>
          <Text style={[styles.wordLabel, { color: page.rule }, ar && styles.wordLabelAr]}>{t.word}</Text>
          <Text style={[styles.wordRef, { color: page.ink2 }]}>{ar ? toArDigits(lit.refs.ar[lit.refs.ar.length - 1]) : lit.refs.sv[lit.refs.sv.length - 1]}</Text>
        </View>
        {[primary, second].map((l, i) => (
          <Text key={l} style={[l === 'ar' ? styles.wordAr : styles.wordSv, { color: i ? page.ink2 : page.ink }, i ? (l === 'ar' ? styles.wordAr2 : styles.wordSv2) : null]}>
            {l === 'ar' ? verse[0] : verse[1]}
          </Text>
        ))}
      </FramedCard>
    </Pressable>
  ) : null;

  const hourCard = hour && sky ? (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/prayers/hour/${hid}`)} style={({ pressed }) => [pressed && styles.pressed]}>
      <LinearGradient colors={sky.colors} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={styles.hourCard}>
        <View style={[styles.sun, sky.moon ? styles.moon : { backgroundColor: '#FFF4CC' }, ar ? { left: 26 } : { right: 26 }]} />
        <Text style={[styles.hourEyebrow, { color: sky.dark ? '#fff' : '#2B1722' }, ar && styles.right]}>{t.now} · {ar ? HOURS[hid].ar : HOURS[hid].sv}</Text>
        <Text style={[styles.hourName, { color: sky.dark ? '#fff' : '#2B1722' }, ar && styles.right]}>{ar ? hour.ar : hour.sv}</Text>
        <Text style={[styles.hourName2, { color: sky.dark ? '#fff' : '#2B1722' }, ar && styles.right]}>{ar ? hour.sv : hour.ar}</Text>
        <View style={[styles.go, ar && { alignSelf: 'flex-end' }]}><Text style={[styles.goText, { color: sky.dark ? '#fff' : '#2B1722' }]}>{t.prayNow}</Text></View>
      </LinearGradient>
    </Pressable>
  ) : null;

  const list = overview.sections.length > 0 ? (
    <View>
      <SectionLabel>{isToday ? t.todaysReadings : t.readingsFor(dayMonthText(day, lang))}</SectionLabel>
      <View style={[styles.list, { backgroundColor: colors.surface }]}>
        {overview.sections.map((s, i) => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            // `at` makes every tap a new visit, so the section is found again even if the reader moved on.
            onPress={() => router.push({ pathname: '/readings', params: { section: s.key, at: String(Date.now()) } })}
            style={({ pressed }) => [styles.rowBtn, { flexDirection: row }, pressed && { backgroundColor: colors.bg2 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.sep }]}
          >
            <CopticCross size={20} color={colors.crimson} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.label }, ar && styles.right]}>
                {ar ? s.ar : s.sv}{ar ? '' : <Text style={[styles.rowTitleAr, { color: colors.label2 }]}>  {s.ar}</Text>}
              </Text>
              <Text numberOfLines={1} style={[styles.rowSub, { color: colors.label2 }, ar && styles.right]}>
                {(ar ? s.refs.ar.map((r) => toArDigits(r)) : s.refs.sv).join(' · ')}
              </Text>
            </View>
            <View style={ar && styles.flip}><Icon name="chevR" size={16} color={colors.label3} strokeWidth={2.2} /></View>
          </Pressable>
        ))}
      </View>
    </View>
  ) : null;

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar><BarButton icon="gear" label={t.settings} onPress={() => router.push('/settings')} /></TopBar>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}>
        {header}
        <View style={wide ? [styles.cols, { flexDirection: row }] : styles.stack}>
          <View style={[styles.col, wide && styles.colWide]}><DayCard day={day} />{word}</View>
          <View style={[styles.col, wide && styles.colWide]}>{hourCard}{list}</View>
        </View>
      </ScrollView>
      <DayPicker visible={picking} day={day} onPick={(d) => { setPicking(false); pickDay(d); }} onClose={() => setPicking(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  cols: { gap: 28, alignItems: 'flex-start' },
  stack: { gap: 20 },
  col: { gap: 20, minWidth: 0, width: '100%' },
  // Only side by side do the columns share the width; stacked, each is as tall as its content.
  colWide: { flex: 1 },
  // The week in its own card, like a widget.
  head: { gap: 8, marginBottom: 20, borderRadius: 24, paddingTop: 14, paddingBottom: 10, paddingHorizontal: 14 },
  // A week is read at a glance; across a wide screen it would be too far apart.
  headWide: { maxWidth: 560, width: '100%' },
  headWideRtl: { alignSelf: 'flex-end' },
  titleRow: { alignItems: 'center', gap: 10 },
  titleText: { flex: 1, minWidth: 0, alignItems: 'baseline', gap: 10 },
  title: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  subtitle: { fontSize: 15, flexShrink: 1 },
  dim: { opacity: 0.6 },
  todayPill: { borderRadius: 999, paddingHorizontal: 14, height: 34, justifyContent: 'center' },
  todayText: { fontSize: 14, fontWeight: '700' },
  calendar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  wordCard: { paddingVertical: 30, paddingHorizontal: 30 },
  wordHead: { justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 },
  wordLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  wordLabelAr: { fontFamily: FONTS.arBold, fontWeight: undefined, fontSize: 15, letterSpacing: 0, textTransform: 'none' },
  wordRef: { fontSize: 13 },
  wordAr: { fontFamily: FONTS.ar, fontSize: 24, lineHeight: 46, textAlign: 'right', writingDirection: 'rtl' },
  wordSv: { fontFamily: FONTS.sv, fontSize: 19, lineHeight: 29 },
  wordAr2: { fontSize: 20, lineHeight: 38, marginTop: 8 },
  wordSv2: { fontSize: 16, lineHeight: 24, marginTop: 10 },
  hourCard: { borderRadius: 28, padding: 22, minHeight: 160, overflow: 'hidden', gap: 4 },
  sun: { position: 'absolute', top: 22, width: 46, height: 46, borderRadius: 23, boxShadow: '0 0 30px 8px rgba(255,240,200,0.45)' },
  moon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F1ECDC', boxShadow: '0 0 30px 4px rgba(240,236,220,0.25)' },
  hourEyebrow: { fontSize: 13, fontWeight: '600', opacity: 0.85 },
  hourName: { fontSize: 26, fontWeight: '700' },
  hourName2: { fontFamily: FONTS.arBold, fontSize: 22, lineHeight: 36, opacity: 0.95 },
  go: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.26)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.5)' },
  goText: { fontSize: 15, fontWeight: '600' },
  list: { borderRadius: 24, overflow: 'hidden' },
  rowBtn: { alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowTitleAr: { fontFamily: FONTS.arBold, fontSize: 17, fontWeight: 'normal' },
  rowSub: { fontSize: 13, marginTop: 2 },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { transform: [{ scale: 0.98 }] },
});
