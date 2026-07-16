import { useCallback, useEffect, useMemo } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { PLAN_DETAIL, planDetailCardStyle, planDetailFonts } from '@/components/plans/planDetailTheme';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  planFinanceContainerPressedStyle,
  planFinanceContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { interExtraBoldText, interMediumText, interSemiboldText, spacing } from '@/constants/theme';
import { useAlertCenter, useAlertCenterSources } from '@/hooks/useAlertCenter';
import { tapHaptic } from '@/lib/haptics';
import type { AlertCenterItem, AlertCenterKind, AlertCenterSeverity } from '@/lib/alerts';
import { buildAlertDetailContent, type AlertSolution } from '@/lib/alertPresentation';
import { useAppTheme } from '@/lib/themeContext';

function asString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

const KINDS: AlertCenterKind[] = [
  'low_funds',
  'credit_limit',
  'budget_over',
  'high_interest_debt',
  'fyn',
];

function parseKind(value: string): AlertCenterKind {
  return KINDS.includes(value as AlertCenterKind) ? (value as AlertCenterKind) : 'fyn';
}

function resolveSeverityColor(severity: AlertCenterSeverity, colors: ReturnType<typeof useAppTheme>['colors']): string {
  switch (severity) {
    case 'danger':
      return colors.danger;
    case 'warning':
      return colors.warning;
    case 'success':
      return PLAN_DETAIL.accent;
    default:
      return colors.textMuted;
  }
}

function solutionIcon(solution: AlertSolution): { family: 'ionicons' | 'material-community'; name: string } {
  if (solution.href?.includes('ai-chat')) {
    return { family: 'ionicons', name: 'chatbubble-ellipses-outline' };
  }
  if (solution.href?.includes('plans')) {
    return { family: 'ionicons', name: 'layers-outline' };
  }
  if (solution.href?.includes('budget')) {
    return { family: 'ionicons', name: 'pie-chart-outline' };
  }
  if (solution.href?.includes('add-transaction') || solution.id.includes('transfer')) {
    return { family: 'ionicons', name: 'swap-horizontal-outline' };
  }
  if (solution.href?.includes('account') || solution.href?.includes('accounts')) {
    return { family: 'ionicons', name: 'wallet-outline' };
  }
  if (solution.href?.includes('transaction')) {
    return { family: 'ionicons', name: 'calendar-outline' };
  }
  if (solution.href?.includes('goals')) {
    return { family: 'ionicons', name: 'flag-outline' };
  }
  return { family: 'ionicons', name: 'arrow-forward-circle-outline' };
}

export default function AlertDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{
    id?: string;
    kind?: string;
    title?: string;
    message?: string;
    accountId?: string;
    montant?: string;
    recurring?: string;
    paymentName?: string;
  }>();

  const { recurringPayments, simulatedAccounts, incomeTransactions, ready } = useAlertCenterSources();
  const { items, markRead } = useAlertCenter({
    recurringPayments,
    simulatedAccounts,
    incomeTransactions,
    enabled: ready,
  });

  const paramItem = useMemo((): AlertCenterItem | null => {
    const id = asString(params.id);
    const title = asString(params.title);
    const message = asString(params.message);
    if (!id && !title) return null;
    const montantRaw = asString(params.montant);
    const recurringRaw = asString(params.recurring);
    const recurring =
      recurringRaw === '1' ? true : recurringRaw === '0' ? false : undefined;
    const paymentName = asString(params.paymentName) || undefined;
    return {
      id: id || 'param',
      kind: parseKind(asString(params.kind)),
      section: 'urgent',
      severity: 'warning',
      title: title || 'Message',
      message,
      timestamp: new Date().toISOString(),
      read: true,
      accountId: asString(params.accountId) || undefined,
      montant: montantRaw ? Number(montantRaw) : null,
      recurring,
      paymentName,
    };
  }, [params]);

  const item = useMemo(() => {
    const id = asString(params.id);
    const fromStore = id ? items.find((entry) => entry.id === id) : undefined;
    return fromStore ?? paramItem;
  }, [items, paramItem, params.id]);

  useEffect(() => {
    const id = asString(params.id);
    if (!id) return;
    const found = items.find((entry) => entry.id === id);
    if (found && !found.read) void markRead(found);
  }, [items, markRead, params.id]);

  const detail = useMemo(
    () =>
      item
        ? buildAlertDetailContent(item)
        : buildAlertDetailContent({
            kind: 'fyn',
            title: 'Message',
            message: 'Cette alerte n’est plus disponible.',
          }),
    [item],
  );

  const severity = item?.severity ?? 'warning';
  const severityColor = resolveSeverityColor(severity, colors);

  const handleBack = useCallback(() => {
    tapHaptic();
    router.back();
  }, [router]);

  const handleSolution = useCallback(
    (href: string | null, solutionParams?: Record<string, string>) => {
      if (!href) return;
      tapHaptic();
      router.push({ pathname: href as never, params: solutionParams });
    },
    [router],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="ionicons" name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }, interExtraBoldText]} numberOfLines={1}>
            {item?.title ?? 'Alerte'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) },
          ]}
        >
          <Text style={[styles.eyebrow, { color: colors.textMuted }, interMediumText]}>{detail.eyebrow}</Text>

          {/* 1. Le problème */}
          <View
            style={[
              planDetailCardStyle.card,
              styles.problemCard,
              {
                backgroundColor: colors.containerBackground,
                borderColor: colors.containerBorder,
              },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: severityColor }, interSemiboldText]}>
              {detail.problemLabel}
            </Text>
            <Text style={[styles.problemBody, { color: colors.text }, interMediumText]}>{detail.problemBody}</Text>
          </View>

          {/* 2. Comment le régler — unboxed guidance (no twin card) */}
          <View style={styles.fixSection}>
            <Text style={[planDetailFonts.sectionCaps, { color: colors.textMuted }]}>{detail.fixLabel}</Text>
            <Text style={[planDetailFonts.body, { color: colors.text }]}>{detail.fixBody}</Text>
          </View>

          {/* 3. Tes actions */}
          <View style={styles.actionsSection}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }, interSemiboldText]}>
              {detail.actionsLabel}
            </Text>

            <View style={styles.actionsList}>
              {detail.solutions.map((solution, index) => {
                const interactive = Boolean(solution.href);
                const icon = solutionIcon(solution);

                const card = (
                  <PlanFinanceContainer style={planFinanceContainerRowLayoutStyle()}>
                    <View style={[styles.stepBadge, { backgroundColor: colors.input }]}>
                      <Text style={[styles.stepNumber, { color: colors.textSecondary }, interSemiboldText]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.actionCopy}>
                      <Text style={[styles.actionTitle, { color: colors.text }, interSemiboldText]}>
                        {solution.title}
                      </Text>
                      <Text style={[styles.actionBody, { color: colors.textMuted }, interMediumText]}>
                        {solution.description}
                      </Text>
                    </View>
                    {interactive ? (
                      <View style={styles.actionTrailing}>
                        <AppIcon family={icon.family} name={icon.name} size={18} color={PLAN_DETAIL.accent} />
                        <AppIcon family="ionicons" name="chevron-forward" size={16} color={PLAN_DETAIL.accent} />
                      </View>
                    ) : null}
                  </PlanFinanceContainer>
                );

                if (!interactive) {
                  return (
                    <View key={solution.id} style={styles.actionItem}>
                      {card}
                    </View>
                  );
                }

                return (
                  <Pressable
                    key={solution.id}
                    accessibilityRole="button"
                    accessibilityLabel={solution.ctaLabel}
                    onPress={() => handleSolution(solution.href, solution.params)}
                    style={({ pressed }) => [styles.actionItem, pressed && planFinanceContainerPressedStyle()]}
                  >
                    {card}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    letterSpacing: -0.3,
  },
  headerSpacer: { width: 38 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: PLAN_DETAIL.sectionGap,
  },
  eyebrow: {
    fontSize: 13,
    marginTop: -spacing.xs,
  },
  sectionLabel: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  problemCard: {
    gap: spacing.sm,
  },
  problemBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  fixSection: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  actionsSection: {
    gap: spacing.md,
  },
  actionsList: {
    gap: spacing.sm,
  },
  actionItem: {
    alignSelf: 'stretch',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: 13,
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  actionTitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
    alignSelf: 'center',
  },
  pressed: { opacity: 0.78 },
});
