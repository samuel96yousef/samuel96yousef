import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

const PATHS = {
  today: 'M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6',
  readings: 'M3 5.6c2.6-1.1 5.6-1 9 .9 3.4-1.9 6.4-2 9-.9v13c-2.6-1.1-5.6-1-9 .9-3.4-1.9-6.4-2-9-.9zM12 6.5v13',
  prayers: 'M12 2.8c1.3 1.5 1.7 2.8 0 4.3-1.7-1.5-1.3-2.8 0-4.3zM9.6 9.2h4.8v11H9.6zM7.5 20.4h9',
  bible: 'M6.5 3.5h11a1 1 0 0 1 1 1v15.7h-11A1.8 1.8 0 0 1 5.7 18.4V5.3a1.8 1.8 0 0 1 .8-1.8zM5.7 18.4a1.8 1.8 0 0 1 1.8-1.8h11M12 7v6M9.8 9.3h4.4',
  gear: 'M4 7h9M17 7h3M4 17h3M11 17h9',
  book: 'M2.8 5.5h7.4a1.8 1.8 0 0 1 1.8 1.8v12a1.6 1.6 0 0 0-1.6-1.6H2.8zM21.2 5.5h-7.4A1.8 1.8 0 0 0 12 7.3v12a1.6 1.6 0 0 1 1.6-1.6h7.6z',
  chevL: 'M15 5l-7 7 7 7',
  chevR: 'M9 5l7 7-7 7',
  x: 'M6.5 6.5l11 11M17.5 6.5l-11 11',
  search: 'M15.5 15.5L20 20',
  liturgy: 'M8 20.5h8M9.5 20.5c0-3 1-4.5 2.5-5.5 1.5 1 2.5 2.5 2.5 5.5M6.5 8.5h11a5.5 5.5 0 0 1-11 0zM12 3v2.5M10.8 4.2h2.4',
  info: 'M12 11v5.5M12 7.6v.4',
  phone: 'M10.5 18.2h3',
  list: 'M9.5 6.5h10M9.5 12h10M9.5 17.5h10',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, color, strokeWidth = 1.7 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {name === 'today' && <Circle cx={12} cy={12} r={4.2} />}
      {name === 'gear' && (<G><Circle cx={15} cy={7} r={2.1} /><Circle cx={9} cy={17} r={2.1} /></G>)}
      {name === 'search' && <Circle cx={10.5} cy={10.5} r={6} />}
      {name === 'info' && <Circle cx={12} cy={12} r={9} />}
      {name === 'phone' && <Rect x={7} y={2.8} width={10} height={18.4} rx={2.4} />}
      {name === 'list' && (<G><Circle cx={5} cy={6.5} r={0.5} /><Circle cx={5} cy={12} r={0.5} /><Circle cx={5} cy={17.5} r={0.5} /></G>)}
      <Path d={PATHS[name]} />
    </Svg>
  );
}
