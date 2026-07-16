import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import {
  PLAN_FINANCE_CONTAINER,
  planFinanceContainerPressedStyle,
} from '@/constants/planFinanceKit';
import { jakartaSemiboldText, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  onPress: () => void;
};

export function BudgetCategoryAddRow({ onPress }: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ajouter une catégorie budget"
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [pressed && planFinanceContainerPressedStyle()]}
    >
      <PlanFinanceContainer style={styles.card}>
        <View style={styles.mainRow}>
          <BudgetCategoryIcon variant="add" />

          <Text
            style={[styles.label, jakartaSemiboldText, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            Ajouter une catégorie
          </Text>
        </View>
      </PlanFinanceContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    padding: PLAN_FINANCE_CONTAINER.padding.row,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
  },
});
