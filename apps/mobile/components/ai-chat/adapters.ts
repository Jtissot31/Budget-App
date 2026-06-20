import type { ChatAction } from '@/lib/ai/types';
import { messageBlocksToPlainText, parseMessageBlocks, stripCodeFromAssistantText } from '@/lib/ai/messageBlocks';
import type { AlertCardData } from '@/types/aiWidgets';
import type { AIChatUiAction, AIChatUiMessage } from './types';

export function createUiActionsFromChatActions(actions: ChatAction[], messageId: string): AIChatUiAction[] {
  return actions.map((action, index) => ({
    ...action,
    actionKey: `${messageId}-action-${index}`,
    status: 'pending' as const,
  }));
}

export function aiMessageToUiMessage(message: {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  actions?: ChatAction[];
  imageUri?: string;
  activityPhases?: import('@/lib/ai/activityPhases').ActivityPhase[];
}): AIChatUiMessage {
  const blocks =
    message.role === 'assistant' && message.content.trim()
      ? parseMessageBlocks(message.content)
      : undefined;

  const text =
    message.role === 'assistant'
      ? blocks?.length
        ? messageBlocksToPlainText(blocks) || stripCodeFromAssistantText(message.content)
        : stripCodeFromAssistantText(message.content)
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
