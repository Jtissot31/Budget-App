import { GlassFab } from '@/components/GlassFab';
import { PlusFabIcon } from '@/components/icons/PlusFabIcon';
import { useRouter } from 'expo-router';
import {
  FLOATING_FAB_ICON_SIZE,
  FLOATING_FAB_SIZE,
  FLOATING_SCROLL_SIZE,
} from '@/constants/floatingGlassButton';
import { TRANSACTIONS_FAB_ICON_COLOR_BLUR } from '@/constants/fabStyles';
import { StyleSheet } from 'react-native';

export function Fab() {
  const router = useRouter();

  return (
    <GlassFab
      size={FLOATING_FAB_SIZE}
      style={styles.fab}
      onPress={() => router.push('/add-transaction')}
      accessibilityLabel="Nouvelle transaction"
    >
      <PlusFabIcon size={FLOATING_FAB_ICON_SIZE} color={TRANSACTIONS_FAB_ICON_COLOR_BLUR} />
    </GlassFab>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    /** Keeps prior top edge vs nav before FAB diameter grew (`SCROLL` baseline). */
    bottom: 88 + FLOATING_SCROLL_SIZE - FLOATING_FAB_SIZE,
    zIndex: 100,
  },
});
