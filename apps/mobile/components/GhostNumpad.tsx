import { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { jakartaExtraBoldText, radius } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;

/** Expands touch area into key gaps without changing layout. */
const KEY_HIT_SLOP = { top: 10, bottom: 10, left: 8, right: 8 } as const;

/** Keeps the press active when the finger drifts slightly off the key. */
const KEY_PRESS_RETENTION = { top: 24, bottom: 24, left: 16, right: 16 } as const;

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
  const handledOnPressIn = useRef(false);
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
      delayPressIn={0}
      delayLongPress={500}
      hitSlop={KEY_HIT_SLOP}
      pressRetentionOffset={KEY_PRESS_RETENTION}
      onPressIn={() => {
        handledOnPressIn.current = true;
        animateTo(0.94);
        onPress();
      }}
      onPress={() => {
        if (!handledOnPressIn.current) onPress();
      }}
      onPressOut={() => {
        handledOnPressIn.current = false;
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
    ...jakartaExtraBoldText,
    fontSize: 23,
  },
});
