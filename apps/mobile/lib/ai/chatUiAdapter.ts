import type { ChatMessage as UiChatMessage } from '@/components/chat/types';
import type { ChatMessage as AiChatMessage } from '@/lib/ai/types';
import { stripCodeFromAssistantText } from './messageBlocks';

export { findActionJsonBlocks, findWidgetJsonBlocks, parseMessageBlocks, stripCodeFromAssistantText } from './messageBlocks';

export function aiMessageToUi(message: AiChatMessage): UiChatMessage {
  const displayText =
    message.role === 'assistant' ? stripCodeFromAssistantText(message.content) : message.content;
  const blocks: UiChatMessage['content'] = [{ kind: 'rich', text: displayText }];

  if (message.actions?.length) {
    const actionLines = message.actions
      .map((action) => `→ ${action.confirmation}`)
      .join('\n');
    blocks.push({ kind: 'rich', text: actionLines });
  }

  return {
    id: message.id,
    role: message.role,
    content: blocks,
    createdAt: Date.parse(message.createdAt) || Date.now(),
  };
}

export function createUiUserMessage(text: string): UiChatMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'user',
    content: [{ kind: 'text', text: text.trim() }],
    createdAt: Date.now(),
  };
}
