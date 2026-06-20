import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import {
  ICON_WELL_SIZE,
  interSemiboldText,
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

export function DashboardAccountBalanceCard({
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

  const card = (
    <DashboardCard style={[styles.shell, style]}>
      <DashboardStatCard
        icon={
          logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={{
                width: userPickedIconLogoSize(ICON_WELL_SIZE),
                height: userPickedIconLogoSize(ICON_WELL_SIZE),
              }}
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
          <View style={styles.trailingColumn}>
            {typeof creditUtilPct === 'number' ? (
              <Text style={[styles.accountUsed, { color: muted }]}>
                {`${Math.round(creditUtilPct)}% utilisé`}
              </Text>
            ) : null}
            <Text style={[styles.accountKind, { color: muted }]} numberOfLines={1}>
              {accountKindDisplayLabel(account)}
            </Text>
          </View>
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
}

const styles = StyleSheet.create({
  shell: {
    paddingVertical: spacing.lg,
  },
  accountUsed: {
    ...interSemiboldText,
    fontSize: typography.micro,
    marginBottom: spacing.xs,
  },
  trailingColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  accountKind: {
    ...interSemiboldText,
    fontSize: typography.micro,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.92,
  },
});
