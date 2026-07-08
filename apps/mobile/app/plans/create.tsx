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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { DatePickerField } from '@/components/MinimalDatePicker';
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
import { appendUserPlan, activateSuggestedPlan } from '@/lib/plans/plansStore';
import {
  planSubtypeSansMontantCible,
  type PlanCategory,
  type PlanSuggere,
  type PlanSubtype,
} from '@/lib/plans/Plan';
import { getSimulatedAccounts } from '@/lib/db';
import { tapHaptic } from '@/lib/haptics';
import { setPendingPlanChatConfirmation } from '@/lib/plans/pendingPlanChatConfirmation';

type QueueItem = Pick<
  PlanSuggere,
  'id' | 'category' | 'subtype' | 'titre' | 'description' | 'montant_actuel' | 'montant_cible' | 'raison_recommandation' | 'signal_declencheur' | 'etapes'
>;

type CadenceFrequency = 'week' | 'month';

function parsePlanAmountInput(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

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
};

export default function PlanCreateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const pf = planFinanceKit.colors;

  const [accounts, setAccounts] = useState<AccountOption[]>(manualAccountOptions());
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [cadenceAmount, setCadenceAmount] = useState('150');
  const [cadenceFrequency, setCadenceFrequency] = useState<CadenceFrequency>('week');
  const [dateCible, setDateCible] = useState('');
  const [montantCible, setMontantCible] = useState(params.montantCible ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await getSimulatedAccounts();
      const options = stored.length ? toAccountOptions(stored) : manualAccountOptions();
      setAccounts(options);
      setSelectedAccountId((current) => current || options[0]?.id || '');
    })();
  }, []);

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
      subtype: (params.subtype ?? 'fonds_urgence') as PlanSubtype,
      titre: params.titre ?? 'Nouveau plan',
      description: params.raison ?? '',
      statut: 'suggere',
      montant_actuel: 0,
      montant_cible: params.montantCible ? Number(params.montantCible) : null,
      etapes: [],
      raison_recommandation: params.raison ?? '',
      signal_declencheur: (params.signal ?? 'fonds_urgence:couverture_moins_3_mois') as PlanSuggere['signal_declencheur'],
    }),
    [params],
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const cadenceLabel = useMemo(() => {
    const amount = cadenceAmount.trim() || '0';
    return `${amount} $ / ${cadenceFrequency === 'week' ? 'semaine' : 'mois'}`;
  }, [cadenceAmount, cadenceFrequency]);

  const handleSave = useCallback(async () => {
    if (saving) return;

    const parsedTarget = parsePlanAmountInput(montantCible);
    const requiresTarget = !planSubtypeSansMontantCible(suggestion.subtype);
    if (requiresTarget && (parsedTarget == null || parsedTarget <= 0)) {
      Alert.alert(
        'Montant requis',
        'Indiquez un montant cible supérieur à 0 pour créer ce plan.',
      );
      return;
    }

    const parsedCadence = parsePlanAmountInput(cadenceAmount);
    if (parsedCadence == null || parsedCadence <= 0) {
      Alert.alert(
        'Cadence invalide',
        'Indiquez un montant de cadence supérieur à 0.',
      );
      return;
    }

    if (!selectedAccount?.label) {
      Alert.alert('Compte requis', 'Choisissez un compte lié pour ce plan.');
      return;
    }

    setSaving(true);
    tapHaptic();
    try {
      const plan = activateSuggestedPlan(suggestion, {
        compte_lie: selectedAccount.label,
        cadence: cadenceLabel,
        date_cible: dateCible.trim() || undefined,
        montant_cible: parsedTarget ?? suggestion.montant_cible,
      });
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
    } catch {
      Alert.alert('Erreur', "Impossible d'enregistrer le plan. Réessayez.");
    } finally {
      setSaving(false);
    }
  }, [
    cadenceAmount,
    cadenceLabel,
    dateCible,
    index,
    montantCible,
    params.messageId,
    queue,
    router,
    saving,
    selectedAccount?.label,
    suggestion,
    total,
  ]);

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
          <Text style={[styles.progress, planFinanceEyebrowStyle()]}>{`PLAN ${index} DE ${total}`}</Text>
          <Text style={[styles.title, planFinanceFonts.heroTitle]}>{suggestion.titre}</Text>

          <View style={styles.form}>
            <Field label="MONTANT CIBLE">
              <TextInput
                value={montantCible}
                onChangeText={setMontantCible}
                placeholder="Ex. 10 000"
                placeholderTextColor={pf.textMuted}
                keyboardType="numeric"
                style={[planFinanceInputStyle(), styles.inputText, { color: pf.text }]}
              />
            </Field>

            <Field label="COMPTE LIÉ">
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

            <Field label="CADENCE">
              <View style={styles.cadenceRow}>
                <TextInput
                  value={cadenceAmount}
                  onChangeText={setCadenceAmount}
                  placeholder="150"
                  placeholderTextColor={pf.textMuted}
                  keyboardType="numeric"
                  style={[planFinanceInputStyle(), styles.cadenceAmount, styles.inputText, { color: pf.text }]}
                />
                <View style={styles.cadenceTabs}>
                  <SegmentedTabs
                    tabs={[
                      { id: 'week' as const, label: 'Semaine' },
                      { id: 'month' as const, label: 'Mois' },
                    ]}
                    active={cadenceFrequency}
                    onChange={setCadenceFrequency}
                    showDivider={false}
                    size="sm"
                  />
                </View>
              </View>
            </Field>

            <View style={styles.dateField}>
              <DatePickerField
                label="DATE CIBLE"
                value={dateCible}
                placeholder="Choisir une date"
                onChangeDate={setDateCible}
                labelStyle={planFinanceEyebrowStyle()}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [planFinanceSecondaryButtonStyle(), pressed && styles.pressed]}
          >
            <Text style={[styles.secondaryLabel, interMediumText, { color: pf.text }]}>Annuler</Text>
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
              {index < total ? 'Créer et continuer' : 'Créer le plan'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <SettingsPickerSheet
        visible={accountPickerOpen}
        title="Compte lié"
        options={accounts.map((account) => ({ id: account.id, label: account.label }))}
        selectedId={selectedAccountId || accounts[0]?.id || ''}
        onClose={() => setAccountPickerOpen(false)}
        onSelect={setSelectedAccountId}
      />
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: planFinanceKit.colors.border,
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
