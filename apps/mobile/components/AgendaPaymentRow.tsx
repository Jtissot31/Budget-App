import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { UserPickedIconWell } from '@/components/UserPickedIconWell';
import {
  TransactionAmountLabel,
  recurringPaymentAmountDirection,
} from '@/components/TransactionAmountLabel';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  spacing,
  transactionRowAmountTypography,
} from '@/constants/theme';
import { formatDisplayMoneyAbsolute, formatRecurringPaymentAmount } from '@/lib/formatDisplayMoney';
import { daysUntilPayment, formatDaysUntilMeta } from '@/lib/paymentStatusBadge';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import type { Loan, AgendaBill } from '@/types';
import { resolveAgendaBillDisplayIcon } from '@/lib/recurringPaymentPresentation';
import { getMerchantLogoUrl, getMerchantLogoUrls } from '@/lib/merchantLogo';

const EMBEDDED_ICON_WELL_SIZE = 30;
const EMBEDDED_ROW_TITLE_SIZE = 15.5;
const EMBEDDED_ROW_META_SIZE = 12.5;

type Props = {
  bill: AgendaBill;
  dateKey: string;
  todayKey: string;
  statusLabel: string;
  loanByRecurringPaymentId: Map<string, Loan>;
  onPress: () => void;
  embedded?: boolean;
  isLast?: boolean;
};

function isPayBill(bill: AgendaBill) {
  return (
    bill.sourceId?.startsWith('actual-pay-') === true ||
    bill.sourceId === 'estimated-pay' ||
    bill.sourceId?.startsWith('estimated-pay-') === true
  );
}

function isRecurringExpenseBill(bill: AgendaBill) {
  return Boolean(bill.recurring) && (bill.kind ?? 'payment') === 'payment';
}

function resolveBillDisplayLogo(bill: AgendaBill) {
  const storedLogo = bill.logoUrl?.trim();
  if (storedLogo) return storedLogo;
  if (bill.recurring || bill.sourceId) return getMerchantLogoUrl(bill.name);
  return null;
}

function formatAgendaStatusMeta(statusLabel: string, dateKey: string, todayKey: string): string | null {
  if (dateKey > todayKey) {
    const days = daysUntilPayment(dateKey, new Date(`${todayKey}T12:00:00`));
    return formatDaysUntilMeta(days);
  }
  if (statusLabel === 'REÇU') return 'reçu';
  if (statusLabel === 'PAYÉ') return 'payé';
  if (statusLabel === 'EN ATTENTE') return 'en attente';
  if (statusLabel === 'ESTIMÉ') return 'estimé';
  if (statusLabel === "AUJOURD'HUI") return "aujourd'hui";
  if (statusLabel === 'DEMAIN') return 'demain';
  if (statusLabel.startsWith('DANS ')) {
    const days = Number.parseInt(statusLabel.replace('DANS ', '').replace(' J', ''), 10);
    if (!Number.isNaN(days)) return formatDaysUntilMeta(days);
  }
  return null;
}

function buildAgendaPaymentMeta(statusLabel: string, dateKey: string, todayKey: string) {
  return formatAgendaStatusMeta(statusLabel, dateKey, todayKey);
}

export const AgendaPaymentRow = memo(function AgendaPaymentRow({
  bill,
  dateKey,
  todayKey,
  statusLabel,
  loanByRecurringPaymentId,
  onPress,
  embedded = false,
  isLast = false,
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
  const meta = buildAgendaPaymentMeta(statusLabel, dateKey, todayKey);

  const amountColor = isIncome ? colors.success : colors.text;

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
          size={EMBEDDED_ICON_WELL_SIZE}
          logoUrl={displayLogoUrl}
          merchantLabel={merchantLabel}
          wellGlyphWhite={Boolean(bill.recurring) && !isIncome}
          noBackground={hasRemoteLogo}
          style={[
            styles.avatar,
            embedded && !hasRemoteLogo && styles.avatarEmbedded,
            embedded && !hasRemoteLogo && { borderColor: colors.borderSubtle },
          ]}
        />

        <View style={[styles.content, embedded && styles.contentEmbedded]}>
          <View style={styles.titleRow}>
            <View style={styles.nameCol}>
              <Text
                style={[
                  styles.name,
                  embedded && styles.nameEmbedded,
                  jakartaSemiboldText,
                  { color: colors.text },
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {bill.name}
              </Text>
            </View>
            <View style={styles.amountCol}>
              <TransactionAmountLabel
                amount={
                  bill.recurring
                    ? formatRecurringPaymentAmount(bill.amount, bill.kind ?? 'payment')
                    : formatDisplayMoneyAbsolute(bill.amount)
                }
                direction={
                  isIncome
                    ? 'income'
                    : bill.recurring || isRecurringExpenseBill(bill)
                      ? recurringPaymentAmountDirection(bill.kind ?? 'payment')
                      : 'neutral'
                }
                color={amountColor}
                textStyle={styles.embeddedAmount}
              />
            </View>
          </View>

          {meta ? (
            <Text
              style={[
                styles.meta,
                styles.metaEmbedded,
                jakartaMediumText,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {meta}
            </Text>
          ) : null}
        </View>
      </View>

      {embedded && !isLast ? (
        <View style={[styles.dividerEmbedded, { backgroundColor: colors.borderSubtle }]} />
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowEmbedded: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  contentEmbedded: {
    gap: spacing.xs,
  },
  avatarEmbedded: {
    borderWidth: 1,
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.88,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatar: {
    flexShrink: 0,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    lineHeight: 18,
  },
  nameEmbedded: {
    fontSize: EMBEDDED_ROW_TITLE_SIZE,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  embeddedAmount: {
    ...transactionRowAmountTypography({
      fontSize: EMBEDDED_ROW_TITLE_SIZE,
      lineHeight: 20,
      letterSpacing: -0.1,
    }),
  },
  amountCol: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaEmbedded: {
    fontSize: EMBEDDED_ROW_META_SIZE,
    lineHeight: 16,
  },
  dividerEmbedded: {
    height: 1,
    marginHorizontal: spacing.lg,
  },
});
