/**
 * « + » speed dial: one green bubble that opens a few action bubbles with their labels.
 * The open state lives in a transparent Modal so the backdrop covers the whole screen
 * and every bubble stays tappable (nothing hangs outside the tab bar's bounds).
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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
import { usePressScale } from '@/components/kit/motion';
import { TRANSACTIONS_FAB_SIZE, transactionsSolidFabStyle } from '@/constants/fabStyles';
import { jakartaSemiboldText } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export type SpeedDialAction<K extends string> = { key: K; label: string; icon: string };

const ACTION_SIZE = 52;
const ACTION_GAP = 14;
const LABEL_HEIGHT = 34;
const CLOSE_MS = 160;

type Props<K extends string> = {
  /** Listed top to bottom; the last one sits right above the « + ». */
  actions: readonly SpeedDialAction<K>[];
  onChoose: (key: K) => void;
  accessibilityLabel: string;
  /** Position of the closed bubble (absolute, relative to the tab bar host). */
  style?: StyleProp<ViewStyle>;
  /** Distance from the screen bottom to the closed bubble's bottom edge. */
  bottomOffset: number;
  rightOffset: number;
};

export function SpeedDialFab<K extends string>({
  actions,
  onChoose,
  accessibilityLabel,
  style,
  bottomOffset,
  rightOffset,
}: Props<K>) {
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

  const choose = (key: K) => {
    tapHaptic();
    closeMenu(() => onChoose(key));
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const plusRotation = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 135}deg` }] }));

  const fabGlyph = isLight ? '#FFFFFF' : '#0A0A0A';
  // Flat charcoal, a few steps above the page so the type buttons read clearly — no glass, no shadow.
  const actionFill = isLight ? colors.surfaceElevated : '#2C2C30';

  return (
    <>
      {/* Closed bubble — lives in the tab bar host. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
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
          {actions.map((action, index) => (
            <ActionBubble
              key={action.key}
              label={action.label}
              icon={action.icon}
              // Bubble nearest the « + » appears first.
              order={actions.length - 1 - index}
              progress={progress}
              glyphColor={colors.text}
              fill={actionFill}
              onPress={() => choose(action.key)}
            />
          ))}

          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => closeMenu()} style={styles.mainSlot}>
            <Animated.View style={[transactionsSolidFabStyle(colors.accentGreen), styles.noShadow, plusRotation]}>
              <AppIcon family="ionicons" name="add" size={30} color={fabGlyph} />
            </Animated.View>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

function ActionBubble({
  label,
  icon,
  order,
  progress,
  glyphColor,
  fill,
  onPress,
}: {
  label: string;
  icon: string;
  order: number;
  progress: SharedValue<number>;
  glyphColor: string;
  fill: string;
  onPress: () => void;
}) {
  const press = usePressScale(0.9);
  // Each bubble starts tucked behind the « + » and springs up to its slot, staggered.
  const travel = (order + 1) * (ACTION_SIZE + ACTION_GAP);
  const local = useSharedValue(0);
  useEffect(() => {
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
        <View style={[styles.label, { backgroundColor: fill }]}>
          <Text style={[styles.labelText, { color: glyphColor }]}>{label}</Text>
        </View>
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ajouter : ${label}`}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        hitSlop={6}
      >
        <Animated.View style={press.animatedStyle}>
          <View style={[styles.bubble, { backgroundColor: fill }]}>
            <AppIcon family="ionicons" name={icon} size={22} color={glyphColor} />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  backdrop: { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  stack: { position: 'absolute', alignItems: 'flex-end', gap: ACTION_GAP },
  mainSlot: { width: TRANSACTIONS_FAB_SIZE, height: TRANSACTIONS_FAB_SIZE },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    // Center the smaller action bubble on the « + » axis.
    marginRight: (TRANSACTIONS_FAB_SIZE - ACTION_SIZE) / 2,
  },
  label: { height: LABEL_HEIGHT, paddingHorizontal: 14, borderRadius: LABEL_HEIGHT / 2, justifyContent: 'center' },
  labelText: { ...jakartaSemiboldText, fontSize: 14, lineHeight: 18 },
  bubble: { width: ACTION_SIZE, height: ACTION_SIZE, borderRadius: ACTION_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  noShadow: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
});
