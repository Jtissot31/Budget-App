import type { MockStockHolding } from '@/constants/mockStockPortfolio';
import type { NetWorthChartPeriod, NetWorthTrendPoint } from '@/components/PortfolioChartCard';

/** Regular session hours — US & TSX both trade 9:30–16:00 Eastern. */
export const MARKET_TIMEZONE = 'America/New_York';
export const MARKET_OPEN_HOUR = 9;
export const MARKET_OPEN_MINUTE = 30;
export const MARKET_CLOSE_HOUR = 16;
export const MARKET_CLOSE_MINUTE = 0;
export const INTRADAY_INTERVAL_MINUTES = 5;

export type StockExchange = 'US' | 'TSX';

const TSX_TICKERS = new Set(['VFV.TO', 'XEQT']);
const US_TICKERS = new Set(['AAPL', 'MSFT', 'NVDA', 'SHOP']);

/** Per 5-min interval step volatility (fraction of price) — angular random-walk steps. */
const TICKER_INTRADAY_VOL: Record<string, number> = {
  NVDA: 0.0075,
  SHOP: 0.0065,
  AAPL: 0.0055,
  MSFT: 0.0048,
  'VFV.TO': 0.0078,
  XEQT: 0.0032,
};

const DEFAULT_INTRADAY_VOL = 0.0045;

type EtDateParts = {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
};

export type MarketSessionBounds = {
  exchange: StockExchange;
  /** Absolute instants for today's (or last) session in ET, viewed in any local TZ. */
  openUtc: Date;
  closeUtc: Date;
  /** min(now, closeUtc) while session active; closeUtc for completed sessions. */
  endUtc: Date;
  /** YYYY-MM-DD in America/New_York — seed key for deterministic series. */
  tradingDateKey: string;
  /** 9:30 / 16:00 rendered in the device local timezone. */
  openLocalLabel: string;
  closeLocalLabel: string;
};

function hashNoise(seed: string, index: number): number {
  let hash = 2166136261;
  const input = `${seed}:${index}`;
  for (let charIndex = 0; charIndex < input.length; charIndex += 1) {
    hash ^= input.charCodeAt(charIndex);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 0xffffffff) * 2 - 1;
}

function getEtParts(date: Date): EtDateParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: weekdayMap[get('weekday')] ?? 0,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

/** Map ET wall-clock to a UTC Date (handles DST via Intl iteration). */
export function etWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour + 5, minute);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const et = getEtParts(new Date(utcMs));
    if (et.year === year && et.month === month && et.day === day && et.hour === hour && et.minute === minute) {
      return new Date(utcMs);
    }

    const targetMinutes = hour * 60 + minute;
    const actualMinutes = et.hour * 60 + et.minute;
    let dayDelta = 0;
    if (et.year !== year || et.month !== month || et.day !== day) {
      const targetOrdinal = Date.UTC(year, month - 1, day) / 86_400_000;
      const actualOrdinal = Date.UTC(et.year, et.month - 1, et.day) / 86_400_000;
      dayDelta = Math.round(targetOrdinal - actualOrdinal) * 24 * 60;
    }
    const deltaMinutes = targetMinutes - actualMinutes + dayDelta;
    utcMs += deltaMinutes * 60 * 1000;
  }

  return new Date(utcMs);
}

function formatLocalTime(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function tradingDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function previousTradingDayEt(year: number, month: number, day: number): EtDateParts {
  let cursor = etWallClockToUtc(year, month, day, 12, 0);
  for (let step = 0; step < 7; step += 1) {
    cursor = new Date(cursor.getTime() - 86_400_000);
    const parts = getEtParts(cursor);
    if (parts.weekday >= 1 && parts.weekday <= 5) {
      return parts;
    }
  }
  return getEtParts(cursor);
}

export function getStockExchange(ticker: string): StockExchange {
  const normalized = ticker.trim().toUpperCase();
  if (TSX_TICKERS.has(normalized) || normalized.endsWith('.TO')) return 'TSX';
  if (US_TICKERS.has(normalized)) return 'US';
  return 'US';
}

export function getMarketSessionBounds(
  now: Date = new Date(),
  ticker?: string,
): MarketSessionBounds {
  const etNow = getEtParts(now);
  let { year, month, day } = etNow;

  if (etNow.weekday === 0 || etNow.weekday === 6) {
    const friday = previousTradingDayEt(year, month, day);
    year = friday.year;
    month = friday.month;
    day = friday.day;
  }

  let openUtc = etWallClockToUtc(year, month, day, MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE);
  let closeUtc = etWallClockToUtc(year, month, day, MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE);

  if (etNow.weekday >= 1 && etNow.weekday <= 5 && now.getTime() < openUtc.getTime()) {
    const previous = previousTradingDayEt(year, month, day);
    year = previous.year;
    month = previous.month;
    day = previous.day;
    openUtc = etWallClockToUtc(year, month, day, MARKET_OPEN_HOUR, MARKET_OPEN_MINUTE);
    closeUtc = etWallClockToUtc(year, month, day, MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE);
  }

  const endUtc = new Date(Math.min(now.getTime(), closeUtc.getTime()));
  const safeEndUtc = endUtc.getTime() < openUtc.getTime() ? closeUtc : endUtc;

  return {
    exchange: ticker ? getStockExchange(ticker) : 'US',
    openUtc,
    closeUtc,
    endUtc: safeEndUtc,
    tradingDateKey: tradingDateKey(year, month, day),
    openLocalLabel: formatLocalTime(openUtc),
    closeLocalLabel: formatLocalTime(closeUtc),
  };
}

export function countIntradayPoints(
  openUtc: Date,
  endUtc: Date,
  intervalMinutes: number = INTRADAY_INTERVAL_MINUTES,
): number {
  if (endUtc.getTime() <= openUtc.getTime()) return 1;
  const elapsedMinutes = (endUtc.getTime() - openUtc.getTime()) / 60_000;
  return Math.floor(elapsedMinutes / intervalMinutes) + 1;
}

function intradayVol(holding: MockStockHolding): number {
  return TICKER_INTRADAY_VOL[holding.ticker] ?? DEFAULT_INTRADAY_VOL;
}

function generateIntradayPrices(
  holding: MockStockHolding,
  pointCount: number,
  seed: string,
): number[] {
  if (pointCount <= 0) return [];
  if (pointCount === 1) return [holding.pricePerShare];

  const endPrice = holding.pricePerShare;
  const openPrice = endPrice / (1 + holding.dayChangePercent / 100);
  const vol = intradayVol(holding);

  // Cumulative random walk — sharp segment-to-segment moves, then scale to open→close.
  const walk = new Array<number>(pointCount);
  walk[0] = 0;
  for (let index = 1; index < pointCount; index += 1) {
    const primary = hashNoise(seed, index) * vol;
    const secondary = hashNoise(`${seed}:micro`, index) * vol * 0.72;
    const micro = hashNoise(`${seed}:tick`, index) * vol * 0.38;
    const spike =
      Math.abs(hashNoise(`${seed}:spike`, index)) > 0.86
        ? hashNoise(`${seed}:jump`, index) * vol * 3.2
        : 0;
    walk[index] = walk[index - 1] + primary + secondary + micro + spike;
  }

  const walkStart = walk[0];
  const walkEnd = walk[pointCount - 1];
  const walkSpan = walkEnd - walkStart || 1;
  const priceSpan = endPrice - openPrice;

  return walk.map((value, index) => {
    if (index === 0) return openPrice;
    if (index === pointCount - 1) return endPrice;
    const t = (value - walkStart) / walkSpan;
    return openPrice + t * priceSpan;
  });
}

export type IntradaySparklineOptions = {
  now?: Date;
  intervalMinutes?: number;
};

/** Full intraday series from session open → min(now, close), one point every 5 minutes. */
export function generateIntradaySparkline(
  holding: MockStockHolding,
  options: IntradaySparklineOptions = {},
): number[] {
  const now = options.now ?? new Date();
  const intervalMinutes = options.intervalMinutes ?? INTRADAY_INTERVAL_MINUTES;
  const bounds = getMarketSessionBounds(now, holding.ticker);
  const pointCount = countIntradayPoints(bounds.openUtc, bounds.endUtc, intervalMinutes);
  const seed = `${holding.ticker}:${bounds.tradingDateKey}`;
  return generateIntradayPrices(holding, pointCount, seed);
}

export type StockChartPeriod = '1J' | '1S' | '1M' | '3M' | '1A' | '5A' | '10A';

export const STOCK_CHART_PERIODS: StockChartPeriod[] = ['1J', '1S', '1M', '3M', '1A', '5A', '10A'];

/** Period tabs for PortfolioChartCard on stock detail — same ids as {@link STOCK_CHART_PERIODS}. */
export const STOCK_NET_WORTH_CHART_PERIODS = STOCK_CHART_PERIODS as NetWorthChartPeriod[];

const PERIOD_POINT_COUNTS: Record<Exclude<StockChartPeriod, '1J'>, number> = {
  '1S': 42,
  '1M': 30,
  '3M': 36,
  '1A': 52,
  '5A': 60,
  '10A': 72,
};

/** Mock historical series for non-intraday period tabs (UI placeholder). */
function generatePeriodSparkline(
  holding: MockStockHolding,
  period: Exclude<StockChartPeriod, '1J'>,
  seed: string,
): number[] {
  const pointCount = PERIOD_POINT_COUNTS[period];
  const endPrice = holding.pricePerShare;
  const lookbackPct =
    period === '1S' ? 2.4 : period === '1M' ? 4.8 : period === '3M' ? 8.5 : period === '1A' ? 18 : period === '5A' ? 42 : 68;
  const startPrice = endPrice / (1 + lookbackPct / 100);
  const vol = intradayVol(holding) * (period === '1S' ? 1.1 : period === '1M' ? 0.95 : 0.82);

  const walk = new Array<number>(pointCount);
  walk[0] = 0;
  for (let index = 1; index < pointCount; index += 1) {
    const primary = hashNoise(`${seed}:${period}`, index) * vol;
    const secondary = hashNoise(`${seed}:${period}:micro`, index) * vol * 0.6;
    walk[index] = walk[index - 1] + primary + secondary;
  }

  const walkStart = walk[0];
  const walkEnd = walk[pointCount - 1];
  const walkSpan = walkEnd - walkStart || 1;
  const priceSpan = endPrice - startPrice;

  return walk.map((value, index) => {
    if (index === 0) return startPrice;
    if (index === pointCount - 1) return endPrice;
    const t = (value - walkStart) / walkSpan;
    return startPrice + t * priceSpan;
  });
}

export type StockChartSeriesOptions = IntradaySparklineOptions & {
  period?: StockChartPeriod;
};

/** Intraday (1J) or mock period series for stock detail chart tabs. */
export function generateStockChartSeries(
  holding: MockStockHolding,
  options: StockChartSeriesOptions = {},
): number[] {
  const period = options.period ?? '1J';
  if (period === '1J') {
    return generateIntradaySparkline(holding, options);
  }
  const now = options.now ?? new Date();
  const bounds = getMarketSessionBounds(now, holding.ticker);
  const seed = `${holding.ticker}:${bounds.tradingDateKey}`;
  return generatePeriodSparkline(holding, period, seed);
}

function isStockChartPeriod(period: NetWorthChartPeriod): period is StockChartPeriod {
  return (STOCK_CHART_PERIODS as readonly string[]).includes(period);
}

function formatIntradayPointLabel(timestamp: Date): string {
  return formatIntradayLocalTimeLabel(timestamp);
}

/** Intraday scrub label — device local timezone, fr-CA (e.g. « 9 h 30 »). */
export function formatIntradayLocalTimeLabel(timestamp: Date): string {
  return new Intl.DateTimeFormat('fr-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp);
}

function formatPeriodPointLabel(
  period: Exclude<StockChartPeriod, '1J'>,
  index: number,
  pointCount: number,
): string {
  const ratio = pointCount <= 1 ? 0 : index / (pointCount - 1);
  if (period === '1S') {
    const days = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];
    return days[Math.round(ratio * 6)] ?? '';
  }
  const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
  return months[Math.round(ratio * 11)] ?? '';
}

/** Trend points for PortfolioChartCard — intraday timestamps on 1J, index labels on mock periods. */
export function buildStockChartTrendPoints(
  holding: MockStockHolding,
  period: NetWorthChartPeriod,
  options: StockChartSeriesOptions = {},
): NetWorthTrendPoint[] {
  if (!isStockChartPeriod(period)) return [];

  const values = generateStockChartSeries(holding, { ...options, period });
  if (values.length === 0) return [];

  if (period === '1J') {
    const now = options.now ?? new Date();
    const intervalMinutes = options.intervalMinutes ?? INTRADAY_INTERVAL_MINUTES;
    const bounds = getMarketSessionBounds(now, holding.ticker);
    return values.map((value, index) => ({
      label: formatIntradayPointLabel(
        new Date(bounds.openUtc.getTime() + index * intervalMinutes * 60_000),
      ),
      value,
    }));
  }

  return values.map((value, index) => ({
    label: formatPeriodPointLabel(period, index, values.length),
    value,
  }));
}

export type StockPriceHistoryRow = {
  dateLabel: string;
  price: number;
};

function formatIntradayHistoryLabel(timestamp: Date): string {
  const time = formatIntradayLocalTimeLabel(timestamp);
  const date = new Intl.DateTimeFormat('fr-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(timestamp);
  return `${date}, ${time}`;
}

function formatPeriodHistoryLabel(
  period: Exclude<StockChartPeriod, '1J'>,
  index: number,
  pointCount: number,
  now: Date,
): string {
  const ratio = pointCount <= 1 ? 0 : index / (pointCount - 1);
  const daysBack =
    period === '1S'
      ? Math.round((1 - ratio) * 6)
      : period === '1M'
        ? Math.round((1 - ratio) * 29)
        : period === '3M'
          ? Math.round((1 - ratio) * 89)
          : period === '1A'
            ? Math.round((1 - ratio) * 364)
            : period === '5A'
              ? Math.round((1 - ratio) * 365 * 5)
              : Math.round((1 - ratio) * 365 * 10);
  const date = new Date(now);
  date.setDate(date.getDate() - daysBack);
  return new Intl.DateTimeFormat('fr-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** Price history rows for the stock detail modal — newest first. */
export function buildStockPriceHistoryRows(
  holding: MockStockHolding,
  period: NetWorthChartPeriod,
  options: StockChartSeriesOptions = {},
): StockPriceHistoryRow[] {
  if (!isStockChartPeriod(period)) return [];

  const now = options.now ?? new Date();
  const values = generateStockChartSeries(holding, { ...options, period });
  if (values.length === 0) return [];

  if (period === '1J') {
    const intervalMinutes = options.intervalMinutes ?? INTRADAY_INTERVAL_MINUTES;
    const bounds = getMarketSessionBounds(now, holding.ticker);
    return values
      .map((price, index) => ({
        dateLabel: formatIntradayHistoryLabel(
          new Date(bounds.openUtc.getTime() + index * intervalMinutes * 60_000),
        ),
        price,
      }))
      .reverse();
  }

  return values
    .map((price, index) => ({
      dateLabel: formatPeriodHistoryLabel(period, index, values.length, now),
      price,
    }))
    .reverse();
}

const LIST_SPARKLINE_POINT_COUNT = 7;

/** Compact tail of the intraday series for list-row mini charts. */
export function getSparklinePreview(
  holding: MockStockHolding,
  maxPoints: number = LIST_SPARKLINE_POINT_COUNT,
  now: Date = new Date(),
): number[] {
  const series = generateIntradaySparkline(holding, { now });
  if (series.length <= maxPoints) return series;
  return series.slice(series.length - maxPoints);
}
