import { Fragment } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { itemAt, itemsOf, usePlace } from '../alhan';
import { toArDigits } from '../lib/coptic';
import type { AlhanBook } from '../lib/types';
import { useSettings } from '../settings';
import { FONTS } from '../theme';
import { Icon } from './Icon';

/**
 * A hymn book's contents as grouped lists, one per part of the book, with the
 * page each item starts on. `current` marks the item being read.
 */
export function AlhanContents({ book, current, onOpen }: { book: AlhanBook; current?: number; onOpen: (page: number) => void }) {
  const { colors, lang } = useSettings();
  const ar = lang === 'ar';
  const row = ar ? ('row-reverse' as const) : ('row' as const);
  let n = -1;
  return (
    <View>
      {book.parts.map((part, pi) => (
        <Fragment key={pi}>
          <Text style={[styles.part, { color: colors.crimson }, ar && styles.partAr]}>{ar ? part.ar : part.sv}</Text>
          <View style={[styles.group, { backgroundColor: colors.surface }]}>
            {part.items.map((it, i) => {
              const k = ++n;
              const on = k === current;
              const no = book.pages[it.page].no;
              return (
                <Pressable key={i} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onOpen(it.page)}
                  style={({ pressed }) => [styles.item, { flexDirection: row }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.sep }, pressed && { backgroundColor: colors.bg2 }]}>
                  <View style={[styles.mark, { backgroundColor: on ? colors.crimson : 'transparent' }]} />
                  <View style={styles.text}>
                    <Text style={[styles.name, { color: on ? colors.crimson : colors.label }, ar && styles.right]}>{ar ? it.ar : it.sv}</Text>
                    <Text style={[ar ? styles.secondSv : styles.secondAr, { color: colors.label2 }, ar ? styles.right : styles.left]}>{ar ? it.sv : it.ar}</Text>
                  </View>
                  <Text style={[styles.no, { color: colors.label3 }]}>{ar ? toArDigits(no) : no}</Text>
                </Pressable>
              );
            })}
          </View>
        </Fragment>
      ))}
    </View>
  );
}

const COVER_W = 92;

/** The book's card: its cover, its names, who published it, and the way in, at the page last read. */
export function AlhanBookCard({ book, onOpen }: { book: AlhanBook; onOpen: (page: number) => void }) {
  const { t, colors, lang } = useSettings();
  const ar = lang === 'ar';
  const place = usePlace(book.id);
  const items = itemsOf(book);
  const at = place != null ? itemAt(items, place) : -1;
  const row = ar ? ('row-reverse' as const) : ('row' as const);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={[styles.cardTop, { flexDirection: row }]}>
        <Image source={book.cover.src} style={[styles.cover, { height: Math.round((COVER_W * book.cover.h) / book.cover.w) }]} resizeMode="cover" accessibilityIgnoresInvertColors />
        <View style={styles.text}>
          <Text style={[styles.title, { color: colors.label }, ar && styles.right]}>{ar ? book.ar : book.sv}</Text>
          <Text style={[ar ? styles.secondSv : styles.secondAr, { color: colors.label2 }, ar ? styles.right : styles.left]}>{ar ? book.sv : book.ar}</Text>
          <Text style={[styles.sub, { color: colors.crimson }, ar && styles.right]}>{ar ? book.subAr : book.subSv}</Text>
          {/* The publisher's name is Arabic: on a line of its own, so it is not mixed into a Swedish sentence. */}
          <Text style={[styles.source, { color: colors.label3 }, ar && styles.right]}>{t.alhanSource}</Text>
          <Text style={[styles.sourceName, { color: colors.label2 }]}>{book.source}</Text>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => onOpen(place ?? 0)}
        style={({ pressed }) => [styles.open, { backgroundColor: colors.crimson, flexDirection: row }, pressed && styles.dim]}>
        <Icon name="book" size={18} color="#FFFFFF" strokeWidth={2} />
        <Text numberOfLines={1} style={styles.openText}>
          {place != null ? `${t.continueReading} · ${at >= 0 ? (ar ? items[at].ar : items[at].sv) : t.pageShort(book.pages[place].no)}` : t.openBook}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  part: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 22, marginBottom: 8, marginHorizontal: 4 },
  partAr: { textAlign: 'right', letterSpacing: 0, textTransform: 'none', fontSize: 14 },
  group: { borderRadius: 18, overflow: 'hidden' },
  item: { alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, minHeight: 56 },
  mark: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '600' },
  secondAr: { fontFamily: FONTS.ar, fontSize: 15, lineHeight: 24 },
  secondSv: { fontSize: 13.5, lineHeight: 20, marginTop: 2 },
  no: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 28, textAlign: 'center' },
  card: { borderRadius: 24, padding: 16, gap: 16 },
  cardTop: { gap: 16, alignItems: 'flex-start' },
  cover: { width: COVER_W, borderRadius: 8, boxShadow: '0 6px 18px -6px rgba(40,10,20,0.45)' },
  title: { fontFamily: FONTS.svSemi, fontSize: 21, lineHeight: 27 },
  sub: { fontSize: 13.5, fontWeight: '600', marginTop: 6 },
  source: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  sourceName: { fontFamily: FONTS.ar, fontSize: 13, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl' },
  open: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  openText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  dim: { opacity: 0.7 },
  left: { textAlign: 'left' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
});
