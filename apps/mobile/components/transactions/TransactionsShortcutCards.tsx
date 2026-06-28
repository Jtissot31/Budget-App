import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  containerSurfaceStyle,
  fontFamilies,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';
import { useAppTheme } from '@/lib/themeContext';
import ChartPieMod from 'lucide-react-native/dist/cjs/icons/chart-pie.js';
import CircleCheckMod from 'lucide-react-native/dist/cjs/icons/circle-check.js';

const ChartPie = resolveLucideIcon(ChartPieMod)!;
const CircleCheck = resolveLucideIcon(CircleCheckMod)!;

type ShortcutChipProps = {
  label: string;
  accessibilityLabel: string;
  icon: ReactNode;
  badgeCount?: number;
  onPress: () => void;
};

function ShortcutChip({
  label,
  accessibilityLabel,
  icon,
  badgeCount = 0,
  onPress,
}: ShortcutChipProps) {
  const { colors, isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.chip, surface, pressed && styles.pressed]}
    >
      {icon}
      <Text style={[styles.chipLabel, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      {badgeCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.accentGreen }]}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

type Props = {
  onPressInsights: () => void;
  onPressReview: () => void;
  pendingCount?: number;
  /** When true, skip horizontal padding (parent already applies page inset). */
  embedded?: boolean;
};

export function TransactionsShortcutCards({
  onPressInsights,
  onPressReview,
  pendingCount = 0,
  embedded = false,
}: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.row, embedded && styles.rowEmbedded]}>
      <ShortcutChip
        label="Analyse"
        accessibilityLabel="Ouvrir l'analyse des dépenses par catégorie"
        icon={<ChartPie size={14} color={colors.accentGreen} strokeWidth={2.25} />}
        onPress={onPressInsights}
      />
      <ShortcutChip
        label="À compléter"
        accessibilityLabel={
          pendingCount > 0
            ? `Compléter ${pendingCount} dépense${pendingCount > 1 ? 's' : ''} scannée${pendingCount > 1 ? 's' : ''} sans articles`
            : 'Revoir les dépenses scannées sans articles'
        }
        icon={<CircleCheck size={14} color={colors.textMuted} strokeWidth={2.25} />}
        badgeCount={pendingCount}
        onPress={onPressReview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    marginBottom: spacing.md,
  },
  rowEmbedded: {
    paddingHorizontal: 0,
    marginTop: spacing.sm,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 34,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  chipLabel: {
    fontFamily: fontFamilies.semibold,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    flexShrink: 1,
  },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: -2,
  },
  badgeText: {
    fontFamily: fontFamilies.bold,
    fontSize: 9,
    lineHeight: 11,
    color: '#0a0a0a',
    includeFontPadding: false,
  },
  pressed: {
    opacity: 0.82,
  },
});
