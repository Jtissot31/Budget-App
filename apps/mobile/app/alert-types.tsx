/**
 * Types d’alertes — catalogue de tout ce que l’app peut envoyer,
 * avec un aperçu Accueil (icône + titre) et l’interrupteur (mêmes préférences que Messages).
 */
import { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { HomeAlertGlyph } from '@/components/alerts/HomeAlertGlyph';
import { OnyxContainer } from '@/components/OnyxContainer';
import { PageTransition } from '@/components/PageTransition';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
  PAGE_TITLE_STYLE,
  screenHorizontalGutter,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  ALERT_SECTION_LABELS,
  ALERT_SECTION_ORDER,
  alertSectionForKind,
  type AlertCenterSection,
} from '@/lib/alerts';
import {
  ALERT_REASONS,
  homeAlertPreviewAccent,
  homeAlertPreviewSurface,
} from '@/lib/alertPresentation';
import {
  ALERT_TYPE_CATALOG,
  defaultAlertTypePreferences,
  getAlertTypePreferences,
  setAlertTypePreference,
  type AlertTypeCatalogEntry,
  type AlertTypePreferenceId,
  type AlertTypePreferences,
} from '@/lib/alertTypePreferences';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

/** Accueil reason titles — same copy as Notifications & alertes on the home hub. */
const ALERT_TYPE_PREVIEW_TITLES: Record<AlertTypePreferenceId, string> = {
  credit_limit: ALERT_REASONS.creditLimit,
  low_funds: ALERT_REASONS.lowFunds,
  balance_low: ALERT_REASONS.balanceLow,
  budget_over: ALERT_REASONS.budgetOver,
  plan_adaptation: ALERT_REASONS.planAdaptation,
  fyn: 'Autres conseils',
};

function groupCatalogBySection(): { section: AlertCenterSection; entries: AlertTypeCatalogEntry[] }[] {
  return ALERT_SECTION_ORDER.map((section) => ({
    section,
    entries: ALERT_TYPE_CATALOG.filter((entry) => alertSectionForKind(entry.kind) === section),
  })).filter((group) => group.entries.length > 0);
}

function AlertTypeAccueilPreview({
  entry,
  enabled,
}: {
  entry: AlertTypeCatalogEntry;
  enabled: boolean;
}) {
  const { colors, isLight } = useAppTheme();
  const accent = homeAlertPreviewAccent(entry, colors, isLight);
  const surface = homeAlertPreviewSurface(colors, isLight);
  const title = ALERT_TYPE_PREVIEW_TITLES[entry.id];
  const iconColor = enabled ? accent.iconColor : colors.textMuted;
  const titleColor = enabled ? colors.text : colors.textMuted;

  return (
    <View accessible accessibilityLabel={`Exemple Accueil : ${title}`}>
      <ProtoGlassCard
        style={[styles.previewCard, surface, !enabled && styles.previewDimmed]}
        padding={0}
      >
        <View style={styles.previewInner}>
          <View style={[styles.previewIcon, { backgroundColor: accent.iconBg }]}>
            <HomeAlertGlyph icon={accent.icon} color={iconColor} size={16} />
          </View>
          <Text style={[styles.previewTitle, { color: titleColor }]} numberOfLines={2}>
            {title}
          </Text>
        </View>
      </ProtoGlassCard>
    </View>
  );
}

export default function AlertTypesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const [prefs, setPrefs] = useState<AlertTypePreferences>(defaultAlertTypePreferences);

  const load = useCallback(async () => {
    setPrefs(await getAlertTypePreferences());
  }, []);

  useRefreshOnFocus(load);

  const groups = useMemo(groupCatalogBySection, []);
  const enabledCount = ALERT_TYPE_CATALOG.filter((entry) => prefs[entry.id] !== false).length;

  const toggle = (id: AlertTypePreferenceId) => {
    tapHaptic();
    const enabled = prefs[id] === false;
    setPrefs((current) => ({ ...current, [id]: enabled }));
    void setAlertTypePreference(id, enabled);
  };

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + SCREEN_TOP_GUTTER,
              paddingHorizontal: contentGutter,
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            hitSlop={12}
            onPress={() => {
              tapHaptic();
              router.back();
            }}
            style={({ pressed }) => [styles.backHit, pressed && styles.pressed]}
          >
            <AppIcon family="ionicons" name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            Types d’alertes
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: contentGutter,
              paddingBottom: Math.max(insets.bottom + spacing.xl, 56),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.intro, { color: colors.textMuted }]}>
            {`Tu reçois ${enabledCount} type${enabledCount > 1 ? 's' : ''} sur ${ALERT_TYPE_CATALOG.length}. L’aperçu montre l’icône et le titre comme sur Accueil. Décoche un type pour ne plus le voir sur Accueil ni dans Messages.`}
          </Text>

          {groups.map((group) => (
            <View key={group.section} style={styles.section}>
              <ProtoSectionHeader title={ALERT_SECTION_LABELS[group.section]} />
              <View style={styles.sectionRows}>
                {group.entries.map((entry) => {
                  const checked = prefs[entry.id] !== false;
                  return (
                    <View key={entry.id} style={styles.typeBlock}>
                      <AlertTypeAccueilPreview entry={entry} enabled={checked} />
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        accessibilityLabel={entry.label}
                        accessibilityHint={entry.trigger}
                        onPress={() => toggle(entry.id)}
                        style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
                      >
                        <OnyxContainer halo={false} style={styles.typeRow}>
                          <View style={styles.typeCopy}>
                            <Text style={[styles.typeLabel, { color: colors.text }]}>
                              {entry.label}
                            </Text>
                            <Text style={[styles.typeTrigger, { color: colors.textSecondary }]}>
                              {entry.trigger}
                            </Text>
                          </View>
                          <AppIcon
                            family="ionicons"
                            name={checked ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={checked ? colors.primary : colors.borderStrong}
                            style={styles.checkboxGlyph}
                          />
                        </OnyxContainer>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  backHit: {
    padding: spacing.xs,
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    ...PAGE_TITLE_STYLE,
    fontSize: 28,
    lineHeight: 36,
    minWidth: 0,
  },
  content: {
    gap: spacing.xl,
  },
  intro: {
    ...typographyKit.metaMedium,
    fontSize: 13,
    lineHeight: 18,
  },
  section: {
    gap: 0,
  },
  sectionRows: {
    gap: spacing.md,
  },
  typeBlock: {
    gap: ONYX_CONTAINER.listGap,
  },
  /** Matches Accueil Notifications & alertes card (ProtoHomeHub). */
  previewCard: {
    borderRadius: 16,
  },
  previewDimmed: {
    opacity: 0.55,
  },
  previewInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  previewTitle: {
    ...typographyKit.rowTitle,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.15,
    flex: 1,
    minWidth: 0,
  },
  typeRow: {
    ...onyxContainerRowLayoutStyle(),
    alignItems: 'flex-start',
  },
  typeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  typeLabel: {
    ...typographyKit.rowTitle,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.15,
  },
  typeTrigger: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 15,
  },
  /** Optically centers the 22px checkbox on the first copy line (18px). */
  checkboxGlyph: {
    marginTop: -2,
    flexShrink: 0,
  },
  pressed: { opacity: 0.72 },
});
