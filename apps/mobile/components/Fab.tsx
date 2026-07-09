import { Pressable, StyleSheet } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { useRouter } from 'expo-router';
import {
  FLOATING_FAB_ICON_SIZE,
  FLOATING_FAB_SIZE,
  FLOATING_SCROLL_SIZE,
  floatingGlassButtonPressed,
  floatingGlassFabSurface,
} from '@/constants/floatingGlassButton';
import { useAppTheme } from '@/lib/themeContext';

export function Fab() {
  const router = useRouter();
  const { colors, ghostCardShadow, isLight } = useAppTheme();
  const surface = floatingGlassFabSurface(colors, isLight);

  return (
    <Pressable
      style={({ pressed }) => [styles.fab, surface, ghostCardShadow, pressed && floatingGlassButtonPressed]}
      onPress={() => router.push('/add-transaction')}
      accessibilityRole="button"
      accessibilityLabel="Nouvelle transaction"
    >
      <AppIcon family="ionicons" name="add" size={FLOATING_FAB_ICON_SIZE} color={colors.text} />
    </Pressable>
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
