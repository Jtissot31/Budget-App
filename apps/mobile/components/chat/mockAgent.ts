import type { ChatMessage, MessageContent } from './types';

const MOCK_DELAY_MS_MIN = 1000;
const MOCK_DELAY_MS_MAX = 2000;

function randomDelayMs() {
  return MOCK_DELAY_MS_MIN + Math.floor(Math.random() * (MOCK_DELAY_MS_MAX - MOCK_DELAY_MS_MIN + 1));
}

function normalize(text: string) {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function buildPortfolioSummary(): MessageContent[] {
  return [
    {
      kind: 'rich',
      text: 'Voici un **instantané** de votre portefeuille simulé :',
    },
    {
      kind: 'summary',
      title: 'Portefeuille',
      rows: [
        { label: 'Valeur totale', value: '142 850 $', accent: 'neutral' },
        { label: 'P&L journalier', value: '+1 240 $ (+0,87 %)', accent: 'positive' },
        { label: 'Score de risque', value: 'Modéré (62/100)', accent: 'neutral' },
        { label: 'Liquidités', value: '18 400 $', accent: 'neutral' },
      ],
    },
    {
      kind: 'rich',
      text: '• **Tech** : 42 % du portefeuille\n• **Énergie** : 18 %\n• **Obligations** : 22 %\n• **Liquidités** : 18 %',
    },
  ];
}

function buildMarketToday(): MessageContent[] {
  return [
    {
      kind: 'rich',
      text: 'Les marchés ouvrent en **légère hausse** ce matin. Voici les indices clés :',
    },
    {
      kind: 'stock',
      stock: {
        symbol: 'SPY',
        name: 'S&P 500 ETF',
        price: 512.34,
        changePercent: 0.42,
      },
    },
    {
      kind: 'stock',
      stock: {
        symbol: 'QQQ',
        name: 'Nasdaq 100 ETF',
        price: 438.91,
        changePercent: 0.68,
      },
    },
    {
      kind: 'sparkline',
      symbol: 'SPY',
      caption: 'Tendance intraday SPY',
      data: [508, 509.2, 507.8, 510.1, 511.5, 510.8, 512.3, 511.9, 512.34],
    },
  ];
}

function buildRiskAnalysis(): MessageContent[] {
  return [
    {
      kind: 'rich',
      text: 'Analyse de risque basée sur votre allocation simulée :',
    },
    {
      kind: 'summary',
      title: 'Exposition au risque',
      rows: [
        { label: 'Score global', value: '62 / 100', accent: 'neutral' },
        { label: 'Volatilité 30j', value: '14,2 %', accent: 'negative' },
        { label: 'Beta portefeuille', value: '1,08', accent: 'neutral' },
        { label: 'Max drawdown YTD', value: '-8,4 %', accent: 'negative' },
      ],
    },
    {
      kind: 'rich',
      text: 'Recommandation : votre poids **Tech** est élevé. Envisagez de **réduire de 5 à 8 %** pour équilibrer la volatilité.',
    },
  ];
}

function buildNvdaPerformance(): MessageContent[] {
  return [
    {
      kind: 'rich',
      text: '**NVDA** — NVIDIA Corporation',
    },
    {
      kind: 'stock',
      stock: {
        symbol: 'NVDA',
        name: 'NVIDIA Corp.',
        price: 892.15,
        changePercent: 2.34,
      },
    },
    {
      kind: 'sparkline',
      symbol: 'NVDA',
      caption: 'Performance sur 7 jours',
      data: [845, 852, 860, 855, 868, 880, 892.15],
    },
    {
      kind: 'rich',
      text: '• **+5,6 %** sur 7 jours\n• Volume **+18 %** vs moyenne\n• Résistance proche : **900 $**',
    },
  ];
}

function buildTopPositions(): MessageContent[] {
  return [
    {
      kind: 'rich',
      text: 'Vos **5 principales positions** par poids :',
    },
    {
      kind: 'stock',
      stock: { symbol: 'AAPL', name: 'Apple Inc.', price: 189.42, changePercent: 0.85 },
    },
    {
      kind: 'stock',
      stock: { symbol: 'MSFT', name: 'Microsoft Corp.', price: 415.67, changePercent: -0.32 },
    },
    {
      kind: 'stock',
      stock: { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 892.15, changePercent: 2.34 },
    },
  ];
}

function buildDefaultReply(): MessageContent[] {
  return [
    {
      kind: 'rich',
      text: 'Je peux vous aider avec votre **portefeuille**, les **marchés** ou une **analyse de risque**. Choisissez une suggestion ou posez votre question.',
    },
  ];
}

export function buildMockAssistantReply(userText: string): MessageContent[] {
  const q = normalize(userText);

  if (q.includes('resume') && q.includes('portefeuille')) return buildPortfolioSummary();
  if (q.includes('marche') || q.includes('marches')) return buildMarketToday();
  if (q.includes('risque') || q.includes('exposition')) return buildRiskAnalysis();
  if (q.includes('nvda') || q.includes('performance')) return buildNvdaPerformance();
  if (q.includes('position') || q.includes('meilleur')) return buildTopPositions();

  return buildDefaultReply();
}

export function createUserMessage(text: string): ChatMessage {
  return {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'user',
    content: [{ kind: 'text', text: text.trim() }],
    createdAt: Date.now(),
  };
}

export function createAssistantMessage(content: MessageContent[]): ChatMessage {
  return {
    id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'assistant',
    content,
    createdAt: Date.now(),
  };
}

export function simulateAgentResponse(
  userText: string,
  onReply: (message: ChatMessage) => void,
): { cancel: () => void } {
  const content = buildMockAssistantReply(userText);
  const delay = randomDelayMs();
  const timer = setTimeout(() => {
    onReply(createAssistantMessage(content));
  }, delay);

  return {
    cancel: () => clearTimeout(timer),
  };
}
