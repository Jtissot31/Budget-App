import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';
import ArrowRightMod from 'lucide-react-native/dist/cjs/icons/arrow-right.js';
import ZapMod from 'lucide-react-native/dist/cjs/icons/zap.js';
import {
  planFinanceCardStyle,
  planFinanceFonts,
  planFinanceKit,
} from '@/constants/planFinanceKit';
import { ICON_WELL_SIZE, interBoldText, interSemiboldText, spacing } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';

const ArrowRight = resolveLucideIcon(ArrowRightMod)!;
const Zap = resolveLucideIcon(ZapMod)!;

type Props = {
  /** Illustration du hero (viz propre à chaque stratégie). */
  hero: ReactNode;
  heroCaptionFrom: string;
  heroCaptionTo: string;
  heading: string;
  lead: string;
  steps: readonly string[];
  whyCopy: string;
};

/**
 * Affiche la raison IA personnalisée si elle est complète ; sinon le texte
 * éducatif de la maquette (évite teaser catalogue tronqué / incomplet).
 */
export function resolveStrategyWhyCopy(
  override: string | undefined,
  educationalCopy: string,
  catalogTeaser: string,
): string {
  const trimmed = override?.trim();
  if (!trimmed) return educationalCopy;
  if (catalogTeaser.startsWith(trimmed)) return educationalCopy;
  return trimmed;
}

/**
 * Gabarit partagé des fiches stratégies de dettes (Boule de neige, Avalanche) —
 * hero illustré, pitch, étapes numérotées et carte « Pourquoi ça marche ».
 */
export function DebtStrategyTemplate({
  hero,
  heroCaptionFrom,
  heroCaptionTo,
  heading,
  lead,
  steps,
  whyCopy,
}: Props) {
  const pf = planFinanceKit.colors;

  return (
    <View style={styles.root}>
      <View style={[planFinanceCardStyle(), styles.heroCard]}>
        {hero}
        <View style={styles.heroCaption}>
          <Text style={[styles.heroCaptionText, { color: pf.textMuted }]}>{heroCaptionFrom}</Text>
          <ArrowRight size={12} color={pf.textMuted} strokeWidth={2.4} />
          <Text style={[styles.heroCaptionText, { color: pf.textMuted }]}>{heroCaptionTo}</Text>
        </View>
      </View>

      <View style={styles.pitch}>
        <Text style={[styles.heading, { color: pf.text }]}>{heading}</Text>
        <Text style={[styles.lead, { color: pf.textMuted }]}>{lead}</Text>
      </View>

      <View style={styles.steps}>
        <View style={[styles.stepsLine, { backgroundColor: pf.border }]} />
        {steps.map((step, index) => (
          <View
            key={step}
            accessibilityLabel={`Étape ${index + 1} sur ${steps.length}. ${step}`}
            style={[styles.stepRow, index === steps.length - 1 && styles.stepRowLast]}
          >
            <View style={[styles.stepBadge, { backgroundColor: pf.input, borderColor: pf.border }]}>
              <Text style={[styles.stepNumber, { color: pf.accent }]}>{index + 1}</Text>
            </View>
            <Text style={[styles.stepText, { color: pf.text }]}>{step}</Text>
          </View>
        ))}
      </View>

      <View style={[planFinanceCardStyle(), styles.whyCard]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.whyIconWell, { backgroundColor: pf.input }]}
        >
          <Zap size={16} color={pf.textMuted} strokeWidth={2} />
        </View>
        <View style={styles.whyBody}>
          <Text style={planFinanceFonts.sectionCaps}>POURQUOI ÇA MARCHE</Text>
          <Text style={[styles.whyText, { color: pf.text }]}>{whyCopy}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: planFinanceKit.layout.sectionGap,
  },
  heroCard: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  heroCaption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  heroCaptionText: {
    ...interSemiboldText,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  pitch: {
    gap: spacing.sm,
  },
  heading: {
    ...typographyKit.sectionTitle,
  },
  lead: {
    ...planFinanceFonts.body,
  },
  steps: {
    position: 'relative',
  },
  stepsLine: {
    position: 'absolute',
    left: spacing.md,
    top: spacing.xl,
    bottom: spacing.xl,
    width: 2,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  stepRowLast: {
    marginBottom: 0,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: planFinanceKit.radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    ...interBoldText,
    fontSize: 13,
  },
  stepText: {
    ...planFinanceFonts.body,
    flex: 1,
    paddingTop: spacing.xs,
  },
  whyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    gap: spacing.md,
    // Évite le clip horizontal du texte long (shell carte = overflow:hidden).
    overflow: 'visible',
  },
  whyIconWell: {
    width: ICON_WELL_SIZE,
    height: ICON_WELL_SIZE,
    borderRadius: planFinanceKit.radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  whyBody: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  whyText: {
    ...planFinanceFonts.body,
    flexShrink: 1,
  },
});
