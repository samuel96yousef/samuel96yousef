import Svg, { Circle, G, Path } from 'react-native-svg';

/** Coptic cross: flared arms ending in three buds, with a ring at the centre. */
function Arm({ rotate }: { rotate: number }) {
  return (
    <G transform={`rotate(${rotate} 12 12)`}>
      <Path d="M10.4 12V5.6Q10.4 4.7 9.3 4.3H14.7Q13.6 4.7 13.6 5.6V12Z" />
      <Circle cx={12} cy={2.2} r={1.55} />
      <Circle cx={9.6} cy={3.4} r={1.2} />
      <Circle cx={14.4} cy={3.4} r={1.2} />
    </G>
  );
}

export function CopticCross({ size = 20, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      {[0, 90, 180, 270].map((r) => <Arm key={r} rotate={r} />)}
      <Path fillRule="evenodd" d="M12 8.6a3.4 3.4 0 1 1 0 6.8a3.4 3.4 0 1 1 0-6.8zM12 10.5a1.5 1.5 0 1 0 0 3a1.5 1.5 0 1 0 0-3z" />
    </Svg>
  );
}
