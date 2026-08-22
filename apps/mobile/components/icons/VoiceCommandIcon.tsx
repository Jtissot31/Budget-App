import Svg, { Rect } from 'react-native-svg';

/**
 * Waveform à 5 barres — glyphe du FAB dictée vocale (Transactions).
 * SVG (comme `@/components/icons/PlusFabIcon`) : couleur fiable via `fill`, sans PNG / tintColor.
 */
type VoiceCommandIconProps = {
  size: number;
  color: string;
};

/** Hauteurs des barres dans un viewBox 24×24 (court → haut → court). */
const BAR_HEIGHTS = [8, 14, 20, 14, 8] as const;
const BAR_WIDTH = 2.75;
const BAR_GAP = 1.75;
const BARS_WIDTH = BAR_HEIGHTS.length * BAR_WIDTH + (BAR_HEIGHTS.length - 1) * BAR_GAP;
const BARS_LEFT = (24 - BARS_WIDTH) / 2;

export function VoiceCommandIcon({ size, color }: VoiceCommandIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {BAR_HEIGHTS.map((height, index) => {
        const x = BARS_LEFT + index * (BAR_WIDTH + BAR_GAP);
        const y = (24 - height) / 2;
        return (
          <Rect
            key={`voice-bar-${index}`}
            x={x}
            y={y}
            width={BAR_WIDTH}
            height={height}
            rx={BAR_WIDTH / 2}
            ry={BAR_WIDTH / 2}
            fill={color}
          />
        );
      })}
    </Svg>
  );
}
