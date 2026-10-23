import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';

import type { PrayerIndex } from '../lib/types';
import { useSettings } from '../settings';
import { FONTS, HOUR_SKY } from '../theme';
import { Icon } from './Icon';

/** The three anaphoras, each with its saint's initial in Coptic and when it is prayed. */
const ANAPHORA: Record<string, { initial: string; use: 'basilUse' | 'gregoryUse' | 'cyrilUse' }> = {
  basil: { initial: 'Ⲃ', use: 'basilUse' },
  gregory: { initial: 'Ⲅ', use: 'gregoryUse' },
  cyril: { initial: 'Ⲕ', use: 'cyrilUse' },
};

const open = (id: string) => router.push(`/prayers/liturgy/${id}`);

/**
 * The Kholagy in the order it is prayed: the raising of incense at evening
 * and morning, then the liturgy, from the offering of the lamb through one
 * of the three anaphoras to the fraction and the distribution.
 */
export function KholagyMenu({ items }: { items: PrayerIndex[] }) {
  const { t, lang } = useSettings();
  const wide = useSettings().contentWidth >= 720;
  const ar = lang === 'ar';
  const by = (id: string) => items.find((p) => p.id === id);
  const row = ar ? ('row-reverse' as const) : ('row' as const);
  const pair = (a?: ReactNode, b?: ReactNode) => <View style={[styles.pair, { flexDirection: row }]}>{a}{b}</View>;
  const vespers = by('vespers');
  const matins = by('matins');
  const offering = by('offering');
  const fraction = by('fraction');
  const distribution = by('distribution');

  return (
    <View style={styles.wrap}>
      <GroupLabel>{t.incense}</GroupLabel>
      {pair(
        vespers && <IncenseTile p={vespers} sky="ghorob" sub={t.vespersSub} />,
        matins && <IncenseTile p={matins} sky="baker" sub={t.matinsSub} />,
      )}

      <GroupLabel>{t.divineLiturgy}</GroupLabel>
      {offering && (
        <Card p={offering} sub={t.liturgyStarts} emblem={<Emblem kind="offering" />} />
      )}
      {/* On a wide screen the three anaphoras stand side by side, as the choice they are. */}
      <View style={wide ? [styles.three, { flexDirection: row }] : styles.stack}>
        {['basil', 'gregory', 'cyril'].map((id) => {
          const p = by(id);
          return p ? <Card key={id} p={p} sub={t[ANAPHORA[id].use]} emblem={<Initial letter={ANAPHORA[id].initial} />} big wide={wide} /> : null;
        })}
      </View>
      {pair(
        fraction && <SmallTile p={fraction} sub={t.fractionSub} emblem={<Emblem kind="fraction" />} />,
        distribution && <SmallTile p={distribution} sub={t.distributionSub} emblem={<Emblem kind="chalice" />} />,
      )}
    </View>
  );
}

function GroupLabel({ children }: { children: string }) {
  const { colors, lang } = useSettings();
  return <Text style={[styles.group, { color: colors.crimson }, lang === 'ar' && styles.groupAr]}>{children}</Text>;
}

/** Evening and morning incense, under the same skies as the hours of the Agpeya. */
function IncenseTile({ p, sky, sub }: { p: PrayerIndex; sky: keyof typeof HOUR_SKY; sub: string }) {
  const { lang } = useSettings();
  const ar = lang === 'ar';
  const s = HOUR_SKY[sky];
  const fg = s.dark ? '#FFFFFF' : '#2B1722';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${ar ? p.ar : p.sv}, ${sub}`} onPress={() => open(p.id)}
      style={({ pressed }) => [styles.half, pressed && styles.pressed]}>
      <LinearGradient colors={s.colors} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={styles.incense}>
        <View pointerEvents="none" style={[styles.censer, ar ? { left: 12 } : { right: 12 }]}><Emblem kind="censer" color={fg} size={38} /></View>
        <Text style={[styles.tileSub, { color: fg }, ar && styles.right]}>{sub}</Text>
        <Text style={[styles.tileName, { color: fg }, ar && styles.right]}>{ar ? p.ar : p.sv}</Text>
        <Text style={[ar ? styles.tileNameSv : styles.tileName2, { color: fg }, !ar && styles.right]}>{ar ? p.sv : p.ar}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/** A row card: the emblem in a medallion, the names, and what it is. The anaphoras are the large ones. */
function Card({ p, sub, emblem, big, wide }: { p: PrayerIndex; sub: string; emblem: ReactNode; big?: boolean; wide?: boolean }) {
  const { colors, lang } = useSettings();
  const ar = lang === 'ar';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${ar ? p.ar : p.sv}, ${sub}`} onPress={() => open(p.id)}
      style={({ pressed }) => [styles.card, big && styles.cardBig, wide && styles.half, { backgroundColor: colors.surface, flexDirection: ar ? 'row-reverse' : 'row' }, pressed && styles.pressed]}>
      <View style={[styles.medal, big && styles.medalBig, { borderColor: colors.crimson }]}>
        <View style={[styles.medalIn, { borderColor: colors.tint }]}>{emblem}</View>
      </View>
      <View style={styles.cardText}>
        <Text style={[styles.cardName, big && styles.cardNameBig, { color: colors.label }, ar && styles.right]}>{ar ? p.ar : p.sv}</Text>
        <Text style={[ar ? styles.nameSv : styles.cardName2, { color: colors.label2 }, ar ? styles.right : styles.under]}>{ar ? p.sv : p.ar}</Text>
        <Text style={[styles.cardSub, { color: colors.crimson }, ar && styles.right]}>{sub}</Text>
      </View>
      <View style={ar && styles.flip}><Icon name="chevR" size={16} color={colors.label3} strokeWidth={2.2} /></View>
    </Pressable>
  );
}

function SmallTile({ p, sub, emblem }: { p: PrayerIndex; sub: string; emblem: ReactNode }) {
  const { colors, lang } = useSettings();
  const ar = lang === 'ar';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${ar ? p.ar : p.sv}, ${sub}`} onPress={() => open(p.id)}
      style={({ pressed }) => [styles.half, styles.small, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
      <View style={[styles.medal, { borderColor: colors.crimson }, ar ? styles.selfEnd : styles.selfStart]}>
        <View style={[styles.medalIn, { borderColor: colors.tint }]}>{emblem}</View>
      </View>
      <Text style={[styles.smallName, { color: colors.label }, ar && styles.right]}>{ar ? p.ar : p.sv}</Text>
      <Text style={[ar ? styles.nameSv : styles.smallName2, { color: colors.label2 }, ar ? styles.right : styles.under]}>{ar ? p.sv : p.ar}</Text>
      <Text numberOfLines={2} style={[styles.cardSub, { color: colors.crimson }, ar && styles.right]}>{sub}</Text>
    </Pressable>
  );
}

/** The saint's initial in Coptic, with the stroke above that marks a holy name on Coptic icons. */
function Initial({ letter }: { letter: string }) {
  const { colors } = useSettings();
  return (
    <View style={styles.initialWrap}>
      <View style={[styles.titlo, { backgroundColor: colors.crimson }]} />
      <Text style={[styles.initial, { color: colors.crimson }]}>{letter}</Text>
    </View>
  );
}

/** Small emblems on a 24-unit grid: a censer, the offering loaf, the broken loaf, the chalice. */
function Emblem({ kind, color, size = 26 }: { kind: 'censer' | 'offering' | 'fraction' | 'chalice'; color?: string; size?: number }) {
  const { colors } = useSettings();
  const c = color ?? colors.crimson;
  if (kind === 'chalice') return <Icon name="liturgy" size={size} color={c} strokeWidth={1.8} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'censer' && (
        <G>
          <Path d="M12 2.5v3M12 5.5L6.2 12.5M12 5.5l5.8 7" />
          <Path d="M5 13h14a7 6.5 0 0 1-14 0z" />
          <Path d="M8 13a4 3.3 0 0 1 8 0" />
          <Path d="M10.2 21.5h3.6" />
          <Path d="M3.2 6.5c1-1.2 1-2.2 0-3.4M20.8 6.5c-1-1.2-1-2.2 0-3.4" opacity={0.7} />
        </G>
      )}
      {kind === 'offering' && (
        // The qurban: a round loaf stamped with a cross of twelve squares.
        <G>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M10 6.5h4v3.5h3.5v4H14v3.5h-4V14H6.5v-4H10z" />
          <Path d="M12 6.5v11M6.5 12h11" opacity={0.55} />
        </G>
      )}
      {kind === 'fraction' && (
        // The loaf broken in two.
        <G>
          <Path d="M10.6 3.1a9 9 0 0 0 0 17.8z" />
          <Path d="M13.4 3.1a9 9 0 0 1 0 17.8z" />
          <Path d="M7.5 12h1.8M14.7 12h1.8M10 8.5v7M14 8.5v7" opacity={0.55} />
        </G>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  group: { fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 10, marginHorizontal: 4 },
  groupAr: { textAlign: 'right', letterSpacing: 0, textTransform: 'none', fontSize: 14 },
  pair: { gap: 10 },
  stack: { gap: 10 },
  three: { gap: 10, alignItems: 'stretch' },
  // Arabic under a Swedish title stays at the start of the line, under the title.
  under: { textAlign: 'left' },
  half: { flex: 1, minWidth: 0 },
  incense: { borderRadius: 22, padding: 16, minHeight: 124, justifyContent: 'flex-end', overflow: 'hidden' },
  censer: { position: 'absolute', top: 10, opacity: 0.85 },
  tileSub: { fontSize: 12, fontWeight: '600', opacity: 0.85 },
  tileName: { fontSize: 17, fontWeight: '700', marginTop: 2 },
  tileName2: { fontFamily: FONTS.arBold, fontSize: 17, lineHeight: 28 },
  tileNameSv: { fontSize: 15, fontWeight: '600', lineHeight: 24, opacity: 0.9 },
  nameSv: { fontFamily: FONTS.sv, fontSize: 15, lineHeight: 24 },
  card: { alignItems: 'center', gap: 14, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14 },
  cardBig: { paddingVertical: 14 },
  medal: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.3, padding: 2.5 },
  medalBig: { width: 54, height: 54, borderRadius: 27 },
  medalIn: { flex: 1, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  initialWrap: { alignItems: 'center' },
  titlo: { width: 16, height: 1.6, borderRadius: 1, marginBottom: 1 },
  initial: { fontFamily: FONTS.cop, fontSize: 22, lineHeight: 26 },
  cardText: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 16, fontWeight: '700' },
  cardNameBig: { fontFamily: FONTS.svSemi, fontWeight: undefined, fontSize: 18 },
  cardName2: { fontFamily: FONTS.ar, fontSize: 16, lineHeight: 26 },
  cardSub: { fontSize: 13, fontWeight: '600', marginTop: 1 },
  small: { borderRadius: 20, padding: 14, gap: 2 },
  smallName: { fontSize: 16, fontWeight: '700', marginTop: 8 },
  smallName2: { fontFamily: FONTS.ar, fontSize: 16, lineHeight: 26 },
  selfStart: { alignSelf: 'flex-start' },
  selfEnd: { alignSelf: 'flex-end' },
  right: { textAlign: 'right', writingDirection: 'rtl' },
  flip: { transform: [{ scaleX: -1 }] },
  pressed: { transform: [{ scale: 0.97 }] },
});
