import { AIChatAdvisorScreen } from '@/components/ai-chat/AIChatAdvisorScreen';
import { PageTransition } from '@/components/PageTransition';

export default function FynChatScreen() {
  return (
    <PageTransition>
      <AIChatAdvisorScreen tabBarVisible={false} showBackButton />
    </PageTransition>
  );
}
