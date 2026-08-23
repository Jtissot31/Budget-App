import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OnyxContainer } from '@/components/OnyxContainer';
import { ONYX_CONTAINER } from '@/constants/planFinanceKit';
import { spacing, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  /** Condition title — reason-first, scannable. Omit when the graphic owns the hero. */
  title?: string | null;
  /** Optional account / category meta under the title. */
  meta?: string | null;
  /** Short “why” line — keep to 1–2 sentences. Omit when the graphic tells it. */
  body?: string | null;
  /** Optional graphic (gauge, timeline, etc.). */
  children?: ReactNode;
};

/**
 * Shared alert-detail hero: Onyx surface, clear hierarchy, room for a diagnostic visual.
 */
export function AlertDetailHeroCard({ title, meta, body, children }: Props) {
  const { colors } = useAppTheme();
  const titleText = title?.trim() ?? '';

  return (
    <OnyxContainer style={[styles.card, { padding: ONYX_CONTAINER.padding.card }]}>
      {titleText ? (
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
          {titleText}
        </Text>
      ) : null}
      {meta ? (
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}
      {body ? (
        <Text style={[styles.body, { color: colors.textMuted }]} numberOfLines={3}>
          {body}
        </Text>
      ) : null}
      {children ? <View style={styles.graphic}>{children}</View> : null}
    </OnyxContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  title: {
    ...typographyKit.bodyMedium,
  },
  meta: {
    ...typographyKit.metaSemibold,
  },
  body: {
    ...typographyKit.bodyMedium,
    fontSize: typographyKit.caption.fontSize,
    lineHeight: typographyKit.caption.lineHeight,
  },
  graphic: {
    alignSelf: 'stretch',
  },
});
