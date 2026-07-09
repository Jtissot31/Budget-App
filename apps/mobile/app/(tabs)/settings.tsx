import { useCallback, useMemo, useRef, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { DatePickerField } from '@/components/MinimalDatePicker';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { PageTransition } from '@/components/PageTransition';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { RegionPickerSheet } from '@/components/RegionPickerSheet';
import { SettingsPickerSheet } from '@/components/SettingsPickerSheet';
import { SettingsSection } from '@/components/SettingsSection';
import {
  SettingsCustomRow,
  SettingsNavigationRow,
  SettingsToggleRow,
} from '@/components/SettingsRow';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import {
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  NUMPAD_MODE_OPTIONS,
  labelForOption,
} from '@/constants/settingsOptions';
import { formatRegionLabel } from '@/constants/regions';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  destructiveTextActionStyle,
  FLOATING_NAV_CONTENT_PADDING,
  PAGE_PADDING_HORIZONTAL,
  PAGE_TITLE_CONTENT_GAP,
  spacing,
  subtleDeleteButtonStyle,
  typography,
  typographyKit,
  type AppColors,
  type ThemePreference,
} from '@/constants/theme';
import {
  deleteCloudData,
  getAutocompleteEnabled,
  getCloudAccountConnected,
  getCountryRegion,
  getDateFormatPreference,
  getDisplayCurrency,
  getDisplayLanguage,
  getHapticFeedbackEnabled,
  getNumpadDefaultMode,
  setAutocompleteEnabled,
  setCloudAccountConnected,
  applyRegionSettings,
  setDateFormatPreference,
  setDisplayCurrency,
  setDisplayLanguage,
  setHapticFeedbackEnabled,
  setNumpadDefaultMode,
  type CountryRegion,
  type CurrencyCode,
  type DateFormatPreference,
  type DisplayLanguage,
  type NumpadDefaultMode,
} from '@/lib/settings';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import {
  getPayEstimationSettings,
  PAY_ESTIMATION_FREQUENCY_OPTIONS,
  payEstimationFrequencyLabel,
  setPayAverageAmount as persistPayAverageAmount,
  setPayEstimationFrequency as persistPayEstimationFrequency,
  setPayLastDate as persistPayLastDate,
  setPaySecondLastDate as persistPaySecondLastDate,
  type PayEstimationFrequency,
} from '@/lib/payEstimationSettings';
import { useRefreshOnFocus, useScrollToTopOnFocus } from '@/hooks/useRefreshOnFocus';
import { clearChatHistory, getChatQuotaState, getDataModeLabel } from '@/lib/ai/chatService';
import { isAnthropicApiKeyConfigured } from '@/lib/ai/env';
import { useAppTheme } from '@/lib/themeContext';

type PickerKind = 'currency' | 'language' | 'region' | 'pay_frequency' | null;

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight, mode, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);

  const [currency, setCurrency] = useState<CurrencyCode>('CAD');
  const [language, setLanguage] = useState<DisplayLanguage>('fr-CA');
  const [region, setRegion] = useState<CountryRegion>('CA-QC');
  const [dateFormat, setDateFormat] = useState<DateFormatPreference>('friendly');
  const [numpadMode, setNumpadMode] = useState<NumpadDefaultMode>('decimal');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [autocompleteEnabled, setAutocompleteEnabledState] = useState(true);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [aiDataModeLabel, setAiDataModeLabel] = useState('Saisie manuelle');
  const [aiQuotaLabel, setAiQuotaLabel] = useState<string | undefined>(undefined);
  const [anthropicApiKeyConfigured, setAnthropicApiKeyConfigured] = useState(false);
  const [clearingChatHistory, setClearingChatHistory] = useState(false);

  const [payFrequency, setPayFrequency] = useState<PayEstimationFrequency | null>(null);
  const [paySecondLastDate, setPaySecondLastDate] = useState('');
  const [payLastDate, setPayLastDate] = useState('');
  const [payAverageAmount, setPayAverageAmount] = useState('');

  const [activePicker, setActivePicker] = useState<PickerKind>(null);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);
  const [deletingCloud, setDeletingCloud] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackVariant, setFeedbackVariant] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  const showFeedback = (
    title: string,
    message: string,
    variant: 'success' | 'error' | 'warning' | 'info' = 'success',
  ) => {
    setFeedbackTitle(title);
    setFeedbackMessage(message);
    setFeedbackVariant(variant);
    setFeedbackVisible(true);
  };

  const load = useCallback(async () => {
    const [
      storedCurrency,
      storedLanguage,
      storedRegion,
      storedDateFormat,
      storedNumpadMode,
      storedHaptic,
      storedAutocomplete,
      storedCloud,
      dataModeLabel,
      quota,
      paySettings,
    ] = await Promise.all([
      getDisplayCurrency(),
      getDisplayLanguage(),
      getCountryRegion(),
      getDateFormatPreference(),
      getNumpadDefaultMode(),
      getHapticFeedbackEnabled(),
      getAutocompleteEnabled(),
      getCloudAccountConnected(),
      getDataModeLabel(),
      getChatQuotaState(),
      getPayEstimationSettings(),
    ]);

    setCurrency(storedCurrency);
    setLanguage(storedLanguage);
    setRegion(storedRegion);
    setDateFormat(storedDateFormat);
    setNumpadMode(storedNumpadMode);
    setHapticEnabled(storedHaptic);
    setAutocompleteEnabledState(storedAutocomplete);
    setCloudConnected(storedCloud);
    setAiDataModeLabel(dataModeLabel);
    setAiQuotaLabel(`${quota.messagesThisMonth}/${quota.monthlyLimit} messages ce mois`);
    setAnthropicApiKeyConfigured(isAnthropicApiKeyConfigured());
    setPayFrequency(paySettings.frequency);
    setPaySecondLastDate(paySettings.secondLastDate ?? '');
    setPayLastDate(paySettings.lastDate ?? '');
    setPayAverageAmount(
      paySettings.averageAmount != null && paySettings.averageAmount > 0
        ? String(paySettings.averageAmount)
        : '',
    );
  }, []);

  useRefreshOnFocus(load);
  useScrollToTopOnFocus(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );

  const handleThemeChange = (next: ThemePreference) => {
    void setMode(next);
  };

  const handleConnectAccount = async () => {
    if (cloudConnected) {
      await setCloudAccountConnected(false);
      setCloudConnected(false);
      showFeedback('Déconnecté', 'Ton compte a été déconnecté de cet appareil.', 'info');
      return;
    }

    setConnecting(true);
    tapHaptic();
    await new Promise((resolve) => setTimeout(resolve, 650));
    await setCloudAccountConnected(true);
    setCloudConnected(true);
    setConnecting(false);
    successHaptic();
    showFeedback(
      'Compte connecté',
      'La connexion cloud est simulée pour l’instant. Tes données locales restent disponibles hors ligne.',
      'success',
    );
  };

  const handleConfirmDeleteCloud = async () => {
    setDeletingCloud(true);
    const result = await deleteCloudData();
    setDeletingCloud(false);
    setConfirmDeleteVisible(false);
    setCloudConnected(false);
    showFeedback(result.ok ? 'Données cloud' : 'Impossible', result.message, result.ok ? 'warning' : 'error');
  };

  const handleClearChatHistory = async () => {
    setClearingChatHistory(true);
    await clearChatHistory();
    setClearingChatHistory(false);
    successHaptic();
    showFeedback('Historique effacé', 'Les conversations avec Fyn ont été supprimées de cet appareil.', 'success');
  };

  const themeTabs = useMemo(
    () => [
      { id: 'light' as const, label: 'Clair', icon: 'sunny-outline' as const },
      { id: 'dark' as const, label: 'Sombre', icon: 'moon-outline' as const },
    ],
    [],
  );

  return (
    <PageTransition>
      <View style={styles.screen}>
        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + SCREEN_TOP_GUTTER },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Réglages</Text>

          <SettingsSection title="Compte">
            <SettingsNavigationRow
              label={cloudConnected ? 'Compte connecté' : 'Se connecter'}
              hint={
                cloudConnected
                  ? 'Synchronisation cloud activée sur cet appareil.'
                  : 'Lie ton compte pour sauvegarder dans le cloud.'
              }
              icon={cloudConnected ? 'person' : 'person-outline'}
              value={cloudConnected ? 'Actif' : connecting ? 'Connexion…' : undefined}
              onPress={() => void handleConnectAccount()}
              accessory={
                cloudConnected ? (
                  <View style={[styles.statusBadge, { backgroundColor: colors.successMuted }]}>
                    <Text style={[styles.statusBadgeText, { color: colors.primary }]}>Connecté</Text>
                  </View>
                ) : undefined
              }
              isLast
            />
          </SettingsSection>

          <SettingsSection title="Apparence">
            <SettingsCustomRow
              label="Thème"
              hint="Choisis l’ambiance visuelle de l’application."
              icon="color-palette-outline"
              isLast
            >
              <SegmentedTabs
                tabs={themeTabs}
                active={mode}
                onChange={handleThemeChange}
                size="section"
                variant="section"
                showDivider={false}
              />
            </SettingsCustomRow>
          </SettingsSection>

          <SettingsSection title="Région">
            <SettingsNavigationRow
              label="Région"
              hint="Conventions fiscales et régionales."
              icon="earth-outline"
              value={formatRegionLabel(region)}
              onPress={() => setActivePicker('region')}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="Monnaie">
            <SettingsNavigationRow
              label="Devise"
              hint="Symbole et format des montants dans l’app."
              icon="cash-outline"
              value={labelForOption(CURRENCY_OPTIONS, currency)}
              onPress={() => setActivePicker('currency')}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="Langue">
            <SettingsNavigationRow
              label="Langue"
              hint="Libellés et formats textuels de l’interface."
              icon="language-outline"
              value={labelForOption(LANGUAGE_OPTIONS, language)}
              onPress={() => setActivePicker('language')}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="Saisie">
            <SettingsToggleRow
              label="Haptique"
              hint="Vibration légère lors des actions tactiles."
              icon="phone-portrait-outline"
              value={hapticEnabled}
              onValueChange={(enabled) => {
                setHapticEnabled(enabled);
                void setHapticFeedbackEnabled(enabled);
              }}
            />
            <SettingsToggleRow
              label="Suggestions"
              hint="Propositions de marchands, contacts et libellés."
              icon="sparkles-outline"
              value={autocompleteEnabled}
              onValueChange={(enabled) => {
                setAutocompleteEnabledState(enabled);
                void setAutocompleteEnabled(enabled);
              }}
            />
            <SettingsCustomRow
              label="Date"
              hint="Affichage des dates dans les formulaires."
              icon="calendar-outline"
            >
              <SegmentedTabs
                tabs={DATE_FORMAT_OPTIONS.map((option) => ({
                  id: option.id,
                  label: option.label,
                }))}
                active={dateFormat}
                onChange={(next) => {
                  setDateFormat(next);
                  void setDateFormatPreference(next);
                }}
                size="section"
                variant="section"
                showDivider={false}
              />
            </SettingsCustomRow>
            <SettingsCustomRow
              label="Pavé"
              hint="Comportement par défaut lors de la saisie des montants."
              icon="keypad-outline"
              isLast
            >
              <SegmentedTabs
                tabs={NUMPAD_MODE_OPTIONS.map((option) => ({
                  id: option.id,
                  label: option.label,
                }))}
                active={numpadMode}
                onChange={(next) => {
                  setNumpadMode(next);
                  void setNumpadDefaultMode(next);
                }}
                size="section"
                variant="section"
                showDivider={false}
              />
            </SettingsCustomRow>
          </SettingsSection>

          <SettingsSection title="Info">
            <SettingsNavigationRow
              label="Fréquence des paies"
              hint="Utilisée pour projeter les jours de paie dans l’agenda."
              icon="repeat-outline"
              value={payFrequency ? payEstimationFrequencyLabel(payFrequency) : 'Non définie'}
              onPress={() => setActivePicker('pay_frequency')}
            />
            <SettingsCustomRow
              label="Avant-dernière paie"
              hint="Date de la paie précédant la dernière."
              icon="calendar-outline"
            >
              <DatePickerField
                label="Date"
                value={paySecondLastDate}
                placeholder="Choisir une date"
                variant="sheet"
                onChangeDate={(next) => {
                  setPaySecondLastDate(next);
                  void persistPaySecondLastDate(next);
                }}
              />
            </SettingsCustomRow>
            <SettingsCustomRow
              label="Dernière paie"
              hint="Point de départ pour estimer les prochaines paies dans l’agenda."
              icon="calendar-outline"
            >
              <DatePickerField
                label="Date"
                value={payLastDate}
                placeholder="Choisir une date"
                variant="sheet"
                onChangeDate={(next) => {
                  setPayLastDate(next);
                  void persistPayLastDate(next);
                }}
              />
            </SettingsCustomRow>
            <SettingsCustomRow
              label="Montant moyen des paies"
              hint="Optionnel — affiché sur les dépôts estimés de l’agenda."
              icon="cash-outline"
              isLast
            >
              <NumericAmountInput
                value={payAverageAmount}
                onChangeText={(next) => {
                  setPayAverageAmount(next);
                  const parsed = Number(next);
                  void persistPayAverageAmount(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
                }}
                placeholder="Ex. 2 450"
                placeholderTextColor={colors.textMuted}
                style={styles.amountInput}
                keyboardType="decimal-pad"
              />
            </SettingsCustomRow>
          </SettingsSection>

          <SettingsSection title="Fyn">
            <SettingsNavigationRow
              label="Clé Anthropic"
              hint="Anthropic (Claude) — requise pour le chat IA complet."
              icon="key-outline"
              value={anthropicApiKeyConfigured ? 'Active' : 'Absente'}
              onPress={() => {
                tapHaptic();
                showFeedback(
                  anthropicApiKeyConfigured ? 'Clé Anthropic active' : 'Clé Anthropic absente',
                  anthropicApiKeyConfigured
                    ? 'La clé Anthropic est chargée. Si le chat reste en mode démo, redémarre Expo avec le cache vidé : npx expo start -c'
                    : '1. Copie apps/mobile/.env.example vers apps/mobile/.env\n2. Colle ta clé dans EXPO_PUBLIC_ANTHROPIC_API_KEY=\n3. Redémarre Expo : npx expo start -c\n\nSans .env, l\'app reste en mode démo.',
                  anthropicApiKeyConfigured ? 'success' : 'warning',
                );
              }}
              accessory={
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: anthropicApiKeyConfigured
                        ? colors.successMuted
                        : colors.surfaceElevated,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      { color: anthropicApiKeyConfigured ? colors.primary : colors.textMuted },
                    ]}
                  >
                    {anthropicApiKeyConfigured ? 'OK' : '—'}
                  </Text>
                </View>
              }
            />
            <SettingsNavigationRow
              label="Mode de données"
              hint="Plaid (sync bancaire) ou saisie manuelle — influence les conseils de l'IA."
              icon="analytics-outline"
              value={aiDataModeLabel}
              onPress={() => {
                tapHaptic();
                showFeedback(
                  'Mode de données',
                  aiDataModeLabel,
                  'info',
                );
              }}
            />
            <SettingsNavigationRow
              label="Quota mensuel"
              hint="Suivi local des messages envoyés à Fyn."
              icon="chatbubble-ellipses-outline"
              value={aiQuotaLabel}
              onPress={() => {
                tapHaptic();
                if (aiQuotaLabel) {
                  showFeedback('Quota mensuel', aiQuotaLabel, 'info');
                }
              }}
            />
            <SettingsNavigationRow
              label="Effacer l'historique"
              hint="Supprime les conversations IA stockées sur cet appareil."
              icon="trash-outline"
              value={clearingChatHistory ? 'Effacement…' : undefined}
              onPress={() => void handleClearChatHistory()}
              isLast
            />
          </SettingsSection>

          <SettingsSection title="Données cloud">
            <View style={styles.dangerBlock}>
              <Text style={[styles.dangerHint, { color: colors.textMuted }]}>
                Supprime définitivement les données hébergées sur le serveur. Les données locales de cet appareil ne sont pas effacées.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Supprimer les données cloud"
                disabled={deletingCloud}
                onPress={() => {
                  tapHaptic();
                  setConfirmDeleteVisible(true);
                }}
                style={({ pressed }) => [
                  subtleDeleteButtonStyle(isLight, { alignSelf: 'stretch' }),
                  pressed && styles.pressed,
                  deletingCloud && styles.disabled,
                ]}
              >
                <AppIcon family="ionicons" name="trash-outline" size={16} color={colors.danger} />
                <Text style={destructiveTextActionStyle(isLight)}>
                  {deletingCloud ? 'Suppression…' : 'Supprimer les données cloud'}
                </Text>
              </Pressable>
            </View>
          </SettingsSection>

          <SettingsSection title="Dev (temporaire)">
            <SettingsNavigationRow
              label="Catalogue icônes Lucide"
              hint="Parcourir et choisir une icône visuellement."
              icon="grid-outline"
              onPress={() => {
                tapHaptic();
                router.push('/lucide-icons');
              }}
              isLast
            />
          </SettingsSection>

          <Text style={[styles.footer, { color: colors.textMuted }]}>Budget Tracker · v1.0</Text>
        </ScrollView>

        <SettingsPickerSheet
          visible={activePicker === 'currency'}
          title="Devise"
          options={CURRENCY_OPTIONS}
          selectedId={currency}
          onClose={() => setActivePicker(null)}
          onSelect={(id) => {
            setCurrency(id);
            void setDisplayCurrency(id);
          }}
        />

        <SettingsPickerSheet
          visible={activePicker === 'language'}
          title="Langue"
          options={LANGUAGE_OPTIONS}
          selectedId={language}
          onClose={() => setActivePicker(null)}
          onSelect={(id) => {
            setLanguage(id);
            void setDisplayLanguage(id);
          }}
        />

        <RegionPickerSheet
          visible={activePicker === 'region'}
          selectedId={region}
          onClose={() => setActivePicker(null)}
          onSelect={(id) => {
            void applyRegionSettings(id).then((linked) => {
              setRegion(linked.region);
              setCurrency(linked.currency);
              setDateFormat(linked.dateFormat);
              setNumpadMode(linked.numpadMode);
            });
          }}
        />

        <SettingsPickerSheet
          visible={activePicker === 'pay_frequency'}
          title="Fréquence des paies"
          options={PAY_ESTIMATION_FREQUENCY_OPTIONS}
          selectedId={payFrequency ?? PAY_ESTIMATION_FREQUENCY_OPTIONS[1].id}
          onClose={() => setActivePicker(null)}
          onSelect={(id) => {
            const next = id as PayEstimationFrequency;
            setPayFrequency(next);
            void persistPayEstimationFrequency(next);
          }}
        />

        <ConfirmDeleteModal
          visible={confirmDeleteVisible}
          title="Supprimer les données cloud ?"
          message="Cette action est irréversible. Toutes les données synchronisées sur le serveur seront effacées. Tes données locales restent sur cet appareil."
          confirmLabel="Supprimer"
          onConfirm={() => void handleConfirmDeleteCloud()}
          onCancel={() => setConfirmDeleteVisible(false)}
        />

        <ThemedConfirmModal
          visible={feedbackVisible}
          title={feedbackTitle}
          message={feedbackMessage}
          variant={feedbackVariant}
          confirmLabel="OK"
          onConfirm={() => setFeedbackVisible(false)}
          onCancel={() => setFeedbackVisible(false)}
        />
      </View>
    </PageTransition>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: PAGE_PADDING_HORIZONTAL,
      paddingBottom: FLOATING_NAV_CONTENT_PADDING,
      gap: PAGE_TITLE_CONTENT_GAP,
    },
    title: {
      ...typographyKit.pageTitle,
      color: colors.text,
    },
    dangerBlock: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    dangerHint: {
      ...typographyKit.metaMedium,
      lineHeight: typographyKit.metaMedium.fontSize + 6,
    },
    statusBadge: {
      borderRadius: 999,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    statusBadgeText: {
      ...typographyKit.microMedium,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    footer: {
      ...typographyKit.microMedium,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    amountInput: {
      minHeight: 50,
      borderRadius: 13,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: spacing.md,
      paddingVertical: 14,
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    pressed: {
      opacity: 0.82,
    },
    disabled: {
      opacity: 0.55,
    },
  });
