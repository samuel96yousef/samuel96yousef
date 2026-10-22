/**
 * A Bible book as the contents page of a printed Katameros: the name in a
 * cartouche on the framed page, "continue reading", and every chapter with
 * its medallion, the opening of its first verse and its length.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { Cartouche } from '../../../../components/Cartouche';
import { Icon } from '../../../../components/Icon';
import { PageBody, PageBottom, PageTop } from '../../../../components/Page';
import { TopBar } from '../../../../components/TopBar';
import { books, loadBook, useAsync } from '../../../../data';
import { useLastRead } from '../../../../lastRead';
import { toArDigits } from '../../../../lib/coptic';
import { useSettings } from '../../../../settings';
import { FONTS } from '../../../../theme';

/** Books longer than this also get a strip of chapter numbers for quick jumps. */
const STRIP_FROM = 24;

export default function Book() {
  const { book } = useLocalSearchParams<{ book: string }>();
  const { t, lang, primary, colors, page } = useSettings();
  const insets = useSafeAreaInsets();
  const b = books.find((x) => x.bid === Number(book)) ?? books[0];
  const ar = lang === 'ar';
  const { data } = useAsync(() => loadBook(b.bid), [b.bid]);
  const last = useLastRead(b.bid);
  const num = useCallback((n: number) => (ar ? toArDigits(n) : String(n)), [ar]);
  const chapters = useMemo(() => Array.from({ length: b.chapters }, (_, i) => i + 1), [b.chapters]);
  // The opening of each chapter, in the language being read, and its length.
  const openings = useMemo(
    () => new Map((data ?? []).map(([c, vs]) => [c, { count: vs.length, text: (primary === 'ar' ? vs[0]?.[1] : vs[0]?.[2]) ?? '' }])),
    [data, primary],
  );
  const open = useCallback((c: number) => router.push(`/bible/${b.bid}/${c}`), [b.bid]);
  // The Psalms are psalms, not chapters.
  const psalter = b.sv === 'Psaltaren';
  const name = psalter ? t.psalm : t.chapter;
  const dir = { flexDirection: ar ? 'row-reverse' : 'row' } as const;

  const header = (
    <View>
      <PageTop />
      <PageBody style={styles.head}>
        <Text style={[styles.running, { color: page.rule }]}>{b.nt ? t.nt : t.ot} · {(psalter ? t.psalms : t.chapters)(b.chapters)}</Text>
        <Cartouche>
          {ar ? (
            <>
              <Text style={[styles.titleAr, { color: page.ink }]}>{b.ar}</Text>
              <Text style={[styles.subSv, { color: page.ink2 }]}>{b.sv}</Text>
            </>
          ) : (
            <>
              <Text style={[styles.titleSv, { color: page.ink }]}>{b.sv}</Text>
              <Text style={[styles.subAr, { color: page.ink2 }]}>{b.ar}</Text>
            </>
          )}
        </Cartouche>
        {last ? (
          <Pressable accessibilityRole="button" onPress={() => open(last)}
            style={({ pressed }) => [styles.continue, dir, { backgroundColor: colors.crimson }, pressed && styles.pressed]}>
            <Icon name="book" size={18} color="#FFFFFF" />
            <Text numberOfLines={1} style={styles.continueText}>{t.continueReading} · {name(last)}</Text>
            <View style={ar && styles.flip}><Icon name="chevR" size={16} color="#FFFFFF" strokeWidth={2.4} /></View>
          </Pressable>
        ) : null}
        {b.chapters > STRIP_FROM && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.strip} contentContainerStyle={[styles.stripRow, dir]}>
            {chapters.map((n) => (
              <Pressable key={n} accessibilityRole="button" accessibilityLabel={name(n)} onPress={() => open(n)}
                style={({ pressed }) => [styles.stripCell, { borderColor: n === last ? page.rule : page.rule2 }, (pressed || n === last) && { backgroundColor: page.peek }]}>
                <Text style={[styles.stripNum, { color: n === last ? page.rule : page.ink }]}>{num(n)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <Dots color={page.ink2} />
      </PageBody>
    </View>
  );

  const renderItem = ({ item: n }: { item: number }) => {
    const o = openings.get(n);
    const here = n === last;
    return (
      <PageBody>
        <Pressable accessibilityRole="button" accessibilityLabel={`${name(n)}${here ? `, ${t.lastRead}` : ''}${o?.text ? `. ${o.text}` : ''}`}
          onPress={() => open(n)} style={({ pressed }) => [styles.row, dir, (pressed || here) && { backgroundColor: page.peek }]}>
          <Medallion n={num(n)} />
          <View style={styles.rowText}>
            <View style={[styles.rowHead, dir]}>
              <Text style={[styles.label, ar && styles.labelAr, { color: page.rule }]}>{name(n)}</Text>
              {here && <Text style={[styles.here, { color: page.rule, borderColor: page.rule }]}>{t.lastRead}</Text>}
            </View>
            <Text numberOfLines={2} style={[primary === 'ar' ? styles.openingAr : styles.opening, { color: page.ink }]}>{o?.text || ' '}</Text>
          </View>
          {o ? <Text style={[styles.count, { color: page.ink2 }]}>{t.versesShort(o.count)}</Text> : null}
        </Pressable>
        <Dots color={page.ink2} />
      </PageBody>
    );
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={t.bible} />
      <FlatList
        data={chapters}
        keyExtractor={String}
        renderItem={renderItem}
        extraData={[openings, last, primary, lang, page, name]}
        ListHeaderComponent={header}
        ListFooterComponent={<PageBottom />}
        initialNumToRender={12}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}
      />
    </View>
  );
}

/** The chapter number in a double crimson ring, like the medallions on the Katameros title page. */
function Medallion({ n }: { n: string }) {
  const { page } = useSettings();
  return (
    <View style={[styles.med, { borderColor: page.rule }]}>
      <View style={[styles.medIn, { borderColor: page.rule2 }]}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.medNum, { color: page.rule }]}>{n}</Text>
      </View>
    </View>
  );
}

function Dots({ color }: { color: string }) {
  return (
    <Svg height={4} width="100%" style={styles.dots}>
      <Line x1="2" y1="2" x2="100%" y2="2" stroke={color} strokeOpacity={0.5} strokeWidth={1.6} strokeDasharray="0.1 5" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { maxWidth: 820, width: '100%', alignSelf: 'center' },
  head: { paddingTop: 4, paddingBottom: 6 },
  running: { fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase', textAlign: 'center', marginBottom: 6 },
  titleSv: { fontFamily: FONTS.svSemi, fontSize: 21, lineHeight: 28, textAlign: 'center' },
  titleAr: { fontFamily: FONTS.arBold, fontSize: 24, lineHeight: 38, textAlign: 'center', writingDirection: 'rtl' },
  subSv: { fontFamily: FONTS.sv, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  subAr: { fontFamily: FONTS.ar, fontSize: 18, lineHeight: 30, textAlign: 'center', writingDirection: 'rtl' },
  continue: { alignSelf: 'center', alignItems: 'center', gap: 8, height: 44, borderRadius: 22, paddingHorizontal: 18, marginTop: 14, maxWidth: '100%' },
  continueText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', flexShrink: 1 },
  strip: { marginTop: 14, marginHorizontal: -6 },
  stripRow: { gap: 6, paddingHorizontal: 6 },
  stripCell: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stripNum: { fontFamily: FONTS.svSemi, fontSize: 14, fontVariant: ['tabular-nums'] },
  dots: { marginTop: 14 },
  row: { alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowHead: { alignItems: 'center', gap: 8 },
  label: { fontSize: 11.5, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  labelAr: { fontFamily: FONTS.arBold, fontWeight: undefined, letterSpacing: 0, textTransform: 'none', fontSize: 15, writingDirection: 'rtl' },
  here: { fontSize: 10, fontWeight: '700', borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, overflow: 'hidden' },
  opening: { fontFamily: FONTS.sv, fontSize: 15, lineHeight: 22 },
  openingAr: { fontFamily: FONTS.ar, fontSize: 18, lineHeight: 29, textAlign: 'right', writingDirection: 'rtl' },
  count: { fontSize: 12, fontVariant: ['tabular-nums'] },
  med: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.2, padding: 2.5 },
  medIn: { flex: 1, borderRadius: 20, borderWidth: 0.75, alignItems: 'center', justifyContent: 'center' },
  medNum: { fontFamily: FONTS.svSemi, fontSize: 16, fontVariant: ['tabular-nums'] },
  pressed: { transform: [{ scale: 0.97 }] },
  flip: { transform: [{ scaleX: -1 }] },
});
