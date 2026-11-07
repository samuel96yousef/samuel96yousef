import { createElement, type ComponentType } from 'react';
import Svg, { Circle, Ellipse, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

import { LUCIDE, type LucideNode } from './lucide';

/**
 * The app's icons: Lucide's line icons (copied into lucide.ts by `npm run
 * icons`), all on one 24-unit grid with the same stroke, so they sit centred
 * and match one another. Lucide has nothing for the Agpeya's candle, a Bible
 * with a cross or the Kholagy's chalice; those are drawn here on the same
 * grid, in the same style.
 */
const NAMES = {
  today: 'sun',
  readings: 'book-open-text',
  book: 'book-open',
  gear: 'sliders-horizontal',
  chevL: 'chevron-left',
  chevR: 'chevron-right',
  chevU: 'chevron-up',
  chevD: 'chevron-down',
  x: 'x',
  search: 'search',
  info: 'info',
  phone: 'smartphone',
  list: 'list',
  calendar: 'calendar',
  print: 'printer',
  share: 'share',
  textSize: 'a-large-small',
  hymns: 'eighth-notes',
} as const;

const OWN = {
  // A candle: the flame, the stick and its holder.
  prayers: 'M12 2.5c1.6 1.7 2 3.3 0 5-2-1.7-1.6-3.3 0-5zM9.5 10h5v10h-5zM6.5 21h11',
  // A Bible, closed, with a cross on its cover.
  bible: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20M12 6v7M9.5 8.5h5',
  // A chalice with a cross above it.
  liturgy: 'M8 22h8M12 15v7M6 6h12a6 6 0 0 1-12 0zM12 2v2M11 3h2',
} as const;

// Lucide's attributes are strings, which the SVG elements take as they are.
const TAGS = { path: Path, circle: Circle, rect: Rect, line: Line, polyline: Polyline, polygon: Polygon, ellipse: Ellipse } as unknown as Record<LucideNode[number][0], ComponentType<Record<string, string | number>>>;

export type IconName = keyof typeof NAMES | keyof typeof OWN;

export function Icon({ name, size = 24, color, strokeWidth = 1.75 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {name in OWN
        ? <Path d={OWN[name as keyof typeof OWN]} />
        : LUCIDE[NAMES[name as keyof typeof NAMES]].map(([tag, attrs], i) => createElement(TAGS[tag], { key: i, ...attrs }))}
    </Svg>
  );
}
