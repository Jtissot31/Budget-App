import { memo } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
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
  accountBalanceIconForKind,
  accountBalanceIconTone,
  accountBalanceSubtitle,
  accountBalanceValueColor,
  accountKindTypeLabel,
  type AccountBalanceDisplayAccount,
} from '@/lib/accountBalancePresentation';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { useAppTheme } from '@/lib/themeContext';
import { remoteLogoImageStyle, userPickedIconLogoSize } from '@/lib/userPickedIcon';

type Props = {
  account: AccountBalanceDisplayAccount;
  logoUrl?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Matches StockHoldingTile logo / compact tile proportions. */
const AVATAR_SIZE = 28;
const CARD_MIN_HEIGHT = 148;
const CARD_BODY_MIN_HEIGHT = 52;
const FALLBACK_ACCOUNT_ICON_SIZE = userPickedIconLogoSize(AVATAR_SIZE);

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export const DashboardAccountBalanceCard = memo(function DashboardAccountBalanceCard({
  account,
  logoUrl,
  onPress,
  style,
  accessibilityLabel,
}: Props) {
  const { colors } = useAppTheme();
  const muted = colors.textMuted;
  const balanceColor = accountBalanceValueColor(account, colors.text);
  const logoTone = accountBalanceIconTone(account.kind, colors);
  const typeLabel = accountKindTypeLabel(account.kind);
  const primary = accountBalanceRowTitle(account);
  const subtitle = accountBalanceSubtitle(account);
  const secondary =
    subtitle && normalizeLabel(subtitle) !== normalizeLabel(primary) ? subtitle : null;

  const card = (
    <PlanFinanceContainer style={[styles.card, style]}>
      <View style={styles.headerArea}>
        <View style={styles.typeRow}>
          <Text style={[styles.typeLabel, typographyKit.metaSemibold, { color: muted }]} numberOfLines={1}>
            {typeLabel}
          </Text>
        </View>
        <View style={styles.identityRow}>
          <View style={logoUrl ? styles.logoSlot : styles.iconSlot}>
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.logoImage}
                contentFit="contain"
                contentPosition="center"
                transition={150}
                cachePolicy="memory-disk"
                recyclingKey={logoUrl}
              />
            ) : (
              <AppIcon
                family="ionicons"
                name={accountBalanceIconForKind(account.kind)}
                size={FALLBACK_ACCOUNT_ICON_SIZE}
                color={logoTone}
              />
            )}
          </View>
          <View style={styles.identityTextCol}>
            <Text
              style={[styles.primary, typographyKit.captionSemibold, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {primary}
            </Text>
            {secondary ? (
              <Text
                style={[styles.secondary, typographyKit.microMedium, { color: muted }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {secondary}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.cardValueRow}>
        <Text
          style={[
            moneyAmountTypography({ fontSize: 17, lineHeight: 21 }),
            styles.value,
            { color: balanceColor },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
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
    minHeight: CARD_MIN_HEIGHT,
  },
  headerArea: {
    minWidth: 0,
  },
  typeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  typeLabel: {
    letterSpacing: 0.2,
    textAlign: 'right',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    minWidth: 0,
  },
  identityTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 1,
    justifyContent: 'center',
  },
  iconSlot: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  logoSlot: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  logoImage: remoteLogoImageStyle(AVATAR_SIZE),
  primary: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0.1,
    includeFontPadding: false,
  },
  secondary: {
    letterSpacing: 0.05,
  },
  cardValueRow: {
    flex: 1,
    minHeight: CARD_BODY_MIN_HEIGHT,
    justifyContent: 'flex-end',
    paddingTop: spacing.md,
  },
  value: {
    alignSelf: 'stretch',
    includeFontPadding: false,
  },
});
