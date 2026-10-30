import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LargeTitle } from '../../../components/LargeTitle';
import { TopBar } from '../../../components/TopBar';
import { agpeyaIndex } from '../../../data';
import { HOURS, hourNow } from '../../../lib/coptic';
import { useSettings } from '../../../settings';
import { FONTS, HOUR_SKY } from '../../../theme';

/** The Agpeya: the eight hours, each under its own sky, the one prayed now marked. */
export default function Agpeya() {
  const { t, lang, colors, sidebar, contentWidth: width } = useSettings();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const now = hourNow();
  const columns = width >= 720 ? 4 : 2;
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={sidebar ? undefined : t.prayers} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}>
        <LargeTitle title={t.agpeya} subtitle={t.agpeyaSub} />
        <View style={[styles.grid, { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          {agpeyaIndex.map((h) => {
            const sky = HOUR_SKY[h.id];
            const fg = sky?.dark ? '#FFFFFF' : '#2B1722';
            return (
              <Pressable key={h.id} accessibilityRole="button" accessibilityLabel={ar ? h.ar : h.sv}
                onPress={() => router.push(`/prayers/hour/${h.id}`)}
                style={({ pressed }) => [{ width: `${100 / columns}%` }, styles.cell, pressed && styles.pressed]}>
                <LinearGradient colors={sky?.colors ?? [colors.surface, colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }}
                  style={[styles.tile, h.id === now && { borderWidth: 2.5, borderColor: colors.crimson }]}>
                  <View style={[styles.orb, sky?.moon ? styles.moon : styles.sun, ar ? { left: 14 } : { right: 14 }]} />
                  {h.id === now && <View style={[styles.nowBadge, ar ? { right: 12 } : { left: 12 }]}><Text style={[styles.nowText, { color: fg }]}>{t.now}</Text></View>}
                  <Text style={[styles.tileSmall, { color: fg }, ar && styles.right]}>{ar ? HOURS[h.id].ar : HOURS[h.id].sv}</Text>
                  <Text style={[styles.tileName, { color: fg }, ar && styles.right]}>{ar ? h.ar : h.sv}</Text>
                  <Text style={[styles.tileName2, { color: fg }, ar ? null : styles.right]}>{ar ? h.sv : h.ar}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  grid: { flexWrap: 'wrap', marginHorizontal: -6 },
  cell: { padding: 6 },
  tile: { borderRadius: 24, padding: 16, minHeight: 136, justifyContent: 'flex-end', overflow: 'hidden' },
  orb: { position: 'absolute', top: 14 },
  sun: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFF4CC', boxShadow: '0 0 22px 6px rgba(255,240,200,0.5)' },
  moon: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1ECDC', boxShadow: '0 0 22px 4px rgba(240,236,220,0.25)' },
  nowBadge: { position: 'absolute', top: 14, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  nowText: { fontSize: 11, fontWeight: '700' },
  tileSmall: { fontSize: 12, fontWeight: '600', opacity: 0.85 },
  tileName: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  tileName2: { fontFamily: FONTS.arBold, fontSize: 17, lineHeight: 28, textAlign: 'left' },
  list: { borderRadius: 24, overflow: 'hidden' },
  row: { alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowAr: { fontFamily: FONTS.ar, fontSize: 16, lineHeight: 26, textAlign: 'left' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { transform: [{ scale: 0.97 }] },
});
