import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

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
};

export function BudgetCategoryIcon({
  icon,
  name,
  id,
  glyphSize = BUDGET_CATEGORY_ICON_GLYPH_SIZE,
  wellSize = BUDGET_CATEGORY_ICON_WELL_SIZE,
  style,
  variant = 'category',
}: Props) {
  const { isLight } = useAppTheme();
  const glyphColor = isLight ? 'rgba(17,17,17,0.82)' : BUDGET_CATEGORY_ICON_GLYPH_COLOR;

  const glyph =
    variant === 'add' ? (
      <Ionicons name="add" size={glyphSize} color={glyphColor} />
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
        style,
      ]}
    >
      {glyph}
    </View>
  );
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
    return <Ionicons name={displayIcon.name} size={size} color={color} />;
  }

  if (displayIcon.kind === 'lucide' || displayIcon.kind === 'ionicons-outline') {
    const fallback = resolveBudgetCategoryDisplayIcon({ name, id });
    const ionName: IconName =
      fallback.kind === 'ionicons-filled' ? fallback.name : 'pricetag';
    return <Ionicons name={ionName} size={size} color={color} />;
  }

  return <Ionicons name={displayIcon.name} size={size} color={color} />;
}

const styles = StyleSheet.create({
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
});
