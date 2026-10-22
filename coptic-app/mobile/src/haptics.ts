/**
 * Haptic ticks, like the Digital Crown's clicks.
 *
 * In the app they are native (expo-haptics). The web has no reliable
 * equivalent: Android browsers can vibrate, and Safari on iOS 18 gives a
 * tick when a switch-style checkbox is toggled, so the web build uses that.
 * Whether a web view inside another app passes it on is up to that app.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let webSwitch: HTMLLabelElement | null = null;

function webTick(ms: number) {
  if (typeof document === 'undefined') return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(ms);
    return;
  }
  if (!webSwitch) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.id = 'haptic-switch';
    input.style.display = 'none';
    const label = document.createElement('label');
    label.htmlFor = input.id;
    label.style.display = 'none';
    document.body.append(input, label);
    webSwitch = label;
  }
  webSwitch.click();
}

/** A light click: one step of the crown. */
export function tick() {
  if (Platform.OS === 'web') webTick(6);
  else Haptics.selectionAsync().catch(() => {});
}

/** A firmer bump: the crown has reached the first or last section. */
export function bump() {
  if (Platform.OS === 'web') webTick(18);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}
