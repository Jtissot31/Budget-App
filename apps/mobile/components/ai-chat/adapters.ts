import type { ChatAction } from '@/lib/ai/types';
import {
  messageBlocksToPlainText,
  parseMessageBlocks,
  stripCodeFromAssistantText,
  stripMarkdownForChatDisplay,
  suppressDuplicateActionProse,
} from '@/lib/ai/messageBlocks';
import type { AlertCardData, MessageBlock } from '@/types/aiWidgets';
import type { AIChatUiAction, AIChatUiMessage } from './types';

function sanitizeAssistantBlocks(blocks: MessageBlock[]): MessageBlock[] {
  return blocks.map((block) =>
    block.type === 'text'
      ? { ...block, content: stripMarkdownForChatDisplay(block.content) }
      : block,
  );
}

export function createUiActionsFromChatActions(actions: ChatAction[], messageId: string): AIChatUiAction[] {
  return actions.map((action, index) => ({
    ...action,
    actionKey: `${messageId}-action-${index}`,
    status: action.status ?? 'pending',
  }));
}

export function aiMessageToUiMessage(message: {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  actions?: ChatAction[];
  blocks?: import('@/types/aiWidgets').MessageBlock[];
  imageUri?: string;
  activityPhases?: import('@/lib/ai/activityPhases').ActivityPhase[];
  planSuggestions?: import('@/lib/ai/types').ChatPlanSuggestions;
  planGoalChoice?: import('@/lib/plans/planGoalClarification').ChatPlanGoalChoice;
}): AIChatUiMessage {
  const rawBlocks =
    message.role === 'assistant'
      ? message.blocks?.length
        ? message.blocks
        : message.content.trim()
          ? parseMessageBlocks(message.content)
          : undefined
      : undefined;

  const dedupedBlocks =
    message.role === 'assistant' && message.actions?.length && rawBlocks?.length
      ? suppressDuplicateActionProse(rawBlocks, message.actions)
      : rawBlocks;

  const blocks =
    message.role === 'assistant' && dedupedBlocks?.length
      ? sanitizeAssistantBlocks(dedupedBlocks)
      : dedupedBlocks;

  const strippedContent =
    message.role === 'assistant' ? stripCodeFromAssistantText(message.content) : message.content;

  const text =
    message.role === 'assistant'
      ? blocks?.length
        ? messageBlocksToPlainText(blocks) || (message.actions?.length ? '' : strippedContent)
        : message.actions?.length
          ? ''
          : strippedContent
      : message.content;

  return {
    id: message.id,
    role: message.role,
    text,
    blocks,
    createdAt: Date.parse(message.createdAt) || Date.now(),
    imageUri: message.imageUri,
    actions: message.actions?.length
      ? createUiActionsFromChatActions(message.actions, message.id)
      : undefined,
    activityPhases: message.activityPhases,
    planSuggestions: message.planSuggestions,
    planGoalChoice: message.planGoalChoice,
  };
}

export function createOptimisticUserMessage(text: string, imageUri?: string): AIChatUiMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'user',
    text: text.trim(),
    createdAt: Date.now(),
    imageUri,
  };
}

export function updateMessageAction(
  message: AIChatUiMessage,
  actionKey: string,
  patch: Partial<AIChatUiAction>,
): AIChatUiMessage {
  if (!message.actions?.length) return message;
  return {
    ...message,
    actions: message.actions.map((action) =>
      action.actionKey === actionKey ? { ...action, ...patch } : action,
    ),
  };
}

function resolveMessageBlocks(message: AIChatUiMessage) {
  if (message.blocks?.length) return [...message.blocks];
  if (message.text.trim()) return [{ type: 'text' as const, content: message.text }];
  return [];
}

export function appendAlertCardToMessage(
  message: AIChatUiMessage,
  alertCard: AlertCardData,
): AIChatUiMessage {
  const blocks = [...resolveMessageBlocks(message), alertCard];
  return {
    ...message,
    blocks,
    text: messageBlocksToPlainText(blocks) || message.text,
  };
}

export function findPendingActionMessage(messages: AIChatUiMessage[]): {
  messageId: string;
  actionKey: string;
  action: AIChatUiAction;
} | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant' || !message.actions?.length) continue;

    const pendingAction = message.actions.find((action) => action.status === 'pending');
    if (pendingAction) {
      return {
        messageId: message.id,
        actionKey: pendingAction.actionKey,
        action: pendingAction,
      };
    }
  }

  return null;
}
