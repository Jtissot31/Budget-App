import { LegacyVectorIcon } from '@/components/icons/LegacyVectorIcon';
import { AlertTriangleIcon } from '@/components/icons/AlertTriangleIcon';
import type { HomeAlertPreviewIconName } from '@/lib/alertPresentation';

type Props = {
  icon: HomeAlertPreviewIconName;
  color: string;
  size?: number;
};

/** Accueil / Messages / Types d’alertes — shared preview glyph. */
export function HomeAlertGlyph({ icon, color, size = 16 }: Props) {
  if (icon === 'alert-triangle') {
    return <AlertTriangleIcon size={size} color={color} />;
  }
  return (
    <LegacyVectorIcon family="ionicons" name="information-circle" size={size} color={color} />
  );
}
