import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';
import ChevronRightMod from 'lucide-react-native/dist/cjs/icons/chevron-right.js';
import TargetMod from 'lucide-react-native/dist/cjs/icons/target.js';
import TrendingUpMod from 'lucide-react-native/dist/cjs/icons/trending-up.js';

const ChevronRight = resolveLucideIcon(ChevronRightMod)!;
const Target = resolveLucideIcon(TargetMod)!;
const TrendingUp = resolveLucideIcon(TrendingUpMod)!;
import {
  ICON_WELL_SIZE,
  containerSurfaceStyle,
  fontFamilies,
  PAGE_PADDING_HORIZONTAL,
  radius,
  spacing,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type ShortcutCardProps = {
  title: string;
  subtitle: string;
  accessibilityLabel: string;
  icon: ReactNode;
  onPress: () => void;
};

function ShortcutCard({ title, subtitle, accessibilityLabel, icon, onPress }: ShortcutCardProps) {
  const { colors, isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);
  const iconWellBg = isLight ? colors.surfaceElevated : colors.input;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.card, surface, pressed && styles.pressed]}
    >
      <View style={styles.chevronWrap}>
        <ChevronRight size={18} color={colors.text} strokeWidth={2.5} />
      </View>
      <View style={[styles.iconWrap, { backgroundColor: iconWellBg, borderColor: colors.border }]}>
        {icon}
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
    </Pressable>
  );
}

type Props = {
  onPressPlans: () => void;
  onPressSavingsGoals: () => void;
};

export function BudgetShortcutCards({ onPressPlans, onPressSavingsGoals }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.grid}>
      <ShortcutCard
        title="Plans financiers"
        subtitle="Voir mes plans"
        accessibilityLabel="Ouvrir les plans financiers"
        icon={<TrendingUp size={16} color={colors.accentGreen} strokeWidth={2} />}
        onPress={onPressPlans}
      />
      <ShortcutCard
        title="Objectifs d'épargne"
        subtitle="Voir mes objectifs"
        accessibilityLabel="Ouvrir les objectifs d'épargne"
        icon={<Target size={16} color={colors.accentGreen} strokeWidth={2} />}
        onPress={onPressSavingsGoals}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  card: {
    flex: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingTop: 6,
    paddingBottom: 6,
    minHeight: 72,
    overflow: 'visible',
  },
  iconWrap: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  chevronWrap: {
    position: 'absolute',
    top: 6,
    right: spacing.sm,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 17,
    marginTop: spacing.xs,
    paddingRight: 22,
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
    includeFontPadding: false,
  },
  pressed: {
    opacity: 0.82,
  },
});
