import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTodayIso } from '../day';
import { addDays, coptic, copticText, dayDiff, fromIso, gregorianText, isoDate, observances, toArDigits, WEEKDAYS_SHORT } from '../lib/coptic';
import type { Lang } from '../lib/types';
import { useSettings } from '../settings';

/** Weeks reachable by swiping, either side of this one; the calendar reaches further. */
const RANGE = 104;
/** Weekday, tile and feast dot: a fixed height, so no browser can measure the strip short and cut it. */
const STRIP_H = 84;

/**
 * A week at a glance: each day with its Coptic date beneath, today marked,
 * the chosen day a crimson tile with a fine inner rule like the Katameros
 * frame, and feasts with a gold dot. Swipe for other weeks; tap a day to
 * read it. Weeks start on Monday in Swedish and on Saturday in Arabic, and
 * run right to left in Arabic.
 */
export function WeekStrip({ day, onPick }: { day: Date; onPick: (d: Date) => void }) {
  const { lang } = useSettings();
  const ar = lang === 'ar';
  const todayIso = useTodayIso();
  const [width, setWidth] = useState(0);
  const list = useRef<FlatList<number>>(null);
  const weekStart = ar ? 6 : 1;
  const startOf = useCallback((d: Date) => addDays(d, -((d.getDay() - weekStart + 7) % 7)), [weekStart]);
  const anchor = useMemo(() => startOf(fromIso(todayIso)), [startOf, todayIso]);
  const weeks = useMemo(() => Array.from({ length: RANGE * 2 + 1 }, (_, i) => i - RANGE), []);
  const indexOf = useCallback((d: Date) => Math.min(RANGE * 2, Math.max(0, RANGE + Math.round(dayDiff(startOf(d), anchor) / 7))), [startOf, anchor]);

  // When the chosen day moves to another week (the calendar, "Idag"), the strip follows.
  const dayIso = isoDate(day);
  useEffect(() => {
    if (width) list.current?.scrollToIndex({ index: indexOf(fromIso(dayIso)), animated: true });
  }, [dayIso, width, indexOf]);

  return (
    <View style={styles.wrap} onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}>
      {width > 0 && (
        <FlatList
          ref={list}
          style={styles.list}
          horizontal
          pagingEnabled
          inverted={ar}
          data={weeks}
          keyExtractor={String}
          showsHorizontalScrollIndicator={false}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          initialScrollIndex={indexOf(day)}
          initialNumToRender={1}
          windowSize={3}
          extraData={[dayIso, todayIso, lang]}
          renderItem={({ item }) => (
            <Week start={addDays(anchor, item * 7)} width={width} dayIso={dayIso} todayIso={todayIso} lang={lang} onPick={onPick} />
          )}
        />
      )}
    </View>
  );
}

const Week = memo(function Week({ start, width, dayIso, todayIso, lang, onPick }: {
  start: Date; width: number; dayIso: string; todayIso: string; lang: Lang; onPick: (d: Date) => void;
}) {
  const { colors } = useSettings();
  const ar = lang === 'ar';
  const num = (n: number) => (ar ? toArDigits(n) : String(n));
  return (
    <View style={[styles.week, { width, flexDirection: ar ? 'row-reverse' : 'row' }]}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = addDays(start, i);
        const iso = isoDate(d);
        const c = coptic(d);
        const chosen = iso === dayIso;
        const today = iso === todayIso;
        const feast = observances(d).some((o) => o.major);
        return (
          <Pressable key={iso} accessibilityRole="button" accessibilityState={{ selected: chosen }}
            accessibilityLabel={`${gregorianText(d, lang)}, ${copticText(c, lang)}`}
            onPress={() => onPick(d)} style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
            <Text style={[styles.weekday, ar && styles.weekdayAr, { color: today ? colors.crimson : colors.label2 }]}>{WEEKDAYS_SHORT[lang][d.getDay()]}</Text>
            <View style={[styles.tile, chosen && { backgroundColor: colors.crimson }, today && !chosen && { borderColor: colors.crimson, borderWidth: 1.5 }]}>
              {chosen && <View pointerEvents="none" style={styles.tileRule} />}
              <Text style={[styles.num, { color: chosen ? '#FFFFFF' : today ? colors.crimson : colors.label }]}>{num(d.getDate())}</Text>
              <Text style={[styles.cop, { color: chosen ? 'rgba(255,255,255,0.85)' : colors.label2 }]}>{num(c.day)}</Text>
            </View>
            <View style={[styles.mark, feast && { backgroundColor: colors.gold }]} />
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginHorizontal: -4, height: STRIP_H },
  list: { height: STRIP_H },
  week: { justifyContent: 'space-between', paddingHorizontal: 4, height: STRIP_H, paddingTop: 2 },
  cell: { flex: 1, alignItems: 'center', gap: 4 },
  weekday: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  weekdayAr: { letterSpacing: 0, fontSize: 12 },
  tile: { width: 42, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  // The Katameros double rule, in small: a hairline just inside the chosen day's tile.
  tileRule: { position: 'absolute', top: 2.5, left: 2.5, right: 2.5, bottom: 2.5, borderRadius: 9.5, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'rgba(255,255,255,0.55)' },
  num: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cop: { fontSize: 10.5, fontWeight: '500', marginTop: -1, fontVariant: ['tabular-nums'] },
  mark: { width: 5, height: 5, borderRadius: 3 },
  pressed: { transform: [{ scale: 0.94 }] },
});
