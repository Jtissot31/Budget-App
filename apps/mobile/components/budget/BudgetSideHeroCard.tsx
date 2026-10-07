/**
 * Budget tab hero — month, ring, remaining amount, spent line.
 */
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MonthSelector } from '@/components/MonthSelector';
import { OnyxContainer } from '@/components/OnyxContainer';
import { moneyAmountTypography, spacing, typographyKit } from '@/constants/theme';
import {
  formatDisplayMoneyAbsolute,
  formatSignedDisplayMoney,
} from '@/lib/formatDisplayMoney';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  totalAllocated: number;
  totalSpent: number;
  month: Date;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
};

const RING = 92;
const STROKE = 7;

export function BudgetSideHeroCard({
  totalAllocated,
  totalSpent,
  month,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const allocated = Math.max(0, totalAllocated);
  const spent = Math.max(0, totalSpent);
  const remaining = allocated - spent;
  const over = allocated > 0 && spent > allocated;
  const ratio = allocated > 0 ? spent / allocated : 0;
  const percent = allocated > 0 ? Math.round(ratio * 100) : 0;
  const tone = over ? colors.danger : colors.accentGreen;

  const radius = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(1, Math.max(0, ratio));
  const dash = fraction * circumference;
  const center = RING / 2;

  const remainingLabel =
    remaining < 0
      ? formatSignedDisplayMoney(remaining)
      : formatDisplayMoneyAbsolute(remaining);

  return (
    <OnyxContainer
      halo={false}
      style={[styles.card, !isLight && { backgroundColor: colors.modalSurface }]}
    >
      <MonthSelector
        month={month}
        onPrevious={onPrevious}
        onNext={onNext}
        canGoPrevious={canGoPrevious}
        canGoNext={canGoNext}
        appearance="compact"
        centered
      />

      <View style={styles.metrics}>
        <View
          style={styles.ringWrap}
          accessible
          accessibilityLabel={`${percent} pour cent utilisé`}
        >
          <Svg width={RING} height={RING}>
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={colors.borderSubtle}
              strokeWidth={STROKE}
              fill="none"
            />
            {fraction > 0 ? (
              <Circle
                cx={center}
                cy={center}
                r={radius}
                stroke={tone}
                strokeWidth={STROKE}
                fill="none"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeLinecap={fraction >= 0.995 ? 'butt' : 'round'}
                rotation={-90}
                origin={`${center}, ${center}`}
              />
            ) : null}
          </Svg>
          <View style={[StyleSheet.absoluteFill, styles.ringCenter]} pointerEvents="none">
            <Text style={[styles.percent, { color: colors.text }]}>{percent}%</Text>
            <Text style={[typographyKit.microMedium, { color: colors.textMuted }]}>Utilisé</Text>
          </View>
        </View>

        <View style={styles.copy}>
          <Text
            style={[
              styles.amount,
              moneyAmountTypography({ tier: 'hero', fontSize: 28, lineHeight: 34 }),
              { color: colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {remainingLabel}
          </Text>

          <Text style={styles.meta} numberOfLines={1}>
            <Text style={[styles.metaAmount, { color: colors.textSecondary }]}>
              {formatDisplayMoneyAbsolute(spent)}
            </Text>
            <Text style={[typographyKit.microMedium, { color: colors.textMuted }]}> dépensé · </Text>
            <Text style={[styles.metaAmount, { color: colors.textSecondary }]}>
              {formatDisplayMoneyAbsolute(allocated)}
            </Text>
          </Text>
        </View>
      </View>
    </OnyxContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percent: {
    ...typographyKit.captionSemibold,
    fontSize: 16,
    lineHeight: 20,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  amount: {
    flexShrink: 1,
    minWidth: 0,
  },
  meta: {
    marginTop: spacing.xs,
  },
  metaAmount: {
    ...moneyAmountTypography({ tier: 'row', fontSize: 13, lineHeight: 18 }),
  },
});
