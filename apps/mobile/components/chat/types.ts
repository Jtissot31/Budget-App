export type SummaryRow = {
  label: string;
  value: string;
  accent?: 'positive' | 'negative' | 'neutral';
};

export type StockPayload = {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  currency?: string;
};

export type MessageContent =
  | { kind: 'text'; text: string }
  | { kind: 'rich'; text: string }
  | { kind: 'stock'; stock: StockPayload }
  | { kind: 'sparkline'; symbol: string; data: number[]; caption?: string }
  | { kind: 'summary'; title?: string; rows: SummaryRow[] };

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: MessageContent[];
  createdAt: number;
};

export type QuickSuggestion = {
  label: string;
  message: string;
};

export const QUICK_SUGGESTIONS: readonly QuickSuggestion[] = [
  { label: 'Résumé financier', message: 'Donne-moi un résumé de ma situation financière.' },
  { label: 'Réduire mes dettes', message: 'Comment puis-je réduire mes dettes plus vite ?' },
  { label: 'Mon budget', message: 'Suis-je dans mon budget ce mois-ci ?' },
];

export const EMPTY_STATE_SUGGESTIONS: readonly QuickSuggestion[] = [
  { label: 'Résumé financier', message: 'Donne-moi un résumé de ma situation financière.' },
  { label: 'Réduire mes dettes', message: 'Comment puis-je réduire mes dettes plus vite ?' },
  { label: 'Fonds d\'urgence', message: 'Combien devrais-je mettre de côté pour mon fonds d\'urgence ?' },
];
