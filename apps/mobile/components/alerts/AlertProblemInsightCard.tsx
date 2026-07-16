import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { PLAN_FINANCE_CONTAINER } from '@/constants/planFinanceKit';
import { interMediumText, interSemiboldText, spacing, typography } from '@/constants/theme';
import {
  generateAlertProblemInsight,
  type AlertInsightContext,
} from '@/lib/ai/alertInsightService';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  context: AlertInsightContext;
  fallbackBody: string;
};

export function AlertProblemInsightCard({ context, fallbackBody }: Props) {
  const { colors } = useAppTheme();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInsight() {
      setLoading(true);
      const generated = await generateAlertProblemInsight(context);
      if (cancelled) return;
      setInsight(generated);
      setLoading(false);
    }

    void loadInsight();
    return () => {
      cancelled = true;
    };
  }, [
    context.id,
    context.kind,
    context.title,
    context.message,
    context.categoryLabel,
    context.montant,
    context.recurring,
    context.paymentName,
  ]);

  const body = insight ?? fallbackBody;
  const bodyColor = loading && !insight ? colors.textMuted : colors.text;

  return (
    <PlanFinanceContainer style={styles.card}>
      <View style={styles.badgeRow}>
        <AppIcon family="material" name="auto-awesome" size={13} color={colors.accentGreen} />
        <Text style={[styles.badgeText, { color: colors.accentGreen }, interSemiboldText]}>
          INSIGHT
        </Text>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={colors.textMuted}
            style={styles.loader}
            accessibilityLabel="Analyse en cours"
          />
        ) : null}
      </View>

      <Text style={[styles.body, { color: bodyColor }, interMediumText]}>{body}</Text>
    </PlanFinanceContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    padding: PLAN_FINANCE_CONTAINER.padding.card,
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    flex: 1,
  },
  loader: {
    marginLeft: spacing.xs,
  },
  body: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
  },
});
