/**
 * Month picker — single month or month interval (« de tel mois à tel mois »).
 * Same modal chrome / tokens as `MinimalDatePicker`, months instead of days.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import type { GhostTokens } from '@/constants/ghostUi';
import {
  interNumericExtraBoldText,
  radius,
  spacing,
  typography,
  typographyKit,
  type AppColors,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import {
  currentMonthKey,
  formatMonthKeyLabel,
  monthKeyFromDate,
  normalizeMonthRange,
  parseMonthKey,
  type MonthRangeFilter,
} from '@/lib/monthRangeFilter';
import { useAppTheme } from '@/lib/themeContext';

type PickerMode = 'single' | 'range';

const MODES: { id: PickerMode; label: string }[] = [
  { id: 'single', label: 'Un mois' },
  { id: 'range', label: 'Intervalle' },
];

const NAV_BACKDROP_GUARD_MS = 350;

type MonthRangePickerProps = {
  visible: boolean;
  value: MonthRangeFilter | null;
  onCancel: () => void;
  /** `null` clears the filter (« Tous les mois »). */
  onConfirm: (value: MonthRangeFilter | null) => void;
  title?: string;
};

export function MonthRangePicker({
  visible,
  value,
  onCancel,
  onConfirm,
  title = 'Filtrer par mois',
}: MonthRangePickerProps) {
  const { colors, ghost, isLight } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, ghost, isLight), [colors, ghost, isLight]);
  const [mode, setMode] = useState<PickerMode>('single');
  const [range, setRange] = useState<MonthRangeFilter | null>(value);
  /** First endpoint tapped in range mode, waiting for the closing month. */
  const [anchor, setAnchor] = useState<string | null>(null);
  const [visibleYear, setVisibleYear] = useState(() => new Date().getFullYear());
  const navGuardUntilRef = useRef(0);

  useEffect(() => {
    if (!visible) return;
    setRange(value);
    setAnchor(null);
    setMode(value && value.start !== value.end ? 'range' : 'single');
    const focusKey = value?.start ?? currentMonthKey();
    setVisibleYear(parseMonthKey(focusKey)?.getFullYear() ?? new Date().getFullYear());
  }, [value, visible]);

  const guardNavigation = useCallback(() => {
    navGuardUntilRef.current = Date.now() + NAV_BACKDROP_GUARD_MS;
  }, []);

  const handleBackdropPress = useCallback(() => {
    if (Date.now() < navGuardUntilRef.current) return;
    onCancel();
  }, [onCancel]);

  const stepYear = useCallback(
    (amount: number) => {
      tapHaptic();
      guardNavigation();
      setVisibleYear((year) => year + amount);
    },
    [guardNavigation],
  );

  const handleModeChange = useCallback((next: PickerMode) => {
    tapHaptic();
    setMode(next);
    setAnchor(null);
    setRange((current) => {
      if (!current) return current;
      // Leaving interval mode keeps a single month so the selection stays meaningful.
      return next === 'single' ? { start: current.start, end: current.start } : current;
    });
  }, []);

  const selectMonth = useCallback(
    (monthKey: string) => {
      tapHaptic();
      if (mode === 'single') {
        setRange({ start: monthKey, end: monthKey });
        setAnchor(null);
        return;
      }
      if (anchor) {
        setRange(normalizeMonthRange(anchor, monthKey));
        setAnchor(null);
        return;
      }
      setAnchor(monthKey);
      setRange({ start: monthKey, end: monthKey });
    },
    [anchor, mode],
  );

  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const date = new Date(visibleYear, index, 1);
        return { key: monthKeyFromDate(date), label: shortMonthLabel(date) };
      }),
    [visibleYear],
  );

  const thisMonth = currentMonthKey();
  const hint = resolveHint(mode, anchor, range);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleBackdropPress}>
      <View style={styles.modalBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessibilityLabel="Fermer"
        />
        <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
          <Text style={styles.sheetTitle}>{title}</Text>

          <SegmentedTabs
            tabs={MODES}
            active={mode}
            onChange={handleModeChange}
            size="section"
            variant="section"
            showDivider={false}
          />

          <View style={styles.yearHeader}>
            <Pressable
              onPress={() => stepYear(-1)}
              hitSlop={{ top: 14, bottom: 14, right: 12, left: 0 }}
              style={({ pressed }) => [styles.yearNavButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Année précédente"
            >
              <AppIcon family="ionicons" name="chevron-back" size={20} color={ghost.mutedSoft} />
            </Pressable>
            <Text style={styles.yearTitle}>{visibleYear}</Text>
            <Pressable
              onPress={() => stepYear(1)}
              hitSlop={{ top: 14, bottom: 14, left: 12, right: 0 }}
              style={({ pressed }) => [styles.yearNavButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Année suivante"
            >
              <AppIcon family="ionicons" name="chevron-forward" size={20} color={ghost.mutedSoft} />
            </Pressable>
          </View>

          <View style={styles.monthGrid}>
            {months.map((month) => {
              const isEndpoint =
                range !== null && (month.key === range.start || month.key === range.end);
              const isInside =
                range !== null && month.key > range.start && month.key < range.end;
              const isCurrent = month.key === thisMonth;

              return (
                <Pressable
                  key={month.key}
                  onPress={() => selectMonth(month.key)}
                  accessibilityRole="button"
                  accessibilityLabel={formatMonthKeyLabel(month.key)}
                  accessibilityState={{ selected: isEndpoint || isInside }}
                  style={({ pressed }) => [
                    styles.monthCell,
                    isCurrent && styles.currentMonthCell,
                    isInside && styles.insideRangeCell,
                    isEndpoint && styles.selectedMonthCell,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.monthText,
                      isEndpoint && styles.selectedMonthText,
                    ]}
                    numberOfLines={1}
                  >
                    {month.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                tapHaptic();
                onConfirm(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Tous les mois"
              style={({ pressed }) => [styles.ghostAction, pressed && styles.pressed]}
            >
              <Text style={styles.ghostActionText}>Tous les mois</Text>
            </Pressable>
            <View style={styles.rightActions}>
              <Pressable
                onPress={onCancel}
                accessibilityRole="button"
                style={({ pressed }) => [styles.ghostAction, pressed && styles.pressed]}
              >
                <Text style={styles.ghostActionText}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  tapHaptic();
                  onConfirm(range);
                }}
                accessibilityRole="button"
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

function shortMonthLabel(date: Date): string {
  const label = date.toLocaleDateString('fr-FR', { month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function resolveHint(
  mode: PickerMode,
  anchor: string | null,
  range: MonthRangeFilter | null,
): string {
  if (mode === 'range') {
    if (anchor) return `Début : ${formatMonthKeyLabel(anchor)} — choisis le mois de fin.`;
    if (range && range.start !== range.end) {
      return `${formatMonthKeyLabel(range.start)} → ${formatMonthKeyLabel(range.end)}`;
    }
    return 'Choisis le mois de début, puis le mois de fin.';
  }
  if (range) return formatMonthKeyLabel(range.start);
  return 'Choisis un mois, ou garde tous les mois.';
}

function createStyles(colors: AppColors, ghost: GhostTokens, isLight: boolean) {
  const controlFill = isLight ? colors.modalAction : 'rgba(255,255,255,0.06)';
  const currentFill = isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';
  const insideFill = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
  return StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0,0,0,0.72)',
      padding: spacing.lg,
    },
    pickerCard: {
      width: '100%',
      maxWidth: 380,
      borderRadius: radius.xxl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.containerBorder,
      backgroundColor: colors.modalSurface,
      padding: spacing.md,
      gap: spacing.md,
    },
    sheetTitle: {
      color: ghost.text,
      fontSize: typography.dashboardGreeting,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    yearHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    yearNavButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: controlFill,
    },
    yearTitle: {
      flex: 1,
      textAlign: 'center',
      color: ghost.text,
      ...interNumericExtraBoldText,
      fontSize: typography.dashboardGreeting,
      fontVariant: ['tabular-nums'],
    },
    monthGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    monthCell: {
      width: `${(100 - 2 * 1.5) / 3}%`,
      minHeight: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    currentMonthCell: {
      borderColor: ghost.hairline,
      backgroundColor: currentFill,
    },
    insideRangeCell: {
      backgroundColor: insideFill,
      borderColor: ghost.hairline,
    },
    selectedMonthCell: {
      borderColor: ghost.text,
      backgroundColor: ghost.text,
    },
    monthText: {
      color: ghost.text,
      ...typographyKit.metaSemibold,
      fontSize: typography.caption,
    },
    selectedMonthText: { color: ghost.void },
    hint: {
      color: ghost.mutedSoft,
      ...typographyKit.metaMedium,
      fontSize: typography.micro,
      lineHeight: 16,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
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
      backgroundColor: controlFill,
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
    pressed: { opacity: 0.72 },
  });
}
