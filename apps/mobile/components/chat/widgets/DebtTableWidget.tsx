import { Fragment } from 'react';
import { Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { dashboardPalette, spacing } from '@/constants/theme';
import { fontFamilies } from '@/constants/plusJakartaFonts';
import { formatDisplayMoneyAbsoluteExact } from '@/lib/formatDisplayMoney';
import { parseFormattedNumber } from '@/lib/formatNumber';
import type { DebtTableData } from '@/types/aiWidgets';
import {
  aiWidgetAmountTypography,
  aiWidgetFonts,
  useAIWidgetColors,
} from './theme';
import { WidgetCardShell } from './WidgetCardShell';

type Props = {
  data: DebtTableData;
};

/** Maquette « Dettes Actives » — colonnes fixes + gris secondaire #8A8A8A. */
const MOCK = {
  secondary: '#8A8A8A',
  divider: '#1C1C1C',
  totalBg: dashboardPalette.iconBox,
  colBalance: 78,
  colRate: 44,
  colPayment: 84,
  gridGap: 4,
} as const;

function parseWidgetMoneyAmount(raw: string | number | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;

  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—') return null;

  const compactMatch = trimmed.match(
    /^(-?[\d\s\u00a0\u202f\u2007\u2009\u205f.,]+)\s*([KkMm])(?:\s*\$)?$/,
  );
  if (compactMatch) {
    const base = parseFormattedNumber(compactMatch[1]);
    if (!Number.isFinite(base)) return null;
    const mult = compactMatch[2].toUpperCase() === 'M' ? 1_000_000 : 1_000;
    return base * mult;
  }

  const parsed = parseFormattedNumber(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Reformat raw AI / legacy money strings (`20 000 $`) with fr-CA grouping + attached `$`. */
function formatWidgetMoney(raw: string | number | undefined): string {
  const n = parseWidgetMoneyAmount(raw);
  if (n == null) {
    return typeof raw === 'string' && raw.trim() && raw.trim() !== '—' ? raw.trim() : '—';
  }

  return formatDisplayMoneyAbsoluteExact(Math.abs(n));
}

/** Prevent `$` from wrapping alone in narrow fixed columns (Samsung / Android line breaks). */
function bindMoneyNoWrap(formatted: string): string {
  if (!formatted || formatted === '—') return formatted;
  return formatted
    .replace(/ /g, '\u00A0')
    .replace(/(\d)\$/g, '$1\u00A0$');
}

function formatWidgetMoneyNoWrap(raw: string | number | undefined): string {
  return bindMoneyNoWrap(formatWidgetMoney(raw));
}

function sumRowMoney(rows: DebtTableData['rows'], key: 'balance' | 'payment'): number {
  return rows.reduce((sum, row) => {
    const amount = parseWidgetMoneyAmount(row[key]);
    return amount == null ? sum : sum + amount;
  }, 0);
}

/** Total payment cell — mockup appends « /mois » when absent. */
function formatTotalPayment(raw: string | number | undefined, computed: number | null): string {
  if (raw != null && typeof raw === 'string' && raw.trim() && raw.trim() !== '—') {
    const trimmed = raw.trim();
    return trimmed.includes('/mois') ? trimmed : `${trimmed}/mois`;
  }
  if (computed == null) return '—';
  return `${formatWidgetMoney(computed)}/mois`;
}

function formatTotalPaymentNoWrap(
  raw: string | number | undefined,
  computed: number | null,
): string {
  return bindMoneyNoWrap(formatTotalPayment(raw, computed));
}

const titleStyle = {
  fontFamily: fontFamilies.bold,
  fontSize: 14,
  lineHeight: 18,
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
};

const headerTextStyle = {
  fontFamily: fontFamilies.bold,
  fontSize: 10,
  lineHeight: 12,
  letterSpacing: 0.3,
  textTransform: 'uppercase' as const,
  includeFontPadding: false,
};

/** Shorter payment header on narrow grids — « PAIE. MIN. » → « MIN. ». */
function compactPaymentHeader(label: string): string {
  return /^paie\.?\s*min\.?$/i.test(label.trim()) ? 'Min.' : label;
}

const debtNameStyle = {
  fontFamily: fontFamilies.bold,
  fontSize: 15,
  lineHeight: 20,
  includeFontPadding: false,
};

/** Multi-word names wrap on word boundaries; single tokens ellipsis instead of mid-word break. */
function debtNameLineCount(name: string): 1 | 2 {
  return /\s/.test(name.trim()) ? 2 : 1;
}

const debtNameWrapStyle: TextStyle | undefined = Platform.select({
  web: {
    wordBreak: 'normal',
    overflowWrap: 'break-word',
  } as TextStyle,
  default: undefined,
});

const rowBalanceStyle = aiWidgetAmountTypography('row');

const moneyCellStyle: TextStyle = {
  flexShrink: 0,
};

const compactTextStyle = {
  ...aiWidgetAmountTypography('caption'),
  textAlign: 'right' as const,
};

const totalLabelStyle = {
  fontFamily: fontFamilies.bold,
  fontSize: 12,
  lineHeight: 16,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
};

const totalBalanceStyle = aiWidgetAmountTypography('row');

const totalRateStyle = {
  ...aiWidgetAmountTypography('row'),
  fontSize: 14,
  lineHeight: 18,
  textAlign: 'right' as const,
};

const totalPaymentStyle = aiWidgetAmountTypography('caption');

export function DebtTableWidget({ data }: Props) {
  const palette = useAIWidgetColors();
  const columns = {
    name: data.columns?.name ?? 'Dette',
    balance: data.columns?.balance ?? 'Solde',
    rate: data.columns?.rate ?? 'Taux',
    payment: compactPaymentHeader(data.columns?.payment ?? 'Min.'),
  };

  const showRate = data.rows.some((row) => row.rate) || data.total.rate;
  const showPayment = data.rows.some((row) => row.payment) || data.total.payment;
  const totalBalance = sumRowMoney(data.rows, 'balance');
  const totalPayment = showPayment ? sumRowMoney(data.rows, 'payment') : null;
  const shellLabel = data.label ?? 'Dettes actives';

  return (
    <WidgetCardShell style={styles.shell}>
      <Text style={[styles.title, titleStyle, { color: palette.text }]}>{shellLabel.toUpperCase()}</Text>

      <View style={styles.headerRow}>
        <Text style={[styles.nameCol, headerTextStyle, { color: MOCK.secondary }]} numberOfLines={1}>
          {columns.name}
        </Text>
        <Text style={[styles.balanceCol, headerTextStyle, { color: MOCK.secondary }]} numberOfLines={1}>
          {columns.balance}
        </Text>
        {showRate ? (
          <Text style={[styles.rateCol, headerTextStyle, { color: MOCK.secondary }]} numberOfLines={1}>
            {columns.rate}
          </Text>
        ) : null}
        {showPayment ? (
          <Text style={[styles.paymentCol, headerTextStyle, { color: MOCK.secondary }]} numberOfLines={1}>
            {columns.payment}
          </Text>
        ) : null}
      </View>

      <View style={[styles.headerDivider, { backgroundColor: MOCK.divider }]} />

      {data.rows.map((row, index) => (
        <Fragment key={`${row.name}-${row.balance}-${index}`}>
          <View style={styles.dataRow}>
            <View style={styles.nameCol}>
              <Text
                style={[debtNameStyle, debtNameWrapStyle, { color: palette.text }]}
                numberOfLines={debtNameLineCount(row.name)}
                ellipsizeMode="tail"
              >
                {row.name}
              </Text>
            </View>
            <Text
              style={[styles.balanceCol, rowBalanceStyle, moneyCellStyle, { color: MOCK.secondary }]}
              numberOfLines={1}
            >
              {formatWidgetMoneyNoWrap(row.balance)}
            </Text>
            {showRate ? (
              <Text style={[styles.rateCol, compactTextStyle, { color: MOCK.secondary }]}>
                {row.rate ?? '—'}
              </Text>
            ) : null}
            {showPayment ? (
              <Text
                style={[styles.paymentCol, compactTextStyle, moneyCellStyle, { color: MOCK.secondary }]}
                numberOfLines={1}
              >
                {formatWidgetMoneyNoWrap(row.payment)}
              </Text>
            ) : null}
          </View>
          {index < data.rows.length - 1 ? (
            <View style={[styles.divider, { backgroundColor: MOCK.divider }]} />
          ) : null}
        </Fragment>
      ))}

      <View
        style={[
          styles.totalRow,
          {
            backgroundColor: MOCK.totalBg,
          },
        ]}
      >
        <Text style={[styles.nameCol, totalLabelStyle, { color: palette.text }]}>
          {data.total.label.toUpperCase()}
        </Text>
        <Text
          style={[styles.balanceCol, totalBalanceStyle, moneyCellStyle, { color: palette.text }]}
          numberOfLines={1}
        >
          {formatWidgetMoneyNoWrap(totalBalance)}
        </Text>
        {showRate ? (
          <Text style={[styles.rateCol, totalRateStyle, { color: MOCK.secondary }]}>
            {data.total.rate ?? '—'}
          </Text>
        ) : null}
        {showPayment ? (
          <Text
            style={[styles.paymentCol, totalPaymentStyle, moneyCellStyle, { color: palette.text }]}
            numberOfLines={1}
          >
            {formatTotalPaymentNoWrap(data.total.payment, totalPayment)}
          </Text>
        ) : null}
      </View>
    </WidgetCardShell>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: spacing.sm,
  },
  title: {
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MOCK.gridGap,
    paddingBottom: 2,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    minHeight: 1,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MOCK.gridGap,
    paddingVertical: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    minHeight: 1,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MOCK.gridGap,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.md,
  },
  nameCol: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  balanceCol: {
    width: MOCK.colBalance,
    minWidth: MOCK.colBalance,
    flexShrink: 0,
    textAlign: 'right',
  },
  rateCol: {
    width: MOCK.colRate,
    flexShrink: 0,
    textAlign: 'right',
  },
  paymentCol: {
    width: MOCK.colPayment,
    minWidth: MOCK.colPayment,
    flexShrink: 0,
    textAlign: 'right',
  },
});
