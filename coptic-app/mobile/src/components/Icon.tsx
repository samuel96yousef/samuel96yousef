import {
  ALargeSmall, BookOpen, BookOpenText, Calendar, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Info, List, Printer,
  Search, Share, SlidersHorizontal, Smartphone, Sun, X, type LucideIcon,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

/**
 * The app's icons: Lucide's line icons, all on one 24-unit grid with the same
 * stroke, so they sit centred and match one another. Lucide has nothing for
 * the Agpeya's candle, a Bible with a cross or the Kholagy's chalice; those
 * are drawn here on the same grid, in the same style.
 */
const LUCIDE = {
  today: Sun,
  readings: BookOpenText,
  book: BookOpen,
  gear: SlidersHorizontal,
  chevL: ChevronLeft,
  chevR: ChevronRight,
  chevU: ChevronUp,
  chevD: ChevronDown,
  x: X,
  search: Search,
  info: Info,
  phone: Smartphone,
  list: List,
  calendar: Calendar,
  print: Printer,
  share: Share,
  textSize: ALargeSmall,
} satisfies Record<string, LucideIcon>;

const OWN = {
  // A candle: the flame, the stick and its holder.
  prayers: 'M12 2.5c1.6 1.7 2 3.3 0 5-2-1.7-1.6-3.3 0-5zM9.5 10h5v10h-5zM6.5 21h11',
  // A Bible, closed, with a cross on its cover.
  bible: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20M12 6v7M9.5 8.5h5',
  // A chalice with a cross above it.
  liturgy: 'M8 22h8M12 15v7M6 6h12a6 6 0 0 1-12 0zM12 2v2M11 3h2',
} as const;

export type IconName = keyof typeof LUCIDE | keyof typeof OWN;

export function Icon({ name, size = 24, color, strokeWidth = 1.75 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  if (name in OWN) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
        <Path d={OWN[name as keyof typeof OWN]} />
      </Svg>
    );
  }
  const L = LUCIDE[name as keyof typeof LUCIDE];
  return <L size={size} color={color} strokeWidth={strokeWidth} />;
}
