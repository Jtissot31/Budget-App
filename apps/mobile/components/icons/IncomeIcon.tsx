import { AppIcon } from '@/components/icons/AppIcon';

type Props = {
  size: number;
  color: string;
  /** Kept for API compat with former PNG stroke prop. */
  strokeWidth?: number;
};

/**
 * Income / Salaire glyph for Historique list rows (`ProtoTransactionRow` / `UserPickedIconWell`).
 * Ionicons `$` (`logo-usd`) — tinted via `color` (typically accent green).
 */
export function IncomeIcon({ size, color }: Props) {
  return <AppIcon family="ionicons" name="logo-usd" size={size} color={color} />;
}
