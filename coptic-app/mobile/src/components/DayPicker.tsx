import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { coptic, copticText, dayDiff, gregorianText, MONTHS, monthText, observances, toArDigits, WEEKDAYS_SHORT } from '../lib/coptic';
import { useSettings } from '../settings';
import { Icon } from './Icon';

const monthOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/**
 * Pick a day from a month. Each date carries its Coptic day beneath it,
 * today is ringed, the chosen day is filled, and feast days have a gold dot.
 * Weeks start on Monday in Swedish and on Saturday in Arabic.
 */
export function DayPicker({ visible, day, onPick, onClose }: { visible: boolean; day: Date; onPick: (d: Date) => void; onClose: () => void }) {
  const { t, lang, colors } = useSettings();
  const { width } = useWindowDimensions();
  const ar = lang === 'ar';
  const [shown, setShown] = useState(() => monthOf(day));
  // Each time it opens, it opens on the chosen day's month.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setShown(monthOf(day));
  }

  const weekStart = ar ? 6 : 1;
  const weeks = useMemo(() => {
    const y = shown.getFullYear();
    const m = shown.getMonth();
    const count = new Date(y, m + 1, 0).getDate();
    const lead = (shown.getDay() - weekStart + 7) % 7;
    const cells: (Date | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => new Date(y, m, i + 1))];
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  }, [shown, weekStart]);

  // The Coptic months the Gregorian month spans, e.g. "Baba – Hatour 1743".
  const first = coptic(shown);
  const last = coptic(new Date(shown.getFullYear(), shown.getMonth() + 1, 0));
  const name = (c: { month: number }) => MONTHS[c.month - 1][ar ? 1 : 0];
  const span = `${name(first)}${first.month !== last.month ? ` – ${name(last)}` : ''} ${ar ? toArDigits(last.year) : last.year}`;

  const now = new Date();
  const step = (n: number) => setShown(new Date(shown.getFullYear(), shown.getMonth() + n, 1));
  const row = ar ? ('row-reverse' as const) : ('row' as const);
  const num = (n: number) => (ar ? toArDigits(n) : String(n));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.wrap}>
        <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={onClose} accessibilityLabel={t.close} />
        <View style={[styles.card, { width: Math.min(380, width - 32), backgroundColor: colors.surface, boxShadow: `0 24px 60px -20px ${colors.shadow}` }]}>
          <View style={[styles.head, { flexDirection: row }]}>
            <MonthStep label={t.prevMonth} dir={-1} onPress={() => step(-1)} />
            <View style={styles.title}>
              <Text style={[styles.month, { color: colors.label }]}>{monthText(shown, lang)}</Text>
              <Text style={[styles.span, { color: colors.crimson }]}>{span}</Text>
            </View>
            <MonthStep label={t.nextMonth} dir={1} onPress={() => step(1)} />
          </View>
          <View style={[styles.week, { flexDirection: row }]}>
            {Array.from({ length: 7 }, (_, i) => (
              <Text key={i} style={[styles.weekday, { color: colors.label2 }]}>{WEEKDAYS_SHORT[lang][(weekStart + i) % 7]}</Text>
            ))}
          </View>
          {weeks.map((w, wi) => (
            <View key={wi} style={[styles.week, { flexDirection: row }]}>
              {w.map((d, i) => {
                if (!d) return <View key={i} style={styles.cell} />;
                const c = coptic(d);
                const chosen = dayDiff(d, day) === 0;
                const today = dayDiff(d, now) === 0;
                const feast = observances(d).some((o) => o.major);
                return (
                  <Pressable
                    key={i}
                    accessibilityRole="button"
                    accessibilityState={{ selected: chosen }}
                    accessibilityLabel={`${gregorianText(d, lang)}, ${copticText(c, lang)}`}
                    onPress={() => onPick(d)}
                    style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
                  >
                    <View style={[styles.dot, chosen && { backgroundColor: colors.crimson }, today && !chosen && { borderColor: colors.crimson, borderWidth: 1.5 }]}>
                      <Text style={[styles.dayNum, { color: chosen ? '#FFFFFF' : today ? colors.crimson : colors.label }]}>{num(d.getDate())}</Text>
                      <Text style={[styles.copNum, { color: chosen ? 'rgba(255,255,255,0.85)' : colors.label2 }]}>{num(c.day)}</Text>
                    </View>
                    {feast && <View style={[styles.feast, { backgroundColor: colors.gold }]} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
          <View style={[styles.foot, { flexDirection: row }]}>
            <Pressable accessibilityRole="button" onPress={() => onPick(new Date())} style={({ pressed }) => [styles.btn, { backgroundColor: colors.tint }, pressed && styles.pressed]}>
              <Text style={[styles.btnText, { color: colors.crimson }]}>{t.goToday}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
              <Text style={[styles.btnText, { color: colors.label }]}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MonthStep({ label, dir, onPress }: { label: string; dir: 1 | -1; onPress: () => void }) {
  const { lang, colors } = useSettings();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.monthStep, { backgroundColor: colors.bg2 }, pressed && styles.pressed]}>
      <View style={lang === 'ar' && styles.flip}><Icon name={dir < 0 ? 'chevL' : 'chevR'} size={18} color={colors.label} strokeWidth={2.2} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrim: { backgroundColor: 'rgba(10,6,8,0.38)' },
  card: { borderRadius: 28, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12 },
  head: { alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { flex: 1, alignItems: 'center' },
  month: { fontSize: 18, fontWeight: '700' },
  span: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  monthStep: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  week: { justifyContent: 'space-between' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', paddingVertical: 4 },
  cell: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 42, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dayNum: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  copNum: { fontSize: 10.5, marginTop: -1, fontVariant: ['tabular-nums'] },
  feast: { position: 'absolute', bottom: 1, width: 5, height: 5, borderRadius: 3 },
  foot: { justifyContent: 'space-between', marginTop: 8 },
  btn: { borderRadius: 999, paddingHorizontal: 18, height: 40, justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '600' },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { transform: [{ scale: 0.94 }] },
});
