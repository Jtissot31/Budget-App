import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import { interMediumText, interSemiboldText, spacing, typography } from '@/constants/theme';
import {
  PLAN_CARD_PADDING,
  planFinanceCardIconColor,
  planFinanceContainerPressedStyle,
  planFinanceFonts,
  planFinanceKit,
} from '@/constants/planFinanceKit';
import type { PlanCatalogEntry } from '@/lib/plans/planCatalogData';
import { getCategoryIcon } from '@/lib/plans/planCardPresentation';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  entry: PlanCatalogEntry;
  onPress: () => void;
};

type DescriptionMode = 'pending' | 'full' | 'cta';

/** Carte template catalogue — pas de barre ni de %. */
export function PlanCatalogCard({ entry, onPress }: Props) {
  const iconColor = planFinanceCardIconColor();
  const [descriptionMode, setDescriptionMode] = useState<DescriptionMode>('pending');

  useEffect(() => {
    setDescriptionMode('pending');
  }, [entry.description, entry.subtype]);

  const handleMeasureLayout = useCallback((lineCount: number) => {
    setDescriptionMode(lineCount > 1 ? 'cta' : 'full');
  }, []);

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
        <Text style={[styles.title, interSemiboldText]} numberOfLines={2}>
          {entry.label}
        </Text>

        {descriptionMode === 'pending' ? (
          <>
            {/* Slot so layout height stays stable while measuring. */}
            <View style={styles.descriptionSlot} />
            <Text
              style={[styles.description, styles.descriptionMeasure, interMediumText]}
              onTextLayout={(event) => handleMeasureLayout(event.nativeEvent.lines.length)}
            >
              {entry.description}
            </Text>
          </>
        ) : descriptionMode === 'cta' ? (
          <View style={styles.detailsRow}>
            <Text style={[styles.detailsLabel, interMediumText]}>Voir les détails</Text>
            <AppIcon
              family="ionicons"
              name="chevron-forward"
              size={14}
              color={planFinanceKit.colors.textMuted}
            />
          </View>
        ) : (
          <Text style={[styles.description, interMediumText]} numberOfLines={1}>
            {entry.description}
          </Text>
        )}
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
    color: planFinanceKit.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  descriptionSlot: {
    height: 18,
  },
  description: {
    color: planFinanceKit.colors.textMuted,
    fontSize: typography.meta,
    lineHeight: 18,
  },
  descriptionMeasure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 18,
  },
  detailsLabel: {
    ...planFinanceFonts.cardMeta,
    color: planFinanceKit.colors.textMuted,
  },
});
