/**
 * Cumulative expense totals by calendar period.
 * Shared by Accueil sparklines and Analyse dépenses step chart (week / month / year).
 */

export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export type MonthSpendTx = { date: string; amount: number; type: string };

/** Analyse dépenses chart granularity — Accueil-style chips: 1S / 1M / 1A. */
export type SpendTrendGranularity = 'week' | 'month' | 'year';

export type SpendTrendSummary = {
  series: number[];
  activeIndex: number;
  total: number;
};

const ISO_DAY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/** Local calendar Y/M/D from a tx date — avoids UTC shift on `YYYY-MM-DD`. */
export function localCalendarPartsFromTxDate(
  iso: string,
): { y: number; m: number; d: number } | null {
  const trimmed = iso.trim();
  if (!trimmed) return null;
  const match = ISO_DAY_PREFIX.exec(trimmed);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    const probe = new Date(y, m, d);
    if (probe.getFullYear() !== y || probe.getMonth() !== m || probe.getDate() !== d) {
      return null;
    }
    return { y, m, d };
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    y: parsed.getFullYear(),
    m: parsed.getMonth(),
    d: parsed.getDate(),
  };
}

/**
 * Builds a running-total series for expenses in `month`.
 * Days after `asOf` (default: now) stay flat at the as-of cumulative so the
 * progress line can plateau horizontally to “today” without inventing spend.
 * For past months, pass `asOf` at/after month end to include the full series.
 */
export function buildMonthSpendSeries(
  expenses: readonly MonthSpendTx[],
  month: Date = new Date(),
  asOf: Date = new Date(),
): number[] {
  const dim = daysInMonth(month);
  const daySpend = new Array<number>(dim).fill(0);
  const y = month.getFullYear();
  const m = month.getMonth();

  for (const tx of expenses) {
    if (tx.type !== 'expense') continue;
    const parts = localCalendarPartsFromTxDate(tx.date);
    if (!parts || parts.y !== y || parts.m !== m) continue;
    if (parts.d >= 1 && parts.d <= dim) daySpend[parts.d - 1] += Math.abs(tx.amount);
  }

  const cumulative = new Array<number>(dim);
  let running = 0;
  for (let i = 0; i < dim; i += 1) {
    running += daySpend[i] ?? 0;
    cumulative[i] = running;
  }

  const sameMonth = asOf.getFullYear() === y && asOf.getMonth() === m;
  const cutIdx = sameMonth
    ? Math.min(dim - 1, Math.max(0, asOf.getDate() - 1))
    : asOf.getTime() < new Date(y, m, 1).getTime()
      ? -1
      : dim - 1;

  if (cutIdx < 0) {
    return cumulative.map(() => 0);
  }

  // Hold the as-of total through the rest of the month (muted tail / no invented spend).
  const cutVal = cumulative[cutIdx] ?? 0;
  for (let i = cutIdx + 1; i < dim; i += 1) {
    cumulative[i] = cutVal;
  }
  return cumulative;
}

/**
 * Lower bound for a “transactions since” query covering `month`, as a bare `YYYY-MM-DD`.
 * A UTC ISO instant would string-compare wrong against rows stored as `YYYY-MM-DD`;
 * the extra day of slack also absorbs rows stored as UTC instants either side of the
 * local boundary. `buildMonthSpendSeries` re-filters by local calendar month anyway.
 */
export function monthSpendQueryLowerBound(month: Date): string {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  start.setDate(start.getDate() - 1);
  const m = `${start.getMonth() + 1}`.padStart(2, '0');
  const d = `${start.getDate()}`.padStart(2, '0');
  return `${start.getFullYear()}-${m}-${d}`;
}

/** Index of the last “real” day in the series (today for current month, last day otherwise). */
export function monthSpendActiveIndex(month: Date, asOf: Date = new Date()): number {
  const dim = daysInMonth(month);
  const y = month.getFullYear();
  const m = month.getMonth();
  const sameMonth = asOf.getFullYear() === y && asOf.getMonth() === m;
  if (sameMonth) return Math.min(dim - 1, Math.max(0, asOf.getDate() - 1));
  if (asOf.getTime() < new Date(y, m, 1).getTime()) return 0;
  return dim - 1;
}

export type MonthSpendSummary = {
  /** Cumulative expense total per day of `month`, plateaued after `asOf`. */
  series: number[];
  /** Index of the as-of day within `series`. */
  activeIndex: number;
  /** Month-to-date expense total — the one “dépensé ce mois-ci” figure. */
  total: number;
};

/**
 * Single source of truth for “dépensé ce mois-ci”. The Transactions Dépenses et épargne
 * card and the Analyse dépenses chart both read `total` from here so their headline
 * numbers cannot drift apart.
 */
export function buildMonthSpendSummary(
  expenses: readonly MonthSpendTx[],
  month: Date = new Date(),
  asOf: Date = new Date(),
): MonthSpendSummary {
  const series = buildMonthSpendSeries(expenses, month, asOf);
  const activeIndex = monthSpendActiveIndex(month, asOf);
  return { series, activeIndex, total: series[activeIndex] ?? 0 };
}

/**
 * Progress slice through `activeIndex` (inclusive), already plateaued to that day.
 * Use for the blue current-month step line so it always extends horizontally to today.
 */
export function monthSpendProgressSeries(
  series: readonly number[],
  activeIndex: number,
): number[] {
  if (series.length === 0) return [];
  const end = Math.min(Math.max(0, activeIndex), series.length - 1);
  return series.slice(0, end + 1);
}

export function previousCalendarMonth(month: Date): Date {
  return new Date(month.getFullYear(), month.getMonth() - 1, 1);
}

/**
 * Full completed prior-month cumulative spend, aligned by day-of-month to `targetLength`
 * (usually the selected month’s day count). Pads with the prior month’s final total when
 * the prior month is shorter.
 */
export function buildPriorMonthSpendSeriesAligned(
  expenses: readonly MonthSpendTx[],
  month: Date,
  targetLength: number,
): number[] {
  const prev = previousCalendarMonth(month);
  const prevEnd = new Date(prev.getFullYear(), prev.getMonth() + 1, 0, 23, 59, 59, 999);
  const full = buildMonthSpendSeries(expenses, prev, prevEnd);
  if (targetLength <= 0) return [];
  if (full.length === 0) return new Array<number>(targetLength).fill(0);

  const out = new Array<number>(targetLength);
  const last = full[full.length - 1] ?? 0;
  for (let i = 0; i < targetLength; i += 1) {
    out[i] = i < full.length ? (full[i] ?? last) : last;
  }
  return out;
}

/** Peak finite value across one cumulative spend series (dollars, not normalized). */
export function maxSpendSeriesValue(series: readonly number[]): number {
  let max = 0;
  for (const raw of series) {
    const v = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(v) && v > max) max = v;
  }
  return max;
}

/**
 * Shared Y-domain max for Analyse dépenses dual-series chart.
 * Both current + prior lines must use this single max — never normalize each series to 0–1 alone.
 */
export function sharedSpendChartYMax(
  seriesList: readonly (readonly number[])[],
  extras: readonly number[] = [],
  padRatio = 1.08,
): number {
  let peak = 0;
  for (const series of seriesList) {
    peak = Math.max(peak, maxSpendSeriesValue(series));
  }
  for (const raw of extras) {
    const v = typeof raw === 'number' ? raw : Number(raw);
    if (Number.isFinite(v) && v > peak) peak = v;
  }
  return Math.max(peak * padRatio, 1);
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

/** Monday-start week (ISO-style), local calendar — matches net-worth weekly series. */
export function startOfWeekMonday(date: Date): Date {
  const day = startOfLocalDay(date);
  const weekday = day.getDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  day.setDate(day.getDate() - daysFromMonday);
  return day;
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
}

export function previousCalendarWeek(weekStart: Date): Date {
  const prev = startOfWeekMonday(weekStart);
  prev.setDate(prev.getDate() - 7);
  return prev;
}

export function previousCalendarYear(yearAnchor: Date): Date {
  return new Date(yearAnchor.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
}

function dayIndexInWeek(weekStart: Date, parts: { y: number; m: number; d: number }): number | null {
  const txDay = new Date(parts.y, parts.m, parts.d);
  const start = startOfWeekMonday(weekStart);
  const diffMs = txDay.getTime() - start.getTime();
  if (diffMs < 0) return null;
  const idx = Math.floor(diffMs / 86_400_000);
  if (idx < 0 || idx > 6) return null;
  return idx;
}

/**
 * Cumulative daily expense totals for a Mon–Sun week (length = 7).
 * Days after `asOf` stay flat at the as-of cumulative.
 */
export function buildWeekSpendSeries(
  expenses: readonly MonthSpendTx[],
  weekStart: Date = startOfWeekMonday(new Date()),
  asOf: Date = new Date(),
): number[] {
  const start = startOfWeekMonday(weekStart);
  const daySpend = new Array<number>(7).fill(0);

  for (const tx of expenses) {
    if (tx.type !== 'expense') continue;
    const parts = localCalendarPartsFromTxDate(tx.date);
    if (!parts) continue;
    const idx = dayIndexInWeek(start, parts);
    if (idx == null) continue;
    daySpend[idx] += Math.abs(tx.amount);
  }

  const cumulative = new Array<number>(7);
  let running = 0;
  for (let i = 0; i < 7; i += 1) {
    running += daySpend[i] ?? 0;
    cumulative[i] = running;
  }

  const asOfStart = startOfLocalDay(asOf);
  const weekEnd = new Date(start);
  weekEnd.setDate(start.getDate() + 6);

  let cutIdx: number;
  if (asOfStart.getTime() < start.getTime()) {
    cutIdx = -1;
  } else if (asOfStart.getTime() > weekEnd.getTime()) {
    cutIdx = 6;
  } else {
    cutIdx = Math.min(6, Math.max(0, Math.floor((asOfStart.getTime() - start.getTime()) / 86_400_000)));
  }

  if (cutIdx < 0) {
    return cumulative.map(() => 0);
  }

  const cutVal = cumulative[cutIdx] ?? 0;
  for (let i = cutIdx + 1; i < 7; i += 1) {
    cumulative[i] = cutVal;
  }
  return cumulative;
}

export function weekSpendActiveIndex(weekStart: Date, asOf: Date = new Date()): number {
  const start = startOfWeekMonday(weekStart);
  const asOfStart = startOfLocalDay(asOf);
  const weekEnd = new Date(start);
  weekEnd.setDate(start.getDate() + 6);
  if (asOfStart.getTime() < start.getTime()) return 0;
  if (asOfStart.getTime() > weekEnd.getTime()) return 6;
  return Math.min(6, Math.max(0, Math.floor((asOfStart.getTime() - start.getTime()) / 86_400_000)));
}

export function buildWeekSpendSummary(
  expenses: readonly MonthSpendTx[],
  weekStart: Date = startOfWeekMonday(new Date()),
  asOf: Date = new Date(),
): SpendTrendSummary {
  const series = buildWeekSpendSeries(expenses, weekStart, asOf);
  const activeIndex = weekSpendActiveIndex(weekStart, asOf);
  return { series, activeIndex, total: series[activeIndex] ?? 0 };
}

export function buildPriorWeekSpendSeriesAligned(
  expenses: readonly MonthSpendTx[],
  weekStart: Date,
  targetLength = 7,
): number[] {
  const prev = previousCalendarWeek(weekStart);
  const prevEnd = new Date(prev);
  prevEnd.setDate(prev.getDate() + 6);
  prevEnd.setHours(23, 59, 59, 999);
  const full = buildWeekSpendSeries(expenses, prev, prevEnd);
  if (targetLength <= 0) return [];
  if (full.length === 0) return new Array<number>(targetLength).fill(0);
  const out = new Array<number>(targetLength);
  const last = full[full.length - 1] ?? 0;
  for (let i = 0; i < targetLength; i += 1) {
    out[i] = i < full.length ? (full[i] ?? last) : last;
  }
  return out;
}

/**
 * Cumulative monthly expense totals for a calendar year (length = 12).
 * Months after `asOf` stay flat at the as-of cumulative.
 */
export function buildYearSpendSeries(
  expenses: readonly MonthSpendTx[],
  yearAnchor: Date = startOfYear(new Date()),
  asOf: Date = new Date(),
): number[] {
  const year = yearAnchor.getFullYear();
  const sameYear = asOf.getFullYear() === year;
  const cutMonth = sameYear
    ? Math.min(11, Math.max(0, asOf.getMonth()))
    : asOf.getFullYear() < year
      ? -1
      : 11;
  const asOfDay = asOf.getDate();
  const monthSpend = new Array<number>(12).fill(0);

  for (const tx of expenses) {
    if (tx.type !== 'expense') continue;
    const parts = localCalendarPartsFromTxDate(tx.date);
    if (!parts || parts.y !== year) continue;
    if (parts.m < 0 || parts.m > 11) continue;
    // Current year-to-date: exclude future months and days after asOf in the active month.
    if (cutMonth < 0) continue;
    if (parts.m > cutMonth) continue;
    if (sameYear && parts.m === cutMonth && parts.d > asOfDay) continue;
    monthSpend[parts.m] += Math.abs(tx.amount);
  }

  const cumulative = new Array<number>(12);
  let running = 0;
  for (let i = 0; i < 12; i += 1) {
    running += monthSpend[i] ?? 0;
    cumulative[i] = running;
  }

  if (cutMonth < 0) {
    return cumulative.map(() => 0);
  }

  const cutVal = cumulative[cutMonth] ?? 0;
  for (let i = cutMonth + 1; i < 12; i += 1) {
    cumulative[i] = cutVal;
  }
  return cumulative;
}

export function yearSpendActiveIndex(yearAnchor: Date, asOf: Date = new Date()): number {
  const year = yearAnchor.getFullYear();
  if (asOf.getFullYear() === year) return Math.min(11, Math.max(0, asOf.getMonth()));
  if (asOf.getFullYear() < year) return 0;
  return 11;
}

export function buildYearSpendSummary(
  expenses: readonly MonthSpendTx[],
  yearAnchor: Date = startOfYear(new Date()),
  asOf: Date = new Date(),
): SpendTrendSummary {
  const series = buildYearSpendSeries(expenses, yearAnchor, asOf);
  const activeIndex = yearSpendActiveIndex(yearAnchor, asOf);
  return { series, activeIndex, total: series[activeIndex] ?? 0 };
}

export function buildPriorYearSpendSeriesAligned(
  expenses: readonly MonthSpendTx[],
  yearAnchor: Date,
  targetLength = 12,
): number[] {
  const prev = previousCalendarYear(yearAnchor);
  const prevEnd = new Date(prev.getFullYear(), 11, 31, 23, 59, 59, 999);
  const full = buildYearSpendSeries(expenses, prev, prevEnd);
  if (targetLength <= 0) return [];
  if (full.length === 0) return new Array<number>(targetLength).fill(0);
  const out = new Array<number>(targetLength);
  const last = full[full.length - 1] ?? 0;
  for (let i = 0; i < targetLength; i += 1) {
    out[i] = i < full.length ? (full[i] ?? last) : last;
  }
  return out;
}

/** Snap an arbitrary date to the period start for the given granularity. */
export function snapSpendTrendAnchor(date: Date, granularity: SpendTrendGranularity): Date {
  if (granularity === 'week') return startOfWeekMonday(date);
  if (granularity === 'year') return startOfYear(date);
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function shiftSpendTrendAnchor(
  anchor: Date,
  granularity: SpendTrendGranularity,
  delta: number,
): Date {
  const snapped = snapSpendTrendAnchor(anchor, granularity);
  if (granularity === 'week') {
    const next = new Date(snapped);
    next.setDate(snapped.getDate() + delta * 7);
    return startOfWeekMonday(next);
  }
  if (granularity === 'year') {
    return new Date(snapped.getFullYear() + delta, 0, 1, 0, 0, 0, 0);
  }
  return new Date(snapped.getFullYear(), snapped.getMonth() + delta, 1, 0, 0, 0, 0);
}

export function isSpendTrendAnchorBefore(left: Date, right: Date, granularity: SpendTrendGranularity): boolean {
  return snapSpendTrendAnchor(left, granularity).getTime() < snapSpendTrendAnchor(right, granularity).getTime();
}

export function isSpendTrendAnchorAfter(left: Date, right: Date, granularity: SpendTrendGranularity): boolean {
  return snapSpendTrendAnchor(left, granularity).getTime() > snapSpendTrendAnchor(right, granularity).getTime();
}

/**
 * Single entry for Analyse dépenses: current period series + prior period comparison.
 */
export function buildSpendTrendBundle(
  expenses: readonly MonthSpendTx[],
  granularity: SpendTrendGranularity,
  anchor: Date,
  asOf: Date = new Date(),
): {
  summary: SpendTrendSummary;
  comparisonSeries: number[];
} {
  if (granularity === 'week') {
    const week = startOfWeekMonday(anchor);
    const summary = buildWeekSpendSummary(expenses, week, asOf);
    return {
      summary,
      comparisonSeries: buildPriorWeekSpendSeriesAligned(
        expenses,
        week,
        Math.max(summary.series.length, 1),
      ),
    };
  }
  if (granularity === 'year') {
    const year = startOfYear(anchor);
    const summary = buildYearSpendSummary(expenses, year, asOf);
    return {
      summary,
      comparisonSeries: buildPriorYearSpendSeriesAligned(
        expenses,
        year,
        Math.max(summary.series.length, 1),
      ),
    };
  }
  const month = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const summary = buildMonthSpendSummary(expenses, month, asOf);
  return {
    summary,
    comparisonSeries: buildPriorMonthSpendSeriesAligned(
      expenses,
      month,
      Math.max(summary.series.length, 1),
    ),
  };
}

const WEEKDAY_SHORT_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
const MONTH_SHORT_FR = [
  'Janv.',
  'Févr.',
  'Mars',
  'Avr.',
  'Mai',
  'Juin',
  'Juil.',
  'Août',
  'Sept.',
  'Oct.',
  'Nov.',
  'Déc.',
] as const;

/** Scrub hint under the hero amount (French). */
export function spendTrendScrubLabel(
  granularity: SpendTrendGranularity,
  index: number,
  anchor: Date,
): string {
  if (granularity === 'week') {
    const start = startOfWeekMonday(anchor);
    const day = new Date(start);
    day.setDate(start.getDate() + Math.min(6, Math.max(0, index)));
    const weekday = WEEKDAY_SHORT_FR[Math.min(6, Math.max(0, index))] ?? '';
    return `${weekday} ${day.getDate()}`;
  }
  if (granularity === 'year') {
    return MONTH_SHORT_FR[Math.min(11, Math.max(0, index))] ?? '';
  }
  return `Jour ${index + 1}`;
}

export function spendTrendPeriodSpentLabel(granularity: SpendTrendGranularity): string {
  if (granularity === 'week') return 'dépensé cette semaine';
  if (granularity === 'year') return 'dépensé cette année';
  return 'dépensé ce mois-ci';
}

export function spendTrendPriorPeriodLabel(granularity: SpendTrendGranularity): string {
  if (granularity === 'week') return 'Semaine dernière';
  if (granularity === 'year') return 'Année dernière';
  return 'Mois dernier';
}

/** Navigator primary/secondary labels for the period chevron control. */
export function spendTrendNavigatorLabels(
  granularity: SpendTrendGranularity,
  anchor: Date,
): { primary: string; secondary: string; a11y: string } {
  if (granularity === 'week') {
    const start = startOfWeekMonday(anchor);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startMonth = start
      .toLocaleDateString('fr-FR', { month: 'short' })
      .replace('.', '')
      .toUpperCase();
    const endMonth = end
      .toLocaleDateString('fr-FR', { month: 'short' })
      .replace('.', '')
      .toUpperCase();
    const primary =
      start.getMonth() === end.getMonth()
        ? `${start.getDate()}–${end.getDate()} ${startMonth}`
        : `${start.getDate()} ${startMonth} – ${end.getDate()} ${endMonth}`;
    const secondary = String(end.getFullYear());
    return {
      primary,
      secondary,
      a11y: `Semaine du ${start.getDate()} au ${end.getDate()} ${secondary}`,
    };
  }
  if (granularity === 'year') {
    const year = String(startOfYear(anchor).getFullYear());
    return { primary: year, secondary: '', a11y: year };
  }
  const month = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const primary = month.toLocaleDateString('fr-FR', { month: 'long' }).toUpperCase();
  const secondary = String(month.getFullYear());
  return {
    primary,
    secondary,
    a11y: `${primary} ${secondary}`,
  };
}
