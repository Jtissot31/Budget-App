import { useLocalSearchParams } from 'expo-router';
import { PlanDetailScreen } from '@/components/plans/PlanDetailScreen';

export default function PlanDetailRoute() {
  const params = useLocalSearchParams<{ id?: string }>();
  const planId = typeof params.id === 'string' ? params.id.trim() : '';

  return <PlanDetailScreen planId={planId} />;
}
