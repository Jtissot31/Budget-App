import { AppIcon } from '@/components/icons/AppIcon';

type Props = {
  size: number;
  color: string;
  /** Kept for API compat with former PNG stroke prop. */
  strokeWidth?: number;
};

/**
 * Income / Salaire glyph for Historique list rows (`ProtoTransactionRow` / `UserPickedIconWell`).
 * Ionicons `trending-up`, the counterpart of the expense fallback's `trending-down`.
 */
export function IncomeIcon({ size, color }: Props) {
  return <AppIcon family="ionicons" name="trending-up" size={size} color={color} />;
}
