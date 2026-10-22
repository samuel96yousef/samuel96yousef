import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CopticCross } from '../../components/CopticCross';
import { Icon } from '../../components/Icon';
import { LargeTitle, SectionLabel } from '../../components/LargeTitle';
import { FramedCard } from '../../components/Page';
import { BarButton, TopBar } from '../../components/TopBar';
import { agpeyaIndex, getOverview, katameros } from '../../data';
import { coptic, copticText, gregorianText, HOURS, hourNow, isFastDay, MONTHS, observances, season, startOfDay, toArDigits } from '../../lib/coptic';
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
  const today = startOfDay(now);
  // Nothing here waits for a Bible book: the readings are titles and
  // references, and the word of the day ships with the lectionary.
  const overview = getOverview(today);
  const c = coptic(today);
  const obs = observances(today);
  const seasonInfo = season(today);
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
    ...(isFastDay(today) && !seasonInfo?.fasting ? [{ text: t.fastDay, tone: 'quiet' }] : []),
  ];

  const dateCard = (
    <FramedCard style={styles.dateCard}>
      <Text style={[styles.cop, { color: page.rule }]}>{MONTHS[c.month - 1][2]}</Text>
      <Text style={[ar ? styles.bigAr : styles.big, { color: page.ink }]}>{copticText(c, ar ? 'ar' : 'sv')}</Text>
      <Text style={[ar ? styles.smallSv : styles.smallAr, { color: page.ink }]}>
        {ar ? copticText(c, 'sv') : `${copticText(c, 'ar')} ${toArDigits(c.year)} ش`}
      </Text>
      <Text style={[styles.greg, { color: page.ink2 }]}>{gregorianText(today, lang)}{'\n'}{t.year(c.year)}</Text>
      {chips.length > 0 && (
        <View style={styles.chips}>
          {chips.map((ch) => (
            <View key={ch.text} style={[styles.chip, { backgroundColor: ch.tone === 'quiet' ? colors.bg2 : ch.tone === 'gold' ? 'rgba(151,111,34,0.14)' : colors.tint }]}>
              <Text style={[styles.chipText, { color: ch.tone === 'quiet' ? colors.label2 : ch.tone === 'gold' ? colors.gold : colors.crimson }]}>{ch.text}</Text>
            </View>
          ))}
        </View>
      )}
    </FramedCard>
  );

  const word = lit && verse ? (
    <View style={styles.word}>
      <SectionLabel>{t.word}</SectionLabel>
      {[primary, second].map((l, i) => (
        <Text key={l} style={[l === 'ar' ? styles.wordAr : styles.wordSv, { color: i ? colors.label2 : colors.label }, i ? (l === 'ar' ? styles.wordAr2 : styles.wordSv2) : null]}>
          {l === 'ar' ? verse[0] : verse[1]}
        </Text>
      ))}
      <Text style={[styles.wordRef, { color: colors.label2 }, ar && styles.right]}>{ar ? toArDigits(lit.refs.ar[lit.refs.ar.length - 1]) : lit.refs.sv[lit.refs.sv.length - 1]}</Text>
    </View>
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
      <SectionLabel>{t.todaysReadings}</SectionLabel>
      <View style={[styles.list, { backgroundColor: colors.surface }]}>
        {overview.sections.map((s, i) => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/readings', params: { section: s.key } })}
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
        <LargeTitle title={t.today} subtitle={gregorianText(today, lang)} />
        <View style={wide ? [styles.cols, { flexDirection: row }] : styles.stack}>
          <View style={styles.col}>{dateCard}{word}</View>
          <View style={styles.col}>{hourCard}{list}</View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  cols: { gap: 28, alignItems: 'flex-start' },
  stack: { gap: 20 },
  col: { flex: 1, gap: 20, minWidth: 0, width: '100%' },
  dateCard: { alignItems: 'center' },
  cop: { fontFamily: FONTS.cop, fontSize: 15, letterSpacing: 1 },
  big: { fontFamily: FONTS.svSemi, fontSize: 56, lineHeight: 66, marginTop: 4 },
  bigAr: { fontFamily: FONTS.arBold, fontSize: 48, lineHeight: 80 },
  smallAr: { fontFamily: FONTS.arBold, fontSize: 28, lineHeight: 48, marginTop: 4 },
  smallSv: { fontFamily: FONTS.svSemi, fontSize: 26, lineHeight: 34 },
  greg: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 14 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },
  word: { paddingHorizontal: 4 },
  wordAr: { fontFamily: FONTS.ar, fontSize: 25, lineHeight: 48, textAlign: 'right', writingDirection: 'rtl' },
  wordSv: { fontFamily: FONTS.sv, fontSize: 19, lineHeight: 29 },
  wordAr2: { fontSize: 21, lineHeight: 40, marginTop: 8 },
  wordSv2: { fontSize: 16, lineHeight: 24, marginTop: 10 },
  wordRef: { fontSize: 13, marginTop: 10 },
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
