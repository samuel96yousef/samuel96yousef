import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlhanBookCard } from '../../../../components/AlhanContents';
import { Icon } from '../../../../components/Icon';
import { LargeTitle } from '../../../../components/LargeTitle';
import { TopBar } from '../../../../components/TopBar';
import { alhanBooks, hymnGroups } from '../../../../data';
import { hymnGroupFor } from '../../../../hymns';
import type { HymnGroup } from '../../../../lib/types';
import { useSettings } from '../../../../settings';
import { FONTS } from '../../../../theme';

/**
 * The hymns: the books written with hazzat, page for page, and the hymn texts
 * by occasion, from the annual ones to each feast. The occasion of the day is
 * first and marked.
 */
export default function Alhan() {
  const { t, lang, colors, sidebar } = useSettings();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const now = hymnGroupFor(new Date());
  // The day's occasion first, then the book's order.
  const groups = [...hymnGroups].sort((a, b) => Number(b.id === now) - Number(a.id === now));
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={sidebar ? undefined : t.prayers} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}>
        <LargeTitle title={t.alhan} subtitle={t.alhanSub} />

        <Label>{t.hazzatBooks}</Label>
        {alhanBooks.map((b) => (
          <AlhanBookCard key={b.id} book={b}
            onOpen={(p) => router.push(`/prayers/alhan/${b.id}?p=${p}`)}
            onContents={(p) => router.push(`/prayers/alhan/${b.id}?p=${p}&toc=1`)} />
        ))}

        <Label>{t.hymnsByOccasion}</Label>
        <Text style={[styles.langs, { color: colors.label2 }, ar && styles.right]}>{t.hymnsLangs}</Text>
        <View style={[styles.group, { backgroundColor: colors.surface }]}>
          {groups.map((g, i) => <GroupRow key={g.id} g={g} first={i === 0} now={g.id === now} />)}
        </View>
        <Text style={[styles.hint, { color: colors.label3 }, ar && styles.right]}>{t.hymnsSource}</Text>
        <Text style={[styles.hint, { color: colors.label3 }, ar && styles.right]}>{t.alhanHint}</Text>
      </ScrollView>
    </View>
  );
}

function Label({ children }: { children: string }) {
  const { colors, lang } = useSettings();
  return <Text style={[styles.label, { color: colors.crimson }, lang === 'ar' && styles.labelAr]}>{children}</Text>;
}

function GroupRow({ g, first, now }: { g: HymnGroup; first: boolean; now: boolean }) {
  const { t, colors, lang } = useSettings();
  const ar = lang === 'ar';
  const row = ar ? ('row-reverse' as const) : ('row' as const);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${ar ? g.ar : g.sv}, ${t.hymnsCount(g.count)}`} onPress={() => router.push(`/prayers/alhan/g/${g.id}`)}
      style={({ pressed }) => [styles.item, { flexDirection: row }, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.sep }, pressed && { backgroundColor: colors.bg2 }]}>
      <View style={styles.text}>
        <View style={[styles.nameRow, { flexDirection: row }]}>
          <Text style={[styles.name, { color: colors.label }, ar && styles.right]}>{ar ? g.ar : g.sv}</Text>
          {now && <View style={[styles.now, { backgroundColor: colors.crimson }]}><Text style={styles.nowText}>{t.inSeason}</Text></View>}
        </View>
        <Text style={[ar ? styles.secondSv : styles.secondAr, { color: colors.label2 }, ar ? styles.right : styles.left]}>{ar ? g.sv : g.ar}</Text>
      </View>
      <Text style={[styles.count, { color: colors.label3 }]}>{t.hymnsCount(g.count)}</Text>
      <View style={ar && styles.flip}><Icon name="chevR" size={16} color={colors.label3} strokeWidth={2.2} /></View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 18, marginBottom: 8, marginHorizontal: 4 },
  labelAr: { textAlign: 'right', letterSpacing: 0, textTransform: 'none', fontSize: 14 },
  langs: { fontSize: 13, marginTop: -4, marginBottom: 8, marginHorizontal: 4 },
  group: { borderRadius: 18, overflow: 'hidden' },
  item: { alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, minHeight: 58 },
  text: { flex: 1, minWidth: 0 },
  nameRow: { alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  now: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  nowText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  secondAr: { fontFamily: FONTS.ar, fontSize: 15, lineHeight: 24 },
  secondSv: { fontSize: 13.5, lineHeight: 20, marginTop: 2 },
  count: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 16, marginHorizontal: 4 },
  left: { textAlign: 'left' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
});
