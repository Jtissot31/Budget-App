import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AIChatSettingDetailSheet } from '@/components/ai-chat/AIChatSettingDetailSheet';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { SettingsNavigationRow } from '@/components/SettingsRow';
import { SurfaceCard } from '@/components/SurfaceCard';
import { ThemedConfirmModal } from '@/components/ThemedConfirmModal';
import {
  interBoldText,
  interMediumText,
  radius,
  spacing,
  typography,
  typographyKit,
  type AppColors,
} from '@/constants/theme';
import { clearChatHistory, getChatQuotaState, getDataModeLabel } from '@/lib/ai/chatService';
import type { ChatQuotaState } from '@/lib/ai/types';
import { isAnthropicApiKeyConfigured } from '@/lib/ai/env';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  onHistoryCleared?: () => void;
};

type ActiveDetail = 'dataMode' | 'quota' | 'apiKey' | null;

export function AIChatSettingsSheet({ visible, onClose, onHistoryCleared }: Props) {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [aiDataModeLabel, setAiDataModeLabel] = useState('Saisie manuelle');
  const [aiQuotaState, setAiQuotaState] = useState<ChatQuotaState | null>(null);
  const [anthropicApiKeyConfigured, setAnthropicApiKeyConfigured] = useState(false);
  const [clearingChatHistory, setClearingChatHistory] = useState(false);

  const [activeDetail, setActiveDetail] = useState<ActiveDetail>(null);
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);

  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackTitle, setFeedbackTitle] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackVariant, setFeedbackVariant] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  const aiQuotaLabel = aiQuotaState
    ? `${aiQuotaState.messagesThisMonth}/${aiQuotaState.monthlyLimit} messages ce mois`
    : undefined;

  const backdropColor = useMemo(
    () => (isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.62)'),
    [isLight],
  );

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

  const loadSettings = useCallback(async () => {
    const [dataModeLabel, quota] = await Promise.all([getDataModeLabel(), getChatQuotaState()]);
    setAiDataModeLabel(dataModeLabel);
    setAiQuotaState(quota);
    setAnthropicApiKeyConfigured(isAnthropicApiKeyConfigured());
  }, []);

  useEffect(() => {
    if (!visible) {
      setActiveDetail(null);
      setConfirmClearVisible(false);
      return;
    }
    void loadSettings();
  }, [visible, loadSettings]);

  const handleClose = () => {
    tapHaptic();
    setActiveDetail(null);
    setConfirmClearVisible(false);
    onClose();
  };

  const handleClearChatHistory = async () => {
    setConfirmClearVisible(false);
    setClearingChatHistory(true);
    await clearChatHistory();
    setClearingChatHistory(false);
    successHaptic();
    onHistoryCleared?.();
    showFeedback(
      'Historique effacé',
      'Les conversations avec Fyn ont été supprimées de cet appareil.',
      'success',
    );
  };

  const handleOpenFullSettings = () => {
    tapHaptic();
    setActiveDetail(null);
    onClose();
    router.push('/settings');
  };

  const handleApiKeyPress = () => {
    tapHaptic();
    setActiveDetail('apiKey');
  };

  const quotaRemaining = aiQuotaState
    ? Math.max(0, aiQuotaState.monthlyLimit - aiQuotaState.messagesThisMonth)
    : 0;

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <View style={[styles.backdrop, { backgroundColor: backdropColor }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityLabel="Fermer"
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.containerBackground,
                borderColor: colors.containerBorder,
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />

            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={[styles.title, { color: colors.text }]}>Paramètres Fyn</Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  Conseiller IA et préférences locales
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={handleClose}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <SurfaceCard padding={0} innerStyle={styles.cardInner}>
                <SettingsNavigationRow
                  label="Mode de données"
                  hint="Plaid ou saisie manuelle"
                  icon="analytics-outline"
                  value={aiDataModeLabel}
                  onPress={() => {
                    tapHaptic();
                    setActiveDetail('dataMode');
                  }}
                />
                <SettingsNavigationRow
                  label="Quota mensuel"
                  hint="Messages envoyés ce mois"
                  icon="chatbubble-ellipses-outline"
                  value={aiQuotaLabel}
                  onPress={() => {
                    tapHaptic();
                    if (aiQuotaState) {
                      setActiveDetail('quota');
                    }
                  }}
                />
                <SettingsNavigationRow
                  label="Clé API Anthropic"
                  hint="Requise pour le chat complet"
                  icon="key-outline"
                  value={anthropicApiKeyConfigured ? 'Active' : 'Absente'}
                  onPress={handleApiKeyPress}
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
                  label="Effacer l'historique"
                  hint="Supprime les conversations locales"
                  icon="trash-outline"
                  destructive
                  value={clearingChatHistory ? 'Effacement…' : undefined}
                  onPress={() => {
                    if (clearingChatHistory) return;
                    tapHaptic();
                    setConfirmClearVisible(true);
                  }}
                />
                <SettingsNavigationRow
                  label="Ouvrir les Réglages"
                  hint="Section Fyn dans l'application"
                  icon="settings-outline"
                  onPress={handleOpenFullSettings}
                  isLast
                />
              </SurfaceCard>
            </ScrollView>
          </View>

          <AIChatSettingDetailSheet
            embedded
            visible={activeDetail === 'dataMode'}
            title="Mode de données"
            subtitle="Lecture seule — dérivé de ta connexion"
            icon="analytics-outline"
            variant="info"
            value={aiDataModeLabel}
            message="Ce mode est déterminé automatiquement selon ta connexion cloud. Avec un compte connecté (Plaid), Fyn analyse les transactions synchronisées. Sinon, il s'appuie sur ta saisie manuelle."
            secondaryAction={{
              label: 'Ouvrir les Réglages',
              onPress: handleOpenFullSettings,
            }}
            onClose={() => setActiveDetail(null)}
          />

          <AIChatSettingDetailSheet
            embedded
            visible={activeDetail === 'quota'}
            title="Quota mensuel"
            subtitle="Suivi local sur cet appareil"
            icon="chatbubble-ellipses-outline"
            variant="info"
            value={aiQuotaLabel}
            message="Le quota limite le nombre de messages envoyés à Fyn chaque mois. Le compteur se réinitialise au début du mois."
            onClose={() => setActiveDetail(null)}
          >
            {aiQuotaState ? (
              <View style={styles.quotaStats}>
                <QuotaStatRow
                  label="Messages utilisés"
                  value={`${aiQuotaState.messagesThisMonth}`}
                  colors={colors}
                />
                <QuotaStatRow
                  label="Limite mensuelle"
                  value={`${aiQuotaState.monthlyLimit}`}
                  colors={colors}
                />
                <QuotaStatRow
                  label="Restants"
                  value={`${quotaRemaining}`}
                  colors={colors}
                  highlight={aiQuotaState.warningThresholdReached}
                />
                <QuotaStatRow
                  label="Tokens estimés"
                  value={`${aiQuotaState.tokensUsedEstimate}`}
                  colors={colors}
                />
              </View>
            ) : null}
          </AIChatSettingDetailSheet>

          <AIChatSettingDetailSheet
            embedded
            visible={activeDetail === 'apiKey'}
            title={anthropicApiKeyConfigured ? 'Clé Anthropic active' : 'Clé Anthropic absente'}
            subtitle="Configuration via fichier .env"
            icon="key-outline"
            variant={anthropicApiKeyConfigured ? 'success' : 'warning'}
            value={anthropicApiKeyConfigured ? 'Active' : 'Absente'}
            message={
              anthropicApiKeyConfigured
                ? 'La clé Anthropic est chargée. Si le chat reste en mode démo, redémarre Expo avec le cache vidé : npx expo start -c'
                : "1. Copie apps/mobile/.env.example vers apps/mobile/.env\n2. Colle ta clé dans EXPO_PUBLIC_ANTHROPIC_API_KEY=\n3. Redémarre Expo : npx expo start -c\n\nSans .env, l'app reste en mode démo."
            }
            primaryAction={
              !anthropicApiKeyConfigured
                ? {
                    label: 'Ouvrir les Réglages',
                    icon: 'settings-outline',
                    onPress: handleOpenFullSettings,
                  }
                : undefined
            }
            onClose={() => setActiveDetail(null)}
          />

          <ConfirmDeleteModal
            embedded
            visible={confirmClearVisible}
            title="Effacer l'historique ?"
            message="Les conversations avec Fyn seront supprimées de cet appareil. Cette action est irréversible."
            confirmLabel="Effacer"
            onConfirm={() => void handleClearChatHistory()}
            onCancel={() => setConfirmClearVisible(false)}
          />
        </View>
      </Modal>

      <ThemedConfirmModal
        visible={feedbackVisible}
        title={feedbackTitle}
        message={feedbackMessage}
        variant={feedbackVariant}
        confirmLabel="OK"
        onConfirm={() => setFeedbackVisible(false)}
        onCancel={() => setFeedbackVisible(false)}
      />
    </>
  );
}

function QuotaStatRow({
  label,
  value,
  colors,
  highlight = false,
}: {
  label: string;
  value: string;
  colors: AppColors;
  highlight?: boolean;
}) {
  return (
    <View style={[quotaStatStyles.row, { borderColor: colors.border }]}>
      <Text style={[quotaStatStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          quotaStatStyles.value,
          { color: highlight ? colors.warning : colors.text },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const quotaStatStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  label: {
    ...interMediumText,
    fontSize: typography.micro,
  },
  value: {
    ...interBoldText,
    fontSize: typography.caption,
  },
});

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      borderTopLeftRadius: radius.card + 4,
      borderTopRightRadius: radius.card + 4,
      borderWidth: StyleSheet.hairlineWidth,
      maxHeight: Platform.OS === 'web' ? '85%' : '72%',
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: radius.pill,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.md,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      ...interBoldText,
      fontSize: typography.body,
    },
    subtitle: {
      ...interMediumText,
      fontSize: typography.micro,
      lineHeight: typography.micro + 4,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      flexGrow: 0,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    cardInner: {
      overflow: 'hidden',
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
    quotaStats: {
      alignSelf: 'stretch',
    },
    pressed: {
      opacity: 0.82,
    },
  });
}
