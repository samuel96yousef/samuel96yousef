import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../../../components/Icon';
import { LargeTitle } from '../../../../components/LargeTitle';
import { TopBar } from '../../../../components/TopBar';
import { holyWeek } from '../../../../data';
import { dateOf, holyWeekYear } from '../../../../holyweek';
import { gregorianText, isoDate, toArDigits } from '../../../../lib/coptic';
import { useSettings } from '../../../../settings';
import { FONTS } from '../../../../theme';

/** The days of Holy Week, from Lazarus Saturday to Easter, with this year's dates; today, if it is one, marked. */
export default function Pascha() {
  const { t, lang, colors, sidebar } = useSettings();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const today = new Date();
  const year = holyWeekYear(today);
  const row = ar ? ('row-reverse' as const) : ('row' as const);
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={sidebar ? undefined : t.prayers} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}>
        <LargeTitle title={t.pascha} subtitle={t.paschaSub} />
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          {holyWeek.days.map((d, i) => {
            const date = dateOf(d, year);
            const now = isoDate(date) === isoDate(today);
            return (
              <Pressable key={d.id} accessibilityRole="button" onPress={() => router.push(`/prayers/pascha/${d.id}`)}
                style={({ pressed }) => [styles.item, { flexDirection: row }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.sep }, pressed && { backgroundColor: colors.bg2 }]}>
                <View style={[styles.date, { backgroundColor: now ? colors.crimson : colors.tint }]}>
                  <Text style={[styles.dateDay, { color: now ? '#FFFFFF' : colors.crimson }]}>{ar ? toArDigits(date.getDate()) : date.getDate()}</Text>
                </View>
                <View style={styles.text}>
                  <View style={[styles.nameRow, { flexDirection: row }]}>
                    <Text style={[styles.name, { color: colors.label }, ar && styles.right]}>{ar ? d.ar : d.sv}</Text>
                    {now && <View style={[styles.now, { backgroundColor: colors.crimson }]}><Text style={styles.nowText}>{t.today}</Text></View>}
                  </View>
                  <Text style={[ar ? styles.secondSv : styles.secondAr, { color: colors.label2 }, ar ? styles.right : styles.left]}>{ar ? d.sv : d.ar}</Text>
                  <Text style={[styles.sub, { color: colors.label3 }, ar && styles.right]}>{gregorianText(date, lang, false)} · {t.servicesCount(d.services.length)}</Text>
                </View>
                <View style={ar && styles.flip}><Icon name="chevR" size={16} color={colors.label3} strokeWidth={2.2} /></View>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.label3 }, ar && styles.right]}>{t.paschaNote}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  group: { borderRadius: 18, overflow: 'hidden' },
  item: { alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, minHeight: 64 },
  date: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  text: { flex: 1, minWidth: 0 },
  nameRow: { alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  now: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  nowText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  secondAr: { fontFamily: FONTS.ar, fontSize: 15, lineHeight: 24 },
  secondSv: { fontSize: 13.5, lineHeight: 20, marginTop: 2 },
  sub: { fontSize: 12.5, marginTop: 2 },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 16, marginHorizontal: 4 },
  left: { textAlign: 'left' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
});
