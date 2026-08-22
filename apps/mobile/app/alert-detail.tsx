import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { AlertDetailActionsList } from '@/components/alerts/AlertDetailActionsList';
import { AlertDetailHeroCard } from '@/components/alerts/AlertDetailHeroCard';
import { AlertSolutionDetailSheet } from '@/components/alerts/AlertSolutionDetailSheet';
import { BudgetOverrunDiagnostic } from '@/components/alerts/BudgetOverrunDiagnostic';
import { BudgetOverrunTransactions } from '@/components/alerts/BudgetOverrunTransactions';
import { CreditLimitProblemTimeline } from '@/components/alerts/CreditLimitProblemTimeline';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { ONYX_CONTAINER } from '@/constants/planFinanceKit';
import {
  jakartaExtraBoldText,
  screenHorizontalGutter,
  spacing,
  typography,
} from '@/constants/theme';
import { useAlertCenter, useAlertCenterSources } from '@/hooks/useAlertCenter';
import { tapHaptic } from '@/lib/haptics';
import type { AlertCenterItem, AlertCenterKind } from '@/lib/alerts';
import {
  alertHomePrimaryTitle,
  alertTypeHeaderTitle,
  buildAlertDetailContent,
  resolveAlertAccountIdentity,
  resolveAlertCreditAccount,
  type AlertSolution,
} from '@/lib/alertPresentation';
import { buildCreditLimitAlertReason } from '@/lib/creditLimitAlertCopy';
import { generateAlertSolutions } from '@/lib/ai/alertSolutionService';
import {
  acceptPlanAdaptation,
  dismissPlanAdaptation,
  getPlanAdaptationProposal,
} from '@/lib/plans/planAdaptationProposals';
import { dataEvents } from '@/lib/events';
import { resolveBudgetOverrunData, type BudgetOverrunData } from '@/lib/resolveBudgetOverrun';
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

export default function AlertDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
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
  const [selectedSolution, setSelectedSolution] = useState<AlertSolution | null>(null);
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
  const [budgetOverrun, setBudgetOverrun] = useState<BudgetOverrunData | null>(null);

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

  const creditLimitTimeline = useMemo(() => {
    if (!item || item.kind !== 'credit_limit') return null;
    return resolveCreditLimitTimelineData(item, { simulatedAccounts, recurringPayments });
  }, [item, recurringPayments, simulatedAccounts]);

  useEffect(() => {
    if (!item || item.kind !== 'budget_over') {
      setBudgetOverrun(null);
      return;
    }

    let cancelled = false;
    const load = () => {
      void resolveBudgetOverrunData(item).then((data) => {
        if (!cancelled) setBudgetOverrun(data);
      });
    };
    load();
    const unsubscribe = dataEvents.subscribe(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [item]);

  const alertAccountLine = useMemo(() => {
    if (!item) return null;
    return resolveAlertAccountIdentity(item, simulatedAccounts);
  }, [item, simulatedAccounts]);

  const creditAccount = useMemo(() => {
    if (!item || item.kind !== 'credit_limit') return null;
    return resolveAlertCreditAccount(item, simulatedAccounts);
  }, [item, simulatedAccounts]);

  const conditionTitle = useMemo(() => {
    if (!item) return detail.eyebrow || 'Alerte';
    if (item.kind === 'credit_limit' && creditLimitTimeline) {
      return buildCreditLimitAlertReason(
        item.paymentName,
        creditLimitTimeline.utilizationAfterPct,
        creditLimitTimeline.isOverLimit,
      );
    }
    return alertHomePrimaryTitle(item);
  }, [item, creditLimitTimeline, detail.eyebrow]);

  const heroMeta = useMemo(() => {
    if (item?.kind === 'credit_limit' && creditLimitTimeline) return null;
    if (item?.kind === 'budget_over') {
      // Category is already in the condition title (« Budget Épicerie dépassé »).
      return null;
    }
    return alertAccountLine;
  }, [alertAccountLine, creditLimitTimeline, item?.kind]);

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
      tapHaptic();
      setSelectedSolution(solution);
    },
    [handleDismissAdaptation],
  );

  const handleSolutionSheetClose = useCallback(() => {
    setSelectedSolution(null);
  }, []);

  const handleSolutionContinue = useCallback(
    (solution: AlertSolution) => {
      if (!solution.href) {
        setSelectedSolution(null);
        return;
      }
      tapHaptic();
      setSelectedSolution(null);
      router.push({ pathname: solution.href as never, params: solution.params });
    },
    [router],
  );

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + SCREEN_TOP_GUTTER,
              paddingHorizontal: contentGutter,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backHit,
              { backgroundColor: colors.containerBackground, borderColor: colors.containerBorder },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="ionicons" name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {alertTypeHeaderTitle(item?.kind ?? 'fyn')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: contentGutter,
              paddingBottom: Math.max(insets.bottom + spacing.xl, 56),
            },
          ]}
        >
          <View style={styles.section}>
            <AlertDetailHeroCard
              title={conditionTitle}
              meta={heroMeta}
              body={budgetOverrun || creditLimitTimeline ? null : detail.problemBody}
            >
              {creditLimitTimeline ? (
                <CreditLimitProblemTimeline
                  data={creditLimitTimeline}
                  accountLabel={alertAccountLine ?? creditLimitTimeline.accountLabel}
                  account={creditAccount}
                />
              ) : null}
              {budgetOverrun ? <BudgetOverrunDiagnostic data={budgetOverrun} /> : null}
            </AlertDetailHeroCard>
          </View>

          {budgetOverrun ? <BudgetOverrunTransactions data={budgetOverrun} /> : null}

          <AlertDetailActionsList
            label={detail.actionsLabel}
            solutions={solutions}
            onPressSolution={handleSolutionPress}
          />
        </ScrollView>
      </View>

      <AlertSolutionDetailSheet
        visible={selectedSolution != null}
        solution={selectedSolution}
        onClose={handleSolutionSheetClose}
        onContinue={handleSolutionContinue}
      />

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
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backHit: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    letterSpacing: -0.2,
    minWidth: 0,
  },
  headerSpacer: { width: 38 },
  content: {
    gap: spacing.xl,
  },
  section: {
    alignSelf: 'stretch',
  },
  pressed: { opacity: ONYX_CONTAINER.pressedOpacity },
});
