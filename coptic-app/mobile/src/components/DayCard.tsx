import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';

import { coptic, copticText, isFastDay, MONTHS, observances, season, toArDigits } from '../lib/coptic';
import { useSettings } from '../settings';
import { FONTS } from '../theme';
import { CopticCross } from './CopticCross';

type Kind = 'feast' | 'saint' | 'fast' | 'plain';

/** Each kind of day has its colours and its emblem, like the hour card has its sky. */
const LOOK: Record<Kind, { colors: [string, string]; ink: string; ink2: string; emblem: string }> = {
  feast: { colors: ['#F8EBC9', '#E6C47A'], ink: '#3A2910', ink2: 'rgba(58,41,16,0.72)', emblem: '#A8751A' },
  saint: { colors: ['#A12F4B', '#5C1428'], ink: '#FFFFFF', ink2: 'rgba(255,255,255,0.78)', emblem: '#F6CBD5' },
  fast: { colors: ['#E6EAD9', '#BCC9A3'], ink: '#26301A', ink2: 'rgba(38,48,26,0.72)', emblem: '#5B6F3C' },
  plain: { colors: ['#F5EFE5', '#E2D5C1'], ink: '#2D2118', ink2: 'rgba(45,33,24,0.7)', emblem: '#B0384E' },
};

/**
 * The day's own card: the Coptic date, the date in the other language, and
 * what the day keeps, on colours that say what kind of day it is: gold with
 * a radiant cross for a great feast (and the fifty days of Easter), crimson
 * with a candle for a saint or an angel, olive with wheat for a fast, and
 * parchment with a Coptic cross on other days.
 */
export function DayCard({ day }: { day: Date }) {
  const { t, lang } = useSettings();
  const ar = lang === 'ar';
  const c = coptic(day);
  const obs = observances(day);
  const s = season(day);
  const fast = isFastDay(day);
  const kind: Kind = obs.some((o) => o.major) || (s && !s.fasting) ? 'feast' : obs.length ? 'saint' : s?.fasting || fast ? 'fast' : 'plain';
  const look = LOOK[kind];
  const keeps = [
    ...obs.map((o) => (ar ? o.ar : o.sv)),
    ...(s ? [ar ? s.ar : s.sv] : []),
    ...(fast && !s?.fasting ? [t.fastDay] : []),
  ];
  const row = ar ? ('row-reverse' as const) : ('row' as const);

  return (
    <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 0.35, y: 1 }} style={styles.card}>
      <View pointerEvents="none" style={[styles.emblem, ar ? { left: 14 } : { right: 14 }]}>
        <Emblem kind={kind} color={look.emblem} />
      </View>
      <View style={[styles.body, ar ? { paddingLeft: 96 } : { paddingRight: 96 }]}>
        <Text style={[styles.eyebrow, { color: look.ink2 }, ar && styles.right]}>
          <Text style={styles.cop}>{MONTHS[c.month - 1][2]}</Text>{'  ·  '}{t.year(c.year)}
        </Text>
        {/* Separate pieces, so Arabic and Swedish never get reordered by one another. */}
        <View style={[styles.dates, { flexDirection: row }]}>
          <Text style={[ar ? styles.titleAr : styles.title, { color: look.ink }]}>{copticText(c, ar ? 'ar' : 'sv')}</Text>
          {ar
            ? <Text style={[styles.altSv, { color: look.ink2 }]}>{copticText(c, 'sv')}</Text>
            : <Text style={[styles.altAr, { color: look.ink2 }]}>{`${copticText(c, 'ar')} ${toArDigits(c.year)} ش`}</Text>}
        </View>
        {keeps.length > 0 && <Text style={[styles.keeps, { color: look.ink }, ar && styles.right]}>{keeps.join('  ·  ')}</Text>}
      </View>
    </LinearGradient>
  );
}

/** The emblems, drawn on a 48-unit grid. */
function Emblem({ kind, color }: { kind: Kind; color: string }) {
  if (kind === 'plain') return <View style={styles.crossWrap}><CopticCross size={76} color={color} /></View>;
  return (
    <Svg width={84} height={84} viewBox="0 0 48 48" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'feast' && (
        // A cross in glory: twelve rays around a cross with budded ends.
        <G>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            return <Line key={i} x1={24 + Math.cos(a) * 15} y1={24 + Math.sin(a) * 15} x2={24 + Math.cos(a) * 21} y2={24 + Math.sin(a) * 21} strokeWidth={1.6} opacity={0.75} />;
          })}
          <Path d="M24 12v24M12 24h24" strokeWidth={3.4} />
          {[[24, 10.5], [24, 37.5], [10.5, 24], [37.5, 24]].map(([x, y]) => <Circle key={`${x}-${y}`} cx={x} cy={y} r={2.1} fill={color} stroke="none" />)}
          <Circle cx={24} cy={24} r={4.2} strokeWidth={1.8} />
        </G>
      )}
      {kind === 'saint' && (
        // A candle with its flame and halo.
        <G>
          <Circle cx={24} cy={14} r={8.5} strokeWidth={1.4} opacity={0.6} />
          <Path d="M24 7.5c3.2 3.4 3.4 6.4 0 9.5-3.4-3.1-3.2-6.1 0-9.5z" fill={color} stroke="none" />
          <Path d="M19.5 20.5h9v18h-9z" strokeWidth={2.2} />
          <Path d="M24 17.5v3" strokeWidth={1.6} />
          <Path d="M15 41.5h18" strokeWidth={2.4} />
        </G>
      )}
      {kind === 'fast' && (
        // A sheaf of wheat.
        <G>
          <Path d="M24 42V14M24 42c-3-6-7-9-11-10M24 42c3-6 7-9 11-10" strokeWidth={1.8} />
          {[0, 1, 2, 3].map((i) => (
            <G key={i}>
              <Ellipse cx={20.6} cy={16 + i * 5.2} rx={2.1} ry={3.6} transform={`rotate(-28 20.6 ${16 + i * 5.2})`} fill={color} stroke="none" />
              <Ellipse cx={27.4} cy={16 + i * 5.2} rx={2.1} ry={3.6} transform={`rotate(28 27.4 ${16 + i * 5.2})`} fill={color} stroke="none" />
            </G>
          ))}
          <Ellipse cx={24} cy={10.5} rx={2} ry={3.6} fill={color} stroke="none" />
        </G>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, paddingVertical: 16, paddingHorizontal: 20, overflow: 'hidden', minHeight: 104, justifyContent: 'center' },
  emblem: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center', opacity: 0.55 },
  crossWrap: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  body: { gap: 2 },
  eyebrow: { fontSize: 12, fontWeight: '600' },
  cop: { fontFamily: FONTS.cop, fontSize: 13 },
  dates: { flexWrap: 'wrap', alignItems: 'baseline', columnGap: 10 },
  title: { fontFamily: FONTS.svSemi, fontSize: 26, lineHeight: 34 },
  titleAr: { fontFamily: FONTS.arBold, fontSize: 28, lineHeight: 44, writingDirection: 'rtl' },
  altAr: { fontFamily: FONTS.ar, fontSize: 19, lineHeight: 30, writingDirection: 'rtl' },
  altSv: { fontFamily: FONTS.sv, fontSize: 16, lineHeight: 26 },
  keeps: { fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 2 },
  right: { textAlign: 'right', writingDirection: 'rtl' },
});
