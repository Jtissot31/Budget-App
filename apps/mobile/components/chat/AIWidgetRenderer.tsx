import { StyleSheet, Text, View } from 'react-native';
import { jakartaRegularText } from '@/constants/theme';
import type { AIWidgetData } from '@/types/aiWidgets';
import { useAIChatColors } from '@/components/ai-chat/theme';
import { AlertCardWidget } from './widgets/AlertCardWidget';
import { AllocationChartWidget } from './widgets/AllocationChartWidget';
import { BarChartWidget } from './widgets/BarChartWidget';
import { ComparisonCardWidget } from './widgets/ComparisonCardWidget';
import { DebtTableWidget } from './widgets/DebtTableWidget';
import { LineChartWidget } from './widgets/LineChartWidget';
import { ProgressCardWidget } from './widgets/ProgressCardWidget';

type Props = {
  data: AIWidgetData;
};

function UnknownWidgetFallback({ type }: { type: string }) {
  const palette = useAIChatColors();
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
    case 'bar_chart':
      content = <BarChartWidget data={data} />;
      break;
    case 'allocation_chart':
      content = <AllocationChartWidget data={data} />;
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
