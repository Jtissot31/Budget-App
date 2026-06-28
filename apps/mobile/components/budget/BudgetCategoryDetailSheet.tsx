import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BottomSheet } from '@/components/BottomSheet';
import { CategoryBudgetProgress } from '@/components/CategoryBudgetProgress';
import { ModifierButton } from '@/components/ModifierButton';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { spacing, containerSurfaceStyle, radius, typographyKit } from '@/constants/theme';
import { updateCategoryLimit } from '@/lib/budgetCategories';
import type { BudgetCategoryUiModel } from '@/lib/budgetCategoryModel';
import { upsertCategoryBudget } from '@/lib/db';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { CategoryBudget } from '@/types';

type Props = {
  category: BudgetCategoryUiModel | null;
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function BudgetCategoryDetailSheet({ category, visible, onClose, onSaved }: Props) {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
  const [editing, setEditing] = useState(false);
  const [limitDraft, setLimitDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!category) return;
    setLimitDraft(String(Math.max(0, category.limit)));
    setEditing(false);
  }, [category?.id, category?.limit, visible]);

  const budgetForProgress = useMemo((): CategoryBudget | null => {
    if (!category) return null;
    return {
      categoryId: category.id,
      categoryName: category.name,
      categoryIcon: category.icon,
      categoryColor: category.color,
      limitAmount: category.limit,
      spent: category.spent,
    };
  }, [category]);

  const handleSaveLimit = useCallback(async () => {
    if (!category) return;
    const parsed = Number.parseFloat(limitDraft.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed < 0) return;

    setSaving(true);
    try {
      await Promise.all([
        upsertCategoryBudget(category.id, parsed),
        updateCategoryLimit(category.id, parsed),
      ]);
      successHaptic();
      setEditing(false);
      onSaved?.();
    } finally {
      setSaving(false);
    }
  }, [category, limitDraft, onSaved]);

  const openTransactions = useCallback(() => {
    if (!category) return;
    tapHaptic();
    onClose();
    router.push({
      pathname: '/budget-category-transactions',
      params: { id: category.id, name: category.name },
    });
  }, [category, onClose, router]);

  if (!category) return null;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={category.name}
      titleAccessory={
        !editing ? (
          <ModifierButton
            accessibilityLabel="Modifier la limite mensuelle"
            onPress={() => setEditing(true)}
            hitSlop={10}
          />
        ) : null
      }
    >
      <View style={styles.body}>
        <View style={[styles.colorStripe, { backgroundColor: category.color }]} />

        {budgetForProgress ? (
          <CategoryBudgetProgress budget={budgetForProgress} />
        ) : null}

        {editing ? (
          <View style={styles.editBlock}>
            <Text style={[styles.fieldLabel, typographyKit.metaMedium, { color: colors.textMuted }]}>
              Limite mensuelle
            </Text>
            <NumericAmountInput value={limitDraft} onChangeText={setLimitDraft} autoFocus />
            <PrimarySaveButton
              label="Enregistrer"
              onPress={() => void handleSaveLimit()}
              loading={saving}
            />
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={openTransactions}
          style={({ pressed }) => [
            styles.linkRow,
            containerSurfaceStyle(isLight),
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="list-outline" size={18} color={colors.text} />
          <Text style={[styles.linkLabel, { color: colors.text }]}>Voir les transactions</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing.lg,
  },
  colorStripe: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  editBlock: {
    gap: spacing.sm,
  },
  fieldLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.card,
  },
  linkLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
});
