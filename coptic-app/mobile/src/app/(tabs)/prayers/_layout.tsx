import { Stack } from 'expo-router';

// An hour opened from Today still has the prayers page beneath it, so the tab never opens on a dead end.
export const unstable_settings = { initialRouteName: 'index' };

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
