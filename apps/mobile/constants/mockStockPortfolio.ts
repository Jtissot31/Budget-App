export type MockStockHolding = {
  id: string;
  ticker: string;
  companyName: string;
  shares: number;
  pricePerShare: number;
  dayChangePercent: number;
};

/** Demo portfolio — Patrimoine « Portefeuille d'actions » (mock, not persisted). */
export const MOCK_STOCK_HOLDINGS: MockStockHolding[] = [
  {
    id: 'mock-vfv',
    ticker: 'VFV.TO',
    companyName: 'Vanguard S&P 500',
    shares: 85,
    pricePerShare: 142.3,
    dayChangePercent: 0.42,
  },
  {
    id: 'mock-aapl',
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    shares: 42,
    pricePerShare: 227.45,
    dayChangePercent: 1.24,
  },
  {
    id: 'mock-msft',
    ticker: 'MSFT',
    companyName: 'Microsoft Corp.',
    shares: 18,
    pricePerShare: 415.2,
    dayChangePercent: 0.68,
  },
  {
    id: 'mock-nvda',
    ticker: 'NVDA',
    companyName: 'NVIDIA Corp.',
    shares: 12,
    pricePerShare: 138.75,
    dayChangePercent: -2.15,
  },
  {
    id: 'mock-xeqt',
    ticker: 'XEQT',
    companyName: 'iShares Core Equity ETF',
    shares: 120,
    pricePerShare: 35.18,
    dayChangePercent: 0.31,
  },
  {
    id: 'mock-shop',
    ticker: 'SHOP',
    companyName: 'Shopify Inc.',
    shares: 25,
    pricePerShare: 128.4,
    dayChangePercent: 1.89,
  },
];

export function mockStockHoldingTotalValue(holding: MockStockHolding): number {
  return holding.shares * holding.pricePerShare;
}

export function mockStockPortfolioTotalValue(holdings: readonly MockStockHolding[] = MOCK_STOCK_HOLDINGS): number {
  return holdings.reduce((sum, holding) => sum + mockStockHoldingTotalValue(holding), 0);
}

/** Value-weighted average day change % across portfolio holdings. */
export function mockStockPortfolioDayChangePercent(
  holdings: readonly MockStockHolding[] = MOCK_STOCK_HOLDINGS,
): number {
  const totalValue = mockStockPortfolioTotalValue(holdings);
  if (totalValue <= 0) return 0;
  return holdings.reduce((sum, holding) => {
    const weight = mockStockHoldingTotalValue(holding) / totalValue;
    return sum + holding.dayChangePercent * weight;
  }, 0);
}

export function formatStockDayChangePercent(percent: number): string {
  const abs = Math.abs(percent);
  const formatted = abs < 0.05 ? '0,00' : abs.toFixed(2).replace('.', ',');
  if (abs < 0.05) return '0,00 %';
  return `${percent >= 0 ? '+' : '−'}${formatted} %`;
}

export function getMockStockHoldingByTicker(
  ticker: string,
  holdings: readonly MockStockHolding[] = MOCK_STOCK_HOLDINGS,
): MockStockHolding | null {
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedTicker) return null;
  return holdings.find((holding) => holding.ticker.toUpperCase() === normalizedTicker) ?? null;
}
