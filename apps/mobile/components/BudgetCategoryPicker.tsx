import { useMemo } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { ChipSelectField } from '@/components/ChipSelectField';
import { SettingsSelectField } from '@/components/SettingsSelectField';
import type { SettingsPickerOption } from '@/components/SettingsPickerSheet';
import { BUDGET_CATEGORY_PICKER_EMPTY_HINT } from '@/lib/budgetCategories';
import { partitionBudgetCategories } from '@/lib/categoryInference';
import type { Category } from '@/types';

type Props = {
  categories: Category[];
  searchText: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  transferReason?: string;
  label?: string;
  /** Quieter nested labels (e.g. inside ARTICLES) vs major section eyebrows. */
  labelStyle?: StyleProp<TextStyle>;
  /** `chips` = inline scrolling chips (add-transaction form); `sheet` = field + bottom-sheet list. */
  variant?: 'sheet' | 'chips';
};

export function BudgetCategoryPicker({
  categories,
  searchText,
  selectedId,
  onSelect,
  transferReason,
  label = 'Catégorie',
  labelStyle,
  variant = 'sheet',
}: Props) {
  const { suggested } = useMemo(
    () => partitionBudgetCategories(categories, searchText, selectedId, { transferReason }),
    [categories, searchText, selectedId, transferReason],
  );

  const options = useMemo<SettingsPickerOption<string>[]>(() => {
    const mapped = categories.map((category) => ({
      id: category.id,
      label: category.name,
      budgetCategoryIcon: { icon: category.icon, name: category.name },
      description:
        suggested && suggested.id === category.id && categories.length > 1
          ? 'Suggestion'
          : undefined,
    }));

    if (!suggested) return mapped;

    // Surface the suggested category first, matching prior picker priority.
    return [
      ...mapped.filter((option) => option.id === suggested.id),
      ...mapped.filter((option) => option.id !== suggested.id),
    ];
  }, [categories, suggested]);

  const Field = variant === 'chips' ? ChipSelectField : SettingsSelectField;
  return (
    <Field
      label={label}
      labelStyle={labelStyle}
      options={options}
      selectedId={selectedId ?? ''}
      onSelect={onSelect}
      pickerTitle="Catégorie"
      placeholder="Choisir une catégorie"
      emptyHint={BUDGET_CATEGORY_PICKER_EMPTY_HINT}
    />
  );
}
