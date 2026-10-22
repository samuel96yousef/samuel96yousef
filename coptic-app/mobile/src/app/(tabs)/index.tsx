import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CopticCross } from '../../components/CopticCross';
import { DayPicker } from '../../components/DayPicker';
import { Glass } from '../../components/Glass';
import { Icon } from '../../components/Icon';
import { SectionLabel } from '../../components/LargeTitle';
import { FramedCard } from '../../components/Page';
import { BarButton, TopBar } from '../../components/TopBar';
import { agpeyaIndex, getOverview, katameros } from '../../data';
import { pickDay, useReadingDay } from '../../day';
import { addDays, coptic, copticText, dayDiff, dayMonthText, gregorianText, HOURS, hourNow, isFastDay, MONTHS, observances, season, toArDigits } from '../../lib/coptic';
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

/** A small round step to the day before or after, inside the stepper. */
function Step({ n, onPress }: { n: -1 | 1; onPress: () => void }) {
  const { t, lang, colors } = useSettings();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={n < 0 ? t.prevDay : t.nextDay} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [styles.stepBtn, pressed && { backgroundColor: colors.bg2 }]}>
      <View style={lang === 'ar' && styles.flip}><Icon name={n < 0 ? 'chevL' : 'chevR'} size={17} color={colors.label} strokeWidth={2.4} /></View>
    </Pressable>
  );
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
  const c = coptic(day);
  const obs = observances(day);
  const seasonInfo = season(day);
  const hid = hourNow(now);
  const hour = agpeyaIndex.find((h) => h.id === hid);
  const sky = HOUR_SKY[hid];
  const lit = overview.sections.find((s) => s.key === 'liturgy');
  const verse = lit ? katameros.openings?.[lit.ref] : undefined;
  const ar = lang === 'ar';
  const row = ar ? ('row-reverse' as const) : ('row' as const);
  const second = primary === 'ar' ? 'sv' : 'ar';

  const chips = [
    ...obs.map((o) => ({ text: ar ? o.ar : o.sv, tone: o.major ? 'gold' : 'crimson' })),
    ...(seasonInfo ? [{ text: ar ? seasonInfo.ar : seasonInfo.sv, tone: 'quiet' }] : []),
    ...(isFastDay(day) && !seasonInfo?.fasting ? [{ text: t.fastDay, tone: 'quiet' }] : []),
  ];
  const diff = dayDiff(day, now);
  const relative = isToday ? '' : diff === 1 ? t.tomorrow : diff === -1 ? t.yesterday : '';
  const sameYear = day.getFullYear() === now.getFullYear();
  const eyebrow = [relative, gregorianText(day, lang, !sameYear)].filter(Boolean).join(' · ');

  // The date, once: the weekday and Gregorian date small above, the Coptic
  // date as the title, the Arabic (or Swedish) date and the Coptic month in
  // Coptic beneath. Tap the title for the calendar; the arrows step a day.
  const header = (
    <View style={styles.head}>
      <Text style={[styles.eyebrow, { color: colors.crimson }, ar && styles.eyebrowAr]}>{eyebrow}</Text>
      <View style={[styles.titleRow, { flexDirection: row }, wide && styles.titleRowWide]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${copticText(c, lang)}, ${gregorianText(day, lang)}. ${t.pickDay}`}
          onPress={() => setPicking(true)} style={({ pressed }) => [styles.titleTap, { flexDirection: row }, pressed && styles.dim]}>
          <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, ar && styles.titleAr, { color: colors.label }]}>{copticText(c, ar ? 'ar' : 'sv')}</Text>
          <Icon name="chevD" size={18} color={colors.crimson} strokeWidth={2.6} />
        </Pressable>
        <Glass style={styles.stepper} interactive>
          <View style={[styles.stepperRow, { flexDirection: row }]}>
            <Step n={-1} onPress={() => pickDay(addDays(day, -1))} />
            {!isToday && (
              <Pressable accessibilityRole="button" onPress={() => pickDay(new Date())} hitSlop={6} style={({ pressed }) => pressed && styles.dim}>
                <Text style={[styles.todayText, { color: colors.crimson }]}>{t.goToday}</Text>
              </Pressable>
            )}
            <Step n={1} onPress={() => pickDay(addDays(day, 1))} />
          </View>
        </Glass>
      </View>
      {/* Separate pieces, so Arabic, Swedish and Coptic never get reordered by one another. */}
      <View style={[styles.sub, { flexDirection: row }]}>
        {ar
          ? <Text style={[styles.subSv, { color: colors.label2 }]}>{`${copticText(c, 'sv')} ${c.year}`}</Text>
          : <Text style={[styles.subAr, { color: colors.label2 }]}>{`${copticText(c, 'ar')} ${toArDigits(c.year)} ش`}</Text>}
        <Text style={[styles.subSv, { color: colors.label3 }]}>·</Text>
        <Text style={[styles.subCop, { color: colors.label2 }]}>{MONTHS[c.month - 1][2]}</Text>
      </View>
      {chips.length > 0 && (
        <View style={[styles.chips, { flexDirection: row }]}>
          {chips.map((ch) => (
            <View key={ch.text} style={[styles.chip, { backgroundColor: ch.tone === 'quiet' ? colors.bg2 : ch.tone === 'gold' ? 'rgba(151,111,34,0.14)' : colors.tint }]}>
              <Text style={[styles.chipText, { color: ch.tone === 'quiet' ? colors.label2 : ch.tone === 'gold' ? colors.gold : colors.crimson }]}>{ch.text}</Text>
            </View>
          ))}
        </View>
      )}
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
          <View style={[styles.col, wide && styles.colWide]}>{word}</View>
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
  head: { marginBottom: 20 },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  eyebrowAr: { textAlign: 'right', writingDirection: 'rtl', letterSpacing: 0, textTransform: 'none', fontSize: 14 },
  titleRow: { alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 2 },
  titleRowWide: { justifyContent: 'flex-start', gap: 20 },
  titleTap: { alignItems: 'center', gap: 6, flexShrink: 1 },
  title: { fontSize: 34, fontWeight: '700', lineHeight: 41, flexShrink: 1 },
  titleAr: { writingDirection: 'rtl' },
  dim: { opacity: 0.6 },
  stepper: { borderRadius: 999 },
  stepperRow: { alignItems: 'center', gap: 2, padding: 3 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  todayText: { fontSize: 14, fontWeight: '700', paddingHorizontal: 6 },
  sub: { alignItems: 'center', gap: 8, marginTop: 2 },
  subAr: { fontFamily: FONTS.ar, fontSize: 18, lineHeight: 28, writingDirection: 'rtl' },
  subSv: { fontSize: 15, lineHeight: 28 },
  subCop: { fontFamily: FONTS.cop, fontSize: 14, lineHeight: 28 },
  chips: { flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },
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
