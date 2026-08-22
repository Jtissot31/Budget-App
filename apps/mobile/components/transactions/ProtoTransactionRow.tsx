/**
 * Budget Proto transaction row — square arrow well, category subtitle, signed amount.
 * Merchant logos replace the income glyph / expense arrow when a logo is available.
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { IncomeIcon } from '@/components/icons/IncomeIcon';
import { RemoteLogoImage } from '@/components/IconFrame';
import {
  jakartaMediumText,
  jakartaSemiboldText,
  transactionRowAmountTypography,
} from '@/constants/theme';
import {
  getTransactionTypeLabel,
  resolveTransactionPaymentMethodLabel,
} from '@/lib/accountTransactionFlow';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { tapHaptic } from '@/lib/haptics';
import { getLocalMerchantLogoAsset, getMerchantLogoUrls } from '@/lib/merchantLogo';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount, Transaction } from '@/types';

const ICON_WELL = 40;
/**
 * Glyph size inside the pale well.
 * Income PNG has transparent padding (~65% ink), so use a larger box than
 * Ionicons fallbacks so the wallet artwork reads closer to ~24–28px ink.
 */
const ICON_GLYPH_FALLBACK = 24;
const ICON_GLYPH_INCOME = 30;

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
    // List rows: category only — not "Épicerie · Desjardins · 4521".
    return transaction.categoryName?.trim() || getTransactionTypeLabel(transaction.type);
  }, [accounts, isTransfer, savingsGoals, transaction]);

  const localLogoAsset = useMemo(() => {
    if (isTransfer) return null;
    return getLocalMerchantLogoAsset(transaction.label);
  }, [isTransfer, transaction.label]);

  const merchantLogoUrls = useMemo(() => {
    if (isTransfer) return [] as string[];
    // Prefer remote candidates only — bundled assets load via `asset` module id.
    // getMerchantLogoUrls still includes a Metro URI for locals; skip those when we
    // already have a require() module (avoids the flaky Asset.uri path).
    const urls = getMerchantLogoUrls(transaction.label);
    if (localLogoAsset == null) return urls;
    return urls.filter((url) => /^https?:\/\//i.test(url));
  }, [isTransfer, localLogoAsset, transaction.label]);

  const [logoSourceIndex, setLogoSourceIndex] = useState(0);
  const [localFailed, setLocalFailed] = useState(false);
  const [remoteGiveUp, setRemoteGiveUp] = useState(false);

  useEffect(() => {
    setLogoSourceIndex(0);
    setLocalFailed(false);
    setRemoteGiveUp(false);
  }, [localLogoAsset, merchantLogoUrls]);

  const logoUri = merchantLogoUrls[logoSourceIndex];
  const showLocalLogo = localLogoAsset != null && !localFailed;
  const showRemoteLogo = !showLocalLogo && Boolean(logoUri) && !remoteGiveUp;
  const showMerchantLogo = showLocalLogo || showRemoteLogo;

  const amountColor = isIncome ? colors.accentGreen : isTransfer ? colors.textMuted : colors.text;
  const iconColor = isIncome ? colors.accentGreen : colors.textMuted;
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
      <View
        style={[
          styles.iconWell,
          !showMerchantLogo && { backgroundColor: colors.surfaceElevated },
          showMerchantLogo && styles.iconWellLogo,
        ]}
      >
        {showLocalLogo && localLogoAsset != null ? (
          <RemoteLogoImage
            asset={localLogoAsset}
            size={ICON_WELL}
            recyclingKey={`merchant-local-${transaction.label}`}
            onError={() => setLocalFailed(true)}
          />
        ) : showRemoteLogo && logoUri ? (
          <RemoteLogoImage
            uri={logoUri}
            size={ICON_WELL}
            recyclingKey={logoUri}
            onError={() => {
              if (logoSourceIndex < merchantLogoUrls.length - 1) {
                setLogoSourceIndex((i) => i + 1);
              } else {
                setRemoteGiveUp(true);
              }
            }}
          />
        ) : isIncome ? (
          <IncomeIcon size={ICON_GLYPH_INCOME} color={iconColor} />
        ) : (
          <AppIcon family="ionicons" name="trending-down" size={ICON_GLYPH_FALLBACK} color={iconColor} />
        )}
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, jakartaSemiboldText, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.subtitle, jakartaMediumText, { color: colors.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Text
        style={[
          styles.amount,
          transactionRowAmountTypography({ fontSize: 15, lineHeight: 20 }),
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
  iconWellLogo: {
    overflow: 'hidden',
    position: 'relative',
  },
  copy: {
    flex: 1,
    flexShrink: 1,
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
  amount: {
    flexShrink: 0,
  },
  pressed: { opacity: 0.78 },
});
