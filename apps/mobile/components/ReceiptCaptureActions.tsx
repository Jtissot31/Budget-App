import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { containerSurfaceStyle, radius, spacing } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  onScan: () => void;
  onImport: () => void;
  onCapture: () => void;
  compact?: boolean;
  variant?: 'grid' | 'premium';
  label?: string;
  /** Detail sheet: elevated fill without container outline. */
  flat?: boolean;
};

export function ReceiptCaptureActions({
  onScan,
  onImport,
  onCapture,
  compact = false,
  variant = 'grid',
  label = 'Importer ou scanner un reçu',
  flat = false,
}: Props) {
  const { colors, isLight } = useAppTheme();
  const surface = flat
    ? { backgroundColor: colors.surfaceElevated, borderWidth: 0, borderColor: 'transparent' as const }
    : containerSurfaceStyle(isLight);

  const openPremiumMenu = () => {
    tapHaptic();
    Alert.alert(label, 'Choisis une source pour le reçu.', [
      { text: 'Scanner le reçu', onPress: onScan },
      { text: 'Prendre une photo', onPress: onCapture },
      { text: 'Importer de la galerie', onPress: onImport },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  if (variant === 'premium') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={openPremiumMenu}
        style={({ pressed }) => [styles.premiumBtn, surface, pressed && styles.pressed]}
      >
        <View style={[styles.premiumIconWell, { backgroundColor: colors.surfaceElevated }]}>
          <AppIcon family="ionicons" name="receipt-outline" size={20} color={colors.text} />
        </View>
        <View style={styles.premiumCopy}>
          <Text style={[styles.premiumLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.premiumHint, { color: colors.textMuted }]}>Scan, photo ou galerie</Text>
        </View>
        <AppIcon family="ionicons" name="chevron-forward" size={17} color={colors.textMuted} />
      </Pressable>
    );
  }

  const actions = [
    {
      key: 'scan',
      icon: 'scan-outline' as const,
      label: 'Scanner',
      hint: 'Extraction rapide',
      onPress: onScan,
      accent: true,
    },
    {
      key: 'camera',
      icon: 'camera-outline' as const,
      label: 'Photo',
      hint: 'Caméra',
      onPress: onCapture,
    },
    {
      key: 'import',
      icon: 'image-outline' as const,
      label: 'Importer',
      hint: 'Galerie',
      onPress: onImport,
    },
  ];

  return (
    <View style={[styles.grid, compact && styles.gridCompact]}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => {
            tapHaptic();
            action.onPress();
          }}
          style={({ pressed }) => [
            styles.action,
            surface,
            action.accent && { borderColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.iconWell, { backgroundColor: action.accent ? colors.successMuted : colors.input }]}>
            <AppIcon family="ionicons" name={action.icon} size={18} color={action.accent ? colors.primary : colors.textSecondary} />
          </View>
          <Text style={[styles.label, { color: colors.text }]}>{action.label}</Text>
          {!compact ? <Text style={[styles.hint, { color: colors.textMuted }]}>{action.hint}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  premiumBtn: {
    minHeight: 58,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  premiumIconWell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  premiumLabel: {
    ...typographyKit.caption,
  },
  premiumHint: {
    ...typographyKit.microMedium,
  },
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  gridCompact: {
    gap: spacing.xs,
  },
  action: {
    flex: 1,
    minHeight: 78,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typographyKit.caption,
    textAlign: 'center',
  },
  hint: {
    ...typographyKit.microMedium,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.74,
  },
});
