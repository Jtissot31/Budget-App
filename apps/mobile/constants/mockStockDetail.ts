import {
  getMockStockHoldingByTicker,
  mockStockHoldingTotalValue,
  type MockStockHolding,
} from '@/constants/mockStockPortfolio';

export type StockMarketQuote = {
  bid: number;
  ask: number;
  lastSale: number;
  open: number;
  high: number;
  low: number;
  exchange: string;
  marketCap: string;
  peRatio: string;
  volume: string;
  avgVolume: string;
  week52High: number;
  week52Low: number;
  marginRequirement: string;
};

export type StockDividendInfo = {
  frequency: string;
  yield12m: string;
  exDate: string;
};

export type StockPositionDetail = {
  sharesLabel: string;
  totalValue: number;
  bookCost: number;
  avgPrice: number;
  accountName: string;
  accountPercent: string;
  dayReturnDollar: number;
  dayReturnPercent: number;
  totalReturnDollar: number;
  totalReturnPercent: number;
};

export type StockRecurringPurchase = {
  id: string;
  nextDateLabel: string;
  frequency: string;
  account: string;
  amount: number;
};

export type StockActivityItem = {
  id: string;
  type: 'Dividende';
  account: string;
  amount: number;
  dateLabel: string;
};

export type MockStockDetail = {
  holding: MockStockHolding;
  displayTicker: string;
  issuerName: string;
  logoLetter: string;
  logoColor: string;
  currency: string;
  marketQuote: StockMarketQuote;
  dividends: StockDividendInfo;
  position: StockPositionDetail;
  categories: string[];
  about: string;
  recurringPurchases: StockRecurringPurchase[];
  activities: StockActivityItem[];
};

const DETAIL_OVERRIDES: Record<
  string,
  Partial<
    Pick<
      MockStockDetail,
      | 'issuerName'
      | 'logoLetter'
      | 'logoColor'
      | 'categories'
      | 'about'
      | 'dividends'
      | 'recurringPurchases'
      | 'activities'
    >
  >
> = {
  'VFV.TO': {
    issuerName: 'Vanguard Investments Canada Inc. - S&P 500 Index ETF',
    logoLetter: 'V',
    logoColor: '#C41230',
    categories: ['FNB', "Fractions d'actions"],
    about:
      "Le fonds suit le S&P 500, un indice pondéré par la capitalisation boursière des grandes et moyennes entreprises américaines sélectionnées par le comité d'indices S&P Dow Jones.",
    dividends: {
      frequency: 'Trimestriellement',
      yield12m: '0,84 %',
      exDate: 'Annonce en attente',
    },
    recurringPurchases: [
      { id: 'rp-1', nextDateLabel: 'juil. 9', frequency: 'Quotidienne', account: 'REER', amount: 2.5 },
      { id: 'rp-2', nextDateLabel: 'juil. 9', frequency: 'Quotidienne', account: 'CELI', amount: 2.5 },
    ],
    activities: [
      { id: 'act-1', type: 'Dividende', account: 'CELI MAISON 🏠', amount: 0.01, dateLabel: '6 juillet 2026' },
      { id: 'act-2', type: 'Dividende', account: 'CELI MAISON 🏠', amount: 0.01, dateLabel: '3 avril 2026' },
      { id: 'act-3', type: 'Dividende', account: 'CELI MAISON 🏠', amount: 0.01, dateLabel: '2 janvier 2026' },
    ],
  },
  AAPL: {
    issuerName: 'Apple Inc.',
    logoLetter: 'A',
    logoColor: '#555555',
    categories: ['Technologie', "Fractions d'actions"],
    about:
      "Apple conçoit et commercialise des smartphones, ordinateurs personnels, tablettes, wearables et accessoires, ainsi que divers services connexes.",
    dividends: {
      frequency: 'Trimestriellement',
      yield12m: '0,52 %',
      exDate: '15 août 2026',
    },
    recurringPurchases: [
      { id: 'rp-aapl', nextDateLabel: 'juil. 12', frequency: 'Hebdomadaire', account: 'CELI', amount: 25 },
    ],
    activities: [
      { id: 'act-aapl', type: 'Dividende', account: 'CELI', amount: 0.26, dateLabel: '15 mai 2026' },
    ],
  },
};

function buildMarketQuote(holding: MockStockHolding): StockMarketQuote {
  const price = holding.pricePerShare;
  const spread = price * 0.001;
  const dayRange = price * 0.012;
  const yearHigh = price * 1.034;
  const yearLow = price * 0.78;

  return {
    bid: price - spread,
    ask: price,
    lastSale: price,
    open: price - dayRange * 0.35,
    high: price + dayRange * 0.55,
    low: price - dayRange,
    exchange: holding.ticker.endsWith('.TO') ? 'TSX' : 'NASDAQ',
    marketCap: holding.ticker === 'VFV.TO' ? '34,01 G' : '—',
    peRatio: holding.ticker === 'VFV.TO' ? '17,27' : '—',
    volume: holding.ticker === 'VFV.TO' ? '252,76 k' : '1,24 M',
    avgVolume: holding.ticker === 'VFV.TO' ? '321,14 k' : '890 k',
    week52High: yearHigh,
    week52Low: yearLow,
    marginRequirement: '30,00 %',
  };
}

function buildPosition(holding: MockStockHolding): StockPositionDetail {
  const totalValue = mockStockHoldingTotalValue(holding);
  const avgPrice = holding.pricePerShare * 0.88;
  const bookCost = holding.shares * avgPrice;
  const totalReturnDollar = totalValue - bookCost;
  const totalReturnPercent = bookCost > 0 ? (totalReturnDollar / bookCost) * 100 : 0;
  const dayReturnDollar = totalValue * (holding.dayChangePercent / 100);
  const sharesLabel =
    holding.shares < 1
      ? `${holding.shares.toLocaleString('fr-CA', { maximumFractionDigits: 4 })} actions`
      : `${holding.shares.toLocaleString('fr-CA', { maximumFractionDigits: holding.shares % 1 === 0 ? 0 : 2 })} actions`;

  return {
    sharesLabel,
    totalValue,
    bookCost,
    avgPrice,
    accountName: holding.ticker === 'VFV.TO' ? 'CELI MAISON 🏠' : 'CELI',
    accountPercent: holding.ticker === 'VFV.TO' ? '33,28 %' : '12,40 %',
    dayReturnDollar,
    dayReturnPercent: holding.dayChangePercent,
    totalReturnDollar,
    totalReturnPercent,
  };
}

function defaultDetailFields(holding: MockStockHolding) {
  const shortTicker = holding.ticker.replace('.TO', '');
  return {
    issuerName: holding.companyName,
    logoLetter: shortTicker.charAt(0),
    logoColor: '#555555',
    categories: ['Actions'],
    about: `${holding.companyName} — données de démonstration.`,
    dividends: {
      frequency: 'Trimestriellement',
      yield12m: '—',
      exDate: 'Annonce en attente',
    },
    recurringPurchases: [] as StockRecurringPurchase[],
    activities: [] as StockActivityItem[],
  };
}

export function getMockStockDetail(ticker: string): MockStockDetail | null {
  const holding = getMockStockHoldingByTicker(ticker);
  if (!holding) return null;

  const normalized = holding.ticker.toUpperCase();
  const overrides = DETAIL_OVERRIDES[normalized] ?? {};
  const defaults = defaultDetailFields(holding);

  return {
    holding,
    displayTicker: holding.ticker.replace('.TO', ''),
    issuerName: overrides.issuerName ?? defaults.issuerName,
    logoLetter: overrides.logoLetter ?? defaults.logoLetter,
    logoColor: overrides.logoColor ?? defaults.logoColor,
    currency: holding.ticker.endsWith('.TO') ? 'CAD' : 'USD',
    marketQuote: buildMarketQuote(holding),
    dividends: overrides.dividends ?? defaults.dividends,
    position: buildPosition(holding),
    categories: overrides.categories ?? defaults.categories,
    about: overrides.about ?? defaults.about,
    recurringPurchases: overrides.recurringPurchases ?? defaults.recurringPurchases,
    activities: overrides.activities ?? defaults.activities,
  };
}

export const STOCK_PERIOD_CHANGE_LABELS: Record<string, string> = {
  '1J': "aujourd'hui",
  '1S': 'la dernière semaine',
  '1M': 'le dernier mois',
  '3M': 'les 3 derniers mois',
  '1A': 'la dernière année',
  '5A': 'les 5 dernières années',
  '10A': 'les 10 dernières années',
};

export const STOCK_PRICE_HISTORY_SUBTITLES: Record<string, string> = {
  '1J': 'la dernière journée',
  '1S': 'la dernière semaine',
  '1M': 'le dernier mois',
  '3M': 'les 3 derniers mois',
  '1A': 'la dernière année',
  '5A': 'les 5 dernières années',
  '10A': 'les 10 dernières années',
};
