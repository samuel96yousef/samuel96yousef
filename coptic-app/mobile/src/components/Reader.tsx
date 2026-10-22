/**
 * The reading view used for readings, prayers, liturgies and the Bible.
 *
 * Folded (narrow): one page in the primary language. Every text unit carries
 * the other language too; tapping a verse unfolds it. "Both" shows the other
 * language under every unit as a smaller subtitle. A sideways swipe swaps
 * languages, keeping the current verse at the top.
 *
 * Unfolded (wide): an open book, Swedish on the left page and Arabic on the
 * right, row by row so verses line up. The Swedish page swings open from the
 * spine when the device unfolds.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View, type FlatList, type ListViewToken, type TextStyle } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, Keyframe, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { toArDigits } from '../lib/coptic';
import type { Lang, Role, Unit } from '../lib/types';
import { useSettings } from '../settings';
import { FONTS, SPRING, type PagePalette } from '../theme';
import { CopticCross } from './CopticCross';
import { PageBody, PageBottom, PageTop } from './Page';
import { useToast } from './Toast';

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

const PageOpen = new Keyframe({
  0: { transform: [{ perspective: 1400 }, { rotateY: '-95deg' }], opacity: 0.3 },
  40: { opacity: 1 },
  100: { transform: [{ perspective: 1400 }, { rotateY: '0deg' }], opacity: 1 },
}).duration(720);

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
        <View style={[styles.cart, { borderColor: page.rule }]}>
          <View style={[styles.cartInner, { borderColor: page.rule2 }]}>
            {[P, O].filter(Boolean).map((l, i) => (
              <Text key={l} style={l === 'ar'
                ? { fontFamily: i ? FONTS.ar : FONTS.arBold, fontSize: base * (i ? 0.95 : 1.2), lineHeight: base * 1.9, color: i ? page.ink2 : page.ink, textAlign: 'center', writingDirection: 'rtl' }
                : { fontFamily: i ? FONTS.sv : FONTS.svSemi, fontSize: base * (i ? 0.82 : 1.02), lineHeight: base * 1.45, color: i ? page.ink2 : page.ink, textAlign: 'center' }}>
                {l === 'ar' ? row.ar : row.sv}
              </Text>
            ))}
          </View>
          <View style={[styles.diamond, styles.diamondL, { borderColor: page.rule, backgroundColor: page.page }]}><View style={[styles.diamondIn, { borderColor: page.rule2 }]} /></View>
          <View style={[styles.diamond, styles.diamondR, { borderColor: page.rule, backgroundColor: page.page }]}><View style={[styles.diamondIn, { borderColor: page.rule2 }]} /></View>
        </View>
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
}

export function Reader({ rows, header, footer, scrollTo }: ReaderProps) {
  const s = useSettings();
  const { page, primary, show, spread, scale, t, hintOnce, set } = s;
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const reduce = useReducedMotion();
  const listRef = useRef<FlatList<Row>>(null);
  const firstVisible = useRef(0);
  // Unfolded verses belong to one text and one display mode; anything else starts folded.
  const [peekState, setPeekState] = useState<{ rows: Row[]; show: string; set: ReadonlySet<number> }>({ rows, show, set: EMPTY });
  const peeks = peekState.rows === rows && peekState.show === show ? peekState.set : EMPTY;
  const spreadAt = useRef(0);
  const swipeDir = useRef(0);
  const opacity = useSharedValue(1);
  const shift = useSharedValue(0);

  const ctx = useMemo<Ctx>(() => ({ page, base: 18 * scale, t }), [page, scale, t]);
  const both = show === 'both';

  // First visit: explain tap-to-translate.
  useEffect(() => {
    if (!spread && !both && hintOnce('peek')) toast(t.hintPeek(primary));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offset = insets.top + 60;
  const restore = useCallback((index: number) => {
    requestAnimationFrame(() => {
      try { listRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0, viewOffset: offset }); } catch { /* not laid out yet */ }
    });
  }, [offset]);

  // Keep the reader on the same verse when the language or layout changes.
  const prev = useRef({ primary, show, spread });
  useEffect(() => {
    const p = prev.current;
    prev.current = { primary, show, spread };
    if (p.primary === primary && p.show === show && p.spread === spread) return;
    if (p.spread !== spread) spreadAt.current = Date.now();
    restore(firstVisible.current);
    if (p.primary !== primary && !reduce) {
      const d = swipeDir.current || (primary === 'sv' ? 1 : -1);
      swipeDir.current = 0;
      opacity.set(0);
      shift.set(-d * 24);
      opacity.set(withTiming(1, { duration: 260 }));
      shift.set(withSpring(0, SPRING));
    }
  }, [primary, show, spread, restore, reduce, opacity, shift]);

  useEffect(() => {
    if (!scrollTo || scrollTo.index < 0) return;
    const id = setTimeout(() => {
      try { listRef.current?.scrollToIndex({ index: scrollTo.index, animated: !reduce, viewPosition: 0, viewOffset: offset }); } catch { /* handled by onScrollToIndexFailed */ }
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollTo]);

  const onViewable = useCallback(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const first = viewableItems.find((v) => v.index != null);
    if (first?.index != null) firstVisible.current = first.index;
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

  const renderItem = useCallback(({ item, index }: { item: Row; index: number }) => (
    <ReaderRow row={item} index={index} ctx={ctx} spread={spread} primary={primary} both={both}
      peeked={peeks.has(index)} onPeek={togglePeek} animateOpen={!reduce && Date.now() - spreadAt.current < 900} />
  ), [ctx, spread, primary, both, peeks, togglePeek, reduce]);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.fill, fade]}>
        <Animated.FlatList
          ref={listRef as never}
          data={rows}
          keyExtractor={(_, i) => `${spread ? 's' : 'p'}${i}`}
          renderItem={renderItem}
          extraData={[ctx, spread, primary, both, peeks]}
          ListHeaderComponent={header ?? undefined}
          ListFooterComponent={<View style={{ paddingBottom: insets.bottom + 120 }}>{footer}</View>}
          contentContainerStyle={{ paddingTop: insets.top + 60 }}
          onViewableItemsChanged={onViewable}
          viewabilityConfig={viewability}
          itemLayoutAnimation={reduce ? undefined : LinearTransition.springify().damping(SPRING.damping).stiffness(SPRING.stiffness)}
          initialNumToRender={14}
          windowSize={11}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
            setTimeout(() => { try { listRef.current?.scrollToIndex({ index: info.index, animated: false, viewOffset: offset }); } catch { /* give up */ } }, 120);
          }}
          accessibilityLabel={t.readings}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const ReaderRow = memo(function ReaderRow({ row, index, ctx, spread, primary, both, peeked, onPeek, animateOpen }: {
  row: Row; index: number; ctx: Ctx; spread: boolean; primary: Lang; both: boolean; peeked: boolean; onPeek: (i: number) => void; animateOpen: boolean;
}) {
  const { page } = ctx;
  if (spread) {
    if (row.k === 'top' || row.k === 'bottom') {
      const Edge = row.k === 'top' ? PageTop : PageBottom;
      return (
        <View style={styles.spreadRow}>
          <Animated.View entering={animateOpen ? PageOpen : undefined} style={[styles.half, styles.originRight]}><Edge side="left" /></Animated.View>
          <View style={styles.half}><Edge side="right" /></View>
        </View>
      );
    }
    const highlight = row.k === 'u' && row.highlight ? { backgroundColor: page.peek } : null;
    return (
      <View style={styles.spreadRow}>
        <Animated.View entering={animateOpen ? PageOpen : undefined} style={[styles.half, styles.originRight]}>
          <PageBody side="left" style={[styles.cell, highlight]}><RowContent row={row} langs={['sv']} ctx={ctx} /></PageBody>
        </Animated.View>
        <View style={styles.half}>
          <PageBody side="right" style={[styles.cell, highlight]}><RowContent row={row} langs={['ar']} ctx={ctx} /></PageBody>
        </View>
      </View>
    );
  }
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
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  spreadRow: { flexDirection: 'row', direction: 'ltr', marginHorizontal: 12 },
  half: { flex: 1 },
  originRight: { transformOrigin: 'right center' },
  bodyPad: { paddingVertical: 0 },
  // Both pages of a row share its height, so the shorter side has no gap below it.
  cell: { flexGrow: 1 },
  tap: { borderRadius: 10, marginHorizontal: -8, paddingHorizontal: 8 },
  run: { alignItems: 'stretch', paddingTop: 8, paddingBottom: 12 },
  runRule: { height: 3, marginTop: 6, transform: [{ scaleY: 1 }], borderTopRightRadius: 3, borderBottomRightRadius: 3, opacity: 0.85 },
  runRuleRtl: { borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  cart: { marginHorizontal: 30, marginVertical: 8, borderWidth: 1, padding: 3, position: 'relative' },
  cartInner: { borderWidth: 0.75, paddingVertical: 6, paddingHorizontal: 10 },
  diamond: { position: 'absolute', top: '50%', width: 30, height: 30, marginTop: -15, borderWidth: 1, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' },
  diamondIn: { width: 18, height: 18, borderWidth: 0.75 },
  diamondL: { left: -22 },
  diamondR: { right: -22 },
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
