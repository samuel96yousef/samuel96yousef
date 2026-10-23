import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useSettings } from '../settings';
import { Icon } from './Icon';
import { PrintSheet, type PrintScope } from './PrintSheet';
import { BarButton } from './TopBar';

/**
 * Print, open-book toggle and text settings, shown on every reading screen:
 * in the top bar, or `inline` as small round buttons in a screen's own header
 * card. Printing shows only where the screen says what can be printed.
 */
export function ReaderActions({ inline, print }: { inline?: boolean; print?: PrintScope[] }) {
  const { spread, set, t, colors } = useSettings();
  const [printing, setPrinting] = useState(false);
  const sheet = print?.length ? <PrintSheet visible={printing} scopes={print} onClose={() => setPrinting(false)} /> : null;
  if (inline) {
    const round = (label: string, onPress: () => void, child: React.ReactNode, active?: boolean) => (
      <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} onPress={onPress} hitSlop={6}
        style={({ pressed }) => pressed && styles.dim}>
        <View style={[styles.round, { backgroundColor: active ? colors.tint : colors.bg2 }]}>{child}</View>
      </Pressable>
    );
    return (
      <>
        {sheet && round(t.printAction, () => setPrinting(true), <Icon name="print" size={19} color={colors.label} strokeWidth={2} />)}
        {sheet}
        {round(t.spread, () => set({ spreadPref: spread ? 'off' : 'on' }), <Icon name="book" size={19} color={spread ? colors.crimson : colors.label} strokeWidth={2} />, spread)}
        {round(t.settings, () => router.push('/settings'), <Icon name="textSize" size={20} color={colors.label} strokeWidth={2} />)}
      </>
    );
  }
  return (
    <>
      {sheet && <BarButton icon="print" label={t.printAction} onPress={() => setPrinting(true)} />}
      {sheet}
      <BarButton icon="book" label={t.spread} active={spread} onPress={() => set({ spreadPref: spread ? 'off' : 'on' })} />
      <BarButton icon="textSize" label={t.settings} onPress={() => router.push('/settings')} />
    </>
  );
}

const styles = StyleSheet.create({
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.6 },
});
