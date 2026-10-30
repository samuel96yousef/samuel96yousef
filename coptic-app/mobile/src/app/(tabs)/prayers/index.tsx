import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../../../components/Icon';
import { LargeTitle } from '../../../components/LargeTitle';
import { BarButton, TopBar } from '../../../components/TopBar';
import { CopticCross } from '../../../components/CopticCross';
import { agpeyaIndex, alhanBooks, holyWeek, hymnGroups, loadPrayers } from '../../../data';
import { hourNow } from '../../../lib/coptic';
import { useSettings } from '../../../settings';
import { FONTS, HOUR_SKY } from '../../../theme';

const KHOLAGY_SKY: [string, string] = ['#A12F4B', '#4A1024'];
// The violet of the fasts, whose hymns the first book holds.
const ALHAN_SKY: [string, string] = ['#6A4A8C', '#2C1A45'];
// Holy Week in the black of the Pascha, with the wine of the Passion.
const PASCHA_SKY: [string, string] = ['#4A2530', '#140B0E'];

/**
 * The prayer books, each a door of its own: the Agpeya under the sky of the
 * hour it is now, with a way straight into that hour, the Kholagy in crimson
 * with its chalice, the Alhan, the hymn books, in the violet of the fasts, and
 * Holy Week in the black of the Pascha.
 * Each opens its own page.
 */
export default function Prayers() {
  const { t, lang, colors, sidebar, contentWidth } = useSettings();
  const insets = useSafeAreaInsets();
  const ar = lang === 'ar';
  const wide = contentWidth >= 720;
  const now = hourNow();
  const hour = agpeyaIndex.find((h) => h.id === now);
  const sky = HOUR_SKY[now];
  const fg = sky?.dark ? '#FFFFFF' : '#2B1722';
  // Read the texts while the page is looked at, so an hour opens at once.
  useEffect(() => {
    loadPrayers('agpeya').then(() => loadPrayers('kholagy')).catch(() => {});
  }, []);

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      {/* On a large screen the sidebar has the settings. */}
      {!sidebar && <TopBar><BarButton icon="gear" label={t.settings} onPress={() => router.push('/settings')} /></TopBar>}
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}>
        <LargeTitle title={t.prayers} subtitle={t.prayersSub} />
        <View style={[styles.doors, wide && { flexDirection: ar ? 'row-reverse' : 'row' }]}>
          <Door colors={sky?.colors ?? [colors.surface, colors.surface]} fg={fg} title={t.agpeya} second={ar ? 'Agpeya' : 'الأجبية'}
            sub={t.agpeyaSub} count={t.hoursCount(agpeyaIndex.length)} onPress={() => router.push('/prayers/agpeya')}
            art={<View style={[styles.orb, sky?.moon ? styles.moon : styles.sun]} />}>
            {hour && (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/prayers/hour/${hour.id}`)}
                style={({ pressed }) => [styles.now, { flexDirection: ar ? 'row-reverse' : 'row' }, ar ? styles.nowRtl : null, pressed && styles.dim]}>
                <Text numberOfLines={1} style={[styles.nowText, { color: fg }]}>{t.now} · {ar ? hour.ar : hour.sv}</Text>
                <View style={ar && styles.flip}><Icon name="chevR" size={16} color={fg} strokeWidth={2.4} /></View>
              </Pressable>
            )}
          </Door>
          <Door colors={KHOLAGY_SKY} fg="#FFFFFF" title={t.kholagy} second={ar ? 'Kholagy' : 'الخولاجي'}
            sub={t.kholagySub} count={t.liturgiesCount(3)} onPress={() => router.push('/prayers/kholagy')}
            art={<Icon name="liturgy" size={56} color="rgba(255,255,255,0.75)" strokeWidth={1.4} />} />
          <Door colors={ALHAN_SKY} fg="#FFFFFF" title={t.alhan} second={t.alhanAr}
            sub={t.alhanSub} count={t.alhanCount(hymnGroups.reduce((n, g) => n + g.count, 0) + alhanBooks.reduce((n, b) => n + b.parts.reduce((m, p) => m + p.items.length, 0), 0))}
            onPress={() => router.push('/prayers/alhan')}
            art={<Icon name="hymns" size={52} color="rgba(255,255,255,0.75)" strokeWidth={1.5} />} />
          <Door colors={PASCHA_SKY} fg="#FFFFFF" title={t.pascha} second={t.paschaAr}
            sub={t.paschaSub} count={t.paschaDays(holyWeek.days.length)} onPress={() => router.push('/prayers/pascha')}
            art={<CopticCross size={50} color="rgba(255,255,255,0.75)" />} />
        </View>
      </ScrollView>
    </View>
  );
}

function Door({ colors, fg, title, second, sub, count, art, onPress, children }: {
  colors: [string, string, ...string[]]; fg: string; title: string; second: string; sub: string; count: string; art: ReactNode; onPress: () => void; children?: ReactNode;
}) {
  const { lang } = useSettings();
  const ar = lang === 'ar';
  const right = ar && styles.right;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} onPress={onPress} style={({ pressed }) => [styles.doorWrap, pressed && styles.pressed]}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={styles.door}>
        <View style={[styles.art, ar ? { left: 22 } : { right: 22 }]}>{art}</View>
        <Text style={[styles.count, { color: fg }, right]}>{count}</Text>
        <Text style={[styles.title, { color: fg }, right]}>{title}</Text>
        <Text style={[styles.second, { color: fg }, ar ? styles.secondSv : styles.secondAr]}>{second}</Text>
        {/* Clear of the round arrow in the corner. */}
        <Text style={[styles.sub, { color: fg }, right, ar ? { marginLeft: 48 } : { marginRight: 48 }]}>{sub}</Text>
        {children}
        <View style={[styles.go, ar ? { left: 18 } : { right: 18 }]}>
          <View style={ar && styles.flip}><Icon name="chevR" size={20} color={fg} strokeWidth={2.2} /></View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 1040, width: '100%', alignSelf: 'center' },
  doors: { gap: 16, marginTop: 4 },
  doorWrap: { flex: 1 },
  door: { borderRadius: 28, padding: 22, minHeight: 230, justifyContent: 'flex-end', overflow: 'hidden' },
  art: { position: 'absolute', top: 22 },
  orb: { },
  sun: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFF4CC', boxShadow: '0 0 30px 8px rgba(255,240,200,0.5)' },
  moon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F1ECDC', boxShadow: '0 0 30px 4px rgba(240,236,220,0.25)' },
  count: { fontSize: 13, fontWeight: '700', opacity: 0.8, letterSpacing: 0.4 },
  title: { fontFamily: FONTS.svSemi, fontSize: 32, lineHeight: 40, marginTop: 2 },
  second: { fontSize: 20, lineHeight: 32, opacity: 0.9 },
  secondAr: { fontFamily: FONTS.arBold, textAlign: 'left' },
  secondSv: { fontFamily: FONTS.svSemi, fontSize: 18, textAlign: 'right' },
  sub: { fontSize: 14, fontWeight: '500', opacity: 0.85, marginTop: 4 },
  now: { alignSelf: 'flex-start', alignItems: 'center', gap: 6, marginTop: 14, paddingHorizontal: 14, height: 38, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.55)', maxWidth: '75%' },
  nowRtl: { alignSelf: 'flex-end' },
  nowText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  go: { position: 'absolute', bottom: 22, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
  dim: { opacity: 0.7 },
  pressed: { transform: [{ scale: 0.98 }] },
});
