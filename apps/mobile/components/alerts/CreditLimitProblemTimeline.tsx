import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { InstitutionMark } from '@/components/wallet/AccountCardPrototypes';
import { isCreditLimitExceededTitle } from '@/lib/creditLimitAlertCopy';
import {
  creditLimitMarginHintColor,
  creditLimitUtilizationBarColor,
} from '@/lib/creditLimitUtilization';
import {
  formatDisplayMoneyAbsolute,
  formatSignedDisplayMoney,
} from '@/lib/formatDisplayMoney';
import type { CreditLimitTimelineData } from '@/lib/resolveCreditLimitTimeline';
import { resolveUserPickedIconWellBackground } from '@/lib/userPickedIcon';
import {
  ICON_WELL_SIZE,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount } from '@/types';

/** Credit used / payment outflow — always debt-signed (−). */
function formatDebtAmount(absValue: number): string {
  return formatSignedDisplayMoney(-Math.abs(absValue));
}

type Props = {
  data: CreditLimitTimelineData;
  /** Supporting warning under the utilization hero (not a competing headline). */
  warning?: string | null;
  /** Premium account line (e.g. « Visa ···· 9104 ») — shown in the identity row. */
  accountLabel?: string | null;
  /** Credit account for Visa/Mastercard mark — same as account-detail hero. */
  account?: SimulatedAccount | null;
};

const BAR_HEIGHT = 10;

/**
 * Credit-limit alert visual — utilization hero, bar, key numbers, then quieter
 * account identity and triggering payment.
 */
export function CreditLimitProblemTimeline({ data, warning, accountLabel, account }: Props) {
  const { colors, isLight } = useAppTheme();

  const over = data.isOverLimit && data.creditLimit > 0 && data.balanceUsedAfter > data.creditLimit;
  const displayPct = over
    ? Math.round((data.balanceUsedAfter / data.creditLimit) * 100)
    : Math.round(data.utilizationAfterPct);
  const limitRatio =
    over && data.balanceUsedAfter > 0 ? Math.min(1, data.creditLimit / data.balanceUsedAfter) : null;
  const onTrackFill =
    data.creditLimit > 0 ? Math.min(1, data.balanceUsedAfter / data.creditLimit) : data.balanceUsedAfter > 0 ? 1 : 0;

  const exceeded = isCreditLimitExceededTitle(data.utilizationAfterPct, data.isOverLimit);
  const statusColor = exceeded
    ? colors.danger
    : creditLimitMarginHintColor(data.utilizationAfterPct, data.isOverLimit, colors);
  const barColor = exceeded
    ? colors.danger
    : creditLimitUtilizationBarColor(data.utilizationAfterPct, colors, isLight);
  const wellBg = resolveUserPickedIconWellBackground(isLight);

  const accountName = accountLabel?.trim() || data.accountLabel?.trim() || 'Carte de crédit';
  const remainingLabel = data.isOverLimit ? 'Dépassement' : 'Marge restante';
  const remainingValue = data.isOverLimit
    ? formatDisplayMoneyAbsolute(data.overLimitBy)
    : formatDisplayMoneyAbsolute(Math.max(0, data.availableAfter));

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text
          style={[
            moneyAmountTypography({ tier: 'stat' }),
            styles.percent,
            { color: statusColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {displayPct} %
        </Text>
        <Text style={[styles.percentCaption, { color: colors.textMuted }]}>après paiement</Text>
        {warning ? (
          <Text style={[styles.warning, { color: colors.textSecondary }]} numberOfLines={3}>
            {warning}
          </Text>
        ) : null}
      </View>

      <View
        style={[styles.track, { backgroundColor: wellBg, height: BAR_HEIGHT }]}
        accessibilityRole="image"
        accessibilityLabel={`${displayPct} pour cent de la limite après paiement`}
      >
        {limitRatio != null ? (
          <>
            <View
              style={[
                styles.fill,
                {
                  width: `${limitRatio * 100}%`,
                  backgroundColor: colors.text,
                  opacity: 0.28,
                },
              ]}
            />
            <View style={[styles.fill, styles.overflowFill, { backgroundColor: colors.danger }]} />
          </>
        ) : (
          <View
            style={[
              styles.fill,
              {
                width: `${onTrackFill * 100}%`,
                backgroundColor: barColor,
              },
            ]}
          />
        )}
      </View>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Utilisé</Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'card' }),
              styles.metricValue,
              { color: colors.text },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatDisplayMoneyAbsolute(data.balanceUsedAfter)}
          </Text>
        </View>
        <View style={[styles.metric, styles.metricCenter]}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Limite</Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'row' }),
              styles.metricValue,
              { color: colors.textSecondary },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatDisplayMoneyAbsolute(data.creditLimit)}
          </Text>
        </View>
        <View style={[styles.metric, styles.metricEnd]}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{remainingLabel}</Text>
          <Text
            style={[
              moneyAmountTypography({ tier: 'card' }),
              styles.metricValue,
              { color: statusColor },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {remainingValue}
          </Text>
        </View>
      </View>

      <View style={styles.accountRow}>
        <View style={styles.logoSlot}>
          {account ? (
            <InstitutionMark account={account} size={ICON_WELL_SIZE} transparentWell />
          ) : (
            <AppIcon family="ionicons" name="card-outline" size={20} color={colors.textMuted} />
          )}
        </View>
        <View style={styles.accountCopy}>
          <Text style={[styles.accountEyebrow, { color: colors.textMuted }]}>Compte</Text>
          <Text style={[styles.accountName, { color: colors.textSecondary }]} numberOfLines={1}>
            {accountName}
          </Text>
        </View>
      </View>

      <View style={[styles.triggerRow, { borderTopColor: colors.borderSubtle }]}>
        <View style={styles.triggerCopy}>
          <Text style={[styles.triggerLabel, { color: colors.textMuted }]}>Paiement</Text>
          <Text style={[styles.triggerName, { color: colors.textMuted }]} numberOfLines={1}>
            {data.paymentLabel}
          </Text>
        </View>
        <Text
          style={[
            moneyAmountTypography({ tier: 'row' }),
            styles.triggerAmount,
            { color: colors.textMuted },
          ]}
        >
          {formatDebtAmount(data.paymentAmount)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
    alignItems: 'stretch',
  },
  hero: {
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  percent: {
    letterSpacing: -1,
  },
  percentCaption: {
    ...typographyKit.microMedium,
  },
  warning: {
    ...typographyKit.bodyMedium,
    fontSize: typographyKit.caption.fontSize,
    lineHeight: typographyKit.caption.lineHeight,
    marginTop: 2,
  },
  track: {
    alignSelf: 'stretch',
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  fill: {
    height: '100%',
    borderRadius: BAR_HEIGHT / 2,
  },
  overflowFill: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs / 2,
  },
  metricCenter: {
    alignItems: 'center',
  },
  metricEnd: {
    alignItems: 'flex-end',
  },
  metricLabel: {
    ...typographyKit.microUpper,
    letterSpacing: 0.4,
  },
  metricValue: {
    letterSpacing: -0.4,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoSlot: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accountEyebrow: {
    ...typographyKit.microUpper,
    letterSpacing: 0.4,
  },
  accountName: {
    ...typographyKit.metaSemibold,
  },
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  triggerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  triggerLabel: {
    ...typographyKit.microUpper,
    letterSpacing: 0.4,
  },
  triggerName: {
    ...typographyKit.caption,
  },
  triggerAmount: {
    flexShrink: 0,
    fontVariant: ['tabular-nums'],
  },
});
