import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '../../../components/Glass';
import { Icon } from '../../../components/Icon';
import { TopBar } from '../../../components/TopBar';
import { bibleIndex, books, normalizeSv, searchBible, type SearchResult } from '../../../data';
import { toArDigits } from '../../../lib/coptic';
import { useSettings } from '../../../settings';
import { FONTS } from '../../../theme';

/** Split Swedish text around matches so they can be highlighted. */
function highlight(text: string, terms: string[]) {
  if (!terms.length) return [{ s: text, hit: false }];
  const low = normalizeSv(text);
  const marks: [number, number][] = [];
  for (const term of terms) {
    let i = low.indexOf(term);
    while (i >= 0) { marks.push([i, i + term.length]); i = low.indexOf(term, i + term.length); }
  }
  marks.sort((a, b) => a[0] - b[0]);
  const out: { s: string; hit: boolean }[] = [];
  let at = 0;
  for (const [a, b] of marks) {
    if (a < at) continue;
    if (a > at) out.push({ s: text.slice(at, a), hit: false });
    out.push({ s: text.slice(a, b), hit: true });
    at = b;
  }
  if (at < text.length) out.push({ s: text.slice(at), hit: false });
  return out;
}

export default function Search() {
  const { t, lang, colors } = useSettings();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [progress, setProgress] = useState<number | null>(0);
  const [found, setFound] = useState<{ q: string; r: SearchResult } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ar = lang === 'ar';

  // Load the whole Bible once, in the background, as soon as search opens.
  useEffect(() => {
    bibleIndex((done, total) => setProgress(done / total)).then(() => setProgress(null), () => setProgress(null));
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) return;
    timer.current = setTimeout(() => { searchBible(q).then((r) => setFound({ q, r })); }, 220);
  }, [q]);
  const result = q.trim().length >= 2 && found?.q === q ? found.r : null;

  const name = (bid: number) => {
    const b = books.find((x) => x.bid === bid);
    return b ? (ar ? b.ar : b.sv) : '';
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={t.bible} />
      <View style={[styles.top, { paddingTop: insets.top + 60 }]}>
        <Glass style={styles.field}>
          <View style={[styles.fieldInner, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
            <Icon name="search" size={20} color={colors.label2} />
            <TextInput
              value={q}
              onChangeText={setQ}
              autoFocus
              placeholder={t.searchBible}
              placeholderTextColor={colors.label3}
              returnKeyType="search"
              autoCorrect={false}
              style={[styles.input, { color: colors.label, textAlign: ar ? 'right' : 'left' }]}
              accessibilityLabel={t.searchBible}
            />
          </View>
        </Glass>
        <Text style={[styles.hint, { color: colors.label2 }, ar && styles.right]}>
          {progress !== null ? `${t.searchLoading} ${Math.round(progress * 100)} %` : result ? t.hits(result.hits.length, result.more) : t.searchHint}
        </Text>
      </View>
      {progress !== null && q.trim().length >= 2 && <ActivityIndicator color={colors.crimson} />}
      <FlatList
        data={result?.hits ?? []}
        keyExtractor={(h) => `${h.bid}-${h.c}-${h.v}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 130 }}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/bible/${item.bid}/${item.c}?verse=${item.v}`)}
            style={({ pressed }) => [styles.hit, { backgroundColor: pressed ? colors.bg2 : colors.surface }]}>
            <Text style={[styles.ref, { color: colors.crimson }, ar && styles.right]}>
              {name(item.bid)} {ar ? toArDigits(`${item.c}:${item.v}`) : `${item.c}:${item.v}`}
            </Text>
            {result?.arabic
              ? <Text style={[styles.arText, { color: colors.label }]}>{item.ar}</Text>
              : <Text style={[styles.svText, { color: colors.label }]}>
                  {highlight(item.sv, result?.terms ?? []).map((p, i) => (
                    <Text key={i} style={p.hit ? { backgroundColor: colors.tint, color: colors.crimson, fontFamily: FONTS.svSemi } : null}>{p.s}</Text>
                  ))}
                </Text>}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { paddingHorizontal: 16, paddingBottom: 8 },
  field: { borderRadius: 999, height: 48 },
  fieldInner: { height: 48, alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  input: { flex: 1, fontSize: 17, height: 48 },
  hint: { fontSize: 13, marginTop: 10, marginHorizontal: 4 },
  hit: { borderRadius: 18, padding: 14, marginTop: 8 },
  ref: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  arText: { fontFamily: FONTS.ar, fontSize: 19, lineHeight: 36, textAlign: 'right', writingDirection: 'rtl' },
  svText: { fontFamily: FONTS.sv, fontSize: 16, lineHeight: 24 },
  right: { textAlign: 'right', writingDirection: 'rtl' },
});
