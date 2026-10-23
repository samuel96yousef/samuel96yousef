// Copies the drawings of the Lucide icons the app uses into src/components/lucide.ts.
// Run `npm run icons` after changing the list. Lucide is ISC licensed.
import { readFileSync, writeFileSync } from 'node:fs';

const ICONS = [
  'a-large-small', 'book-open', 'book-open-text', 'calendar', 'chevron-down', 'chevron-left', 'chevron-right', 'chevron-up',
  'info', 'list', 'printer', 'search', 'share', 'sliders-horizontal', 'smartphone', 'sun', 'x',
];

const dir = new URL('../node_modules/lucide-react-native/', import.meta.url).pathname;
const version = JSON.parse(readFileSync(`${dir}package.json`, 'utf8')).version;
const entries = ICONS.map((name) => {
  const src = readFileSync(`${dir}dist/esm/icons/${name}.mjs`, 'utf8');
  // The drawing is the array after "node:", up to the end of the data object.
  const node = src.slice(src.indexOf('node: [') + 6, src.indexOf('\n};', src.indexOf('node: [')))
    .replace(/,\s*key: "[^"]*"/g, '');
  return `  '${name}': ${node.trim()},`;
});
writeFileSync('src/components/lucide.ts', `/**
 * Drawings of the Lucide icons the app uses (lucide-react-native ${version}, ISC
 * licence, https://lucide.dev), copied by scripts/lucide_icons.mjs so that only
 * these icons, not the whole set, end up in the app. Do not edit by hand.
 */
export type LucideNode = [tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse', attrs: Record<string, string>][];

export const LUCIDE: Record<string, LucideNode> = {
${entries.join('\n')}
};
`);
console.log(`Wrote ${ICONS.length} icons`);
