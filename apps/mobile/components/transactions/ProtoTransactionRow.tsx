/**
 * Budget Proto transaction row — square arrow well, Category · Account, signed amount.
 */
import { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  moneyAmountTypography,
} from '@/constants/theme';
import {
  getTransactionTypeLabel,
  resolveTransactionPaymentMethodLabel,
} from '@/lib/accountTransactionFlow';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount, Transaction } from '@/types';

const ICON_WELL = 40;

type Props = {
  transaction: Transaction;
  accounts: readonly SimulatedAccount[];
  savingsGoals: readonly { id: string; name: string }[];
  isLast: boolean;
  onPressId: (transactionId: string) => void;
};

export const ProtoTransactionRow = memo(function ProtoTransactionRow({
  transaction,
  accounts,
  savingsGoals,
  isLast,
  onPressId,
}: Props) {
  const { colors } = useAppTheme();
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';

  const handlePress = useCallback(() => {
    tapHaptic();
    onPressId(transaction.id);
  }, [onPressId, transaction.id]);

  const title = isTransfer ? getTransactionTypeLabel('transfer') : transaction.label;

  const subtitle = useMemo(() => {
    if (isTransfer) {
      return (
        resolveTransactionPaymentMethodLabel(transaction, { accounts, savingsGoals }) ??
        getTransactionTypeLabel('transfer')
      );
    }
    const category =
      transaction.categoryName?.trim() || getTransactionTypeLabel(transaction.type);
    const account = resolveTransactionPaymentMethodLabel(transaction, {
      accounts,
      savingsGoals,
    });
    return account ? `${category} · ${account}` : category;
  }, [accounts, isTransfer, savingsGoals, transaction]);

  const amountColor = isIncome ? colors.accentGreen : isTransfer ? colors.textMuted : colors.text;
  const iconColor = isIncome ? colors.accentGreen : colors.textMuted;
  const iconName = isIncome ? 'trending-up' : 'trending-down';
  const abs = Math.abs(transaction.amount);
  const signed =
    isIncome
      ? `+${formatDisplayMoneyAbsolute(abs)}`
      : isTransfer
        ? formatDisplayMoneyAbsolute(abs)
        : `−${formatDisplayMoneyAbsolute(abs)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${signed}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.containerBorder,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconWell, { backgroundColor: colors.surfaceElevated }]}>
        <AppIcon family="ionicons" name={iconName} size={18} color={iconColor} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, jakartaSemiboldText, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.subtitle, jakartaMediumText, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text
        style={[
          moneyAmountTypography({ tier: 'row', fontSize: 15, lineHeight: 20 }),
          { color: amountColor, letterSpacing: -0.3 },
        ]}
        numberOfLines={1}
      >
        {signed}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
  },
  iconWell: {
    width: ICON_WELL,
    height: ICON_WELL,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  pressed: { opacity: 0.78 },
});
