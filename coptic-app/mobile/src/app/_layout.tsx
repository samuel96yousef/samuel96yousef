import { Amiri_400Regular } from '@expo-google-fonts/amiri/400Regular';
import { Amiri_700Bold } from '@expo-google-fonts/amiri/700Bold';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_400Regular_Italic } from '@expo-google-fonts/literata/400Regular_Italic';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import { NotoSansCoptic_400Regular } from '@expo-google-fonts/noto-sans-coptic/400Regular';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '../components/Toast';
import { SettingsProvider, useSettings } from '../settings';

SplashScreen.preventAutoHideAsync().catch(() => {});

// On the web, a button clicked with the mouse gets no focus ring (the browser's
// orange or blue one); a keyboard user still sees where focus is, in the app's crimson.
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = '[tabindex]:focus:not(:focus-visible){outline:none}[tabindex]:focus-visible{outline:2px solid #C0384E;outline-offset:2px}';
  document.head.appendChild(style);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Amiri_400Regular, Amiri_700Bold, Literata_400Regular, Literata_400Regular_Italic,
    Literata_600SemiBold, NotoSansCoptic_400Regular,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SettingsProvider>
        <App ready={fontsLoaded || !!fontError} />
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

function App({ ready }: { ready: boolean }) {
  const s = useSettings();
  const loaded = ready && s.ready;
  useEffect(() => { if (loaded) SplashScreen.hideAsync().catch(() => {}); }, [loaded]);
  if (!loaded) return null;

  const base = s.dark ? DarkTheme : DefaultTheme;
  const theme = { ...base, colors: { ...base.colors, background: s.colors.bg, card: s.colors.bg, text: s.colors.label, primary: s.colors.crimson, border: s.colors.sep } };

  return (
    <ThemeProvider value={theme}>
      <ToastProvider>
        <StatusBar style={s.dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: s.colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="settings"
            options={{ presentation: 'formSheet', sheetAllowedDetents: [0.7, 1], sheetGrabberVisible: true, sheetCornerRadius: 34, contentStyle: { backgroundColor: s.colors.bg } }}
          />
        </Stack>
      </ToastProvider>
    </ThemeProvider>
  );
}
