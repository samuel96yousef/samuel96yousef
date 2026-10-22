import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '../../components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="readings" />
      <Tabs.Screen name="prayers" />
      <Tabs.Screen name="bible" />
    </Tabs>
  );
}
