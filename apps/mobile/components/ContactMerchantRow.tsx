import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { MerchantLogo } from '@/components/MerchantLogo';
import { planFinanceKit } from '@/constants/planFinanceKit';
import { interSemiboldText, spacing, typography } from '@/constants/theme';
import { rowTitleTextProps } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

const AVATAR_SIZE = 44;
const AVATAR_RADIUS = AVATAR_SIZE / 2;
const AVATAR_WELL_DARK = '#33333A';

type MerchantAvatarData = {
  name: string;
  logoUrl?: string | null;
  icon?: string | null;
  useAutoLogo?: boolean;
};

type BaseProps = {
  name: string;
  onPress: () => void;
  accessibilityLabel?: string;
  isEditing?: boolean;
};

export type ContactMerchantRowProps = BaseProps &
  (
    | { variant: 'merchant'; merchant: MerchantAvatarData }
    | { variant: 'contact'; photoUri?: string | null }
  );

function MerchantRowAvatar({
  merchant,
  wellColor,
}: {
  merchant: MerchantAvatarData;
  wellColor: string;
}) {
  return (
    <View style={[styles.avatarWell, { backgroundColor: wellColor }]}>
      <MerchantLogo
        name={merchant.name}
        logoUrl={merchant.logoUrl}
        icon={merchant.icon}
        useAutoLogo={merchant.useAutoLogo}
        size={AVATAR_SIZE}
      />
    </View>
  );
}

function ContactRowAvatar({
  photoUri,
  wellColor,
  iconColor,
}: {
  photoUri?: string | null;
  wellColor: string;
  iconColor: string;
}) {
  const trimmed = photoUri?.trim() ?? '';

  return (
    <View style={[styles.avatarWell, { backgroundColor: wellColor }]}>
      {trimmed ? (
        <Image
          source={{ uri: trimmed }}
          style={styles.avatarImage}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name="person-outline" size={22} color={iconColor} />
      )}
    </View>
  );
}

export function ContactMerchantRow(props: ContactMerchantRowProps) {
  const { name, onPress, accessibilityLabel, isEditing = false, variant } = props;
  const { colors, isLight } = useAppTheme();

  const cardSurface = isLight ? colors.containerBackground : planFinanceKit.colors.surface;
  const cardBorder = isLight ? colors.border : planFinanceKit.colors.border;
  const avatarWell = isLight ? colors.surfaceElevated : AVATAR_WELL_DARK;
  const iconColor = colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardSurface,
            borderColor: cardBorder,
          },
        ]}
      >
        {variant === 'merchant' ? (
          <MerchantRowAvatar merchant={props.merchant} wellColor={avatarWell} />
        ) : (
          <ContactRowAvatar photoUri={props.photoUri} wellColor={avatarWell} iconColor={iconColor} />
        )}

        <Text
          style={[styles.name, { color: colors.text }, interSemiboldText]}
          {...rowTitleTextProps}
        >
          {name}
        </Text>

        <Ionicons
          name={isEditing ? 'pencil-outline' : 'chevron-forward'}
          size={16}
          color={isEditing ? colors.primary : colors.textMuted}
          style={styles.chevron}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: planFinanceKit.radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarWell: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  name: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.body,
    lineHeight: typography.body + 2,
    textAlign: 'left',
  },
  chevron: {
    flexShrink: 0,
  },
  pressed: {
    opacity: 0.82,
  },
});
