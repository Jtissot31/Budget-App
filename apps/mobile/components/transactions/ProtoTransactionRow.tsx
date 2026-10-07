/**
 * Budget Proto transaction row — square arrow well, category subtitle, signed amount.
 * Merchant logos replace the income glyph / expense arrow when a logo is available.
 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { userPickedIconLogoInset, userPickedIconLogoSize } from '@/lib/userPickedIcon';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount, Transaction } from '@/types';

const ICON_WELL = 40;
/** Same inset as `remoteLogoImageStyle`, laid out in flow so native matches web. */
const LOGO_SIDE = userPickedIconLogoSize(ICON_WELL);
const LOGO_INSET = userPickedIconLogoInset(ICON_WELL);
/**
 * Glyph size inside the pale well.
 * Income `$` uses a larger box than expense fallbacks so it reads clearly in the 40px well.
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
        styles.hit,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.containerBorder,
        },
        pressed && styles.pressed,
      ]}
    >
      {/* Layout lives on a plain View. Pressable on Android does not reliably
          apply flexDirection, which stacked the logo above the amount. */}
      <View style={styles.row}>
      <View
        collapsable={false}
        style={[
          styles.iconWell,
          !showMerchantLogo && { backgroundColor: colors.surfaceElevated },
          showMerchantLogo && styles.iconWellLogo,
        ]}
      >
        {showLocalLogo && localLogoAsset != null ? (
          <View style={styles.logoFrame} collapsable={false}>
            <RemoteLogoImage
              asset={localLogoAsset}
              size={LOGO_SIDE}
              fullSize
              recyclingKey={`merchant-local-${transaction.label}`}
              onError={() => setLocalFailed(true)}
            />
          </View>
        ) : showRemoteLogo && logoUri ? (
          <View style={styles.logoFrame} collapsable={false}>
            <RemoteLogoImage
              uri={logoUri}
              size={LOGO_SIDE}
              fullSize
              recyclingKey={logoUri}
              onError={() => {
                if (logoSourceIndex < merchantLogoUrls.length - 1) {
                  setLogoSourceIndex((i) => i + 1);
                } else {
                  setRemoteGiveUp(true);
                }
              }}
            />
          </View>
        ) : isIncome ? (
          <IncomeIcon size={ICON_GLYPH_INCOME} color={iconColor} />
        ) : (
          <AppIcon family="ionicons" name="trending-down" size={ICON_GLYPH_FALLBACK} color={iconColor} />
        )}
      </View>
      <View style={styles.copy} collapsable={false}>
        <Text
          style={[styles.title, jakartaSemiboldText, { color: colors.text }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, jakartaMediumText, { color: colors.textMuted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {subtitle}
          </Text>
        ) : null}
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
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  hit: {
    alignSelf: 'stretch',
    width: '100%',
  },
  // Web: CSS flex + gap. Native Yoga 3: `flex: 1` is basis 0, and `minWidth: 0`
  // collapses this column to nothing so only the logo and amount remain.
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
    ...(Platform.OS === 'web' ? { gap: 12 } : null),
  },
  iconWell: {
    width: ICON_WELL,
    height: ICON_WELL,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? null : { marginRight: 12 }),
  },
  iconWellLogo: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: LOGO_INSET,
    paddingLeft: LOGO_INSET,
  },
  logoFrame: {
    width: LOGO_SIDE,
    height: LOGO_SIDE,
    overflow: 'hidden',
  },
  copy: Platform.OS === 'web'
    ? {
        flex: 1,
        flexShrink: 1,
        flexDirection: 'column',
        minWidth: 0,
        gap: 2,
      }
    : {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 'auto',
        flexDirection: 'column',
        minWidth: 72,
        marginRight: 12,
        justifyContent: 'center',
      },
  title: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    ...(Platform.OS === 'web' ? null : { flexShrink: 1 }),
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 16,
    ...(Platform.OS === 'web' ? null : { flexShrink: 1, marginTop: 2 }),
  },
  amount: {
    flexGrow: 0,
    flexShrink: 0,
  },
  pressed: { opacity: 0.78 },
});
