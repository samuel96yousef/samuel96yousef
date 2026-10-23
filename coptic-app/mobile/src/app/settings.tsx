import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { GLYPH_PATHS, Glyph } from '../components/Glyph';
import { Icon } from '../components/Icon';
import { Segmented } from '../components/Segmented';
import { useSettings, type Appearance, type Show, type SpreadPref } from '../settings';
import { FONTS, PAGES, type PagePalette, type ReadTheme } from '../theme';

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
          <Glyph text="A" size={15} color={colors.label} />
        </Pressable>
        <View style={[styles.dots, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          {SIZES.map((v, i) => <View key={v} style={[styles.dot, { backgroundColor: i <= sizeIndex ? colors.crimson : colors.bg2 }]} />)}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t.larger} disabled={sizeIndex === SIZES.length - 1} onPress={() => s.set({ scale: SIZES[sizeIndex + 1] })} style={[styles.sizeBtn, { backgroundColor: colors.surface, opacity: sizeIndex === SIZES.length - 1 ? 0.4 : 1 }]}>
          <Glyph text="A" size={24} color={colors.label} />
        </Pressable>
      </View>
      <View style={[styles.preview, { backgroundColor: page.page, borderColor: page.rule2 }]}>
        <Text style={{ fontFamily: FONTS.ar, fontSize: 23 * s.scale, lineHeight: 23 * s.scale * 1.9, color: page.ink, textAlign: 'right', writingDirection: 'rtl' }}>سبحوا الرب تسبيحاً جديداً</Text>
        <Text style={{ fontFamily: FONTS.sv, fontSize: 17 * s.scale, lineHeight: 17 * s.scale * 1.5, color: page.ink }}>Sjung för Herren en ny sång</Text>
      </View>

      <Text style={[styles.label, { color: colors.label2 }, align]}>{t.readTheme}</Text>
      <View style={[styles.swatches, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
        {(['auto', 'paper', 'sepia', 'night'] as ReadTheme[]).map((v) => {
          const on = s.read === v;
          return (
            <Pressable key={v} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={t.themes[v]} onPress={() => s.set({ read: v })} style={styles.swatch}>
              {/* As in Apple Books: a small page with Aa in its colours, and a ring around the chosen one. */}
              <View style={[styles.swatchRing, { borderColor: on ? colors.crimson : 'transparent' }]}>
                <ThemeSwatch theme={v} edge={colors.sep} />
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
  dots: { flex: 1, flexDirection: 'row', gap: 6, justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  preview: { borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 6 },
  swatches: { justifyContent: 'space-between' },
  swatch: { alignItems: 'center', gap: 6, flex: 1 },
  swatchRing: { borderWidth: 2.5, borderRadius: 21, padding: 3 },
  swatchText: { fontSize: 12, fontWeight: '600' },
  right: { textAlign: 'right' },
});

const SW = 54;

/** A theme as a little page: its paper, a hairline edge and Aa in its ink. Auto is half paper, half night. */
function ThemeSwatch({ theme, edge }: { theme: ReadTheme; edge: string }) {
  const glyph = `translate(${SW / 2 - 14} ${SW / 2 - 14}) scale(${28 / 24})`;
  const page = (p: PagePalette, clip?: string) => (
    <G clipPath={clip}>
      <Rect x={0} y={0} width={SW} height={SW} rx={14} fill={p.page} />
      <Path d={GLYPH_PATHS.Aa} fill={p.ink} transform={glyph} />
    </G>
  );
  return (
    <Svg width={SW} height={SW} viewBox={`0 0 ${SW} ${SW}`}>
      <Defs>
        <ClipPath id="swatch-left"><Rect x={0} y={0} width={SW / 2} height={SW} /></ClipPath>
        <ClipPath id="swatch-right"><Rect x={SW / 2} y={0} width={SW / 2} height={SW} /></ClipPath>
      </Defs>
      {theme === 'auto'
        ? <>{page(PAGES.paper, 'url(#swatch-left)')}{page(PAGES.night, 'url(#swatch-right)')}</>
        : page(PAGES[theme])}
      <Rect x={0.5} y={0.5} width={SW - 1} height={SW - 1} rx={13.5} fill="none" stroke={edge} strokeWidth={1} />
    </Svg>
  );
}
