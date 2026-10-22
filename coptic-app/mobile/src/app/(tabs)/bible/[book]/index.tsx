import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LargeTitle } from '../../../../components/LargeTitle';
import { TopBar } from '../../../../components/TopBar';
import { books } from '../../../../data';
import { toArDigits } from '../../../../lib/coptic';
import { useSettings } from '../../../../settings';

export default function Book() {
  const { book } = useLocalSearchParams<{ book: string }>();
  const { t, lang, colors } = useSettings();
  const insets = useSafeAreaInsets();
  const b = books.find((x) => x.bid === Number(book)) ?? books[0];
  const ar = lang === 'ar';
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={t.bible} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}>
        <LargeTitle title={ar ? b.ar : b.sv} subtitle={ar ? b.sv : b.ar} />
        <View style={[styles.grid, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          {Array.from({ length: b.chapters }, (_, i) => i + 1).map((n) => (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel={t.chapter(n)} onPress={() => router.push(`/bible/${b.bid}/${n}`)}
              style={({ pressed }) => [styles.cell, { backgroundColor: pressed ? colors.bg2 : colors.surface }]}>
              <Text style={[styles.num, { color: colors.label }]}>{ar ? toArDigits(n) : n}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 820, width: '100%', alignSelf: 'center' },
  grid: { flexWrap: 'wrap', gap: 10 },
  cell: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
