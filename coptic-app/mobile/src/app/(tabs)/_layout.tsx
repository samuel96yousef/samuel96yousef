import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { Sidebar } from '../../components/Sidebar';
import { TabBar } from '../../components/TabBar';
import { useSettings } from '../../settings';

/** Four tabs; on a large screen the sidebar beside them takes the tab bar's place (on the right in Arabic). */
export default function TabsLayout() {
  const { sidebar, lang } = useSettings();
  return (
    <View style={[styles.fill, { flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }]}>
      {sidebar && <Sidebar />}
      <View style={styles.fill}>
        <Tabs tabBar={(props) => (sidebar ? null : <TabBar {...props} />)} screenOptions={{ headerShown: false }}>
          <Tabs.Screen name="index" />
          <Tabs.Screen name="readings" />
          <Tabs.Screen name="prayers" />
          <Tabs.Screen name="bible" />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
