import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { DashboardAccountBalanceCard } from '@/components/DashboardAccountBalanceCard';
import { planFinanceContainerPressedStyle } from '@/constants/planFinanceKit';
import { spacing } from '@/constants/theme';
import { resolveSimulatedAccountLogoUrl } from '@/lib/accountBalancePresentation';
import { tapHaptic } from '@/lib/haptics';
import type { SimulatedAccount } from '@/types';

type Props = {
  accounts: SimulatedAccount[];
  onAccountPress: (account: SimulatedAccount) => void;
  onReorder: (nextAccounts: SimulatedAccount[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

const ACCOUNT_DRAG_ACTIVATION_MS = 280;

function resolveAccountLogoUrl(account: SimulatedAccount) {
  return resolveSimulatedAccountLogoUrl(account);
}

function AccountBalanceSortableTile({
  account,
  onPress,
  showReorderAffordance,
}: {
  account: SimulatedAccount;
  onPress: () => void;
  showReorderAffordance: boolean;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <Sortable.Touchable
      accessibilityRole="button"
      accessibilityLabel={`Compte ${account.name}`}
      accessibilityHint={
        showReorderAffordance
          ? "Maintiens appuyé puis fais glisser pour changer l'ordre."
          : undefined
      }
      onTap={onPress}
      onTouchesDown={() => setPressed(true)}
      onTouchesUp={() => setPressed(false)}
      style={[styles.tilePressable, pressed && planFinanceContainerPressedStyle()]}
    >
      <DashboardAccountBalanceCard account={account} logoUrl={resolveAccountLogoUrl(account)} />
    </Sortable.Touchable>
  );
}

export function ReorderableAccountBalanceList({
  accounts,
  onAccountPress,
  onReorder,
  onDragStateChange,
}: Props) {
  const [items, setItems] = useState(accounts);

  useEffect(() => {
    setItems(accounts);
  }, [accounts]);

  const showReorderAffordance = items.length >= 2;

  const renderItem = useCallback<SortableGridRenderItem<SimulatedAccount>>(
    ({ item }) => (
      <AccountBalanceSortableTile
        account={item}
        showReorderAffordance={showReorderAffordance}
        onPress={() => {
          onAccountPress(item);
        }}
      />
    ),
    [onAccountPress, showReorderAffordance],
  );

  return (
    <View style={styles.grid}>
      <Sortable.Grid
        columns={2}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        rowGap={spacing.xl}
        columnGap={spacing.lg}
        sortEnabled={showReorderAffordance}
        dragActivationDelay={ACCOUNT_DRAG_ACTIVATION_MS}
        activeItemScale={1.02}
        activeItemOpacity={0.96}
        inactiveItemOpacity={1}
        inactiveItemScale={1}
        overDrag="vertical"
        onDragStart={() => {
          tapHaptic();
          onDragStateChange?.(true);
        }}
        onDragEnd={({ data }) => {
          onDragStateChange?.(false);
          setItems(data);
          onReorder(data);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    width: '100%',
  },
  tilePressable: {
    width: '100%',
    minWidth: 0,
  },
});
