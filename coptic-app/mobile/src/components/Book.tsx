/**
 * The open book on a wide screen: the text as facing pages, Swedish on the
 * left and Arabic on the right, turned like paper. Drag a page across, tap
 * near its outer edge, or use the arrow keys: the page folds over the spine,
 * and its back is the next left page. Arabic readers turn the other way, as
 * in an Arabic book.
 *
 * The pages are cut from the same rows as the scrolling reader. Each row is
 * measured once, off screen, in batches, so the first spread is ready long
 * before a long liturgy is fully measured.
 */
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, Keyframe, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { layoutBook, rowsIn, spreadOf, type BookLang, type Grid, type Window } from '../book';
import { toArDigits } from '../lib/coptic';
import type { Lang } from '../lib/types';
import { useSettings } from '../settings';
import type { PagePalette } from '../theme';
import { CopticCross } from './CopticCross';
import type { Row } from './Reader';
import { BAR_HEIGHT } from './TopBar';

/** Space above and below the text on a page. */
const EDGE = 30;
/**
 * Each page has its own double frame, as in the printed Katameros. It sits
 * further from the spine than from the outer edge, where the paper curves
 * away into the fold, and so does the text.
 */
const INSET = 11;
const GUTTER = 22;
const RULE_GAP = 4.5;
const TEXT_OUTER = 30;
const TEXT_INNER = 42;
/** Rows measured per batch. */
const CHUNK = 120;
/** Space kept under the text at the foot of each page. */
const FOOT = 10;
const TURN_MS = 560;
/** On the web, dragging a page turns it rather than selecting text. (Not in ViewStyle's types.) */
const NO_SELECT = { userSelect: 'none' } as unknown as ViewStyle;

/** When the device unfolds, the left page swings open from the spine. */
const PageOpen = new Keyframe({
  0: { transform: [{ perspective: 1400 }, { rotateY: '-95deg' }], opacity: 0.3 },
  40: { opacity: 1 },
  100: { transform: [{ perspective: 1400 }, { rotateY: '0deg' }], opacity: 1 },
}).duration(720);

/** Headings and titles stay on the same page as the text that follows them. */
const keepWithNext = (r: Row) =>
  r.k === 'title' || r.k === 'role' || r.k === 'run' || r.k === 'cart' || (r.k === 'u' && (r.u.t === 'H' || r.u.t === 'h' || r.u.t === 'ref'));

export interface BookProps {
  rows: Row[];
  /** One side of a row, as it is measured and drawn on a page */
  renderRow: (row: Row, lang: Lang) => ReactElement | null;
  /** Where the lines of one side of a row fall, if it may break between them */
  gridOf: (row: Row, lang: Lang) => Grid | null;
  /** Changes whenever rows change size (the text size) */
  sizeKey: string;
  header?: ReactElement | null;
  footer?: ReactElement | null;
  /** Row to open at, read once */
  start: () => number;
  /** Row to turn to; change `key` to go again */
  goTo: { index: number; key: number } | null;
  /** Just unfolded: swing the left page open */
  opening: boolean;
  onSpread: (at: { first: number; last: number; k: number; total: number | null }) => void;
}

interface Turn { a: number; b: number }

export function Book({ rows, renderRow, gridOf, sizeKey, header, footer, start, goTo, opening, onSpread }: BookProps) {
  const { t, lang, colors } = useSettings();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const dir = lang === 'ar' ? -1 : 1;
  const near: BookLang = dir === 1 ? 'sv' : 'ar';
  const far: BookLang = dir === 1 ? 'ar' : 'sv';
  const W = Math.floor((width - 24) / 2);
  const textW = W - TEXT_OUTER - TEXT_INNER;
  const bookTop = insets.top + BAR_HEIGHT + 4;
  const sheetH = Math.max(220, Math.floor(height - bookTop - insets.bottom - 86));
  const bodyH = sheetH - EDGE * 2;
  const [headerH, setHeaderH] = useState(0);
  const cover = header ? headerH : 0;

  // The page edges are drawn by every page, so their rows are left out.
  const index = useMemo(() => rows.flatMap((r, i) => (r.k === 'top' || r.k === 'bottom' ? [] : [i])), [rows]);
  const toBook = useCallback((row: number) => {
    const j = index.findIndex((i) => i >= row);
    return j < 0 ? index.length - 1 : j;
  }, [index]);

  // ---------- Measuring ----------
  const [ver, setVer] = useState({ rows, n: 0 });
  if (ver.rows !== rows) setVer({ rows, n: ver.n + 1 });
  const sizes = `${ver.n}|${textW}|${sizeKey}`;
  const [measured, setMeasured] = useState({ key: '', sv: [] as number[], ar: [] as number[], n: 0 });
  const m = useMemo(() => (measured.key === sizes ? measured : { key: sizes, sv: [] as number[], ar: [] as number[], n: 0 }), [measured, sizes]);
  const upto = Math.min(index.length, m.n + CHUNK);
  const complete = m.n >= index.length;
  const bag = useRef({ key: '', sv: [] as number[], ar: [] as number[], count: 0 });
  const record = useCallback((key: string, l: BookLang, i: number, h: number, until: number) => {
    let b = bag.current;
    if (b.key !== key) b = bag.current = { key, sv: [], ar: [], count: 0 };
    if (b[l][i] === undefined) b.count++;
    b[l][i] = h;
    if (b.count >= until * 2) {
      setMeasured((prev) => (prev.key === key && prev.n >= until ? prev : { key, sv: b.sv.slice(0, until), ar: b.ar.slice(0, until), n: until }));
    }
  }, []);

  const room = useCallback((k: number) => bodyH - FOOT - (k === 0 ? cover : 0), [bodyH, cover]);
  const layout = useMemo(() => layoutBook(
    m.sv.map((h, i) => {
      const row = rows[index[i]];
      return { sv: { h, grid: gridOf(row, 'sv') }, ar: { h: m.ar[i], grid: gridOf(row, 'ar') }, keep: keepWithNext(row) };
    }),
    room, complete,
  ), [m, rows, index, gridOf, room, complete]);
  const { tops, spreads } = layout;
  const last = spreads.length - 1;

  // ---------- Where the reader is ----------
  // The spread is kept with the row it starts with, so a new layout (another
  // text size, the device turned) opens on the same text.
  const layoutKey = `${sizes}|${bodyH}|${cover}`;
  const [pos, setPos] = useState(() => ({ k: -1, row: start(), key: '' }));
  let cur = pos.key === layoutKey && pos.k >= 0 && pos.k <= last ? pos.k : -1;
  if (cur < 0 && spreads.length) {
    const want = spreadOf(layout, toBook(pos.row));
    if (want >= 0 || complete) {
      cur = want >= 0 ? want : last;
      setPos({ k: cur, row: pos.row, key: layoutKey });
    }
  }
  const sp = cur >= 0 ? spreads[cur] : undefined;
  const firstRow = sp ? index[sp.first] : -1;
  const lastRow = sp ? index[sp.last] : -1;
  const total = complete ? spreads.length : null;
  useEffect(() => {
    if (cur >= 0) onSpread({ first: firstRow, last: lastRow, k: cur, total });
  }, [cur, firstRow, lastRow, total, onSpread]);

  // ---------- Turning ----------
  const [turn, setTurn] = useState<Turn | null>(null);
  const p = useSharedValue(0);
  const fade = useSharedValue(1);
  const live = useRef({ cur, last, spreads, index, turn: null as Turn | null, key: layoutKey });
  useEffect(() => { Object.assign(live.current, { cur, last, spreads, index, key: layoutKey }); });
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const land = useCallback((k: number) => {
    const L = live.current;
    const s = L.spreads[k];
    if (!s) return;
    setPos({ k, row: L.index[s.first], key: L.key });
  }, []);
  // The left page swings open only when the book first opens.
  const [swing, setSwing] = useState(opening);
  const begin = useCallback((tr: Turn, from: number) => {
    p.set(from);
    live.current.turn = tr;
    setTurn(tr);
    setSwing(false);
  }, [p]);
  const settle = useCallback((to: 0 | 1) => {
    const ms = Math.max(160, Math.abs(to - p.get()) * TURN_MS);
    p.set(withTiming(to, { duration: ms, easing: Easing.out(Easing.cubic) }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const tr = live.current.turn;
      if (!tr) return;
      const k = to === 1 ? tr.b : tr.a;
      if (k !== live.current.cur && Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      live.current.turn = null;
      land(k);
      setTurn(null);
    }, ms + 30);
  }, [p, land]);
  const go = useCallback((k: number) => {
    const L = live.current;
    if (L.turn || k === L.cur || k < 0 || k > L.last) return;
    if (reduce || Math.abs(k - L.cur) > 1) {
      // A long way, or no motion wanted: cut, with a short fade.
      fade.set(0.25);
      fade.set(withTiming(1, { duration: 260 }));
      land(k);
      return;
    }
    if (k > L.cur) { begin({ a: L.cur, b: k }, 0); settle(1); } else { begin({ a: k, b: L.cur }, 1); settle(0); }
  }, [reduce, fade, land, begin, settle]);

  // Turn to a row the reader asked for, once its spread is laid out.
  const handled = useRef<number | null>(null);
  useEffect(() => {
    if (!goTo || handled.current === goTo.key) return;
    const k = spreadOf(layout, toBook(goTo.index));
    if (k < 0) return;
    handled.current = goTo.key;
    go(k);
  }, [goTo, layout, toBook, go]);

  // Arrow keys and Page Up/Down on the web.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const step = e.key === 'PageDown' || e.key === ' ' ? 1 : e.key === 'PageUp' ? -1
        : e.key === 'ArrowRight' ? dir : e.key === 'ArrowLeft' ? -dir : 0;
      if (!step) return;
      e.preventDefault();
      go(live.current.cur + step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dir, go]);

  const gesture = useRef<{ x: number; t: number; dx: number; dy: number; vx: number; mode: 'tap' | 'turn' | 'none'; from: number } | null>(null);
  const pan = usePanGesture({
    minDistance: 0,
    runOnJS: true,
    onBegin: (e) => {
      gesture.current = { x: e.x, t: Date.now(), dx: 0, dy: 0, vx: 0, mode: live.current.turn ? 'none' : 'tap', from: 0 };
    },
    onUpdate: (e) => {
      const g = gesture.current;
      if (!g) return;
      g.dx = e.translationX;
      g.dy = e.translationY;
      g.vx = e.velocityX;
      if (g.mode === 'tap') {
        const L = live.current;
        if (Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2) {
          // Towards the spine turns forward; away from it turns back.
          const forward = g.dx * dir < 0;
          if (forward && L.cur < L.last) { g.mode = 'turn'; g.from = 0; begin({ a: L.cur, b: L.cur + 1 }, 0); }
          else if (!forward && L.cur > 0) { g.mode = 'turn'; g.from = 1; begin({ a: L.cur - 1, b: L.cur }, 1); }
          else g.mode = 'none';
        } else if (Math.abs(g.dy) > 14) g.mode = 'none';
      }
      // The turning page's outer edge follows the finger.
      if (g.mode === 'turn') p.set(Math.min(1, Math.max(0, g.from - (g.dx * dir) / (2 * W))));
    },
    onFinalize: () => {
      const g = gesture.current;
      gesture.current = null;
      if (!g) return;
      if (g.mode === 'tap' && Math.abs(g.dx) < 8 && Math.abs(g.dy) < 8 && Date.now() - g.t < 500) {
        // A tap near a page's outer edge turns it.
        const x = dir === 1 ? g.x : 2 * W - g.x;
        if (x > 2 * W - W * 0.38) go(live.current.cur + 1);
        else if (x < W * 0.38) go(live.current.cur - 1);
        return;
      }
      if (g.mode !== 'turn') return;
      // A third of the way over, or a flick, is enough; where the page would be a moment later decides.
      const ahead = p.get() - ((g.vx * dir) / (2 * W)) * 0.25;
      const over = g.from === 0 ? ahead > 0.3 : ahead < 0.7;
      settle(over === (g.from === 0) ? 1 : 0);
    },
  });

  const bookStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const onCover = cur === 0 && !turn;
  const leavingCover = turn?.a === 0;
  const headerStyle = useAnimatedStyle(() => ({ opacity: leavingCover ? 1 - p.get() : onCover ? 1 : 0 }));

  // ---------- Drawing ----------
  const top = (k: number) => (k === 0 ? cover : 0);
  const hasPages = (k: number) => room(k) >= 96;
  const sheet = (k: number, slot: 'near' | 'far') => {
    const s = spreads[k];
    if (!s || !hasPages(k)) return null;
    const l = slot === 'near' ? near : far;
    return <Sheet w={s[l]} lang={l} slot={slot} height={sheetH - top(k)} tops={tops} rows={rows} index={index} renderRow={renderRow} mirror={dir < 0} />;
  };
  const place = (key: string, k: number, slot: 'near' | 'far') => (
    <View key={key} style={[styles.sheet, { left: slot === 'near' ? 0 : W, top: top(k), width: W }]}>{sheet(k, slot)}</View>
  );

  // The open book lies on a soft shadow, with the edges of more pages showing at either side.
  const bedTop = turn ? top(turn.b) : top(Math.max(cur, 0));
  const bed = (turn ? hasPages(turn.b) : cur >= 0 && hasPages(cur)) ? <Bed key="bed" W={W} top={bedTop} height={sheetH - bedTop} /> : null;

  let layers: ReactElement[] = [];
  if (turn) {
    const { a, b } = turn;
    const tallest = Math.min(top(a), top(b));
    layers = [
      // Underneath, the next right page, uncovered as the fold passes. (The
      // next left page is the back of the turning page.)
      <Reveal key={`r${b}`} p={p} W={W} top={top(b)}>{sheet(b, 'far')}</Reveal>,
      // On top, this spread: the left page stays, the right page lifts away.
      place(`n${a}`, a, 'near'),
      <FarClip key={`c${a}`} p={p} W={W} top={top(a)}>{sheet(a, 'far')}</FarClip>,
      <Shadows key="s" p={p} W={W} top={tallest} height={sheetH - tallest} />,
      <Flap key={`b${b}`} p={p} W={W} top={top(b)} height={sheetH - top(b)}>{sheet(b, 'near')}</Flap>,
    ];
  } else if (cur >= 0) {
    layers = [
      <Animated.View key={`n${cur}`} entering={swing && !reduce ? PageOpen : undefined} style={[styles.sheet, styles.originRight, { left: 0, top: top(cur), width: W }]}>
        {sheet(cur, 'near')}
      </Animated.View>,
      place(`f${cur}`, cur, 'far'),
    ];
  }

  const num = (n: number) => (lang === 'ar' ? toArDigits(n) : String(n));
  const isLast = complete && cur === last;
  const status = cur >= 0 ? t.pageOf(num(cur + 1), total ? num(total) : null) : '';

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={[styles.book, { top: bookTop, width: 2 * W, height: sheetH }, NO_SELECT, bookStyle]} accessibilityLabel={status}>
          <View style={[StyleSheet.absoluteFill, dir < 0 && styles.flip]}>{bed}{layers}</View>
          {cur > 0 && <Zone label={t.prevPage} side={dir === 1 ? 'left' : 'right'} W={W} onPress={() => go(live.current.cur - 1)} />}
          {cur >= 0 && cur < last && <Zone label={t.nextPage} side={dir === 1 ? 'right' : 'left'} W={W} onPress={() => go(live.current.cur + 1)} />}
        </Animated.View>
      </GestureDetector>
      {header ? (
        <Animated.View pointerEvents={onCover ? 'box-none' : 'none'} style={[styles.header, { top: bookTop - 4, maxHeight: sheetH }, headerStyle]}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} onContentSizeChange={(_w, h) => setHeaderH(Math.ceil(h))}>
            {header}
          </ScrollView>
        </Animated.View>
      ) : null}
      <View pointerEvents="box-none" style={[styles.foot, { bottom: insets.bottom + 14, width: W - 16 }, dir === 1 ? { right: 20 } : { left: 20 }]}>
        {isLast && footer ? footer : cur >= 0 ? (
          <View style={[styles.status, dir < 0 && styles.statusRtl]}>
            <Text style={[styles.statusText, { color: colors.label2 }]}>{status}</Text>
            {total ? (
              <View style={[styles.track, { backgroundColor: colors.sep }]}>
                <View style={[styles.trackFill, { backgroundColor: colors.crimson, width: `${((cur + 1) / total) * 100}%` }, dir < 0 && styles.trackRtl]} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      {!complete && (
        <View pointerEvents="none" style={styles.measure} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
          {(['sv', 'ar'] as const).map((l) => (
            <View key={l} style={{ width: textW }}>
              {index.slice(0, upto).map((ri, i) => (
                <View key={ri} onLayout={(e) => record(sizes, l, i, e.nativeEvent.layout.height, upto)}>{renderRow(rows[ri], l)}</View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface SheetProps {
  w: Window; lang: Lang; slot: 'near' | 'far'; height: number; tops: number[]; rows: Row[]; index: number[];
  renderRow: BookProps['renderRow']; mirror: boolean;
}

/** Shading where the paper curves into the spine: deeper on dark paper. */
function foldColors(page: PagePalette): [string, string, string] {
  const n = parseInt(page.page.slice(1), 16);
  const dark = ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255) < 3 * 96;
  return dark ? ['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.5)'] : ['rgba(70,40,30,0)', 'rgba(70,40,30,0.05)', 'rgba(70,40,30,0.15)'];
}

/**
 * One page: paper with its own double frame and a cross on each corner, the
 * slice of the text it shows, and the shading of the fold along the spine.
 */
const Sheet = memo(function Sheet({ w, lang, slot, height, tops, rows, index, renderRow, mirror }: SheetProps) {
  const { page } = useSettings();
  const near = slot === 'near';
  const shown = useMemo(() => rowsIn(tops, w), [tops, w]);
  const frame = near ? { left: INSET, right: GUTTER } : { left: GUTTER, right: INSET };
  const fold = foldColors(page);
  const corner = (key: string, pos: ViewStyle) => (
    <View key={key} style={[styles.corner, { backgroundColor: page.page }, pos]}><CopticCross size={17} color={page.rule} /></View>
  );
  return (
    <View style={[styles.paper, near ? styles.paperNear : styles.paperFar, { height, backgroundColor: page.page }]}>
      <View pointerEvents="none" style={[styles.ruleOuter, { top: INSET, bottom: INSET, ...frame, borderColor: page.rule }]} />
      <View pointerEvents="none" style={[styles.ruleInner, { top: INSET + RULE_GAP, bottom: INSET + RULE_GAP, left: frame.left + RULE_GAP, right: frame.right + RULE_GAP, borderColor: page.rule2 }]} />
      {corner('tl', { top: INSET - 10, left: frame.left - 10 })}
      {corner('tr', { top: INSET - 10, right: frame.right - 10 })}
      {corner('bl', { bottom: INSET - 10, left: frame.left - 10 })}
      {corner('br', { bottom: INSET - 10, right: frame.right - 10 })}
      {/* The window ends between two lines; the next page starts there. In the mirrored (Arabic) book the text is turned back. */}
      <View style={[styles.window, { top: EDGE, height: w.e - w.s }, near ? { left: TEXT_OUTER, right: TEXT_INNER } : { left: TEXT_INNER, right: TEXT_OUTER }, mirror && styles.flip]}>
        {shown.map((j) => (
          <View key={index[j]} style={[styles.row, { top: tops[j] - w.s }]}>{renderRow(rows[index[j]], lang)}</View>
        ))}
      </View>
      <LinearGradient pointerEvents="none" colors={near ? fold : [fold[2], fold[1], fold[0]]} locations={near ? [0, 0.55, 1] : [0, 0.45, 1]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.fold, near ? { right: 0 } : { left: 0 }]} />
    </View>
  );
});

/** Under the pages: the shadow the book casts, and a few more sheets showing at its outer edges. */
function Bed({ W, top, height }: { W: number; top: number; height: number }) {
  const { page, colors } = useSettings();
  return (
    <View pointerEvents="none" style={[styles.sheet, { left: 0, top, width: 2 * W, height }]}>
      {[6, 3].map((o, i) => (
        <View key={o} style={[styles.stack, { top: o / 2, bottom: o / 2, left: -o, right: -o, backgroundColor: page.page, borderColor: colors.sep },
          !i && { boxShadow: `0 18px 34px -18px ${colors.shadow}, 0 1px 3px ${colors.shadow}` }]} />
      ))}
    </View>
  );
}

/**
 * The part of the right page that has not lifted yet: everything left of the
 * fold. The box slides left and its content slides back, so only transforms
 * move while the page turns.
 */
function FarClip({ p, W, top, children }: { p: SharedValue<number>; W: number; top: number; children: ReactElement | null }) {
  const box = useAnimatedStyle(() => ({ transform: [{ translateX: -W * p.get() }] }));
  const content = useAnimatedStyle(() => ({ transform: [{ translateX: W * p.get() }] }));
  return (
    <Animated.View style={[styles.clip, { left: W, top, width: W }, box]}>
      <Animated.View style={content}>{children}</Animated.View>
    </Animated.View>
  );
}

/** The next right page, right of the fold. */
function Reveal({ p, W, top, children }: { p: SharedValue<number>; W: number; top: number; children: ReactElement | null }) {
  const box = useAnimatedStyle(() => ({ transform: [{ translateX: W - W * p.get() }] }));
  const content = useAnimatedStyle(() => ({ transform: [{ translateX: W * p.get() - W }] }));
  return (
    <Animated.View style={[styles.clip, { left: W, top, width: W }, box]}>
      <Animated.View style={content}>{children}</Animated.View>
    </Animated.View>
  );
}

/**
 * The folded-over part of the turning page. Its back is the next spread's
 * left page, which lands exactly in place as the turn completes. The fold is
 * at the box's right edge; the shading there gives the paper its curve.
 */
function Flap({ p, W, top, height, children }: { p: SharedValue<number>; W: number; top: number; height: number; children: ReactElement | null }) {
  const box = useAnimatedStyle(() => ({ transform: [{ translateX: W - W * p.get() }] }));
  const content = useAnimatedStyle(() => ({ transform: [{ translateX: W - W * p.get() }] }));
  const curve = useAnimatedStyle(() => ({ opacity: Math.sin(Math.PI * p.get()) }));
  return (
    <Animated.View style={[styles.clip, { left: 0, top, width: W, height }, box]}>
      <Animated.View style={content}>{children}</Animated.View>
      <Animated.View pointerEvents="none" style={[styles.curve, curve]}>
        <LinearGradient colors={['rgba(40,20,10,0)', 'rgba(40,20,10,0.10)', 'rgba(40,20,10,0.26)']} locations={[0, 0.7, 1]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </Animated.View>
  );
}

/** The shadow the turning page casts: on the page it uncovers, right of the fold, and on the pages under its edge. */
function Shadows({ p, W, top, height }: { p: SharedValue<number>; W: number; top: number; height: number }) {
  const fold = useAnimatedStyle(() => ({ opacity: Math.sin(Math.PI * p.get()), transform: [{ translateX: W - W * p.get() }] }));
  const edge = useAnimatedStyle(() => ({ opacity: Math.sin(Math.PI * p.get()) * 0.9, transform: [{ translateX: 2 * W - 2 * W * p.get() - 34 }] }));
  return (
    <>
      <View pointerEvents="none" style={[styles.clip, { left: W, top, width: W, height }]}>
        <Animated.View style={[styles.shadow, { width: 56 }, fold]}>
          <LinearGradient colors={['rgba(30,15,10,0.24)', 'rgba(30,15,10,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
      <View pointerEvents="none" style={[styles.clip, { left: 0, top, width: 2 * W, height }]}>
        <Animated.View style={[styles.shadow, { width: 34 }, edge]}>
          <LinearGradient colors={['rgba(30,15,10,0)', 'rgba(30,15,10,0.16)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </>
  );
}

/** Turning by touch is the book's own gesture; screen readers get a button at each outer edge. */
function Zone({ label, side, W, onPress }: { label: string; side: 'left' | 'right'; W: number; onPress: () => void }) {
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={onPress}
      pointerEvents="none"
      style={[styles.zone, { width: W * 0.2 }, side === 'left' ? { left: 0 } : { right: 0 }]}
    />
  );
}

const styles = StyleSheet.create({
  // The measuring layer is taller than the screen; it must not make the page scroll.
  fill: { flex: 1, overflow: 'hidden' },
  book: { position: 'absolute', left: 12 },
  sheet: { position: 'absolute' },
  originRight: { transformOrigin: 'right center' },
  clip: { position: 'absolute', overflow: 'hidden' },
  paper: { overflow: 'hidden' },
  paperNear: { borderTopLeftRadius: 5, borderBottomLeftRadius: 5 },
  paperFar: { borderTopRightRadius: 5, borderBottomRightRadius: 5 },
  ruleOuter: { position: 'absolute', borderWidth: 1.25 },
  ruleInner: { position: 'absolute', borderWidth: 0.75 },
  corner: { position: 'absolute', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fold: { position: 'absolute', top: 0, bottom: 0, width: 46 },
  stack: { position: 'absolute', borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  window: { position: 'absolute', overflow: 'hidden' },
  row: { position: 'absolute', left: 0, right: 0 },
  curve: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 72 },
  shadow: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  flip: { transform: [{ scaleX: -1 }] },
  zone: { position: 'absolute', top: 0, bottom: 0 },
  header: { position: 'absolute', left: 0, right: 0 },
  foot: { position: 'absolute', height: 44, justifyContent: 'center' },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  statusRtl: { flexDirection: 'row-reverse' },
  statusText: { fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  track: { width: 72, height: 3, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: 3, borderRadius: 2 },
  trackRtl: { alignSelf: 'flex-end' },
  measure: { position: 'absolute', top: 0, left: 0, opacity: 0, flexDirection: 'row' },
});
