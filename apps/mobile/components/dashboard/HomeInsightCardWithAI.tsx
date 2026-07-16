import { useEffect, useState } from 'react';
import { HomeInsightCard } from '@/components/dashboard/HomeInsightCard';
import type { AlertCenterItem } from '@/lib/alerts';
import { generateHomeInsightMessage } from '@/lib/ai/homeInsightService';

type Props = {
  insight: AlertCenterItem;
  onPress: () => void;
};

export function HomeInsightCardWithAI({ insight, onPress }: Props) {
  const [message, setMessage] = useState(insight.message);

  useEffect(() => {
    let cancelled = false;
    setMessage(insight.message);

    async function loadMessage() {
      const refined = await generateHomeInsightMessage({
        kind: insight.kind,
        title: insight.title,
        message: insight.message,
        paymentName: insight.paymentName,
        montant: insight.montant,
      });
      if (cancelled || !refined) return;
      setMessage(refined);
    }

    void loadMessage();
    return () => {
      cancelled = true;
    };
  }, [insight.id, insight.kind, insight.title, insight.message, insight.paymentName, insight.montant]);

  return (
    <HomeInsightCard title={insight.title} message={message} onPress={onPress} />
  );
}
