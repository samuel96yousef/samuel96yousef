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
 * - Tapping the pill folds the contents down from it, with the current
 *   section marked.
 */
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { STRINGS } from '../i18n';
import { toArDigits } from '../lib/coptic';
import type { Lang } from '../lib/types';
import { roleAt, rowWeights, type Outline, type OutlineItem } from '../rows';
import { useSettings } from '../settings';
import { FONTS } from '../theme';
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
  const open = useWay(store, (s) => s.sheet);
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
        aria-expanded={open}
        onPress={() => { haptic(); store.set({ sheet: !store.get().sheet }); }}
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
  // The panel stays mounted while it folds away.
  const [panel, setPanel] = useState(false);
  if (sheetOpen && !panel) setPanel(true);
  const closePanel = useCallback(() => store.set({ sheet: false }), [store]);
  const hidePanel = useCallback(() => setPanel(false), []);
  // Leaving the screen (another tab, back) folds the contents away.
  useFocusEffect(useCallback(() => () => store.set({ sheet: false }), [store]));
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
      {showRail && !sheetOpen && (
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

      {panel && (
        <OutlinePanel outline={outline} current={cur} lang={L} visible={sheetOpen} onClose={closePanel} onHidden={hidePanel}
          onPick={(i) => onJump(items[i].index, !reduce)} />
      )}
    </View>
  );
}

// ---------- Contents ----------

/**
 * The contents fold down from the pill, where the reader tapped, instead of
 * rising from the bottom of the screen. No heading: the pill above already
 * says where you are. Tap the pill again, or anywhere outside, to fold them
 * away; Android's back button does the same.
 */
function OutlinePanel({ outline, current, lang: L, visible, onClose, onHidden, onPick }: {
  outline: Outline; current: number; lang: Lang; visible: boolean;
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
  const top = insets.top + BAR_HEIGHT;
  const maxHeight = Math.max(200, Math.min(height * 0.62, height - top - insets.bottom - 100));

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
  // Grows out of the pill: from just under it, slightly smaller, to full size.
  const panel = useAnimatedStyle(() => ({
    opacity: open.get(),
    transform: [{ translateY: (1 - open.get()) * -14 }, { scale: 0.94 + 0.06 * open.get() }],
  }));
  const align: TextStyle = rtl ? { textAlign: 'right', writingDirection: 'rtl' } : { textAlign: 'left' };
  const pick = (i: number) => { onPick(i); onClose(); };

  return (
    <View pointerEvents={visible ? 'box-none' : 'none'} style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? 'rgba(0,0,0,0.4)' : 'rgba(20,10,15,0.16)' }, backdrop]}>
        <Pressable style={styles.fill} accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} />
      </Animated.View>
      <View pointerEvents="box-none" style={[styles.panelWrap, { top }]}>
        <Animated.View style={[styles.panelOuter, panel]}>
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
  panelWrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  panelOuter: { width: '100%', maxWidth: 520, transformOrigin: 'top' },
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
