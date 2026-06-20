import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getFloatingTabBarOverlayInset,
  interRegularText,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAIChatColors } from '@/components/ai-chat/theme';
import {
  executeChatAction,
  getChatQuotaState,
  loadChatHistory,
  saveChatHistory,
  sendChatMessage,
} from '@/lib/ai/chatService';
import {
  alertCardToAssistantContent,
  buildActionResultAlertCard,
  isTextConfirmation,
} from '@/lib/ai/actionConfirmation';
import { getActivityPhaseLabel, type ActivityPhase } from '@/lib/ai/activityPhases';
import { isAnthropicApiKeyConfigured } from '@/lib/ai/env';
import { readChatImageAttachment } from '@/lib/ai/imageAttachment';
import { captureReceiptPhoto, pickReceiptFromGallery } from '@/lib/receiptCapture';
import { AIChatActivityIndicator } from './AIChatActivityIndicator';
import { AIChatHeader } from './AIChatHeader';
import { AIChatMessage } from './AIChatMessage';
import { AIChatSettingsSheet } from './AIChatSettingsSheet';
import { AIChatMultimodalInput } from './AIChatMultimodalInput';
import { AIChatProjectionWidget } from './AIChatProjectionWidget';
import {
  aiMessageToUiMessage,
  appendAlertCardToMessage,
  createOptimisticUserMessage,
  findPendingActionMessage,
  updateMessageAction,
} from './adapters';
import { AI_QUICK_CHIPS, buildDemoMessages, type AIChatUiMessage } from './types';

type ListItem =
  | { kind: 'message'; message: AIChatUiMessage }
  | { kind: 'projection'; projection: NonNullable<AIChatUiMessage['projection']>; id: string };

type ActivityState = {
  currentPhase: ActivityPhase | null;
  completedPhases: ActivityPhase[];
};

const INITIAL_ACTIVITY_STATE: ActivityState = {
  currentPhase: null,
  completedPhases: [],
};

/** Conservative heights until `onLayout` measures the floating input overlay. */
const CHAT_INPUT_ROW_ESTIMATED_HEIGHT = 96;
const CHAT_QUICK_CHIPS_ESTIMATED_HEIGHT = 64;
const CHAT_ACTIVITY_INDICATOR_ESTIMATED_HEIGHT = 96;
const LIST_BOTTOM_CLEARANCE_GAP = spacing.xl;

function toListItems(messages: AIChatUiMessage[]): ListItem[] {
  const items: ListItem[] = [];

  for (const message of messages) {
    items.push({ kind: 'message', message });
    if (message.projection) {
      items.push({
        kind: 'projection',
        projection: message.projection,
        id: `${message.id}-projection`,
      });
    }
  }

  return items;
}

export function AIChatAdvisorScreen({ tabBarVisible = true }: { tabBarVisible?: boolean }) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputOverlayHeight, setInputOverlayHeight] = useState(0);
  const palette = useAIChatColors();
  const listRef = useRef<FlatList<ListItem>>(null);
  const requestRef = useRef(0);
  const pendingInstantBottomScrollRef = useRef(false);
  const layoutScrollPendingRef = useRef(false);
  const prevEstimatedOverlayHeightRef = useRef(0);
  const scrollTargetRef = useRef<{ kind: 'end' } | null>(null);
  const [scrollRequestId, setScrollRequestId] = useState(0);

  const [messages, setMessages] = useState<AIChatUiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [activityState, setActivityState] = useState<ActivityState | null>(null);
  const [offlineMode, setOfflineMode] = useState(() => !isAnthropicApiKeyConfigured());
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [usingDemoSeed, setUsingDemoSeed] = useState(false);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const handleKeyboardDismiss = useCallback(() => {
    setKeyboardVisible(false);
  }, []);

  useEffect(() => {
    const handleShow = () => setKeyboardVisible(true);
    const handleHide = () => setKeyboardVisible(false);

    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', handleShow),
            Keyboard.addListener('keyboardWillHide', handleHide),
            Keyboard.addListener('keyboardDidHide', handleHide),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', handleShow),
            Keyboard.addListener('keyboardDidHide', handleHide),
          ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
    };
  }, []);

  const chatInputBottomInset = getFloatingTabBarOverlayInset(insets.bottom, {
    keyboardVisible,
    tabBarVisible,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [history, quota] = await Promise.all([loadChatHistory(), getChatQuotaState()]);
      if (cancelled) return;

      if (history.length > 0) {
        setMessages(history.map(aiMessageToUiMessage));
        setUsingDemoSeed(false);
        setHasUserSentMessage(true);
      } else {
        setMessages(buildDemoMessages());
        setUsingDemoSeed(true);
        setHasUserSentMessage(false);
      }

      setQuotaWarning(
        quota.warningThresholdReached ? 'Tu approches ta limite mensuelle de conversations.' : null,
      );
      setOfflineMode(!isAnthropicApiKeyConfigured());
      setHistoryLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const runScrollToEndAfterLayout = useCallback((animated: boolean) => {
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          listRef.current?.scrollToEnd({ animated });
        });
      });
    });
  }, []);

  const requestInstantScrollToBottom = useCallback(() => {
    pendingInstantBottomScrollRef.current = true;
  }, []);

  const queueScrollToEnd = useCallback(() => {
    scrollTargetRef.current = { kind: 'end' };
    setScrollRequestId((id) => id + 1);
  }, []);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: Math.max(info.averageItemLength * info.index, 0),
        animated: false,
      });
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0,
          viewOffset: spacing.md,
        });
      });
    },
    [],
  );

  const sendMessage = useCallback(
    async (rawText?: string, imageUriOverride?: string | null) => {
      const imageUri = imageUriOverride ?? pendingImageUri;
      const baseText = (rawText ?? input).trim();
      const text =
        baseText ||
        (imageUri ? '[Facture jointe] Analyse cette facture et propose une transaction.' : '');
      if (!text || isResponding) return;

      const pendingUiAction = isTextConfirmation(text) ? findPendingActionMessage(messages) : null;

      tapHaptic();
      setInput('');
      setPendingImageUri(null);
      Keyboard.dismiss();
      setKeyboardVisible(false);

      const optimisticUser = createOptimisticUserMessage(text, imageUri ?? undefined);
      setMessages((prev) => {
        const base = usingDemoSeed ? [] : prev;
        return [...base, optimisticUser];
      });
      setUsingDemoSeed(false);
      setHasUserSentMessage(true);
      setIsResponding(true);
      setActivityState(INITIAL_ACTIVITY_STATE);
      queueScrollToEnd();

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;

      const handleActivity = (phase: ActivityPhase) => {
        if (requestRef.current !== requestId) return;
        setActivityState((prev) => {
          const base = prev ?? INITIAL_ACTIVITY_STATE;
          return {
            currentPhase: phase,
            completedPhases: base.currentPhase
              ? [...base.completedPhases, base.currentPhase]
              : base.completedPhases,
          };
        });
        queueScrollToEnd();
      };

      const applyTextConfirmationUiUpdate = (
        prev: AIChatUiMessage[],
        pending: NonNullable<typeof pendingUiAction>,
        alertSeverity: 'success' | 'danger',
      ) =>
        prev.map((message) =>
          message.id === pending.messageId
            ? updateMessageAction(message, pending.actionKey, {
                status: alertSeverity === 'success' ? 'success' : 'error',
              })
            : message,
        );

      try {
        if (pendingUiAction) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === pendingUiAction.messageId
                ? updateMessageAction(message, pendingUiAction.actionKey, { status: 'executing' })
                : message,
            ),
          );

          const result = await executeChatAction(pendingUiAction.action);
          if (requestRef.current !== requestId) return;

          const alertCard = buildActionResultAlertCard(result, pendingUiAction.action);
          const now = new Date().toISOString();
          const persistedUserMessage = {
            id: optimisticUser.id,
            role: 'user' as const,
            content: text,
            createdAt: now,
            imageUri: imageUri ?? undefined,
          };
          const persistedAssistantMessage = {
            id: `assistant-confirm-${Date.now()}`,
            role: 'assistant' as const,
            content: alertCardToAssistantContent(alertCard),
            createdAt: now,
          };

          if (!usingDemoSeed) {
            const history = await loadChatHistory();
            await saveChatHistory([...history, persistedUserMessage, persistedAssistantMessage]);
          }

          const assistantUiMessage = aiMessageToUiMessage(persistedAssistantMessage);

          setMessages((prev) => {
            const withoutOptimistic = prev.filter((message) => message.id !== optimisticUser.id);
            const withConfirmedAction = applyTextConfirmationUiUpdate(
              withoutOptimistic,
              pendingUiAction,
              alertCard.severity === 'success' ? 'success' : 'danger',
            );
            return [
              ...withConfirmedAction,
              aiMessageToUiMessage(persistedUserMessage),
              assistantUiMessage,
            ];
          });
          queueScrollToEnd();
          return;
        }

        let imageAttachment;
        if (imageUri && isAnthropicApiKeyConfigured()) {
          try {
            imageAttachment = await readChatImageAttachment(imageUri);
          } catch {
            // Vision indisponible — le texte seul sera envoyé.
          }
        }

        const result = await sendChatMessage(text, {
          image: imageAttachment,
          imageUri: imageUri ?? undefined,
          onActivity: handleActivity,
        });
        if (requestRef.current !== requestId) return;

        setOfflineMode(result.offlineMode);
        setQuotaWarning(
          result.quota.warningThresholdReached
            ? 'Tu approches ta limite mensuelle de conversations.'
            : null,
        );

        const assistantUiMessage = aiMessageToUiMessage(result.assistantMessage);

        setMessages((prev) => {
          const withoutOptimistic = prev.filter((message) => message.id !== optimisticUser.id);
          return [
            ...withoutOptimistic,
            aiMessageToUiMessage(result.userMessage),
            assistantUiMessage,
          ];
        });
        queueScrollToEnd();
      } catch {
        if (requestRef.current !== requestId) return;

        const errorAssistantId = `assistant-error-${Date.now()}`;
        setMessages((prev) => [
          ...prev.filter((message) => message.id !== optimisticUser.id),
          optimisticUser,
          {
            id: errorAssistantId,
            role: 'assistant',
            text: "Impossible d'envoyer le message pour le moment. Réessaie dans un instant.",
            createdAt: Date.now(),
          },
        ]);
        queueScrollToEnd();
      } finally {
        if (requestRef.current === requestId) {
          setIsResponding(false);
          setActivityState(null);
        }
      }
    },
    [
      input,
      isResponding,
      messages,
      pendingImageUri,
      queueScrollToEnd,
      usingDemoSeed,
    ],
  );

  const handleConfirmAction = useCallback(async (messageId: string, actionKey: string) => {
    const targetMessage = messages.find((message) => message.id === messageId);
    const targetAction = targetMessage?.actions?.find((action) => action.actionKey === actionKey);
    if (!targetAction || targetAction.status !== 'pending') return;

    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? updateMessageAction(message, actionKey, { status: 'executing' })
          : message,
      ),
    );

    const result = await executeChatAction(targetAction);
    const alertCard = buildActionResultAlertCard(result, targetAction);

    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== messageId) return message;
        const withAction = updateMessageAction(message, actionKey, {
          status: result.ok ? 'success' : 'error',
        });
        return appendAlertCardToMessage(withAction, alertCard);
      }),
    );
    queueScrollToEnd();
  }, [messages, queueScrollToEnd]);

  const handleCancelAction = useCallback((messageId: string, actionKey: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? updateMessageAction(message, actionKey, { status: 'cancelled' })
          : message,
      ),
    );
  }, []);

  const handlePickImage = useCallback(async (source: 'gallery' | 'camera') => {
    try {
      const picked =
        source === 'gallery' ? await pickReceiptFromGallery() : await captureReceiptPhoto();
      if (picked.cancelled || !picked.uri) return;
      setPendingImageUri(picked.uri);
      if (!input.trim()) {
        setInput('[Facture jointe]');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de sélectionner l\'image.';
      Alert.alert('Image', message);
    }
  }, [input]);

  const handleChipPress = useCallback(
    (message: string) => {
      void sendMessage(message);
    },
    [sendMessage],
  );

  const handleHistoryCleared = useCallback(() => {
    setMessages([]);
    setUsingDemoSeed(false);
    setHasUserSentMessage(false);
    setQuotaWarning(null);
  }, []);

  const listData = useMemo(() => toListItems(messages), [messages]);
  const showQuickChips = !hasUserSentMessage && (messages.length === 0 || usingDemoSeed);
  const estimatedInputOverlayHeight =
    (showQuickChips ? CHAT_QUICK_CHIPS_ESTIMATED_HEIGHT : 0) +
    CHAT_INPUT_ROW_ESTIMATED_HEIGHT +
    (isResponding ? CHAT_ACTIVITY_INDICATOR_ESTIMATED_HEIGHT : 0) +
    chatInputBottomInset;
  const listBottomPadding =
    Math.max(inputOverlayHeight, estimatedInputOverlayHeight) +
    LIST_BOTTOM_CLEARANCE_GAP +
    insets.bottom;

  const handleChatScrollBeginDrag = useCallback(() => {
    Keyboard.dismiss();
    handleKeyboardDismiss();
  }, [handleKeyboardDismiss]);

  const handleInputOverlayLayout = useCallback((event: LayoutChangeEvent) => {
    const height = Math.round(event.nativeEvent.layout.height);
    setInputOverlayHeight((prev) => {
      if (prev === height) return prev;
      layoutScrollPendingRef.current = true;
      return height;
    });
  }, []);

  const handleListContentSizeChange = useCallback(() => {
    if (scrollTargetRef.current?.kind === 'end' || isResponding) {
      queueScrollToEnd();
    }
  }, [isResponding, queueScrollToEnd]);

  const headerStatusLabel = activityState?.currentPhase
    ? getActivityPhaseLabel(activityState.currentPhase)
    : isResponding
      ? 'Réflexion…'
      : 'En ligne';

  useFocusEffect(
    useCallback(() => {
      if (!historyLoaded) return;
      requestInstantScrollToBottom();
    }, [historyLoaded, requestInstantScrollToBottom]),
  );

  useEffect(() => {
    if (!historyLoaded) return;
    requestInstantScrollToBottom();
  }, [historyLoaded, requestInstantScrollToBottom]);

  useEffect(() => {
    if (!historyLoaded) return;

    const estimatedChanged =
      prevEstimatedOverlayHeightRef.current !== estimatedInputOverlayHeight;
    prevEstimatedOverlayHeightRef.current = estimatedInputOverlayHeight;

    const needsInstantScroll = pendingInstantBottomScrollRef.current;
    const needsLayoutScroll = layoutScrollPendingRef.current;
    if (!needsInstantScroll && !needsLayoutScroll && !estimatedChanged) return;

    if (needsLayoutScroll) {
      layoutScrollPendingRef.current = false;
    }

    runScrollToEndAfterLayout(false);

    if (!needsInstantScroll) return;

    const settleTimeout = setTimeout(() => {
      if (!pendingInstantBottomScrollRef.current) return;
      runScrollToEndAfterLayout(false);
      pendingInstantBottomScrollRef.current = false;
    }, 100);

    return () => clearTimeout(settleTimeout);
  }, [
    historyLoaded,
    estimatedInputOverlayHeight,
    inputOverlayHeight,
    messages.length,
    runScrollToEndAfterLayout,
  ]);

  useEffect(() => {
    const target = scrollTargetRef.current;
    if (!target) return;
    scrollTargetRef.current = null;

    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [listData, scrollRequestId]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['left', 'right']}>
      <AIChatHeader
        status={isResponding ? 'thinking' : 'online'}
        statusLabel={headerStatusLabel}
        topInset={insets.top}
        onMenuPress={() => setSettingsVisible(true)}
      />

      <AIChatSettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onHistoryCleared={handleHistoryCleared}
      />

      {offlineMode ? (
        <View style={[styles.banner, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.bannerText, { color: palette.text }, interRegularText]}>
            Clé API : absente — copie .env.example vers .env, ajoute EXPO_PUBLIC_ANTHROPIC_API_KEY, puis redémarre Expo (npx expo start -c).
          </Text>
        </View>
      ) : null}

      {quotaWarning ? (
        <View style={[styles.banner, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.bannerText, { color: palette.textMuted }, interRegularText]}>{quotaWarning}</Text>
        </View>
      ) : null}

      {pendingImageUri ? (
        <View style={[styles.banner, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.bannerText, { color: palette.textMuted }, interRegularText]}>
            Facture prête à envoyer — ajoute un message ou appuie sur Envoyer.
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled={keyboardVisible}
        keyboardVerticalOffset={0}
      >
        <View style={styles.chatBody}>
          <FlatList
            ref={listRef}
            data={listData}
            style={styles.list}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: listBottomPadding },
              listData.length > 0 && styles.listContentGrow,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            removeClippedSubviews={Platform.OS === 'android'}
            onContentSizeChange={handleListContentSizeChange}
            onScrollBeginDrag={handleChatScrollBeginDrag}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            keyExtractor={(item) =>
              item.kind === 'projection' ? item.id : item.message.id
            }
            renderItem={({ item }) => {
              if (item.kind === 'projection') {
                return <AIChatProjectionWidget projection={item.projection} />;
              }
              return (
                <AIChatMessage
                  message={item.message}
                  actionsDisabled={isResponding}
                  onConfirmAction={(messageId, actionKey) => void handleConfirmAction(messageId, actionKey)}
                  onCancelAction={handleCancelAction}
                />
              );
            }}
          />

          <View
            style={styles.inputOverlay}
            pointerEvents="box-none"
            onLayout={handleInputOverlayLayout}
          >
            {isResponding ? (
              <View style={styles.activityAboveInput}>
                <AIChatActivityIndicator
                  currentPhase={activityState?.currentPhase ?? null}
                  completedPhases={activityState?.completedPhases ?? []}
                />
              </View>
            ) : null}

            <AIChatMultimodalInput
              value={input}
              onChangeText={setInput}
              onSend={(text) => void sendMessage(text)}
              onAttach={() => void handlePickImage('gallery')}
              onCamera={() => void handlePickImage('camera')}
              onChipPress={handleChipPress}
              onInputBlur={handleKeyboardDismiss}
              chips={showQuickChips ? AI_QUICK_CHIPS : []}
              disabled={isResponding || !historyLoaded}
              bottomInset={chatInputBottomInset}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatBody: {
    flex: 1,
    position: 'relative',
  },
  list: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  listContent: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: spacing.md,
  },
  listContentGrow: {
    flexGrow: 1,
  },
  inputOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  banner: {
    marginHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerText: {
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
    textAlign: 'center',
  },
  activityAboveInput: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingTop: spacing.xs,
  },
});
