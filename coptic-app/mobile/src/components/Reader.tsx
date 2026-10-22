/**
 * The reading view used for readings, prayers, liturgies and the Bible.
 *
 * Folded (narrow): one page in the primary language. Every text unit carries
 * the other language too; tapping a verse unfolds it. "Both" shows the other
 * language under every unit as a smaller subtitle. A sideways swipe swaps
 * languages, keeping the current verse at the top.
 *
 * Unfolded (wide): an open book (Book), Swedish on the left page and Arabic
 * on the right, row by row so verses line up, turned page by page.
 *
 * The reader owns its chrome: the top bar, with the context pill in the
 * middle once the title has scrolled away, and the fades that let the text
 * slip under the top bar and the tab bar instead of colliding with them.
 * With an outline, the wayfinder shows where in the text the reader is.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type ListViewToken, type NativeScrollEvent, type NativeSyntheticEvent, type TextStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import type { Grid } from '../book';
import { toArDigits } from '../lib/coptic';
import type { Lang, Role, Unit } from '../lib/types';
import { itemAt, type Outline } from '../rows';
import { useSettings } from '../settings';
import { FONTS, SPRING_SMOOTH, type PagePalette } from '../theme';
import { Book } from './Book';
import { Cartouche } from './Cartouche';
import { CopticCross } from './CopticCross';
import { PageBody, PageBottom, PageTop } from './Page';
import { ReaderActions } from './ReaderActions';
import { useToast } from './Toast';
import { BAR_HEIGHT, TopBar } from './TopBar';
import { ContextPill, createWayStore, useWay, Wayfinder, type WayStore } from './Wayfinder';

export type Row =
  | { k: 'top' }
  | { k: 'bottom' }
  | { k: 'run'; ar: string; sv: string }
  | { k: 'cart'; ar: string; sv: string }
  | { k: 'feast'; items: { ar: string; sv: string }[] }
  | { k: 'title'; id: string; ar: string; sv: string; capAr?: string; capSv?: string }
  | { k: 'role'; r: Role }
  | { k: 'u'; u: Unit; showC?: boolean; role?: Role; highlight?: boolean }
  | { k: 'sep' };

const PEEKABLE = new Set<Unit['t']>(['v', 'psalm', 'f', 'p', 'secret']);
const EMPTY: ReadonlySet<number> = new Set();
const ALWAYS_BOTH = new Set<Unit['t']>(['ref', 'h', 'H', 'note', 'rubric']);
const other = (l: Lang): Lang => (l === 'ar' ? 'sv' : 'ar');

interface Ctx {
  page: PagePalette;
  base: number;
  t: ReturnType<typeof useSettings>['t'];
}

// ---------- Text styles ----------

function textStyle(lang: Lang, kind: Unit['t'] | 'title' | 'run' | 'cart', { page, base }: Ctx, secondary: boolean, role?: Role): TextStyle {
  const ar = lang === 'ar';
  const dir: TextStyle = ar ? { writingDirection: 'rtl', textAlign: 'right' } : { writingDirection: 'ltr', textAlign: 'left' };
  const center: TextStyle = { textAlign: 'center' };
  const people = role === 'people';
  switch (kind) {
    case 'ref':
      return ar ? { ...dir, ...center, fontFamily: FONTS.arBold, fontSize: base * (secondary ? 0.95 : 1.12), lineHeight: base * 1.8, color: page.ink }
        : { ...dir, ...center, fontFamily: FONTS.svSemi, fontSize: base * (secondary ? 0.8 : 0.92), lineHeight: base * 1.4, color: page.ink };
    case 'h':
      return ar ? { ...dir, ...center, fontFamily: FONTS.arBold, fontSize: base * (secondary ? 1 : 1.25), lineHeight: base * 2, color: secondary ? page.ink2 : page.ink }
        : { ...dir, ...center, fontFamily: FONTS.svSemi, fontSize: base * (secondary ? 0.85 : 1.02), lineHeight: base * 1.5, color: secondary ? page.ink2 : page.ink };
    case 'H':
      return ar ? { ...dir, ...center, fontFamily: FONTS.arBold, fontSize: base * (secondary ? 1.15 : 1.6), lineHeight: base * (secondary ? 1.9 : 2.3), color: secondary ? page.ink2 : page.ink }
        : secondary
          ? { ...dir, ...center, fontSize: base * 0.68, fontWeight: '700', letterSpacing: 2.2, textTransform: 'uppercase', color: page.rule, lineHeight: base * 1.4 }
          : { ...dir, ...center, fontFamily: FONTS.svSemi, fontSize: base * 1.05, letterSpacing: 1.2, color: page.ink, lineHeight: base * 1.6 };
    case 'f':
      return ar ? { ...dir, fontFamily: FONTS.ar, fontSize: base * (secondary ? 1 : 1.1), lineHeight: base * 1.9, color: page.ink2 }
        : { ...dir, fontFamily: FONTS.svItalic, fontSize: base * (secondary ? 0.85 : 0.9), lineHeight: base * 1.5, color: page.ink2 };
    case 'rubric':
    case 'note':
      return ar ? { ...dir, fontFamily: FONTS.ar, fontSize: base * 1, lineHeight: base * 1.8, color: page.rule }
        : { ...dir, fontFamily: FONTS.svItalic, fontSize: base * 0.82, lineHeight: base * 1.4, color: page.rule };
    case 'secret':
      return ar ? { ...dir, fontFamily: FONTS.ar, fontSize: base * (secondary ? 1 : 1.12), lineHeight: base * 1.9, color: page.ink2 }
        : { ...dir, fontFamily: FONTS.svItalic, fontSize: base * (secondary ? 0.85 : 0.92), lineHeight: base * 1.55, color: page.ink2 };
    default:
      if (secondary) {
        return ar ? { ...dir, fontFamily: people ? FONTS.arBold : FONTS.ar, fontSize: base * 1.1, lineHeight: base * 1.9, color: page.ink2 }
          : { ...dir, fontFamily: people ? FONTS.svSemi : FONTS.sv, fontSize: base * 0.9, lineHeight: base * 1.55, color: page.ink2 };
      }
      return ar ? { ...dir, fontFamily: people ? FONTS.arBold : FONTS.ar, fontSize: base * 1.3, lineHeight: base * 2.5, color: page.ink }
        : { ...dir, fontFamily: people ? FONTS.svSemi : FONTS.sv, fontSize: base, lineHeight: base * 1.62, color: page.ink };
  }
}

/** Where the lines of a row's text fall, so the open book can break a long row between two lines. */
function lineGrid(row: Row, lang: Lang, ctx: Ctx): Grid | null {
  if (row.k !== 'u' || row.u.t === 'role') return null;
  const t = row.u.t;
  const lh = textStyle(lang, t, ctx, false, row.role).lineHeight;
  // The first line starts below the unit's top padding (styles.unit, unitCenter, unitH, unith).
  return lh ? { top: t === 'H' ? 26 : t === 'h' ? 16 : t === 'ref' ? 14 : 5, lh } : null;
}

function UnitText({ u, lang, ctx, secondary, showC, role }: { u: Unit; lang: Lang; ctx: Ctx; secondary: boolean; showC?: boolean; role?: Role }) {
  let s = lang === 'ar' ? u.ar : u.sv;
  if (!s) return null;
  if (u.t === 'ref' && lang === 'ar') s = toArDigits(s.replace(/\s*:\s*/g, ' : ').replace(/\s*–\s*/g, ' – '));
  const num = u.t === 'v' ? (showC ? `${u.c}:${u.n}` : String(u.n)) : null;
  const style = textStyle(lang, u.t, ctx, secondary, role);
  const alt: TextStyle | null = secondary && !ALWAYS_BOTH.has(u.t)
    ? lang === 'ar'
      ? { borderRightWidth: 2, borderColor: ctx.page.rule2, paddingRight: 10, marginTop: 6 }
      : { borderLeftWidth: 2, borderColor: ctx.page.rule2, paddingLeft: 10, marginTop: 6 }
    : null;
  return (
    <Text style={[style, alt]}>
      {num && <Text style={{ fontSize: ctx.base * (lang === 'ar' ? 0.62 : 0.6), color: ctx.page.rule, fontWeight: '600' }}>{lang === 'ar' ? toArDigits(num) : num}{' '}</Text>}
      {s}
    </Text>
  );
}

function Dots({ color }: { color: string }) {
  return (
    <Svg height={6} width="62%" style={styles.dots}>
      <Line x1="2" y1="3" x2="100%" y2="3" stroke={color} strokeWidth={1.8} strokeDasharray="0.1 5" strokeLinecap="round" />
    </Svg>
  );
}

function roleColor(r: Role, page: PagePalette) {
  return r === 'priest' ? page.rule : r === 'deacon' ? page.gold : page.ink;
}

/** Accent bar on the reading side: gold for the deacon, crimson for the people. */
function roleBar(role: Role | undefined, lang: Lang, page: PagePalette) {
  if (!role || role === 'priest') return null;
  const color = role === 'deacon' ? page.gold : page.rule;
  return lang === 'ar'
    ? { borderRightWidth: 3, borderRightColor: color, paddingRight: 10 }
    : { borderLeftWidth: 3, borderLeftColor: color, paddingLeft: 10 };
}

// ---------- One row ----------

function RowContent({ row, langs, ctx, peeked, both }: { row: Row; langs: Lang[]; ctx: Ctx; peeked?: boolean; both?: boolean }) {
  const { page, base } = ctx;
  const [P, O] = langs;
  switch (row.k) {
    case 'run':
      return (
        <View style={styles.run}>
          <Text style={P === 'ar' ? { fontFamily: FONTS.arBold, fontSize: base, color: page.ink, textAlign: 'center' } : { fontFamily: FONTS.sv, fontSize: base * 0.78, color: page.ink2, textAlign: 'center' }}>
            {P === 'ar' ? row.ar : row.sv}
          </Text>
          <View style={[styles.runRule, { backgroundColor: page.ink }, P === 'ar' ? styles.runRuleRtl : null]} />
        </View>
      );
    case 'cart':
      return (
        <Cartouche>
          {[P, O].filter(Boolean).map((l, i) => (
            <Text key={l} style={l === 'ar'
              ? { fontFamily: i ? FONTS.ar : FONTS.arBold, fontSize: base * (i ? 0.95 : 1.2), lineHeight: base * 1.9, color: i ? page.ink2 : page.ink, textAlign: 'center', writingDirection: 'rtl' }
              : { fontFamily: i ? FONTS.sv : FONTS.svSemi, fontSize: base * (i ? 0.82 : 1.02), lineHeight: base * 1.45, color: i ? page.ink2 : page.ink, textAlign: 'center' }}>
              {l === 'ar' ? row.ar : row.sv}
            </Text>
          ))}
        </Cartouche>
      );
    case 'feast':
      return (
        <View style={styles.feast}>
          {row.items.map((f, i) => (
            <View key={i}>
              {[P, O].filter(Boolean).map((l, j) => (
                <Text key={l} style={l === 'ar'
                  ? { fontFamily: FONTS.ar, fontSize: base * (j ? 0.92 : 1.05), lineHeight: base * 1.8, color: j ? page.ink2 : page.ink, textAlign: 'center' }
                  : { fontFamily: j ? FONTS.svItalic : FONTS.sv, fontSize: base * (j ? 0.82 : 0.95), lineHeight: base * 1.4, color: j ? page.ink2 : page.ink, textAlign: 'center' }}>
                  {l === 'ar' ? f.ar : f.sv}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    case 'title': {
      const cap = P === 'ar' ? row.capAr : row.capSv;
      return (
        <View style={styles.title}>
          {P === 'ar'
            ? <Text style={{ fontFamily: FONTS.arBold, fontSize: base * 1.6, lineHeight: base * 2.4, color: page.ink, textAlign: 'center' }}>{row.ar}</Text>
            : <Text style={{ fontFamily: FONTS.svSemi, fontSize: base * 1.32, lineHeight: base * 1.8, color: page.ink, textAlign: 'center' }}>{row.sv}</Text>}
          {O && (O === 'sv'
            ? <Text style={{ fontSize: base * 0.72, fontWeight: '700', letterSpacing: 2.4, textTransform: 'uppercase', color: page.rule, textAlign: 'center' }}>{row.sv}</Text>
            : <Text style={{ fontFamily: FONTS.arBold, fontSize: base, lineHeight: base * 1.7, color: page.ink2, textAlign: 'center' }}>{row.ar}</Text>)}
          {cap ? <Text style={P === 'ar'
            ? { fontFamily: FONTS.ar, fontSize: base * 0.95, lineHeight: base * 1.7, color: page.ink2, textAlign: 'center', marginTop: 2 }
            : { fontFamily: FONTS.svItalic, fontSize: base * 0.82, color: page.ink2, textAlign: 'center', marginTop: 4 }}>{cap}</Text> : null}
        </View>
      );
    }
    case 'role': {
      const color = roleColor(row.r, page);
      return (
        <View style={[styles.role, P === 'ar' ? styles.roleRtl : null]}>
          <View style={[styles.roleDot, { backgroundColor: row.r === 'people' ? page.rule : color }]} />
          {[P, O].filter(Boolean).map((l, i) => (
            <Text key={l} style={l === 'ar'
              ? { fontFamily: FONTS.arBold, fontSize: base * (i ? 0.85 : 1), color: i ? page.ink2 : color }
              : { fontSize: base * (i ? 0.62 : 0.7), fontWeight: '700', letterSpacing: 1.8, textTransform: 'uppercase', color: i ? page.ink2 : color }}>
              {i ? '· ' : ''}{l === 'ar' ? ROLE_AR[row.r] : ROLE_SV[row.r]}
            </Text>
          ))}
        </View>
      );
    }
    case 'sep':
      return (
        <View style={styles.sep}>
          <View style={[styles.sepLine, { backgroundColor: page.ink }]} />
          <SepCross color={page.rule} />
          <View style={[styles.sepLine, { backgroundColor: page.ink }]} />
        </View>
      );
    case 'u': {
      const u = row.u;
      if (u.t === 'role') return null;
      const showAlt = !!O && (both || peeked || ALWAYS_BOTH.has(u.t));
      const bar = roleBar(row.role, P, page);
      const center = u.t === 'ref' || u.t === 'h' || u.t === 'H';
      return (
        <View style={[styles.unit, center && styles.unitCenter, u.t === 'H' && styles.unitH, u.t === 'h' && styles.unith, bar]}>
          <UnitText u={u} lang={P} ctx={ctx} secondary={false} showC={row.showC} role={row.role} />
          {showAlt && (
            <Animated.View entering={ALWAYS_BOTH.has(u.t) ? undefined : FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
              <UnitText u={u} lang={O} ctx={ctx} secondary showC={row.showC} role={row.role} />
            </Animated.View>
          )}
          {u.t === 'ref' && <Dots color={page.ink} />}
        </View>
      );
    }
    default:
      return null;
  }
}

const ROLE_SV: Record<Role, string> = { priest: 'Prästen', deacon: 'Diakonen', people: 'Folket' };
const ROLE_AR: Record<Role, string> = { priest: 'الكاهن', deacon: 'الشماس', people: 'الشعب' };

function SepCross({ color }: { color: string }) {
  return <View style={styles.sepCross}><CopticCross size={18} color={color} /></View>;
}

// ---------- The list ----------

interface ReaderProps {
  rows: Row[];
  header?: ReactElement | null;
  footer?: ReactElement | null;
  /** Row to bring into view; change `key` to scroll again to the same row. */
  scrollTo?: { index: number; key: number } | null;
  /** Sections or verses for the wayfinder */
  outline?: Outline | null;
  /** Label of the back button in the top bar, if any */
  back?: string;
  /**
   * The header carries the reader's actions itself, so the top bar stays
   * away until the reader is into the text and the page starts at the top.
   */
  ownHeader?: boolean;
}

type Mark = React.ComponentRef<typeof View>;

export function Reader({ rows, header, footer, scrollTo, outline, back, ownHeader }: ReaderProps) {
  const s = useSettings();
  const { page, primary, show, spread, scale, t, hintOnce, set } = s;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const reduce = useReducedMotion();
  const listRef = useRef<FlatList<Row>>(null);
  const firstVisible = useRef(0);
  // Unfolded verses belong to one text and one display mode; anything else starts folded.
  const [peekState, setPeekState] = useState<{ rows: Row[]; show: string; set: ReadonlySet<number> }>({ rows, show, set: EMPTY });
  // A new text (another day) gets new row keys: the list would otherwise place
  // jumps with the old text's row heights. It also starts at the top.
  const [textNo, setTextNo] = useState({ rows, n: 0 });
  if (textNo.rows !== rows) setTextNo({ rows, n: textNo.n + 1 });
  useEffect(() => {
    if (textNo.n) listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [textNo.n]);
  const peeks = peekState.rows === rows && peekState.show === show ? peekState.set : EMPTY;
  const swipeDir = useRef(0);
  const opacity = useSharedValue(1);
  const shift = useSharedValue(0);
  const [way] = useState(createWayStore);
  const progress = useSharedValue(0);
  const marks = useRef(new Map<number, Mark>());
  const seen = useRef({ first: 0 });
  const seq = useRef(0);
  const lastLocate = useRef(0);
  const trailing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const markSet = useMemo(() => new Set(outline?.items.map((i) => i.index)), [outline]);

  const ctx = useMemo<Ctx>(() => ({ page, base: 18 * scale, t }), [page, scale, t]);
  const both = show === 'both';

  // The open book: the row it turns to, and whether the device has just unfolded.
  const [goTo, setGoTo] = useState<{ index: number; key: number } | null>(null);
  const bookJump = useRef<number | null>(null);
  const [seenSpread, setSeenSpread] = useState(spread);
  const [opening, setOpening] = useState(false);
  if (seenSpread !== spread) {
    setSeenSpread(spread);
    setOpening(spread);
  }

  // First visit: explain tap-to-translate.
  useEffect(() => {
    if (!spread && !both && hintOnce('peek')) toast(t.hintPeek(primary));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offset = insets.top + 60;
  // Jumps land just below the top fade.
  const jumpOffset = insets.top + BAR_HEIGHT + 20;
  // A section counts as entered once its top slips into the top fade.
  const readLine = insets.top + BAR_HEIGHT + 26;

  /**
   * Scroll a row to the top. A row far below what the list has laid out
   * cannot be reached in one go, so onScrollToIndexFailed walks there in
   * steps. A row measured before the rows above it changed height lands in
   * the wrong place, so landmarks are checked on screen and corrected.
   * A newer target, or the reader's own finger, cancels both.
   */
  const target = useRef<{ index: number; viewOffset: number; tries: number } | null>(null);
  const scrolledAt = useRef(0);
  const offsetY = useRef(0);
  const scrollToRow = useCallback((index: number, viewOffset: number) => {
    const goal = { index, viewOffset, tries: 0 };
    target.current = goal;
    const go = () => {
      try { listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0, viewOffset }); } catch { /* handled by onScrollToIndexFailed */ }
    };
    go();
    if (!markSet.has(index)) return;
    let checks = 0;
    let waits = 0;
    let still = 0;
    const verify = () => setTimeout(() => {
      if (target.current !== goal) return;
      // Still moving: check once it has come to rest.
      if (Date.now() - scrolledAt.current < 120 && waits++ < 40) { verify(); return; }
      if (checks++ >= 16) return;
      const node = marks.current.get(index);
      if (!node) { still = 0; go(); verify(); return; }
      node.measureInWindow((_x, y, _w, h) => {
        if (target.current !== goal) return;
        if (h === 0) { still = 0; go(); verify(); return; }
        // The list's own idea of where the row is can be stale; what is on screen is not.
        if (Math.abs(y - viewOffset) > 4) {
          still = 0;
          listRef.current?.scrollToOffset({ offset: Math.max(0, offsetY.current + y - viewOffset), animated: false });
          verify();
        }
        // Rows above it may still be laid out and push it down, so it is
        // watched until it has stayed put for half a second.
        else if (++still < 4) verify();
      });
    }, checks ? 120 : 90);
    verify();
  }, [markSet]);
  const onScrollFailed = useCallback((info: { index: number; highestMeasuredFrameIndex: number }) => {
    const goal = target.current;
    if (!goal || goal.index !== info.index || goal.tries++ > 40) return;
    listRef.current?.scrollToIndex({ index: info.highestMeasuredFrameIndex, animated: false, viewPosition: 0 });
    setTimeout(() => {
      if (target.current !== goal) return;
      try { listRef.current?.scrollToIndex({ index: goal.index, animated: false, viewPosition: 0, viewOffset: goal.viewOffset }); } catch { /* next step */ }
    }, 40);
  }, []);

  const restore = useCallback((index: number) => {
    requestAnimationFrame(() => scrollToRow(index, offset));
  }, [offset, scrollToRow]);

  // Keep the reader on the same verse when the language or layout changes.
  const prev = useRef({ primary, show, spread });
  useEffect(() => {
    const p = prev.current;
    prev.current = { primary, show, spread };
    if (p.primary === primary && p.show === show && p.spread === spread) return;
    // The open book finds its own page.
    if (!spread) restore(firstVisible.current);
    if (p.primary !== primary && !reduce) {
      const d = swipeDir.current || (primary === 'sv' ? 1 : -1);
      swipeDir.current = 0;
      opacity.set(0);
      shift.set(-d * 24);
      opacity.set(withTiming(1, { duration: 260 }));
      shift.set(withSpring(0, SPRING_SMOOTH));
    }
  }, [primary, show, spread, restore, reduce, opacity, shift]);

  /**
   * Which outline item the reader is in: the last one that starts on or above
   * the first row on screen, or a later one whose top has passed under the
   * pill. The list reports visible rows late during fast scrolls, so the next
   * landmarks on screen are measured rather than trusted to that report.
   */
  const locate = useCallback(() => {
    if (!outline) return;
    const { first } = seen.current;
    const items = outline.items;
    let cur = itemAt(items, first);
    const id = ++seq.current;
    const cands: number[] = [];
    for (let k = cur + 1; k < items.length && cands.length < 8; k++) if (marks.current.has(items[k].index)) cands.push(k);
    if (!cands.length) { way.set({ first, current: cur }); return; }
    let pending = cands.length;
    const ys: number[] = [];
    // A row that has left the screen measures as an empty box at 0,0; it does not count.
    cands.forEach((k, j) => marks.current.get(items[k].index)?.measureInWindow((_x, y, _w, h) => {
      ys[j] = h > 0 ? y : Infinity;
      if (--pending || id !== seq.current) return;
      cands.forEach((kk, jj) => { if (ys[jj] <= readLine) cur = Math.max(cur, kk); });
      way.set({ first, current: cur });
    }));
  }, [outline, readLine, way]);

  /** Jump to a row. Long smooth scrolls are slow and land on stale positions, so a jump cuts, with a short fade. */
  const jump = useCallback((index: number, fade: boolean) => {
    if (index < 0) return;
    if (spread) {
      bookJump.current = index;
      setGoTo({ index, key: Date.now() });
      if (outline) way.set({ current: itemAt(outline.items, index) });
      return;
    }
    if (fade && !reduce) {
      opacity.set(0.2);
      opacity.set(withTiming(1, { duration: 280 }));
    }
    scrollToRow(index, jumpOffset);
    if (outline) way.set({ current: itemAt(outline.items, index) });
  }, [jumpOffset, outline, way, scrollToRow, reduce, opacity, spread]);

  // ---------- The open book ----------
  const hasHeader = !!header;
  const lastFirst = useRef(-1);
  const onSpread = useCallback(({ first, last, k, total }: { first: number; last: number; k: number; total: number | null }) => {
    firstVisible.current = first;
    seen.current = { first };
    if (total) progress.set(total > 1 ? k / (total - 1) : 0);
    way.set({ reading: k > 0 || !hasHeader });
    if (!outline) return;
    // After a jump the section jumped to is current, even if the spread opens with the one before.
    const target = bookJump.current;
    if (target != null && target >= first && target <= last) {
      bookJump.current = null;
      lastFirst.current = first;
      way.set({ first, current: itemAt(outline.items, target) });
      return;
    }
    if (first === lastFirst.current) return;
    lastFirst.current = first;
    way.set({ first, current: itemAt(outline.items, first) });
  }, [outline, progress, way, hasHeader]);
  const getStart = useCallback(() => firstVisible.current, []);
  const renderBookRow = useCallback((row: Row, lang: Lang) => {
    const content = <RowContent row={row} langs={[lang]} ctx={ctx} />;
    return row.k === 'u' && row.highlight ? <View style={{ backgroundColor: page.peek }}>{content}</View> : content;
  }, [ctx, page.peek]);
  const gridOf = useCallback((row: Row, lang: Lang) => lineGrid(row, lang, ctx), [ctx]);

  useEffect(() => {
    if (!scrollTo || scrollTo.index < 0) return;
    const id = setTimeout(() => jump(scrollTo.index, !reduce), 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

  // FlatList does not allow a new onViewableItemsChanged, so it reaches locate through a ref.
  const locateRef = useRef(locate);
  useEffect(() => { locateRef.current = locate; }, [locate]);
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const idx = viewableItems.flatMap((v) => (v.index != null ? [v.index] : []));
    if (!idx.length) return;
    firstVisible.current = Math.min(...idx);
    seen.current = { first: firstVisible.current };
    locateRef.current();
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.height - layoutMeasurement.height;
    scrolledAt.current = Date.now();
    offsetY.current = contentOffset.y;
    progress.set(max > 0 ? Math.min(1, Math.max(0, contentOffset.y / max)) : 0);
    // Reading once the large title is under the top bar; apart thresholds, so it does not flicker at the edge.
    const y = contentOffset.y;
    if (y > 96 !== way.get().reading && (y > 96 || y < 48)) way.set({ reading: y > 96 });
    if (!outline) return;
    // Measure at most every 90 ms while scrolling, and once more when it stops.
    clearTimeout(trailing.current);
    const now = Date.now();
    if (now - lastLocate.current > 90) { lastLocate.current = now; locate(); } else trailing.current = setTimeout(locate, 120);
  }, [outline, locate, progress, way]);

  const onMark = useCallback((i: number, node: Mark | null, prevNode?: Mark) => {
    if (node) marks.current.set(i, node);
    else if (marks.current.get(i) === prevNode) marks.current.delete(i);
  }, []);
  const [viewability] = useState({ itemVisiblePercentThreshold: 1 });

  const pan = usePanGesture({
    activeOffsetX: [-30, 30],
    failOffsetY: [-14, 14],
    runOnJS: true,
    enabled: !spread,
    onDeactivate: (e) => {
      if (e.canceled || Math.abs(e.translationX) < 60) return;
      const np = other(primary);
      swipeDir.current = Math.sign(e.translationX);
      set({ primary: np, show: both ? 'both' : np });
    },
  });

  const togglePeek = useCallback((i: number) => {
    setPeekState((p) => {
      const n = new Set(p.rows === rows && p.show === show ? p.set : EMPTY);
      if (n.has(i)) n.delete(i); else n.add(i);
      return { rows, show, set: n };
    });
    hintOnce('peek');
  }, [hintOnce, rows, show]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateX: shift.get() }] }));

  const extraData = useMemo(() => [ctx, primary, both, peeks], [ctx, primary, both, peeks]);
  const footerView = useMemo(() => <View style={{ paddingBottom: insets.bottom + 120 }}>{footer}</View>, [insets.bottom, footer]);
  const quietTop = !!ownHeader && !spread;
  const contentStyle = useMemo(() => ({ paddingTop: insets.top + (quietTop ? 12 : 60) }), [insets.top, quietTop]);

  const renderItem = useCallback(({ item, index }: { item: Row; index: number }) => (
    <ReaderRow row={item} index={index} ctx={ctx} primary={primary} both={both}
      peeked={peeks.has(index)} onPeek={togglePeek} mark={markSet.has(index)} onMark={onMark} />
  ), [ctx, primary, both, peeks, togglePeek, markSet, onMark]);

  return (
    <View style={styles.fill}>
    {spread ? (
      <Book rows={rows} renderRow={renderBookRow} gridOf={gridOf} sizeKey={String(ctx.base)} header={header} footer={footer}
        start={getStart} goTo={goTo} opening={opening} onSpread={onSpread} />
    ) : (
    /* pan-y: vertical scrolling stays with the browser; only sideways swipes reach the gesture. */
    <GestureDetector gesture={pan} touchAction="pan-y">
      <Animated.View style={[styles.fill, fade]}>
        {/* A plain FlatList: Animated.FlatList wraps every row in an animated view, which made scrolling stutter. */}
        <FlatList
          ref={listRef}
          data={rows}
          keyExtractor={(_, i) => `${textNo.n}:${i}`}
          renderItem={renderItem}
          extraData={extraData}
          ListHeaderComponent={header ?? undefined}
          ListFooterComponent={footerView}
          contentContainerStyle={contentStyle}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewability}
          onScroll={onScroll}
          onScrollBeginDrag={() => { target.current = null; }}
          scrollEventThrottle={32}
          initialNumToRender={14}
          windowSize={11}
          onScrollToIndexFailed={onScrollFailed}
          accessibilityLabel={t.readings}
        />
      </Animated.View>
    </GestureDetector>
    )}
    <Chrome store={way} back={back} book={spread} quiet={quietTop} pill={outline ? <ContextPill outline={outline} rows={rows} store={way} progress={progress} /> : null} />
    {outline && outline.items.length > 0 && <Wayfinder outline={outline} store={way} onJump={jump} />}
    </View>
  );
}

/** The top bar and the edge fades. They follow the scroll on their own, so the list does not re-render with them. */
function Chrome({ store, back, book, quiet, pill }: { store: WayStore; back?: string; book: boolean; quiet: boolean; pill: ReactElement | null }) {
  const reading = useWay(store, (s) => s.reading);
  return (
    <>
      {/* Text slides under the bars only when it scrolls; the open book's pages stop short of them. */}
      {!book && <EdgeFades reading={reading} quiet={quiet} />}
      {(!quiet || reading) && (
        <TopBar back={back} compact={reading && !!pill} center={reading ? pill : null}>
          <ReaderActions />
        </TopBar>
      )}
    </>
  );
}

/**
 * The text fades out under the top bar and the tab bar, like the iOS 26
 * scroll edge effect, so the floating buttons never sit on a line of text.
 * At the top of the screen the fade is the app background, matching the
 * header; once reading, it is the page colour inside the page margins.
 */
function EdgeFades({ reading, quiet }: { reading: boolean; quiet: boolean }) {
  const { colors, page } = useSettings();
  const insets = useSafeAreaInsets();
  const vis = useSharedValue(reading ? 1 : 0);
  useEffect(() => { vis.set(withTiming(reading ? 1 : 0, { duration: 220 })); }, [reading, vis]);
  const onPage = useAnimatedStyle(() => ({ opacity: vis.get() }));
  const solid = insets.top + BAR_HEIGHT;
  const topH = solid + 24;
  const bottomH = insets.bottom + 100;
  const top = (c: string, h: number, stop: number) => (
    <LinearGradient colors={[c, c, `${c}00`]} locations={[0, stop / h, 1]} style={[styles.fadeTop, { height: h }]} />
  );
  const bottom = (c: string) => (
    <LinearGradient colors={[`${c}00`, c, c]} locations={[0, 0.5, 1]} style={[styles.fadeBottom, { height: bottomH }]} />
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* The header's large title starts at the top padding, so the background fade ends there. */}
      {/* With no top bar showing, only the status bar is kept clear. */}
      {quiet && !reading ? top(colors.bg, insets.top + 10, insets.top) : top(colors.bg, insets.top + 60, insets.top + 44)}
      {bottom(colors.bg)}
      <Animated.View style={[styles.fadePage, onPage]}>
        {top(page.page, topH, solid)}
        {bottom(page.page)}
      </Animated.View>
    </View>
  );
}

interface RowProps {
  row: Row; index: number; ctx: Ctx; primary: Lang; both: boolean; peeked: boolean; onPeek: (i: number) => void;
}

/** Rows the wayfinder measures (section titles, headings, verses) get a wrapper it can find on screen. */
const ReaderRow = memo(function ReaderRow({ mark, onMark, ...p }: RowProps & { mark: boolean; onMark: (i: number, node: Mark | null, prev?: Mark) => void }) {
  if (!mark) return <RowView {...p} />;
  return (
    <View collapsable={false} ref={(n) => { if (!n) return; onMark(p.index, n); return () => onMark(p.index, null, n); }}>
      <RowView {...p} />
    </View>
  );
});

function RowView({ row, index, ctx, primary, both, peeked, onPeek }: RowProps) {
  const { page } = ctx;
  if (row.k === 'top') return <PageTop />;
  if (row.k === 'bottom') return <PageBottom />;
  const langs: Lang[] = [primary, other(primary)];
  const tappable = row.k === 'u' && PEEKABLE.has(row.u.t) && !both && !!(primary === 'ar' ? row.u.sv : row.u.ar);
  const content = <RowContent row={row} langs={langs} ctx={ctx} peeked={peeked} both={both} />;
  const highlight = row.k === 'u' && row.highlight ? { backgroundColor: page.peek, borderRadius: 10 } : null;
  return (
    <PageBody style={styles.bodyPad}>
      {tappable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: peeked }}
          accessibilityHint={ctx.t.hintPeek(primary)}
          onPress={() => onPeek(index)}
          style={({ pressed }) => [styles.tap, (pressed || peeked) && { backgroundColor: page.peek }, highlight]}
        >
          {content}
        </Pressable>
      ) : <View style={highlight}>{content}</View>}
    </PageBody>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fadeTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  fadeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  // Same side margins as the page, so the margins keep the background colour.
  fadePage: { position: 'absolute', top: 0, bottom: 0, left: 12, right: 12 },
  bodyPad: { paddingVertical: 0 },
  tap: { borderRadius: 10, marginHorizontal: -8, paddingHorizontal: 8 },
  run: { alignItems: 'stretch', paddingTop: 8, paddingBottom: 12 },
  runRule: { height: 3, marginTop: 6, transform: [{ scaleY: 1 }], borderTopRightRadius: 3, borderBottomRightRadius: 3, opacity: 0.85 },
  runRuleRtl: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  feast: { paddingVertical: 6, gap: 6 },
  title: { paddingTop: 26, paddingBottom: 6, alignItems: 'center' },
  role: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 14, paddingBottom: 2 },
  roleRtl: { flexDirection: 'row-reverse' },
  roleDot: { width: 7, height: 7, borderRadius: 4 },
  sep: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, gap: 10 },
  sepLine: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  sepCross: { width: 18, height: 18 },
  unit: { paddingVertical: 5 },
  unitCenter: { alignItems: 'center', paddingTop: 14 },
  unitH: { paddingTop: 26 },
  unith: { paddingTop: 16 },
  dots: { marginTop: 4, alignSelf: 'center' },
});
