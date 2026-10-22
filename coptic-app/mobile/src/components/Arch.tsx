import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';

import { useSettings } from '../settings';
import { FONTS } from '../theme';

/** The arch from the Katameros title page: medallion pillars, cross lattice, a banner. */
export function Arch({ ar, sv, cop }: { ar: string; sv: string; cop: string }) {
  const { page } = useSettings();
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${ar}, ${sv}`}>
      <Svg viewBox="0 0 300 232" width="100%" height="100%" fill="none" stroke={page.rule}>
        <Defs>
          <Pattern id="lat" width={12} height={12} patternUnits="userSpaceOnUse">
            <Path d="M4 0.5h4v3.5h3.5v4H8v3.5H4V8H0.5V4H4z" stroke={page.rule} strokeWidth={0.7} strokeOpacity={0.42} fill="none" />
          </Pattern>
          <Pattern id="med" width={35} height={27} patternUnits="userSpaceOnUse" x={8} y={33}>
            <Circle cx={17.5} cy={13.5} r={10.5} stroke={page.rule} strokeWidth={0.9} fill="none" />
            <Circle cx={17.5} cy={13.5} r={7.6} stroke={page.rule} strokeWidth={0.45} fill="none" />
            <Path d="M17.5 7.6v11.8M11.6 13.5h11.8" stroke={page.rule} strokeWidth={1.7} />
          </Pattern>
        </Defs>
        <Rect x={3} y={3} width={294} height={226} strokeWidth={1.4} fill={page.page} />
        <Rect x={7} y={7} width={286} height={218} strokeWidth={0.7} />
        <Path d="M7 32H293M43 32V225M257 32V225" strokeWidth={0.7} />
        <SvgText x={150} y={24} textAnchor="middle" fill={page.rule} stroke="none" fontSize={12.5} fontFamily={FONTS.cop}>
          Ⲥⲩⲛ Ⲑⲉⲱ̄ Ⲓⲥⲭⲩⲣⲟⲥ · باسم الله القوي
        </SvgText>
        <G stroke="none">
          <Rect x={8} y={33} width={35} height={191} fill="url(#med)" />
          <Rect x={257} y={33} width={35} height={191} fill="url(#med)" />
          <Rect x={43.5} y={32.5} width={213} height={192} fill="url(#lat)" />
        </G>
        <Path d="M66 225V120C66 74 104 50 150 45C196 50 234 74 234 120V225Z" fill={page.page} strokeWidth={1.3} />
        <Path d="M72 225V121C72 79 107 57 150 52C193 57 228 79 228 121V225" strokeWidth={0.6} />
      </Svg>
      <View style={styles.text} pointerEvents="none">
        <Text style={[styles.cop, { color: page.rule }]}>{cop}</Text>
        <Text style={[styles.ar, { color: page.ink }]}>{ar}</Text>
        <Text style={[styles.sv, { color: page.ink2 }]}>{sv}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 320, aspectRatio: 300 / 232, alignSelf: 'center', marginVertical: 8 },
  text: { position: 'absolute', top: '34%', left: '24%', right: '24%', bottom: '6%', alignItems: 'center', justifyContent: 'center', gap: 2 },
  cop: { fontFamily: FONTS.cop, fontSize: 13, letterSpacing: 0.8 },
  ar: { fontFamily: FONTS.arBold, fontSize: 28, lineHeight: 42, textAlign: 'center', writingDirection: 'rtl' },
  sv: { fontFamily: FONTS.sv, fontSize: 13, lineHeight: 17, textAlign: 'center' },
});
