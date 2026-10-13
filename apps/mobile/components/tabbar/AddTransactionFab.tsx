/**
 * Transactions « + » speed dial: one green bubble that opens three type bubbles
 * (Dépense / Revenu / Transfert), each launching the add form preset to that type.
 * The open state lives in a transparent Modal so the backdrop covers the whole screen
 * and every bubble stays tappable (nothing hangs outside the tab bar's bounds).
 * Bubbles and labels are real liquid glass: a snapshot of the screen, magnified per lens.
 */
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type LayoutRectangle, type StyleProp, type ViewStyle } from 'react-native';
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
import { captureBackdrop, GlassLens, type GlassBackdrop } from '@/components/kit/GlassLens';
import { usePressScale } from '@/components/kit/motion';
import { TRANSACTIONS_FAB_SIZE, transactionsSolidFabStyle } from '@/constants/fabStyles';
import { jakartaSemiboldText } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type TxType = 'expense' | 'income' | 'transfer';

const ACTIONS: { type: TxType; label: string; icon: string }[] = [
  { type: 'transfer', label: 'Transfert', icon: 'swap-horizontal' },
  { type: 'income', label: 'Revenu', icon: 'arrow-down' },
  { type: 'expense', label: 'Dépense', icon: 'arrow-up' },
];

const ACTION_SIZE = 52;
const ACTION_GAP = 14;
const LABEL_HEIGHT = 34;
const CLOSE_MS = 160;

type Point = { x: number; y: number };

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
  const [backdrop, setBackdrop] = useState<GlassBackdrop | null>(null);
  const [stackOrigin, setStackOrigin] = useState<Point | null>(null);
  const stackRef = useRef<View>(null);
  const progress = useSharedValue(0);
  const press = usePressScale(0.9);

  useEffect(() => {
    if (open) progress.value = withSpring(1, { damping: 16, stiffness: 220, mass: 0.7 });
  }, [open, progress]);

  const openMenu = () => {
    tapHaptic();
    setBackdrop(null);
    // Start the snapshot first (it reads the screen before the overlay draws), then open
    // immediately — never wait on it. The glass fades in while the bubbles spring up.
    void captureBackdrop().then(setBackdrop);
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

        <View
          ref={stackRef}
          pointerEvents="box-none"
          style={[styles.stack, { bottom: bottomOffset, right: rightOffset }]}
          onLayout={() => stackRef.current?.measureInWindow((x, y) => setStackOrigin({ x, y }))}
        >
          {ACTIONS.map((action, index) => (
            <ActionBubble
              key={action.type}
              action={action}
              // Bubble nearest the « + » appears first.
              order={ACTIONS.length - 1 - index}
              progress={progress}
              glyphColor={colors.text}
              backdrop={backdrop}
              stackOrigin={stackOrigin}
              onPress={() => choose(action.type)}
            />
          ))}

          <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => closeMenu()} style={styles.mainSlot}>
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
  glyphColor,
  backdrop,
  stackOrigin,
  onPress,
}: {
  action: (typeof ACTIONS)[number];
  order: number;
  progress: SharedValue<number>;
  glyphColor: string;
  backdrop: GlassBackdrop | null;
  stackOrigin: Point | null;
  onPress: () => void;
}) {
  const press = usePressScale(0.9);
  const [row, setRow] = useState<LayoutRectangle | null>(null);
  const [labelWidth, setLabelWidth] = useState(0);
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

  // Lens centres in window coordinates — the final (settled) positions of bubble and label.
  const rowCenterY = stackOrigin && row ? stackOrigin.y + row.y + row.height / 2 : null;
  const bubbleCenter =
    stackOrigin && row && rowCenterY != null ? { x: stackOrigin.x + row.x + row.width - ACTION_SIZE / 2, y: rowCenterY } : null;
  const labelCenter =
    stackOrigin && row && rowCenterY != null && labelWidth > 0
      ? { x: stackOrigin.x + row.x + labelWidth / 2, y: rowCenterY }
      : null;

  return (
    <Animated.View style={[styles.actionRow, animated]} onLayout={(event) => setRow(event.nativeEvent.layout)}>
      <Animated.View style={labelAnimated}>
        <View style={styles.label} onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}>
          {labelWidth > 0 ? (
            <GlassLens
              backdrop={backdrop}
              center={labelCenter}
              width={labelWidth}
              height={LABEL_HEIGHT}
              radius={LABEL_HEIGHT / 2}
              magnification={1}
              blur={14}
              tintStrength={0.45}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Text style={[styles.labelText, { color: glyphColor }]}>{action.label}</Text>
        </View>
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
          <GlassLens
            backdrop={backdrop}
            center={bubbleCenter}
            width={ACTION_SIZE}
            height={ACTION_SIZE}
            radius={ACTION_SIZE / 2}
            magnification={1.2}
            blur={1}
          >
            <AppIcon family="ionicons" name={action.icon} size={22} color={glyphColor} />
          </GlassLens>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  // Light dim so the content behind stays visible through the glass.
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
  labelText: { ...jakartaSemiboldText, fontSize: 14 },
});
