import type { DataMode, FinancialSummaryAnonymous } from './types';

export type ChatSessionContext = {
  systemPrompt: string;
  rfa: FinancialSummaryAnonymous;
  dataMode: DataMode;
};

let sessionContext: ChatSessionContext | null = null;

export function isChatSessionContextCached(): boolean {
  return sessionContext !== null;
}

export function getChatSessionContext(): ChatSessionContext | null {
  return sessionContext;
}

export function setChatSessionContext(context: ChatSessionContext): void {
  sessionContext = context;
}

export function invalidateChatSessionCache(): void {
  sessionContext = null;
}
