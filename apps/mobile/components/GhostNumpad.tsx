import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/lib/themeContext';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;

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
  const { colors, ghost } = useAppTheme();

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
      onPress={onPress}
      onPressIn={() => animateTo(0.94)}
      onPressOut={() => animateTo(1)}
      style={styles.keyWrap}
    >
      <Animated.View
        style={[
          styles.key,
          { backgroundColor: ghost.obsidianSoft, borderColor: colors.border, transform: [{ scale }] },
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
    maxWidth: 120,
    height: 56,
  },
  key: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  keyText: { fontSize: 23, fontWeight: '800' },
});
