import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { FynAvatar } from '@/components/ai-chat/FynAvatar';
import { FynApiKeySheet } from '@/components/ai-chat/FynApiKeySheet';
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
  typography,
} from '@/constants/theme';
import {
  getGeminiApiKeySource,
  isGeminiApiKeyConfigured,
} from '@/lib/ai/env';
import { clearUserGeminiApiKey, setUserGeminiApiKey } from '@/lib/ai/userApiKeys';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { setOnboardingCompleted } from '@/lib/onboarding';
import { resetAppTour } from '@/lib/appTour';
import { useAppTheme } from '@/lib/themeContext';
import { getUserDisplayName, setUserDisplayName } from '@/lib/userDisplay';

const APP_ICON = require('@/assets/images/icon.png');

type StepId = 'welcome' | 'features' | 'name' | 'fyn';

/** Intro only — guided tab tour runs inside the real app after this. */
const STEPS: StepId[] = ['welcome', 'features', 'name', 'fyn'];

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

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      const trimmed = displayName.trim();
      if (trimmed) {
        await setUserDisplayName(trimmed);
      }
      // Ensure the in-app tour runs once after this intro (incl. replay from Réglages).
      await resetAppTour();
      await setOnboardingCompleted(true);
      successHaptic();
      router.replace('/(tabs)');
    } catch (error) {
      console.warn('[Onboarding] finish failed', error);
      setFinishing(false);
    }
  }, [displayName, finishing, router]);

  const primaryLabel = useMemo(() => {
    if (step === 'welcome') return 'Commencer';
    if (step === 'features') return 'Continuer';
    if (step === 'name') return 'Continuer';
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
    if (isLast) {
      void finish();
      return;
    }
    goNext();
  }, [displayName, finish, goNext, isLast, step]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
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
              accessibilityLabel="Passer"
              hitSlop={12}
              onPress={() => void finish()}
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.skipText, { color: colors.textMuted }]}>Passer</Text>
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
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {step === 'welcome' ? (
                <WelcomeStep accent={colors.accentGreen} text={colors.text} muted={colors.textMuted} />
              ) : null}
              {step === 'features' ? (
                <FeaturesStep text={colors.text} muted={colors.textMuted} iconBg={colors.input} />
              ) : null}
              {step === 'name' ? (
                <NameStep
                  value={displayName}
                  onChange={setDisplayName}
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
            </ScrollView>
          </MotiView>
        </View>

        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: PAGE_PADDING_HORIZONTAL,
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
            },
          ]}
        >
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
      <View style={[styles.iconHalo, { borderColor: 'rgba(74, 222, 128, 0.22)' }]}>
        <Image source={APP_ICON} style={styles.appIcon} accessibilityLabel="Budget Tracker" />
      </View>
      <Text style={[styles.brand, { color: text }]}>Budget Tracker</Text>
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
  text,
  muted,
  iconBg,
}: {
  text: string;
  muted: string;
  iconBg: string;
}) {
  return (
    <View style={styles.features}>
      <Text style={[styles.stepEyebrow, { color: muted }]}>Ce que tu peux faire</Text>
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
  text,
  muted,
  inputBg,
  border,
}: {
  value: string;
  onChange: (next: string) => void;
  text: string;
  muted: string;
  inputBg: string;
  border: string;
}) {
  return (
    <View style={styles.nameStep}>
      <Text style={[styles.stepEyebrow, { color: muted }]}>Personnalisation</Text>
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
      <Text style={[styles.stepEyebrow, { color: muted }]}>Optionnel</Text>
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
    height: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  skipText: {
    ...jakartaMediumText,
    fontSize: 14,
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
    paddingBottom: spacing.md,
  },
  footer: {
    paddingTop: spacing.md,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: ONYX_CONTAINER.borderRadius,
    paddingVertical: 16,
  },
  primaryLabel: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
  },
  welcome: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  iconHalo: {
    width: 88,
    height: 88,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    backgroundColor: '#111111',
  },
  appIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  brand: {
    ...jakartaBoldText,
    fontSize: 15,
    letterSpacing: 0.2,
    opacity: 0.9,
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
  nameCard: {
    marginTop: spacing.lg,
    padding: ONYX_CONTAINER.padding.card,
    gap: spacing.sm,
  },
  fieldLabel: {
    ...jakartaMediumText,
    fontSize: 13,
  },
  nameInput: {
    ...jakartaMediumText,
    fontSize: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
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
