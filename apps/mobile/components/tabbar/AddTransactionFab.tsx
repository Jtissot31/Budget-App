/**
 * Transactions « + »: opens Dépense / Revenu / Transfert, each launching the add form preset to that type.
 */
import type { StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { SpeedDialFab, type SpeedDialAction } from '@/components/tabbar/SpeedDialFab';

type TxType = 'expense' | 'income' | 'transfer';

const ACTIONS: SpeedDialAction<TxType>[] = [
  { key: 'transfer', label: 'Transfert', icon: 'swap-horizontal' },
  { key: 'income', label: 'Revenu', icon: 'arrow-down' },
  { key: 'expense', label: 'Dépense', icon: 'arrow-up' },
];

type Props = {
  style?: StyleProp<ViewStyle>;
  bottomOffset: number;
  rightOffset: number;
};

export function AddTransactionFab(props: Props) {
  const router = useRouter();
  return (
    <SpeedDialFab
      {...props}
      actions={ACTIONS}
      accessibilityLabel="Ajouter une transaction"
      onChoose={(type) => router.push({ pathname: '/add-transaction', params: { type } })}
    />
  );
}
