/**
 * The app's own fonts as @font-face rules for a printed page. The print
 * views can't see the fonts the app has loaded, so on a phone they go in as
 * data (about 2 MB), and on the web as links to the same files.
 */
import { Amiri_400Regular } from '@expo-google-fonts/amiri/400Regular';
import { Amiri_700Bold } from '@expo-google-fonts/amiri/700Bold';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_400Regular_Italic } from '@expo-google-fonts/literata/400Regular_Italic';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import { NotoSansCoptic_400Regular } from '@expo-google-fonts/noto-sans-coptic/400Regular';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

const FACES: [family: string, weight: number, style: 'normal' | 'italic', module: number][] = [
  ['Amiri', 400, 'normal', Amiri_400Regular],
  ['Amiri', 700, 'normal', Amiri_700Bold],
  ['Literata', 400, 'normal', Literata_400Regular],
  ['Literata', 400, 'italic', Literata_400Regular_Italic],
  ['Literata', 600, 'normal', Literata_600SemiBold],
  ['Noto Sans Coptic', 400, 'normal', NotoSansCoptic_400Regular],
];

async function source(module: number) {
  const asset = Asset.fromModule(module);
  if (Platform.OS === 'web') return new URL(asset.uri, document.baseURI).href;
  await asset.downloadAsync();
  return `data:font/ttf;base64,${await new File(asset.localUri ?? asset.uri).base64()}`;
}

let css: Promise<string> | null = null;

export function printFonts(): Promise<string> {
  if (!css) {
    css = Promise.all(FACES.map(async ([family, weight, style, module]) =>
      `@font-face { font-family: '${family}'; font-weight: ${weight}; font-style: ${style}; src: url("${await source(module)}") format("truetype"); }`,
    )).then((rules) => rules.join('\n'));
    css.catch(() => { css = null; });
  }
  return css;
}
