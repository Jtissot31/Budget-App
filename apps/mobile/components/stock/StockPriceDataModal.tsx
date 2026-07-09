import { useMemo, useState } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeSegmentedControl } from '@/components/ThemeSegmentedControl';
import type { NetWorthChartPeriod } from '@/components/PortfolioChartCard';
import { STOCK_PRICE_HISTORY_SUBTITLES } from '@/constants/mockStockDetail';
import type { MockStockHolding } from '@/constants/mockStockPortfolio';
import {
  buildStockPriceHistoryRows,
  STOCK_NET_WORTH_CHART_PERIODS,
} from '@/lib/intradayStockSparkline';
import { formatDisplayMoney } from '@/lib/formatDisplayMoney';
import {
  jakartaExtraBoldText,
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  holding: MockStockHolding;
  displayTicker: string;
  initialPeriod?: NetWorthChartPeriod;
};

function formatHistoryPrice(value: number): string {
  const { main } = formatDisplayMoney(value);
  return `${main} $`;
}

export function StockPriceDataModal({
  visible,
  onClose,
  holding,
  displayTicker,
  initialPeriod = '1J',
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [period, setPeriod] = useState<NetWorthChartPeriod>(initialPeriod);

  const rows = useMemo(
    () => buildStockPriceHistoryRows(holding, period),
    [holding, period],
  );

  const periodTabs = useMemo(
    () => STOCK_NET_WORTH_CHART_PERIODS.map((id) => ({ id, label: id })),
    [],
  );

  const subtitle = `Prix de ${displayTicker} pour ${STOCK_PRICE_HISTORY_SUBTITLES[period] ?? 'la période'}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerSide} />
          <Text style={[styles.title, { color: colors.text }]}>Données de prix</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            hitSlop={12}
            onPress={onClose}
            style={styles.headerSide}
          >
            <AppIcon family="ionicons" name="close" size={24} color={colors.text} />
          </Pressable>
        </View>

        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>

        <View style={styles.periodRow}>
          <ThemeSegmentedControl
            tabs={periodTabs}
            active={period}
            onChange={setPeriod}
            showDivider={false}
            size="sm"
            variant="section"
            trackBgColor="transparent"
          />
        </View>

        <View style={[styles.tableHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.tableHeaderText, { color: colors.textMuted }]}>Date</Text>
          <Text style={[styles.tableHeaderText, styles.tableHeaderRight, { color: colors.textMuted }]}>
            Prix ({holding.ticker.endsWith('.TO') ? 'CAD' : 'USD'})
          </Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.xl) }}
        >
          {rows.map((row, index) => (
            <View
              key={`${row.dateLabel}-${index}`}
              style={[
                styles.tableRow,
                index < rows.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text style={[styles.dateCell, { color: colors.textMuted }]}>{row.dateLabel}</Text>
              <Text style={[moneyAmountTypography({ tier: 'row' }), styles.priceCell, { color: colors.text }]}>
                {formatHistoryPrice(row.price)}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerSide: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...jakartaExtraBoldText,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  subtitle: {
    ...typographyKit.metaMedium,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  periodRow: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableHeaderText: {
    fontSize: 13,
  },
  tableHeaderRight: {
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  dateCell: {
    ...typographyKit.metaMedium,
    flex: 1,
  },
  priceCell: {
    textAlign: 'right',
  },
});
