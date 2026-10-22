import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../../../../components/Icon';
import { LargeTitle } from '../../../../components/LargeTitle';
import { Reader } from '../../../../components/Reader';
import { ReaderActions } from '../../../../components/ReaderActions';
import { TopBar } from '../../../../components/TopBar';
import { books, loadBook, useAsync } from '../../../../data';
import { chapterRows } from '../../../../rows';
import { useSettings } from '../../../../settings';

export default function Chapter() {
  const params = useLocalSearchParams<{ book: string; chapter: string; verse?: string }>();
  const { t, lang, colors } = useSettings();
  const ar = lang === 'ar';
  const b = books.find((x) => x.bid === Number(params.book)) ?? books[0];
  const n = Number(params.chapter) || 1;
  const verse = params.verse ? Number(params.verse) : undefined;
  const { data, loading } = useAsync(() => loadBook(b.bid), [b.bid]);
  const rows = useMemo(() => (data ? chapterRows(b, n, data.find(([c]) => c === n)?.[1] ?? [], verse) : []), [data, b, n, verse]);
  const target = useMemo(() => {
    const i = verse ? rows.findIndex((r) => r.k === 'u' && r.u.n === verse) : -1;
    return i >= 0 ? { index: i, key: i } : null;
  }, [rows, verse]);

  const go = (c: number) => router.replace(`/bible/${b.bid}/${c}`);
  const nav = (
    <View style={[styles.nav, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
      {n > 1 ? <NavButton label={t.prevChapter} dir="prev" onPress={() => go(n - 1)} /> : <View />}
      {n < b.chapters ? <NavButton label={t.nextChapter} dir="next" onPress={() => go(n + 1)} /> : <View />}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={ar ? b.ar : b.sv}><ReaderActions /></TopBar>
      <Reader
        rows={rows}
        scrollTo={target}
        header={<View style={styles.header}><LargeTitle title={`${ar ? b.ar : b.sv} ${n}`} subtitle={t.chapter(n)} />{loading && !data && <ActivityIndicator color={colors.crimson} />}</View>}
        footer={nav}
      />
    </View>
  );
}

function NavButton({ label, dir, onPress }: { label: string; dir: 'prev' | 'next'; onPress: () => void }) {
  const { colors, lang } = useSettings();
  const ar = lang === 'ar';
  const icon = (dir === 'prev') !== ar ? 'chevL' : 'chevR';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.navBtn, { backgroundColor: pressed ? colors.bg2 : colors.surface }]}>
      {dir === 'prev' && <Icon name={icon} size={18} color={colors.crimson} strokeWidth={2.2} />}
      <Text style={[styles.navText, { color: colors.crimson }]}>{label}</Text>
      {dir === 'next' && <Icon name={icon} size={18} color={colors.crimson} strokeWidth={2.2} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { paddingHorizontal: 16 },
  nav: { justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 18 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 14, height: 40 },
  navText: { fontSize: 15, fontWeight: '600' },
});
