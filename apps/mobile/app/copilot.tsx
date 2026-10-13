/**
 * Copilote hub — every tip with its explanation, grouped by priority.
 * Opened from the compact Copilote widget on Accueil.
 */
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CopilotInsightRow, toneColor, useCopilotInsights } from '@/components/copilot/CopilotCard';
import { FixedScreenHeader, fixedHeaderScreenStyle, fixedHeaderScrollStyle } from '@/components/FixedScreenHeader';
import { AppIcon } from '@/components/icons/AppIcon';
import { ListCard, Reveal, SECTION_GAP, SectionLabel } from '@/components/kit';
import { PageTransition } from '@/components/PageTransition';
import {
  FLOATING_NAV_CONTENT_PADDING,
  jakartaBoldText,
  jakartaMediumText,
  PAGE_PADDING_HORIZONTAL,
  spacing,
} from '@/constants/theme';
import { copilotHeadline, type CopilotInsight } from '@/lib/copilotInsights';
import { useAppTheme } from '@/lib/themeContext';

const GROUPS: { title: string; match: (insight: CopilotInsight) => boolean }[] = [
  { title: 'À traiter', match: (i) => i.tone === 'risk' || i.tone === 'warn' },
  { title: 'Bon à savoir', match: (i) => i.tone === 'info' },
  { title: 'Bien joué', match: (i) => i.tone === 'good' },
];

export default function CopilotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const insights = useCopilotInsights();
  const headline = useMemo(() => (insights ? copilotHeadline(insights) : null), [insights]);

  const groups = useMemo(
    () =>
      GROUPS.map((group) => ({ title: group.title, items: (insights ?? []).filter(group.match) })).filter(
        (group) => group.items.length > 0,
      ),
    [insights],
  );

  return (
    <PageTransition>
      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
        <FixedScreenHeader title="Copilote" onBack={() => router.back()} />
        <ScrollView
          style={fixedHeaderScrollStyle}
          contentContainerStyle={{
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            paddingBottom: insets.bottom + FLOATING_NAV_CONTENT_PADDING + spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {headline ? (
            <Reveal style={styles.hero}>
              <View style={[styles.heroIcon, { backgroundColor: colors.surfaceElevated }]}>
                <AppIcon family="ionicons" name="sparkles" size={20} color={colors.text} />
              </View>
              <Text style={[styles.heroTitle, { color: toneColor(headline.tone, colors) }]}>{headline.title}</Text>
              <Text style={[styles.heroBody, { color: colors.textMuted }]}>
                Conseils calculés à partir de tes comptes, ton budget et tes paiements à venir.
              </Text>
            </Reveal>
          ) : null}

          {insights && insights.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>Rien à signaler pour l’instant.</Text>
          ) : null}

          {groups.map((group, groupIndex) => (
            <Reveal key={group.title} index={groupIndex + 1} style={styles.section}>
              <SectionLabel title={group.title} />
              <ListCard>
                {group.items.map((insight, index) => (
                  <CopilotInsightRow
                    key={insight.id}
                    insight={insight}
                    borderTop={index > 0}
                    isLast={index === group.items.length - 1}
                    onPress={insight.route ? () => router.push(insight.route as never) : undefined}
                  />
                ))}
              </ListCard>
            </Reveal>
          ))}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { alignItems: 'flex-start', gap: 6, paddingTop: spacing.sm, marginBottom: SECTION_GAP + spacing.sm },
  heroIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle: { ...jakartaBoldText, fontSize: 24, letterSpacing: -0.4 },
  heroBody: { ...jakartaMediumText, fontSize: 13.5, lineHeight: 19 },
  section: { marginBottom: SECTION_GAP + spacing.sm },
  empty: { ...jakartaMediumText, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },
});
