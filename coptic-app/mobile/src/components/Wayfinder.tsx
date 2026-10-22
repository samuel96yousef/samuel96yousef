/**
 * Wayfinding in long texts, after iOS and long ChatGPT threads.
 *
 * - The context pill takes the middle of the top bar once the title has
 *   scrolled away, like an iOS 26 inline title. It names the section you
 *   are in, who is speaking in a liturgy, and how far you have read. Tap it
 *   for the contents.
 * - The rail in the margin outside the page frame marks every section,
 *   spaced like the text, with the current one in crimson. It shows while
 *   you scroll; drag along it to jump, with a label beside your finger and a
 *   tick of haptics per section.
 * - The contents sheet lists every section and marks where you are.
 */
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STRINGS } from '../i18n';
import { toArDigits } from '../lib/coptic';
import type { Lang } from '../lib/types';
import { roleAt, rowWeights, type Outline, type OutlineItem } from '../rows';
import { useSettings } from '../settings';
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
  /** The rail shows while the text moves */
  awake: boolean;
  /** The contents sheet is open */
  sheet: boolean;
  /** The large title has scrolled under the top bar */
  reading: boolean;
}

export function createWayStore() {
  let state: WayState = { first: 0, current: -1, awake: false, sheet: false, reading: false };
  let active = 0;
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
    /** The text moved: wake the rail. */
    poke: () => { active = Date.now(); if (!state.awake) set({ awake: true }); },
    idleFor: () => Date.now() - active,
  };
}
export type WayStore = ReturnType<typeof createWayStore>;

/** One value from the store; the component re-renders only when that value changes, not on every scroll. */
export function useWay<T extends string | number | boolean | undefined>(store: WayStore, select: (s: WayState) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()), () => select(store.get()));
}

// ---------- Layout ----------

/** The rail runs between the top bar and the tab bar. */
const RAIL_TOP = BAR_HEIGHT + 10;
const RAIL_BOTTOM = 86;
const RAIL_PAD = 12;
/** The page frame starts 23 pt from the screen edge; ticks stay inside that margin. */
const TICK_EDGE = 4;
/** Ticks are drawn for every section up to this many; above it, and for verses, only landmarks. */
const MAX_TICKS = 60;

const haptic = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };
const digits = (n: number | string, l: Lang) => (l === 'ar' ? toArDigits(n) : String(n));

/** Spread marks over the track like the text, but never closer than `gap`. */
function placeTicks(fractions: number[], h: number, gap: number) {
  const n = fractions.length;
  if (!n || h <= 0) return [];
  if (n * gap > h) return fractions.map((_, i) => (n === 1 ? 0 : (i * h) / (n - 1)));
  const y = fractions.map((f) => f * h);
  for (let i = 1; i < n; i++) y[i] = Math.max(y[i], y[i - 1] + gap);
  y[n - 1] = Math.min(y[n - 1], h);
  for (let i = n - 2; i >= 0; i--) y[i] = Math.min(y[i], y[i + 1] - gap);
  return y.map((v) => Math.max(0, v));
}

function nearest(ys: number[], y: number) {
  let best = 0;
  for (let i = 1; i < ys.length; i++) if (Math.abs(ys[i] - y) < Math.abs(ys[best] - y)) best = i;
  return best;
}

const label = (it: OutlineItem, l: Lang) => (l === 'ar' ? it.ar : it.sv);
const subLabel = (it: OutlineItem, l: Lang) => (l === 'ar' ? it.subAr : it.subSv);

/** Pill and bubble speak the language being read; on the open book, the app's language. */
function useTextLang(): Lang {
  const { lang, primary, spread } = useSettings();
  return spread ? lang : primary;
}

// ---------- Context pill ----------

/** The middle of the top bar while reading: where you are, who speaks, how far you have come. */
export function ContextPill({ outline, rows, store, progress }: {
  outline: Outline; rows: Row[]; store: WayStore; progress: SharedValue<number>;
}) {
  const { t, colors } = useSettings();
  const reduce = useReducedMotion();
  const L = useTextLang();
  const tl = STRINGS[L];
  const items = outline.items;
  const verses = outline.kind === 'verses';
  const hasRoles = useMemo(() => rows.some((r) => r.k === 'role'), [rows]);
  const cur = useWay(store, (s) => s.current);
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
    <Animated.View entering={reduce ? undefined : FadeIn.duration(200)} exiting={reduce ? undefined : FadeOut.duration(140)} style={styles.pillWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t.outlineOpen}. ${title}${sub ? `, ${sub}` : ''}`}
        onPress={() => { haptic(); store.set({ sheet: true }); }}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Glass style={styles.pill} interactive>
          <View style={[styles.pillRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            <Icon name="list" size={16} color={colors.crimson} strokeWidth={2} />
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

// ---------- The wayfinder ----------

interface Props {
  outline: Outline;
  rows: Row[];
  store: WayStore;
  /** Bring a row to the top; `fade` for a jump the reader asked for, not for scrubbing */
  onJump: (row: number, fade: boolean) => void;
}

export function Wayfinder({ outline, rows, store, onJump }: Props) {
  const { t, lang, primary, show, colors, hintOnce } = useSettings();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const toast = useToast();
  const cur = useWay(store, (s) => s.current);
  const wayAwake = useWay(store, (s) => s.awake);
  const sheetOpen = useWay(store, (s) => s.sheet);
  const [drag, setDrag] = useState<number | null>(null);
  const [railH, setRailH] = useState(0);
  const dragRef = useRef<number | null>(null);
  const mountedAt = useRef(0);
  const vis = useSharedValue(0);

  const L = useTextLang();
  const tl = STRINGS[L];
  const items = outline.items;
  const verses = outline.kind === 'verses';
  const edge = (v: number) => (lang === 'ar' ? { left: v } : { right: v });

  const ys = useMemo(() => {
    const cum = rowWeights(rows, primary, show === 'both');
    const total = cum[cum.length - 1] || 1;
    return placeTicks(items.map((it) => cum[it.index] / total), railH - RAIL_PAD * 2, verses ? 0 : 6);
  }, [rows, primary, show, items, railH, verses]);

  const showRail = items.length > 1;
  const awake = wayAwake || drag !== null;

  useEffect(() => { mountedAt.current = Date.now(); }, []);

  // Fade the rail out a moment after the text stops.
  useEffect(() => {
    vis.set(withTiming(awake ? 1 : 0, { duration: awake ? 140 : 420 }));
    if (!wayAwake || drag !== null) return;
    const id = setInterval(() => { if (store.idleFor() > 1500) store.set({ awake: false }); }, 300);
    return () => clearInterval(id);
  }, [awake, wayAwake, drag, store, vis]);

  // The first time the rail shows, say what it does (after the tap-to-translate hint).
  useEffect(() => {
    if (wayAwake && showRail && Date.now() - mountedAt.current > 4000 && hintOnce('rail')) toast(t.railHint, 5200);
  }, [wayAwake, showRail, hintOnce, toast, t]);

  const choose = (y: number) => {
    if (!ys.length) return;
    const i = nearest(ys, y - RAIL_PAD);
    if (i === dragRef.current) return;
    dragRef.current = i;
    setDrag(i);
    haptic();
    onJump(items[i].index, false);
  };
  const pan = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    onBegin: (e) => choose(e.y),
    onUpdate: (e) => choose(e.y),
    onFinalize: () => { dragRef.current = null; setDrag(null); store.poke(); },
  });

  const railStyle = useAnimatedStyle(() => ({ opacity: vis.get() }));

  const item = cur >= 0 ? items[cur] : undefined;
  const rtl = L === 'ar';
  const align: TextStyle = rtl ? { textAlign: 'right', writingDirection: 'rtl' } : { textAlign: 'left' };
  const bubble = drag !== null ? items[drag] : undefined;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {showRail && (
        <Animated.View
          pointerEvents={awake ? 'auto' : 'none'}
          onLayout={(e) => setRailH(e.nativeEvent.layout.height)}
          style={[styles.rail, { top: insets.top + RAIL_TOP, bottom: insets.bottom + RAIL_BOTTOM, ...edge(0) }, railStyle]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={t.railLabel}
          accessibilityValue={{ text: item ? label(item, L) : outline.title[L] }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const k = Math.min(items.length - 1, Math.max(0, cur + (e.nativeEvent.actionName === 'increment' ? 1 : -1)));
            onJump(items[k].index, false);
          }}
        >
          <GestureDetector gesture={pan}>
            <View style={styles.railHit}>
              {/* A backdrop only while dragging; at rest the ticks sit bare in the margin. */}
              {drag !== null && <Glass style={[styles.railGlass, edge(1)]} />}
              {ys.map((y, i) => {
                const it = items[i];
                const on = i === (drag ?? cur);
                if (!on && (verses || items.length > MAX_TICKS) && it.level !== 1) return null;
                const w = on ? 15 : it.level === 1 ? 10 : 6;
                return (
                  <View key={i} style={[styles.tick, {
                    top: RAIL_PAD + y - (on ? 1.5 : 1), width: w, height: on ? 3 : 2, ...edge(TICK_EDGE),
                    backgroundColor: on ? colors.crimson : it.level === 1 ? colors.label2 : colors.label3,
                  }]} />
                );
              })}
            </View>
          </GestureDetector>
        </Animated.View>
      )}

      {bubble && (
        <View pointerEvents="none" style={[styles.bubble, {
          top: insets.top + RAIL_TOP + RAIL_PAD + (ys[drag ?? 0] ?? 0) - 24, ...edge(34),
          backgroundColor: colors.surface, borderColor: colors.sep, boxShadow: `0 10px 26px -10px ${colors.shadow}`,
        }]}>
          <Text numberOfLines={1} style={[rtl ? styles.bubbleTitleAr : styles.bubbleTitle, align, { color: colors.label }]}>
            {verses ? `${tl.verse} ${label(bubble, L)}` : label(bubble, L)}
          </Text>
          {(verses ? outline.title[L] : subLabel(bubble, L)) ? (
            <Text numberOfLines={1} style={[styles.bubbleSub, align, { color: colors.label2 }]}>{verses ? outline.title[L] : subLabel(bubble, L)}</Text>
          ) : null}
        </View>
      )}

      {sheetOpen && (
        <OutlineSheet outline={outline} current={cur} lang={L} onClose={() => store.set({ sheet: false })}
          onPick={(i) => onJump(items[i].index, !reduce)} />
      )}
    </View>
  );
}

// ---------- Contents sheet ----------

function OutlineSheet({ outline, current, lang: L, onClose, onPick }: {
  outline: Outline; current: number; lang: Lang; onClose: () => void; onPick: (i: number) => void;
}) {
  const { t, colors, lang } = useSettings();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const y = useSharedValue(height);
  const list = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const closing = useRef(false);
  const rtl = L === 'ar';
  const verses = outline.kind === 'verses';

  useEffect(() => { y.set(reduce ? 0 : withSpring(0, SPRING_SMOOTH)); }, [y, reduce]);

  const close = (then?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    y.set(withTiming(height, { duration: reduce ? 0 : 220 }));
    setTimeout(() => { onClose(); then?.(); }, reduce ? 0 : 200);
  };
  const pick = (i: number) => close(() => onPick(i));

  const pan = usePanGesture({
    activeOffsetY: 6,
    runOnJS: true,
    onUpdate: (e) => y.set(Math.max(0, e.translationY)),
    onDeactivate: (e) => {
      if (e.translationY > 90 || e.velocityY > 800) close();
      else y.set(withSpring(0, SPRING_SMOOTH));
    },
  });

  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(y.get(), [0, height], [1, 0], 'clamp') }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const align: TextStyle = rtl ? { textAlign: 'right', writingDirection: 'rtl' } : { textAlign: 'left' };
  const count = current >= 0 ? (verses ? STRINGS[L].verseOf(label(outline.items[current], L), outline.items.length) : t.ofN(current + 1, outline.items.length)) : '';

  return (
    <Modal transparent visible animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]}>
          <Pressable style={styles.fill} accessibilityRole="button" accessibilityLabel={t.close} onPress={() => close()} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { maxHeight: height * 0.74, paddingBottom: insets.bottom + 12, backgroundColor: colors.surface }, sheetStyle]}>
          <GestureDetector gesture={pan}>
            <View style={styles.sheetHead}>
              <View style={[styles.grabber, { backgroundColor: colors.label3 }]} />
              <View style={[styles.headRow, { flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
                <View style={styles.fill}>
                  <Text accessibilityRole="header" style={[styles.sheetTitle, lang === 'ar' && styles.right, { color: colors.label }]}>{t.outline}</Text>
                  <Text numberOfLines={1} style={[styles.sheetSub, lang === 'ar' && styles.right, { color: colors.label2 }]}>{outline.title[L]}{count ? ` · ${count}` : ''}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={() => close()} style={[styles.closeBtn, { backgroundColor: colors.bg2 }]}>
                  <Icon name="x" size={18} color={colors.label} strokeWidth={2.2} />
                </Pressable>
              </View>
            </View>
          </GestureDetector>
          <ScrollView ref={list} contentContainerStyle={[styles.listPad, verses && [styles.grid, rtl && styles.gridRtl]]}>
            {outline.items.map((it, i) => {
              const on = i === current;
              const onLayout = on ? (e: { nativeEvent: { layout: { y: number } } }) => list.current?.scrollTo({ y: Math.max(0, e.nativeEvent.layout.y - 120), animated: false }) : undefined;
              if (verses) {
                return (
                  <Pressable key={i} onLayout={onLayout} accessibilityRole="button" accessibilityState={{ selected: on }}
                    accessibilityLabel={`${STRINGS[L].verse} ${label(it, L)}`} onPress={() => pick(i)}
                    style={({ pressed }) => [styles.cell, { backgroundColor: on ? colors.crimson : pressed ? colors.bg2 : colors.tint }]}>
                    <Text style={[styles.cellText, { color: on ? '#fff' : colors.label }, rtl && { fontFamily: FONTS.arBold, fontSize: 17 }]}>{label(it, L)}</Text>
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
                  {on && <Text style={[styles.here, { color: colors.crimson }]}>{t.hereNow}</Text>}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  right: { textAlign: 'right' },
  pressed: { transform: [{ scale: 0.97 }] },
  pillWrap: { width: '100%', maxWidth: 420, alignSelf: 'center' },
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
  rail: { position: 'absolute', width: 30, zIndex: 14 },
  railHit: { flex: 1 },
  railGlass: { position: 'absolute', top: 0, bottom: 0, width: 22, borderRadius: 11 },
  tick: { position: 'absolute', borderRadius: 2 },
  bubble: { position: 'absolute', maxWidth: 260, minWidth: 120, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, zIndex: 16 },
  bubbleTitle: { fontFamily: FONTS.svSemi, fontSize: 15 },
  bubbleTitleAr: { fontFamily: FONTS.arBold, fontSize: 16, lineHeight: 24 },
  bubbleSub: { fontSize: 12, marginTop: 1 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.32)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxWidth: 640, alignSelf: 'center', width: '100%' },
  sheetHead: { paddingTop: 8, paddingHorizontal: 20, paddingBottom: 10 },
  grabber: { alignSelf: 'center', width: 38, height: 5, borderRadius: 3, opacity: 0.5, marginBottom: 10 },
  headRow: { alignItems: 'center', gap: 12 },
  sheetTitle: { fontSize: 22, fontWeight: '700' },
  sheetSub: { fontSize: 13, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  listPad: { paddingHorizontal: 12, paddingBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18 },
  gridRtl: { flexDirection: 'row-reverse' },
  cell: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] },
  item: { alignItems: 'center', gap: 10, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 10 },
  itemBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  indent: { paddingLeft: 16 },
  indentRtl: { paddingRight: 16 },
  itemTitle: { fontFamily: FONTS.svSemi, fontSize: 16 },
  itemTitleAr: { fontFamily: FONTS.arBold, fontSize: 17, lineHeight: 26 },
  itemSmall: { fontFamily: FONTS.sv, fontSize: 15 },
  itemSmallAr: { fontFamily: FONTS.ar, fontSize: 16, lineHeight: 24 },
  itemSub: { fontSize: 13, marginTop: 2 },
  here: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
});
