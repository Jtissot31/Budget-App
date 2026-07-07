import { Redirect, useLocalSearchParams } from 'expo-router';

function readTransactionIdParam(
  raw: string | string[] | undefined,
): string {
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) return (raw[0] ?? '').trim();
  return '';
}

/** Legacy `/transaction-detail?transactionId=…` → `/transaction-detail/[id]`. */
export default function TransactionDetailLegacyRedirect() {
  const params = useLocalSearchParams<{ transactionId?: string | string[] }>();
  const transactionId = readTransactionIdParam(params.transactionId);

  if (!transactionId) {
    return <Redirect href="/(tabs)/transactions" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/transaction-detail/[transactionId]',
        params: { transactionId },
      }}
    />
  );
}
