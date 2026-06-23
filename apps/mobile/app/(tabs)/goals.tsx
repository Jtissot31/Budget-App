import { AIChatAdvisorScreen } from '@/components/ai-chat/AIChatAdvisorScreen';
import { PageTransition } from '@/components/PageTransition';

export default function GoalsTab() {
  return (
    <PageTransition>
      <AIChatAdvisorScreen tabBarVisible showBackButton={false} />
    </PageTransition>
  );
}
