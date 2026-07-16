import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GhostTokens } from '@/constants/ghostUi';
import {
  containerSurfaceStyle,
  radius,
  spacing,
  typography,
  typographyKit,
  type AppColors,
} from '@/constants/theme';
import { formatFriendlyDateLabel } from '@/lib/formatFriendlyDateLabel';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type DatePickerFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeDate: (value: string) => void;
  allowClear?: boolean;
  variant?: 'compact' | 'sheet';
  labelStyle?: import('react-native').TextStyle;
};

const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const CALENDAR_WEEKS = 6;
const CALENDAR_CELLS = CALENDAR_WEEKS * 7;
const NAV_BACKDROP_GUARD_MS = 350;
const YEAR_RANGE_OFFSET = 50;

type PickerViewMode = 'month' | 'year';

export function DatePickerField({
  label,
  value,
  placeholder,
  onChangeDate,
  allowClear = false,
  variant = 'compact',
  labelStyle,
}: DatePickerFieldProps) {
  const { colors, ghost, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, ghost), [colors, ghost]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const displayValue = value ? formatFriendlyDateLabel(value) : '';
  const sheetSurface = variant === 'sheet' ? containerSurfaceStyle(isLight) : null;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, variant === 'sheet' && styles.sheetLabel, labelStyle]}>{label}</Text>
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
          sheetSurface,
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.inputText,
            variant === 'sheet' && styles.sheetInputText,
            !value && styles.placeholder,
          ]}
        >
          {displayValue || placeholder}
        </Text>
        <AppIcon family="ionicons" name="calendar-clear-outline" size={18} color={ghost.mutedSoft} />
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

export function MinimalDatePicker({ visible, value, allowClear, onCancel, onConfirm }: MinimalDatePickerProps) {
  const { colors, ghost } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, ghost), [colors, ghost]);
  const initialDate = useMemo(() => parseIsoDate(value) ?? startOfToday(), [value]);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(initialDate));
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [viewMode, setViewMode] = useState<PickerViewMode>('month');
  const navGuardUntilRef = useRef(0);
  const yearScrollRef = useRef<ScrollView>(null);

  const yearOptions = useMemo(() => getYearOptions(), []);
  const calendarBodyHeight = useMemo(
    () => CALENDAR_WEEKS * 44 + (CALENDAR_WEEKS - 1) * spacing.xs,
    [],
  );

  useEffect(() => {
    if (!visible) return;
    const nextDate = parseIsoDate(value) ?? startOfToday();
    setSelectedDate(nextDate);
    setVisibleMonth(monthStart(nextDate));
    setViewMode('month');
  }, [value, visible]);

  useEffect(() => {
    if (!visible || viewMode !== 'year') return;

    const selectedYear = visibleMonth.getFullYear();
    const selectedIndex = yearOptions.indexOf(selectedYear);
    if (selectedIndex < 0) return;

    const row = Math.floor(selectedIndex / 4);
    const rowHeight = 44 + spacing.xs;
    const offset = Math.max(0, row * rowHeight - calendarBodyHeight / 2 + rowHeight / 2);

    const frame = requestAnimationFrame(() => {
      yearScrollRef.current?.scrollTo({ y: offset, animated: false });
    });

    return () => cancelAnimationFrame(frame);
  }, [calendarBodyHeight, viewMode, visible, visibleMonth, yearOptions]);

  const guardNavigation = useCallback(() => {
    navGuardUntilRef.current = Date.now() + NAV_BACKDROP_GUARD_MS;
  }, []);

  const handleBackdropPress = useCallback(() => {
    if (Date.now() < navGuardUntilRef.current) return;
    onCancel();
  }, [onCancel]);

  const goToPreviousMonth = useCallback(() => {
    tapHaptic();
    guardNavigation();
    setVisibleMonth((current) => addMonths(current, -1));
  }, [guardNavigation]);

  const goToNextMonth = useCallback(() => {
    tapHaptic();
    guardNavigation();
    setVisibleMonth((current) => addMonths(current, 1));
  }, [guardNavigation]);

  const openYearPicker = useCallback(() => {
    tapHaptic();
    guardNavigation();
    setViewMode('year');
  }, [guardNavigation]);

  const closeYearPicker = useCallback(() => {
    tapHaptic();
    guardNavigation();
    setViewMode('month');
  }, [guardNavigation]);

  const selectYear = useCallback(
    (year: number) => {
      tapHaptic();
      guardNavigation();
      setVisibleMonth((current) => new Date(year, current.getMonth(), 1));
      setViewMode('month');
    },
    [guardNavigation],
  );

  const days = useMemo(() => getMonthCells(visibleMonth), [visibleMonth]);
  const selectedIso = formatIsoDate(selectedDate);
  const visibleYear = visibleMonth.getFullYear();

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleBackdropPress}>
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} accessibilityLabel="Fermer" />
        <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
          <View style={styles.pickerHeader}>
            {viewMode === 'month' ? (
              <Pressable
                onPress={goToPreviousMonth}
                hitSlop={{ top: 14, bottom: 14, right: 12, left: 0 }}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Mois précédent"
              >
                <AppIcon family="ionicons" name="chevron-back" size={20} color={ghost.mutedSoft} />
              </Pressable>
            ) : (
              <Pressable
                onPress={closeYearPicker}
                hitSlop={{ top: 14, bottom: 14, right: 12, left: 0 }}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Retour au calendrier"
              >
                <AppIcon family="ionicons" name="chevron-back" size={20} color={ghost.mutedSoft} />
              </Pressable>
            )}
            {viewMode === 'month' ? (
              <Pressable
                onPress={openYearPicker}
                hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
                style={({ pressed }) => [styles.monthTitleButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Choisir l'année, ${visibleYear}`}
              >
                <Text style={styles.monthTitle}>{formatMonthLabel(visibleMonth)}</Text>
              </Pressable>
            ) : (
              <View style={styles.monthTitleButton}>
                <Text style={styles.monthTitle}>Choisir l'année</Text>
              </View>
            )}
            {viewMode === 'month' ? (
              <Pressable
                onPress={goToNextMonth}
                hitSlop={{ top: 14, bottom: 14, left: 12, right: 0 }}
                style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Mois suivant"
              >
                <AppIcon family="ionicons" name="chevron-forward" size={20} color={ghost.mutedSoft} />
              </Pressable>
            ) : (
              <View style={styles.monthButtonSpacer} />
            )}
          </View>

          {viewMode === 'month' ? (
            <>
              <View style={styles.weekRow}>
                {DAY_LABELS.map((day, index) => (
                  <Text key={`${day}-${index}`} style={styles.weekLabel}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={[styles.dayGrid, { minHeight: calendarBodyHeight }]}>
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
            </>
          ) : (
            <ScrollView
              ref={yearScrollRef}
              style={[styles.yearScroll, { height: calendarBodyHeight }]}
              contentContainerStyle={styles.yearGrid}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {yearOptions.map((year) => {
                const selected = year === visibleYear;
                const current = year === startOfToday().getFullYear();

                return (
                  <Pressable
                    key={year}
                    onPress={() => selectYear(year)}
                    style={({ pressed }) => [
                      styles.yearCell,
                      current && styles.todayCell,
                      selected && styles.selectedDayCell,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Année ${year}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.yearText, selected && styles.selectedDayText]}>{year}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

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

  while (cells.length < CALENDAR_CELLS) {
    cells.push(null);
  }

  return cells.slice(0, CALENDAR_CELLS);
}

function formatMonthLabel(date: Date) {
  const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getYearOptions() {
  const currentYear = startOfToday().getFullYear();
  const startYear = currentYear - YEAR_RANGE_OFFSET;
  const endYear = currentYear + YEAR_RANGE_OFFSET;
  const years: number[] = [];

  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }

  return years;
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
      ...typographyKit.eyebrow,
      color: colors.textMuted,
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
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
    },
    inputText: {
      flex: 1,
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    sheetInputText: {
      ...typographyKit.bodyMedium,
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
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    monthButtonSpacer: {
      width: 44,
      height: 44,
    },
    monthTitleButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    monthTitle: {
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
    yearScroll: {
      borderRadius: radius.md,
    },
    yearGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      paddingBottom: spacing.xs,
    },
    yearCell: {
      width: `${(100 - 3 * 1.25) / 4}%`,
      minHeight: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    yearText: {
      color: ghost.text,
      fontSize: typography.caption,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
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
