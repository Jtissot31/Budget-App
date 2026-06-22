import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { DashboardAccountBalanceCard } from '@/components/DashboardAccountBalanceCard';
import { spacing } from '@/constants/theme';
import { getAccountLogoUrl } from '@/lib/merchantLogo';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
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
  const { colors } = useAppTheme();
  const [items, setItems] = useState(accounts);

  useEffect(() => {
    setItems(accounts);
  }, [accounts]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Appui long pour réorganiser
      </Text>
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
        containerStyle={styles.list}
        renderItem={({ item, drag, isActive }: RenderItemParams<SimulatedAccount>) => (
          <ScaleDecorator activeScale={1.02}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Compte ${item.name}. Appui long pour réorganiser.`}
              accessibilityHint="Maintiens appuyé puis fais glisser pour changer l'ordre."
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
              />
            </Pressable>
          </ScaleDecorator>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
  },
  list: {
    gap: spacing.md,
  },
  itemShell: {
    width: '100%',
  },
  itemDragging: {
    opacity: 0.96,
  },
  pressed: {
    opacity: 0.92,
  },
});
