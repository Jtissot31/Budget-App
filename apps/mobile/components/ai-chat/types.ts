import type { ActivityPhase } from '@/lib/ai/activityPhases';
import type { ChatAction, ChatPlanSuggestions } from '@/lib/ai/types';
import type { MessageBlock } from '@/types/aiWidgets';

export type AIChatActionState = 'pending' | 'executing' | 'success' | 'error' | 'cancelled';

export type AIChatUiAction = ChatAction & {
  actionKey: string;
  status: AIChatActionState;
  resultMessage?: string;
};

export type EmergencyFundProjection = {
  title?: string;
  value: string;
  targetLabel: string;
  progressPercent: number;
  footerText: string;
};

export type AIChatUiMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: number;
  /** Ordered text + widget blocks parsed from assistant JSON output. */
  blocks?: MessageBlock[];
  projection?: EmergencyFundProjection;
  imageUri?: string;
  actions?: AIChatUiAction[];
  activityPhases?: ActivityPhase[];
  streaming?: boolean;
  planSuggestions?: ChatPlanSuggestions;
  planGoalChoice?: import('@/lib/plans/planGoalClarification').ChatPlanGoalChoice;
};

export type AIQuickChip = {
  label: string;
  message: string;
};

export const AI_QUICK_CHIPS: readonly AIQuickChip[] = [
  { label: 'Simuler un achat', message: 'Simule l\'impact d\'un achat de 500 $ sur mon budget ce mois-ci.' },
  { label: 'Optimiser mes taxes', message: 'Comment puis-je optimiser ma situation fiscale cette année ?' },
  { label: 'Réduire dépenses', message: 'Quelles dépenses pourrais-je réduire en priorité ?' },
];
