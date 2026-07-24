import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { DatePickerField } from '@/components/MinimalDatePicker';
import {
  DebtPlanWizard,
  debtWizardStepCount,
  type DebtWizardAssembled,
} from '@/components/plans/DebtPlanWizard';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { SettingsPickerSheet } from '@/components/SettingsPickerSheet';
import {
  manualAccountOptions,
  toAccountOptions,
  type AccountOption,
} from '@/components/RecurringPaymentsForm';
import {
  planFinanceEyebrowStyle,
  planFinanceFonts,
  planFinanceInputStyle,
  planFinanceKit,
  planFinancePrimaryButtonStyle,
  planFinanceSecondaryButtonStyle,
} from '@/constants/planFinanceKit';
import { interMediumText, interSemiboldText, spacing } from '@/constants/theme';
import {
  activateSuggestedPlan,
  appendUserPlan,
  resolveEditablePlan,
  upsertUserPlan,
} from '@/lib/plans/plansStore';
import {
  PLAN_SUBTYPE_LABELS,
  type PlanCategory,
  type PlanSuggere,
  type PlanSubtype,
} from '@/lib/plans/Plan';
import { PLAN_SUBTYPE_DESCRIPTIONS } from '@/lib/plans/planCatalogData';
import {
  assemblePlanCreationFields,
  getPlanTypeFormConfig,
  usesDebtPayoffWizard,
  validatePlanCreation,
  type PlanCadenceOption,
  type PlanFieldKey,
  type PlanFormField,
} from '@/lib/plans/planTypeFormConfig';
import { sanitizeDebtParametresForAcceleratedPlan } from '@/lib/plans/debtPlanCandidates';
import { getLoans, getSimulatedAccounts } from '@/lib/db';
import { tapHaptic } from '@/lib/haptics';
import { setPendingPlanChatConfirmation } from '@/lib/plans/pendingPlanChatConfirmation';

type QueueItem = Pick<
  PlanSuggere,
  'id' | 'category' | 'subtype' | 'titre' | 'description' | 'montant_actuel' | 'montant_cible' | 'raison_recommandation' | 'signal_declencheur' | 'etapes'
>;

type Params = {
  messageId?: string;
  queue?: string;
  subtype?: string;
  category?: string;
  titre?: string;
  montantCible?: string;
  raison?: string;
  signal?: string;
  total?: string;
  index?: string;
  /** When set, save updates this plan instead of creating a new one. */
  editPlanId?: string;
};

const FALLBACK_CADENCE_OPTIONS: readonly PlanCadenceOption[] = [
  { id: 'week', label: 'Semaine', suffix: 'semaine' },
  { id: 'month', label: 'Mois', suffix: 'mois' },
];

/** Coque d'input partagée — `planFinanceInputStyle` renvoie un `ViewStyle` compatible `TextInput`. */
const inputShellStyle = planFinanceInputStyle() as TextStyle;

export default function PlanCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const pf = planFinanceKit.colors;

  const subtype = (params.subtype ?? 'fonds_urgence') as PlanSubtype;
  const subtypeLabel = PLAN_SUBTYPE_LABELS[subtype];
  /** Titre hero = nom du template / stratégie (catalogue), pas le générique « Nouveau plan ». */
  const screenTitle = params.titre?.trim() || subtypeLabel || 'Nouveau plan';
  const screenLead = PLAN_SUBTYPE_DESCRIPTIONS[subtype];
  const isDebtWizard = usesDebtPayoffWizard(subtype);
  const editPlanId = params.editPlanId?.trim() || undefined;
  const isEditing = Boolean(editPlanId);
  const headerEyebrow = isEditing ? 'MODIFIER LE PLAN' : undefined;
  const config = useMemo(() => getPlanTypeFormConfig(subtype), [subtype]);
  const cadenceField = useMemo(() => config.fields.find((f) => f.kind === 'cadence'), [config]);
  const cadenceOptions = cadenceField?.cadenceOptions ?? FALLBACK_CADENCE_OPTIONS;
  const hasAccountField = useMemo(() => config.fields.some((f) => f.kind === 'account'), [config]);

  const [accounts, setAccounts] = useState<AccountOption[]>(manualAccountOptions());
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [cadenceAmount, setCadenceAmount] = useState(cadenceField?.defaultAmount ?? '150');
  const [cadenceFrequency, setCadenceFrequency] = useState<string>(
    cadenceField?.defaultCadenceId ?? cadenceOptions[0]?.id ?? 'week',
  );
  const [textValues, setTextValues] = useState<Partial<Record<PlanFieldKey, string>>>(() => ({
    montant_cible: params.montantCible ?? '',
  }));
  const [saving, setSaving] = useState(false);

  const [wizardStep, setWizardStep] = useState(0);
  const [wizardAssembled, setWizardAssembled] = useState<DebtWizardAssembled | null>(null);
  const [wizardValid, setWizardValid] = useState(false);
  const [wizardError, setWizardError] = useState<{ title: string; message: string } | undefined>();

  useEffect(() => {
    if (!hasAccountField || isDebtWizard) return;
    void (async () => {
      const stored = await getSimulatedAccounts();
      const options = stored.length ? toAccountOptions(stored) : manualAccountOptions();
      setAccounts(options);
      setSelectedAccountId((current) => current || options[0]?.id || '');
    })();
  }, [hasAccountField, isDebtWizard]);

  useEffect(() => {
    if (!editPlanId) return;
    void (async () => {
      const existing = await resolveEditablePlan(editPlanId);
      if (!existing) return;
      setTextValues((prev) => ({
        ...prev,
        montant_cible: existing.montant_cible?.toString() ?? prev.montant_cible ?? '',
        date_cible: existing.date_cible ?? prev.date_cible ?? '',
        solde_initial: existing.montant_actuel?.toString() ?? prev.solde_initial ?? '',
      }));
      if (existing.compte_lie) {
        setSelectedAccountId((current) => current || existing.compte_lie || '');
      }
      if (existing.cadence) {
        const amountMatch = existing.cadence.match(/^([\d\s]+(?:[.,]\d+)?)/);
        if (amountMatch?.[1]) {
          setCadenceAmount(amountMatch[1].replace(/\s/g, '').replace(',', '.'));
        }
        if (/mois/i.test(existing.cadence)) setCadenceFrequency('month');
        else if (/sem/i.test(existing.cadence)) setCadenceFrequency('week');
      }
    })();
  }, [editPlanId]);

  const queue = useMemo<QueueItem[]>(() => {
    if (!params.queue) return [];
    try {
      return JSON.parse(params.queue) as QueueItem[];
    } catch {
      return [];
    }
  }, [params.queue]);

  const index = Number(params.index ?? '1');
  const total = Number(params.total ?? '1');

  const suggestion = useMemo<PlanSuggere>(
    () => ({
      id: `draft-${params.subtype ?? 'plan'}`,
      category: (params.category ?? 'epargne') as PlanCategory,
      subtype,
      titre: screenTitle,
      description: params.raison ?? screenLead ?? '',
      statut: 'suggere',
      montant_actuel: 0,
      montant_cible: params.montantCible ? Number(params.montantCible) : null,
      etapes: [],
      raison_recommandation: params.raison ?? screenLead ?? '',
      signal_declencheur: (params.signal ?? 'fonds_urgence:couverture_moins_3_mois') as PlanSuggere['signal_declencheur'],
    }),
    [params, screenLead, screenTitle, subtype],
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const cadenceSuffix = useMemo(
    () => cadenceOptions.find((o) => o.id === cadenceFrequency)?.suffix ?? 'semaine',
    [cadenceOptions, cadenceFrequency],
  );
  const cadenceLabel = useMemo(() => {
    const amount = cadenceAmount.trim() || '0';
    return `${amount} $ / ${cadenceSuffix}`;
  }, [cadenceAmount, cadenceSuffix]);

  const setTextValue = useCallback((key: PlanFieldKey, value: string) => {
    setTextValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleWizardValidity = useCallback(
    (valid: boolean, error?: { title: string; message: string }) => {
      setWizardValid(valid);
      setWizardError(error);
    },
    [],
  );

  const persistPlan = useCallback(
    async (fields: {
      compte_lie?: string;
      cadence?: string;
      date_cible?: string;
      montant_cible?: number | null;
      montant_actuel?: number;
      parametres?: DebtWizardAssembled['parametres'];
    }) => {
      if (editPlanId) {
        const existing = await resolveEditablePlan(editPlanId);
        if (!existing) {
          throw new Error('Plan introuvable');
        }
        await upsertUserPlan({
          ...existing,
          titre: suggestion.titre || existing.titre,
          description: suggestion.description || existing.description,
          compte_lie: fields.compte_lie ?? existing.compte_lie,
          cadence: fields.cadence ?? existing.cadence,
          date_cible: fields.date_cible ?? existing.date_cible,
          montant_cible:
            fields.montant_cible !== undefined ? fields.montant_cible : existing.montant_cible,
          montant_actuel:
            fields.montant_actuel !== undefined ? fields.montant_actuel : existing.montant_actuel,
          parametres: fields.parametres ?? existing.parametres,
          statut: existing.statut === 'complete' ? 'complete' : existing.statut,
        });
        router.back();
        return;
      }

      const plan = activateSuggestedPlan(suggestion, fields);
      await appendUserPlan(plan);

      const [next, ...rest] = queue;
      if (next) {
        router.replace({
          pathname: '/plans/create',
          params: {
            messageId: params.messageId,
            queue: JSON.stringify(rest),
            subtype: next.subtype,
            category: next.category,
            titre: next.titre,
            montantCible: next.montant_cible?.toString() ?? '',
            raison: next.raison_recommandation,
            signal: next.signal_declencheur,
            total: total.toString(),
            index: String(index + 1),
          },
        });
        return;
      }

      await setPendingPlanChatConfirmation(total);
      router.back();
    },
    [editPlanId, index, params.messageId, queue, router, suggestion, total],
  );

  const handleSave = useCallback(async () => {
    if (saving) return;

    if (isDebtWizard) {
      if (wizardStep < debtWizardStepCount() - 1) {
        if (!wizardValid) {
          Alert.alert(wizardError?.title ?? 'Étape incomplète', wizardError?.message ?? 'Complète cette étape.');
          return;
        }
        tapHaptic();
        setWizardStep((s) => s + 1);
        return;
      }

      if (!wizardValid || !wizardAssembled) {
        Alert.alert(wizardError?.title ?? 'Plan incomplet', wizardError?.message ?? 'Complète l’assistant.');
        return;
      }

      setSaving(true);
      tapHaptic();
      try {
        const loans = await getLoans();
        const parametres = wizardAssembled.parametres
          ? sanitizeDebtParametresForAcceleratedPlan(wizardAssembled.parametres, loans)
          : undefined;
        const dettes = parametres?.dettes ?? [];
        const montantCible =
          dettes.length > 0
            ? dettes.reduce((sum, d) => sum + d.solde, 0)
            : wizardAssembled.montant_cible;
        await persistPlan({
          cadence: wizardAssembled.cadence,
          date_cible: wizardAssembled.date_cible,
          montant_cible: montantCible,
          montant_actuel: wizardAssembled.montant_actuel,
          parametres,
        });
      } catch {
        Alert.alert('Erreur', "Impossible d'enregistrer le plan. Réessayez.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const input = {
      subtype,
      values: textValues,
      accountLabel: hasAccountField ? selectedAccount?.label : undefined,
      cadenceLabel: cadenceField ? cadenceLabel : undefined,
    };

    const error = validatePlanCreation(input);
    if (error) {
      Alert.alert(error.title, error.message);
      return;
    }

    setSaving(true);
    tapHaptic();
    try {
      const assembled = assemblePlanCreationFields(input);
      await persistPlan({
        compte_lie: assembled.compte_lie,
        cadence: assembled.cadence,
        date_cible: assembled.date_cible,
        montant_cible: assembled.montant_cible ?? suggestion.montant_cible,
        montant_actuel: assembled.montant_actuel,
        parametres: assembled.parametres,
      });
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le plan. Réessayez.");
    } finally {
      setSaving(false);
    }
  }, [
    cadenceField,
    cadenceLabel,
    hasAccountField,
    isDebtWizard,
    persistPlan,
    saving,
    selectedAccount?.label,
    subtype,
    suggestion.montant_cible,
    textValues,
    wizardAssembled,
    wizardError,
    wizardStep,
    wizardValid,
  ]);

  const handleSecondary = useCallback(() => {
    if (isDebtWizard && wizardStep > 0) {
      tapHaptic();
      setWizardStep((s) => s - 1);
      return;
    }
    router.back();
  }, [isDebtWizard, router, wizardStep]);

  const primaryLabel = useMemo(() => {
    if (isEditing) {
      if (isDebtWizard && wizardStep < debtWizardStepCount() - 1) return 'Continuer';
      return 'Enregistrer';
    }
    if (isDebtWizard) {
      if (wizardStep < debtWizardStepCount() - 1) return 'Continuer';
      return index < total ? 'Créer et continuer' : 'Créer le plan';
    }
    return index < total ? 'Créer et continuer' : 'Créer le plan';
  }, [index, isDebtWizard, isEditing, total, wizardStep]);

  const secondaryLabel = isDebtWizard && wizardStep > 0 ? 'Retour' : 'Annuler';

  const renderField = (field: PlanFormField) => {
    switch (field.kind) {
      case 'account':
        return (
          <Field key={field.key} label={field.label}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                tapHaptic();
                setAccountPickerOpen(true);
              }}
              style={({ pressed }) => [planFinanceInputStyle(), styles.selectRow, pressed && styles.pressed]}
            >
              <Text style={[styles.inputText, { color: selectedAccount ? pf.text : pf.textMuted }]}>
                {selectedAccount?.label ?? 'Choisir un compte'}
              </Text>
            </Pressable>
          </Field>
        );

      case 'cadence':
        return (
          <Field key={field.key} label={field.label}>
            <View style={styles.cadenceRow}>
              <TextInput
                value={cadenceAmount}
                onChangeText={setCadenceAmount}
                placeholder={field.defaultAmount ?? '150'}
                placeholderTextColor={pf.textMuted}
                keyboardType="numeric"
                style={[inputShellStyle, styles.cadenceAmount, styles.inputText, { color: pf.text }]}
              />
              <View style={styles.cadenceTabs}>
                <SegmentedTabs
                  tabs={cadenceOptions.map((o) => ({ id: o.id, label: o.label }))}
                  active={cadenceFrequency}
                  onChange={setCadenceFrequency}
                  showDivider={false}
                  size="sm"
                />
              </View>
            </View>
          </Field>
        );

      case 'date':
        return (
          <View key={field.key} style={styles.dateField}>
            <DatePickerField
              label={field.label}
              value={textValues.date_cible ?? ''}
              placeholder="Choisir une date"
              onChangeDate={(value) => setTextValue('date_cible', value)}
              labelStyle={planFinanceEyebrowStyle()}
            />
          </View>
        );

      default: {
        return (
          <Field key={field.key} label={field.label}>
            <TextInput
              value={textValues[field.key] ?? ''}
              onChangeText={(value) => setTextValue(field.key, value)}
              placeholder={field.placeholder}
              placeholderTextColor={pf.textMuted}
              keyboardType="numeric"
              style={[inputShellStyle, styles.inputText, { color: pf.text }]}
            />
          </Field>
        );
      }
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: pf.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isEditing ? (
            <Text style={[styles.progress, planFinanceEyebrowStyle()]}>{headerEyebrow}</Text>
          ) : total > 1 || !isDebtWizard ? (
            <Text style={[styles.progress, planFinanceEyebrowStyle()]}>{`PLAN ${index} DE ${total}`}</Text>
          ) : null}
          <Text style={[styles.title, planFinanceFonts.heroTitle]}>{screenTitle}</Text>
          {screenLead ? (
            <Text style={[styles.wizardLead, interMediumText, { color: pf.textMuted }]} numberOfLines={2}>
              {screenLead}
            </Text>
          ) : null}

          {isDebtWizard ? (
            <DebtPlanWizard
              subtype={subtype}
              step={wizardStep}
              onAssembledChange={setWizardAssembled}
              onValidityChange={handleWizardValidity}
            />
          ) : (
            <View style={styles.form}>{config.fields.map(renderField)}</View>
          )}

          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              onPress={handleSecondary}
              style={({ pressed }) => [planFinanceSecondaryButtonStyle(), pressed && styles.pressed]}
            >
              <Text style={[styles.secondaryLabel, interMediumText, { color: pf.text }]}>{secondaryLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleSave()}
              disabled={saving}
              style={({ pressed }) => [
                planFinancePrimaryButtonStyle(),
                pressed && styles.pressed,
                saving && styles.disabled,
              ]}
            >
              <Text style={[styles.primaryLabel, interSemiboldText, { color: pf.textOnAccent }]}>
                {primaryLabel}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {hasAccountField && !isDebtWizard ? (
        <SettingsPickerSheet
          visible={accountPickerOpen}
          title="Compte lié"
          options={accounts.map((account) => ({ id: account.id, label: account.label }))}
          selectedId={selectedAccountId || accounts[0]?.id || ''}
          onClose={() => setAccountPickerOpen(false)}
          onSelect={setSelectedAccountId}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <DashboardSectionLabel>{label}</DashboardSectionLabel>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: planFinanceKit.layout.headerFieldGap,
  },
  progress: {
    marginBottom: spacing.xs,
  },
  title: {
    marginBottom: spacing.sm,
  },
  wizardLead: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  form: {
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
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  dateField: {
    gap: spacing.sm,
  },
  footer: {
    gap: spacing.md,
    marginTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  secondaryLabel: {
    fontSize: 15,
  },
  primaryLabel: {
    fontSize: 15,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
});
