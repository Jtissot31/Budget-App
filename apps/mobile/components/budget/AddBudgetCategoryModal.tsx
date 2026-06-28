import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheet } from '@/components/BottomSheet';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PrimarySaveButton } from '@/components/PrimarySaveButton';
import { ThemedFormMessage } from '@/components/ThemedFormMessage';
import { spacing, radius, typographyKit } from '@/constants/theme';
import { getCategoryIconName } from '@/constants/categoryOptions';
import { assignCategoryColor } from '@/constants/budgetCategoryColors';
import { addCategory, getCategories } from '@/lib/budgetCategories';
import { upsertCategory, upsertCategoryBudget } from '@/lib/db';
import { formValidationError, type FormFeedback } from '@/lib/formFeedback';
import { successHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

function createEntityId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function AddBudgetCategoryModal({ visible, onClose, onCreated }: Props) {
  const { colors } = useAppTheme();
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [feedback, setFeedback] = useState<FormFeedback | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setLimit('');
    setFeedback(null);
  }, [visible]);

  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setFeedback(formValidationError('Nom requis', 'Indiquez un nom de catégorie.'));
      return;
    }

    const parsedLimit = Number.parseFloat(limit.replace(',', '.'));
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setFeedback(formValidationError('Limite invalide', 'Indiquez une limite mensuelle supérieure à 0.'));
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const existing = await getCategories();
      if (existing.length >= 10) {
        setFeedback(formValidationError('Limite atteinte', 'Maximum 10 catégories budget.'));
        return;
      }

      const id = createEntityId('cat');
      const color = assignCategoryColor(existing.map((category) => category.color));

      await upsertCategory({
        id,
        name: trimmedName,
        icon: getCategoryIconName({ name: trimmedName }),
        color,
      });
      await Promise.all([
        upsertCategoryBudget(id, parsedLimit),
        addCategory({
          id,
          name: trimmedName,
          icon: getCategoryIconName({ name: trimmedName }),
          color,
          limit: parsedLimit,
          spent: 0,
          period: 'monthly',
          created_by: 'user',
          createdAt: new Date().toISOString(),
        }),
      ]);
      successHaptic();
      onCreated?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de créer la catégorie.';
      setFeedback(formValidationError('Erreur', message));
    } finally {
      setSaving(false);
    }
  }, [limit, name, onClose, onCreated]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nouvelle catégorie">
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={[styles.label, typographyKit.metaMedium, { color: colors.textMuted }]}>Nom</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ex. Épicerie"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.input,
              },
            ]}
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, typographyKit.metaMedium, { color: colors.textMuted }]}>
            Limite mensuelle
          </Text>
          <NumericAmountInput value={limit} onChangeText={setLimit} />
        </View>

        {feedback ? <ThemedFormMessage {...feedback} /> : null}

        <PrimarySaveButton label="Ajouter" onPress={() => void handleSave()} loading={saving} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
});
