import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../../../../../components/Icon';
import { LargeTitle } from '../../../../../../components/LargeTitle';
import { TopBar } from '../../../../../../components/TopBar';
import { hymnGroups, hymnMatches, normalizeAr, useHymns } from '../../../../../../data';
import { incipit } from '../../../../../../hymns';
import { useSettings } from '../../../../../../settings';
import { FONTS } from '../../../../../../theme';

/** The hymn texts of one occasion, each with its first Coptic line; a search narrows them by title or text. */
export default function HymnGroupPage() {
  const { group } = useLocalSearchParams<{ group: string }>();
  const { t, lang, colors, sidebar } = useSettings();
  const insets = useSafeAreaInsets();
  const g = hymnGroups.find((x) => x.id === group) ?? hymnGroups[0];
  const { data } = useHymns(g.id);
  const [query, setQuery] = useState('');
  const ar = lang === 'ar';

  const shown = useMemo(() => {
    const q = normalizeAr(query.trim());
    if (!data || !q) return data ?? [];
    return data.filter((h) => hymnMatches(h, q));
  }, [data, query]);

  const header = (
    <View>
      <LargeTitle title={ar ? g.ar : g.sv} subtitle={`${t.hymnsCount(g.count)} · ${t.hymnsLangs.toLowerCase()}`} />
      <View style={[styles.search, { backgroundColor: colors.surface, flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <Icon name="search" size={18} color={colors.label2} />
        <TextInput value={query} onChangeText={setQuery} placeholder={t.search} placeholderTextColor={colors.label3}
          style={[styles.input, { color: colors.label }, ar && styles.right]} returnKeyType="search" clearButtonMode="while-editing" />
      </View>
      {!data && <ActivityIndicator color={colors.crimson} style={styles.spin} />}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={sidebar ? undefined : t.alhan} />
      <FlatList
        data={shown}
        keyExtractor={(h, i) => `${h.id}:${i}`}
        ListHeaderComponent={header}
        keyboardDismissMode="on-drag"
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}
        renderItem={({ item: h, index }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/prayers/alhan/g/${g.id}/${h.id}`)}
            style={({ pressed }) => [styles.item, { backgroundColor: colors.surface, flexDirection: ar ? 'row-reverse' : 'row' },
              index === 0 && styles.firstItem, index === shown.length - 1 && styles.lastItem,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.sep }, pressed && { backgroundColor: colors.bg2 }]}>
            <View style={styles.text}>
              <View style={styles.titleRow}>
                {h.units.some((u) => u.ca) && <View style={[styles.tag, { backgroundColor: colors.tint }]}><Text style={[styles.tagText, { color: colors.crimson }]}>قبطي معرّب</Text></View>}
                <Text style={[styles.title, { color: colors.label }]}>{h.ar}</Text>
              </View>
              {incipit(h) ? <Text numberOfLines={1} style={[styles.incipit, { color: h.units.some((u) => u.ca) ? colors.crimson : colors.label2 }]}>{incipit(h)}</Text> : null}
            </View>
            <View style={ar && styles.flip}><Icon name="chevR" size={16} color={colors.label3} strokeWidth={2.2} /></View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  search: { alignItems: 'center', gap: 8, height: 44, borderRadius: 12, paddingHorizontal: 12, marginBottom: 14 },
  input: { flex: 1, fontSize: 16, height: 44 },
  spin: { marginTop: 24 },
  item: { alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 14, minHeight: 56 },
  firstItem: { borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  lastItem: { borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
  text: { flex: 1, minWidth: 0 },
  // The titles are Arabic in either language of the app.
  title: { fontFamily: FONTS.arBold, fontSize: 17, lineHeight: 28, textAlign: 'right', writingDirection: 'rtl' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  tagText: { fontFamily: FONTS.arBold, fontSize: 12, lineHeight: 20 },
  incipit: { fontFamily: FONTS.ar, fontSize: 15, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
});
