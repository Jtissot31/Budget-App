import { useEffect, useRef } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { interSemiboldText, spacing, typography } from '@/constants/theme';
import { PlanCatalogCard } from '@/components/plans/PlanCatalogCard';
import { PlanCategoryFilterChips } from '@/components/plans/PlanCategoryFilterChips';
import {
  filterCatalogByCategory,
  PLAN_CATALOG_ENTRIES,
  type PlanCatalogEntry,
} from '@/lib/plans/planCatalogData';
import { PLAN_CARD_LIST_GAP, PLAN_HUB } from '@/lib/plans/planCardPresentation';
import type { PlanCategoryFilter } from '@/lib/plans/planHubData';
import { tapHaptic } from '@/lib/haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  expanded: boolean;
  categoryFilter: PlanCategoryFilter;
  onToggle: () => void;
  onCategoryChange: (next: PlanCategoryFilter) => void;
  onSelectEntry: (entry: PlanCatalogEntry) => void;
  onLayout?: (y: number) => void;
};

const EXPAND_MS = 200;

export function PlanExplorerSection({
  expanded,
  categoryFilter,
  onToggle,
  onCategoryChange,
  onSelectEntry,
  onLayout,
}: Props) {
  const chevronRotation = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const bodyOpacity = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(chevronRotation, {
        toValue: expanded ? 1 : 0,
        duration: EXPAND_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bodyOpacity, {
        toValue: expanded ? 1 : 0,
        duration: EXPAND_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [bodyOpacity, chevronRotation, expanded]);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.create(EXPAND_MS, 'easeInEaseOut', 'opacity'));
    tapHaptic();
    onToggle();
  };

  const filteredEntries = filterCatalogByCategory(PLAN_CATALOG_ENTRIES, categoryFilter);
  const chevronSpin = chevronRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View
      onLayout={(event) => {
        onLayout?.(event.nativeEvent.layout.y);
      }}
      style={styles.section}
    >
      <View style={styles.separator} />

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Explorer les plans"
        onPress={handleToggle}
        style={({ pressed }) => [styles.headerRow, pressed && styles.pressed]}
      >
        <View style={styles.headerLeft}>
          <AppIcon family="material" name="auto-awesome" size={16} color={PLAN_HUB.accent} />
          <Text style={[styles.headerTitle, interSemiboldText]}>Explorer les plans</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronSpin }] }}>
          <AppIcon family="material" name="keyboard-arrow-down" size={22} color="rgba(255, 255, 255, 0.55)" />
        </Animated.View>
      </Pressable>

      {expanded ? (
        <Animated.View style={[styles.body, { opacity: bodyOpacity }]}>
          <View style={styles.chipsBleed}>
            <PlanCategoryFilterChips value={categoryFilter} onChange={onCategoryChange} />
          </View>

          <View style={styles.catalogList}>
            {filteredEntries.map((entry) => (
              <PlanCatalogCard
                key={entry.subtype}
                entry={entry}
                onPress={() => onSelectEntry(entry)}
              />
            ))}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.xl,
    paddingTop: spacing.xxl,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: PLAN_HUB.border,
    alignSelf: 'stretch',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: typography.caption,
  },
  body: {
    gap: spacing.xl,
  },
  chipsBleed: {
    marginHorizontal: -spacing.lg,
  },
  catalogList: {
    gap: PLAN_CARD_LIST_GAP,
  },
  pressed: {
    opacity: 0.82,
  },
});
