import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';
import ChevronRightMod from 'lucide-react-native/dist/cjs/icons/chevron-right.js';
import TargetMod from 'lucide-react-native/dist/cjs/icons/target.js';
import TrendingUpMod from 'lucide-react-native/dist/cjs/icons/trending-up.js';

const ChevronRight = resolveLucideIcon(ChevronRightMod)!;
const Target = resolveLucideIcon(TargetMod)!;
const TrendingUp = resolveLucideIcon(TrendingUpMod)!;
import { fontFamilies, PAGE_PADDING_HORIZONTAL } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';

const CARD_BG = '#111111';
const CARD_BORDER = '#ffffff15';
const ACCENT_GREEN = '#4ADE80';
const TITLE_COLOR = '#FFFFFF';
const MUTED_COLOR = '#666666';

type ShortcutCardProps = {
  title: string;
  subtitle: string;
  accessibilityLabel: string;
  icon: ReactNode;
  onPress: () => void;
};

function ShortcutCard({ title, subtitle, accessibilityLabel, icon, onPress }: ShortcutCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.chevronWrap}>
        <ChevronRight size={12} color={MUTED_COLOR} strokeWidth={2} />
      </View>
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  );
}

type Props = {
  onPressPlans: () => void;
  onPressSavingsGoals: () => void;
};

export function BudgetShortcutCards({ onPressPlans, onPressSavingsGoals }: Props) {
  return (
    <View style={styles.grid}>
      <ShortcutCard
        title="Plans financiers"
        subtitle="Voir mes plans"
        accessibilityLabel="Ouvrir les plans financiers"
        icon={<TrendingUp size={16} color={ACCENT_GREEN} strokeWidth={2} />}
        onPress={onPressPlans}
      />
      <ShortcutCard
        title="Objectifs d'épargne"
        subtitle="Voir mes objectifs"
        accessibilityLabel="Ouvrir les objectifs d'épargne"
        icon={<Target size={16} color={ACCENT_GREEN} strokeWidth={2} />}
        onPress={onPressSavingsGoals}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 11,
    minHeight: 82,
    overflow: 'visible',
  },
  iconWrap: {
    alignSelf: 'flex-start',
  },
  chevronWrap: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    lineHeight: 17,
    color: TITLE_COLOR,
    marginTop: 2,
    paddingRight: 14,
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    lineHeight: 14,
    color: MUTED_COLOR,
    marginTop: 2,
    includeFontPadding: false,
  },
  pressed: {
    opacity: 0.82,
  },
});
