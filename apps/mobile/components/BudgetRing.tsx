import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { jakartaBoldText, jakartaMediumText, typography } from '@/constants/theme';
import { portfolioNumericText } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';

type Props = {
  remaining: number;
  spent: number;
  budget: number;
  size?: number;
};

function formatMoney(value: number) {
  return formatDisplayMoneyAbsolute(value);
}

export function BudgetRing({ remaining, spent, budget, size = 160 }: Props) {
  const { colors } = useAppTheme();
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
          stroke={colors.border}
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
        <Text style={[styles.label, { color: colors.textMuted }]}>Disponible</Text>
        <Text style={[styles.amount, { color: colors.text }]}>{formatMoney(remaining)}</Text>
        <Text style={[styles.sub, { color: colors.primary }]}>{freePercent}% libre</Text>
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
    ...jakartaMediumText,
    fontSize: typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  amount: {
    ...portfolioNumericText,
    fontSize: typography.heroAmount,
  },
  sub: {
    ...jakartaBoldText,
    fontSize: typography.caption,
    marginTop: 4,
  },
});
