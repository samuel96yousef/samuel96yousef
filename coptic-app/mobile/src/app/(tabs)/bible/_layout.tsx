import { Stack } from 'expo-router';

// A chapter opened from elsewhere (search, Today) still has the book list beneath it.
export const unstable_settings = { initialRouteName: 'index' };

export default function Layout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
