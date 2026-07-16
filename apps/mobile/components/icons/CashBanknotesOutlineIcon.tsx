import type { ComponentProps } from 'react';
import type { LucideProps } from 'lucide-react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

type CashBanknotesOutlineIconProps = {
  size: number;
  color: string;
  strokeWidth?: number;
};

const ROUND: Pick<ComponentProps<typeof Rect>, 'strokeLinecap' | 'strokeLinejoin'> = {
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

/**
 * Stacked banknotes + coin — outline stroke (svgrepo cash-coin silhouette).
 * Monochrome strokes only; AppIcon passes account tone (primary green on Portefeuille cash rows).
 */
export function CashBanknotesOutlineIcon({
  size,
  color,
  strokeWidth = 2,
}: CashBanknotesOutlineIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={1.75}
        y={2}
        width={13.75}
        height={8.5}
        rx={1.25}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        {...ROUND}
      />
      <Rect
        x={3.75}
        y={4.25}
        width={13.75}
        height={8.5}
        rx={1.25}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        {...ROUND}
      />
      <Rect
        x={5.75}
        y={5.75}
        width={9.75}
        height={5.5}
        rx={0.75}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        {...ROUND}
      />
      <Circle
        cx={10.6}
        cy={8.5}
        r={1.55}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={17.35}
        cy={17.15}
        r={3.85}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={17.35}
        cy={17.15}
        r={2.15}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
      />
    </Svg>
  );
}

/** Lucide-compatible export for AppIcon / selectedLucideIcons. */
export function CashBanknotesStackIcon({
  size = 24,
  color = 'currentColor',
  strokeWidth = 2,
}: LucideProps) {
  return (
    <CashBanknotesOutlineIcon
      size={Number(size)}
      color={String(color)}
      strokeWidth={Number(strokeWidth)}
    />
  );
}
