import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTodayIso } from '../day';
import { addDays, coptic, copticText, fromIso, gregorianText, isoDate, observances, toArDigits, WEEKDAYS_SHORT } from '../lib/coptic';
import type { Lang } from '../lib/types';
import { useSettings } from '../settings';

/** Weekday, tile and feast dot: a fixed height, so no browser can measure the strip short and cut it. */
const STRIP_H = 84;
/** How long a week takes to slide across. */
const SLIDE_MS = 280;

/**
 * A week at a glance: each day with its Coptic date beneath, today marked,
 * the chosen day a crimson tile with a fine inner rule like the Katameros
 * frame, and feasts with a gold dot. Swipe for other weeks; tap a day to
 * read it. Weeks start on Monday in Swedish and on Saturday in Arabic, and
 * run right to left in Arabic.
 *
 * One week is laid out at a time, with the weeks before and after it beside
 * it off screen, all in percentages of the strip: a new window width only
 * reflows the days and never scrolls anything. A swipe or a new chosen day
 * slides the row across, then the week beside becomes the one shown.
 */
export function WeekStrip({ day, onPick }: { day: Date; onPick: (d: Date) => void }) {
  const { lang } = useSettings();
  const ar = lang === 'ar';
  const todayIso = useTodayIso();
  const reduce = useReducedMotion();
  const weekStart = ar ? 6 : 1;
  const startOf = useCallback((d: Date) => addDays(d, -((d.getDay() - weekStart + 7) % 7)), [weekStart]);
  const dayIso = isoDate(day);
  const [shown, setShown] = useState(() => isoDate(startOf(day)));
  // A week further than the next one (the calendar, "Idag") takes the place of the neighbour it slides in from.
  const [target, setTarget] = useState<{ iso: string; dir: 1 | -1 } | null>(null);
  const width = useRef(0);
  const busy = useRef(false);
  const tx = useSharedValue(0);
  // Later weeks lie to the right, or to the left in Arabic.
  const side = ar ? -1 : 1;

  const live = useRef({ shown, side });
  useEffect(() => { live.current = { shown, side }; }, [shown, side]);

  // The row is back in the middle once the new week is drawn there.
  useLayoutEffect(() => { tx.set(0); }, [shown, tx]);

  // A day picked during a slide is caught up with once the slide ends.
  const pending = useRef<string | null>(null);
  const slide = useCallback(function go(dir: 1 | -1, iso: string) {
    busy.current = true;
    setTarget({ iso, dir });
    const done = () => {
      busy.current = false;
      live.current.shown = iso;
      setTarget(null);
      setShown(iso);
      const next = pending.current;
      pending.current = null;
      if (next && next !== iso) setTimeout(() => go(next > iso ? 1 : -1, next), 0);
    };
    if (reduce || !width.current) { done(); return; }
    tx.set(withTiming(-dir * live.current.side * width.current, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }));
    setTimeout(done, SLIDE_MS);
  }, [reduce, tx]);

  // When the chosen day moves to another week, the strip slides to it. A swipe alone does not move the chosen day.
  useEffect(() => {
    const want = isoDate(startOf(fromIso(dayIso)));
    if (busy.current) { pending.current = want; return; }
    const cur = live.current.shown;
    if (want !== cur) slide(want > cur ? 1 : -1, want);
  }, [dayIso, startOf, slide]);

  // Also when the language changes the first day of the week.
  const [lastStart, setLastStart] = useState(weekStart);
  if (lastStart !== weekStart) { setLastStart(weekStart); setShown(isoDate(startOf(day))); }

  const drag = useRef({ active: false, dx: 0, vx: 0 });
  const pan = usePanGesture({
    activeOffsetX: [-12, 12],
    failOffsetY: [-10, 10],
    runOnJS: true,
    onUpdate: (e) => {
      if (busy.current) return;
      drag.current = { active: true, dx: e.translationX, vx: e.velocityX };
      tx.set(e.translationX);
    },
    onFinalize: () => {
      const g = drag.current;
      drag.current = { active: false, dx: 0, vx: 0 };
      if (!g.active || busy.current) return;
      // A quarter of the way, or a flick, turns the week; otherwise it springs back.
      const ahead = g.dx + g.vx * 0.15;
      if (Math.abs(ahead) > width.current * 0.25) {
        const dir: 1 | -1 = ahead * live.current.side < 0 ? 1 : -1;
        slide(dir, isoDate(addDays(fromIso(live.current.shown), dir * 7)));
      } else tx.set(withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }));
    },
  });

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }] }));
  const start = fromIso(shown);
  const prev = target?.dir === -1 ? fromIso(target.iso) : addDays(start, -7);
  const next = target?.dir === 1 ? fromIso(target.iso) : addDays(start, 7);
  const before = side > 0 ? styles.left : styles.right;
  const after = side > 0 ? styles.right : styles.left;

  return (
    <GestureDetector gesture={pan} touchAction="pan-y">
      <View style={styles.wrap} onLayout={(e) => { width.current = e.nativeEvent.layout.width; }}>
        <Animated.View style={[styles.row, row]}>
          <Week start={prev} style={before} dayIso={dayIso} todayIso={todayIso} lang={lang} onPick={onPick} />
          <Week start={start} style={styles.middle} dayIso={dayIso} todayIso={todayIso} lang={lang} onPick={onPick} />
          <Week start={next} style={after} dayIso={dayIso} todayIso={todayIso} lang={lang} onPick={onPick} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const Week = memo(function Week({ start, style, dayIso, todayIso, lang, onPick }: {
  start: Date; style: ViewStyle; dayIso: string; todayIso: string; lang: Lang; onPick: (d: Date) => void;
}) {
  const { colors } = useSettings();
  const ar = lang === 'ar';
  const num = (n: number) => (ar ? toArDigits(n) : String(n));
  return (
    <View style={[styles.week, style, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
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
  wrap: { marginHorizontal: -4, height: STRIP_H, overflow: 'hidden' },
  row: { flex: 1 },
  week: { position: 'absolute', top: 0, width: '100%', justifyContent: 'space-between', paddingHorizontal: 4, height: STRIP_H, paddingTop: 2 },
  middle: { left: 0 },
  left: { left: '-100%' },
  right: { left: '100%' },
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
