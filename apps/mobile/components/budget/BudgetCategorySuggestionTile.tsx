import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import {
  type BudgetCategorySuggestion,
} from '@/constants/categoryOptions';
import {
  jakartaSemiboldText,
  radius,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type { BudgetCategorySuggestion };

type Props = {
  suggestion: BudgetCategorySuggestion;
  onPress: (suggestion: BudgetCategorySuggestion) => void;
};

const ICON_WELL = 32;
const ICON_GLYPH = 16;

/** Empty-state suggestion tile — same chrome as BudgetCategoryRow, no amounts. */
export function BudgetCategorySuggestionTile({ suggestion, onPress }: Props) {
  const { colors, isLight } = useAppTheme();
  const iconWellBg = isLight ? colors.surfaceElevated : colors.input;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Suggestion ${suggestion.name}. Créer cette catégorie.`}
      onPress={() => {
        tapHaptic();
        onPress(suggestion);
      }}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.containerBackground,
          borderColor: colors.containerBorder,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWell, { backgroundColor: iconWellBg }]}>
          <BudgetCategoryIcon
            icon={suggestion.icon}
            name={suggestion.name}
            id={suggestion.id}
            wellSize={ICON_WELL}
            glyphSize={ICON_GLYPH}
          />
        </View>
        <Text
          style={[styles.name, jakartaSemiboldText, { color: colors.text }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {suggestion.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minWidth: 0,
    padding: 14,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.82,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  iconWell: {
    width: ICON_WELL,
    height: ICON_WELL,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    lineHeight: 17,
    letterSpacing: -0.1,
    includeFontPadding: false,
  },
});
