import { memo } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { jakartaMediumText, jakartaRegularText, spacing } from '@/constants/theme';
import { BlinkingCursor } from '@/components/BlinkingCursor';
import { AIWidgetRenderer } from '@/components/chat/AIWidgetRenderer';
import { stripCodeFromAssistantText, stripMarkdownForChatDisplay } from '@/lib/ai/messageBlocks';
import type { MessageBlock } from '@/types/aiWidgets';

import { AIChatActionCard } from './AIChatActionCard';
import { AIChatPlanSuggestionsBubble } from './AIChatPlanSuggestionsBubble';
import { AIChatPlanGoalChoiceBubble } from './AIChatPlanGoalChoiceBubble';
import { WidgetContainer } from './WidgetContainer';
import { useAIChatColors, type AIChatColors } from './theme';
import type { PlanSuggere } from '@/lib/plans/Plan';
import type { PlanGoal } from '@/lib/plans/planGoalClarification';
import type { AIChatUiMessage } from './types';

type Props = {
  message: AIChatUiMessage;
  onConfirmAction?: (messageId: string, actionKey: string) => void;
  onCancelAction?: (messageId: string, actionKey: string) => void;
  onConfirmPlanSuggestions?: (messageId: string, selectedPlans: PlanSuggere[]) => void;
  onConfirmPlanGoal?: (messageId: string, goal: PlanGoal) => void;
  actionsDisabled?: boolean;
};

function formatTimestamp(createdAt: number): string {
  const date = new Date(createdAt);
  return date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function ChatBubble({
  children,
  palette,
  style,
}: {
  children: React.ReactNode;
  palette: AIChatColors;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.chatBubbleWrapper, style]}>
      <View style={[styles.chatBubble, { backgroundColor: palette.aiBubble }]}>{children}</View>
    </View>
  );
}

function StreamingTextRow({
  text,
  streaming,
  color,
}: {
  text: string;
  streaming: boolean;
  color: string;
}) {
  return (
    <View style={styles.streamingRow}>
      {text ? (
        <Text style={[styles.aiMessageText, { color }, jakartaRegularText]}>
          {stripMarkdownForChatDisplay(text)}
        </Text>
      ) : null}
      {streaming ? <BlinkingCursor /> : null}
    </View>
  );
}

function renderMessageBlock(
  block: MessageBlock,
  index: number,
  palette: AIChatColors,
  streaming: boolean,
  isLastTextBlock: boolean,
) {
  if (block.type === 'text') {
    if (!block.content.trim() && !streaming) return null;

    return (
      <ChatBubble key={`text-${index}`} palette={palette} style={index > 0 ? styles.blockSpacing : undefined}>
        <StreamingTextRow
          text={block.content}
          streaming={streaming && isLastTextBlock}
          color={palette.text}
        />
      </ChatBubble>
    );
  }

  return (
    <View key={`widget-${block.type}-${index}`} style={styles.widgetBlock}>
      <AIWidgetRenderer data={block} />
    </View>
  );
}

function resolveAssistantBlocks(message: AIChatUiMessage): MessageBlock[] {
  if (message.blocks?.length) {
    return message.blocks;
  }
  const fallbackText = stripCodeFromAssistantText(message.text);
  if (fallbackText || message.streaming) {
    return [{ type: 'text', content: fallbackText || '' }];
  }
  return [];
}

export const AIChatMessage = memo(function AIChatMessage({
  message,
  onConfirmAction,
  onCancelAction,
  onConfirmPlanSuggestions,
  onConfirmPlanGoal,
  actionsDisabled = false,
}: Props) {
  const palette = useAIChatColors();
  const isUser = message.role === 'user';
  const assistantBlocks = !isUser ? resolveAssistantBlocks(message) : [];
  const hasBlocks = assistantBlocks.length > 0;
  const hasActions = Boolean(message.actions?.length);
  const hasPlanSuggestions = Boolean(message.planSuggestions);
  const hasPlanGoalChoice = Boolean(message.planGoalChoice);
  const lastTextBlockIndex = (() => {
    for (let i = assistantBlocks.length - 1; i >= 0; i -= 1) {
      if (assistantBlocks[i]?.type === 'text') return i;
    }
    return -1;
  })();

  if (isUser) {
    return (
      <View style={styles.userMessageWrapper}>
        <View style={[styles.userBubble, { backgroundColor: palette.userBubble }]}>
          {message.imageUri ? (
            <Image source={{ uri: message.imageUri }} style={styles.attachedImage} resizeMode="cover" />
          ) : null}
          <Text style={[styles.userMessageText, { color: palette.userBubbleText }, jakartaMediumText]}>
            {message.text}
          </Text>
        </View>
        <Text style={[styles.timestamp, styles.timestampRight, { color: palette.textMuted }, jakartaRegularText]}>
          {formatTimestamp(message.createdAt)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.aiMessageWrapper}>
      <View style={styles.messageContainer}>
        {assistantBlocks.map((block, index) =>
          renderMessageBlock(
            block,
            index,
            palette,
            Boolean(message.streaming),
            index === lastTextBlockIndex,
          ),
        )}
        {hasActions
          ? message.actions!.map((action, index) => (
              <WidgetContainer
                key={action.actionKey}
                style={
                  index > 0
                    ? styles.actionSiblingSpacing
                    : hasBlocks
                      ? undefined
                      : styles.noTopSpacing
                }
              >
                <AIChatActionCard
                  action={action}
                  disabled={actionsDisabled}
                  onConfirm={(actionKey) => onConfirmAction?.(message.id, actionKey)}
                  onCancel={(actionKey) => onCancelAction?.(message.id, actionKey)}
                />
              </WidgetContainer>
            ))
          : null}
        {hasPlanGoalChoice ? (
          <View style={hasBlocks || hasActions ? styles.trailingSpacing : styles.noTopSpacing}>
            <AIChatPlanGoalChoiceBubble
              state={message.planGoalChoice!}
              onConfirm={(goal) => onConfirmPlanGoal?.(message.id, goal)}
            />
          </View>
        ) : null}
        {hasPlanSuggestions ? (
          <View
            style={
              hasBlocks || hasActions || hasPlanGoalChoice
                ? styles.trailingSpacing
                : styles.noTopSpacing
            }
          >
            <AIChatPlanSuggestionsBubble
              state={message.planSuggestions!}
              onConfirm={(selectedPlans) => onConfirmPlanSuggestions?.(message.id, selectedPlans)}
            />
          </View>
        ) : null}
      </View>
      {!message.streaming ? (
        <Text style={[styles.timestamp, { color: palette.textMuted }, jakartaRegularText]}>
          {formatTimestamp(message.createdAt)}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  aiMessageWrapper: {
    marginBottom: 20,
    width: '100%',
    alignSelf: 'flex-start',
  },
  messageContainer: {
    width: '100%',
    alignSelf: 'stretch',
  },
  chatBubbleWrapper: {
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  chatBubble: {
    padding: 16,
    borderRadius: 8,
    gap: spacing.sm,
  },
  streamingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  },
  aiMessageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  blockSpacing: {
    marginTop: spacing.sm,
  },
  widgetBlock: {
    width: '100%',
    marginTop: spacing.lg,
  },
  trailingSpacing: {
    marginTop: spacing.lg,
  },
  actionSiblingSpacing: {
    marginTop: spacing.sm,
  },
  noTopSpacing: {
    marginTop: 0,
  },
  userMessageWrapper: {
    marginBottom: 20,
    maxWidth: '85%',
    alignSelf: 'flex-end',
  },
  userBubble: {
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  attachedImage: {
    width: 180,
    height: 120,
    borderRadius: 12,
  },
  userMessageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  timestamp: {
    fontSize: 11,
    marginTop: 6,
    marginHorizontal: 4,
  },
  timestampRight: {
    textAlign: 'right',
  },
});
