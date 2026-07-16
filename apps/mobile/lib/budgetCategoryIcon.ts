import { Ionicons } from '@expo/vector-icons';

import { getCategoryIconName, isIconName, type IconName } from '@/constants/categoryOptions';

export const BUDGET_CATEGORY_ICON_GLYPH_COLOR = 'rgba(255,255,255,0.85)';
export const BUDGET_CATEGORY_ICON_WELL_BG = '#28282E';
export const BUDGET_CATEGORY_ICON_WELL_SIZE = 36;
export const BUDGET_CATEGORY_ICON_WELL_RADIUS = 10;
export const BUDGET_CATEGORY_ICON_GLYPH_SIZE = 22;
export const BUDGET_CATEGORY_OUTLINE_STROKE_WIDTH = 2.3;

/** Lucide PascalCase names stored on mock budget categories → filled Ionicons. */
const LUCIDE_BUDGET_ICON_TO_IONICONS: Record<string, IconName> = {
  House: 'home',
  ShoppingBag: 'basket',
  Car: 'car-sport',
  Smartphone: 'phone-portrait',
  Utensils: 'restaurant',
  Gamepad2: 'game-controller',
  Shirt: 'shirt',
  HeartPulse: 'medkit',
  CircleAlert: 'alert-circle',
};

type CategoryIconSource = {
  icon?: string | null;
  name?: string;
  id?: string;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string | null;
};

export type BudgetCategoryDisplayIcon =
  | { kind: 'ionicons-filled'; name: IconName }
  | { kind: 'ionicons-outline'; name: IconName }
  | { kind: 'lucide'; name: string };

function toFilledIoniconsName(icon: IconName): IconName | null {
  if (!icon.endsWith('-outline')) {
    return Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, icon) ? icon : null;
  }

  const filled = icon.slice(0, -'-outline'.length) as IconName;
  return Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, filled) ? filled : null;
}

function resolveStoredIconName(source: CategoryIconSource): IconName | null {
  const stored = source.icon ?? source.categoryIcon;
  if (!stored) return null;

  if (isIconName(stored)) return stored;

  const lucideMatch = LUCIDE_BUDGET_ICON_TO_IONICONS[stored];
  if (lucideMatch) return lucideMatch;

  return null;
}

export function resolveBudgetCategoryDisplayIcon(
  source?: CategoryIconSource | null,
): BudgetCategoryDisplayIcon {
  const stored = resolveStoredIconName(source ?? {});
  const fallback = getCategoryIconName(source);
  const outlineName = stored ?? fallback;
  const filledName = toFilledIoniconsName(outlineName);

  if (filledName) {
    return { kind: 'ionicons-filled', name: filledName };
  }

  const lucideName = source?.icon ?? source?.categoryIcon;
  if (lucideName && LUCIDE_BUDGET_ICON_TO_IONICONS[lucideName] == null && /^[A-Z]/.test(lucideName)) {
    return { kind: 'lucide', name: lucideName };
  }

  return { kind: 'ionicons-outline', name: outlineName };
}
