import { StyleSheet, Text, View } from 'react-native';
import {
  formatDisplayMoneyAbsolute,
  formatSignedDisplayMoney,
} from '@/lib/formatDisplayMoney';
import type { CreditLimitTimelineData } from '@/lib/resolveCreditLimitTimeline';
import {
  creditLimitMarginHintColor,
  creditLimitUtilizationBarColor,
  utilizationPercentColor,
} from '@/lib/creditLimitUtilization';
import {
  moneyAmountTypography,
  PROGRESS_BAR_TRACK_HEIGHT,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

/** Credit used / payment outflow — always debt-signed (−). */
function formatDebtAmount(absValue: number): string {
  return formatSignedDisplayMoney(-Math.abs(absValue));
}

type Props = {
  data: CreditLimitTimelineData;
};

type StepTone = 'neutral' | 'payment' | 'risk';

function StepNode({
  tone,
  colors,
}: {
  tone: StepTone;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  if (tone === 'payment') {
    return (
      <View
        style={[
          styles.nodePayment,
          { borderColor: colors.accentGreen, backgroundColor: colors.successMuted },
        ]}
      >
        <View style={[styles.nodePaymentDot, { backgroundColor: colors.accentGreen }]} />
      </View>
    );
  }

  if (tone === 'risk') {
    return (
      <View style={[styles.nodeRisk, { borderColor: colors.warning, backgroundColor: colors.warningMuted }]}>
        <View style={[styles.nodeRiskDot, { backgroundColor: colors.warning }]} />
      </View>
    );
  }

  return (
    <View style={[styles.nodeNeutral, { borderColor: colors.textSecondary }]}>
      <View style={[styles.nodeNeutralDot, { backgroundColor: colors.textSecondary }]} />
    </View>
  );
}

function TimelineStep({
  title,
  amount,
  hint,
  hintColor,
  amountColor,
  tone,
  showConnector,
  connectorColor,
  colors,
  titleEmphasis,
}: {
  title: string;
  amount: string;
  hint?: string;
  hintColor?: string;
  amountColor: string;
  tone: StepTone;
  showConnector: boolean;
  connectorColor: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  titleEmphasis?: boolean;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <StepNode tone={tone} colors={colors} />
        {showConnector ? (
          <View style={[styles.connector, { backgroundColor: connectorColor }]} />
        ) : null}
      </View>
      <View style={styles.stepCopy}>
        <Text
          style={[
            titleEmphasis ? typographyKit.metaSemibold : typographyKit.metaMedium,
            styles.stepTitle,
            { color: titleEmphasis ? colors.text : colors.textMuted },
          ]}
        >
          {title}
        </Text>
        <Text style={[moneyAmountTypography({ tier: 'card' }), { color: amountColor }]}>{amount}</Text>
        {hint ? (
          <Text style={[typographyKit.microMedium, styles.stepHint, { color: hintColor ?? colors.textMuted }]}>
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function CreditLimitProblemTimeline({ data }: Props) {
  const { colors, isLight } = useAppTheme();

  const afterAmountColor = data.isOverLimit ? colors.warning : colors.text;
  const afterHint = data.isOverLimit
    ? `Dépassement · ${formatDisplayMoneyAbsolute(data.overLimitBy)}`
    : `Marge disponible · ${formatDisplayMoneyAbsolute(Math.max(0, data.availableAfter))}`;
  const afterHintColor = creditLimitMarginHintColor(
    data.utilizationAfterPct,
    data.isOverLimit,
    colors,
  );

  const utilizationAfter = Math.min(data.utilizationAfterPct, 100);
  const utilizationRemainder = Math.max(0, 100 - utilizationAfter);
  const barFillColor = data.isOverLimit
    ? colors.warning
    : creditLimitUtilizationBarColor(data.utilizationAfterPct, colors, isLight);
  const percentColor = data.isOverLimit
    ? colors.warning
    : utilizationPercentColor(data.utilizationAfterPct, colors);

  const railColor = colors.textSecondary;

  return (
    <View style={styles.timeline}>
      <TimelineStep
        title="Avant le paiement"
        amount={formatDebtAmount(data.balanceUsedBefore)}
        hint={`Marge · ${formatDisplayMoneyAbsolute(Math.max(0, data.availableBefore))}`}
        amountColor={colors.text}
        tone="neutral"
        showConnector
        connectorColor={railColor}
        colors={colors}
      />

      <TimelineStep
        title={`Paiement · ${data.paymentLabel}`}
        amount={formatDebtAmount(data.paymentAmount)}
        amountColor={colors.text}
        tone="payment"
        showConnector
        connectorColor={railColor}
        colors={colors}
        titleEmphasis
      />

      <TimelineStep
        title="Après le paiement"
        amount={formatDebtAmount(data.balanceUsedAfter)}
        hint={afterHint}
        hintColor={afterHintColor}
        amountColor={afterAmountColor}
        tone={data.isOverLimit ? 'risk' : 'neutral'}
        showConnector={false}
        connectorColor={railColor}
        colors={colors}
      />

      <View style={[styles.limitDivider, { backgroundColor: colors.borderSubtle }]} />

      <View style={styles.limitRow}>
        <Text style={[typographyKit.metaMedium, styles.limitLabel, { color: colors.textMuted }]}>
          Limite carte
        </Text>
        <Text style={[moneyAmountTypography({ tier: 'row' }), { color: colors.text }]}>
          {formatDisplayMoneyAbsolute(data.creditLimit)}
        </Text>
      </View>

      <View style={styles.utilTrackWrap}>
        <View style={[styles.utilTrack, { backgroundColor: colors.input }]}>
          <View
            style={[
              styles.utilFill,
              {
                flex: utilizationAfter,
                backgroundColor: barFillColor,
              },
            ]}
          />
          {utilizationRemainder > 0 ? <View style={{ flex: utilizationRemainder }} /> : null}
        </View>
        <Text style={[typographyKit.metaSemibold, styles.utilLabel, { color: percentColor }]}>
          {Math.round(data.utilizationAfterPct)} %
        </Text>
      </View>
    </View>
  );
}

const NODE_SIZE = 12;
const NODE_DOT_SIZE = 5;

const styles = StyleSheet.create({
  timeline: {
    gap: 0,
    marginTop: spacing.xs,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stepRail: {
    width: NODE_SIZE,
    alignItems: 'center',
  },
  nodeNeutral: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  nodeNeutralDot: {
    width: NODE_DOT_SIZE,
    height: NODE_DOT_SIZE,
    borderRadius: NODE_DOT_SIZE / 2,
  },
  nodePayment: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  nodePaymentDot: {
    width: NODE_DOT_SIZE,
    height: NODE_DOT_SIZE,
    borderRadius: NODE_DOT_SIZE / 2,
  },
  nodeRisk: {
    width: NODE_SIZE,
    height: NODE_SIZE,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  nodeRiskDot: {
    width: NODE_DOT_SIZE,
    height: NODE_DOT_SIZE,
    borderRadius: NODE_DOT_SIZE / 2,
  },
  connector: {
    width: 1.5,
    flex: 1,
    minHeight: spacing.lg,
    marginVertical: spacing.xs,
    borderRadius: 1,
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
    paddingBottom: spacing.lg,
    gap: 3,
  },
  stepTitle: {
    letterSpacing: -0.1,
  },
  stepHint: {
    marginTop: 1,
  },
  limitDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  limitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  limitLabel: {
    letterSpacing: -0.1,
  },
  utilTrackWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  utilTrack: {
    flex: 1,
    height: PROGRESS_BAR_TRACK_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  utilFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  utilLabel: {
    minWidth: 36,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
