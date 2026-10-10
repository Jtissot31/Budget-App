import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';


import {
  BUDGET_CATEGORY_ICON_GLYPH_COLOR,
  BUDGET_CATEGORY_ICON_GLYPH_SIZE,
  BUDGET_CATEGORY_ICON_WELL_SIZE,
  resolveBudgetCategoryDisplayIcon,
} from '@/lib/budgetCategoryIcon';
import type { IconName } from '@/constants/categoryOptions';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  icon?: string | null;
  name?: string;
  id?: string;
  glyphSize?: number;
  wellSize?: number;
  style?: StyleProp<ViewStyle>;
  /** Renders the neutral “add category” glyph in the standard icon slot. */
  variant?: 'category' | 'add';
  /** Category colour: glyph in that colour on a soft tinted rounded well. */
  tint?: string | null;
};

export function BudgetCategoryIcon({
  icon,
  name,
  id,
  glyphSize = BUDGET_CATEGORY_ICON_GLYPH_SIZE,
  wellSize = BUDGET_CATEGORY_ICON_WELL_SIZE,
  style,
  variant = 'category',
  tint,
}: Props) {
  const { isLight } = useAppTheme();
  const glyphColor = tint ?? (isLight ? 'rgba(17,17,17,0.82)' : BUDGET_CATEGORY_ICON_GLYPH_COLOR);

  const glyph =
    variant === 'add' ? (
      <AppIcon family="ionicons" name="add" size={glyphSize} color={glyphColor} />
    ) : (
      <BudgetCategoryGlyph
        icon={icon}
        name={name}
        id={id}
        size={glyphSize}
        color={glyphColor}
      />
    );

  return (
    <View
      style={[
        styles.slot,
        {
          width: wellSize,
          height: wellSize,
        },
        tint ? { backgroundColor: tintBackground(tint), borderRadius: Math.round(wellSize * 0.3) } : null,
        style,
      ]}
    >
      {glyph}
    </View>
  );
}

/** Hex (#RRGGBB) → same colour at ~16 % opacity; other formats fall back to a neutral well. */
function tintBackground(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}29` : 'rgba(255,255,255,0.08)';
}

function BudgetCategoryGlyph({
  icon,
  name,
  id,
  size,
  color,
}: {
  icon?: string | null;
  name?: string;
  id?: string;
  size: number;
  color: string;
}) {
  const displayIcon = resolveBudgetCategoryDisplayIcon({ icon, name, id });

  if (displayIcon.kind === 'ionicons-filled') {
    return <AppIcon family="ionicons" name={displayIcon.name} size={size} color={color} />;
  }

  if (displayIcon.kind === 'lucide' || displayIcon.kind === 'ionicons-outline') {
    const fallback = resolveBudgetCategoryDisplayIcon({ name, id });
    const ionName: IconName =
      fallback.kind === 'ionicons-filled' ? fallback.name : 'pricetag';
    return <AppIcon family="ionicons" name={ionName} size={size} color={color} />;
  }

  return <AppIcon family="ionicons" name={displayIcon.name} size={size} color={color} />;
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
});
