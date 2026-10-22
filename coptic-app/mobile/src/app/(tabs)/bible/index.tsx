import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '../../../components/Glass';
import { Icon } from '../../../components/Icon';
import { LargeTitle } from '../../../components/LargeTitle';
import { Segmented } from '../../../components/Segmented';
import { BarButton, TopBar } from '../../../components/TopBar';
import { books } from '../../../data';
import { useSettings } from '../../../settings';
import { FONTS } from '../../../theme';

export default function Bible() {
  const { t, lang, colors } = useSettings();
  const insets = useSafeAreaInsets();
  const [nt, setNt] = useState<'nt' | 'ot'>('nt');
  const ar = lang === 'ar';
  const list = books.filter((b) => b.nt === (nt === 'nt'));

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar><BarButton icon="gear" label={t.settings} onPress={() => router.push('/settings')} /></TopBar>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}>
        <LargeTitle title={t.bible} />
        <Pressable accessibilityRole="search" onPress={() => router.push('/bible/search')} style={({ pressed }) => [styles.searchWrap, pressed && styles.pressed]}>
          <Glass style={styles.search} interactive>
            <View style={[styles.searchInner, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
              <Icon name="search" size={20} color={colors.label2} />
              <Text style={[styles.searchText, { color: colors.label2 }]}>{t.searchBible}</Text>
            </View>
          </Glass>
        </Pressable>
        <Segmented label={t.bible} value={nt} onChange={setNt} options={[{ value: 'nt', label: t.nt }, { value: 'ot', label: t.ot }]} />
        <View style={[styles.list, { backgroundColor: colors.surface }]}>
          {list.map((b, i) => (
            <Pressable key={b.bid} accessibilityRole="button" onPress={() => router.push(`/bible/${b.bid}`)}
              style={({ pressed }) => [styles.row, { flexDirection: ar ? 'row-reverse' : 'row' }, pressed && { backgroundColor: colors.bg2 },
                i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.sep }]}>
              <View style={styles.rowText}>
                <Text style={[styles.title, { color: colors.label }, ar && styles.right]}>{ar ? b.ar : b.sv}</Text>
                <Text style={[styles.sub, { color: colors.label2 }, ar ? null : styles.right]}>{ar ? b.sv : b.ar}</Text>
              </View>
              <Text style={[styles.meta, { color: colors.label3 }]}>{t.chapters(b.chapters)}</Text>
              <View style={ar && styles.flip}><Icon name="chevR" size={16} color={colors.label3} strokeWidth={2.2} /></View>
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
  searchWrap: { marginBottom: 14 },
  search: { borderRadius: 999, height: 46 },
  searchInner: { height: 46, alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  searchText: { fontSize: 16 },
  list: { borderRadius: 24, overflow: 'hidden', marginTop: 14 },
  row: { alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 16 },
  rowText: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '600' },
  sub: { fontFamily: FONTS.ar, fontSize: 15, lineHeight: 24, textAlign: 'left' },
  meta: { fontSize: 13 },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { transform: [{ scale: 0.98 }] },
});
