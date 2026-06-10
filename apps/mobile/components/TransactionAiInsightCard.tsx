import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SurfaceCard } from '@/components/SurfaceCard';
import { radius, spacing } from '@/constants/theme';
import { typographyKit } from '@/constants/typographyKit';
import type { TransactionInsight } from '@/lib/transactionInsight';
import { useAppTheme } from '@/lib/themeContext';

type Props = {
  insight: TransactionInsight;
  /** Flat elevated panel — no container outline (detail sheet inner cards). */
  flat?: boolean;
};

function RichInsightText({ text, color }: { text: string; color: string }) {
  const parts = text.split(/(\*\*.+?\*\*)/g).filter(Boolean);

  return (
    <Text style={[styles.tip, { color }, typographyKit.metaMedium]}>
      {parts.map((part, index) => {
        const bold = part.startsWith('**') && part.endsWith('**');
        const content = bold ? part.slice(2, -2) : part;
        return (
          <Text key={`${index}-${content.slice(0, 8)}`} style={bold ? styles.tipBold : undefined}>
            {content}
          </Text>
        );
      })}
    </Text>
  );
}

export function TransactionAiInsightCard({ insight, flat = false }: Props) {
  const { colors } = useAppTheme();

  const content = (
    <>
      <View style={styles.header}>
        <View style={[styles.iconWell, { backgroundColor: colors.purpleMuted, borderColor: colors.border }]}>
          <Ionicons name="sparkles" size={14} color={colors.purple} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{insight.title}</Text>
      </View>
      <RichInsightText text={insight.tip} color={colors.textMuted} />
    </>
  );

  if (flat) {
    return (
      <View style={[styles.flatPanel, { backgroundColor: colors.surfaceElevated }]}>
        {content}
      </View>
    );
  }

  return (
    <SurfaceCard innerStyle={styles.inner} padding={spacing.lg}>
      {content}
    </SurfaceCard>
  );
}

const styles = StyleSheet.create({
  flatPanel: {
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  inner: {
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWell: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typographyKit.caption,
    letterSpacing: -0.1,
  },
  tip: {
    lineHeight: 19,
  },
  tipBold: {
    ...typographyKit.caption,
    color: undefined,
  },
});
