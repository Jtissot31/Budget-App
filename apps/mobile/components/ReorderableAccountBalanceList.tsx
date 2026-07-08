import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { DashboardAccountBalanceCard } from '@/components/DashboardAccountBalanceCard';
import { DashboardCard } from '@/components/DashboardCard';
import { getAccountLogoUrl } from '@/lib/merchantLogo';
import { tapHaptic } from '@/lib/haptics';
import type { SimulatedAccount } from '@/types';

type Props = {
  accounts: SimulatedAccount[];
  onAccountPress: (account: SimulatedAccount) => void;
  onReorder: (nextAccounts: SimulatedAccount[]) => void;
  onDragStateChange?: (dragging: boolean) => void;
};

function resolveAccountLogoUrl(account: SimulatedAccount) {
  return (
    account.logoUrl ??
    getAccountLogoUrl(account.institution?.trim() || account.name) ??
    getAccountLogoUrl(account.name)
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

  return (
    <DashboardCard padding={0} innerStyle={styles.groupCard}>
      <DraggableFlatList
        data={items}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        activationDistance={12}
        onDragBegin={() => {
          tapHaptic();
          onDragStateChange?.(true);
        }}
        onDragEnd={({ data }) => {
          onDragStateChange?.(false);
          setItems(data);
          onReorder(data);
        }}
        renderItem={({ item, drag, isActive, getIndex }: RenderItemParams<SimulatedAccount>) => {
          const index = getIndex();
          const isLast = index != null && index === items.length - 1;

          return (
            <ScaleDecorator activeScale={1.02}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Compte ${item.name}`}
                accessibilityHint={
                  showReorderAffordance
                    ? 'Maintiens appuyé puis fais glisser pour changer l\'ordre.'
                    : undefined
                }
                onPress={() => {
                  if (isActive) return;
                  onAccountPress(item);
                }}
                onLongPress={drag}
                delayLongPress={280}
                style={({ pressed }) => [
                  styles.itemShell,
                  isActive && styles.itemDragging,
                  pressed && !isActive && styles.pressed,
                ]}
              >
                <DashboardAccountBalanceCard
                  account={item}
                  logoUrl={resolveAccountLogoUrl(item)}
                  embedded
                  isLast={isLast}
                />
              </Pressable>
            </ScaleDecorator>
          );
        }}
      />
    </DashboardCard>
  );
}

const styles = StyleSheet.create({
  groupCard: {
    overflow: 'hidden',
  },
  itemShell: {
    minWidth: 0,
  },
  itemDragging: {
    opacity: 0.96,
  },
  pressed: {
    opacity: 0.92,
  },
});
