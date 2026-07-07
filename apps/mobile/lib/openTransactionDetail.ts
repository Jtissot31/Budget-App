import { router } from 'expo-router';

/** Open transaction detail — dynamic segment route (web + native). */
export function openTransactionDetail(transactionId: string): void {
  const id = transactionId.trim();
  if (!id) return;
  router.push({
    pathname: '/transaction-detail/[transactionId]',
    params: { transactionId: id },
  });
}
