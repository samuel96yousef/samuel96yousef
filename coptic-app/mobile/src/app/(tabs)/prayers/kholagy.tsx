import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KholagyMenu } from '../../../components/KholagyMenu';
import { LargeTitle } from '../../../components/LargeTitle';
import { TopBar } from '../../../components/TopBar';
import { kholagyIndex } from '../../../data';
import { useSettings } from '../../../settings';

/** The Kholagy in the order it is prayed: the raising of incense, the liturgy, the fraction and the distribution. */
export default function Kholagy() {
  const { t, colors, sidebar } = useSettings();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: colors.bg }]}>
      <TopBar back={sidebar ? undefined : t.prayers} />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 130 }]}>
        <LargeTitle title={t.kholagy} subtitle={t.kholagySub} />
        <KholagyMenu items={kholagyIndex} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: 16, maxWidth: 1040, width: '100%', alignSelf: 'center' },
});
