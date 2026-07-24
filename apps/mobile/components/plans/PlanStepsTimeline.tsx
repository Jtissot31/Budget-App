import type { PlanFinancier } from '@/lib/dashboardPlansMock';
import { timelineStepsFromPlan } from '@/lib/plans/planTimelineModel';
import { PlanTimeline } from './PlanTimeline';

type Props = {
  plan: PlanFinancier;
};

/** In-progress plan steps — adapter over the shared {@link PlanTimeline}. */
export function PlanStepsTimeline({ plan }: Props) {
  return <PlanTimeline steps={timelineStepsFromPlan(plan)} />;
}
