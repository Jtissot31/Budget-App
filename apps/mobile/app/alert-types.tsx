/**
 * Types d’alertes — tout ce que l’app peut envoyer, groupé par section,
 * avec un interrupteur par type (mêmes préférences qu’Accueil et Messages).
 */
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeAlertGlyph } from '@/components/alerts/HomeAlertGlyph';
import { AppIcon } from '@/components/icons/AppIcon';
import {
  FixedScreenHeader,
  fixedHeaderScrollStyle,
  fixedHeaderScreenStyle,
} from '@/components/FixedScreenHeader';
import { ListCard, RingGauge, SECTION_GAP, SectionLabel, SummaryCard } from '@/components/kit';
import { PageTransition } from '@/components/PageTransition';
import { PremiumSwitch } from '@/components/PremiumSwitch';
import { jakartaMediumText, jakartaSemiboldText, PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import {
  ALERT_SECTION_LABELS,
  ALERT_SECTION_ORDER,
  alertSectionForKind,
  type AlertCenterSection,
} from '@/lib/alerts';
import { homeAlertPreviewAccent } from '@/lib/alertPresentation';
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

function groupCatalogBySection(): { section: AlertCenterSection; entries: AlertTypeCatalogEntry[] }[] {
  return ALERT_SECTION_ORDER.map((section) => ({
    section,
    entries: ALERT_TYPE_CATALOG.filter((entry) => alertSectionForKind(entry.kind) === section),
  })).filter((group) => group.entries.length > 0);
}

function AlertTypeRow({
  entry,
  enabled,
  isLast,
  onToggle,
}: {
  entry: AlertTypeCatalogEntry;
  enabled: boolean;
  isLast: boolean;
  onToggle: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const accent = homeAlertPreviewAccent(entry, colors, isLight);
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.containerBorder },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: accent.iconBg }, !enabled && styles.dimmed]}>
        <HomeAlertGlyph icon={accent.icon} color={enabled ? accent.iconColor : colors.textMuted} size={17} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.label, jakartaSemiboldText, { color: enabled ? colors.text : colors.textMuted }]}>
          {entry.label}
        </Text>
        <Text style={[styles.trigger, jakartaMediumText, { color: colors.textMuted }]} numberOfLines={2}>
          {entry.trigger}
        </Text>
      </View>
      <PremiumSwitch accessibilityLabel={entry.label} value={enabled} onValueChange={onToggle} />
    </View>
  );
}

export default function AlertTypesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [prefs, setPrefs] = useState<AlertTypePreferences>(defaultAlertTypePreferences);

  const load = useCallback(async () => {
    setPrefs(await getAlertTypePreferences());
  }, []);
  useRefreshOnFocus(load);

  const groups = useMemo(() => groupCatalogBySection(), []);
  const total = ALERT_TYPE_CATALOG.length;
  const enabledCount = ALERT_TYPE_CATALOG.filter((entry) => prefs[entry.id] !== false).length;

  const toggle = (id: AlertTypePreferenceId) => {
    tapHaptic();
    const enabled = prefs[id] === false;
    setPrefs((current) => ({ ...current, [id]: enabled }));
    void setAlertTypePreference(id, enabled);
  };

  return (
    <PageTransition>
      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
        <FixedScreenHeader title="Types d’alertes" onBack={() => router.back()} />
        <ScrollView
          style={fixedHeaderScrollStyle}
          contentContainerStyle={{
            paddingHorizontal: PAGE_PADDING_HORIZONTAL,
            paddingBottom: Math.max(insets.bottom + spacing.xl, 56),
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <SummaryCard
              label="Alertes actives"
              amount={`${enabledCount} sur ${total}`}
              badge={
                enabledCount === total
                  ? { label: 'Tout est surveillé', color: colors.accentGreen }
                  : { label: `${total - enabledCount} en pause`, color: colors.textMuted }
              }
              aside={
                <RingGauge progress={total > 0 ? enabledCount / total : 0} color={colors.accentGreen} size={64} stroke={7}>
                  <AppIcon family="ionicons" name="notifications-outline" size={20} color={colors.text} />
                </RingGauge>
              }
              footer="Une alerte en pause n’apparaît plus sur Accueil ni dans Messages."
            />
          </View>

          {groups.map((group) => (
            <View key={group.section} style={styles.section}>
              <SectionLabel title={ALERT_SECTION_LABELS[group.section]} />
              <ListCard>
                {group.entries.map((entry, index) => (
                  <AlertTypeRow
                    key={entry.id}
                    entry={entry}
                    enabled={prefs[entry.id] !== false}
                    isLast={index === group.entries.length - 1}
                    onToggle={() => toggle(entry.id)}
                  />
                ))}
              </ListCard>
            </View>
          ))}
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  section: { marginBottom: SECTION_GAP + spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dimmed: { opacity: 0.55 },
  copy: { flexShrink: 1, flexGrow: 1, minWidth: 0, gap: 2 },
  label: { fontSize: 14, lineHeight: 18, letterSpacing: -0.15 },
  trigger: { fontSize: 11.5, lineHeight: 15 },
});
