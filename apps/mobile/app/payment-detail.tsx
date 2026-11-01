/**
 * Direct entry to a recurring payment's detail — opens the payment sheet over the
 * current screen (Accueil, Copilote, prêt…) without passing through the Agenda tab.
 *
 * `/payment-detail?id=<recurring payment id>&date=YYYY-MM-DD` (date optional).
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PaymentDetailSheet, type PaymentDetailPayload } from '@/components/PaymentDetailSheet';
import { getRecurringPayments } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import { ensureDbReady } from '@/lib/init';
import { frequencyLabel } from '@/lib/recurringPaymentsForm';

function formatDateLabel(dateKey: string | null | undefined): string | null {
  if (!dateKey) return null;
  const date = new Date(`${dateKey.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  const label = date.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function PaymentDetailRoute() {
  const router = useRouter();
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const [detail, setDetail] = useState<PaymentDetailPayload | null>(null);

  const close = useCallback(() => {
    setDetail(null);
    if (router.canGoBack()) router.back();
    else router.replace('/goals');
  }, [router]);

  const load = useCallback(async () => {
    await ensureDbReady();
    const payment = (await getRecurringPayments()).find((p) => p.id === id);
    if (!payment) {
      // Unknown payment: fall back to the Agenda instead of an empty sheet.
      router.replace('/goals');
      return;
    }
    setDetail({
      name: payment.name,
      amount: payment.amount,
      account: payment.accountLabel,
      recurring: true,
      sourceId: payment.id,
      kind: payment.kind ?? 'payment',
      dateLabel: formatDateLabel(date ?? payment.nextDate),
      logoUrl: payment.logoUrl,
      icon: payment.icon,
      color: payment.color,
      frequencyLabel: frequencyLabel(payment.frequency),
      frequency: payment.frequency,
      active: payment.active,
      categoryName: payment.categoryName ?? null,
      categoryId: payment.categoryId ?? null,
    });
  }, [date, id, router]);

  useEffect(() => {
    void load();
    return dataEvents.subscribe(() => void load());
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <PaymentDetailSheet
        detail={detail}
        onClose={close}
        onDeleted={() => {
          dataEvents.emit();
          close();
        }}
      />
    </View>
  );
}
