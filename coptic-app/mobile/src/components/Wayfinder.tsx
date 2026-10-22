/**
 * Wayfinding in long texts: where you are at the top, how to move at the side.
 *
 * - The context pill takes the middle of the top bar once the title has
 *   scrolled away, like an iOS 26 inline title. It names the section you
 *   are in, who is speaking in a liturgy, and how far you have read.
 * - The dock sits on the side, where the thumb is, as iPhone Duo moves
 *   controls to the edge of its outer screen: ▲ previous, ▼ next, and the
 *   section number between them. Hold the number and the dock turns into a
 *   Digital Crown, a ridged cylinder that rolls under the thumb with a click
 *   per section, while a wheel of sections turns out beside it like the iOS
 *   picker. Keep the finger down and drag to spin it, and the text follows. Drag the number sideways to
 *   move the dock to the other hand or another height.
 * - The list of sections opens where you tapped: down from the pill, or out
 *   from the dock.
 * - On the open book (an unfolded Duo), nothing you touch sits on the fold.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bump, tick } from '../haptics';
import { STRINGS } from '../i18n';
import { toArDigits } from '../lib/coptic';
import type { Lang } from '../lib/types';
import { roleAt, type Outline, type OutlineItem } from '../rows';
import { useSettings, type DockPlace } from '../settings';
import { FONTS, SPRING_SMOOTH } from '../theme';
import { Glass } from './Glass';
import { Icon } from './Icon';
import type { Row } from './Reader';
import { useToast } from './Toast';
import { BAR_HEIGHT } from './TopBar';

// ---------- Where the reader is, shared by the list and the wayfinder ----------

export interface WayState {
  /** First row on screen, including rows under the top bar */
  first: number;
  /** Outline item the reader is in; -1 before the first */
  current: number;
  /** The list of sections is open, and from where */
  sheet: false | 'top' | 'side';
  /** The large title has scrolled under the top bar */
  reading: boolean;
}

export function createWayStore() {
  let state: WayState = { first: 0, current: -1, sheet: false, reading: false };
  const subs = new Set<() => void>();
  const set = (p: Partial<WayState>) => {
    const n = { ...state, ...p };
    if ((Object.keys(n) as (keyof WayState)[]).every((k) => n[k] === state[k])) return;
    state = n;
    subs.forEach((f) => f());
  };
  return {
    get: () => state,
    set,
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
  };
}
export type WayStore = ReturnType<typeof createWayStore>;

/** One value from the store; the component re-renders only when that value changes, not on every scroll. */
export function useWay<T extends string | number | boolean | undefined | null>(store: WayStore, select: (s: WayState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(store.get()));
}

// ---------- Layout ----------

/** The dock: 38 pt wide, 2 pt from the edge, so it ends where the text starts (the page frame begins at 23 pt). */
const DOCK_W = 38;
const DOCK_INSET = 2;
const BTN_H = 40;
const MID_H = 52;
const DOCK_H = BTN_H * 2 + MID_H;
/** The wheel: rows on a drum seen from the front, seven in view. */
const ROW_H = 34;
const ROW_ANGLE = 0.3;
const RADIUS = ROW_H / ROW_ANGLE;
const WHEEL_H = ROW_H * 7;
/** Holding the number this long, without moving, brings out the wheel. */
const HOLD_MS = 220;
/** The crown: a knurled cylinder as tall as the dock, ridges evenly spaced round it. */
const CROWN_R = DOCK_H / 2;
const RIDGES = 30;
const RIDGE_ANGLE = Math.PI / RIDGES;

const digits = (n: number | string, l: Lang) => (l === 'ar' ? toArDigits(n) : String(n));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const label = (it: OutlineItem, l: Lang) => (l === 'ar' ? it.ar : it.sv);
const subLabel = (it: OutlineItem, l: Lang) => (l === 'ar' ? it.subAr : it.subSv);

/** Pill and bubble speak the language being read; on the open book, the app's language. */
function useTextLang(): Lang {
  const { lang, primary, spread } = useSettings();
  return spread ? lang : primary;
}

/** Where the dock rests, between the top bar and the tab bar, from the saved side and height. */
interface DockFrame {
  side: DockPlace['side'];
  x: number;
  top: number;
  minTop: number;
  maxTop: number;
  width: number;
  height: number;
  /** Lowest point a panel may reach, above the tab bar */
  floor: number;
}

function useDockFrame(): DockFrame {
  const { dock } = useSettings();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const minTop = insets.top + BAR_HEIGHT + 12;
  const floor = height - insets.bottom - 90;
  const maxTop = Math.max(minTop, floor - DOCK_H);
  return {
    side: dock.side,
    x: dock.side === 'left' ? DOCK_INSET : width - DOCK_INSET - DOCK_W,
    top: minTop + clamp(dock.y, 0, 1) * (maxTop - minTop),
    minTop, maxTop, width, height, floor,
  };
}

// ---------- Context pill ----------

/** The middle of the top bar while reading: where you are, who speaks, how far you have come. */
export function ContextPill({ outline, rows, store, progress }: {
  outline: Outline; rows: Row[]; store: WayStore; progress: SharedValue<number>;
}) {
  const { t, colors, spread, lang } = useSettings();
  const { width } = useWindowDimensions();
  const reduce = useReducedMotion();
  const L = useTextLang();
  const tl = STRINGS[L];
  const items = outline.items;
  const verses = outline.kind === 'verses';
  const hasRoles = useMemo(() => rows.some((r) => r.k === 'role'), [rows]);
  const cur = useWay(store, (s) => s.current);
  const open = useWay(store, (s) => s.sheet === 'top');
  const role = useWay(store, (s) => (hasRoles ? roleAt(rows, Math.max(s.first + 1, items[s.current]?.index ?? 0)) : undefined));
  // A transform, not a width: it moves on the compositor without a layout pass.
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  const item = cur >= 0 ? items[cur] : undefined;
  let title: string;
  let sub: string | undefined;
  if (verses) {
    title = outline.title[L];
    sub = item ? tl.verseOf(label(item, L), items.length) : undefined;
  } else {
    title = item ? label(item, L) : outline.title[L];
    sub = role ? tl.roles[role] : item ? subLabel(item, L) ?? outline.title[L] : undefined;
  }
  const counter = !verses && item ? `${digits(cur + 1, L)}/${digits(items.length, L)}` : null;
  const rtl = L === 'ar';
  const align: TextStyle = rtl ? { textAlign: 'right', writingDirection: 'rtl' } : { textAlign: 'left' };
  const roleColor = role === 'priest' ? colors.crimson : role === 'deacon' ? colors.gold : colors.label;

  return (
    // On the open book the pill sits over one page, never across the fold.
    <Animated.View entering={reduce ? undefined : FadeIn.duration(200)} exiting={reduce ? undefined : FadeOut.duration(140)}
      style={spread ? [styles.pillPage, { alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start', maxWidth: width / 2 - 76 }] : styles.pillWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.outlineOpen}. ${title}${sub ? `, ${sub}` : ''}`}
        aria-expanded={open}
        onPress={() => { tick(); store.set({ sheet: store.get().sheet === 'top' ? false : 'top' }); }}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Glass style={styles.pill} interactive>
          <View style={[styles.pillRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Icon name={open ? 'chevU' : 'list'} size={16} color={colors.crimson} strokeWidth={2.2} />
            <View style={styles.pillText}>
              <Text numberOfLines={1} style={[rtl ? styles.pillTitleAr : styles.pillTitle, align, { color: colors.label }]}>{title}</Text>
              {sub ? (
                <View style={[styles.subRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
                  {role && <View style={[styles.roleDot, { backgroundColor: role === 'people' ? colors.crimson : roleColor }]} />}
                  <Text numberOfLines={1} style={[rtl ? styles.pillSubAr : styles.pillSub, align, { color: role ? roleColor : colors.label2 }]}>{sub}</Text>
                </View>
              ) : null}
            </View>
            {counter && <Text style={[styles.counter, { color: colors.label2 }]}>{counter}</Text>}
          </View>
          <View style={[styles.track, { backgroundColor: colors.sep }]}>
            <Animated.View style={[styles.fillBar, { backgroundColor: colors.crimson }, rtl ? styles.fromRight : null, bar]} />
          </View>
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

// ---------- The dock ----------

/** Previous, the section number, next: on the side, within reach of the thumb. */
function Dock({ outline, store, frame, lang: L, wheel, onJump, onWheel }: {
  outline: Outline; store: WayStore; frame: DockFrame; lang: Lang;
  /** Position of the wheel, in rows; shared with the wheel so it turns with the finger */
  wheel: SharedValue<number>;
  onJump: (row: number, fade: boolean) => void; onWheel: (center: number | null) => void;
}) {
  const { t, colors, set } = useSettings();
  const reduce = useReducedMotion();
  const items = outline.items;
  const verses = outline.kind === 'verses';
  const cur = useWay(store, (s) => s.current);
  const listOpen = useWay(store, (s) => s.sheet === 'side');
  const x = useSharedValue(frame.x);
  const y = useSharedValue(frame.top);
  const lift = useSharedValue(0);
  const gesture = useRef<{ mode: 'tap' | 'wheel' | 'move'; from: number; at: number; x: number; y: number; dx: number; dy: number; vy: number; end: boolean } | null>(null);
  // While the wheel turns, the dock shows the crown instead of its arrows.
  const [crown, setCrown] = useState(false);
  const droppedAt = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Follow the saved place, except just after a drop, while the dock springs there itself.
  useEffect(() => {
    if (gesture.current || Date.now() - droppedAt.current < 700) return;
    x.set(frame.x);
    y.set(frame.top);
  }, [frame.x, frame.top, x, y]);

  const landmark = (from: number, dir: 1 | -1) => {
    for (let k = from + dir; k >= 0 && k < items.length; k += dir) if (items[k].level === 1) return k;
    return -1;
  };
  const prevTarget = () => {
    if (cur < 0) return -1;
    if (verses) return landmark(cur, -1) >= 0 ? landmark(cur, -1) : cur > 0 ? 0 : -1;
    // Inside a section, go back to its start first, like "previous" on a music player.
    return store.get().first > items[cur].index ? cur : cur - 1;
  };
  const nextTarget = () => (verses ? landmark(cur, 1) : cur < items.length - 1 ? cur + 1 : -1);
  const go = (k: number) => {
    if (k < 0) return;
    tick();
    store.set({ sheet: false });
    onJump(items[k].index, true);
  };

  /** The wheel lands on a row: click, and bring that section to the top. */
  const land = (k: number) => {
    const g = gesture.current;
    if (g) g.at = k;
    tick();
    onWheel(k);
    onJump(items[k].index, false);
  };
  const openWheel = () => {
    const g = gesture.current;
    if (!g || g.mode !== 'tap') return;
    clearTimeout(hideTimer.current);
    g.mode = 'wheel';
    g.from = g.at = Math.max(0, store.get().current);
    store.set({ sheet: false });
    wheel.set(g.from);
    tick();
    setCrown(true);
    onWheel(g.from);
  };

  const pan = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    onBegin: () => {
      const c = store.get().current;
      gesture.current = { mode: 'tap', from: c, at: c, x: x.get(), y: y.get(), dx: 0, dy: 0, vy: 0, end: false };
      lift.set(withTiming(1, { duration: 120 }));
      holdTimer.current = setTimeout(openWheel, HOLD_MS);
    },
    onUpdate: (e) => {
      const g = gesture.current;
      if (!g) return;
      g.dx = e.translationX;
      g.dy = e.translationY;
      g.vy = e.velocityY;
      if (g.mode === 'tap') {
        if (Math.abs(e.translationX) > 12 && Math.abs(e.translationX) > Math.abs(e.translationY)) {
          clearTimeout(holdTimer.current);
          g.mode = 'move';
          tick();
        } else if (Math.abs(e.translationY) > 8) {
          clearTimeout(holdTimer.current);
          openWheel();
        } else return;
      }
      if (g.mode === 'move') {
        x.set(g.x + e.translationX);
        y.set(g.y + e.translationY);
        return;
      }
      // The rows follow the finger, as on a picker wheel: drag up to bring later sections to the middle.
      const raw = g.from - e.translationY / ROW_H;
      const pos = clamp(raw, -0.45, items.length - 0.55);
      wheel.set(pos);
      // Past the first or last section the crown stops with a bump.
      const atEnd = raw < -0.25 || raw > items.length - 0.75;
      if (atEnd && !g.end) bump();
      g.end = atEnd;
      const k = clamp(Math.round(pos), 0, items.length - 1);
      if (k !== g.at) land(k);
    },
    onFinalize: () => {
      const g = gesture.current;
      clearTimeout(holdTimer.current);
      lift.set(withTiming(0, { duration: 160 }));
      if (!g) { gesture.current = null; return; }
      if (g.mode === 'tap') {
        gesture.current = null;
        tick();
        store.set({ sheet: store.get().sheet === 'side' ? false : 'side' });
      } else if (g.mode === 'wheel') {
        // A flick carries on a little; then the wheel settles on a row and folds away.
        const target = clamp(Math.round(wheel.get() - (g.vy / ROW_H) * 0.18), 0, items.length - 1);
        wheel.set(reduce ? target : withSpring(target, SPRING_SMOOTH));
        if (target !== g.at) land(target);
        gesture.current = null;
        hideTimer.current = setTimeout(() => { onWheel(null); setCrown(false); }, 650);
      } else {
        gesture.current = null;
        // Snap to the nearer edge, at the height the finger left it.
        const side = g.x + g.dx + DOCK_W / 2 < frame.width / 2 ? 'left' : 'right';
        const top = clamp(g.y + g.dy, frame.minTop, frame.maxTop);
        droppedAt.current = Date.now();
        x.set(withSpring(side === 'left' ? DOCK_INSET : frame.width - DOCK_INSET - DOCK_W, SPRING_SMOOTH));
        y.set(withSpring(top, SPRING_SMOOTH));
        set({ dock: { side, y: (top - frame.minTop) / Math.max(1, frame.maxTop - frame.minTop) } });
      }
    },
  });
  useEffect(() => () => { clearTimeout(holdTimer.current); clearTimeout(hideTimer.current); }, []);

  const place = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: 1 + lift.get() * 0.06 }],
  }));

  // Targets are worked out on press: "previous" depends on how far into the section the reader is.
  const prevOff = cur < 0;
  const nextOff = nextTarget() < 0;
  const item = cur >= 0 ? items[cur] : undefined;
  const big = item ? (verses ? label(item, L) : digits(cur + 1, L)) : null;
  const small = `/${digits(items.length, L)}`;
  const button = (dir: 'prev' | 'next', off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === 'prev' ? (verses ? t.prevVerses : t.prevSection) : (verses ? t.nextVerses : t.nextSection)}
      accessibilityState={{ disabled: off }}
      disabled={off}
      hitSlop={{ left: 8, right: 8 }}
      onPress={() => go(dir === 'prev' ? prevTarget() : nextTarget())}
      style={({ pressed }) => [styles.dockBtn, pressed && { backgroundColor: colors.lens }]}
    >
      <Icon name={dir === 'prev' ? 'chevU' : 'chevD'} size={20} strokeWidth={2.2} color={off ? colors.label3 : colors.label} />
    </Pressable>
  );

  return (
    <Animated.View entering={reduce ? undefined : FadeIn.duration(220)} exiting={reduce ? undefined : FadeOut.duration(140)} style={[styles.dock, place]}>
      <Glass style={styles.dockGlass} interactive>
        {button('prev', prevOff)}
        <GestureDetector gesture={pan}>
          <View
            style={[styles.dockMid, listOpen && { backgroundColor: colors.lens }]}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t.allSections}
            accessibilityValue={{ text: item ? label(item, L) : outline.title[L] }}
            accessibilityActions={[{ name: 'activate' }, { name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => {
              const a = e.nativeEvent.actionName;
              if (a === 'activate') store.set({ sheet: store.get().sheet === 'side' ? false : 'side' });
              else go(a === 'increment' ? nextTarget() : prevTarget());
            }}
          >
            {big ? (
              <>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.dockBig, L === 'ar' && styles.dockBigAr, { color: colors.crimson }]}>{big}</Text>
                <Text numberOfLines={1} style={[styles.dockSmall, { color: colors.label2 }]}>{small}</Text>
              </>
            ) : <Icon name="list" size={18} color={colors.crimson} strokeWidth={2} />}
          </View>
        </GestureDetector>
        {button('next', nextOff)}
        {crown && <Crown wheel={wheel} side={frame.side} />}
      </Glass>
    </Animated.View>
  );
}

// ---------- The crown ----------

/** One ridge of the knurling: it rolls round the cylinder, bunching and dimming towards the edges. */
function Ridge({ i, wheel, groove, shine }: { i: number; wheel: SharedValue<number>; groove: string; shine: string }) {
  const roll = useAnimatedStyle(() => {
    // The surface moves with the finger: a row of the wheel is ROW_H of travel.
    const turn = (wheel.get() * ROW_H) / CROWN_R;
    const raw = i * RIDGE_ANGLE - turn + Math.PI / 2;
    const a = ((raw % Math.PI) + Math.PI) % Math.PI - Math.PI / 2;
    return { opacity: Math.cos(a), transform: [{ translateY: CROWN_R * Math.sin(a) }, { scaleY: 0.4 + 0.6 * Math.cos(a) }] };
  });
  return <Animated.View style={[styles.ridge, { backgroundColor: groove, borderBottomColor: shine }, roll]} />;
}

/**
 * The dock as an Apple Watch Digital Crown, seen from the side: brushed metal
 * shaded like a cylinder, knurled ridges that turn with the thumb, and a
 * crimson ring on the face towards the screen.
 */
function Crown({ wheel, side }: { wheel: SharedValue<number>; side: DockPlace['side'] }) {
  const { colors, dark } = useSettings();
  const reduce = useReducedMotion();
  const metal: [string, string, ...string[]] = dark
    ? ['#0c0a0b', '#3a3336', '#6d6468', '#3a3336', '#0c0a0b']
    : ['#77707a', '#c6bfc3', '#f7f4f5', '#c6bfc3', '#77707a'];
  const ridges: number[] = [];
  for (let i = 0; i < RIDGES; i++) ridges.push(i);
  return (
    <Animated.View pointerEvents="none" entering={reduce ? undefined : FadeIn.duration(120)} exiting={reduce ? undefined : FadeOut.duration(200)} style={styles.crown}>
      <LinearGradient colors={metal} locations={[0, 0.22, 0.5, 0.78, 1]} style={StyleSheet.absoluteFill} />
      {ridges.map((i) => (
        <Ridge key={i} i={i} wheel={wheel} groove={dark ? 'rgba(0,0,0,0.55)' : 'rgba(40,30,35,0.35)'} shine={dark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.85)'} />
      ))}
      <View style={[styles.crownRing, side === 'right' ? { left: 0 } : { right: 0 }, { backgroundColor: colors.crimson }]} />
      {/* Shade the top and bottom, where the cylinder turns away. */}
      <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']} locations={[0, 0.3, 0.7, 1]} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

// ---------- The wheel ----------

/** One row on the drum: it rises, tilts away and fades as it turns from the middle. */
function WheelRow({ i, wheel, text, on, color, onColor }: { i: number; wheel: SharedValue<number>; text: string; on: boolean; color: string; onColor: string }) {
  const turn = useAnimatedStyle(() => {
    const a = (i - wheel.get()) * ROW_ANGLE;
    const seen = Math.abs(a) < Math.PI / 2;
    return {
      opacity: seen ? Math.pow(Math.cos(a), 1.6) : 0,
      transform: [{ perspective: 700 }, { translateY: RADIUS * Math.sin(seen ? a : Math.sign(a) * Math.PI / 2) }, { rotateX: `${-a}rad` }],
    };
  });
  return (
    <Animated.View style={[styles.wheelRow, turn]}>
      <Text numberOfLines={1} style={[on ? styles.wheelOn : styles.wheelText, { color: on ? onColor : color }]}>{text}</Text>
    </Animated.View>
  );
}

/** The scroll wheel beside the dock while the number is held: like the iOS picker, with the current section in the band. */
function Wheel({ outline, center, wheel, frame, lang: L }: { outline: Outline; center: number; wheel: SharedValue<number>; frame: DockFrame; lang: Lang }) {
  const { colors, dark } = useSettings();
  const reduce = useReducedMotion();
  const items = outline.items;
  const verses = outline.kind === 'verses';
  const tl = STRINGS[L];
  const bg = dark ? '#242022' : '#FFFFFF';
  const width = Math.min(270, frame.width - DOCK_INSET - DOCK_W - 24);
  const top = clamp(frame.top + DOCK_H / 2 - WHEEL_H / 2, frame.minTop, frame.floor - WHEEL_H);
  const beside = frame.side === 'left' ? { left: DOCK_INSET + DOCK_W + 10 } : { right: DOCK_INSET + DOCK_W + 10 };
  const rows: number[] = [];
  for (let i = Math.max(0, center - 6); i <= Math.min(items.length - 1, center + 6); i++) rows.push(i);
  return (
    <Animated.View pointerEvents="none" entering={reduce ? undefined : FadeIn.duration(140)} exiting={reduce ? undefined : FadeOut.duration(240)}
      style={[styles.wheel, beside, { top, width, height: WHEEL_H, backgroundColor: bg, borderColor: colors.sep, boxShadow: `0 16px 36px -14px ${colors.shadow}` }]}>
      <View style={[styles.wheelBand, { backgroundColor: colors.lens }]} />
      {rows.map((i) => (
        <WheelRow key={i} i={i} wheel={wheel} on={i === center} color={colors.label} onColor={colors.crimson}
          text={verses ? `${tl.verse} ${label(items[i], L)}` : label(items[i], L)} />
      ))}
      {/* The drum curves away at the top and bottom. */}
      <LinearGradient pointerEvents="none" colors={[bg, `${bg}00`]} style={[styles.wheelShade, { top: 0 }]} />
      <LinearGradient pointerEvents="none" colors={[`${bg}00`, bg]} style={[styles.wheelShade, { bottom: 0 }]} />
    </Animated.View>
  );
}

// ---------- The wayfinder ----------

interface Props {
  outline: Outline;
  store: WayStore;
  /** Bring a row to the top; `fade` for a jump the reader asked for, not for scrubbing */
  onJump: (row: number, fade: boolean) => void;
}

export function Wayfinder({ outline, store, onJump }: Props) {
  const { t, hintOnce } = useSettings();
  const reduce = useReducedMotion();
  const toast = useToast();
  const frame = useDockFrame();
  const cur = useWay(store, (s) => s.current);
  const reading = useWay(store, (s) => s.reading);
  const sheet = useWay(store, (s) => s.sheet);
  const [wheelAt, setWheelAt] = useState<number | null>(null);
  const wheel = useSharedValue(0);
  // The list stays mounted, where it opened from, while it folds away.
  const [panelFrom, setPanelFrom] = useState<'top' | 'side' | null>(null);
  if (sheet && sheet !== panelFrom) setPanelFrom(sheet);
  const closePanel = useCallback(() => store.set({ sheet: false }), [store]);
  const hidePanel = useCallback(() => setPanelFrom(null), []);
  // Leaving the screen (another tab, back) folds the list away.
  useFocusEffect(useCallback(() => () => store.set({ sheet: false }), [store]));
  const mountedAt = useRef(0);

  const L = useTextLang();
  const items = outline.items;
  const showDock = reading && items.length > 1 && sheet !== 'top';

  useEffect(() => { mountedAt.current = Date.now(); }, []);

  // The first time the dock shows, say what it does (after the tap-to-translate hint).
  useEffect(() => {
    if (showDock && Date.now() - mountedAt.current > 4000 && hintOnce('dock')) toast(t.dockHint, 6000);
  }, [showDock, hintOnce, toast, t]);


  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {panelFrom && (
        <OutlinePanel outline={outline} current={cur} lang={L} from={panelFrom} frame={frame} visible={!!sheet}
          onClose={closePanel} onHidden={hidePanel} onPick={(i) => onJump(items[i].index, !reduce)} />
      )}

      {showDock && <Dock outline={outline} store={store} frame={frame} lang={L} wheel={wheel} onJump={onJump} onWheel={setWheelAt} />}

      {showDock && wheelAt !== null && <Wheel outline={outline} center={wheelAt} wheel={wheel} frame={frame} lang={L} />}
    </View>
  );
}

// ---------- Contents ----------

/**
 * The list of sections opens where the reader tapped: it folds down from the
 * pill, or slides out beside the dock at the thumb's height. No heading: the
 * pill already says where you are. Tap the pill or the dock again, or
 * anywhere outside, to fold it away; Android's back button does the same.
 */
function OutlinePanel({ outline, current, lang: L, from, frame, visible, onClose, onHidden, onPick }: {
  outline: Outline; current: number; lang: Lang; from: 'top' | 'side'; frame: DockFrame; visible: boolean;
  onClose: () => void; onHidden: () => void; onPick: (i: number) => void;
}) {
  const { t, colors, dark } = useSettings();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const open = useSharedValue(0);
  const list = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const rtl = L === 'ar';
  const verses = outline.kind === 'verses';
  const side = from === 'side';
  const top = insets.top + BAR_HEIGHT;
  const maxHeight = side
    ? Math.max(200, Math.min(height * 0.6, frame.floor - frame.minTop))
    : Math.max(200, Math.min(height * 0.62, height - top - insets.bottom - 100));
  // Beside the dock, centred on it as far as the screen allows.
  const sideTop = clamp(frame.top + DOCK_H / 2 - maxHeight / 2, frame.minTop, frame.floor - maxHeight);
  const toRight = frame.side === 'right';

  // Unfold on open; on close, fold away first and unmount after.
  useEffect(() => {
    if (visible) {
      open.set(reduce ? 1 : withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }));
      return;
    }
    open.set(reduce ? 0 : withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) }));
    const id = setTimeout(onHidden, reduce ? 0 : 170);
    return () => clearTimeout(id);
  }, [visible, open, reduce, onHidden]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);

  const backdrop = useAnimatedStyle(() => ({ opacity: open.get() }));
  // Grows out of what was tapped: down from the pill, or sideways out of the dock.
  const panel = useAnimatedStyle(() => ({
    opacity: open.get(),
    transform: side
      ? [{ translateX: (1 - open.get()) * (toRight ? 18 : -18) }, { scale: 0.94 + 0.06 * open.get() }]
      : [{ translateY: (1 - open.get()) * -14 }, { scale: 0.94 + 0.06 * open.get() }],
  }));
  const align: TextStyle = rtl ? { textAlign: 'right', writingDirection: 'rtl' } : { textAlign: 'left' };
  const pick = (i: number) => { onPick(i); onClose(); };

  return (
    <View pointerEvents={visible ? 'box-none' : 'none'} style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.4)' : 'rgba(20,10,15,0.16)' }, backdrop]}>
        <Pressable style={styles.fill} accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} />
      </Animated.View>
      <View pointerEvents="box-none" style={side
        ? [styles.sideWrap, { top: sideTop, height: maxHeight, width: Math.min(340, frame.width - DOCK_INSET - DOCK_W - 22) }, toRight ? { right: DOCK_INSET + DOCK_W + 10 } : { left: DOCK_INSET + DOCK_W + 10 }]
        : [styles.panelWrap, { top }]}>
        <Animated.View style={[styles.panelOuter, side && { transformOrigin: toRight ? 'right' : 'left' }, panel]}>
          <Glass style={styles.panel} solid>
            <ScrollView ref={list} style={{ maxHeight }} contentContainerStyle={[styles.listPad, verses && [styles.grid, rtl && styles.gridRtl]]}>
              {outline.items.map((it, i) => {
                const on = i === current;
                const onLayout = on ? (e: { nativeEvent: { layout: { y: number } } }) => list.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - maxHeight / 3), animated: false }) : undefined;
                if (verses) {
                  return (
                    <Pressable key={i} onLayout={onLayout} accessibilityRole="button" accessibilityState={{ selected: on }}
                      accessibilityLabel={`${STRINGS[L].verse} ${label(it, L)}`} onPress={() => pick(i)}
                      style={({ pressed }) => [styles.cell, { backgroundColor: on ? colors.crimson : pressed ? colors.bg2 : colors.tint }]}>
                      <Text style={[styles.cellText, { color: on ? '#fff' : colors.label }, rtl && styles.cellTextAr]}>{label(it, L)}</Text>
                    </Pressable>
                  );
                }
                const sub = subLabel(it, L);
                return (
                  <Pressable key={i} onLayout={onLayout} accessibilityRole="button" accessibilityState={{ selected: on }}
                    accessibilityLabel={`${label(it, L)}${on ? `, ${t.hereNow}` : ''}`} onPress={() => pick(i)}
                    style={({ pressed }) => [styles.item, { flexDirection: rtl ? 'row-reverse' : 'row' }, pressed && { backgroundColor: colors.bg2 }, on && { backgroundColor: colors.tint }]}>
                    <View style={[styles.itemBar, { backgroundColor: on ? colors.crimson : 'transparent' }]} />
                    <View style={[styles.fill, it.level === 2 && (rtl ? styles.indentRtl : styles.indent)]}>
                      <Text numberOfLines={2} style={[it.level === 1 ? (rtl ? styles.itemTitleAr : styles.itemTitle) : (rtl ? styles.itemSmallAr : styles.itemSmall), align, { color: on ? colors.crimson : colors.label }]}>{label(it, L)}</Text>
                      {sub && it.level === 1 ? <Text numberOfLines={1} style={[styles.itemSub, align, { color: colors.label2 }]}>{sub}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Glass>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  right: { textAlign: 'right' },
  pressed: { transform: [{ scale: 0.97 }] },
  pillWrap: { width: '100%', maxWidth: 420, alignSelf: 'center' },
  pillPage: { width: '100%' },
  pill: { borderRadius: 22, height: 44 },
  pillRow: { flex: 1, alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingBottom: 2 },
  pillText: { flexShrink: 1, flexGrow: 1 },
  pillTitle: { fontFamily: FONTS.svSemi, fontSize: 13.5, lineHeight: 17 },
  pillTitleAr: { fontFamily: FONTS.arBold, fontSize: 14, lineHeight: 19 },
  subRow: { alignItems: 'center', gap: 5 },
  pillSub: { fontSize: 11.5, fontWeight: '600', lineHeight: 14 },
  pillSubAr: { fontFamily: FONTS.ar, fontSize: 12, lineHeight: 16 },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  counter: { fontSize: 11.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { position: 'absolute', left: 18, right: 18, bottom: 3, height: 2, borderRadius: 1, overflow: 'hidden' },
  fillBar: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 1, transformOrigin: 'left' },
  fromRight: { transformOrigin: 'right' },
  dock: { position: 'absolute', left: 0, top: 0, width: DOCK_W, height: DOCK_H, zIndex: 15 },
  dockGlass: { flex: 1, borderRadius: DOCK_W / 2, overflow: 'hidden' },
  dockBtn: { height: BTN_H, alignItems: 'center', justifyContent: 'center' },
  dockMid: { height: MID_H, alignItems: 'center', justifyContent: 'center', marginHorizontal: 3, borderRadius: 14 },
  dockBig: { fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'], lineHeight: 20 },
  dockBigAr: { fontFamily: FONTS.arBold, fontWeight: undefined, fontSize: 18, lineHeight: 24 },
  dockSmall: { fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  crown: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, overflow: 'hidden' },
  ridge: { position: 'absolute', left: 4, right: 4, top: CROWN_R - 1.5, height: 3, borderBottomWidth: 1 },
  crownRing: { position: 'absolute', top: 0, bottom: 0, width: 3, opacity: 0.9 },
  wheel: { position: 'absolute', borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, zIndex: 16 },
  wheelBand: { position: 'absolute', left: 6, right: 6, top: WHEEL_H / 2 - ROW_H / 2, height: ROW_H, borderRadius: 10 },
  wheelRow: { position: 'absolute', left: 12, right: 12, top: WHEEL_H / 2 - ROW_H / 2, height: ROW_H, justifyContent: 'center' },
  wheelText: { fontSize: 15, textAlign: 'center' },
  wheelOn: { fontSize: 15.5, fontWeight: '700', textAlign: 'center' },
  wheelShade: { position: 'absolute', left: 0, right: 0, height: ROW_H * 2 },
  panelWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  panelOuter: { width: '100%', maxWidth: 520, transformOrigin: 'top' },
  sideWrap: { position: 'absolute', justifyContent: 'center' },
  panel: { borderRadius: 24, overflow: 'hidden' },
  listPad: { padding: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14, justifyContent: 'flex-start' },
  gridRtl: { flexDirection: 'row-reverse' },
  cell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  cellTextAr: { fontFamily: FONTS.arBold, fontSize: 17 },
  item: { alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 10 },
  itemBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  indent: { paddingLeft: 16 },
  indentRtl: { paddingRight: 16 },
  itemTitle: { fontFamily: FONTS.svSemi, fontSize: 16 },
  itemTitleAr: { fontFamily: FONTS.arBold, fontSize: 17, lineHeight: 26 },
  itemSmall: { fontFamily: FONTS.sv, fontSize: 15 },
  itemSmallAr: { fontFamily: FONTS.ar, fontSize: 16, lineHeight: 24 },
  itemSub: { fontSize: 13, marginTop: 2 },
});
