import Svg, { Rect } from 'react-native-svg';

/**
 * Shared bold “+” for header add chips and the green Transactions FAB.
 * Filled bars (not outline) so weight stays crisp at small sizes.
 */
type PlusFabIconProps = {
  size: number;
  color: string;
};

/** ViewBox 24×24 — arm thickness was ~2; bumped slightly for visibility. */
const ARM = 2.75;
const SPAN = 14;
const CENTER = 12;

export function PlusFabIcon({ size, color }: PlusFabIconProps) {
  const halfArm = ARM / 2;
  const halfSpan = SPAN / 2;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={CENTER - halfSpan}
        y={CENTER - halfArm}
        width={SPAN}
        height={ARM}
        rx={halfArm}
        ry={halfArm}
        fill={color}
      />
      <Rect
        x={CENTER - halfArm}
        y={CENTER - halfSpan}
        width={ARM}
        height={SPAN}
        rx={halfArm}
        ry={halfArm}
        fill={color}
      />
    </Svg>
  );
}
