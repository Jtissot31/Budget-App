import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DraggableSheetSurface } from '@/components/DraggableSheetSurface';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import {
  jakartaBoldText,
  jakartaMediumText,
  jakartaRegularText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { clearChatHistory, getChatQuotaState, getDataModeLabel } from '@/lib/ai/chatService';
import type { ChatQuotaState } from '@/lib/ai/types';
import {
  getGeminiApiKeySource,
  isFynChatApiKeyConfigured,
  isGeminiApiKeyConfigured,
} from '@/lib/ai/env';
import { hydrateUserApiKeys } from '@/lib/ai/userApiKeys';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { useAIChatColors } from './theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onHistoryCleared?: () => void;
};

function shortenDataModeLabel(label: string): string {
  if (label.toLowerCase().includes('plaid')) return 'Plaid';
  return 'Manuel';
}

export function AIChatSettingsSheet({ visible, onClose, onHistoryCleared }: Props) {
  const router = useRouter();
  const palette = useAIChatColors();
  const { colors, isLight } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * (Platform.OS === 'web' ? 0.7 : 0.52));

  const [dataModeLabel, setDataModeLabel] = useState('Manuel');
  const [quotaState, setQuotaState] = useState<ChatQuotaState | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [confirmClearVisible, setConfirmClearVisible] = useState(false);

  const backdropColor = useMemo(
    () => (isLight ? 'rgba(25, 22, 18, 0.28)' : 'rgba(0, 0, 0, 0.58)'),
    [isLight],
  );

  const loadSettings = useCallback(async () => {
    await hydrateUserApiKeys();
    const [modeLabel, quota] = await Promise.all([getDataModeLabel(), getChatQuotaState()]);
    setDataModeLabel(shortenDataModeLabel(modeLabel));
    setQuotaState(quota);
  }, []);

  useEffect(() => {
    if (!visible) {
      setConfirmClearVisible(false);
      return;
    }
    void loadSettings();
  }, [visible, loadSettings]);

  const handleClose = () => {
    tapHaptic();
    setConfirmClearVisible(false);
    onClose();
  };

  const handleClearHistory = async () => {
    setConfirmClearVisible(false);
    setClearingHistory(true);
    await clearChatHistory();
    setClearingHistory(false);
    successHaptic();
    onHistoryCleared?.();
    onClose();
  };

  const handleOpenSettings = () => {
    tapHaptic();
    onClose();
    router.push('/settings');
  };

  const quotaProgress =
    quotaState && quotaState.monthlyLimit > 0
      ? Math.min(1, quotaState.messagesThisMonth / quotaState.monthlyLimit)
      : 0;

  const quotaRemaining =
    quotaState && quotaState.monthlyLimit > 0
      ? Math.max(0, quotaState.monthlyLimit - quotaState.messagesThisMonth)
      : null;

  const quotaNearLimit = quotaState?.warningThresholdReached ?? false;
  const geminiConfigured = isGeminiApiKeyConfigured();
  const fynActive = isFynChatApiKeyConfigured();
  const geminiSource = getGeminiApiKeySource();

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[styles.backdrop, { backgroundColor: backdropColor }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Fermer" />

            <DraggableSheetSurface
              onClose={handleClose}
              sheetHeight={sheetHeight}
              style={[
                styles.sheet,
                {
                  backgroundColor: palette.aiBubble,
                  borderColor: palette.border,
                  paddingBottom: Math.max(insets.bottom, spacing.lg),
                },
              ]}
            >
            <View style={[styles.handle, { backgroundColor: palette.border }]} />

            <View style={styles.header}>
              <Text style={[styles.title, { color: palette.text }, jakartaBoldText]}>Paramètres</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fermer"
                onPress={handleClose}
                hitSlop={12}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              >
                <AppIcon family="ionicons" name="close" size={22} color={palette.textMuted} />
              </Pressable>
            </View>

            <View style={styles.body}>
              <View style={[styles.statusCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: fynActive ? palette.primary : palette.textMuted },
                    ]}
                  />
                  <Text style={[styles.statusTitle, { color: palette.text }, jakartaMediumText]}>
                    {fynActive ? (geminiConfigured ? 'Fyn actif (Gemini)' : 'Fyn actif (Anthropic)') : 'Fyn inactif'}
                  </Text>
                </View>

                {!fynActive ? (
                  <Text style={[styles.statusHint, { color: palette.textMuted }, jakartaRegularText]}>
                    Ajoute une clé Gemini ou Claude dans Réglages → Fyn pour chatter sans serveur.
                  </Text>
                ) : geminiConfigured && geminiSource === 'user' ? (
                  <Text style={[styles.statusHint, { color: palette.textMuted }, jakartaRegularText]}>
                    Clé Gemini personnelle — appels directs depuis l’appareil.
                  </Text>
                ) : null}

                {quotaState && quotaState.messagesThisMonth > 0 ? (
                  <View style={styles.quotaBlock}>
                    <View style={styles.quotaHeader}>
                      <Text style={[styles.quotaLabel, { color: palette.textMuted }, jakartaRegularText]}>
                        Messages ce mois
                      </Text>
                      <Text
                        style={[
                          styles.quotaValue,
                          { color: palette.text },
                          jakartaMediumText,
                        ]}
                      >
                        {quotaState.messagesThisMonth}
                      </Text>
                    </View>
                    {quotaState.monthlyLimit > 0 ? (
                      <>
                        <View style={[styles.quotaTrack, { backgroundColor: palette.border }]}>
                          <View
                            style={[
                              styles.quotaFill,
                              {
                                backgroundColor: quotaNearLimit ? palette.primary : palette.primary,
                                width: `${Math.max(quotaProgress * 100, quotaState.messagesThisMonth > 0 ? 4 : 0)}%`,
                                opacity: quotaNearLimit ? 1 : 0.85,
                              },
                            ]}
                          />
                        </View>
                        {quotaRemaining != null ? (
                          <Text style={[styles.quotaFootnote, { color: palette.textMuted }, jakartaRegularText]}>
                            {quotaRemaining} restant{quotaRemaining > 1 ? 's' : ''}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                ) : null}

                <Text style={[styles.metaLine, { color: palette.textMuted }, jakartaRegularText]}>
                  Données · {dataModeLabel}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Effacer l'historique"
                disabled={clearingHistory}
                onPress={() => {
                  if (clearingHistory) return;
                  tapHaptic();
                  setConfirmClearVisible(true);
                }}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && !clearingHistory && styles.pressed,
                  clearingHistory && styles.disabled,
                ]}
              >
                <Text style={[styles.actionLabel, { color: colors.danger }, jakartaMediumText]}>
                  {clearingHistory ? 'Effacement…' : 'Effacer l\'historique'}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ouvrir les réglages Fyn"
                onPress={handleOpenSettings}
                style={({ pressed }) => [styles.settingsLink, pressed && styles.pressed]}
              >
                <Text style={[styles.settingsLinkText, { color: palette.textMuted }, jakartaRegularText]}>
                  Configuration complète dans Réglages
                </Text>
                <AppIcon family="ionicons" name="chevron-forward" size={16} color={palette.textMuted} />
              </Pressable>
            </View>
            </DraggableSheetSurface>

          <ConfirmDeleteModal
            embedded
            visible={confirmClearVisible}
            title="Effacer l'historique ?"
            message="Les conversations seront supprimées de cet appareil."
            confirmLabel="Effacer"
            onConfirm={() => void handleClearHistory()}
            onCancel={() => setConfirmClearVisible(false)}
          />
        </View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.card + 6,
    borderTopRightRadius: radius.card + 6,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: Platform.OS === 'web' ? '70%' : '52%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.body,
  },
  closeButton: {
    padding: spacing.xs,
  },
  body: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  statusCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusTitle: {
    fontSize: typography.caption,
  },
  statusHint: {
    fontSize: typography.micro,
    lineHeight: typography.micro + 4,
    marginTop: -spacing.xs,
  },
  quotaBlock: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  quotaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  quotaLabel: {
    fontSize: typography.micro,
  },
  quotaValue: {
    fontSize: typography.micro,
    fontVariant: ['tabular-nums'],
  },
  quotaTrack: {
    height: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  quotaFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  quotaFootnote: {
    fontSize: typography.micro,
  },
  metaLine: {
    fontSize: typography.micro,
    marginTop: spacing.xs,
  },
  actionRow: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  actionLabel: {
    fontSize: typography.caption,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  settingsLinkText: {
    fontSize: typography.micro,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.5,
  },
});
