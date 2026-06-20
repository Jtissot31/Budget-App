import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/constants/theme';
import type { DebtTableData } from '@/types/aiWidgets';
import { AI_WIDGET_RADIUS, aiWidgetFonts, useAIWidgetColors } from './theme';

type Props = {
  data: DebtTableData;
};

export function DebtTableWidget({ data }: Props) {
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
    <View style={[styles.card, { backgroundColor: palette.surface, padding: palette.padding }]}>
      {data.label ? (
        <Text style={[styles.title, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
          {data.label.toUpperCase()}
        </Text>
      ) : null}

      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.nameCol, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
          {columns.name}
        </Text>
        <Text style={[styles.headerCell, styles.amountCol, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
          {columns.balance}
        </Text>
        {showRate ? (
          <Text style={[styles.headerCell, styles.rateCol, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
            {columns.rate}
          </Text>
        ) : null}
        {showPayment ? (
          <Text style={[styles.headerCell, styles.rateCol, { color: palette.textMuted, fontFamily: aiWidgetFonts.label }]}>
            {columns.payment}
          </Text>
        ) : null}
      </View>

      {data.rows.map((row) => (
        <View key={`${row.name}-${row.balance}`} style={[styles.row, { borderTopColor: palette.background }]}>
          <Text
            style={[styles.cell, styles.nameCol, { color: palette.text, fontFamily: aiWidgetFonts.labelRegular }]}
            numberOfLines={2}
          >
            {row.name}
          </Text>
          <Text style={[styles.cell, styles.amountCol, { color: palette.text, fontFamily: aiWidgetFonts.mono }]}>
            {row.balance}
          </Text>
          {showRate ? (
            <Text style={[styles.cell, styles.rateCol, { color: palette.textMuted, fontFamily: aiWidgetFonts.monoRegular }]}>
              {row.rate ?? '—'}
            </Text>
          ) : null}
          {showPayment ? (
            <Text style={[styles.cell, styles.rateCol, { color: palette.textMuted, fontFamily: aiWidgetFonts.monoRegular }]}>
              {row.payment ?? '—'}
            </Text>
          ) : null}
        </View>
      ))}

      <View style={[styles.totalRow, { backgroundColor: palette.background, borderTopColor: palette.background }]}>
        <Text style={[styles.totalLabel, styles.nameCol, { color: palette.text, fontFamily: aiWidgetFonts.label }]}>
          {data.total.label.toUpperCase()}
        </Text>
        <Text style={[styles.totalValue, styles.amountCol, { color: palette.green, fontFamily: aiWidgetFonts.mono }]}>
          {data.total.balance}
        </Text>
        {showRate ? (
          <Text style={[styles.cell, styles.rateCol, { color: palette.textMuted, fontFamily: aiWidgetFonts.monoRegular }]}>
            {data.total.rate ?? '—'}
          </Text>
        ) : null}
        {showPayment ? (
          <Text style={[styles.cell, styles.rateCol, { color: palette.textMuted, fontFamily: aiWidgetFonts.monoRegular }]}>
            {data.total.payment ?? '—'}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: AI_WIDGET_RADIUS,
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
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
    borderRadius: AI_WIDGET_RADIUS,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    fontSize: 13,
  },
  totalLabel: {
    fontSize: 11,
    letterSpacing: 0.6,
  },
  totalValue: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  nameCol: {
    flex: 1.4,
    minWidth: 0,
  },
  amountCol: {
    flex: 1,
    textAlign: 'right',
  },
  rateCol: {
    width: 52,
    textAlign: 'right',
  },
});
