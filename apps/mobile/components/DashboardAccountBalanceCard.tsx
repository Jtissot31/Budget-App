import { memo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  containerSurfaceStyle,
  jakartaSemiboldText,
  moneyAmountTypography,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import {
  accountBalanceRowTitle,
  accountBalanceIconForKind,
  accountBalanceIconTone,
  accountBalanceValueColor,
  accountKindTypeLabel,
  type AccountBalanceDisplayAccount,
} from '@/lib/accountBalancePresentation';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { useAppTheme } from '@/lib/themeContext';
import { remoteLogoImageStyle, userPickedIconGlyphSize } from '@/lib/userPickedIcon';

type Props = {
  account: AccountBalanceDisplayAccount;
  logoUrl?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Flat row inside a parent card — hairline dividers between rows. */
  embedded?: boolean;
  isLast?: boolean;
};

/** Square slot — matches BankAccountCard (40) and list icon visual weight via logo inset. */
const ICON_SLOT_SIZE = 40;

export const DashboardAccountBalanceCard = memo(function DashboardAccountBalanceCard({
  account,
  logoUrl,
  onPress,
  style,
  accessibilityLabel,
  embedded = false,
  isLast = false,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const muted = colors.textMuted;
  const balanceColor = accountBalanceValueColor(account, colors.text);
  const logoTone = accountBalanceIconTone(account.kind, colors);
  const title = accountBalanceRowTitle(account);
  const typeLabel = accountKindTypeLabel(account.kind);
  const surface = containerSurfaceStyle(isLight);

  const card = (
    <View
      style={[
        styles.shell,
        embedded
          ? styles.shellEmbedded
          : {
              backgroundColor: surface.backgroundColor,
              borderColor: colors.borderSubtle,
            },
        style,
      ]}
    >
      <View style={[styles.mainRow, embedded && styles.mainRowEmbedded]}>
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
            <Ionicons
              name={accountBalanceIconForKind(account.kind)}
              size={userPickedIconGlyphSize(ICON_SLOT_SIZE)}
              color={logoTone}
            />
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.name, jakartaSemiboldText, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {account.kind === 'credit' ? (
              <Ionicons name="chevron-forward" size={16} color={muted} style={styles.chevron} />
            ) : null}
          </View>

          <Text
            style={[styles.typeLabel, typographyKit.caption, { color: muted }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {typeLabel}
          </Text>

          <Text
            style={[
              moneyAmountTypography({ tier: 'row' }),
              styles.balance,
              { color: balanceColor },
            ]}
          >
            {formatCompactCurrency(account.balance, {
              leadingPlusWhenPositive: account.kind === 'credit' && account.balance > 0,
            })}
          </Text>
        </View>
      </View>

      {embedded && !isLast ? (
        <View style={styles.dividerEmbedded} />
      ) : null}
    </View>
  );

  if (!onPress) return card;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Voir le détail de ${title}`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {card}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  shellEmbedded: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    minHeight: 0,
    gap: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: 0,
  },
  mainRowEmbedded: {
    paddingHorizontal: spacing.lg,
  },
  dividerEmbedded: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  iconSlot: {
    width: ICON_SLOT_SIZE,
    height: ICON_SLOT_SIZE,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoSlot: {
    width: ICON_SLOT_SIZE,
    height: ICON_SLOT_SIZE,
    position: 'relative',
    flexShrink: 0,
  },
  logoImage: remoteLogoImageStyle(ICON_SLOT_SIZE),
  content: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  name: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    minWidth: 0,
  },
  chevron: {
    flexShrink: 0,
  },
  typeLabel: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.2,
  },
  balance: {
    alignSelf: 'flex-start',
    textAlign: 'left',
  },
  pressed: {
    opacity: 0.88,
  },
});
