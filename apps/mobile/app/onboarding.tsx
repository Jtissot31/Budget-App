import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { FynAvatar } from '@/components/ai-chat/FynAvatar';
import { FynApiKeySheet } from '@/components/ai-chat/FynApiKeySheet';
import { DatePickerField } from '@/components/MinimalDatePicker';
import { NumericAmountInput } from '@/components/NumericAmountInput';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaRegularText,
  PAGE_PADDING_HORIZONTAL,
  spacing,
} from '@/constants/theme';
import {
  getGeminiApiKeySource,
  isGeminiApiKeyConfigured,
} from '@/lib/ai/env';
import { clearUserGeminiApiKey, setUserGeminiApiKey } from '@/lib/ai/userApiKeys';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { setOnboardingCompleted } from '@/lib/onboarding';
import { applyOnboardingMoneyAnswers } from '@/lib/onboardingMoney';
import { setAppTourCompleted } from '@/lib/appTour';
import {
  PAY_ESTIMATION_FREQUENCY_OPTIONS,
  type PayEstimationFrequency,
} from '@/lib/payEstimationSettings';
import { useAppTheme } from '@/lib/themeContext';
import { getUserDisplayName, setUserDisplayName } from '@/lib/userDisplay';

type StepId = 'welcome' | 'features' | 'name' | 'pay' | 'housing' | 'fyn';

/** Intro wizard only — no in-app guided tab tour afterwards. */
const STEPS: StepId[] = ['welcome', 'features', 'name', 'pay', 'housing', 'fyn'];

/** Fully pitch-black onboarding canvas — ambient green via soft edge washes only. */
const ONBOARDING_PITCH = '#000000';
const ONBOARDING_GLOW = 'rgba(74, 222, 128, 0.14)';
const ONBOARDING_GLOW_SOFT = 'rgba(74, 222, 128, 0.07)';

/**
 * Former welcome icon (88) + brand block height, so headline sits where it did
 * when the logo/name stack was above it (centered column).
 */
const WELCOME_TOP_SPACER =
  88 + spacing.sm + 20 + spacing.md;

const FEATURES: {
  icon: 'wallet-outline' | 'pie-chart-outline' | 'map-outline' | 'sparkles-outline';
  title: string;
  body: string;
}[] = [
  {
    icon: 'wallet-outline',
    title: 'Suivre tes dépenses',
    body: 'Comptes, transactions et marchands — tout au même endroit.',
  },
  {
    icon: 'pie-chart-outline',
    title: 'Budgets clairs',
    body: 'Catégories, plafonds et progression mois après mois.',
  },
  {
    icon: 'map-outline',
    title: 'Plans financiers',
    body: 'Objectifs d’épargne, dettes et stratégies pas à pas.',
  },
  {
    icon: 'sparkles-outline',
    title: 'Fyn, ton conseiller',
    body: 'Un assistant IA pour comprendre et ajuster ton budget.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [averageSalary, setAverageSalary] = useState('');
  const [payFrequency, setPayFrequency] = useState<PayEstimationFrequency | null>(null);
  const [lastPayday, setLastPayday] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [apiKeySheetOpen, setApiKeySheetOpen] = useState(false);
  const [geminiConfigured, setGeminiConfigured] = useState(isGeminiApiKeyConfigured());
  const [geminiSource, setGeminiSource] = useState(getGeminiApiKeySource());

  const step = STEPS[stepIndex] ?? 'welcome';
  const isLast = stepIndex >= STEPS.length - 1;

  useEffect(() => {
    let active = true;
    void getUserDisplayName().then((name) => {
      if (active) setDisplayName(name === 'Jérémie' ? '' : name);
    });
    return () => {
      active = false;
    };
  }, []);

  const goNext = useCallback(() => {
    tapHaptic();
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    tapHaptic();
    setStepIndex((current) => Math.max(current - 1, 0));
  }, []);

  const persistMoneyAnswers = useCallback(async () => {
    const salary = Number(averageSalary);
    const rent = Number(monthlyRent);
    await applyOnboardingMoneyAnswers({
      payFrequency,
      lastPayday,
      averageSalary: Number.isFinite(salary) && salary > 0 ? salary : null,
      monthlyRent: Number.isFinite(rent) && rent > 0 ? rent : null,
    });
  }, [averageSalary, lastPayday, monthlyRent, payFrequency]);

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      const trimmed = displayName.trim();
      if (trimmed) {
        await setUserDisplayName(trimmed);
      }
      await persistMoneyAnswers();
      // Mark guided tour completed so it never auto-starts on the main tabs.
      await setAppTourCompleted(true);
      await setOnboardingCompleted(true);
      successHaptic();
      router.replace('/(tabs)');
    } catch (error) {
      console.warn('[Onboarding] finish failed', error);
      setFinishing(false);
    }
  }, [displayName, finishing, persistMoneyAnswers, router]);

  const primaryLabel = useMemo(() => {
    if (step === 'welcome') return 'Commencer';
    if (step === 'features' || step === 'name' || step === 'pay' || step === 'housing') {
      return 'Continuer';
    }
    return geminiConfigured ? 'Entrer dans l’app' : 'Passer et entrer';
  }, [geminiConfigured, step]);

  const onPrimary = useCallback(() => {
    if (step === 'name') {
      tapHaptic();
      const trimmed = displayName.trim();
      if (trimmed) {
        void setUserDisplayName(trimmed);
      }
      goNext();
      return;
    }
    if (step === 'pay' || step === 'housing') {
      tapHaptic();
      void persistMoneyAnswers().then(() => {
        if (isLast) {
          void finish();
          return;
        }
        goNext();
      });
      return;
    }
    if (isLast) {
      void finish();
      return;
    }
    goNext();
  }, [displayName, finish, goNext, isLast, persistMoneyAnswers, step]);

  return (
    <View style={[styles.screen, { backgroundColor: ONBOARDING_PITCH, paddingTop: insets.top }]}>
      <OnboardingAtmosphere />
      <KeyboardAvoidingView
        style={[styles.flex, styles.contentLayer]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <View style={[styles.header, { paddingHorizontal: PAGE_PADDING_HORIZONTAL }]}>
          {stepIndex > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={12}
              onPress={goBack}
              style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            >
              <AppIcon family="ionicons" name="chevron-back" size={22} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.backBtn} />
          )}

          <View style={styles.dots}>
            {STEPS.map((id, index) => {
              const active = index === stepIndex;
              const done = index < stepIndex;
              return (
                <View
                  key={id}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: active || done ? colors.accentGreen : colors.borderSubtle,
                      opacity: active ? 1 : done ? 0.55 : 1,
                      width: active ? 18 : 7,
                    },
                  ]}
                />
              );
            })}
          </View>

          {!isLast ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer l'introduction"
              hitSlop={8}
              onPress={() => void finish()}
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
            >
              <AppIcon family="ionicons" name="close" size={22} color={colors.textMuted} />
            </Pressable>
          ) : (
            <View style={styles.skipBtn} />
          )}
        </View>

        <View style={[styles.body, { paddingHorizontal: PAGE_PADDING_HORIZONTAL }]}>
          <MotiView
            key={step}
            from={{ opacity: 0, translateY: 14 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 280 }}
            style={styles.stepContent}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
              ]}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {step === 'welcome' ? (
                <WelcomeStep accent={colors.accentGreen} text={colors.text} muted={colors.textMuted} />
              ) : null}
              {step === 'features' ? (
                <FeaturesStep
                  accent={colors.accentGreen}
                  text={colors.text}
                  muted={colors.textMuted}
                  iconBg={colors.input}
                />
              ) : null}
              {step === 'name' ? (
                <NameStep
                  value={displayName}
                  onChange={setDisplayName}
                  accent={colors.accentGreen}
                  text={colors.text}
                  muted={colors.textMuted}
                  inputBg={colors.input}
                  border={colors.containerBorder}
                />
              ) : null}
              {step === 'pay' ? (
                <PayStep
                  salary={averageSalary}
                  onChangeSalary={setAverageSalary}
                  frequency={payFrequency}
                  onChangeFrequency={setPayFrequency}
                  lastPayday={lastPayday}
                  onChangeLastPayday={setLastPayday}
                  accent={colors.accentGreen}
                  text={colors.text}
                  muted={colors.textMuted}
                  inputBg={colors.input}
                  border={colors.containerBorder}
                />
              ) : null}
              {step === 'housing' ? (
                <HousingStep
                  rent={monthlyRent}
                  onChangeRent={setMonthlyRent}
                  accent={colors.accentGreen}
                  text={colors.text}
                  muted={colors.textMuted}
                  inputBg={colors.input}
                  border={colors.containerBorder}
                />
              ) : null}
              {step === 'fyn' ? (
                <FynStep
                  configured={geminiConfigured}
                  text={colors.text}
                  muted={colors.textMuted}
                  accent={colors.accentGreen}
                  onOpenKeySheet={() => {
                    tapHaptic();
                    setApiKeySheetOpen(true);
                  }}
                />
              ) : null}

              {/* CTA scrolls with content — not a sticky overlay footer */}
              <View style={styles.ctaBlock}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={primaryLabel}
                  disabled={finishing}
                  onPress={onPrimary}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { backgroundColor: colors.accentGreen },
                    pressed && { opacity: 0.82 },
                    finishing && { opacity: 0.45 },
                  ]}
                >
                  <Text style={[styles.primaryLabel, { color: colors.background }]}>{primaryLabel}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </MotiView>
        </View>
      </KeyboardAvoidingView>

      <FynApiKeySheet
        visible={apiKeySheetOpen}
        provider="gemini"
        hasKey={geminiConfigured}
        keySource={geminiSource}
        onClose={() => setApiKeySheetOpen(false)}
        onSave={async (key) => {
          await setUserGeminiApiKey(key);
          setGeminiConfigured(isGeminiApiKeyConfigured());
          setGeminiSource(getGeminiApiKeySource());
        }}
        onClear={async () => {
          await clearUserGeminiApiKey();
          setGeminiConfigured(isGeminiApiKeyConfigured());
          setGeminiSource(getGeminiApiKeySource());
        }}
      />
    </View>
  );
}

/** Pitch black + soft edge green light only — no circular blobs or teal washes. */
function OnboardingAtmosphere() {
  return (
    <View style={styles.atmosphere} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: ONBOARDING_PITCH }]} />
      {/* Top edge — soft ambient wash into transparent */}
      <LinearGradient
        colors={[ONBOARDING_GLOW, ONBOARDING_GLOW_SOFT, 'transparent']}
        locations={[0, 0.35, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.glowTop}
      />
      {/* Bottom-left corner light */}
      <LinearGradient
        colors={[ONBOARDING_GLOW_SOFT, 'transparent']}
        locations={[0, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.glowCorner}
      />
    </View>
  );
}

function WelcomeStep({
  accent,
  text,
  muted,
}: {
  accent: string;
  text: string;
  muted: string;
}) {
  return (
    <View style={styles.welcome}>
      {/* Keeps headline at former mid-lower height after icon/name removal */}
      <View style={styles.welcomeTopSpacer} />
      <Text style={[styles.headline, { color: text }]}>
        Ton argent,{'\n'}
        <Text style={{ color: accent }}>enfin lisible.</Text>
      </Text>
      <Text style={[styles.subhead, { color: muted }]}>
        Budgets, comptes, plans et Fyn — un espace premium pour voir clairement où tu en es.
      </Text>
    </View>
  );
}

function FeaturesStep({
  accent,
  text,
  muted,
  iconBg,
}: {
  accent: string;
  text: string;
  muted: string;
  iconBg: string;
}) {
  return (
    <View style={styles.features}>
      <Text style={[styles.stepEyebrow, { color: accent }]}>Ce que tu peux faire</Text>
      <Text style={[styles.stepTitle, { color: text }]}>Tout ce qu’il faut,{'\n'}rien de superflu.</Text>
      <View style={styles.featureList}>
        {FEATURES.map((feature) => (
          <OnyxContainer key={feature.title} style={styles.featureCard}>
            <View style={[styles.featureIcon, { backgroundColor: iconBg }]}>
              <AppIcon family="ionicons" name={feature.icon} size={20} color={text} />
            </View>
            <View style={styles.featureCopy}>
              <Text style={[styles.featureTitle, { color: text }]}>{feature.title}</Text>
              <Text style={[styles.featureBody, { color: muted }]}>{feature.body}</Text>
            </View>
          </OnyxContainer>
        ))}
      </View>
    </View>
  );
}

function NameStep({
  value,
  onChange,
  accent,
  text,
  muted,
  inputBg,
  border,
}: {
  value: string;
  onChange: (next: string) => void;
  accent: string;
  text: string;
  muted: string;
  inputBg: string;
  border: string;
}) {
  return (
    <View style={styles.nameStep}>
      <Text style={[styles.stepEyebrow, { color: accent }]}>Personnalisation</Text>
      <Text style={[styles.stepTitle, { color: text }]}>Comment t’appeler ?</Text>
      <Text style={[styles.subhead, { color: muted, marginTop: spacing.sm }]}>
        On l’utilise pour le bonjour sur l’accueil. Tu pourras le changer plus tard.
      </Text>
      <OnyxContainer style={styles.nameCard}>
        <Text style={[styles.fieldLabel, { color: muted }]}>Prénom ou surnom</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="Ex. Alex"
          placeholderTextColor={muted}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={40}
          style={[
            styles.nameInput,
            {
              color: text,
              backgroundColor: inputBg,
              borderColor: border,
            },
          ]}
        />
      </OnyxContainer>
    </View>
  );
}

function PayStep({
  salary,
  onChangeSalary,
  frequency,
  onChangeFrequency,
  lastPayday,
  onChangeLastPayday,
  accent,
  text,
  muted,
  inputBg,
  border,
}: {
  salary: string;
  onChangeSalary: (next: string) => void;
  frequency: PayEstimationFrequency | null;
  onChangeFrequency: (next: PayEstimationFrequency) => void;
  lastPayday: string;
  onChangeLastPayday: (next: string) => void;
  accent: string;
  text: string;
  muted: string;
  inputBg: string;
  border: string;
}) {
  return (
    <View style={styles.moneyStep}>
      <Text style={[styles.stepEyebrow, { color: accent }]}>Cashflow</Text>
      <Text style={[styles.stepTitle, { color: text }]}>Tes jours de paie</Text>
      <Text style={[styles.subhead, { color: muted, marginTop: spacing.sm }]}>
        Salaire, fréquence et dernière paie — pour l’agenda, les alertes et les estimations.
      </Text>

      <OnyxContainer style={styles.moneyCard}>
        <Text style={[styles.fieldLabel, { color: muted }]}>Salaire moyen (par paie)</Text>
        <NumericAmountInput
          value={salary}
          onChangeText={onChangeSalary}
          placeholder="Ex. 2 450"
          placeholderTextColor={muted}
          style={[
            styles.nameInput,
            {
              color: text,
              backgroundColor: inputBg,
              borderColor: border,
            },
          ]}
        />

        <Text style={[styles.fieldLabel, { color: muted, marginTop: spacing.md }]}>
          Fréquence de paie
        </Text>
        <View style={styles.freqGrid}>
          {PAY_ESTIMATION_FREQUENCY_OPTIONS.map((option) => {
            const selected = frequency === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  tapHaptic();
                  onChangeFrequency(option.id);
                }}
                style={({ pressed }) => [
                  styles.freqChip,
                  {
                    backgroundColor: selected ? accent : inputBg,
                    borderColor: selected ? accent : border,
                  },
                  pressed && { opacity: 0.82 },
                ]}
              >
                <Text
                  style={[
                    styles.freqChipLabel,
                    { color: selected ? ONBOARDING_PITCH : text },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.fieldLabel, { color: muted, marginTop: spacing.md }]}>
          Date de la dernière paie
        </Text>
        <DatePickerField
          label="Dernière paie"
          value={lastPayday}
          placeholder="Choisir une date"
          variant="sheet"
          onChangeDate={onChangeLastPayday}
          labelStyle={styles.hiddenLabel}
        />
      </OnyxContainer>
    </View>
  );
}

function HousingStep({
  rent,
  onChangeRent,
  accent,
  text,
  muted,
  inputBg,
  border,
}: {
  rent: string;
  onChangeRent: (next: string) => void;
  accent: string;
  text: string;
  muted: string;
  inputBg: string;
  border: string;
}) {
  return (
    <View style={styles.moneyStep}>
      <Text style={[styles.stepEyebrow, { color: accent }]}>Budget</Text>
      <Text style={[styles.stepTitle, { color: text }]}>Ton logement</Text>
      <Text style={[styles.subhead, { color: muted, marginTop: spacing.sm }]}>
        On crée une catégorie Logement sur Budgets avec ce plafond mensuel.
      </Text>

      <OnyxContainer style={styles.moneyCard}>
        <Text style={[styles.fieldLabel, { color: muted }]}>Loyer / coût appart par mois</Text>
        <NumericAmountInput
          value={rent}
          onChangeText={onChangeRent}
          placeholder="Ex. 1 250"
          placeholderTextColor={muted}
          style={[
            styles.nameInput,
            {
              color: text,
              backgroundColor: inputBg,
              borderColor: border,
            },
          ]}
        />
        <Text style={[styles.fieldHint, { color: muted }]}>
          Optionnel — tu pourras l’ajuster plus tard dans Budgets ou Réglages.
        </Text>
      </OnyxContainer>
    </View>
  );
}

function FynStep({
  configured,
  text,
  muted,
  accent,
  onOpenKeySheet,
}: {
  configured: boolean;
  text: string;
  muted: string;
  accent: string;
  onOpenKeySheet: () => void;
}) {
  return (
    <View style={styles.fynStep}>
      <Text style={[styles.stepEyebrow, { color: accent }]}>Optionnel</Text>
      <Text style={[styles.stepTitle, { color: text }]}>Activer Fyn</Text>
      <Text style={[styles.subhead, { color: muted, marginTop: spacing.sm }]}>
        Fyn utilise ta propre clé Gemini (BYOK). Tu peux aussi le faire plus tard dans Réglages.
      </Text>

      <OnyxContainer style={styles.fynHero}>
        <FynAvatar size={56} showStatus statusBorderColor="#111111" />
        <View style={styles.fynCopy}>
          <Text style={[styles.featureTitle, { color: text }]}>Conseiller IA</Text>
          <Text style={[styles.featureBody, { color: muted }]}>
            Plans, cashflow et idées — sans forcer de clé maintenant.
          </Text>
        </View>
      </OnyxContainer>

      <Pressable
        accessibilityRole="button"
        onPress={onOpenKeySheet}
        style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
      >
        <OnyxContainer style={styles.fynAction}>
          <View style={styles.fynActionCopy}>
            <Text style={[styles.featureTitle, { color: text }]}>
              {configured ? 'Clé Gemini enregistrée' : 'Ajouter une clé Gemini'}
            </Text>
            <Text style={[styles.featureBody, { color: muted }]}>
              {configured
                ? 'Tu peux la modifier ou la retirer.'
                : 'Stockée sur cet appareil. Pas obligatoire.'}
            </Text>
          </View>
          <AppIcon
            family="ionicons"
            name={configured ? 'checkmark-circle' : 'key-outline'}
            size={22}
            color={configured ? accent : text}
          />
        </OnyxContainer>
      </Pressable>
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
  contentLayer: {
    zIndex: 1,
  },
  atmosphere: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: ONBOARDING_PITCH,
  },
  glowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '42%',
  },
  glowCorner: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '70%',
    height: '38%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    minHeight: 44,
  },
  backBtn: {
    width: 56,
    height: 36,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  skipBtn: {
    width: 56,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 7,
    borderRadius: 999,
  },
  body: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  stepContent: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  ctaBlock: {
    marginTop: 'auto',
    paddingTop: spacing.xl,
    alignItems: 'center',
  },
  primaryBtn: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 28,
    paddingVertical: 8,
    borderRadius: 999,
  },
  primaryLabel: {
    ...jakartaBoldText,
    fontSize: 14,
  },
  welcome: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  welcomeTopSpacer: {
    height: WELCOME_TOP_SPACER,
  },
  headline: {
    ...jakartaExtraBoldText,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.6,
  },
  subhead: {
    ...jakartaRegularText,
    fontSize: 16,
    lineHeight: 24,
  },
  features: {
    flex: 1,
    gap: spacing.md,
  },
  stepEyebrow: {
    ...jakartaMediumText,
    fontSize: 13,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  stepTitle: {
    ...jakartaExtraBoldText,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  featureList: {
    gap: ONYX_CONTAINER.listGap,
    marginTop: spacing.sm,
  },
  featureCard: {
    ...onyxContainerRowLayoutStyle(),
    alignItems: 'center',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  featureTitle: {
    ...jakartaBoldText,
    fontSize: 15,
  },
  featureBody: {
    ...jakartaRegularText,
    fontSize: 13,
    lineHeight: 18,
  },
  nameStep: {
    flex: 1,
    gap: spacing.xs,
  },
  moneyStep: {
    flex: 1,
    gap: spacing.xs,
  },
  nameCard: {
    marginTop: spacing.lg,
    padding: ONYX_CONTAINER.padding.card,
    gap: spacing.sm,
  },
  moneyCard: {
    marginTop: spacing.lg,
    padding: ONYX_CONTAINER.padding.card,
    gap: spacing.sm,
  },
  fieldLabel: {
    ...jakartaMediumText,
    fontSize: 13,
  },
  fieldHint: {
    ...jakartaRegularText,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.xs,
  },
  hiddenLabel: {
    height: 0,
    marginBottom: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  nameInput: {
    ...jakartaMediumText,
    fontSize: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  freqGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  freqChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  freqChipLabel: {
    ...jakartaMediumText,
    fontSize: 13,
  },
  fynStep: {
    flex: 1,
    gap: spacing.md,
  },
  fynHero: {
    ...onyxContainerRowLayoutStyle(),
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  fynCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fynAction: {
    ...onyxContainerRowLayoutStyle(),
    alignItems: 'center',
  },
  fynActionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
