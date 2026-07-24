import { StyleSheet, Text, View } from 'react-native';
import {
  planDetailCardStyleFromTheme,
  planDetailFonts,
  usePlanDetailTheme,
} from '@/components/plans/planDetailTheme';
import { spacing } from '@/constants/theme';

type Props = {
  rationale: string;
  bullets?: readonly string[];
  /** Default: POURQUOI CE PLAN */
  title?: string;
};

/** Shared “why this plan” card used on detail + explanatory screens. */
export function PlanWhyCard({ rationale, bullets = [], title = 'POURQUOI CE PLAN' }: Props) {
  const theme = usePlanDetailTheme();

  return (
    <View style={[planDetailCardStyleFromTheme(theme), styles.card]}>
      <Text style={[planDetailFonts.sectionCaps, { color: theme.accent }]}>{title}</Text>
      <Text style={[planDetailFonts.body, { color: theme.text }]}>{rationale}</Text>
      {bullets.length ? (
        <View style={styles.bullets}>
          {bullets.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <View style={[styles.bulletDot, { backgroundColor: theme.textMuted }]} />
              <Text style={[planDetailFonts.body, { color: theme.text, flex: 1 }]}>{bullet}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
  },
});
