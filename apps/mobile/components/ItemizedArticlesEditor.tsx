import { useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getCategoryIconName } from '@/constants/categoryOptions';
import { containerSurfaceStyle, jakartaExtraBoldText, radius, spacing, typography } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
import { getCategorySearchChoices, inferCategoryId } from '@/lib/categoryInference';
import { tapHaptic } from '@/lib/haptics';
import {
  formatNumberDisplay,
  formatNumberInputFromValue,
  parseFormattedNumberOrZero,
} from '@/lib/formatNumber';
import { useAppTheme } from '@/lib/themeContext';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import type { Category } from '@/types';

export type ItemizedRow = {
  id: string;
  name: string;
  price: string;
  categoryId: string | null;
};

type Props = {
  items: ItemizedRow[];
  categories: Category[];
  merchantHint?: string;
  compact?: boolean;
  showHeader?: boolean;
  showTotal?: boolean;
  onChange: (items: ItemizedRow[]) => void;
};

function parseMoney(raw: string): number {
  return parseFormattedNumberOrZero(raw);
}

function formatMoneyInput(value: number): string {
  return formatNumberInputFromValue(value);
}

export function ItemizedArticlesEditor({
  items,
  categories,
  merchantHint = '',
  compact = false,
  showHeader = true,
  showTotal = true,
  onChange,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);
  const [categoryPickerItemId, setCategoryPickerItemId] = useState<string | null>(null);
  const [itemCategoryQuery, setItemCategoryQuery] = useState('');

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const rows = useMemo(
    () =>
      items.map((item) => {
        const itemSearchText = item.name.trim() || merchantHint;
        const inferredCategoryId = inferCategoryId(itemSearchText, categories, null);
        const detectedCategoryId = item.categoryId ?? inferredCategoryId;
        return {
          ...item,
          detectedCategoryId,
          detectedCategory: detectedCategoryId ? categoryById.get(detectedCategoryId) : undefined,
          hasManualCategory: Boolean(item.categoryId),
        };
      }),
    [categories, categoryById, items, merchantHint],
  );

  const total = useMemo(() => rows.reduce((sum, item) => sum + parseMoney(item.price), 0), [rows]);

  const updateItem = (id: string, patch: Partial<Omit<ItemizedRow, 'id'>>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const addItem = () => {
    tapHaptic();
    onChange([
      ...items,
      {
        id: `${Date.now()}-${items.length}`,
        name: '',
        price: '',
        categoryId: null,
      },
    ]);
  };

  const removeItem = (id: string) => {
    tapHaptic();
    onChange(items.filter((item) => item.id !== id));
    if (categoryPickerItemId === id) {
      setCategoryPickerItemId(null);
      setItemCategoryQuery('');
    }
  };

  return (
    <View style={styles.wrap}>
      {showHeader ? (
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Articles</Text>
          <Text style={[styles.headerHint, { color: colors.textMuted }]}>
            Nom, prix et catégorie par ligne
          </Text>
        </View>
      ) : null}

      <View style={[styles.table, surface, { borderRadius: radius.lg }]}>
        <View style={[styles.tableHead, { borderBottomColor: colors.border }]}>
          <Text style={[styles.colHead, styles.colName, { color: colors.textMuted }]}>Article</Text>
          <Text style={[styles.colHead, styles.colPrice, { color: colors.textMuted }]}>Prix</Text>
          <View style={styles.colAction} />
        </View>

        {rows.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Ajoute une ligne ci-dessous ou scanne un reçu pour remplir automatiquement.
            </Text>
          </View>
        ) : null}

        {rows.map((item, index) => (
          <View
            key={item.id}
            style={[
              styles.itemBlock,
              index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <View style={styles.itemRow}>
              <TextInput
                style={[
                  styles.nameInput,
                  compact ? styles.compactInput : null,
                  { color: colors.text, backgroundColor: colors.input, borderColor: colors.border },
                ]}
                placeholder="Nom de l'article"
                placeholderTextColor={colors.textMuted}
                value={item.name}
                onChangeText={(value) => updateItem(item.id, { name: value })}
              />
              <View style={[styles.priceWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <NumericAmountInput
                  style={[styles.priceInput, { color: colors.text }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  value={item.price}
                  onChangeText={(value) => updateItem(item.id, { price: value })}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.currency, { color: colors.textMuted }]}>$</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retirer l'article"
                onPress={() => removeItem(item.id)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeBtn, pressed && styles.pressed]}
              >
                <AppIcon family="ionicons" name="trash-outline" size={15} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.categoryRow}>
              {item.detectedCategory ? (
                <Pressable
                  onPress={() => {
                    tapHaptic();
                    updateItem(item.id, { categoryId: item.detectedCategory?.id ?? null });
                  }}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    { backgroundColor: colors.input, borderColor: item.hasManualCategory ? colors.primary : colors.border },
                    item.hasManualCategory && { backgroundColor: colors.successMuted },
                    pressed && styles.pressed,
                  ]}
                >
                  <AppIcon family="ionicons" 
                    name={getCategoryIconName(item.detectedCategory)}
                    size={12}
                    color={item.hasManualCategory ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      singleLineLabelStyle,
                      { color: item.hasManualCategory ? colors.primary : colors.text },
                    ]}
                    {...chipLabelTextProps()}
                  >
                    {item.hasManualCategory ? item.detectedCategory.name : `→ ${item.detectedCategory.name}`}
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.noCategory, { color: colors.textMuted }]}>Catégorie auto</Text>
              )}
              <Pressable
                onPress={() => {
                  tapHaptic();
                  setItemCategoryQuery('');
                  setCategoryPickerItemId(categoryPickerItemId === item.id ? null : item.id);
                }}
                style={({ pressed }) => [
                  styles.changeBtn,
                  { backgroundColor: colors.input, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.changeBtnText, { color: colors.text }]}>
                  {categoryPickerItemId === item.id ? 'Fermer' : 'Catégorie'}
                </Text>
              </Pressable>
            </View>

            {categoryPickerItemId === item.id ? (
              <View style={styles.picker}>
                <TextInput
                  style={[
                    styles.searchInput,
                    { color: colors.text, backgroundColor: colors.input, borderColor: colors.border },
                  ]}
                  placeholder="Chercher une catégorie"
                  placeholderTextColor={colors.textMuted}
                  value={itemCategoryQuery}
                  onChangeText={setItemCategoryQuery}
                />
                <View style={styles.pickerChips}>
                  {getCategorySearchChoices(itemCategoryQuery, categories, item.detectedCategoryId).map((category) => {
                    const selected = item.detectedCategoryId === category.id;
                    return (
                      <Pressable
                        key={category.id}
                        onPress={() => {
                          tapHaptic();
                          updateItem(item.id, { categoryId: category.id });
                          setCategoryPickerItemId(null);
                          setItemCategoryQuery('');
                        }}
                        style={({ pressed }) => [
                          styles.categoryChip,
                          { backgroundColor: colors.input, borderColor: selected ? colors.primary : colors.border },
                          selected && { backgroundColor: colors.successMuted },
                          pressed && styles.pressed,
                        ]}
                      >
                        <AppIcon family="ionicons" 
                          name={getCategoryIconName(category)}
                          size={12}
                          color={selected ? colors.primary : colors.textSecondary}
                        />
                        <Text
                          style={[styles.categoryChipText, singleLineLabelStyle, { color: selected ? colors.primary : colors.text }]}
                          {...chipLabelTextProps()}
                        >
                          {category.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter un article"
        onPress={addItem}
        style={({ pressed }) => [
          styles.addBtn,
          surface,
          { borderRadius: radius.lg },
          pressed && styles.pressed,
        ]}
      >
        <AppIcon family="ionicons" name="add" size={18} color={colors.primary} />
        <Text style={[styles.addBtnText, { color: colors.text }]}>Ajouter une ligne</Text>
      </Pressable>

      {showTotal && total > 0 ? (
        <Text style={[styles.total, { color: colors.textMuted }]}>
          Total indicatif : {formatNumberDisplay(total)} $
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  header: {
    gap: 2,
  },
  headerTitle: {
    ...typographyKit.caption,
  },
  headerHint: {
    ...typographyKit.microMedium,
  },
  table: {
    overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  colHead: {
    ...typographyKit.microUpper,
    fontSize: 10,
  },
  colName: {
    flex: 1,
  },
  colPrice: {
    width: 88,
    textAlign: 'right',
    paddingRight: spacing.xs,
  },
  colAction: {
    width: 32,
  },
  emptyRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  emptyText: {
    ...typographyKit.metaMedium,
    textAlign: 'center',
  },
  itemBlock: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nameInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    ...typographyKit.caption,
  },
  compactInput: {
    minHeight: 38,
  },
  priceWrap: {
    width: 88,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.xs,
  },
  priceInput: {
    flex: 1,
    paddingVertical: spacing.xs,
    textAlign: 'right',
    ...typographyKit.caption,
  },
  currency: {
    ...jakartaExtraBoldText,
    fontSize: typography.micro,
    marginLeft: 2,
  },
  removeBtn: {
    width: 32,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  categoryChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  categoryChipText: {
    ...typographyKit.micro,
    flexShrink: 1,
  },
  noCategory: {
    ...typographyKit.microMedium,
    flex: 1,
  },
  changeBtn: {
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  changeBtnText: {
    ...typographyKit.micro,
  },
  picker: {
    gap: spacing.xs,
  },
  searchInput: {
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    ...typographyKit.caption,
  },
  pickerChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  addBtn: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  addBtnText: {
    ...typographyKit.caption,
  },
  total: {
    ...typographyKit.metaMedium,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.72,
  },
});

export { parseMoney as parseItemizedMoney, formatMoneyInput as formatItemizedMoneyInput };

export function itemizedRowsToNotePayload(
  rows: ItemizedRow[],
  categories: Map<string, Category>,
  fallbackCategoryId: string | null,
  merchantHint = '',
) {
  return rows
    .filter((item) => item.name.trim() || parseMoney(item.price) > 0)
    .map((item) => {
      const searchText = item.name.trim() || merchantHint;
      const categoryId = item.categoryId ?? inferCategoryId(searchText, [...categories.values()], fallbackCategoryId);
      const category = categoryId ? categories.get(categoryId) : undefined;
      return {
        name: item.name.trim() || 'Article',
        price: Number(parseMoney(item.price).toFixed(2)),
        categoryId,
        categoryName: category?.name ?? null,
      };
    });
}
