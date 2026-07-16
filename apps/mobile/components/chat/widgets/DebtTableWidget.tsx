import { StyleSheet, Text, View } from 'react-native';
import {
  jakartaBoldText,
  jakartaSemiboldText,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { formatNumberDisplay, parseFormattedNumber } from '@/lib/formatNumber';
import { useAppTheme } from '@/lib/themeContext';
import type { DebtTableData } from '@/types/aiWidgets';
import { useAIWidgetColors } from './theme';

type Props = {
  data: DebtTableData;
};

const CARD_RADIUS = radius.md;

/** Reformat raw AI / legacy money strings (`20000 $`) with fr-CA grouping + attached `$`. */
function formatWidgetMoney(raw: string | number | undefined): string {
  if (raw == null) return '—';
  const trimmed = typeof raw === 'number' ? (Number.isFinite(raw) ? String(raw) : '') : raw.trim();
  if (!trimmed || trimmed === '—') return '—';
  const n = parseFormattedNumber(trimmed);
  if (!Number.isFinite(n)) return typeof raw === 'string' ? trimmed : '—';
  const abs = Math.abs(n);
  const hasCents = Math.abs(abs - Math.round(abs)) > 1e-9;
  const main = formatNumberDisplay(abs, {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  });
  return `${main}$`;
}

const headerTextStyle = {
  ...jakartaSemiboldText,
  fontSize: 10,
  letterSpacing: 0.4,
  textTransform: 'uppercase' as const,
};

const rowNameStyle = {
  ...jakartaSemiboldText,
  fontSize: 13,
  lineHeight: 17,
};

const amountStyle = moneyAmountTypography({ tier: 'row', textAlign: 'right', fontSize: 13, lineHeight: 17 });

const compactAmountStyle = moneyAmountTypography({ tier: 'row', textAlign: 'right', fontSize: 12, lineHeight: 16 });

const rateTextStyle = {
  ...jakartaSemiboldText,
  fontSize: 12,
  lineHeight: 16,
  textAlign: 'right' as const,
};

export function DebtTableWidget({ data }: Props) {
  const { colors } = useAppTheme();
  const palette = useAIWidgetColors();
  const columns = {
    name: data.columns?.name ?? 'DETTE',
    balance: data.columns?.balance ?? 'SOLDE',
    rate: data.columns?.rate ?? 'TAUX',
    payment: data.columns?.payment ?? 'PAIEMENT',
  };

  const showRate = data.rows.some((row) => row.rate) || data.total.rate;
  const showPayment = data.rows.some((row) => row.payment) || data.total.payment;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.containerBackground,
          borderColor: colors.containerBorder,
          padding: palette.padding,
        },
      ]}
    >
      {data.label ? (
        <Text style={[styles.title, typographyKit.eyebrow, { color: colors.text }]}>
          {data.label.toUpperCase()}
        </Text>
      ) : null}

      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.nameCol, headerTextStyle, { color: colors.textSecondary }]}>
          {columns.name}
        </Text>
        <Text style={[styles.headerCell, styles.amountCol, headerTextStyle, { color: colors.textSecondary }]}>
          {columns.balance}
        </Text>
        {showRate ? (
          <Text style={[styles.headerCell, styles.rateCol, headerTextStyle, { color: colors.textSecondary }]}>
            {columns.rate}
          </Text>
        ) : null}
        {showPayment ? (
          <Text
            style={[styles.headerCell, styles.paymentCol, headerTextStyle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {columns.payment}
          </Text>
        ) : null}
      </View>

      {data.rows.map((row) => (
        <View key={`${row.name}-${row.balance}`} style={[styles.row, { borderTopColor: colors.border }]}>
          <Text style={[styles.cell, styles.nameCol, rowNameStyle, { color: colors.text }]} numberOfLines={2}>
            {row.name}
          </Text>
          <Text style={[styles.cell, styles.amountCol, amountStyle, { color: colors.text }]}>
            {formatWidgetMoney(row.balance)}
          </Text>
          {showRate ? (
            <Text style={[styles.cell, styles.rateCol, rateTextStyle, { color: colors.textSecondary }]}>
              {row.rate ?? '—'}
            </Text>
          ) : null}
          {showPayment ? (
            <Text style={[styles.cell, styles.paymentCol, compactAmountStyle, { color: colors.textSecondary }]}>
              {formatWidgetMoney(row.payment)}
            </Text>
          ) : null}
        </View>
      ))}

      <View
        style={[
          styles.totalRow,
          {
            backgroundColor: colors.surfaceElevated,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.totalLabel, styles.nameCol, { color: colors.text }, jakartaBoldText]}>
          {data.total.label.toUpperCase()}
        </Text>
        <Text style={[styles.totalValue, styles.amountCol, amountStyle, { color: palette.green }]}>
          {formatWidgetMoney(data.total.balance)}
        </Text>
        {showRate ? (
          <Text style={[styles.cell, styles.rateCol, rateTextStyle, { color: colors.textSecondary }]}>
            {data.total.rate ?? '—'}
          </Text>
        ) : null}
        {showPayment ? (
          <Text style={[styles.cell, styles.paymentCol, compactAmountStyle, { color: colors.textSecondary }]}>
            {formatWidgetMoney(data.total.payment)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  title: {
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  headerCell: {
    flexShrink: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: CARD_RADIUS - 2,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    flexShrink: 0,
  },
  totalLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontSize: 14,
  },
  nameCol: {
    flex: 1.35,
    minWidth: 0,
  },
  amountCol: {
    flex: 1.05,
    textAlign: 'right',
  },
  rateCol: {
    width: 44,
    textAlign: 'right',
  },
  paymentCol: {
    width: 72,
    textAlign: 'right',
  },
});
