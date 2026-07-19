import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  TransactionAmountLabel,
} from '@/components/TransactionAmountLabel';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  moneyAmountTypography,
  spacing,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute, formatRecurringPaymentAmount } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan, AgendaBill } from '@/types';
import { resolveAgendaBillDisplayIcon } from '@/lib/recurringPaymentPresentation';
import { getMerchantLogoUrl, getMerchantLogoUrls } from '@/lib/merchantLogo';

const LOGO_SIZE = 40;
const ROW_TITLE_SIZE = 15.5;
const ROW_META_SIZE = 12.5;

type Props = {
  bill: AgendaBill;
  dateKey: string;
  todayKey: string;
  statusLabel: string;
  loanByRecurringPaymentId: Map<string, Loan>;
  onPress: () => void;
  embedded?: boolean;
  displayName?: string;
  subtitle?: string | null;
  estimatedIncome?: boolean;
};

function isPayBill(bill: AgendaBill) {
  return (
    bill.sourceId?.startsWith('actual-pay-') === true ||
    bill.sourceId === 'estimated-pay' ||
    bill.sourceId?.startsWith('estimated-pay-') === true
  );
}

function resolveBillDisplayLogo(bill: AgendaBill) {
  const storedLogo = bill.logoUrl?.trim();
  if (storedLogo) return storedLogo;
  if (bill.recurring || bill.sourceId) return getMerchantLogoUrl(bill.name);
  return null;
}

export const AgendaPaymentRow = memo(function AgendaPaymentRow({
  bill,
  dateKey: _dateKey,
  todayKey: _todayKey,
  statusLabel: _statusLabel,
  loanByRecurringPaymentId,
  onPress,
  embedded = false,
  displayName,
  subtitle,
  estimatedIncome = false,
}: Props) {
  const { colors } = useAppTheme();
  const isIncome = isPayBill(bill) || bill.kind === 'income';
  const displayLogoUrl = resolveBillDisplayLogo(bill);
  const merchantLabel = bill.recurring || bill.sourceId ? bill.name : null;
  const hasRemoteLogo =
    Boolean(displayLogoUrl) ||
    Boolean(merchantLabel && getMerchantLogoUrls(merchantLabel).length > 0);
  const displayIcon = resolveAgendaBillDisplayIcon(bill, loanByRecurringPaymentId, {
    isPayBill: (item) => isPayBill(item as AgendaBill),
  });
  const displayTint = bill.color ?? (isIncome ? colors.success : colors.warning);
  const title = displayName ?? bill.name;

  const amountColor = estimatedIncome
    ? 'rgba(74, 222, 128, 0.65)'
    : isIncome
      ? colors.success
      : colors.text;

  const formattedAmount = bill.recurring
    ? formatRecurringPaymentAmount(bill.amount, bill.kind ?? 'payment')
    : formatDisplayMoneyAbsolute(bill.amount);

  const handlePress = () => {
    tapHaptic();
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        embedded && styles.rowEmbedded,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.mainRow}>
        <UserPickedIconWell
          icon={displayIcon}
          color={displayTint}
          size={LOGO_SIZE}
          logoUrl={displayLogoUrl}
          merchantLabel={merchantLabel}
          wellGlyphWhite={Boolean(bill.recurring) && !isIncome}
          noBackground={hasRemoteLogo}
          style={[
            styles.avatar,
            embedded && !hasRemoteLogo && styles.avatarEmbedded,
            embedded && !hasRemoteLogo && { borderColor: colors.borderStrong, backgroundColor: colors.surfaceElevated },
          ]}
        />

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <View style={styles.nameCol}>
              <Text
                style={[styles.name, jakartaSemiboldText, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {title}
              </Text>
            </View>
            <View style={styles.amountCol}>
              {estimatedIncome ? (
                <Text style={[styles.amount, { color: amountColor }]} numberOfLines={1}>
                  {`≈ +${formattedAmount}`}
                </Text>
              ) : (
                <TransactionAmountLabel
                  amount={formattedAmount}
                  direction="neutral"
                  color={amountColor}
                  textStyle={styles.amount}
                  showDirectionIcon={false}
                />
              )}
            </View>
          </View>

          {subtitle ? (
            <Text
              style={[styles.meta, jakartaMediumText, { color: colors.textMuted }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    paddingVertical: 13,
  },
  rowEmbedded: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.88,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    flexShrink: 0,
  },
  avatarEmbedded: {
    borderWidth: 1,
    borderRadius: 9,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: ROW_TITLE_SIZE,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  amount: {
    ...moneyAmountTypography({
      fontSize: ROW_TITLE_SIZE,
      lineHeight: 20,
      letterSpacing: -0.2,
    }),
  },
  amountCol: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  meta: {
    fontSize: ROW_META_SIZE,
    lineHeight: 16,
  },
});
