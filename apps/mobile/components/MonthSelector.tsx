import { Pressable, StyleSheet, Text, View } from 'react-native';
import ChevronLeftMod from 'lucide-react-native/dist/cjs/icons/chevron-left.js';
import ChevronRightMod from 'lucide-react-native/dist/cjs/icons/chevron-right.js';
import { jakartaMediumText, jakartaSemiboldText, spacing } from '@/constants/theme';
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
};

const NAV_SIZE = 44;
const NAV_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;
const CHEVRON_SIZE = 18;
const CHEVRON_STROKE = 2.5;

export function MonthSelector({
  month,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: Props) {
  const { colors } = useAppTheme();

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

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mois précédent"
        accessibilityState={{ disabled: !canGoPrevious }}
        disabled={!canGoPrevious}
        hitSlop={NAV_HIT_SLOP}
        onPress={goPrev}
        style={({ pressed }) => [styles.navBtn, pressed && canGoPrevious && styles.navPressed]}
      >
        <ChevronLeft
          size={CHEVRON_SIZE}
          color={canGoPrevious ? colors.text : colors.textDisabled}
          strokeWidth={CHEVRON_STROKE}
        />
      </Pressable>

      <View style={styles.labelRow}>
        <Text
          style={[styles.month, jakartaSemiboldText, { color: colors.text }]}
          numberOfLines={1}
        >
          {formatMonthName(month)}
        </Text>
        <Text
          style={[styles.year, jakartaMediumText, { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {formatMonthYear(month)}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mois suivant"
        accessibilityState={{ disabled: !canGoNext }}
        disabled={!canGoNext}
        hitSlop={NAV_HIT_SLOP}
        onPress={goNext}
        style={({ pressed }) => [styles.navBtn, pressed && canGoNext && styles.navPressed]}
      >
        <ChevronRight
          size={CHEVRON_SIZE}
          color={canGoNext ? colors.text : colors.textDisabled}
          strokeWidth={CHEVRON_STROKE}
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
  },
  year: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
  },
});
