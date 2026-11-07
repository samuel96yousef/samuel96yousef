import { useLocalSearchParams } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { alhanOutline, itemAt, itemsOf, markPlace } from '../../../../alhan';
import { useBackLabel } from '../../../../backLabel';
import { AlhanContents } from '../../../../components/AlhanContents';
import { Glass } from '../../../../components/Glass';
import { Icon } from '../../../../components/Icon';
import { TopBar } from '../../../../components/TopBar';
import { createWayStore } from '../../../../components/Wayfinder';
import { alhanBooks } from '../../../../data';
import { toArDigits } from '../../../../lib/coptic';
import type { AlhanBook } from '../../../../lib/types';
import { publishReader } from '../../../../readerHub';
import { useSettings } from '../../../../settings';
import { FONTS } from '../../../../theme';

/** The page number under each page, and the space it takes. */
const LABEL = 40;
/** How far below the top bar the reading line is: the page crossing it is the one being read. */
const READ_LINE = 120;

/**
 * A hymn book, page after page as printed, so that the hazzat stand exactly
 * where the book has them. Each page is an ink mask, tinted with the reading
 * colours. Every page's height is known from its image, so the list knows
 * where each one is before it is drawn: jumps land exactly, and nothing moves
 * while scrolling.
 */
export default function AlhanReader() {
  const { book: id, p, toc } = useLocalSearchParams<{ book: string; p?: string; toc?: string }>();
  const book = alhanBooks.find((b) => b.id === id);
  if (!book) return null;
  // `toc`: opened for its contents, which then lie over the page.
  return <Pages key={book.id} book={book} start={Math.min(Math.max(0, Number(p) || 0), book.pages.length - 1)} contents={toc === '1'} />;
}

function Pages({ book, start, contents }: { book: AlhanBook; start: number; contents: boolean }) {
  const { t, lang, colors, page: palette, sidebar, contentWidth } = useSettings();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const back = useBackLabel(t);
  const ar = lang === 'ar';
  const list = useRef<FlatList<number>>(null);
  const [current, setCurrent] = useState(start);
  const [sheet, setSheet] = useState(contents);
  const items = useMemo(() => itemsOf(book), [book]);
  const at = itemAt(items, current);

  // A page is as wide as the screen allows, up to a readable width; its height follows from its image.
  const width = Math.min(contentWidth - 24, 760);
  const { lengths, offsets } = useMemo(() => {
    const lengths = book.pages.map((pg) => Math.round((width * pg.h) / pg.w) + LABEL);
    const offsets: number[] = [];
    lengths.reduce((sum, l, i) => ((offsets[i] = sum), sum + l), 0);
    return { lengths, offsets };
  }, [book, width]);
  const data = useMemo(() => book.pages.map((_, i) => i), [book]);
  // Offsets leave out the space above the first page: scrolling to a page puts it just under the top bar.
  const getItemLayout = useCallback((_: unknown, i: number) => ({ length: lengths[i], offset: offsets[i], index: i }), [lengths, offsets]);

  const goTo = useCallback((i: number) => {
    list.current?.scrollToOffset({ offset: offsets[i], animated: false });
    setCurrent(i);
  }, [offsets]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const line = e.nativeEvent.contentOffset.y + READ_LINE;
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (offsets[mid] <= line) lo = mid; else hi = mid - 1;
    }
    setCurrent(lo);
  }, [offsets]);

  useEffect(() => { markPlace(book.id, current); }, [book.id, current]);

  // On a large screen the sidebar shows the contents, with the item being read marked.
  const [way] = useState(createWayStore);
  useEffect(() => { way.set({ current: at }); }, [way, at]);
  const outline = useMemo(() => alhanOutline(book), [book]);
  useEffect(() => {
    if (sidebar) return publishReader({ outline, store: way, jump: (i) => goTo(i) });
  }, [sidebar, outline, way, goTo]);

  const renderItem = useCallback(({ item: i }: { item: number }) => (
    <PageView src={book.pages[i].src} no={book.pages[i].no} width={width} height={lengths[i] - LABEL} ar={ar} ink={palette.ink} paper={palette.page} label={colors.label3} />
  ), [book, width, lengths, ar, palette.ink, palette.page, colors.label3]);

  const title = at >= 0 ? (ar ? items[at].ar : items[at].sv) : (ar ? book.ar : book.sv);
  const no = book.pages[current].no;

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <FlatList
        ref={list}
        data={data}
        keyExtractor={(i) => String(i)}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialScrollIndex={start}
        initialNumToRender={3}
        windowSize={7}
        onScroll={onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingTop: insets.top + 64, paddingBottom: Math.max(insets.bottom + 120, height * 0.5), alignItems: 'center' }}
        accessibilityLabel={ar ? book.ar : book.sv}
      />
      <TopBar back={sidebar ? undefined : back} compact={!sidebar}
        center={
          <Pressable accessibilityRole="button" accessibilityLabel={`${t.contents}: ${title}, ${t.page(no)}`} onPress={() => setSheet(true)} style={({ pressed }) => pressed && styles.pressed}>
            <Glass style={styles.pill} interactive>
              <View style={[styles.pillInner, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
                <View style={styles.pillText}>
                  <Text numberOfLines={1} style={[styles.pillTitle, { color: colors.label }, ar && styles.right]}>{title}</Text>
                  <Text numberOfLines={1} style={[styles.pillSub, { color: colors.label2 }, ar && styles.right]}>{t.page(no)}</Text>
                </View>
                <Icon name="list" size={20} color={colors.label} strokeWidth={2} />
              </View>
            </Glass>
          </Pressable>
        } />
      <ContentsSheet book={book} visible={sheet} current={at} onClose={() => setSheet(false)} onOpen={(i) => { setSheet(false); goTo(i); }} />
    </View>
  );
}

const PageView = memo(function PageView({ src, no, width, height, ar, ink, paper, label }: {
  src: number; no: number; width: number; height: number; ar: boolean; ink: string; paper: string; label: string;
}) {
  return (
    <View style={{ width, height: height + LABEL }}>
      <View style={[styles.page, { width, height, backgroundColor: paper }]}>
        <Image source={src} style={{ width, height, tintColor: ink }} resizeMode="stretch" accessibilityIgnoresInvertColors />
      </View>
      <Text style={[styles.no, { color: label }]}>{ar ? toArDigits(no) : no}</Text>
    </View>
  );
});

/** The contents over the page: a sheet from the bottom on a phone, a card in the middle on a large screen. */
function ContentsSheet({ book, visible, current, onClose, onOpen }: { book: AlhanBook; visible: boolean; current: number; onClose: () => void; onOpen: (page: number) => void }) {
  const { t, colors, lang } = useSettings();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= 600;
  const ar = lang === 'ar';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.wrap, wide && styles.wrapWide]}>
        <Pressable style={[StyleSheet.absoluteFill, styles.scrim]} onPress={onClose} accessibilityLabel={t.close} />
        <View style={[styles.card, { backgroundColor: colors.bg, maxHeight: height - insets.top - 40 },
          wide ? { width: 520, borderRadius: 28 } : { alignSelf: 'stretch', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: insets.bottom + 8 }]}>
          <View style={[styles.head, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
            <Text accessibilityRole="header" numberOfLines={1} style={[styles.headTitle, { color: colors.label }, ar && styles.right]}>{t.contents}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose} hitSlop={8}
              style={({ pressed }) => [styles.close, { backgroundColor: colors.surface }, pressed && styles.dim]}>
              <Icon name="x" size={16} color={colors.label} strokeWidth={2.4} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody}>
            <AlhanContents book={book} current={current} onOpen={onOpen} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 8px 24px -12px rgba(40,10,20,0.25)' },
  no: { height: LABEL, lineHeight: LABEL, textAlign: 'center', fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  pill: { borderRadius: 22, height: 44, width: '100%', maxWidth: 520, alignSelf: 'center' },
  pillInner: { height: 44, alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  pillText: { flex: 1, minWidth: 0 },
  pillTitle: { fontSize: 15, fontWeight: '700' },
  pillSub: { fontSize: 12, fontWeight: '500' },
  pressed: { transform: [{ scale: 0.97 }] },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  wrapWide: { justifyContent: 'center', alignItems: 'center' },
  scrim: { backgroundColor: 'rgba(10,6,8,0.38)' },
  card: { paddingTop: 16, paddingHorizontal: 16 },
  head: { alignItems: 'center', gap: 10, marginBottom: 2 },
  headTitle: { flex: 1, fontFamily: FONTS.svSemi, fontSize: 22 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetBody: { paddingBottom: 16 },
  dim: { opacity: 0.6 },
  right: { textAlign: 'right', writingDirection: 'rtl' },
});
