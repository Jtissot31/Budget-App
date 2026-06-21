import { memo } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import {
  ICON_WELL_SIZE,
  jakartaSemiboldText,
  spacing,
  tagContainerStyle,
  tagTypography,
  typography,
} from '@/constants/theme';
import {
  accountBalanceIconForKind,
  accountBalanceIconTone,
  accountBalanceSubtitle,
  accountBalanceValueColor,
  accountKindDisplayLabel,
  type AccountBalanceDisplayAccount,
} from '@/lib/accountBalancePresentation';
import { creditLimitUtilizationPercent } from '@/lib/creditLimitUtilization';
import { formatCompactCurrency } from '@/lib/formatCompactGainDollars';
import { useAppTheme } from '@/lib/themeContext';
import { userPickedIconGlyphSize, userPickedIconLogoSize } from '@/lib/userPickedIcon';

type Props = {
  account: AccountBalanceDisplayAccount;
  logoUrl?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

const LOGO_IMAGE_STYLE = {
  width: userPickedIconLogoSize(ICON_WELL_SIZE),
  height: userPickedIconLogoSize(ICON_WELL_SIZE),
} as const;

export const DashboardAccountBalanceCard = memo(function DashboardAccountBalanceCard({
  account,
  logoUrl,
  onPress,
  style,
  accessibilityLabel,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const muted = colors.textMuted;
  const creditUtilPct =
    account.kind === 'credit'
      ? creditLimitUtilizationPercent(account.balance, account.creditLimit)
      : undefined;
  const balanceColor = accountBalanceValueColor(account, colors.text);
  const logoTone = accountBalanceIconTone(account.kind, colors);
  const kindBadge = accountKindDisplayLabel(account);

  const card = (
    <DashboardCard style={[styles.shell, style]}>
      <DashboardStatCard
        icon={
          logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={LOGO_IMAGE_STYLE}
              contentFit="contain"
              transition={150}
              cachePolicy="memory-disk"
              recyclingKey={logoUrl}
            />
          ) : (
            <Ionicons
              name={accountBalanceIconForKind(account.kind)}
              size={userPickedIconGlyphSize(ICON_WELL_SIZE)}
              color={logoTone}
            />
          )
        }
        labelNode={
          <View
            style={tagContainerStyle({
              backgroundColor: isLight ? colors.surfaceElevated : colors.input,
              borderColor: colors.border,
            })}
          >
            <Text style={tagTypography({ color: muted })} numberOfLines={1}>
              {account.name}
            </Text>
          </View>
        }
        value={formatCompactCurrency(account.balance, {
          leadingPlusWhenPositive: account.kind === 'credit' && account.balance > 0,
        })}
        valueColor={balanceColor}
        subtitle={accountBalanceSubtitle(account)}
        trailing={
          kindBadge || typeof creditUtilPct === 'number' ? (
            <View style={styles.trailingCol}>
              {typeof creditUtilPct === 'number' ? (
                <Text style={[styles.accountUsed, { color: muted }]}>
                  {`${Math.round(creditUtilPct)}% utilisé`}
                </Text>
              ) : null}
              {kindBadge ? (
                <Text style={[styles.kindBadge, { color: muted }]} numberOfLines={1}>
                  {kindBadge}
                </Text>
              ) : null}
            </View>
          ) : undefined
        }
      />
    </DashboardCard>
  );

  if (!onPress) return card;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Voir le détail de ${account.name}`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {card}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  shell: {
    paddingVertical: spacing.lg,
  },
  trailingCol: {
    alignSelf: 'stretch',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  kindBadge: {
    ...jakartaSemiboldText,
    fontSize: typography.micro,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  accountUsed: {
    ...jakartaSemiboldText,
    fontSize: typography.micro,
  },
  pressed: {
    opacity: 0.92,
  },
});
