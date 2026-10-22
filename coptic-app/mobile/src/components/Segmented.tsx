import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutRectangle, type TextStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useSettings } from '../settings';
import { SPRING_LIVELY } from '../theme';

/** iOS-style segmented control with a sliding thumb. */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T;
  options: { value: T; label: string; style?: TextStyle }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const { colors } = useSettings();
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    x.set(withSpring(l.x, SPRING_LIVELY));
    w.set(withSpring(l.width, SPRING_LIVELY));
  }, [value, layouts, x, w]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }], width: w.get() }));

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.wrap, { backgroundColor: colors.bg2 }]}>
      <Animated.View style={[styles.thumb, { backgroundColor: colors.surface }, thumb]} />
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ checked: o.value === value }}
          onPress={() => onChange(o.value)}
          onLayout={(e) => { const l = e.nativeEvent.layout; setLayouts((p) => ({ ...p, [o.value]: l })); }}
          style={styles.option}
        >
          <Text style={[styles.text, o.style, { color: o.value === value ? colors.label : colors.label2 }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', padding: 3, borderRadius: 999 },
  thumb: { position: 'absolute', top: 3, bottom: 3, left: 0, borderRadius: 999, boxShadow: '0 3px 8px -2px rgba(0,0,0,0.18)' },
  option: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  text: { fontSize: 14, fontWeight: '600' },
});
