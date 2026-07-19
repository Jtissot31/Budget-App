import { StyleSheet, Text, View } from 'react-native';
import { jakartaRegularText } from '@/constants/theme';
import type { AIWidgetData } from '@/types/aiWidgets';
import { normalizeBarChartToCashflowComparison, normalizeCashflowComparisonData } from './widgets/cashflowWidgetUtils';
import { useAIWidgetColors } from './widgets/theme';
import { AlertCardWidget } from './widgets/AlertCardWidget';
import { AllocationChartWidget } from './widgets/AllocationChartWidget';
import { BalanceSummaryWidget } from './widgets/BalanceSummaryWidget';
import { BarChartWidget } from './widgets/BarChartWidget';
import { CashflowComparisonWidget } from './widgets/CashflowComparisonWidget';
import { ComparisonCardWidget } from './widgets/ComparisonCardWidget';
import { DebtTableWidget } from './widgets/DebtTableWidget';
import { LineChartWidget } from './widgets/LineChartWidget';
import { ProgressCardWidget } from './widgets/ProgressCardWidget';

type Props = {
  data: AIWidgetData;
};

function UnknownWidgetFallback({ type }: { type: string }) {
  const palette = useAIWidgetColors();
  return (
    <View style={[styles.fallback, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.fallbackText, { color: palette.textMuted }, jakartaRegularText]}>
        Widget non pris en charge ({type})
      </Text>
    </View>
  );
}

export function AIWidgetRenderer({ data }: Props) {
  let content;
  switch (data.type) {
    case 'progress_card':
      content = <ProgressCardWidget data={data} />;
      break;
    case 'debt_table':
      content = <DebtTableWidget data={data} />;
      break;
    case 'comparison_card':
      content = <ComparisonCardWidget data={data} />;
      break;
    case 'alert_card':
      content = <AlertCardWidget data={data} />;
      break;
    case 'line_chart':
      content = <LineChartWidget data={data} />;
      break;
    case 'bar_chart': {
      const cashflow = normalizeBarChartToCashflowComparison(data);
      content = cashflow ? (
        <CashflowComparisonWidget data={cashflow} />
      ) : (
        <BarChartWidget data={data} />
      );
      break;
    }
    case 'cashflow_comparison': {
      const normalized = normalizeCashflowComparisonData(data);
      content = normalized ? (
        <CashflowComparisonWidget data={normalized} />
      ) : (
        <UnknownWidgetFallback type="cashflow_comparison" />
      );
      break;
    }
    case 'allocation_chart':
      content = <AllocationChartWidget data={data} />;
      break;
    case 'balance_summary_card':
      content = <BalanceSummaryWidget data={data} />;
      break;
    default: {
      const unknownType = (data as { type?: string }).type ?? 'inconnu';
      content = <UnknownWidgetFallback type={unknownType} />;
    }
  }

  return <View style={styles.container}>{content}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'stretch',
  },
  fallback: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 12,
  },
  fallbackText: {
    fontSize: 13,
  },
});
