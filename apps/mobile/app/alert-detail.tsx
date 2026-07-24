import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { AlertProblemInsightCard } from '@/components/alerts/AlertProblemInsightCard';
import { CreditLimitProblemTimeline } from '@/components/alerts/CreditLimitProblemTimeline';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import {
  planDetailFonts,
  usePlanDetailTheme,
} from '@/components/plans/planDetailTheme';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  PLAN_FINANCE_CONTAINER,
  planFinanceContainerPressedStyle,
  planFinanceContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import { interExtraBoldText, interMediumText, interSemiboldText, spacing } from '@/constants/theme';
import { useAlertCenter, useAlertCenterSources } from '@/hooks/useAlertCenter';
import { tapHaptic } from '@/lib/haptics';
import type { AlertCenterItem, AlertCenterKind, AlertCenterSeverity } from '@/lib/alerts';
import {
  alertTypeHeaderTitle,
  buildAlertDetailContent,
  resolveAlertAccountIdentity,
  type AlertSolution,
} from '@/lib/alertPresentation';
import { generateAlertSolutions } from '@/lib/ai/alertSolutionService';
import {
  acceptPlanAdaptation,
  dismissPlanAdaptation,
  getPlanAdaptationProposal,
} from '@/lib/plans/planAdaptationProposals';
import { resolveCreditLimitTimelineData } from '@/lib/resolveCreditLimitTimeline';
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
  'plan_adaptation',
  'fyn',
];

function parseKind(value: string): AlertCenterKind {
  return KINDS.includes(value as AlertCenterKind) ? (value as AlertCenterKind) : 'fyn';
}

function resolveSeverityColor(
  severity: AlertCenterSeverity,
  colors: ReturnType<typeof useAppTheme>['colors'],
  accent: string,
): string {
  switch (severity) {
    case 'danger':
      return colors.danger;
    case 'warning':
      return colors.warning;
    case 'success':
      return accent;
    default:
      return colors.textMuted;
  }
}

function solutionIcon(solution: AlertSolution): { family: 'ionicons' | 'material-community'; name: string } {
  if (solution.localAction === 'accept_adaptation') {
    return { family: 'ionicons', name: 'checkmark-circle-outline' };
  }
  if (solution.localAction === 'dismiss_adaptation') {
    return { family: 'ionicons', name: 'close-circle-outline' };
  }
  if (solution.href?.includes('ai-chat')) {
    return { family: 'ionicons', name: 'chatbubble-ellipses-outline' };
  }
  if (solution.href?.includes('plans') || solution.href?.includes('goals')) {
    return { family: 'ionicons', name: 'layers-outline' };
  }
  if (solution.href?.includes('budget')) {
    return { family: 'ionicons', name: 'pie-chart-outline' };
  }
  if (solution.href?.includes('account') || solution.href?.includes('accounts')) {
    return { family: 'ionicons', name: 'wallet-outline' };
  }
  if (solution.href?.includes('transaction')) {
    return { family: 'ionicons', name: 'calendar-outline' };
  }
  return { family: 'ionicons', name: 'arrow-forward-circle-outline' };
}

export default function AlertDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const theme = usePlanDetailTheme();
  const params = useLocalSearchParams<{
    id?: string;
    kind?: string;
    title?: string;
    message?: string;
    accountId?: string;
    montant?: string;
    recurring?: string;
    paymentName?: string;
    adaptationProposalId?: string;
    relatedPlanId?: string;
  }>();

  const { recurringPayments, simulatedAccounts, incomeTransactions, ready } = useAlertCenterSources();
  const { items, markRead, refresh } = useAlertCenter({
    recurringPayments,
    simulatedAccounts,
    incomeTransactions,
    enabled: ready,
  });

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    variant: 'success' | 'info' | 'error';
  }>({ visible: false, title: '', message: '', variant: 'info' });

  const paramItem = useMemo((): AlertCenterItem | null => {
    const id = asString(params.id);
    const title = asString(params.title);
    const message = asString(params.message);
    if (!id && !title) return null;
    const montantRaw = asString(params.montant);
    const recurringRaw = asString(params.recurring);
    const adaptationProposalId = asString(params.adaptationProposalId) || undefined;
    const relatedPlanId = asString(params.relatedPlanId) || undefined;
    const kind = parseKind(asString(params.kind));
    return {
      id: id || `param-${title}`,
      kind,
      section: kind === 'plan_adaptation' ? 'opportunities' : 'urgent',
      severity: 'info',
      title: title || 'Alerte',
      message,
      timestamp: new Date().toISOString(),
      read: false,
      accountId: asString(params.accountId) || undefined,
      montant: montantRaw ? Number(montantRaw) : null,
      recurring: recurringRaw === '1' ? true : recurringRaw === '0' ? false : undefined,
      paymentName: asString(params.paymentName) || undefined,
      adaptationProposalId,
      relatedPlanId,
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
            id: 'unavailable',
          }),
    [item],
  );

  const [solutions, setSolutions] = useState(detail.solutions);

  useEffect(() => {
    setSolutions(detail.solutions);
    if (!item) return;

    let cancelled = false;
    void (async () => {
      const refined = await generateAlertSolutions(
        {
          id: item.id,
          kind: item.kind,
          title: item.title,
          message: item.message,
          montant: item.montant,
          recurring: item.recurring,
          paymentName: item.paymentName,
        },
        detail.solutions,
      );
      if (!cancelled) setSolutions(refined);
    })();

    return () => {
      cancelled = true;
    };
  }, [detail.solutions, item]);

  const severity = item?.severity ?? 'warning';
  const isCreditLimit = item?.kind === 'credit_limit';
  /** Plan-style accent for credit-limit; severity tone for other alerts. */
  const problemLabelColor = isCreditLimit
    ? theme.accent
    : resolveSeverityColor(severity, colors, theme.accent);

  const insightContext = useMemo(
    () =>
      item
        ? {
            id: item.id,
            kind: item.kind,
            title: item.title,
            message: item.message,
            montant: item.montant,
            recurring: item.recurring,
            paymentName: item.paymentName,
            categoryLabel: detail.eyebrow,
          }
        : null,
    [detail.eyebrow, item],
  );

  const creditLimitTimeline = useMemo(() => {
    if (!item || item.kind !== 'credit_limit') return null;
    return resolveCreditLimitTimelineData(item, { simulatedAccounts, recurringPayments });
  }, [item, recurringPayments, simulatedAccounts]);

  const alertAccountLine = useMemo(() => {
    if (!item) return null;
    return resolveAlertAccountIdentity(item, simulatedAccounts);
  }, [item, simulatedAccounts]);

  const handleBack = useCallback(() => {
    tapHaptic();
    router.back();
  }, [router]);

  const adaptationProposalId =
    item?.adaptationProposalId ?? asString(params.adaptationProposalId) ?? '';

  useEffect(() => {
    if (!adaptationProposalId || item?.kind !== 'plan_adaptation') return;
    let cancelled = false;
    void (async () => {
      const proposal = await getPlanAdaptationProposal(adaptationProposalId);
      if (cancelled || !proposal) return;
      setConfirmMessage(
        `${proposal.summary}\n\nPourquoi c’est utile : ${proposal.whyUseful}`,
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [adaptationProposalId, item?.kind]);

  const handleAcceptAdaptation = useCallback(async () => {
    if (!adaptationProposalId || confirmBusy) return;
    setConfirmBusy(true);
    try {
      const result = await acceptPlanAdaptation(adaptationProposalId);
      setConfirmVisible(false);
      setResultModal({
        visible: true,
        title: result.ok ? 'Adaptation appliquée' : 'Impossible d’appliquer',
        message: result.message,
        variant: result.ok ? 'success' : 'error',
      });
      if (result.ok) {
        void refresh();
        if (item) void markRead(item);
      }
    } finally {
      setConfirmBusy(false);
    }
  }, [adaptationProposalId, confirmBusy, item, markRead, refresh]);

  const handleDismissAdaptation = useCallback(async () => {
    if (!adaptationProposalId) return;
    tapHaptic();
    const result = await dismissPlanAdaptation(adaptationProposalId);
    setResultModal({
      visible: true,
      title: 'Proposition ignorée',
      message: result.message,
      variant: 'info',
    });
    void refresh();
    if (item) void markRead(item);
  }, [adaptationProposalId, item, markRead, refresh]);

  const handleSolutionPress = useCallback(
    (solution: AlertSolution) => {
      if (solution.localAction === 'accept_adaptation') {
        tapHaptic();
        setConfirmVisible(true);
        return;
      }
      if (solution.localAction === 'dismiss_adaptation') {
        void handleDismissAdaptation();
        return;
      }
      if (!solution.href) return;
      tapHaptic();
      router.push({ pathname: solution.href as never, params: solution.params });
    },
    [handleDismissAdaptation, router],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: theme.surface, borderColor: theme.border },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="material" name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }, interExtraBoldText]} numberOfLines={1}>
            {alertTypeHeaderTitle(item?.kind ?? 'fyn')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: Math.max(insets.bottom + spacing.xl, 56),
              gap: theme.sectionGap,
            },
          ]}
        >
          {/* 1. Le problème — same Onyx shell as INSIGHT / action rows */}
          <PlanFinanceContainer style={[styles.problemCard, styles.problemShell]}>
            <Text style={[planDetailFonts.sectionCaps, { color: problemLabelColor }]}>
              {detail.problemLabel}
            </Text>
            {alertAccountLine ? (
              <Text style={[planDetailFonts.detailLabel, styles.accountLine, { color: theme.textMuted }]} numberOfLines={1}>
                {alertAccountLine}
              </Text>
            ) : null}
            <Text style={[planDetailFonts.body, { color: theme.text }]}>{detail.problemBody}</Text>
            {creditLimitTimeline ? <CreditLimitProblemTimeline data={creditLimitTimeline} /> : null}
          </PlanFinanceContainer>

          {/* 2. Conseil préventif INSIGHT (Gemini ou fallback statique) */}
          {insightContext ? (
            <AlertProblemInsightCard
              context={insightContext}
              fallbackBody={detail.insightFallbackBody}
            />
          ) : (
            <View style={styles.fixSection}>
              <Text style={[planDetailFonts.body, { color: theme.text }]}>
                {detail.insightFallbackBody}
              </Text>
            </View>
          )}

          {/* 3. Tes actions */}
          <View style={styles.actionsSection}>
            <Text style={[planDetailFonts.sectionCaps, { color: theme.textMuted }]}>
              {detail.actionsLabel}
            </Text>

            <View style={styles.actionsList}>
              {solutions.map((solution, index) => {
                const interactive = Boolean(solution.href) || Boolean(solution.localAction);
                const icon = solutionIcon(solution);

                const card = (
                  <PlanFinanceContainer style={planFinanceContainerRowLayoutStyle()}>
                    <View style={[styles.stepBadge, { backgroundColor: colors.input }]}>
                      <Text style={[styles.stepNumber, { color: colors.textSecondary }, interSemiboldText]}>
                        {index + 1}
                      </Text>
                    </View>
                    <View style={styles.actionCopy}>
                      <Text style={[styles.actionTitle, { color: theme.text }, interSemiboldText]}>
                        {solution.title}
                      </Text>
                      <Text style={[styles.actionBody, { color: theme.textMuted }, interMediumText]}>
                        {solution.description}
                      </Text>
                    </View>
                    {interactive ? (
                      <View style={styles.actionTrailing}>
                        <AppIcon family={icon.family} name={icon.name} size={18} color={theme.accent} />
                        <AppIcon family="ionicons" name="chevron-forward" size={16} color={theme.accent} />
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
                    onPress={() => handleSolutionPress(solution)}
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

      <ThemedConfirmModal
        visible={confirmVisible}
        title="Confirmer l’adaptation"
        message={
          confirmMessage ||
          item?.message ||
          'Appliquer le changement proposé sur ton plan ?'
        }
        confirmLabel={confirmBusy ? 'Application…' : 'Appliquer'}
        cancelLabel="Pas maintenant"
        variant="success"
        icon="swap-horizontal-outline"
        onConfirm={() => {
          void handleAcceptAdaptation();
        }}
        onCancel={() => setConfirmVisible(false)}
      />

      <ThemedConfirmModal
        visible={resultModal.visible}
        title={resultModal.title}
        message={resultModal.message}
        confirmLabel="OK"
        variant={resultModal.variant}
        onConfirm={() => {
          setResultModal((prev) => ({ ...prev, visible: false }));
          if (resultModal.variant === 'success' || resultModal.variant === 'info') {
            router.back();
          }
        }}
      />
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
    borderRadius: 8,
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
  },
  problemShell: {
    alignSelf: 'stretch',
    padding: PLAN_FINANCE_CONTAINER.padding.card,
  },
  problemCard: {
    gap: spacing.md,
  },
  accountLine: {
    marginTop: -spacing.xs,
    letterSpacing: -0.1,
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
