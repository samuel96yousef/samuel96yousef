import { router } from 'expo-router';

import { useSettings } from '../settings';
import { BarButton } from './TopBar';

/** Open-book toggle and text settings, shown on every reading screen. */
export function ReaderActions() {
  const { spread, set, t } = useSettings();
  return (
    <>
      <BarButton icon="book" label={t.spread} active={spread} onPress={() => set({ spreadPref: spread ? 'off' : 'on' })} />
      <BarButton text="Aa" label={t.settings} onPress={() => router.push('/settings')} />
    </>
  );
}
