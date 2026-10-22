import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSettings } from '../settings';
import { Icon } from './Icon';
import { BarButton } from './TopBar';

/**
 * Open-book toggle and text settings, shown on every reading screen: in the
 * top bar, or `inline` as small round buttons in a screen's own header card.
 */
export function ReaderActions({ inline }: { inline?: boolean }) {
  const { spread, set, t, colors } = useSettings();
  if (inline) {
    const round = (label: string, onPress: () => void, child: React.ReactNode, active?: boolean) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} hitSlop={6}
        style={({ pressed }) => pressed && styles.dim}>
        <View style={[styles.round, { backgroundColor: active ? colors.tint : colors.bg2 }]}>{child}</View>
      </Pressable>
    );
    return (
      <>
        {round(t.spread, () => set({ spreadPref: spread ? 'off' : 'on' }), <Icon name="book" size={19} color={spread ? colors.crimson : colors.label} strokeWidth={2} />, spread)}
        {round(t.settings, () => router.push('/settings'), <Text style={[styles.aa, { color: colors.label }]}>Aa</Text>)}
      </>
    );
  }
  return (
    <>
      <BarButton icon="book" label={t.spread} active={spread} onPress={() => set({ spreadPref: spread ? 'off' : 'on' })} />
      <BarButton text="Aa" label={t.settings} onPress={() => router.push('/settings')} />
    </>
  );
}

const styles = StyleSheet.create({
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  aa: { fontSize: 16, fontWeight: '600' },
  dim: { opacity: 0.6 },
});
