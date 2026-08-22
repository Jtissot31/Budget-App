import { Image } from 'react-native';

/** Monochrome income glyph — black outline on transparent; tint via `tintColor`. */
export const INCOME_ICON = require('@/assets/icons/income.png');

type Props = {
  size: number;
  color: string;
  /** Kept for API compat; PNG stroke is baked into the asset. */
  strokeWidth?: number;
};

/**
 * Income outline for Historique list rows (`ProtoTransactionRow` / `TransactionAvatar`).
 * PNG template so callers can tint success green (or well-glyph white).
 */
export function IncomeIcon({ size, color }: Props) {
  return (
    <Image
      source={INCOME_ICON}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
