import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GhostTokens } from '@/constants/ghostUi';
import { radius, spacing, typography, type AppColors } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type DatePickerFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeDate: (value: string) => void;
  allowClear?: boolean;
  variant?: 'compact' | 'sheet';
};

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function DatePickerField({
  label,
  value,
  placeholder,
  onChangeDate,
  allowClear = false,
  variant = 'compact',
}: DatePickerFieldProps) {
  const { colors, ghost } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, ghost), [colors, ghost]);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, variant === 'sheet' && styles.sheetLabel]}>{label}</Text>
      <Pressable
        onPress={() => {
          tapHaptic();
          setPickerOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Choisir ${label.toLowerCase()}`}
        style={({ pressed }) => [
          styles.inputButton,
          variant === 'sheet' && styles.sheetInputButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.inputText, !value && styles.placeholder]}>{value || placeholder}</Text>
        <Ionicons name="calendar-clear-outline" size={18} color={ghost.mutedSoft} />
      </Pressable>

      <MinimalDatePicker
        visible={pickerOpen}
        value={value}
        allowClear={allowClear}
        onCancel={() => setPickerOpen(false)}
        onConfirm={(nextValue) => {
          onChangeDate(nextValue);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

type MinimalDatePickerProps = {
  visible: boolean;
  value: string;
  allowClear: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

function MinimalDatePicker({ visible, value, allowClear, onCancel, onConfirm }: MinimalDatePickerProps) {
  const { colors, ghost } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, ghost), [colors, ghost]);
  const initialDate = useMemo(() => parseIsoDate(value) ?? startOfToday(), [value]);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(initialDate));
  const [selectedDate, setSelectedDate] = useState(initialDate);

  useEffect(() => {
    if (!visible) return;
    const nextDate = parseIsoDate(value) ?? startOfToday();
    setSelectedDate(nextDate);
    setVisibleMonth(monthStart(nextDate));
  }, [value, visible]);

  const days = useMemo(() => getMonthCells(visibleMonth), [visibleMonth]);
  const selectedIso = formatIsoDate(selectedDate);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Pressable
              onPress={() => {
                tapHaptic();
                setVisibleMonth(addMonths(visibleMonth, -1));
              }}
              hitSlop={10}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-back" size={20} color={ghost.mutedSoft} />
            </Pressable>
            <Text style={styles.monthTitle}>{formatMonthLabel(visibleMonth)}</Text>
            <Pressable
              onPress={() => {
                tapHaptic();
                setVisibleMonth(addMonths(visibleMonth, 1));
              }}
              hitSlop={10}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-forward" size={20} color={ghost.mutedSoft} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {DAY_LABELS.map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekLabel}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.dayGrid}>
            {days.map((day, index) => {
              if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;

              const iso = formatIsoDate(day);
              const selected = iso === selectedIso;
              const today = iso === formatIsoDate(startOfToday());

              return (
                <Pressable
                  key={iso}
                  onPress={() => {
                    tapHaptic();
                    setSelectedDate(day);
                  }}
                  style={({ pressed }) => [
                    styles.dayCell,
                    today && styles.todayCell,
                    selected && styles.selectedDayCell,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.dayText, selected && styles.selectedDayText]}>{day.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            {allowClear ? (
              <Pressable
                onPress={() => {
                  tapHaptic();
                  onConfirm('');
                }}
                style={({ pressed }) => [styles.ghostAction, pressed && styles.pressed]}
              >
                <Text style={styles.ghostActionText}>Effacer</Text>
              </Pressable>
            ) : (
              <View style={styles.actionSpacer} />
            )}
            <View style={styles.rightActions}>
              <Pressable onPress={onCancel} style={({ pressed }) => [styles.ghostAction, pressed && styles.pressed]}>
                <Text style={styles.ghostActionText}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  tapHaptic();
                  onConfirm(formatIsoDate(selectedDate));
                }}
                style={({ pressed }) => [styles.doneAction, pressed && styles.pressed]}
              >
                <Text style={styles.doneActionText}>Terminer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthCells(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingEmptyCells = (firstDay.getDay() + 6) % 7;
  const cells: Array<Date | null> = Array.from({ length: leadingEmptyCells }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function formatMonthLabel(date: Date) {
  const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function createStyles(colors: AppColors, ghost: GhostTokens) {
  return StyleSheet.create({
    field: { flex: 1, gap: spacing.sm },
    label: {
      color: colors.textMuted,
      fontSize: typography.micro,
      fontWeight: '800',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    sheetLabel: {
      fontSize: 16,
      lineHeight: 21,
      letterSpacing: 0,
      textTransform: 'none',
      color: ghost.mutedSoft,
    },
    inputButton: {
      minHeight: 50,
      borderRadius: radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: ghost.obsidianSoft,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    sheetInputButton: {
      borderRadius: 13,
      backgroundColor: ghost.obsidianSoft,
      paddingVertical: 12,
    },
    inputText: {
      flex: 1,
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    placeholder: { color: colors.textMuted },
    pressed: { opacity: 0.72 },
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.64)',
      padding: spacing.lg,
    },
    pickerCard: {
      width: '100%',
      maxWidth: 380,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: ghost.hairline,
      backgroundColor: ghost.obsidian,
      padding: spacing.md,
      gap: spacing.md,
    },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    monthButton: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    monthTitle: {
      flex: 1,
      color: ghost.text,
      fontSize: typography.dashboardGreeting,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.2,
    },
    weekRow: {
      flexDirection: 'row',
      gap: spacing.xs,
    },
    weekLabel: {
      flex: 1,
      color: ghost.muted,
      fontSize: typography.micro,
      fontWeight: '800',
      textAlign: 'center',
    },
    dayGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    dayCell: {
      width: `${(100 - 6 * 1.25) / 7}%`,
      aspectRatio: 1,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    todayCell: {
      borderColor: ghost.hairline,
      backgroundColor: 'rgba(255,255,255,0.04)',
    },
    selectedDayCell: {
      borderColor: ghost.text,
      backgroundColor: ghost.text,
    },
    dayText: {
      color: ghost.text,
      fontSize: typography.caption,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    selectedDayText: { color: ghost.void },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    actionSpacer: { flex: 1 },
    rightActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    ghostAction: {
      minHeight: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    ghostActionText: {
      color: ghost.mutedSoft,
      fontSize: typography.caption,
      fontWeight: '800',
    },
    doneAction: {
      minHeight: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      backgroundColor: ghost.text,
    },
    doneActionText: {
      color: ghost.void,
      fontSize: typography.caption,
      fontWeight: '900',
    },
  });
}
