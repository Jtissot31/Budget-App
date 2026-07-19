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
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getFloatingTabBarOverlayInset,
  jakartaRegularText,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { isAbortError } from '@/lib/abortError';
import { useAIChatColors } from '@/components/ai-chat/theme';
import {
  executeChatAction,
  loadChatHistory,
  saveChatHistory,
  sendChatMessage,
  warmChatContext,
} from '@/lib/ai/chatService';
import {
  buildActionResultAlertCard,
  isTextConfirmation,
} from '@/lib/ai/actionConfirmation';
import { getActivityPhaseLabel, type ActivityPhase } from '@/lib/ai/activityPhases';
import { isGeminiApiKeyConfigured } from '@/lib/ai/env';
import { buildStreamingAssistantDisplay } from '@/lib/ai/messageBlocks';
import { buildPlanCreateParamsFromSuggestion } from '@/lib/plans/planCreateNavigation';
import { consumePendingPlanChatConfirmation } from '@/lib/plans/pendingPlanChatConfirmation';
import { buildPlansCreatedConfirmation } from '@/lib/plans/planRecommendationEngine';
import type { PlanGoal } from '@/lib/plans/planGoalClarification';
import { uiEvents } from '@/lib/events';
import { captureReceiptPhoto, pickReceiptFromGallery } from '@/lib/receiptCapture';
import { AIChatActivityIndicator } from './AIChatActivityIndicator';
import { AIChatHeader } from './AIChatHeader';
import { AIChatMessage } from './AIChatMessage';
import { AIChatSettingsSheet } from './AIChatSettingsSheet';
import { AIChatMultimodalInput } from './AIChatMultimodalInput';
import { AIChatQuickChips } from './AIChatQuickChips';
import { AIChatProjectionWidget } from './AIChatProjectionWidget';
import {
  aiMessageToUiMessage,
  appendAlertCardToMessage,
  createOptimisticUserMessage,
  findPendingActionMessage,
  updateMessageAction,
} from './adapters';
import type { PlanSuggere } from '@/lib/plans/Plan';
import { AI_QUICK_CHIPS, type AIChatUiMessage } from './types';

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

export function AIChatAdvisorScreen({
  tabBarVisible = true,
  showBackButton = true,
}: {
  tabBarVisible?: boolean;
  showBackButton?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [inputOverlayHeight, setInputOverlayHeight] = useState(0);
  const palette = useAIChatColors();
  const listRef = useRef<FlatList<ListItem>>(null);
  const requestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingInstantBottomScrollRef = useRef(false);
  const layoutScrollPendingRef = useRef(false);
  const prevEstimatedOverlayHeightRef = useRef(0);
  const scrollTargetRef = useRef<{ kind: 'end' } | null>(null);
  const [scrollRequestId, setScrollRequestId] = useState(0);

  const [messages, setMessages] = useState<AIChatUiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [activityState, setActivityState] = useState<ActivityState | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
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
      const [history] = await Promise.all([loadChatHistory(), warmChatContext()]);
      if (cancelled) return;

      if (history.length > 0) {
        setMessages(history.map(aiMessageToUiMessage));
        setHasUserSentMessage(true);
      } else {
        setMessages([]);
        setHasUserSentMessage(false);
      }

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

  const finalizeInterruptedMessages = useCallback((prev: AIChatUiMessage[]) => {
    const withoutEmptyStreaming = prev
      .map((message) => (message.streaming ? { ...message, streaming: false } : message))
      .filter((message) => {
        if (message.role !== 'assistant') return true;
        const hasContent =
          Boolean(message.text?.trim()) ||
          Boolean(message.blocks?.length) ||
          Boolean(message.actions?.length) ||
          Boolean(message.planSuggestions) ||
          Boolean(message.planGoalChoice);
        return hasContent;
      });
    return withoutEmptyStreaming;
  }, []);

  const handleStopGeneration = useCallback(() => {
    if (!isResponding) return;

    tapHaptic();
    requestRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    setMessages(finalizeInterruptedMessages);
    setIsResponding(false);
    setActivityState(null);
  }, [finalizeInterruptedMessages, isResponding]);

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
      setMessages((prev) => [...prev, optimisticUser]);
      setHasUserSentMessage(true);
      setIsResponding(true);
      setActivityState(INITIAL_ACTIVITY_STATE);
      queueScrollToEnd();

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const streamMessageId = `assistant-stream-${Date.now()}`;
      const useStreaming = isGeminiApiKeyConfigured();

      if (useStreaming) {
        setMessages((prev) => [
          ...prev,
          {
            id: streamMessageId,
            role: 'assistant',
            text: '',
            createdAt: Date.now(),
            streaming: true,
          },
        ]);
        queueScrollToEnd();
      }

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
            content: alertCard.message,
            blocks: [alertCard],
            createdAt: now,
          };

          const history = await loadChatHistory();
          await saveChatHistory([...history, persistedUserMessage, persistedAssistantMessage]);

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

        const result = await sendChatMessage(text, {
          imageUri: imageUri ?? undefined,
          onActivity: handleActivity,
          signal: abortController.signal,
          onToken: useStreaming
            ? (partial) => {
                if (requestRef.current !== requestId) return;
                const { text, blocks } = buildStreamingAssistantDisplay(partial);
                setMessages((prev) =>
                  prev.map((message) =>
                    message.id === streamMessageId
                      ? { ...message, text, blocks, streaming: true }
                      : message,
                  ),
                );
                queueScrollToEnd();
              }
            : undefined,
        });
        if (requestRef.current !== requestId) return;

        const assistantUiMessage = aiMessageToUiMessage(result.assistantMessage);

        setMessages((prev) => {
          const withoutOptimistic = prev.filter(
            (message) => message.id !== optimisticUser.id && message.id !== streamMessageId,
          );
          return [
            ...withoutOptimistic,
            aiMessageToUiMessage(result.userMessage),
            assistantUiMessage,
          ];
        });
        queueScrollToEnd();
      } catch (error) {
        if (requestRef.current !== requestId) return;
        if (isAbortError(error)) return;

        const errorAssistantId = `assistant-error-${Date.now()}`;
        setMessages((prev) => [
          ...prev.filter(
            (message) =>
              message.id !== optimisticUser.id && message.id !== streamMessageId,
          ),
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
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
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

  const handleConfirmPlanGoal = useCallback(
    (messageId: string, goal: PlanGoal) => {
      const targetMessage = messages.find((message) => message.id === messageId);
      const option = targetMessage?.planGoalChoice?.options.find((entry) => entry.goal === goal);
      if (!option || targetMessage?.planGoalChoice?.frozen) return;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId && message.planGoalChoice
            ? {
                ...message,
                planGoalChoice: {
                  ...message.planGoalChoice,
                  frozen: true,
                  confirmedGoal: goal,
                },
              }
            : message,
        ),
      );

      void sendMessage(option.chipMessage);
    },
    [messages, sendMessage],
  );

  const handleConfirmPlanSuggestions = useCallback(
    (messageId: string, selectedPlans: PlanSuggere[]) => {
      if (!selectedPlans.length) return;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId && message.planSuggestions
            ? {
                ...message,
                planSuggestions: {
                  ...message.planSuggestions,
                  frozen: true,
                  confirmedIds: selectedPlans.map((plan) => plan.id),
                },
              }
            : message,
        ),
      );

      const [first, ...rest] = selectedPlans;
      const queueItems = rest.map((plan) => ({
        id: plan.id,
        category: plan.category,
        subtype: plan.subtype,
        titre: plan.titre,
        description: plan.description,
        montant_actuel: plan.montant_actuel,
        montant_cible: plan.montant_cible,
        raison_recommandation: plan.raison_recommandation,
        signal_declencheur: plan.signal_declencheur,
        etapes: plan.etapes,
      }));

      router.push({
        pathname: '/plans/create',
        params: {
          messageId,
          ...buildPlanCreateParamsFromSuggestion(first),
          total: String(selectedPlans.length),
          index: '1',
          ...(queueItems.length > 0 ? { queue: JSON.stringify(queueItems) } : {}),
        },
      });
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      void (async () => {
        const createdCount = await consumePendingPlanChatConfirmation();
        if (cancelled || createdCount == null) return;

        const confirmationText = buildPlansCreatedConfirmation(createdCount);
        const now = new Date().toISOString();
        const assistantMessage = {
          id: `assistant-plan-confirm-${Date.now()}`,
          role: 'assistant' as const,
          content: confirmationText,
          createdAt: now,
        };

        const history = await loadChatHistory();
        await saveChatHistory([...history, assistantMessage]);
        setMessages((prev) => [...prev, aiMessageToUiMessage(assistantMessage)]);
        queueScrollToEnd();
      })();

      return () => {
        cancelled = true;
      };
    }, [queueScrollToEnd]),
  );

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
    setHasUserSentMessage(false);
  }, []);

  useEffect(() => {
    if (!tabBarVisible) return;
    return uiEvents.subscribeFynChatSend((text) => {
      void sendMessage(text);
    });
  }, [tabBarVisible, sendMessage]);

  const listData = useMemo(() => toListItems(messages), [messages]);
  const showQuickChips = !hasUserSentMessage && messages.length === 0;
  const showInlineComposer = !tabBarVisible;
  const estimatedInputOverlayHeight =
    (showQuickChips ? CHAT_QUICK_CHIPS_ESTIMATED_HEIGHT : 0) +
    (showInlineComposer ? CHAT_INPUT_ROW_ESTIMATED_HEIGHT : 0) +
    (isResponding ? CHAT_ACTIVITY_INDICATOR_ESTIMATED_HEIGHT : 0) +
    chatInputBottomInset;
  const showBottomOverlay = showInlineComposer || isResponding || (showQuickChips && tabBarVisible);
  const listBottomPadding =
    (showBottomOverlay
      ? Math.max(inputOverlayHeight, estimatedInputOverlayHeight)
      : estimatedInputOverlayHeight) +
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
      ? 'Connexion à Fyn…'
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
        showBackButton={showBackButton}
        onMenuPress={() => setSettingsVisible(true)}
      />

      <AIChatSettingsSheet
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onHistoryCleared={handleHistoryCleared}
      />

      {pendingImageUri ? (
        <View style={[styles.banner, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.bannerText, { color: palette.textMuted }, jakartaRegularText]}>
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
                  onConfirmPlanSuggestions={handleConfirmPlanSuggestions}
                  onConfirmPlanGoal={handleConfirmPlanGoal}
                />
              );
            }}
          />

          {showBottomOverlay ? (
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

              {showQuickChips && tabBarVisible ? (
                <View style={{ paddingBottom: chatInputBottomInset }}>
                  <AIChatQuickChips
                    chips={AI_QUICK_CHIPS}
                    onChipPress={handleChipPress}
                    disabled={isResponding || !historyLoaded}
                  />
                </View>
              ) : null}

              {showInlineComposer ? (
                <AIChatMultimodalInput
                  value={input}
                  onChangeText={setInput}
                  onSend={(text) => void sendMessage(text)}
                  onAttach={() => void handlePickImage('gallery')}
                  onCamera={() => void handlePickImage('camera')}
                  onChipPress={handleChipPress}
                  onInputBlur={handleKeyboardDismiss}
                  chips={showQuickChips ? AI_QUICK_CHIPS : []}
                  disabled={!historyLoaded}
                  isBusy={isResponding}
                  onStop={handleStopGeneration}
                  bottomInset={chatInputBottomInset}
                />
              ) : null}
            </View>
          ) : null}
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
