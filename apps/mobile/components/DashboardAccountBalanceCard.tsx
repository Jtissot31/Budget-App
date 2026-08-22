import { memo, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { RemoteLogoImage } from '@/components/IconFrame';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import {
  planFinanceContainerCompactTilePaddingStyle,
  planFinanceContainerPressedStyle,
} from '@/constants/planFinanceKit';
import {
  moneyAmountTypography,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  accountBalanceRowTitle,
  accountBalanceValueColor,
  accountKindTypeLabel,
  isReleaseSafeLogoUri,
  resolveSimulatedAccountLogoSources,
  type AccountBalanceDisplayAccount,
} from '@/lib/accountBalancePresentation';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { useAppTheme } from '@/lib/themeContext';
import type { SimulatedAccount } from '@/types';

type Props = {
  account: AccountBalanceDisplayAccount;
  /** @deprecated Prefer account-based resolution via {@link resolveSimulatedAccountLogoSources}. */
  logoUrl?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Compact 2-column account tile — shorter than StockHoldingTile. */
const CARD_MIN_HEIGHT = 118;
const CARD_BODY_MIN_HEIGHT = 36;
/** Compact institution mark — matches StockHoldingTile avatar scale. */
const LOGO_SIZE = 28;

export const DashboardAccountBalanceCard = memo(function DashboardAccountBalanceCard({
  account,
  logoUrl,
  onPress,
  style,
  accessibilityLabel,
}: Props) {
  const { colors } = useAppTheme();
  const balanceColor = accountBalanceValueColor(account, colors.text);
  const typeLabel = accountKindTypeLabel(account.kind);
  const primary = accountBalanceRowTitle(account);

  const sources = useMemo(() => {
    const resolved = resolveSimulatedAccountLogoSources(account as SimulatedAccount);
    const override = logoUrl?.trim();
    if (override && isReleaseSafeLogoUri(override) && !resolved.urls.includes(override)) {
      return { asset: resolved.asset, urls: [override, ...resolved.urls] };
    }
    return resolved;
  }, [account, logoUrl]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [assetFailed, setAssetFailed] = useState(false);
  const [remoteFailed, setRemoteFailed] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setAssetFailed(false);
    setRemoteFailed(false);
  }, [sources.asset, sources.urls.join('|')]);

  const preferAsset = sources.asset != null && !assetFailed;
  const uri = !preferAsset && !remoteFailed ? sources.urls[sourceIndex] : null;
  const showLogo = preferAsset || Boolean(uri);

  const card = (
    <PlanFinanceContainer style={[styles.card, style]}>
      <View style={styles.headerArea}>
        <View style={styles.typeLabelRow}>
          <Text
            style={[typographyKit.microUpper, styles.typeLabel, { color: colors.primary }]}
            numberOfLines={1}
          >
            {typeLabel}
          </Text>
          {showLogo ? (
            <View style={styles.logoSlot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {preferAsset && sources.asset != null ? (
                <RemoteLogoImage
                  asset={sources.asset}
                  size={LOGO_SIZE}
                  fullSize
                  onError={() => setAssetFailed(true)}
                />
              ) : uri ? (
                <RemoteLogoImage
                  uri={uri}
                  size={LOGO_SIZE}
                  fullSize
                  onError={() => {
                    if (sourceIndex < sources.urls.length - 1) {
                      setSourceIndex((i) => i + 1);
                    } else {
                      setRemoteFailed(true);
                    }
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={styles.identityRow}>
          <Text
            style={[styles.primary, typographyKit.listPrimary, { color: colors.text }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {primary}
          </Text>
        </View>
      </View>

      <View style={styles.cardValueRow}>
        <Text
          style={[
            moneyAmountTypography({ tier: 'card', textAlign: 'right' }),
            styles.value,
            { color: balanceColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {formatCompactCurrency(account.balance, {
            leadingPlusWhenPositive: account.kind === 'credit' && account.balance > 0,
          })}
        </Text>
      </View>
    </PlanFinanceContainer>
  );

  if (!onPress) return card;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Voir le détail de ${primary}`}
      style={({ pressed }) => [styles.pressable, pressed && planFinanceContainerPressedStyle()]}
    >
      {card}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  card: {
    width: '100%',
    ...planFinanceContainerCompactTilePaddingStyle(),
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    minHeight: CARD_MIN_HEIGHT,
  },
  headerArea: {
    minWidth: 0,
  },
  typeLabelRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minWidth: 0,
  },
  typeLabel: {
    flex: 1,
    minWidth: 0,
    marginBottom: 2,
  },
  /** Transparent — logo sits on the PlanFinanceContainer card, no well fill. */
  logoSlot: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs,
    minWidth: 0,
  },
  primary: {
    flex: 1,
    flexShrink: 1,
    includeFontPadding: false,
  },
  cardValueRow: {
    flex: 1,
    minHeight: CARD_BODY_MIN_HEIGHT,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingTop: spacing.sm,
  },
  value: {
    alignSelf: 'flex-end',
    textAlign: 'right',
    includeFontPadding: false,
  },
});
