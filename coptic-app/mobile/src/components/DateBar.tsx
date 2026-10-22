import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { addDays, coptic, copticText, dayDiff, gregorianText, startOfDay } from '../lib/coptic';
import { useSettings } from '../settings';
import { FONTS } from '../theme';
import { DayPicker } from './DayPicker';
import { Glass } from './Glass';
import { Icon } from './Icon';

/**
 * Step through the Katameros day by day, or tap the date to pick any day from
 * a calendar. `compact` is the slim version that shares a row with other
 * controls above the open book.
 */
export function DateBar({ date, onChange, compact }: { date: Date; onChange: (d: Date) => void; compact?: boolean }) {
  const { t, lang, colors } = useSettings();
  const [picking, setPicking] = useState(false);
  const ar = lang === 'ar';
  const c = coptic(date);
  const isToday = dayDiff(date, new Date()) === 0;
  return (
    <View style={[styles.bar, compact && styles.barCompact, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
      <DayStep n={-1} small={compact} onPress={() => onChange(addDays(date, -1))} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${gregorianText(date, lang)}. ${t.pickDay}`} onPress={() => setPicking(true)}
        style={({ pressed }) => [compact ? styles.whenCompact : styles.when, pressed && styles.dim]}>
        <Text style={[styles.cop, { color: colors.label }, ar && styles.right]}>
          {copticText(c, ar ? 'ar' : 'sv')}
          {!ar && <Text style={[styles.copAr, { color: colors.label2 }]}>  {copticText(c, 'ar')}</Text>}
        </Text>
        <View style={[styles.gregRow, ar && styles.gregRowRtl]}>
          <Text style={[styles.greg, { color: colors.label2 }, ar && styles.right]}>{gregorianText(date, lang)}</Text>
          <Icon name="chevD" size={13} color={colors.label2} strokeWidth={2.4} />
        </View>
      </Pressable>
      <DayPicker visible={picking} day={date} onPick={(d) => { setPicking(false); onChange(d); }} onClose={() => setPicking(false)} />
      {!isToday && (
        <Pressable accessibilityRole="button" onPress={() => onChange(startOfDay(new Date()))} style={[styles.today, { backgroundColor: colors.tint }]}>
          <Text style={[styles.todayText, { color: colors.crimson }]}>{t.goToday}</Text>
        </Pressable>
      )}
      <DayStep n={1} small={compact} onPress={() => onChange(addDays(date, 1))} />
    </View>
  );
}

/** A round button to the day before or after. */
export function DayStep({ n, onPress, style, small }: { n: number; onPress: () => void; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const { t, lang, colors } = useSettings();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={n < 0 ? t.prevDay : t.nextDay} onPress={onPress} style={({ pressed }) => [style, pressed && styles.pressed]}>
      <Glass style={[styles.round, small && styles.roundSmall]} interactive>
        <View style={[styles.roundInner, small && styles.roundSmall]}>
          <View style={lang === 'ar' && styles.flip}><Icon name={n < 0 ? 'chevL' : 'chevR'} size={20} color={colors.label} strokeWidth={2.2} /></View>
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center', gap: 10, marginBottom: 14 },
  barCompact: { marginBottom: 0, gap: 8 },
  // As wide as the date, beside other controls (flex: 0 would make it zero wide on the web).
  whenCompact: { flexShrink: 0 },
  roundSmall: { width: 36, height: 36, borderRadius: 18 },
  round: { width: 42, height: 42, borderRadius: 21 },
  roundInner: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  when: { flex: 1, minWidth: 0 },
  cop: { fontSize: 17, fontWeight: '700' },
  copAr: { fontFamily: FONTS.arBold, fontSize: 17, fontWeight: 'normal' },
  greg: { fontSize: 13 },
  gregRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  gregRowRtl: { flexDirection: 'row-reverse' },
  dim: { opacity: 0.6 },
  today: { borderRadius: 999, paddingHorizontal: 14, height: 34, justifyContent: 'center' },
  todayText: { fontSize: 14, fontWeight: '600' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { transform: [{ scale: 0.92 }] },
});
