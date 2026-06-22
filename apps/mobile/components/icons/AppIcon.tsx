import type { LucideIcon } from 'lucide-react-native';
import { isDesignSystemLucideIcon } from '@/lib/iconMigration/designSystemIconSelection';
import { resolveLucideNameForLegacy } from '@/lib/iconMigration/iconMap';
import type { LegacyIconFamily } from '@/lib/iconMigration/legacyIconBackup';
import { getSelectedLucideIcon } from '@/lib/iconMigration/selectedLucideIcons';
import { LegacyVectorIcon } from '@/components/icons/LegacyVectorIcon';

export type AppIconProps = {
  family: LegacyIconFamily;
  /** Legacy icon name (Ionicons / MCI / Material). */
  name: string;
  size: number;
  color: string;
  strokeWidth?: number;
  /** Slightly bolder stroke for active tab states. */
  focused?: boolean;
};

export function AppIcon({
  family,
  name,
  size,
  color,
  strokeWidth = 2,
  focused = false,
}: AppIconProps) {
  const lucideName = resolveLucideNameForLegacy(family, name);
  const LucideComponent: LucideIcon | null =
    lucideName != null && isDesignSystemLucideIcon(lucideName)
      ? getSelectedLucideIcon(lucideName)
      : null;

  if (LucideComponent) {
    return (
      <LucideComponent
        size={size}
        color={color}
        strokeWidth={focused ? Math.max(strokeWidth, 2.35) : strokeWidth}
      />
    );
  }

  return <LegacyVectorIcon family={family} name={name} size={size} color={color} />;
}
