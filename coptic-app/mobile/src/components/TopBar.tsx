import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../settings';
import { FONTS } from '../theme';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';

/** Height of the top bar below the safe area: 6 pt gap, 44 pt buttons, 6 pt gap. */
export const BAR_HEIGHT = 56;

// Timed, not sprung: the back button should shrink without wobbling.
const layout = LinearTransition.duration(220);

/**
 * Floating glass buttons over the content, as in iOS 26. `center` fills the
 * space between the two sides (the reader's context pill); `compact` shrinks
 * the back button to its chevron to make room for it.
 */
export function TopBar({ back, children, center, compact }: { back?: string; children?: ReactNode; center?: ReactNode; compact?: boolean }) {
  const insets = useSafeAreaInsets();
  const { colors, lang } = useSettings();
  const row = lang === 'ar' ? 'row-reverse' : 'row';
  return (
    <View pointerEvents="box-none" style={[styles.bar, { top: insets.top + 6, paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right), flexDirection: row }]}>
      <View pointerEvents="box-none" style={[styles.side, { flexDirection: row }]}>
        {back && (
          <Pressable accessibilityRole="button" accessibilityLabel={back} onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
            <Animated.View layout={layout}>
              <Glass style={styles.backBtn} interactive>
                <View style={[styles.backInner, compact && styles.backCompact, { flexDirection: row }]}>
                  <View style={lang === 'ar' && styles.flip}><Icon name="chevL" color={colors.label} size={22} strokeWidth={2.2} /></View>
                  {!compact && (
                    <Animated.Text entering={FadeIn.duration(180)} exiting={FadeOut.duration(100)} numberOfLines={1} style={[styles.backText, { color: colors.label }]}>{back}</Animated.Text>
                  )}
                </View>
              </Glass>
            </Animated.View>
          </Pressable>
        )}
      </View>
      <View pointerEvents="box-none" style={styles.center}>{center}</View>
      <View pointerEvents="box-none" style={[styles.side, styles.end, { flexDirection: row }]}>{children}</View>
    </View>
  );
}

export function BarButton({ icon, text, label, onPress, active }: { icon?: IconName; text?: string; label: string; onPress: () => void; active?: boolean }) {
  const { colors } = useSettings();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <Glass style={styles.round} interactive>
        <View style={styles.roundInner}>
          {icon ? <Icon name={icon} color={active ? colors.crimson : colors.label} size={22} />
            : <Text style={[styles.aa, { color: colors.label }]}>{text}</Text>}
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  side: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  end: { justifyContent: 'flex-end' },
  center: { flex: 1, minWidth: 0, alignItems: 'stretch' },
  backBtn: { borderRadius: 999, height: 44 },
  backInner: { height: 44, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 14, gap: 2 },
  backCompact: { width: 44, paddingLeft: 0, paddingRight: 0, justifyContent: 'center' },
  backText: { fontSize: 17, fontWeight: '600', maxWidth: 160 },
  round: { borderRadius: 22, width: 44, height: 44 },
  roundInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  aa: { fontFamily: FONTS.svSemi, fontSize: 17 },
  pressed: { transform: [{ scale: 0.92 }] },
  flip: { transform: [{ scaleX: -1 }] },
});
