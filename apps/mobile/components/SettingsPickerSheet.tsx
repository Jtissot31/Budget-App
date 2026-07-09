import { useMemo } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BudgetCategoryIcon } from '@/components/budget/BudgetCategoryIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  jakartaBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { UNIFORM_ROW_MIN_HEIGHT } from '@/lib/uniformGroupStyles';

export type SettingsPickerOption<T extends string> = {
  id: T;
  label: string;
  description?: string;
  /** Renders a budget category glyph matching `BudgetCategoryRow`. */
  budgetCategoryIcon?: {
    icon?: string | null;
    name?: string;
  };
};

type Props<T extends string> = {
  visible: boolean;
  title: string;
  options: SettingsPickerOption<T>[];
  selectedId: T;
  onClose: () => void;
  onSelect: (id: T) => void;
};

export function SettingsPickerSheet<T extends string>({
  visible,
  title,
  options,
  selectedId,
  onClose,
  onSelect,
}: Props<T>) {
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();

  const backdropColor = useMemo(
    () => (isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)'),
    [isLight],
  );

  const handleSelect = (id: T) => {
    tapHaptic();
    onSelect(id);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: backdropColor }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.containerBackground,
                borderColor: colors.containerBorder,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <AppIcon family="ionicons" name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {options.map((option, index) => {
                const selected = option.id === selectedId;
                const isLast = index === options.length - 1;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => handleSelect(option.id)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      !isLast && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                      pressed && styles.pressed,
                    ]}
                  >
                    {option.budgetCategoryIcon ? (
                      <BudgetCategoryIcon
                        icon={option.budgetCategoryIcon.icon}
                        name={option.budgetCategoryIcon.name ?? option.label}
                        id={option.id}
                      />
                    ) : null}
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                      {option.description ? (
                        <Text style={[styles.optionDescription, { color: colors.textMuted }]}>
                          {option.description}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <AppIcon family="ionicons" name="checkmark-circle" size={22} color={colors.primary} />
                    ) : (
                      <View style={[styles.radio, { borderColor: colors.borderStrong }]} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  keyboard: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.card + 4,
    borderTopRightRadius: radius.card + 4,
    borderWidth: 1,
    maxHeight: '78%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  title: {
    ...jakartaBoldText,
    fontSize: typography.body,
    flex: 1,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  optionLabel: {
    ...jakartaSemiboldText,
    fontSize: typography.body,
  },
  optionDescription: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.82,
  },
});
