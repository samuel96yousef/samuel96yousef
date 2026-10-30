/**
 * The printed Katameros page: white paper, a double crimson rule inset from
 * the edge, and a Coptic cross on each corner. Pages are drawn row by row so
 * long texts can live in a virtualised list: every row paints the side rules,
 * and the top and bottom rows paint the horizontal rules and the corners.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSettings } from '../settings';
import { CopticCross } from './CopticCross';

export const FRAME_INSET = 11;
const GAP = 3.5;

type Side = 'single' | 'left' | 'right';

function SideRules({ side, top = 0, bottom = 0 }: { side: Side; top?: number; bottom?: number }) {
  const { page } = useSettings();
  const outer = { position: 'absolute' as const, top, bottom, width: 1.25, backgroundColor: page.rule };
  const inner = { position: 'absolute' as const, top: top ? top + GAP + 1 : 0, bottom: bottom ? bottom + GAP + 1 : 0, width: 0.75, backgroundColor: page.rule2 };
  return (
    <>
      {side !== 'right' && <View style={[outer, { left: FRAME_INSET }]} />}
      {side !== 'right' && <View style={[inner, { left: FRAME_INSET + GAP + 1 }]} />}
      {side !== 'left' && <View style={[outer, { right: FRAME_INSET }]} />}
      {side !== 'left' && <View style={[inner, { right: FRAME_INSET + GAP + 1 }]} />}
    </>
  );
}

/** Spine shading where two pages meet in the open-book spread. */
function Spine({ side }: { side: Side }) {
  if (side === 'single') return null;
  return <View pointerEvents="none" style={[styles.spine, side === 'left' ? { right: 0 } : { left: 0 }]} />;
}

export function PageBody({ side = 'single', children, style }: { side?: Side; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { page } = useSettings();
  return (
    <View style={[styles.body, { backgroundColor: page.page }, side === 'single' && styles.single, style]}>
      <SideRules side={side} />
      <Spine side={side} />
      {children}
    </View>
  );
}

function Edge({ side, at }: { side: Side; at: 'top' | 'bottom' }) {
  const { page } = useSettings();
  const v = at === 'top' ? { top: FRAME_INSET } : { bottom: FRAME_INSET };
  const vi = at === 'top' ? { top: FRAME_INSET + GAP + 1 } : { bottom: FRAME_INSET + GAP + 1 };
  const h = { left: side === 'right' ? 0 : FRAME_INSET, right: side === 'left' ? 0 : FRAME_INSET };
  const hi = { left: side === 'right' ? 0 : FRAME_INSET + GAP + 1, right: side === 'left' ? 0 : FRAME_INSET + GAP + 1 };
  const corner = (pos: ViewStyle) => (
    <View style={[styles.corner, { backgroundColor: page.page }, pos]}>
      <CopticCross size={17} color={page.rule} />
    </View>
  );
  return (
    <View style={[styles.edge, { backgroundColor: page.page }, side === 'single' && styles.single,
      at === 'top' ? styles.topRadius : styles.bottomRadius,
      side === 'left' && { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
      side === 'right' && { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]}>
      <SideRules side={side} top={at === 'top' ? FRAME_INSET : 0} bottom={at === 'bottom' ? FRAME_INSET : 0} />
      <Spine side={side} />
      <View style={[styles.hRule, { backgroundColor: page.rule }, v, h]} />
      <View style={[styles.hRuleInner, { backgroundColor: page.rule2 }, vi, hi]} />
      {side !== 'right' && corner({ left: FRAME_INSET - 10, ...(at === 'top' ? { top: FRAME_INSET - 10 } : { bottom: FRAME_INSET - 10 }) })}
      {side !== 'left' && corner({ right: FRAME_INSET - 10, ...(at === 'top' ? { top: FRAME_INSET - 10 } : { bottom: FRAME_INSET - 10 }) })}
    </View>
  );
}

export const PageTop = ({ side = 'single' }: { side?: Side }) => <Edge side={side} at="top" />;
export const PageBottom = ({ side = 'single' }: { side?: Side }) => <Edge side={side} at="bottom" />;

/** A complete framed card (used on the home screen). */
export function FramedCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { page, colors } = useSettings();
  return (
    <View style={[styles.card, { backgroundColor: page.page, boxShadow: `0 22px 40px -26px ${colors.shadow}` }, style]}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { margin: FRAME_INSET, borderWidth: 1.25, borderColor: page.rule }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { margin: FRAME_INSET + GAP + 1, borderWidth: 0.75, borderColor: page.rule2 }]} />
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <View key={c} style={[styles.corner, { backgroundColor: page.page },
          c[0] === 't' ? { top: FRAME_INSET - 10 } : { bottom: FRAME_INSET - 10 },
          c[1] === 'l' ? { left: FRAME_INSET - 10 } : { right: FRAME_INSET - 10 }]}>
          <CopticCross size={17} color={page.rule} />
        </View>
      ))}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 28, position: 'relative' },
  single: { marginHorizontal: 12 },
  edge: { height: 30, position: 'relative' },
  topRadius: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  bottomRadius: { borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  hRule: { position: 'absolute', height: 1.25 },
  hRuleInner: { position: 'absolute', height: 0.75 },
  corner: { position: 'absolute', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  spine: { position: 'absolute', top: 0, bottom: 0, width: 22, backgroundColor: 'rgba(60,20,30,0.05)' },
  card: { borderRadius: 6, paddingVertical: 34, paddingHorizontal: 28, position: 'relative' },
});
