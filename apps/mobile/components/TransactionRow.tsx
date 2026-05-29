import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassContainer } from '@/components/GlassContainer';
import { TransactionAvatar } from '@/components/TransactionAvatar';
import type { Transaction } from '@/types';
import { radius, spacing } from '@/constants/theme';
import { rowLabel, rowTitleTextProps, rowValue, rowValueContainer, singleLineAmountProps } from '@/lib/textLayout';
import { UNIFORM_ROW_MIN_HEIGHT } from '@/lib/uniformGroupStyles';
import { useAppTheme } from '@/lib/themeContext';

type Props = { transaction: Transaction; onPress?: () => void };

export function TransactionRow({ transaction: tx, onPress }: Props) {
  const { colors } = useAppTheme();
  const isIncome = tx.type === 'income';
  const isTransfer = tx.type === 'transfer';
  const amountColor = isIncome ? colors.success : isTransfer ? colors.textMuted : colors.text;
  const hasReceipt = Boolean(tx.receiptUri || tx.receiptStatus);

  return (
    <Pressable android_ripple={null} onPress={onPress}>
      <GlassContainer
        borderRadius={radius.md}
        padding={spacing.md}
        innerStyle={styles.cardInner}
      >
          <TransactionAvatar transaction={tx} size={34} />
          <View style={styles.body}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.text }]} {...rowTitleTextProps}>
                {tx.label}
              </Text>
              {hasReceipt ? (
                <View style={[styles.receiptBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="receipt-outline" size={13} color={colors.textMuted} />
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.right}>
            <Text style={[styles.amount, { color: amountColor }]} {...singleLineAmountProps}>
              {isTransfer ? '' : isIncome ? '+' : '−'}
              {tx.amount.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $
            </Text>
          </View>
      </GlassContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: UNIFORM_ROW_MIN_HEIGHT,
  },
  body: { flex: 1, minWidth: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  label: {
    ...rowLabel,
    fontWeight: '800',
  },
  receiptBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  right: {
    ...rowValueContainer,
    alignSelf: 'stretch',
    justifyContent: 'center',
    minWidth: 88,
  },
  amount: { ...rowValue, fontWeight: '700' },
});
