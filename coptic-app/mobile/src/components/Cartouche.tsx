import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSettings } from '../settings';

/** The Katameros cartouche: a double-ruled box with a diamond on each side, around chapter and book titles. */
export function Cartouche({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { page } = useSettings();
  const diamond = (side: ViewStyle) => (
    <View style={[styles.diamond, side, { borderColor: page.rule, backgroundColor: page.page }]}>
      <View style={[styles.diamondIn, { borderColor: page.rule2 }]} />
    </View>
  );
  return (
    <View style={[styles.cart, { borderColor: page.rule }, style]}>
      <View style={[styles.cartInner, { borderColor: page.rule2 }]}>{children}</View>
      {diamond(styles.diamondL)}
      {diamond(styles.diamondR)}
    </View>
  );
}

const styles = StyleSheet.create({
  cart: { marginHorizontal: 30, marginVertical: 8, borderWidth: 1, padding: 3, position: 'relative' },
  cartInner: { borderWidth: 0.75, paddingVertical: 6, paddingHorizontal: 10 },
  diamond: { position: 'absolute', top: '50%', width: 30, height: 30, marginTop: -15, borderWidth: 1, transform: [{ rotate: '45deg' }], alignItems: 'center', justifyContent: 'center' },
  diamondIn: { width: 18, height: 18, borderWidth: 0.75 },
  diamondL: { left: -22 },
  diamondR: { right: -22 },
});
