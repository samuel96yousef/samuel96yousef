import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { agpeyaIndex, alhanBooks, books, hymnGroups, kholagyIndex } from '../data';
import { pickDay, useReadingDay } from '../day';
import { toArDigits } from '../lib/coptic';
import { useReaderLink, type ReaderLink } from '../readerHub';
import { useSettings } from '../settings';
import { FONTS, SIDEBAR_W } from '../theme';
import { CopticCross } from './CopticCross';
import { MonthCalendar } from './DayPicker';
import { Icon, type IconName } from './Icon';
import { LangPill } from './LangPill';
import { isReaderPath } from './TabBar';
import { useWay } from './Wayfinder';

type Section = 'index' | 'readings' | 'prayers' | 'bible';
const SECTIONS: { key: Section; path: '/' | '/readings' | '/prayers' | '/bible'; icon: IconName }[] = [
  { key: 'index', path: '/', icon: 'today' },
  { key: 'readings', path: '/readings', icon: 'readings' },
  { key: 'prayers', path: '/prayers', icon: 'prayers' },
  { key: 'bible', path: '/bible', icon: 'bible' },
];
const LABEL = { index: 'today', readings: 'readings', prayers: 'prayers', bible: 'bible' } as const;

/** Pressed, or under the pointer (the web and iPad report hovering). */
const lit = (s: PressableStateCallbackType) => s.pressed || !!(s as { hovered?: boolean }).hovered;

const sectionOf = (path: string): Section =>
  path.startsWith('/readings') ? 'readings' : path.startsWith('/prayers') ? 'prayers' : path.startsWith('/bible') ? 'bible' : 'index';

/**
 * The tab bar of a large screen, as a sidebar in Apple's apps on Mac and iPad:
 * the four parts of the book, and under the open one what belongs to it. The
 * calendar for the day's readings, the hours and liturgies, the books of the
 * Bible, and while reading the table of contents with the reader's place
 * marked, which takes over from the floating pill and the dock.
 */
export function Sidebar() {
  const { t, lang, colors, spread } = useSettings();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const active = sectionOf(path);
  const ar = lang === 'ar';
  const link = useReaderLink();
  const reading = isReaderPath(path);

  return (
    <View style={[styles.bar, { width: SIDEBAR_W, backgroundColor: colors.surface, borderColor: colors.sep, paddingTop: insets.top + 18 },
      ar ? { borderLeftWidth: StyleSheet.hairlineWidth } : { borderRightWidth: StyleSheet.hairlineWidth }]}>
      <View style={[styles.brand, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <CopticCross size={20} color={colors.crimson} />
        <Text style={[styles.brandText, { color: colors.label }]}>{ar ? 'كتاب الصلوات القبطي' : 'Koptisk bönbok'}</Text>
      </View>
      <ScrollView key={active} style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
        {SECTIONS.map((s) => {
          const on = s.key === active;
          return (
            <View key={s.key}>
              <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => router.navigate(s.path)}
                style={(st) => [styles.item, { flexDirection: ar ? 'row-reverse' : 'row' },
                  on ? { backgroundColor: colors.tint } : lit(st) && { backgroundColor: colors.bg2 }]}>
                <Icon name={s.icon} size={20} color={on ? colors.crimson : colors.label} strokeWidth={on ? 2 : 1.75} />
                <Text style={[styles.itemText, { color: on ? colors.crimson : colors.label }]}>{t[LABEL[s.key]]}</Text>
              </Pressable>
              {on && <Context section={s.key} path={path} link={link} />}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.foot, { borderColor: colors.sep, paddingBottom: insets.bottom + 14, flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.settings} onPress={() => router.push('/settings')}
          style={(st) => [styles.footBtn, { flexDirection: ar ? 'row-reverse' : 'row' }, lit(st) && { backgroundColor: colors.bg2 }]}>
          <Icon name="gear" size={19} color={colors.label2} />
          <Text style={[styles.footText, { color: colors.label2 }]}>{t.settings}</Text>
        </Pressable>
        {/* The reading language matters only where one language is read at a time. */}
        {reading && !spread && <LangPill />}
      </View>
    </View>
  );
}

/** What belongs to the open part of the book. */
function Context({ section, path, link }: { section: Section; path: string; link: ReaderLink | null }) {
  const { t, lang } = useSettings();
  const { day } = useReadingDay();
  const ar = lang === 'ar';

  // Today is its own overview, with the week and the calendar on the page.
  if (section === 'index') return null;

  if (section === 'readings') {
    return (
      <View style={styles.context}>
        <View style={styles.calendar}><MonthCalendar small day={day} onPick={pickDay} /></View>
        {link && <Contents link={link} />}
      </View>
    );
  }

  if (section === 'prayers') {
    const id = path.match(/^\/prayers\/(?:hour|liturgy)\/([^/]+)/)?.[1];
    const kind = path.includes('/liturgy/') ? 'kholagy' : 'agpeya';
    const group = (title: string, items: { id: string; ar: string; sv: string }[], k: 'agpeya' | 'kholagy') => (
      <View>
        <Heading>{title}</Heading>
        {items.map((p) => {
          const on = k === kind && p.id === id;
          return (
            <View key={p.id}>
              <Row label={ar ? p.ar : p.sv} on={on} onPress={() => router.navigate(k === 'agpeya' ? `/prayers/hour/${p.id}` : `/prayers/liturgy/${p.id}`)} />
              {on && link && <Contents link={link} nested />}
            </View>
          );
        })}
        {/* The occasions are many: listed here once the hymns are open, else one row leads to them. */}
        {path.startsWith('/prayers/alhan')
          ? hymnGroups.map((g) => <Row key={g.id} label={ar ? g.ar : g.sv} on={g.id === groupId} onPress={() => router.navigate(`/prayers/alhan/g/${g.id}`)} />)
          : <Row label={t.hymnsByOccasion} on={false} onPress={() => router.navigate('/prayers/alhan')} />}
      </View>
    );
    const bookId = path.match(/^\/prayers\/alhan\/([^/]+)/)?.[1];
    const groupId = path.match(/^\/prayers\/alhan\/g\/([^/]+)/)?.[1];
    return (
      <View style={styles.context}>
        {group(t.agpeya, agpeyaIndex, 'agpeya')}
        {group(t.kholagy, kholagyIndex, 'kholagy')}
        <Heading>{t.alhan}</Heading>
        {alhanBooks.map((b) => {
          const on = b.id === bookId;
          return (
            <View key={b.id}>
              <Row label={ar ? b.ar : b.sv} on={on} onPress={() => router.navigate(`/prayers/alhan/${b.id}`)} />
              {on && link && <Contents link={link} nested />}
            </View>
          );
        })}
        {/* The occasions are many: listed here once the hymns are open, else one row leads to them. */}
        {path.startsWith('/prayers/alhan')
          ? hymnGroups.map((g) => <Row key={g.id} label={ar ? g.ar : g.sv} on={g.id === groupId} onPress={() => router.navigate(`/prayers/alhan/g/${g.id}`)} />)
          : <Row label={t.hymnsByOccasion} on={false} onPress={() => router.navigate('/prayers/alhan')} />}
      </View>
    );
  }

  // The Bible: the page lists the books; once one is open, its chapters are here.
  const m = path.match(/^\/bible\/(\d+)(?:\/(\d+))?/);
  const book = m ? books.find((b) => b.bid === Number(m[1])) : undefined;
  if (!book) return null;
  return (
    <View style={styles.context}>
      <Heading>{ar ? book.ar : book.sv}</Heading>
      <Chapters bid={book.bid} count={book.chapters} current={m?.[2] ? Number(m[2]) : 0} />
    </View>
  );
}

/** The open text's landmarks, the reader's place marked; a tap jumps there. */
function Contents({ link, nested }: { link: ReaderLink; nested?: boolean }) {
  const { t, lang, colors } = useSettings();
  const current = useWay(link.store, (s) => s.current);
  const ar = lang === 'ar';
  if (link.outline.kind === 'verses') return null;
  // Main headings only, unless there are too few of them to find one's way by.
  const all = link.outline.items.map((it, i) => ({ it, i }));
  const top = all.filter(({ it }) => it.level === 1);
  const shown = top.length >= 3 ? top : all;
  // The item the reader is in, or the main heading above it.
  const mark = shown.reduce((m, { i }) => (i <= current ? i : m), -1);
  return (
    <View style={[styles.contents, nested && styles.contentsNested]}>
      {!nested && <Heading>{t.contents}</Heading>}
      {shown.map(({ it, i }) => {
        const on = i === mark;
        const sub = ar ? it.subAr : it.subSv;
        return (
          <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => link.jump(it.index, true)}
            style={(st) => [styles.toc, { flexDirection: ar ? 'row-reverse' : 'row' }, lit(st) && { backgroundColor: colors.bg2 }]}>
            <View style={[styles.tocMark, { backgroundColor: on ? colors.crimson : 'transparent' }]} />
            <View style={styles.tocText}>
              <Text numberOfLines={1} style={[styles.tocLabel, { color: on ? colors.crimson : colors.label }, on && styles.tocOn, ar && styles.right]}>{ar ? it.ar : it.sv}</Text>
              {sub ? <Text numberOfLines={1} style={[styles.tocSub, { color: colors.label2 }, ar && styles.right]}>{sub}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The chapters of the open book as a grid of numbers. */
function Chapters({ bid, count, current }: { bid: number; count: number; current: number }) {
  const { lang, colors } = useSettings();
  const ar = lang === 'ar';
  return (
    <View style={[styles.chapters, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
      {Array.from({ length: count }, (_, i) => i + 1).map((c) => {
        const on = c === current;
        return (
          <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => router.navigate(`/bible/${bid}/${c}`)}
            style={(st) => [styles.chapter, on ? { backgroundColor: colors.crimson } : lit(st) && { backgroundColor: colors.bg2 }]}>
            <Text style={[styles.chapterText, { color: on ? '#FFFFFF' : colors.label }]}>{ar ? toArDigits(c) : c}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Heading({ children }: { children: ReactNode }) {
  const { colors, lang } = useSettings();
  return <Text style={[styles.heading, { color: colors.label2 }, lang === 'ar' && styles.right]}>{children}</Text>;
}

function Row({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { colors, lang } = useSettings();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={(st) => [styles.row, on ? { backgroundColor: colors.bg2 } : lit(st) && { backgroundColor: colors.bg2 }]}>
      <Text numberOfLines={1} style={[styles.rowText, { color: on ? colors.crimson : colors.label }, on && styles.tocOn, lang === 'ar' && styles.right]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { height: '100%' },
  brand: { alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 14 },
  brandText: { fontFamily: FONTS.svSemi, fontSize: 18 },
  scroll: { flex: 1 },
  scrollBody: { paddingHorizontal: 10, paddingBottom: 20, gap: 2 },
  item: { alignItems: 'center', gap: 12, height: 40, paddingHorizontal: 12, borderRadius: 10 },
  itemText: { fontSize: 15, fontWeight: '600' },
  context: { paddingTop: 6, paddingBottom: 10 },
  calendar: { paddingHorizontal: 6, paddingBottom: 6 },
  heading: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  row: { height: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 8 },
  rowText: { fontSize: 14 },
  contents: { paddingTop: 2 },
  contentsNested: { paddingStart: 8, paddingBottom: 4 },
  toc: { alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8 },
  tocMark: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  tocText: { flex: 1, minWidth: 0 },
  tocLabel: { fontSize: 14 },
  tocOn: { fontWeight: '700' },
  tocSub: { fontSize: 12, marginTop: 1 },
  chapters: { flexWrap: 'wrap', gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  chapter: { width: 34, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  chapterText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  foot: { alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footBtn: { alignItems: 'center', gap: 8, height: 36, paddingHorizontal: 8, borderRadius: 8 },
  footText: { fontSize: 14, fontWeight: '600' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
});
