import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../settings';
import { FONTS } from '../theme';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';

/** Floating glass buttons over the content, as in iOS 26. */
export function TopBar({ back, children }: { back?: string; children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, lang } = useSettings();
  return (
    <View pointerEvents="box-none" style={[styles.bar, { top: insets.top + 6, paddingLeft: Math.max(12, insets.left), paddingRight: Math.max(12, insets.right), flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
      <View style={styles.side}>
        {back && (
          <Pressable accessibilityRole="button" accessibilityLabel={back} onPress={() => router.back()} style={({ pressed }) => pressed && styles.pressed}>
            <Glass style={styles.backBtn} interactive>
              <View style={[styles.backInner, { flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
                <View style={lang === 'ar' && styles.flip}><Icon name="chevL" color={colors.label} size={22} strokeWidth={2.2} /></View>
                <Text numberOfLines={1} style={[styles.backText, { color: colors.label }]}>{back}</Text>
              </View>
            </Glass>
          </Pressable>
        )}
      </View>
      <View style={[styles.side, styles.end, { flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>{children}</View>
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
  bar: { position: 'absolute', left: 0, right: 0, zIndex: 20, flexDirection: 'row', justifyContent: 'space-between' },
  side: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  end: { justifyContent: 'flex-end' },
  backBtn: { borderRadius: 999, height: 44 },
  backInner: { height: 44, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 14, gap: 2 },
  backText: { fontSize: 17, fontWeight: '600', maxWidth: 160 },
  round: { borderRadius: 22, width: 44, height: 44 },
  roundInner: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  aa: { fontFamily: FONTS.svSemi, fontSize: 17 },
  pressed: { transform: [{ scale: 0.92 }] },
  flip: { transform: [{ scaleX: -1 }] },
});
