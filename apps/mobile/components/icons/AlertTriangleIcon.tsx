import { Image } from 'react-native';

/** Monochrome alert-2 (svgrepo) — black outline on transparent; tint via `tintColor`. */
export const ALERT_TRIANGLE_ICON = require('@/assets/icons/alert-triangle.png');

type Props = {
  size: number;
  color: string;
  /** Kept for API compat; PNG stroke is baked into the asset. */
  strokeWidth?: number;
};

/**
 * Triangle + exclamation (svgrepo alert-2 / Accueil Notifications & alertes).
 * PNG template so callers can tint yellow (à venir) vs red (urgent).
 */
export function AlertTriangleIcon({ size, color }: Props) {
  return (
    <Image
      source={ALERT_TRIANGLE_ICON}
      style={{ width: size, height: size, tintColor: color }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
