import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { AppIcon } from '@/components/icons/AppIcon';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import {
  planFinanceEyebrowStyle,
  planFinanceFonts,
  planFinanceInputStyle,
  planFinanceKit,
} from '@/constants/planFinanceKit';
import { interMediumText, interSemiboldText, radius, spacing } from '@/constants/theme';
import { getCategoryBudgets } from '@/lib/db';
import { formatDisplayMoneyAbsolute, formatSignedDisplayMoney } from '@/lib/formatDisplayMoney';
import { formatFriendlyDateLabel } from '@/lib/formatFriendlyDateLabel';
import { tapHaptic } from '@/lib/haptics';
import { assessDebtExtraFeasibility } from '@/lib/plans/debtPlanFeasibility';
import {
  loadAverageMonthlyCashflow,
  type MonthlyCashflowAverage,
} from '@/lib/plans/monthlyCashflowAverage';
import {
  candidateToPayoffInput,
  createManualDebtCandidate,
  filterEligibleDebtPlanCandidates,
  loadDebtPlanCandidates,
  strategyForDebtSubtype,
  toPlanDebtSelection,
  type DebtPlanCandidate,
} from '@/lib/plans/debtPlanCandidates';
import {
  extraToMonthly,
  formatDebtFreeDuration,
  orderDebtsForStrategy,
  projectDebtPayoff,
  type DebtPayoffStrategy,
} from '@/lib/plans/debtPayoffMath';
import { parsePlanAmountInput } from '@/lib/plans/planTypeFormConfig';
import type {
  PlanDebtFeasibilitySnapshot,
  PlanExtraCadence,
  PlanParametres,
  PlanSubtype,
} from '@/lib/plans/Plan';
import type { CategoryBudget } from '@/types';

export type DebtWizardAssembled = {
  montant_cible: number;
  montant_actuel: number;
  cadence: string;
  date_cible?: string;
  parametres: PlanParametres;
};

type Props = {
  subtype: PlanSubtype;
  step: number;
  onAssembledChange: (assembled: DebtWizardAssembled | null) => void;
  onValidityChange: (valid: boolean, error?: { title: string; message: string }) => void;
};

const STEP_COUNT = 4;
const inputShellStyle = planFinanceInputStyle() as TextStyle;

const STEP_ENCOURAGEMENTS = [
  'on démarre',
  'bien parti',
  'presque fini',
  'dernier coup d’œil',
] as const;

export function debtWizardStepCount(): number {
  return STEP_COUNT;
}

export function DebtPlanWizard({
  subtype,
  step,
  onAssembledChange,
  onValidityChange,
}: Props) {
  const pf = planFinanceKit.colors;
  const strategy = strategyForDebtSubtype(subtype);

  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<DebtPlanCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cashflowAverage, setCashflowAverage] = useState<MonthlyCashflowAverage | null>(null);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);

  const [manualBalance, setManualBalance] = useState('');
  const [manualRate, setManualRate] = useState('');
  const [manualMin, setManualMin] = useState('');
  const [manualLabel, setManualLabel] = useState('Dette manuelle');

  const [extraAmount, setExtraAmount] = useState('');
  const [extraCadence, setExtraCadence] = useState<PlanExtraCadence>('month');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [debtList, average, cats] = await Promise.all([
        loadDebtPlanCandidates(),
        loadAverageMonthlyCashflow(),
        getCategoryBudgets(),
      ]);
      if (cancelled) return;
      const eligible = filterEligibleDebtPlanCandidates(debtList);
      setCandidates(eligible);
      setCashflowAverage(average);
      setBudgets(cats);
      if (eligible.length > 0) {
        const initial =
          subtype === 'dette_individuelle' && eligible.length > 1
            ? new Set([eligible[0]!.id])
            : new Set(eligible.map((d) => d.id));
        setSelectedIds(initial);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [subtype]);

  const selectedCandidates = useMemo(() => {
    if (candidates.length === 0) {
      const balance = parsePlanAmountInput(manualBalance) ?? 0;
      const rate = parsePlanAmountInput(manualRate) ?? 0;
      const min = parsePlanAmountInput(manualMin) ?? 0;
      if (balance <= 0) return [] as DebtPlanCandidate[];
      return filterEligibleDebtPlanCandidates([
        createManualDebtCandidate({
          label: manualLabel,
          balance,
          annualRatePercent: rate,
          minimumMonthly: min > 0 ? min : Math.max(10, balance * 0.03),
        }),
      ]);
    }
    return filterEligibleDebtPlanCandidates(candidates.filter((c) => selectedIds.has(c.id)));
  }, [candidates, selectedIds, manualBalance, manualRate, manualMin, manualLabel]);

  const orderedPreview = useMemo(() => {
    const inputs = selectedCandidates
      .map(candidateToPayoffInput)
      .filter((input): input is NonNullable<typeof input> => input != null);
    return orderDebtsForStrategy(inputs, strategy);
  }, [selectedCandidates, strategy]);

  const orderedCandidates = useMemo(() => {
    return orderedPreview
      .map((ordered) => {
        const candidate = selectedCandidates.find((c) => c.id === ordered.id);
        return candidate ? { ...candidate, ordre: ordered.ordre } : null;
      })
      .filter((c): c is DebtPlanCandidate & { ordre: number } => c != null);
  }, [orderedPreview, selectedCandidates]);

  const totalSelectedBalance = useMemo(
    () => selectedCandidates.reduce((sum, c) => sum + c.balance, 0),
    [selectedCandidates],
  );

  const totalMinimums = useMemo(
    () => selectedCandidates.reduce((sum, c) => sum + c.minimumMonthly, 0),
    [selectedCandidates],
  );

  const extraMonthly = useMemo(
    () => extraToMonthly(parsePlanAmountInput(extraAmount) ?? 0, extraCadence),
    [extraAmount, extraCadence],
  );

  const projection = useMemo(() => {
    if (selectedCandidates.length === 0) return null;
    const inputs = selectedCandidates
      .map(candidateToPayoffInput)
      .filter((input): input is NonNullable<typeof input> => input != null);
    if (inputs.length === 0) return null;
    return projectDebtPayoff(inputs, strategy, extraMonthly);
  }, [selectedCandidates, strategy, extraMonthly]);

  const projectionDateIso = useMemo(
    () =>
      projection?.reachable && projection.daysToDebtFree > 0
        ? addDaysIso(projection.daysToDebtFree)
        : undefined,
    [projection],
  );

  const feasibility = useMemo((): PlanDebtFeasibilitySnapshot | null => {
    if (selectedCandidates.length === 0) return null;
    return assessDebtExtraFeasibility({
      extraMonthly,
      cashflow: cashflowAverage,
      budgets,
      selectedMinimumsMonthly: totalMinimums,
    });
  }, [selectedCandidates, extraMonthly, cashflowAverage, budgets, totalMinimums]);

  const hasCashflowAverage = (cashflowAverage?.monthsUsed ?? 0) > 0;
  const averageMonthlySurplus =
    (cashflowAverage?.monthlyIncome ?? 0) - (cashflowAverage?.monthlyExpenses ?? 0);

  const assembled = useMemo((): DebtWizardAssembled | null => {
    if (selectedCandidates.length === 0 || !projection) return null;
    const dettes = orderedCandidates
      .map((c) => toPlanDebtSelection(c, c.ordre))
      .filter((d): d is NonNullable<typeof d> => d != null);
    if (dettes.length === 0) return null;
    const cadenceSuffix = extraCadence === 'week' ? 'semaine' : 'mois';
    const extraVal = parsePlanAmountInput(extraAmount) ?? 0;
    const parametres: PlanParametres = {
      solde_initial: totalSelectedBalance,
      paiement_mensuel: totalMinimums + extraMonthly,
      dettes,
      strategie_dette: strategy,
      extra_paiement: extraVal > 0 ? extraVal : undefined,
      extra_cadence: extraVal > 0 ? extraCadence : undefined,
      projection_jours: projection.reachable ? projection.daysToDebtFree : undefined,
      faisabilite: feasibility ?? undefined,
    };

    return {
      montant_cible: totalSelectedBalance,
      montant_actuel: 0,
      cadence:
        extraVal > 0
          ? `${extraVal} $ / ${cadenceSuffix} d’extra`
          : `${formatDisplayMoneyAbsolute(totalMinimums)} / mois (minimums)`,
      date_cible: projectionDateIso,
      parametres,
    };
  }, [
    selectedCandidates,
    orderedCandidates,
    projection,
    projectionDateIso,
    strategy,
    extraAmount,
    extraCadence,
    extraMonthly,
    feasibility,
    totalSelectedBalance,
    totalMinimums,
  ]);

  useEffect(() => {
    onAssembledChange(assembled);
  }, [assembled, onAssembledChange]);

  useEffect(() => {
    if (step === 0) {
      if (candidates.length === 0) {
        const balance = parsePlanAmountInput(manualBalance) ?? 0;
        if (balance <= 0) {
          onValidityChange(false, {
            title: 'Solde requis',
            message: 'Indique le solde de ta dette, ou ajoute un prêt / une carte dans l’app.',
          });
          return;
        }
        onValidityChange(true);
        return;
      }
      if (selectedIds.size === 0) {
        onValidityChange(false, {
          title: 'Sélection requise',
          message: 'Choisis au moins une dette (prêt, obligation ou carte).',
        });
        return;
      }
      if (subtype === 'dette_individuelle' && selectedIds.size > 1) {
        onValidityChange(false, {
          title: 'Une seule dette',
          message: 'Pour une dette individuelle, sélectionne une seule dette à rembourser.',
        });
        return;
      }
      onValidityChange(true);
      return;
    }

    if (step === 1) {
      onValidityChange(selectedCandidates.length > 0, {
        title: 'Dettes requises',
        message: 'Reviens à l’étape précédente pour sélectionner des dettes.',
      });
      return;
    }

    if (step === 2) {
      const amount = parsePlanAmountInput(extraAmount);
      if (amount != null && amount < 0) {
        onValidityChange(false, {
          title: 'Montant invalide',
          message: 'Le montant supplémentaire ne peut pas être négatif.',
        });
        return;
      }
      onValidityChange(true);
      return;
    }

    onValidityChange(assembled != null, {
      title: 'Projection incomplète',
      message: 'Vérifie la sélection et le montant supplémentaire.',
    });
  }, [
    step,
    candidates.length,
    selectedIds,
    manualBalance,
    selectedCandidates.length,
    extraAmount,
    assembled,
    onValidityChange,
    subtype,
  ]);

  const toggleDebt = useCallback((id: string) => {
    tapHaptic();
    setSelectedIds((prev) => {
      if (subtype === 'dette_individuelle') {
        return new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, [subtype]);

  const allSelected =
    candidates.length > 0 && candidates.every((d) => selectedIds.has(d.id));

  const toggleSelectAll = useCallback(() => {
    tapHaptic();
    setSelectedIds((prev) => {
      const everySelected =
        candidates.length > 0 && candidates.every((d) => prev.has(d.id));
      if (everySelected) return new Set();
      return new Set(candidates.map((d) => d.id));
    });
  }, [candidates]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={pf.accent} />
        <Text style={[styles.loadingText, { color: pf.textMuted }]}>Chargement de tes dettes…</Text>
      </View>
    );
  }

  const copy = stepCopy(step, strategy, subtype, orderedCandidates.length);
  const encouragement =
    STEP_ENCOURAGEMENTS[Math.min(step, STEP_COUNT - 1)] ?? STEP_ENCOURAGEMENTS[STEP_COUNT - 1];

  return (
    <View style={styles.root}>
      <StepProgress
        step={step}
        count={STEP_COUNT}
        accent={pf.accent}
        track={pf.border}
        label={`Étape ${step + 1} sur ${STEP_COUNT} — ${encouragement}`}
        muted={pf.textMuted}
      />
      <Text style={[styles.stepTitle, planFinanceFonts.sectionTitle]}>{copy.title}</Text>
      <Text style={[styles.stepHint, interMediumText, { color: pf.textMuted }]}>{copy.hint}</Text>

      {step === 0 ? (
        candidates.length === 0 ? (
          <View style={styles.formBlock}>
            <View style={styles.emptyCard}>
              <AppIcon family="ionicons" name="wallet-outline" size={22} color={pf.textMuted} />
              <Text style={[styles.emptyTitle, interSemiboldText, { color: pf.text }]}>
                Aucune dette détectée
              </Text>
              <Text style={[styles.emptyHint, interMediumText, { color: pf.textMuted }]}>
                Ajoute un prêt ou une carte dans Prêts et obligations / Comptes, ou saisis une dette
                manuellement ci-dessous pour démarrer le plan.
              </Text>
            </View>
            <Field label="LIBELLÉ">
              <TextInput
                value={manualLabel}
                onChangeText={setManualLabel}
                placeholder="Ex. Visa"
                placeholderTextColor={pf.textMuted}
                style={[inputShellStyle, styles.inputText, { color: pf.text }]}
              />
            </Field>
            <Field label="SOLDE ACTUEL">
              <TextInput
                value={manualBalance}
                onChangeText={setManualBalance}
                placeholder="Ex. 2 400"
                placeholderTextColor={pf.textMuted}
                keyboardType="numeric"
                style={[inputShellStyle, styles.inputText, { color: pf.text }]}
              />
            </Field>
            <Field label="TAUX D'INTÉRÊT (%)">
              <TextInput
                value={manualRate}
                onChangeText={setManualRate}
                placeholder="Ex. 19,99"
                placeholderTextColor={pf.textMuted}
                keyboardType="numeric"
                style={[inputShellStyle, styles.inputText, { color: pf.text }]}
              />
            </Field>
            <Field label="PAIEMENT MINIMUM / MOIS">
              <TextInput
                value={manualMin}
                onChangeText={setManualMin}
                placeholder="Ex. 75 (sinon ~3 % du solde)"
                placeholderTextColor={pf.textMuted}
                keyboardType="numeric"
                style={[inputShellStyle, styles.inputText, { color: pf.text }]}
              />
            </Field>
          </View>
        ) : (
          <View style={styles.list}>
            <View style={styles.selectionBar}>
              <Text style={[styles.selectionMeta, interMediumText, { color: pf.textMuted }]}>
                {selectedIds.size}/{candidates.length} ·{' '}
                {formatDisplayMoneyAbsolute(totalSelectedBalance)}
                {totalMinimums > 0
                  ? ` · Min. ${formatDisplayMoneyAbsolute(totalMinimums)}/mois`
                  : ''}
              </Text>
              {subtype !== 'dette_individuelle' && candidates.length > 1 ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: allSelected }}
                  accessibilityLabel={
                    allSelected ? 'Tout désélectionner' : 'Tout sélectionner'
                  }
                  onPress={toggleSelectAll}
                  hitSlop={8}
                  style={({ pressed }) => [styles.selectionActions, pressed && styles.pressed]}
                >
                  <View
                    style={[
                      styles.check,
                      styles.selectAllCheck,
                      allSelected && { backgroundColor: pf.accent, borderColor: pf.accent },
                    ]}
                  >
                    {allSelected ? (
                      <AppIcon family="ionicons" name="checkmark" size={12} color={pf.textOnAccent} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.selectionAction,
                      interSemiboldText,
                      { color: allSelected ? pf.textMuted : pf.accent },
                    ]}
                  >
                    {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {candidates.map((debt) => {
              const selected = selectedIds.has(debt.id);
              return (
                <Pressable
                  key={debt.id}
                  accessibilityRole={subtype === 'dette_individuelle' ? 'radio' : 'checkbox'}
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${debt.label}, ${formatDisplayMoneyAbsolute(debt.balance)}`}
                  onPress={() => toggleDebt(debt.id)}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                  <View style={[styles.debtRow, selected && styles.debtRowSelected]}>
                    <View
                      style={[
                        styles.check,
                        subtype === 'dette_individuelle' && styles.checkRadio,
                        selected && { backgroundColor: pf.accent, borderColor: pf.accent },
                      ]}
                    >
                      {selected ? (
                        <AppIcon family="ionicons" name="checkmark" size={14} color={pf.textOnAccent} />
                      ) : null}
                    </View>
                    <View style={styles.debtCopy}>
                      <Text style={[styles.debtSubtitle, { color: pf.textMuted }]} numberOfLines={1}>
                        {debt.subtitle}
                      </Text>
                      <Text
                        style={[styles.debtLabel, interSemiboldText, { color: pf.text }]}
                        numberOfLines={2}
                      >
                        {debt.label}
                      </Text>
                      <Text style={[styles.debtMeta, { color: pf.textMuted }]}>
                        Min. {formatDisplayMoneyAbsolute(debt.minimumMonthly)}/mois
                        {debt.annualRatePercent > 0
                          ? ` · ${formatRate(debt.annualRatePercent)} %`
                          : ''}
                      </Text>
                    </View>
                    <Text style={[styles.debtAmount, interSemiboldText, { color: pf.text }]}>
                      {formatDisplayMoneyAbsolute(debt.balance)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )
      ) : null}

      {step === 1 ? (
        <View style={styles.list}>
          {orderedCandidates.length === 0 ? (
            <View style={styles.emptyCard}>
              <AppIcon family="ionicons" name="alert-circle-outline" size={22} color={pf.warning} />
              <Text style={[styles.emptyTitle, interSemiboldText, { color: pf.text }]}>
                Aucune dette sélectionnée
              </Text>
              <Text style={[styles.emptyHint, interMediumText, { color: pf.textMuted }]}>
                Reviens à l’étape précédente pour choisir les dettes à inclure.
              </Text>
            </View>
          ) : (
            orderedCandidates.map((debt) => {
              const isFocus = debt.ordre === 1;
              return (
                <View
                  key={debt.id}
                  style={[styles.debtRow, isFocus && styles.debtRowSelected]}
                >
                  <View
                    style={[
                      styles.orderBadge,
                      {
                        borderColor: isFocus ? pf.accent : pf.border,
                        backgroundColor: isFocus ? pf.accent : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.orderText,
                        interSemiboldText,
                        { color: isFocus ? pf.textOnAccent : pf.accent },
                      ]}
                    >
                      #{debt.ordre}
                    </Text>
                  </View>
                  <View style={styles.debtCopy}>
                    <Text
                      style={[styles.debtLabel, interSemiboldText, { color: pf.text }]}
                      numberOfLines={2}
                    >
                      {debt.label}
                    </Text>
                    <Text style={[styles.debtMeta, { color: pf.textMuted }]}>
                      {orderReasonLine(debt, strategy, isFocus)}
                    </Text>
                    <Text style={[styles.debtMeta, { color: pf.textMuted }]}>
                      Solde {formatDisplayMoneyAbsolute(debt.balance)} · Min.{' '}
                      {formatDisplayMoneyAbsolute(debt.minimumMonthly)}/mois
                      {debt.annualRatePercent > 0
                        ? ` · ${formatRate(debt.annualRatePercent)} %`
                        : ''}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      ) : null}

      {step === 2 ? (
        <View style={styles.formBlock}>
          <View style={styles.summaryStrip}>
            <SummaryChip
              label="Minimums"
              value={`${formatDisplayMoneyAbsolute(totalMinimums)}/mois`}
            />
            <SummaryChip
              label="Soldes"
              value={formatDisplayMoneyAbsolute(totalSelectedBalance)}
            />
          </View>
          <Field label={extraFieldLabel(subtype)}>
            <View style={styles.cadenceRow}>
              <TextInput
                value={extraAmount}
                onChangeText={setExtraAmount}
                placeholder="0"
                placeholderTextColor={pf.textMuted}
                keyboardType="numeric"
                style={[inputShellStyle, styles.cadenceAmount, styles.inputText, { color: pf.text }]}
              />
              <View style={styles.cadenceTabs}>
                <SegmentedTabs
                  tabs={[
                    { id: 'week', label: 'Semaine' },
                    { id: 'month', label: 'Mois' },
                  ]}
                  active={extraCadence}
                  onChange={(id) => setExtraCadence(id as PlanExtraCadence)}
                  showDivider={false}
                  size="sm"
                />
              </View>
            </View>
          </Field>
          <Text style={[styles.helper, interMediumText, { color: pf.textMuted }]}>
            {extraHelper(subtype, extraMonthly, totalMinimums)}
          </Text>
          <Text style={[styles.helper, interMediumText, { color: pf.textMuted }]}>
            {hasCashflowAverage
              ? `Moyenne calculée sur ${cashflowAverage?.monthsUsed} mois disponible${cashflowAverage?.monthsUsed === 1 ? '' : 's'}, transferts exclus.`
              : 'Ajoute des revenus et dépenses pour obtenir une moyenne mensuelle.'}
          </Text>
          <View style={styles.summaryStrip}>
            <SummaryChip
              label="Revenu moyen"
              value={
                hasCashflowAverage
                  ? `${formatDisplayMoneyAbsolute(cashflowAverage?.monthlyIncome ?? 0)}/mois`
                  : 'Indisponible'
              }
            />
            <SummaryChip
              label="Dépenses moyennes"
              value={
                hasCashflowAverage
                  ? `${formatDisplayMoneyAbsolute(cashflowAverage?.monthlyExpenses ?? 0)}/mois`
                  : 'Indisponible'
              }
            />
            <SummaryChip
              label="Surplus estimé"
              value={
                hasCashflowAverage
                  ? `${formatSignedDisplayMoney(averageMonthlySurplus)}/mois`
                  : 'Indisponible'
              }
            />
          </View>
          {projection ? (
            <View
              style={[
                styles.projectionCard,
                !projection.reachable && { borderColor: pf.warning },
              ]}
            >
              <Text style={[styles.projectionEyebrow, planFinanceEyebrowStyle()]}>
                PROJECTION EN DIRECT
              </Text>
              <Text style={[styles.feasibilityMsg, interSemiboldText, { color: pf.text }]}>
                {projection.reachable
                  ? projectionDateIso
                    ? `Libre de dettes vers ${formatFriendlyDateLabel(projectionDateIso)}`
                    : 'Déjà libre de dettes'
                  : 'Projection impossible avec ces paiements'}
              </Text>
              <Text style={[styles.projectionSub, interMediumText, { color: pf.textMuted }]}>
                {projection.reachable
                  ? `${formatDebtFreeDuration(projection.daysToDebtFree)} · ${
                      extraMonthly > 0
                        ? `${formatDisplayMoneyAbsolute(extraMonthly)}/mois d’extra`
                        : 'minimums seuls'
                    }`
                  : 'Les paiements ne remboursent pas la dette dans la limite de projection. Augmente l’extra ou les minimums.'}
              </Text>
            </View>
          ) : null}
          {feasibility ? <FeasibilityCard feasibility={feasibility} /> : null}
        </View>
      ) : null}

      {step === 3 ? (
        projection ? (
          <View style={styles.formBlock}>
            <View style={styles.projectionCard}>
              <Text style={[styles.projectionEyebrow, planFinanceEyebrowStyle()]}>
                LIBRE DE DETTES
              </Text>
              <Text style={[styles.projectionHero, planFinanceFonts.heroTitle, { color: pf.text }]}>
                {projection.reachable
                  ? formatDebtFreeDuration(projection.daysToDebtFree)
                  : 'Inatteignable aux paiements actuels'}
              </Text>
              <Text style={[styles.projectionSub, interMediumText, { color: pf.textMuted }]}>
                {projection.reachable
                  ? assembled?.date_cible
                    ? `Vers ${formatFriendlyDateLabel(assembled.date_cible)} · ${selectedCandidates.length} dette${selectedCandidates.length > 1 ? 's' : ''}`
                    : `${selectedCandidates.length} dette${selectedCandidates.length > 1 ? 's' : ''} au plan`
                  : 'Augmente l’extra ou les minimums pour couvrir les intérêts.'}
              </Text>
            </View>

            <View style={styles.summaryStrip}>
              <SummaryChip
                label="Minimums"
                value={`${formatDisplayMoneyAbsolute(totalMinimums)}/mois`}
              />
              <SummaryChip
                label="Extra"
                value={
                  extraMonthly > 0
                    ? `${formatDisplayMoneyAbsolute(extraMonthly)}/mois`
                    : 'Aucun'
                }
              />
              <SummaryChip
                label="Total"
                value={`${formatDisplayMoneyAbsolute(totalMinimums + extraMonthly)}/mois`}
              />
            </View>

            {orderedCandidates[0] ? (
              <Text style={[styles.helper, interMediumText, { color: pf.textMuted }]}>
                Priorité #{orderedCandidates[0].ordre} : {orderedCandidates[0].label}
                {strategy === 'avalanche' && orderedCandidates[0].annualRatePercent > 0
                  ? ` (${formatRate(orderedCandidates[0].annualRatePercent)} %)`
                  : ''}
              </Text>
            ) : null}

            {projection.reachable && projection.totalInterestPaid > 0 ? (
              <Text style={[styles.helper, interMediumText, { color: pf.textMuted }]}>
                Intérêts estimés sur la durée :{' '}
                {formatDisplayMoneyAbsolute(projection.totalInterestPaid)}
              </Text>
            ) : null}

            {feasibility ? (
              <Text
                style={[
                  styles.helper,
                  interMediumText,
                  { color: feasibility.realiste ? pf.accent : pf.warning },
                ]}
              >
                {feasibility.realiste
                  ? 'Budget OK pour cet extra — tu peux lancer le plan.'
                  : 'Cet extra pèse sur ton budget — ajuste-le à l’étape précédente si besoin.'}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <AppIcon family="ionicons" name="alert-circle-outline" size={22} color={pf.warning} />
            <Text style={[styles.emptyTitle, interSemiboldText, { color: pf.text }]}>
              Projection indisponible
            </Text>
            <Text style={[styles.emptyHint, interMediumText, { color: pf.textMuted }]}>
              Vérifie la sélection des dettes et le montant supplémentaire, puis réessaie.
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

function StepProgress({
  step,
  count,
  accent,
  track,
  label,
  muted,
}: {
  step: number;
  count: number;
  accent: string;
  track: string;
  label: string;
  muted: string;
}) {
  return (
    <View style={styles.progressHeader}>
      <Text style={[styles.progressLabel, interMediumText, { color: muted }]}>{label}</Text>
      <View
        style={styles.progressDots}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: count, now: step + 1 }}
      >
        {Array.from({ length: count }, (_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              { backgroundColor: i <= step ? accent : track },
              i === step && styles.progressDotCurrent,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

function FeasibilityCard({ feasibility }: { feasibility: PlanDebtFeasibilitySnapshot }) {
  const pf = planFinanceKit.colors;
  return (
    <View
      style={[
        styles.projectionCard,
        { borderColor: feasibility.realiste ? pf.accent : pf.warning },
      ]}
    >
      <Text style={[styles.projectionEyebrow, planFinanceEyebrowStyle()]}>
        {feasibility.realiste ? 'BUDGET — RÉALISTE' : 'BUDGET — À AJUSTER'}
      </Text>
      <Text style={[styles.feasibilityMsg, interMediumText, { color: pf.text }]}>
        {feasibility.message}
      </Text>
      {feasibility.suggestions?.map((tip) => (
        <Text key={tip} style={[styles.suggestion, interMediumText, { color: pf.textMuted }]}>
          • {tip}
        </Text>
      ))}
    </View>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  const pf = planFinanceKit.colors;
  return (
    <View style={styles.summaryChip}>
      <Text style={[styles.summaryChipLabel, planFinanceEyebrowStyle()]}>{label}</Text>
      <Text style={[styles.summaryChipValue, interSemiboldText, { color: pf.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function stepCopy(
  step: number,
  strategy: DebtPayoffStrategy,
  subtype: PlanSubtype,
  orderedCount: number,
): { title: string; hint: string } {
  switch (step) {
    case 0:
      if (subtype === 'dette_individuelle') {
        return {
          title: 'Quelle dette cibler ?',
          hint: 'Choisis une seule dette — prêts, obligations ou soldes de cartes. Hypothèques exclues.',
        };
      }
      if (subtype === 'marge_credit') {
        return {
          title: 'Quelles marges / dettes inclure ?',
          hint: 'Inclut ta marge utilisée et toute dette liée à rembourser en priorité. Hypothèques exclues.',
        };
      }
      if (subtype === 'consolidation') {
        return {
          title: 'Quelles dettes regrouper ?',
          hint: 'Sélectionne les dettes que tu envisages de consolider. Hypothèques exclues.',
        };
      }
      if (subtype === 'bombe_nucleaire') {
        return {
          title: 'Sur quelles dettes frapper ?',
          hint: 'Choisis les dettes qui recevront le paiement massif. Hypothèques exclues.',
        };
      }
      return {
        title: 'Quelles dettes inclure ?',
        hint: 'Prêts, obligations et soldes de cartes de crédit. Hypothèques exclues.',
      };
    case 1:
      if (orderedCount <= 1) {
        return {
          title: 'Dette prioritaire',
          hint: 'Tout l’extra ira sur cette dette jusqu’à zéro.',
        };
      }
      if (subtype === 'consolidation') {
        return {
          title: 'Ordre avant consolidation',
          hint:
            strategy === 'avalanche'
              ? 'Taux le plus élevé en premier — utile si tu restes avec plusieurs créanciers un temps.'
              : 'Plus petit solde en premier — utile si tu restes avec plusieurs créanciers un temps.',
        };
      }
      if (subtype === 'bombe_nucleaire') {
        return {
          title: 'Cible du paiement massif',
          hint:
            strategy === 'avalanche'
              ? 'On attaque d’abord le taux le plus élevé — maximum d’intérêts évités.'
              : 'On attaque d’abord le plus petit solde — victoire rapide.',
        };
      }
      return strategy === 'avalanche'
        ? {
            title: 'Ordre avalanche',
            hint: 'Taux d’intérêt le plus élevé en premier — minimums sur le reste.',
          }
        : {
            title: 'Ordre boule de neige',
            hint: 'Plus petit solde en premier — minimums sur le reste.',
          };
    case 2:
      if (subtype === 'bombe_nucleaire') {
        return {
          title: 'Quel effort supplémentaire ?',
          hint: 'Montant au-delà des minimums (paiement massif étalé, bonus, etc.).',
        };
      }
      return {
        title: 'Combien d’extra ?',
        hint: 'Au-delà des paiements minimums, chaque semaine ou chaque mois. 0 = minimums seuls.',
      };
    default:
      return {
        title: 'Projection et budget',
        hint: 'Délai estimé, engagement mensuel, et si ton budget le permet.',
      };
  }
}

function extraFieldLabel(subtype: PlanSubtype): string {
  if (subtype === 'bombe_nucleaire') return 'PAIEMENT SUPPLÉMENTAIRE';
  return 'MONTANT SUPPLÉMENTAIRE';
}

function extraHelper(subtype: PlanSubtype, extraMonthly: number, totalMinimums: number): string {
  const total = totalMinimums + extraMonthly;
  if (extraMonthly <= 0) {
    return `Sans extra : ${formatDisplayMoneyAbsolute(totalMinimums)}/mois de minimums seulement.`;
  }
  const prefix =
    subtype === 'bombe_nucleaire'
      ? 'Équivaut à environ'
      : 'En plus des minimums — environ';
  return `${prefix} ${formatDisplayMoneyAbsolute(extraMonthly)}/mois d’extra · total ${formatDisplayMoneyAbsolute(total)}/mois.`;
}

function orderReasonLine(
  debt: DebtPlanCandidate & { ordre: number },
  strategy: DebtPayoffStrategy,
  isFocus: boolean,
): string {
  if (isFocus) {
    return strategy === 'avalanche'
      ? 'Priorité — taux le plus élevé'
      : 'Priorité — plus petit solde';
  }
  return strategy === 'avalanche' ? 'Minimums seulement pour l’instant' : 'Minimums, puis son tour';
}

function formatRate(rate: number): string {
  return String(rate).replace('.', ',');
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <DashboardSectionLabel>{label}</DashboardSectionLabel>
      {children}
    </View>
  );
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  loading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...interMediumText,
    fontSize: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  progressLabel: {
    fontSize: 13,
    flexShrink: 1,
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
  progressDotCurrent: {
    width: 14,
  },
  stepTitle: {
    marginBottom: 2,
  },
  stepHint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  formBlock: {
    gap: planFinanceKit.layout.fieldGap,
  },
  field: {
    gap: spacing.sm,
  },
  inputText: {
    ...interMediumText,
    fontSize: 15,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flex: 1,
  },
  emptyCard: {
    gap: spacing.sm,
    padding: planFinanceKit.layout.cardPadding,
    backgroundColor: planFinanceKit.colors.surface,
    borderRadius: planFinanceKit.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: planFinanceKit.colors.border,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 15,
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  selectionMeta: {
    fontSize: 12,
    flex: 1,
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  selectionAction: {
    fontSize: 13,
  },
  selectAllCheck: {
    width: 18,
    height: 18,
    borderRadius: 5,
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: planFinanceKit.colors.surface,
    borderRadius: planFinanceKit.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: planFinanceKit.colors.border,
  },
  debtRowSelected: {
    borderColor: planFinanceKit.colors.accent,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: planFinanceKit.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRadio: {
    borderRadius: radius.pill,
  },
  debtCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  debtSubtitle: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  debtLabel: {
    fontSize: 15,
  },
  debtMeta: {
    ...interMediumText,
    fontSize: 12,
    lineHeight: 16,
  },
  debtAmount: {
    fontSize: 15,
  },
  orderBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderText: {
    fontSize: 14,
  },
  cadenceRow: {
    gap: spacing.sm,
  },
  cadenceAmount: {
    alignSelf: 'stretch',
  },
  cadenceTabs: {
    alignSelf: 'stretch',
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
  },
  summaryStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryChip: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: planFinanceKit.colors.surface,
    borderRadius: planFinanceKit.radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: planFinanceKit.colors.border,
    gap: 4,
  },
  summaryChipLabel: {
    marginBottom: 0,
  },
  summaryChipValue: {
    fontSize: 13,
  },
  projectionCard: {
    padding: planFinanceKit.layout.cardPadding,
    gap: spacing.sm,
    backgroundColor: planFinanceKit.colors.surface,
    borderRadius: planFinanceKit.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: planFinanceKit.colors.border,
  },
  projectionEyebrow: {},
  projectionHero: {
    marginTop: spacing.xs,
  },
  projectionSub: {
    fontSize: 14,
    lineHeight: 20,
  },
  feasibilityMsg: {
    fontSize: 15,
    lineHeight: 22,
  },
  suggestion: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.85,
  },
});
