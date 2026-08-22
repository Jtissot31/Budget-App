import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { spacing, typographyKit } from '@/constants/theme';
import {
  generateAlertProblemInsight,
  type AlertInsightContext,
} from '@/lib/ai/alertInsightService';
import { homeAlertPreviewSurface } from '@/lib/alertPresentation';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  context: AlertInsightContext;
  fallbackBody: string;
};

/** Short tip card — secondary to the hero graphic and action list. */
export function AlertProblemInsightCard({ context, fallbackBody }: Props) {
  const { colors, isLight } = useAppTheme();
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInsight() {
      setLoading(true);
      const generated = await generateAlertProblemInsight(context);
      if (cancelled) return;
      setInsight(generated);
      setLoading(false);
    }

    void loadInsight();
    return () => {
      cancelled = true;
    };
  }, [
    context.id,
    context.kind,
    context.title,
    context.message,
    context.categoryLabel,
    context.montant,
    context.recurring,
    context.paymentName,
  ]);

  const body = insight ?? fallbackBody;
  const bodyColor = loading && !insight ? colors.textMuted : colors.text;
  const surface = homeAlertPreviewSurface(colors, isLight);

  return (
    <View style={styles.section}>
      <ProtoSectionHeader
        title="CONSEIL"
        trailing={
          <View style={styles.headerTrailing}>
            <AppIcon family="material" name="auto-awesome" size={14} color={colors.accentGreen} />
            {loading ? (
              <ActivityIndicator
                size="small"
                color={colors.textMuted}
                accessibilityLabel="Analyse en cours"
              />
            ) : null}
          </View>
        }
      />
      <ProtoGlassCard style={[styles.card, surface]} padding={12}>
        <Text style={[styles.body, { color: bodyColor }]} numberOfLines={4}>
          {body}
        </Text>
      </ProtoGlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    alignSelf: 'stretch',
  },
  headerTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: 16,
  },
  body: {
    ...typographyKit.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
  },
});
