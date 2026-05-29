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
  { label: 'Résumé portefeuille', message: 'Donne-moi un résumé de mon portefeuille.' },
  { label: 'Marchés aujourd\'hui', message: 'Comment vont les marchés aujourd\'hui ?' },
  { label: 'Analyse de risque', message: 'Quelle est mon exposition au risque ?' },
];

export const EMPTY_STATE_SUGGESTIONS: readonly QuickSuggestion[] = [
  { label: 'Résumé portefeuille', message: 'Donne-moi un résumé de mon portefeuille.' },
  { label: 'Marchés aujourd\'hui', message: 'Comment vont les marchés aujourd\'hui ?' },
  { label: 'Analyse de risque', message: 'Quelle est mon exposition au risque ?' },
];
