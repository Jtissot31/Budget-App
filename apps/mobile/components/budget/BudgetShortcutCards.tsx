import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Target, TrendingUp } from 'lucide-react-native';
import { fontFamilies } from '@/constants/theme';
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
        <ChevronRight size={14} color={MUTED_COLOR} strokeWidth={2} />
      </View>
      {icon}
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
        icon={<TrendingUp size={18} color={ACCENT_GREEN} strokeWidth={2} />}
        onPress={onPressPlans}
      />
      <ShortcutCard
        title="Objectifs d'épargne"
        subtitle="Voir mes objectifs"
        accessibilityLabel="Ouvrir les objectifs d'épargne"
        icon={<Target size={18} color={ACCENT_GREEN} strokeWidth={2} />}
        onPress={onPressSavingsGoals}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 13,
    borderWidth: 0.5,
    borderColor: CARD_BORDER,
    padding: 12,
    minHeight: 96,
  },
  chevronWrap: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  title: {
    fontFamily: fontFamilies.semibold,
    fontSize: 13,
    color: TITLE_COLOR,
    marginTop: 6,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    color: MUTED_COLOR,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.82,
  },
});
