import { memo, useEffect, useState } from 'react';
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
  type AccountBalanceDisplayAccount,
} from '@/lib/accountBalancePresentation';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  account: AccountBalanceDisplayAccount;
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
  const resolvedLogo = logoUrl?.trim() || null;
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [resolvedLogo]);

  const showLogo = Boolean(resolvedLogo) && !logoFailed;

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
          {showLogo && resolvedLogo ? (
            <View style={styles.logoSlot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <RemoteLogoImage
                uri={resolvedLogo}
                size={LOGO_SIZE}
                fullSize
                onError={() => setLogoFailed(true)}
              />
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
            moneyAmountTypography({ tier: 'stat' }),
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'visible',
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
    paddingTop: spacing.sm,
  },
  value: {
    alignSelf: 'stretch',
    includeFontPadding: false,
  },
});
