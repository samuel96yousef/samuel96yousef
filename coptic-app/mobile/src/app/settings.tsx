import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { Segmented } from '../components/Segmented';
import { useSettings, type Appearance, type Show, type SpreadPref } from '../settings';
import { FONTS, PAGES, type ReadTheme } from '../theme';

const SIZES = [0.85, 0.95, 1, 1.12, 1.25, 1.4, 1.6];

export default function Settings() {
  const s = useSettings();
  const { t, colors, page, lang } = s;
  const ar = lang === 'ar';
  const align = ar ? styles.right : null;
  const sizeIndex = SIZES.reduce((best, v, i) => (Math.abs(v - s.scale) < Math.abs(SIZES[best] - s.scale) ? i : best), 0);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={[styles.head, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <Text accessibilityRole="header" style={[styles.h1, { color: colors.label }]}>{t.settings}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={() => router.back()} style={[styles.close, { backgroundColor: colors.bg2 }]}>
          <Icon name="x" size={18} color={colors.label} strokeWidth={2.2} />
        </Pressable>
      </View>

      <Text style={[styles.label, { color: colors.label2 }, align]}>{t.appLang}</Text>
      <Segmented label={t.appLang} value={s.lang} onChange={s.setLang}
        options={[{ value: 'sv', label: 'Svenska' }, { value: 'ar', label: 'العربية', style: styles.arLabel }]} />

      <Text style={[styles.label, { color: colors.label2 }, align]}>{t.appearance}</Text>
      <Segmented<Appearance> label={t.appearance} value={s.appearance} onChange={(v) => s.set({ appearance: v })}
        options={(['auto', 'light', 'dark'] as const).map((v) => ({ value: v, label: t.appearances[v] }))} />
      <Text style={[styles.help, { color: colors.label2 }, align]}>{t.appearanceHelp}</Text>

      <Text style={[styles.label, { color: colors.label2 }, align]}>{t.showTexts}</Text>
      <Segmented<Show> label={t.showTexts} value={s.show}
        onChange={(v) => s.set(v === 'both' ? { show: 'both' } : { show: v, primary: v })}
        options={[{ value: 'ar', label: 'العربية', style: styles.arLabel }, { value: 'both', label: t.showBoth }, { value: 'sv', label: 'Svenska' }]} />
      <Text style={[styles.help, { color: colors.label2 }, align]}>{t.showTextsHelp}</Text>

      <Text style={[styles.label, { color: colors.label2 }, align]}>{t.textSize}</Text>
      <View style={[styles.sizeRow, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.smaller} disabled={sizeIndex === 0} onPress={() => s.set({ scale: SIZES[sizeIndex - 1] })} style={[styles.sizeBtn, { backgroundColor: colors.surface, opacity: sizeIndex === 0 ? 0.4 : 1 }]}>
          <Text style={[styles.aSmall, { color: colors.label }]}>A</Text>
        </Pressable>
        <View style={[styles.dots, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          {SIZES.map((v, i) => <View key={v} style={[styles.dot, { backgroundColor: i <= sizeIndex ? colors.crimson : colors.bg2 }]} />)}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t.larger} disabled={sizeIndex === SIZES.length - 1} onPress={() => s.set({ scale: SIZES[sizeIndex + 1] })} style={[styles.sizeBtn, { backgroundColor: colors.surface, opacity: sizeIndex === SIZES.length - 1 ? 0.4 : 1 }]}>
          <Text style={[styles.aBig, { color: colors.label }]}>A</Text>
        </Pressable>
      </View>
      <View style={[styles.preview, { backgroundColor: page.page, borderColor: page.rule2 }]}>
        <Text style={{ fontFamily: FONTS.ar, fontSize: 23 * s.scale, lineHeight: 23 * s.scale * 1.9, color: page.ink, textAlign: 'right', writingDirection: 'rtl' }}>سبحوا الرب تسبيحاً جديداً</Text>
        <Text style={{ fontFamily: FONTS.sv, fontSize: 17 * s.scale, lineHeight: 17 * s.scale * 1.5, color: page.ink }}>Sjung för Herren en ny sång</Text>
      </View>

      <Text style={[styles.label, { color: colors.label2 }, align]}>{t.readTheme}</Text>
      <View style={[styles.swatches, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        {(['auto', 'paper', 'sepia', 'night'] as ReadTheme[]).map((v) => {
          const p = v === 'auto' ? null : PAGES[v];
          const on = s.read === v;
          return (
            <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t.themes[v]} onPress={() => s.set({ read: v })} style={styles.swatch}>
              <View style={[styles.swatchCircle, { backgroundColor: p?.page ?? '#FFFFFF', borderColor: on ? colors.crimson : colors.sep, borderWidth: on ? 3 : 1 }]}>
                {p ? <Text style={[styles.swatchAa, { color: p.ink }]}>Aa</Text> : <View style={styles.half} />}
              </View>
              <Text style={[styles.swatchText, { color: on ? colors.crimson : colors.label2 }]}>{t.themes[v]}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.label, { color: colors.label2 }, align]}>{t.spread}</Text>
      <Segmented<SpreadPref> label={t.spread} value={s.spreadPref} onChange={(v) => s.set({ spreadPref: v })}
        options={(['auto', 'on', 'off'] as SpreadPref[]).map((v) => ({ value: v, label: t.spreadOpts[v] }))} />
      <Text style={[styles.help, { color: colors.label2 }, align]}>{t.spreadHelp}</Text>

      <Text style={[styles.label, { color: colors.label2 }, align]}>{t.about}</Text>
      <Text style={[styles.help, { color: colors.label2 }, align]}>{t.aboutText}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48, gap: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
  head: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: '700' },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', marginTop: 16, marginHorizontal: 4 },
  help: { fontSize: 13, lineHeight: 19, marginHorizontal: 4 },
  arLabel: { fontFamily: FONTS.arBold, fontSize: 16 },
  sizeRow: { alignItems: 'center', gap: 12 },
  sizeBtn: { width: 48, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  aSmall: { fontSize: 14, fontWeight: '600' },
  aBig: { fontSize: 22, fontWeight: '600' },
  dots: { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  preview: { borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 6 },
  swatches: { justifyContent: 'space-between' },
  swatch: { alignItems: 'center', gap: 6, flex: 1 },
  swatchCircle: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  swatchAa: { fontFamily: FONTS.svSemi, fontSize: 18 },
  half: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '50%', backgroundColor: '#161314' },
  swatchText: { fontSize: 12, fontWeight: '600' },
  right: { textAlign: 'right' },
});
