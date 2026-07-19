import type { DataMode, FinancialSummaryAnonymous } from './types';
import type { FynFinancialContext } from './fynFinancialContextCore';
import type { RfaInputBundle } from './sanitizeForAI';

export type ChatSessionContext = {
  systemPrompt: string;
  rfa: FinancialSummaryAnonymous;
  dataMode: DataMode;
  financialContext?: FynFinancialContext;
  rfaInput?: RfaInputBundle;
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
