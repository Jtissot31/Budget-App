import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppIcon } from '@/components/icons/AppIcon';
import { DashboardCard } from '@/components/DashboardCard';
import { DashboardSectionLabel } from '@/components/DashboardSectionLabel';
import { planFinanceContainerPressedStyle } from '@/constants/planFinanceKit';
import { moneyAmountTypography, radius, spacing, typographyKit } from '@/constants/theme';
import { planHeroAmountLine } from '@/lib/dashboardPlanPresentation';
import { MOCK_DASHBOARD_PLANS, type DashboardPlanDetail } from '@/lib/dashboardPlansMock';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

/** Home preview — short stack of plans. */
const HOME_PLANS_PREVIEW_LIMIT = 3;
const ICON_WELL_SIZE = 44;
const ICON_SIZE = 20;

function planUsesAccentChrome(plan: DashboardPlanDetail): boolean {
  return plan.category === 'Épargne';
}

function planUsesDangerChrome(plan: DashboardPlanDetail): boolean {
  return plan.category === 'Budget' && !plan.progressPositive;
}

type PlanRowProps = {
  plan: DashboardPlanDetail;
  onPress: () => void;
};

function HomePlanRow({ plan, onPress }: PlanRowProps) {
  const { colors } = useAppTheme();
  const accent = planUsesAccentChrome(plan);
  const danger = planUsesDangerChrome(plan);

  const progressColor = danger
    ? colors.danger
    : accent
      ? colors.accentGreen
      : colors.textMuted;
  const pct = Math.min(100, Math.max(0, plan.progress));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${plan.name}`}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={({ pressed }) => [pressed && planFinanceContainerPressedStyle()]}
    >
      <DashboardCard padding={0} innerStyle={styles.cardInner}>
        <View style={[styles.iconWell, { backgroundColor: colors.surfaceElevated }]}>
          <AppIcon
            family="material-community"
            name={plan.icon}
            size={ICON_SIZE}
            color={colors.textSecondary}
          />
        </View>

        <View style={styles.cardCopy}>
          <View style={styles.titleRow}>
            <Text
              style={[typographyKit.rowTitle, styles.planTitle, { color: colors.text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {plan.name}
            </Text>
            <Text
              style={[
                moneyAmountTypography({ tier: 'row' }),
                styles.amountRatio,
                { color: colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {planHeroAmountLine(plan)}
            </Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: progressColor,
                  width: `${pct}%`,
                },
              ]}
            />
          </View>

          <View style={styles.metaRow}>
            <Text
              style={[typographyKit.microUpper, styles.categoryLabel, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {plan.category}
            </Text>
            <Text
              style={[
                typographyKit.microMedium,
                styles.pctLabel,
                { color: progressColor },
              ]}
            >
              {pct}%
            </Text>
          </View>
        </View>
      </DashboardCard>
    </Pressable>
  );
}

export function HomePlansCarousel() {
  const router = useRouter();
  const plans = MOCK_DASHBOARD_PLANS.slice(0, HOME_PLANS_PREVIEW_LIMIT);

  return (
    <View style={styles.section}>
      <DashboardSectionLabel>Tes plans</DashboardSectionLabel>

      <View style={styles.list}>
        {plans.map((plan) => (
          <HomePlanRow
            key={plan.id}
            plan={plan}
            onPress={() => {
              router.push({ pathname: '/plans/[id]', params: { id: plan.id } });
            }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md + 2,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg + 4,
  },
  iconWell: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  planTitle: {
    flex: 1,
    minWidth: 0,
  },
  amountRatio: {
    flexShrink: 0,
    fontSize: typographyKit.micro.fontSize,
    lineHeight: typographyKit.micro.lineHeight,
    fontWeight: '600',
  },
  progressTrack: {
    marginTop: spacing.sm,
    height: 4,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  categoryLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  pctLabel: {
    flexShrink: 0,
    fontSize: 10,
    fontWeight: '600',
  },
});
