import { Pressable, StyleSheet, Text, View } from 'react-native';
import ChevronLeftMod from 'lucide-react-native/dist/cjs/icons/chevron-left.js';
import ChevronRightMod from 'lucide-react-native/dist/cjs/icons/chevron-right.js';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  radius,
  spacing,
} from '@/constants/theme';
import { formatMonthName, formatMonthYear } from '@/lib/budgetMonth';
import { tapHaptic } from '@/lib/haptics';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';
import { useAppTheme } from '@/lib/themeContext';

const ChevronLeft = resolveLucideIcon(ChevronLeftMod)!;
const ChevronRight = resolveLucideIcon(ChevronRightMod)!;

type Props = {
  month: Date;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  /**
   * `default` — full-bleed bare chevrons (Budget tab).
   * `calendar` — Agenda-style title case month + muted year.
   * `chip` — centered pill + circular nav (use under a circular back button).
   */
  appearance?: 'default' | 'calendar' | 'chip';
  /** Override primary label (e.g. week range / year). Falls back to month name. */
  primaryLabel?: string;
  /** Override secondary label (e.g. year). Empty string hides it. */
  secondaryLabel?: string;
  /** Full accessibility label for the center text. */
  periodAccessibilityLabel?: string;
  previousAccessibilityLabel?: string;
  nextAccessibilityLabel?: string;
};

const NAV_SIZE = 44;
const CALENDAR_NAV_SIZE = 40;
const CHIP_NAV_SIZE = 30;
const NAV_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const CHEVRON_SIZE = 18;
const CALENDAR_CHEVRON_SIZE = 16;
const CHIP_CHEVRON_SIZE = 15;
const CHEVRON_STROKE = 2.5;
const CALENDAR_CHEVRON_STROKE = 2;
const CHIP_CHEVRON_STROKE = 2.25;

function formatCalendarMonthTitle(date: Date) {
  const month = date.toLocaleDateString('fr-FR', { month: 'long' });
  return month.charAt(0).toUpperCase() + month.slice(1);
}

export function MonthSelector({
  month,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  appearance = 'default',
  primaryLabel,
  secondaryLabel,
  periodAccessibilityLabel,
  previousAccessibilityLabel = 'Mois précédent',
  nextAccessibilityLabel = 'Mois suivant',
}: Props) {
  const { colors } = useAppTheme();
  const isCalendar = appearance === 'calendar';
  const isChip = appearance === 'chip';
  const navSize = isChip ? CHIP_NAV_SIZE : isCalendar ? CALENDAR_NAV_SIZE : NAV_SIZE;
  const chevronSize = isChip ? CHIP_CHEVRON_SIZE : isCalendar ? CALENDAR_CHEVRON_SIZE : CHEVRON_SIZE;
  const chevronStroke = isChip
    ? CHIP_CHEVRON_STROKE
    : isCalendar
      ? CALENDAR_CHEVRON_STROKE
      : CHEVRON_STROKE;

  const resolvedPrimary = primaryLabel ?? formatMonthName(month);
  const resolvedSecondary =
    secondaryLabel === undefined ? formatMonthYear(month) : secondaryLabel;
  const resolvedA11y =
    periodAccessibilityLabel ?? `${formatMonthName(month)} ${formatMonthYear(month)}`;
  const showSecondary = resolvedSecondary.length > 0;

  const goPrev = () => {
    if (!canGoPrevious) return;
    tapHaptic();
    onPrevious();
  };

  const goNext = () => {
    if (!canGoNext) return;
    tapHaptic();
    onNext();
  };

  const chevronPrevColor = canGoPrevious ? colors.text : colors.textDisabled;
  const chevronNextColor = canGoNext ? colors.text : colors.textDisabled;

  return (
    <View
      style={[
        styles.row,
        isCalendar && styles.rowCalendar,
        isChip && styles.rowChip,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previousAccessibilityLabel}
        accessibilityState={{ disabled: !canGoPrevious }}
        disabled={!canGoPrevious}
        hitSlop={NAV_HIT_SLOP}
        onPress={goPrev}
        style={({ pressed }) => [
          styles.navBtn,
          { width: navSize, height: navSize },
          isChip && [
            styles.chipNavBtn,
            {
              backgroundColor: colors.containerBackground,
              borderColor: colors.containerBorder,
            },
          ],
          pressed && canGoPrevious && styles.navPressed,
        ]}
      >
        <ChevronLeft
          size={chevronSize}
          color={chevronPrevColor}
          strokeWidth={chevronStroke}
        />
      </Pressable>

      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={resolvedA11y}
        style={[
          styles.labelRow,
          isCalendar && styles.labelRowCalendar,
          isChip && [
            styles.labelRowChip,
            {
              backgroundColor: colors.containerBackground,
              borderColor: colors.containerBorder,
            },
          ],
        ]}
      >
        {isCalendar && primaryLabel == null ? (
          <Text
            style={[styles.calendarTitle, jakartaSemiboldText, { color: colors.text }]}
            numberOfLines={1}
          >
            {formatCalendarMonthTitle(month)}
            <Text style={[styles.calendarYear, jakartaMediumText, { color: colors.textMuted }]}>
              {' '}
              {formatMonthYear(month)}
            </Text>
          </Text>
        ) : (
          <>
            <Text
              style={[
                styles.month,
                isChip && styles.monthChip,
                jakartaSemiboldText,
                { color: colors.text },
              ]}
              numberOfLines={1}
            >
              {resolvedPrimary}
            </Text>
            {showSecondary ? (
              <Text
                style={[
                  styles.year,
                  isChip && styles.yearChip,
                  jakartaMediumText,
                  { color: colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {resolvedSecondary}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextAccessibilityLabel}
        accessibilityState={{ disabled: !canGoNext }}
        disabled={!canGoNext}
        hitSlop={NAV_HIT_SLOP}
        onPress={goNext}
        style={({ pressed }) => [
          styles.navBtn,
          { width: navSize, height: navSize },
          isChip && [
            styles.chipNavBtn,
            {
              backgroundColor: colors.containerBackground,
              borderColor: colors.containerBorder,
            },
          ],
          pressed && canGoNext && styles.navPressed,
        ]}
      >
        <ChevronRight
          size={chevronSize}
          color={chevronNextColor}
          strokeWidth={chevronStroke}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: NAV_SIZE,
  },
  navBtn: {
    width: NAV_SIZE,
    height: NAV_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  navPressed: {
    opacity: 0.7,
  },
  labelRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  month: {
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.4,
    includeFontPadding: false,
    flexShrink: 0,
  },
  year: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    flexShrink: 0,
  },
  rowCalendar: {
    minHeight: CALENDAR_NAV_SIZE,
  },
  labelRowCalendar: {
    gap: 0,
  },
  calendarTitle: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    includeFontPadding: false,
    textAlign: 'center',
  },
  calendarYear: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    includeFontPadding: false,
  },
  /** Centered compact control — avoids stacking bare left chevrons under a circular back. */
  rowChip: {
    alignSelf: 'center',
    minHeight: CHIP_NAV_SIZE,
    gap: spacing.sm,
  },
  chipNavBtn: {
    borderRadius: CHIP_NAV_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  labelRowChip: {
    // Do not use `flex: 0` — RN sets flexBasis: 0, which clips the month
    // to zero width on Android (invisible AOÛT 2026 between chevrons).
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    alignSelf: 'center',
    overflow: 'visible',
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  monthChip: {
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  yearChip: {
    fontSize: 13,
    lineHeight: 16,
  },
});
