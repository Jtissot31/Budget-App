import { StyleSheet, View } from 'react-native';
import { PlanCard } from '@/components/plans/PlanCard';
import type { Plan } from '@/lib/plans/Plan';
import { PLAN_HOME_ROW } from '@/lib/plans/planCardPresentation';

type Props = {
  plans: Plan[];
  onOpenPlan: (planId: string) => void;
};

/** Liste verticale « Tes plans » — même `PlanCard` `layout="home"` que Accueil. */
export function PlanHubCardCarousel({ plans, onOpenPlan }: Props) {
  return (
    <View style={styles.list}>
      {plans.map((plan) => (
        <PlanCard
          key={plan.id}
          plan={plan}
          suggested={plan.statut === 'suggere'}
          layout="home"
          onPress={() => onOpenPlan(plan.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: PLAN_HOME_ROW.listGap,
    alignSelf: 'stretch',
  },
});
