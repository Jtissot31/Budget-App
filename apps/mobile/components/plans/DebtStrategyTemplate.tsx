import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';
import ArrowRightMod from 'lucide-react-native/dist/cjs/icons/arrow-right.js';
import { PlanTimeline } from '@/components/plans/PlanTimeline';
import { PlanWhyCard } from '@/components/plans/PlanWhyCard';
import {
  planFinanceCardStyle,
  planFinanceFonts,
  planFinanceKit,
} from '@/constants/planFinanceKit';
import { interSemiboldText, spacing } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import {
  timelineStepsFromStrategyCopy,
  type PlanTimelineStepSeed,
} from '@/lib/plans/planTimelineModel';

const ArrowRight = resolveLucideIcon(ArrowRightMod)!;

type Props = {
  /** Illustration du hero (viz propre à chaque stratégie). */
  hero: ReactNode;
  heroCaptionFrom: string;
  heroCaptionTo: string;
  heading: string;
  lead: string;
  steps: readonly string[] | readonly PlanTimelineStepSeed[];
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
 * hero illustré, pitch, timeline d’étapes et carte « Pourquoi ce plan ».
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
  const timelineSteps = timelineStepsFromStrategyCopy(steps, { activeDetail: lead });

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

      <PlanTimeline steps={timelineSteps} sectionLabel="COMMENT ÇA MARCHE" />

      <PlanWhyCard rationale={whyCopy} />
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
});
