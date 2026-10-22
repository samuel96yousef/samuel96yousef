import { Pressable, StyleSheet, Text, View } from 'react-native';

import { addDays, coptic, copticText, dayDiff, gregorianText, startOfDay } from '../lib/coptic';
import { useSettings } from '../settings';
import { FONTS } from '../theme';
import { Glass } from './Glass';
import { Icon } from './Icon';

/** Step through the Katameros day by day; any date works. */
export function DateBar({ date, onChange }: { date: Date; onChange: (d: Date) => void }) {
  const { t, lang, colors } = useSettings();
  const ar = lang === 'ar';
  const c = coptic(date);
  const isToday = dayDiff(date, new Date()) === 0;
  return (
    <View style={[styles.bar, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
      <StepButton n={-1} onPress={() => onChange(addDays(date, -1))} />
      <View style={styles.when}>
        <Text style={[styles.cop, { color: colors.label }, ar && styles.right]}>
          {copticText(c, ar ? 'ar' : 'sv')}
          {!ar && <Text style={[styles.copAr, { color: colors.label2 }]}>  {copticText(c, 'ar')}</Text>}
        </Text>
        <Text style={[styles.greg, { color: colors.label2 }, ar && styles.right]}>{gregorianText(date, lang)}</Text>
      </View>
      {!isToday && (
        <Pressable accessibilityRole="button" onPress={() => onChange(startOfDay(new Date()))} style={[styles.today, { backgroundColor: colors.tint }]}>
          <Text style={[styles.todayText, { color: colors.crimson }]}>{t.goToday}</Text>
        </Pressable>
      )}
      <StepButton n={1} onPress={() => onChange(addDays(date, 1))} />
    </View>
  );
}

function StepButton({ n, onPress }: { n: number; onPress: () => void }) {
  const { t, lang, colors } = useSettings();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={n < 0 ? t.prevDay : t.nextDay} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Glass style={styles.round} interactive>
        <View style={styles.roundInner}>
          <View style={lang === 'ar' && styles.flip}><Icon name={n < 0 ? 'chevL' : 'chevR'} size={20} color={colors.label} strokeWidth={2.2} /></View>
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center', gap: 10, marginBottom: 14 },
  round: { width: 42, height: 42, borderRadius: 21 },
  roundInner: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  when: { flex: 1, minWidth: 0 },
  cop: { fontSize: 17, fontWeight: '700' },
  copAr: { fontFamily: FONTS.arBold, fontSize: 17, fontWeight: 'normal' },
  greg: { fontSize: 13, marginTop: 1 },
  today: { borderRadius: 999, paddingHorizontal: 14, height: 34, justifyContent: 'center' },
  todayText: { fontSize: 14, fontWeight: '600' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { transform: [{ scale: 0.92 }] },
});
