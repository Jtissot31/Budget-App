import type { ActivityPhase } from '@/lib/ai/activityPhases';
import type { ChatAction } from '@/lib/ai/types';
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

import type { ProgressCardData } from '@/types/aiWidgets';

export const DEMO_PROGRESS_WIDGET: ProgressCardData = {
  type: 'progress_card',
  label: "Projection fonds d'urgence",
  icon: 'trending-up',
  value_label: '12\u00A0600,00\u00A0$',
  percent: 70,
  percent_label: "70 % de l'objectif",
  status_line: 'Paiement hypothèque sécurisé',
};

export function buildDemoMessages(): AIChatUiMessage[] {
  const base = Date.now() - 60_000;
  return [
    {
      id: 'demo-assistant-1',
      role: 'assistant',
      text: "Bonjour, je suis Fyn ! Je vois que vous avez optimisé votre plan d'épargne ce mois-ci. Souhaitez-vous que j'analyse l'impact de votre prochain paiement d'hypothèque sur votre fonds d'urgence ?",
      createdAt: base,
    },
    {
      id: 'demo-user-1',
      role: 'user',
      text: 'Oui, montre-moi si je reste dans le vert.',
      createdAt: base + 60_000,
    },
    {
      id: 'demo-assistant-2',
      role: 'assistant',
      text: "D'après mes calculs, après le paiement de 1 800,00 $ le 2 juillet, votre fonds d'urgence restera à 70 % de son objectif. Vous avez une marge de sécurité confortable.",
      createdAt: base + 120_000,
      blocks: [
        {
          type: 'text',
          content:
            "D'après mes calculs, après le paiement de 1 800,00 $ le 2 juillet, votre fonds d'urgence restera à 70 % de son objectif. Vous avez une marge de sécurité confortable.",
        },
        DEMO_PROGRESS_WIDGET,
      ],
    },
  ];
}
