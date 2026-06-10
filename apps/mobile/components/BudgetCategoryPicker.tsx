import { useMemo } from 'react';

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { getCategoryIconName } from '@/constants/categoryOptions';

import { CHIP_BORDER_WIDTH, CHIP_PADDING_HORIZONTAL, interBoldText, radius, spacing, typography } from '@/constants/theme';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';

import { typographyKit } from '@/constants/typographyKit';

import { partitionBudgetCategories } from '@/lib/categoryInference';

import { tapHaptic } from '@/lib/haptics';

import { useAppTheme } from '@/lib/themeContext';

import type { Category } from '@/types';



type Props = {

  categories: Category[];

  searchText: string;

  selectedId: string | null;

  onSelect: (id: string) => void;

  transferReason?: string;

};



type CategoryChipProps = {

  category: Category;

  selected: boolean;

  onPress: () => void;

};



function CategoryChip({ category, selected, onPress }: CategoryChipProps) {

  const { colors } = useAppTheme();



  return (

    <Pressable

      accessibilityRole="button"

      accessibilityState={{ selected }}

      onPress={onPress}

      style={({ pressed }) => [

        styles.chip,

        {

          backgroundColor: selected ? colors.successMuted : colors.surfaceElevated,

          borderColor: selected ? colors.primary : colors.border,

        },

        pressed && styles.pressed,

      ]}

    >

      <Ionicons

        name={getCategoryIconName(category)}

        size={14}

        color={selected ? colors.primary : colors.textSecondary}

        style={styles.chipIcon}

      />

      <Text

        style={[styles.chipText, singleLineLabelStyle, { color: selected ? colors.primary : colors.text }]}

        numberOfLines={2}

        ellipsizeMode="tail"

        adjustsFontSizeToFit

        minimumFontScale={0.82}

      >

        {category.name}

      </Text>

    </Pressable>

  );

}



export function BudgetCategoryPicker({

  categories,

  searchText,

  selectedId,

  onSelect,

  transferReason,

}: Props) {

  const { colors } = useAppTheme();

  const { suggested, others } = useMemo(

    () => partitionBudgetCategories(categories, searchText, selectedId, { transferReason }),

    [categories, searchText, selectedId, transferReason],

  );



  if (categories.length === 0) {

    return (

      <Text style={[styles.emptyHint, { color: colors.textMuted }]}>

        Aucune catégorie active dans le budget.

      </Text>

    );

  }



  const showSuggestionBlock = suggested && others.length > 0;



  return (

    <View style={styles.wrap}>

      {showSuggestionBlock ? (

        <View style={styles.block}>

          <Text style={[styles.blockLabel, { color: colors.textMuted }]}>Suggestion</Text>

          <View style={styles.chipRow}>

            <CategoryChip

              category={suggested}

              selected={selectedId === suggested.id}

              onPress={() => {

                tapHaptic();

                onSelect(suggested.id);

              }}

            />

          </View>

        </View>

      ) : null}



      <View style={styles.block}>

        {showSuggestionBlock ? (

          <Text style={[styles.blockLabel, { color: colors.textMuted }]}>Autres catégories</Text>

        ) : null}

        <View style={styles.chipRow}>

          {(showSuggestionBlock ? others : categories).map((category) => (

            <CategoryChip

              key={category.id}

              category={category}

              selected={selectedId === category.id}

              onPress={() => {

                tapHaptic();

                onSelect(category.id);

              }}

            />

          ))}

        </View>

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  wrap: {

    gap: spacing.md,

  },

  block: {

    gap: spacing.sm,

  },

  blockLabel: {

    ...typographyKit.microUpper,

    letterSpacing: 0.5,

  },

  chipRow: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: spacing.sm,

  },

  chip: {

    maxWidth: '100%',

    minWidth: 0,

    minHeight: 34,

    flexDirection: 'row',

    alignItems: 'center',

    borderRadius: radius.pill,

    paddingHorizontal: CHIP_PADDING_HORIZONTAL,

    paddingVertical: 7,

  },

  chipIcon: {

    marginRight: 5,

  },

  chipText: {

    ...interBoldText,

    fontSize: typography.meta,

    lineHeight: 16,

    flexShrink: 1,

  },

  emptyHint: {

    ...typographyKit.metaMedium,

  },

  pressed: {

    opacity: 0.74,

  },

});

