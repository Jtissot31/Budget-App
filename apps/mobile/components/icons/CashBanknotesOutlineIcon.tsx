import type { LucideProps } from 'lucide-react-native';
import { Asset } from 'expo-asset';
import { Image } from 'expo-image';

/** Colorful stacked banknotes — portefeuille / Argent Cash (no monochrome tint). */
export const CASH_BANKNOTES_ICON = require('@/assets/icons/cash-banknotes.png');

let cachedLogoUri: string | null = null;

/**
 * Metro / Expo asset URI for logo tiles (`RemoteLogoImage` / `LogoIconFrame`).
 * Uses `expo-asset` — `Image.resolveAssetSource` is missing on web.
 */
export function cashBanknotesLogoUri(): string {
  if (cachedLogoUri) return cachedLogoUri;
  cachedLogoUri = Asset.fromModule(CASH_BANKNOTES_ICON).uri ?? '';
  return cachedLogoUri;
}

type CashBanknotesOutlineIconProps = {
  size: number;
  /** Ignored — illustration keeps its own colors. */
  color?: string;
  strokeWidth?: number;
};

/**
 * Stacked banknotes illustration for cash money accounts.
 * Full-color PNG (transparent bg); do not apply theme green tint.
 */
export function CashBanknotesOutlineIcon({ size }: CashBanknotesOutlineIconProps) {
  return (
    <Image
      source={CASH_BANKNOTES_ICON}
      style={{ width: size, height: size }}
      contentFit="contain"
      contentPosition="center"
      accessibilityLabel="Argent cash"
    />
  );
}

/** Lucide-compatible export for AppIcon / selectedLucideIcons. */
export function CashBanknotesStackIcon({
  size = 24,
}: LucideProps) {
  return <CashBanknotesOutlineIcon size={Number(size)} />;
}
