import { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { interNumericExtraBoldText, radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;

/** Expands touch area into key gaps without changing layout. */
const KEY_HIT_SLOP = { top: 10, bottom: 10, left: 8, right: 8 } as const;

/** Keeps the press active when the finger drifts slightly off the key. */
const KEY_PRESS_RETENTION = { top: 24, bottom: 24, left: 16, right: 16 } as const;

/** Cancel key press when the finger moves this far — scroll vs intentional tap. */
const MOVE_CANCEL_PX = 10;

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function GhostNumpad({ value, onChange }: Props) {
  const press = (key: string) => {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.' && value.includes('.')) return;
    const next = value + key;
    const decimals = next.split('.')[1];
    if (decimals && decimals.length > 2) return;
    onChange(next);
  };

  return (
    <View style={styles.grid}>
      {KEYS.map((k) => (
        <AnimatedKey key={k} label={k} onPress={() => press(k)} />
      ))}
    </View>
  );
}

function AnimatedKey({ label, onPress }: { label: string; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const cancelledByMove = useRef(false);
  const { colors } = useAppTheme();

  const animateTo = (value: number) => {
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 28,
      bounciness: 7,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '⌫' ? 'Effacer' : label}
      delayLongPress={500}
      hitSlop={KEY_HIT_SLOP}
      pressRetentionOffset={KEY_PRESS_RETENTION}
      onPressIn={(e) => {
        cancelledByMove.current = false;
        touchStartX.current = e.nativeEvent.pageX;
        touchStartY.current = e.nativeEvent.pageY;
        animateTo(0.94);
      }}
      onTouchMove={(e) => {
        if (cancelledByMove.current) return;
        const dx = Math.abs(e.nativeEvent.pageX - touchStartX.current);
        const dy = Math.abs(e.nativeEvent.pageY - touchStartY.current);
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
          cancelledByMove.current = true;
          animateTo(1);
        }
      }}
      onPress={() => {
        // Only commit on a real tap. ScrollView cancels onPress when it steals
        // the gesture; movement threshold covers residual scroll-start cases.
        if (cancelledByMove.current) return;
        onPress();
      }}
      onPressOut={() => {
        animateTo(1);
      }}
      android_ripple={
        Platform.OS === 'android'
          ? { color: 'rgba(128,128,128,0.18)', borderless: false }
          : undefined
      }
      style={styles.keyWrap}
    >
      <Animated.View
        style={[
          styles.key,
          {
            backgroundColor: colors.surfaceElevated,
            borderColor: colors.border,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={[styles.keyText, { color: colors.text }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  keyWrap: {
    width: '30%',
    minWidth: 88,
    maxWidth: 120,
    minHeight: 56,
    height: 56,
  },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyText: {
    ...interNumericExtraBoldText,
    fontSize: 23,
  },
});
