import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlhanBookCard, AlhanContents } from '../../../../components/AlhanContents';
import { LargeTitle } from '../../../../components/LargeTitle';
import { TopBar } from '../../../../components/TopBar';
import { alhanBooks } from '../../../../data';
import { useSettings } from '../../../../settings';

const open = (book: string, page: number) => router.push(`/prayers/alhan/${book}?p=${page}`);

/** The hymn books, each with its card and its contents; a tap opens the book at that page. */
export default function Alhan() {
  const { t, lang, colors, sidebar } = useSettings();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={sidebar ? undefined : t.prayers} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}>
        <LargeTitle title={t.alhan} subtitle={t.alhanSub} />
        {alhanBooks.map((b) => (
          <View key={b.id} style={styles.book}>
            <AlhanBookCard book={b} onOpen={(p) => open(b.id, p)} />
            <AlhanContents book={b} onOpen={(p) => open(b.id, p)} />
          </View>
        ))}
        <Text style={[styles.hint, { color: colors.label3 }, lang === 'ar' && styles.right]}>{t.alhanHint}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  book: { marginBottom: 8 },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 20, marginHorizontal: 4 },
  right: { textAlign: 'right', writingDirection: 'rtl' },
});
