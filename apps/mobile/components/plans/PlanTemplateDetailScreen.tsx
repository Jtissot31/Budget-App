import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  planFinanceCardStyle,
  planFinanceFonts,
  planFinanceIconButtonStyle,
  planFinanceKit,
  planFinancePrimaryButtonStyle,
} from '@/constants/planFinanceKit';
import { interMediumText, interSemiboldText, spacing } from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import { PLAN_SUBTYPE_LABELS, planCategoryForSubtype, type PlanSubtype } from '@/lib/plans/Plan';
import { getCategoryIcon } from '@/lib/plans/planCardPresentation';
import { buildPrefilledSubtypeEntryParams } from '@/lib/plans/planCreateNavigation';
import { getPlanSubtypeConfig } from '@/lib/plans/planSubtypeConfig';

type Props = {
  subtype: PlanSubtype;
  /** Raison personnalisée si ouvert depuis une suggestion IA. */
  raison?: string;
};

export function PlanTemplateDetailScreen({ subtype, raison }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const config = getPlanSubtypeConfig(subtype);
  const category = planCategoryForSubtype(subtype);
  const pf = planFinanceKit.colors;
  const whyText = raison?.trim() || config.fullDescription;
  const strategyText = config.strategy;

  const handleBack = () => {
    tapHaptic();
    router.back();
  };

  const handleCreate = () => {
    tapHaptic();
    router.push({
      pathname: '/plans/create',
      params: {
        ...buildPrefilledSubtypeEntryParams(subtype, category),
        ...(raison ? { raison } : {}),
      },
    });
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: pf.background }]}>
        <View style={[styles.topBar, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={handleBack}
            style={({ pressed }) => [planFinanceIconButtonStyle(), pressed && styles.pressed]}
          >
            <AppIcon family="material" name="arrow-back" size={22} color={pf.text} />
          </Pressable>
          <View style={styles.topBarSpacer} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl + 88 },
          ]}
        >
          <View style={styles.titleBlock}>
            <AppIcon family="material-community" name={getCategoryIcon(category)} size={28} color={pf.textMuted} />
            <Text style={[styles.planTitle, planFinanceFonts.heroTitle]}>{PLAN_SUBTYPE_LABELS[subtype]}</Text>
            <Text style={[styles.modelBadge, interMediumText]}>Modèle</Text>
            <Text style={[styles.planSummary, planFinanceFonts.body]}>{config.fullDescription}</Text>
          </View>

          <View style={[planFinanceCardStyle(), styles.block]}>
            <Text style={planFinanceFonts.sectionCaps}>POURQUOI CONSIDÉRER CE PLAN</Text>
            <Text style={[planFinanceFonts.body, styles.blockBody]}>{whyText}</Text>
          </View>

          <View style={[planFinanceCardStyle(), styles.block]}>
            <Text style={planFinanceFonts.sectionCaps}>STRATÉGIE</Text>
            <Text style={[planFinanceFonts.body, styles.blockBody]}>{strategyText}</Text>
          </View>

          <View style={[planFinanceCardStyle(), styles.block]}>
            <Text style={planFinanceFonts.sectionCaps}>IMPACT</Text>
            <View style={styles.bullets}>
              {config.impactBullets.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: pf.textMuted }]} />
                  <Text style={[planFinanceFonts.body, styles.bulletText]}>{bullet}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Créer ce plan"
            onPress={handleCreate}
            style={({ pressed }) => [planFinancePrimaryButtonStyle(), pressed && styles.pressed]}
          >
            <Text style={[styles.ctaLabel, interSemiboldText]}>Créer ce plan</Text>
          </Pressable>
        </View>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  topBarSpacer: { flex: 1 },
  content: {
    paddingHorizontal: spacing.lg,
    gap: planFinanceKit.layout.sectionGap,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  planTitle: {
    fontSize: 20,
    letterSpacing: -0.3,
  },
  modelBadge: {
    color: planFinanceKit.colors.textMuted,
    fontSize: 13,
  },
  planSummary: {
    marginTop: spacing.xs,
  },
  block: {
    gap: spacing.md,
  },
  blockBody: {
    marginTop: spacing.xs,
  },
  bullets: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: planFinanceKit.colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: planFinanceKit.colors.border,
  },
  ctaLabel: {
    color: planFinanceKit.colors.textOnAccent,
    fontSize: 15,
  },
  pressed: { opacity: 0.85 },
});
