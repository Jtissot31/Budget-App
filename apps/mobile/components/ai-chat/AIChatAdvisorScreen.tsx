import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
  invalidateChatSessionCache,
  loadChatHistory,
  saveChatHistory,
  sendChatMessage,
  warmChatContext,
} from '@/lib/ai/chatService';
import {
  buildActionResultAlertCard,
  isTextConfirmation,
} from '@/lib/ai/actionConfirmation';
import type { ActivityPhase } from '@/lib/ai/activityPhases';
import { stripCodeFromAssistantText, stripMarkdownForChatDisplay } from '@/lib/ai/messageBlocks';
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
const AUTO_SCROLL_THRESHOLD_PX = 50;
const TYPEWRITER_MS_PER_CHAR = 15;

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

function resolveTypewriterText(message: AIChatUiMessage): string {
  const fromBlocks = message.blocks
    ?.filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.content)
    .join('\n\n')
    .trim();
  const raw = fromBlocks || message.text || '';
  return stripMarkdownForChatDisplay(stripCodeFromAssistantText(raw)).trim();
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
  const typewriterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages, setMessages] = useState<AIChatUiMessage[]>([]);
  const [input, setInput] = useState('');
  const [isResponding, setIsResponding] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [activityState, setActivityState] = useState<ActivityState | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [hasUserSentMessage, setHasUserSentMessage] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const clearTypewriterTimer = useCallback(() => {
    if (typewriterTimeoutRef.current != null) {
      clearTimeout(typewriterTimeoutRef.current);
      typewriterTimeoutRef.current = null;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, []);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX) {
      setAutoScroll(true);
    } else {
      setAutoScroll(false);
    }
  }, []);

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
      clearTypewriterTimer();
    };
  }, [clearTypewriterTimer]);

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
    setAutoScroll(true);
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

  const revealTextCharacterByCharacter = useCallback(
    async (messageId: string, fullText: string, requestId: number) => {
      setIsStreaming(true);
      setAutoScroll(true);

      for (let i = 1; i <= fullText.length; i += 1) {
        if (requestRef.current !== requestId) {
          clearTypewriterTimer();
          setIsStreaming(false);
          return;
        }

        const partial = fullText.slice(0, i);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  text: partial,
                  blocks: [{ type: 'text', content: partial }],
                  streaming: true,
                }
              : message,
          ),
        );

        await new Promise<void>((resolve) => {
          clearTypewriterTimer();
          typewriterTimeoutRef.current = setTimeout(resolve, TYPEWRITER_MS_PER_CHAR);
        });
      }

      clearTypewriterTimer();
      setIsStreaming(false);
    },
    [clearTypewriterTimer],
  );

  const handleStopGeneration = useCallback(() => {
    if (!isResponding && !isStreaming) return;

    tapHaptic();
    requestRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    clearTypewriterTimer();

    setMessages(finalizeInterruptedMessages);
    setIsResponding(false);
    setIsStreaming(false);
    setActivityState(null);
  }, [clearTypewriterTimer, finalizeInterruptedMessages, isResponding, isStreaming]);

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
      if (!text || isResponding || isStreaming) return;

      const pendingUiAction = isTextConfirmation(text) ? findPendingActionMessage(messages) : null;

      tapHaptic();
      setInput('');
      setPendingImageUri(null);
      Keyboard.dismiss();
      setKeyboardVisible(false);

      const optimisticUser = createOptimisticUserMessage(text, imageUri ?? undefined);
      const streamMessageId = `assistant-stream-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        optimisticUser,
        {
          id: streamMessageId,
          role: 'assistant',
          text: '',
          createdAt: Date.now(),
          streaming: true,
        },
      ]);
      setHasUserSentMessage(true);
      setIsResponding(true);
      setIsStreaming(true);
      setAutoScroll(true);
      setActivityState(INITIAL_ACTIVITY_STATE);
      scrollToBottom();

      const requestId = requestRef.current + 1;
      requestRef.current = requestId;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

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
            prev
              .filter((message) => message.id !== streamMessageId)
              .map((message) =>
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
          const historyWithStatus = history.map((message) => {
            if (message.id !== pendingUiAction.messageId || !message.actions?.length) {
              return message;
            }
            return {
              ...message,
              actions: message.actions.map((action, index) => {
                const actionKey = `${message.id}-action-${index}`;
                if (actionKey !== pendingUiAction.actionKey) return action;
                return {
                  ...action,
                  status: result.ok ? ('success' as const) : ('error' as const),
                };
              }),
            };
          });
          await saveChatHistory([
            ...historyWithStatus,
            persistedUserMessage,
            persistedAssistantMessage,
          ]);
          if (result.ok) {
            invalidateChatSessionCache();
          }

          const assistantUiMessage = aiMessageToUiMessage(persistedAssistantMessage);

          setMessages((prev) => {
            const withoutOptimistic = prev.filter(
              (message) => message.id !== optimisticUser.id && message.id !== streamMessageId,
            );
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
          setAutoScroll(true);
          scrollToBottom();
          return;
        }

        const result = await sendChatMessage(text, {
          imageUri: imageUri ?? undefined,
          onActivity: handleActivity,
          signal: abortController.signal,
        });
        if (requestRef.current !== requestId) return;

        const assistantUiMessage = aiMessageToUiMessage(result.assistantMessage);
        const reveal = resolveTypewriterText(assistantUiMessage);

        if (reveal) {
          setActivityState(null);
          await revealTextCharacterByCharacter(streamMessageId, reveal, requestId);
          if (requestRef.current !== requestId) return;
        }

        setMessages((prev) => {
          const withoutOptimistic = prev.filter(
            (message) => message.id !== optimisticUser.id && message.id !== streamMessageId,
          );
          return [
            ...withoutOptimistic,
            aiMessageToUiMessage(result.userMessage),
            { ...assistantUiMessage, streaming: false },
          ];
        });
      } catch (error) {
        if (requestRef.current !== requestId) return;
        if (isAbortError(error)) return;

        const errorAssistantId = `assistant-error-${Date.now()}`;
        const errorText =
          "Impossible d'envoyer le message pour le moment. Réessaie dans un instant.";
        setActivityState(null);
        await revealTextCharacterByCharacter(streamMessageId, errorText, requestId);
        if (requestRef.current !== requestId) return;

        setMessages((prev) => [
          ...prev.filter(
            (message) => message.id !== optimisticUser.id && message.id !== streamMessageId,
          ),
          optimisticUser,
          {
            id: errorAssistantId,
            role: 'assistant',
            text: errorText,
            createdAt: Date.now(),
            streaming: false,
          },
        ]);
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
        if (requestRef.current === requestId) {
          setIsResponding(false);
          setIsStreaming(false);
          setActivityState(null);
        }
      }
    },
    [
      input,
      isResponding,
      isStreaming,
      messages,
      pendingImageUri,
      revealTextCharacterByCharacter,
      scrollToBottom,
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
    if (result.ok) {
      invalidateChatSessionCache();
    }

    const updatedUiMessage = (() => {
      const withAction = updateMessageAction(targetMessage, actionKey, {
        status: result.ok ? 'success' : 'error',
      });
      return appendAlertCardToMessage(withAction, alertCard);
    })();

    setMessages((prev) =>
      prev.map((message) => (message.id === messageId ? updatedUiMessage : message)),
    );

    try {
      const history = await loadChatHistory();
      const nextHistory = history.map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          actions: message.actions?.map((action, index) => {
            const key = `${message.id}-action-${index}`;
            if (key !== actionKey) return action;
            return {
              ...action,
              status: result.ok ? ('success' as const) : ('error' as const),
            };
          }),
          blocks: updatedUiMessage.blocks,
          content: updatedUiMessage.text || message.content,
        };
      });
      await saveChatHistory(nextHistory);
    } catch {
      // UI already reflects the outcome; persistence is best-effort.
    }

    setAutoScroll(true);
    scrollToBottom();
  }, [messages, scrollToBottom]);

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

  const keyExtractor = useCallback(
    (item: ListItem) => (item.kind === 'projection' ? item.id : item.message.id),
    [],
  );

  const onConfirmAction = useCallback(
    (messageId: string, actionKey: string) => {
      void handleConfirmAction(messageId, actionKey);
    },
    [handleConfirmAction],
  );

  const chatBusy = isResponding || isStreaming;

  const renderChatItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'projection') {
        return <AIChatProjectionWidget projection={item.projection} />;
      }
      return (
        <AIChatMessage
          message={item.message}
          actionsDisabled={chatBusy}
          onConfirmAction={onConfirmAction}
          onCancelAction={handleCancelAction}
          onConfirmPlanSuggestions={handleConfirmPlanSuggestions}
          onConfirmPlanGoal={handleConfirmPlanGoal}
        />
      );
    },
    [
      chatBusy,
      handleCancelAction,
      handleConfirmPlanGoal,
      handleConfirmPlanSuggestions,
      onConfirmAction,
    ],
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
        setAutoScroll(true);
        scrollToBottom();
      })();

      return () => {
        cancelled = true;
      };
    }, [scrollToBottom]),
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
  const showActivity = isResponding && !isStreaming && Boolean(activityState?.currentPhase);
  const estimatedInputOverlayHeight =
    (showQuickChips ? CHAT_QUICK_CHIPS_ESTIMATED_HEIGHT : 0) +
    (showInlineComposer ? CHAT_INPUT_ROW_ESTIMATED_HEIGHT : 0) +
    (showActivity ? CHAT_ACTIVITY_INDICATOR_ESTIMATED_HEIGHT : 0) +
    chatInputBottomInset;
  const showBottomOverlay = showInlineComposer || showActivity || (showQuickChips && tabBarVisible);
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
    if (autoScroll) {
      scrollToBottom();
    }
  }, [autoScroll, scrollToBottom]);

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, autoScroll, scrollToBottom]);

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

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['left', 'right']}>
      <AIChatHeader
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
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={handleListContentSizeChange}
            onScrollBeginDrag={handleChatScrollBeginDrag}
            onScrollToIndexFailed={handleScrollToIndexFailed}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            keyExtractor={keyExtractor}
            renderItem={renderChatItem}
          />

          {showBottomOverlay ? (
            <View
              style={styles.inputOverlay}
              pointerEvents="box-none"
              onLayout={handleInputOverlayLayout}
            >
              {showActivity ? (
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
                    disabled={chatBusy || !historyLoaded}
                  />
                </View>
              ) : null}

              {showInlineComposer ? (
                <AIChatMultimodalInput
                  value={input}
                  onChangeText={setInput}
                  onSend={(sendText) => void sendMessage(sendText)}
                  onAttach={() => void handlePickImage('gallery')}
                  onCamera={() => void handlePickImage('camera')}
                  onChipPress={handleChipPress}
                  onInputBlur={handleKeyboardDismiss}
                  chips={showQuickChips ? AI_QUICK_CHIPS : []}
                  disabled={!historyLoaded}
                  isBusy={chatBusy}
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
