export type MockStockHolding = {
  id: string;
  ticker: string;
  companyName: string;
  shares: number;
  pricePerShare: number;
  dayChangePercent: number;
  /** Intraday price samples for the mini sparkline (oldest → newest). */
  sparkline: number[];
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
    sparkline: [140.8, 141.1, 140.6, 141.4, 141.9, 142.0, 142.3],
  },
  {
    id: 'mock-aapl',
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    shares: 42,
    pricePerShare: 227.45,
    dayChangePercent: 1.24,
    sparkline: [224.2, 225.0, 224.6, 226.1, 226.8, 227.0, 227.45],
  },
  {
    id: 'mock-msft',
    ticker: 'MSFT',
    companyName: 'Microsoft Corp.',
    shares: 18,
    pricePerShare: 415.2,
    dayChangePercent: 0.68,
    sparkline: [412.4, 413.0, 412.8, 414.1, 414.6, 415.0, 415.2],
  },
  {
    id: 'mock-nvda',
    ticker: 'NVDA',
    companyName: 'NVIDIA Corp.',
    shares: 12,
    pricePerShare: 138.75,
    dayChangePercent: -2.15,
    sparkline: [142.1, 141.2, 140.5, 139.8, 139.2, 138.9, 138.75],
  },
  {
    id: 'mock-xeqt',
    ticker: 'XEQT',
    companyName: 'iShares Core Equity ETF',
    shares: 120,
    pricePerShare: 35.18,
    dayChangePercent: 0.31,
    sparkline: [35.02, 35.05, 35.0, 35.1, 35.12, 35.15, 35.18],
  },
  {
    id: 'mock-shop',
    ticker: 'SHOP',
    companyName: 'Shopify Inc.',
    shares: 25,
    pricePerShare: 128.4,
    dayChangePercent: 1.89,
    sparkline: [125.8, 126.4, 126.0, 127.2, 127.8, 128.1, 128.4],
  },
];

export function mockStockHoldingTotalValue(holding: MockStockHolding): number {
  return holding.shares * holding.pricePerShare;
}

export function mockStockPortfolioTotalValue(holdings: readonly MockStockHolding[] = MOCK_STOCK_HOLDINGS): number {
  return holdings.reduce((sum, holding) => sum + mockStockHoldingTotalValue(holding), 0);
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
