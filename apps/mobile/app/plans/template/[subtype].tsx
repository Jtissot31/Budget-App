import { useLocalSearchParams } from 'expo-router';
import { PlanTemplateDetailScreen } from '@/components/plans/PlanTemplateDetailScreen';
import { isPlanSubtypeForCategory, planCategoryForSubtype, type PlanCategory, type PlanSubtype } from '@/lib/plans/Plan';

type Params = {
  subtype: string;
  raison?: string;
  suggestedId?: string;
};

export default function PlanTemplateRoute() {
  const params = useLocalSearchParams<Params>();
  const subtype = (params.subtype ?? 'fonds_urgence') as PlanSubtype;
  const category = planCategoryForSubtype(subtype);
  const safeSubtype = isPlanSubtypeForCategory(category, subtype) ? subtype : ('fonds_urgence' as PlanSubtype);

  return (
    <PlanTemplateDetailScreen
      subtype={safeSubtype}
      raison={typeof params.raison === 'string' ? params.raison : undefined}
    />
  );
}
