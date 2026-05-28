import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '@/constants/theme';

type Props = {
  remaining: number;
  spent: number;
  budget: number;
  size?: number;
};

function formatMoney(value: number) {
  return `${value.toLocaleString('fr-CA', { maximumFractionDigits: 0 })} $`;
}

export function BudgetRing({ remaining, spent, budget, size = 160 }: Props) {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = budget <= 0 ? 0 : Math.min(100, Math.round((spent / budget) * 100));
  const offset = circumference - (percentage / 100) * circumference;
  const freePercent = Math.max(0, 100 - percentage);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.borderStrong}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <Text style={styles.label}>Disponible</Text>
        <Text style={styles.amount}>{formatMoney(remaining)}</Text>
        <Text style={styles.sub}>{freePercent}% libre</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', marginBottom: 20 },
  svg: { position: 'absolute' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: '700',
    marginBottom: 4,
  },
  amount: {
    color: colors.text,
    fontSize: typography.heroAmount,
    fontWeight: '900',
  },
  sub: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    marginTop: 4,
  },
});
