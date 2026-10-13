/**
 * Transactions « + » speed dial: one green bubble that opens three type bubbles
 * (Dépense / Revenu / Transfert), each launching the add form preset to that type.
 * The open state lives in a transparent Modal so the backdrop covers the whole screen
 * and every bubble stays tappable (nothing hangs outside the tab bar's bounds).
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { AppIcon } from '@/components/icons/AppIcon';
import { LiquidGlass } from '@/components/kit/LiquidGlass';
import { usePressScale } from '@/components/kit/motion';
import { TRANSACTIONS_FAB_SIZE, transactionsSolidFabStyle } from '@/constants/fabStyles';
import { jakartaSemiboldText } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type TxType = 'expense' | 'income' | 'transfer';

/** Monochrome bubbles (card surface + text-colour glyph) — the green « + » stays the only accent. */
const ACTIONS: { type: TxType; label: string; icon: string }[] = [
  { type: 'transfer', label: 'Transfert', icon: 'swap-horizontal' },
  { type: 'income', label: 'Revenu', icon: 'arrow-down' },
  { type: 'expense', label: 'Dépense', icon: 'arrow-up' },
];

const ACTION_SIZE = 50;
const ACTION_GAP = 14;
const CLOSE_MS = 160;

type Props = {
  /** Position of the closed bubble (absolute, relative to the tab bar host). */
  style?: StyleProp<ViewStyle>;
  /** Distance from the screen bottom to the closed bubble's bottom edge. */
  bottomOffset: number;
  rightOffset: number;
};

export function AddTransactionFab({ style, bottomOffset, rightOffset }: Props) {
  const router = useRouter();
  const { colors, isLight } = useAppTheme();
  const [open, setOpen] = useState(false);
  const progress = useSharedValue(0);
  const press = usePressScale(0.9);

  useEffect(() => {
    if (open) progress.value = withSpring(1, { damping: 16, stiffness: 220, mass: 0.7 });
  }, [open, progress]);

  const openMenu = () => {
    tapHaptic();
    setOpen(true);
  };

  const closeMenu = (after?: () => void) => {
    progress.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.quad) });
    setTimeout(() => {
      setOpen(false);
      after?.();
    }, CLOSE_MS);
  };

  const choose = (type: TxType) => {
    tapHaptic();
    closeMenu(() => router.push({ pathname: '/add-transaction', params: { type } }));
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const plusRotation = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 135}deg` }] }));

  const fabGlyph = isLight ? '#FFFFFF' : '#0A0A0A';

  return (
    <>
      {/* Closed bubble — lives in the tab bar host, next to the voice FAB. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ajouter une transaction"
        accessibilityState={{ expanded: open }}
        onPress={openMenu}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[style, open && styles.hidden]}
      >
        <Animated.View style={[transactionsSolidFabStyle(colors.accentGreen), press.animatedStyle]}>
          <AppIcon family="ionicons" name="add" size={30} color={fabGlyph} />
        </Animated.View>
      </Pressable>

      <Modal visible={open} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => closeMenu()}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Fermer le menu" onPress={() => closeMenu()} />
        </Animated.View>

        <View pointerEvents="box-none" style={[styles.stack, { bottom: bottomOffset, right: rightOffset }]}>
          {ACTIONS.map((action, index) => (
            <ActionBubble
              key={action.type}
              action={action}
              // Bubble nearest the « + » appears first.
              order={ACTIONS.length - 1 - index}
              progress={progress}
              labelColor={colors.text}
              labelBackground={isLight ? '#FFFFFF' : colors.surface}
              bubbleBackground={isLight ? '#FFFFFF' : colors.surface}
              bubbleBorder={colors.containerBorder}
              onPress={() => choose(action.type)}
            />
          ))}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            onPress={() => closeMenu()}
            style={styles.mainSlot}
          >
            <Animated.View style={[transactionsSolidFabStyle(colors.accentGreen), plusRotation]}>
              <AppIcon family="ionicons" name="add" size={30} color={fabGlyph} />
            </Animated.View>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function ActionBubble({
  action,
  order,
  progress,
  labelColor,
  labelBackground,
  bubbleBackground,
  bubbleBorder,
  onPress,
}: {
  action: (typeof ACTIONS)[number];
  order: number;
  progress: SharedValue<number>;
  labelColor: string;
  labelBackground: string;
  bubbleBackground: string;
  bubbleBorder: string;
  onPress: () => void;
}) {
  const press = usePressScale(0.9);
  // Each bubble starts tucked behind the « + » and springs up to its slot, staggered.
  const travel = (order + 1) * (ACTION_SIZE + ACTION_GAP);
  const local = useSharedValue(0);
  useEffect(() => {
    // Mirror the shared progress with a per-bubble delay so they pop in one after another.
    local.value = 0;
    local.value = withDelay(order * 45, withSpring(1, { damping: 14, stiffness: 240, mass: 0.6 }));
  }, [local, order]);

  const animated = useAnimatedStyle(() => {
    const p = Math.min(local.value, progress.value);
    return {
      opacity: interpolate(p, [0, 0.4, 1], [0, 1, 1]),
      transform: [
        { translateY: interpolate(p, [0, 1], [travel, 0]) },
        { scale: interpolate(p, [0, 1], [0.5, 1]) },
      ],
    };
  });
  const labelAnimated = useAnimatedStyle(() => {
    const p = Math.min(local.value, progress.value);
    return { opacity: interpolate(p, [0.5, 1], [0, 1], 'clamp'), transform: [{ translateX: interpolate(p, [0, 1], [12, 0]) }] };
  });

  return (
    <Animated.View style={[styles.actionRow, animated]}>
      <Animated.View style={labelAnimated}>
        <LiquidGlass radius={16} style={styles.label}>
          <Text style={[styles.labelText, { color: labelColor }]}>{action.label}</Text>
        </LiquidGlass>
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ajouter : ${action.label}`}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={6}
      >
        <Animated.View style={press.animatedStyle}>
          <LiquidGlass radius={ACTION_SIZE / 2} style={styles.action}>
            <AppIcon family="ionicons" name={action.icon} size={22} color={labelColor} />
          </LiquidGlass>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.55)' },
  stack: { position: 'absolute', alignItems: 'flex-end', gap: ACTION_GAP },
  mainSlot: { width: TRANSACTIONS_FAB_SIZE, height: TRANSACTIONS_FAB_SIZE },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // Center the smaller action bubble on the « + » axis.
    marginRight: (TRANSACTIONS_FAB_SIZE - ACTION_SIZE) / 2,
  },
  label: { paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center' },
  labelText: { ...jakartaSemiboldText, fontSize: 14 },
  action: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
