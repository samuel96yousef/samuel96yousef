import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useSettings } from '../settings';

const liquid = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * A floating glass surface: iOS 26 Liquid Glass where available, a blur on
 * older iOS and the web, and a solid surface on Android where blur is costly.
 * `solid` is for chrome that sits on top of text: a plain blur lets the text
 * show through, so it gets a solid surface unless Liquid Glass can adapt.
 */
export function Glass({ style, children, interactive, solid }: { style?: StyleProp<ViewStyle>; children?: ReactNode; interactive?: boolean; solid?: boolean }) {
  const { colors, dark } = useSettings();
  const shadow: ViewStyle = { boxShadow: `0 12px 30px -12px ${colors.shadow}, 0 2px 8px -3px ${colors.shadow}` };
  if (liquid) {
    return (
      <GlassView style={style} glassEffectStyle="regular" isInteractive={interactive} colorScheme={dark ? 'dark' : 'light'}>
        {children}
      </GlassView>
    );
  }
  if (Platform.OS === 'android' || solid) {
    return <View style={[style, shadow, { backgroundColor: dark ? '#242022' : '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.sep }]}>{children}</View>;
  }
  return (
    <View style={[style, shadow, { padding: 0 }]}>
      <BlurView intensity={50} tint={dark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: StyleSheet.flatten(style)?.borderRadius ?? 0, backgroundColor: colors.glass, borderColor: colors.glassEdge }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
});
