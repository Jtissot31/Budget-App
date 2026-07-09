import { Pressable, StyleSheet, Text } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { interMediumText, interSemiboldText, spacing, typography } from '@/constants/theme';
import {
  planFinanceCatalogCardStyle,
  planFinanceCardIconColor,
  planFinanceKit,
} from '@/constants/planFinanceKit';
import type { PlanCatalogEntry } from '@/lib/plans/planCatalogData';
import { getCategoryIcon } from '@/lib/plans/planCardPresentation';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  entry: PlanCatalogEntry;
  onPress: () => void;
};

/** Carte template catalogue — pas de barre ni de %. */
export function PlanCatalogCard({ entry, onPress }: Props) {
  const iconColor = planFinanceCardIconColor();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Créer un plan ${entry.label}`}
      android_ripple={null}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        planFinanceCatalogCardStyle(),
        styles.card,
        pressed && styles.pressed,
      ]}
    >
      <AppIcon family="material-community" 
        name={getCategoryIcon(entry.category)}
        size={20}
        color={iconColor}
      />
      <Text style={[styles.title, interSemiboldText]} numberOfLines={2}>
        {entry.label}
      </Text>
      <Text style={[styles.description, interMediumText]} numberOfLines={1}>
        {entry.description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  title: {
    color: planFinanceKit.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  description: {
    color: planFinanceKit.colors.textMuted,
    fontSize: typography.meta,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});
