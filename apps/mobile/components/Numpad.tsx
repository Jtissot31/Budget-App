import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function Numpad({ value, onChange }: Props) {
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
      <Animated.View style={[styles.key, { transform: [{ scale }] }]}>
        <Text style={styles.keyText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  keyWrap: {
    width: '30%',
    minWidth: 96,
    height: 48,
  },
  key: {
    flex: 1,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: colors.text, fontSize: 22, fontWeight: '800' },
});
