import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { OnyxContainer } from '@/components/OnyxContainer';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  planFinanceCardIconColor,
} from '@/constants/planFinanceKit';
import { RADIUS } from '@/constants/design-tokens';
import { spacing, typographyKit } from '@/constants/theme';
import type { PlanCatalogEntry } from '@/lib/plans/planCatalogData';
import { getSubtypeIcon } from '@/lib/plans/planCardPresentation';
import { strategyLibraryBadgeForSubtype } from '@/lib/plans/planStrategyLibrary';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  entry: PlanCatalogEntry;
  onPress: () => void;
  /** Override badge (sinon section bibliothèque / catégorie). */
  badge?: string;
};

/** Carte stratégie — Onyx: icône, titre, description, badge. */
export function PlanCatalogCard({ entry, onPress, badge }: Props) {
  const { colors } = useAppTheme();
  const iconColor = planFinanceCardIconColor();
  const tag = badge ?? strategyLibraryBadgeForSubtype(entry.subtype);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir la stratégie ${entry.label}`}
      android_ripple={null}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
    >
      <OnyxContainer style={styles.card}>
        <View style={[styles.iconWell, { backgroundColor: colors.input }]}>
          <AppIcon
            family="material-community"
            name={getSubtypeIcon(entry.subtype, entry.category)}
            size={20}
            color={iconColor}
          />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {entry.label}
            </Text>
            <View style={[styles.badge, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.textMuted }]} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          </View>
          <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={3}>
            {entry.description}
          </Text>
        </View>

        <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
      </OnyxContainer>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    alignSelf: 'stretch',
    paddingVertical: spacing.md,
    paddingHorizontal: ONYX_CONTAINER.padding.row,
    minHeight: 72,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    ...typographyKit.rowTitle,
    flex: 1,
    minWidth: 0,
  },
  badge: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    flexShrink: 0,
    maxWidth: 110,
  },
  badgeText: {
    ...typographyKit.microUpper,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  description: {
    ...typographyKit.metaMedium,
  },
});
