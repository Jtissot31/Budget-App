import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { HomeAlertGlyph } from '@/components/alerts/HomeAlertGlyph';
import { ListCard, PressScale, SectionLabel, withAlpha } from '@/components/kit';
import { jakartaMediumText, jakartaSemiboldText, spacing, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import {
  ALERT_SECTION_LABELS,
  formatAlertClockTime,
  groupAlertCenterItems,
  type AlertCenterItem,
  type AlertCenterSeverity,
} from '@/lib/alerts';
import { alertHomePrimaryTitle, homeAlertPreviewAccent } from '@/lib/alertPresentation';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  items: AlertCenterItem[];
  onOpenAlert: (item: AlertCenterItem) => void;
};

const WARN_TONE = '#E0B354';

function severityTone(
  severity: AlertCenterSeverity,
  colors: { danger: string; accentGreen: string; textMuted: string },
): string {
  if (severity === 'danger') return colors.danger;
  if (severity === 'warning') return WARN_TONE;
  if (severity === 'success') return colors.accentGreen;
  return colors.textMuted;
}

function toHex(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#8E8E9A';
}

function AlertRow({ item, isLast, onPress }: { item: AlertCenterItem; isLast: boolean; onPress: () => void }) {
  const { colors, isLight } = useAppTheme();
  const accent = homeAlertPreviewAccent(item, colors, isLight);
  const tone = severityTone(item.severity, colors);
  const title = alertHomePrimaryTitle(item);
  const rawClock = formatAlertClockTime(item.timestamp);
  // Date-only alerts are stamped at midnight — the time adds nothing.
  const clock = rawClock && rawClock !== '00:00' ? rawClock : null;

  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.985}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir l'alerte ${title}`}
      accessibilityState={{ selected: !item.read }}
    >
      <View
        style={[
          styles.row,
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.containerBorder },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: withAlpha(toHex(tone), 0.12) }]}>
          <HomeAlertGlyph icon={accent.icon} color={tone} size={17} />
        </View>
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.title, item.read ? jakartaMediumText : jakartaSemiboldText, { color: colors.text }]}
              numberOfLines={2}
            >
              {title}
            </Text>
            <View style={styles.trailing}>
              {clock ? <Text style={[styles.time, { color: colors.textMuted }]}>{clock}</Text> : null}
              {!item.read ? (
                <View style={[styles.unread, { backgroundColor: colors.accentGreen }]} accessibilityLabel="Non lu" />
              ) : null}
            </View>
          </View>
          <Text style={[styles.body, jakartaMediumText, { color: colors.textMuted }]} numberOfLines={2}>
            {item.message}
          </Text>
        </View>
        <AppIcon family="ionicons" name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </PressScale>
  );
}

export function AlertCenterContent({ items, onOpenAlert }: Props) {
  const { colors } = useAppTheme();
  const groups = groupAlertCenterItems(items);

  if (items.length === 0) {
    return (
      <ListCard padding={20}>
        <View style={styles.empty}>
          <View style={[styles.emptyIcon, { backgroundColor: withAlpha('#22C55E', 0.12) }]}>
            <AppIcon family="ionicons" name="checkmark-done" size={22} color={colors.accentGreen} />
          </View>
          <Text style={[styles.emptyTitle, jakartaSemiboldText, { color: colors.text }]}>Aucune alerte</Text>
          <Text style={[styles.emptyMessage, jakartaMediumText, { color: colors.textMuted }]}>
            On te prévient dès qu’un paiement, un solde ou un budget mérite ton attention.
          </Text>
        </View>
      </ListCard>
    );
  }

  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <View key={group.section}>
          <SectionLabel title={ALERT_SECTION_LABELS[group.section]} />
          <ListCard>
            {group.items.map((item, index) => (
              <AlertRow
                key={item.id}
                item={item}
                isLast={index === group.items.length - 1}
                onPress={() => {
                  tapHaptic();
                  onOpenAlert(item);
                }}
              />
            ))}
          </ListCard>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flexShrink: 1, flexGrow: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { fontSize: 14, lineHeight: 18, letterSpacing: -0.15, flexShrink: 1, flexGrow: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 },
  time: { ...typographyKit.micro, fontSize: 11 },
  unread: { width: 8, height: 8, borderRadius: 4 },
  body: { fontSize: 12, lineHeight: 16 },
  empty: { alignItems: 'center', gap: spacing.sm },
  emptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15 },
  emptyMessage: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
