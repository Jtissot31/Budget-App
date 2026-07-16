import { Pressable, StyleSheet, Text } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { spacing, typographyKit } from '@/constants/theme';
import {
  PLAN_CARD_PADDING,
  planFinanceCardIconColor,
  planFinanceContainerPressedStyle,
} from '@/constants/planFinanceKit';
import {
  planCatalogCardMetaLine,
  type PlanCatalogEntry,
} from '@/lib/plans/planCatalogData';
import { getCategoryIcon } from '@/lib/plans/planCardPresentation';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  entry: PlanCatalogEntry;
  onPress: () => void;
};

/** Carte template catalogue — alignée sur PlanCard (suggested): meta + description. */
export function PlanCatalogCard({ entry, onPress }: Props) {
  const { colors } = useAppTheme();
  const iconColor = planFinanceCardIconColor();
  const metaLine = planCatalogCardMetaLine(entry.category);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Créer un plan ${entry.label}`}
      android_ripple={null}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [pressed && planFinanceContainerPressedStyle()]}
    >
      <PlanFinanceContainer style={styles.card}>
        <AppIcon
          family="material-community"
          name={getCategoryIcon(entry.category)}
          size={20}
          color={iconColor}
        />
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {entry.label}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {metaLine}
        </Text>
        <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={3}>
          {entry.description}
        </Text>
      </PlanFinanceContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    alignSelf: 'stretch',
    padding: PLAN_CARD_PADDING,
  },
  title: {
    ...typographyKit.rowTitle,
  },
  meta: {
    ...typographyKit.metaMedium,
  },
  description: {
    ...typographyKit.metaMedium,
  },
});
