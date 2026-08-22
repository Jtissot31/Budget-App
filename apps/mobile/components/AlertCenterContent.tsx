import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { HomeAlertGlyph } from '@/components/alerts/HomeAlertGlyph';
import { ProtoGlassCard } from '@/components/proto/ProtoGlassCard';
import { ProtoSectionHeader } from '@/components/proto/ProtoSectionHeader';
import { spacing, typographyKit } from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import {
  ALERT_SECTION_LABELS,
  formatAlertClockTime,
  groupAlertCenterItems,
  type AlertCenterItem,
} from '@/lib/alerts';
import {
  alertHomePrimaryTitle,
  homeAlertPreviewAccent,
  homeAlertPreviewSurface,
} from '@/lib/alertPresentation';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  items: AlertCenterItem[];
  onOpenAlert: (item: AlertCenterItem) => void;
};

function AlertCenterCard({
  item,
  onPress,
}: {
  item: AlertCenterItem;
  onPress: () => void;
}) {
  const { colors, isLight } = useAppTheme();
  const accent = homeAlertPreviewAccent(item, colors, isLight);
  const surface = homeAlertPreviewSurface(colors, isLight);
  const title = alertHomePrimaryTitle(item);
  const clock = formatAlertClockTime(item.timestamp);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir l'alerte ${title}`}
      accessibilityState={{ selected: !item.read }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <ProtoGlassCard style={[styles.alertCard, surface]} padding={0}>
        <View style={styles.alertInner}>
          <View style={[styles.alertIcon, { backgroundColor: accent.iconBg }]}>
            <HomeAlertGlyph icon={accent.icon} color={accent.iconColor} size={16} />
          </View>

          <View style={styles.alertCopy}>
            <View style={styles.alertTitleRow}>
              <Text style={[styles.alertTitle, { color: colors.text }]} numberOfLines={2}>
                {title}
              </Text>
              <View style={styles.titleTrailing}>
                {clock ? (
                  <Text style={[styles.alertTime, { color: colors.textMuted }]} numberOfLines={1}>
                    {clock}
                  </Text>
                ) : null}
                {!item.read ? (
                  <View
                    style={[styles.unreadDot, { backgroundColor: colors.accentGreen }]}
                    accessibilityLabel="Non lu"
                  />
                ) : null}
              </View>
            </View>
            <Text style={[styles.alertBody, { color: colors.textSecondary }]} numberOfLines={3}>
              {item.message}
            </Text>
          </View>
        </View>
      </ProtoGlassCard>
    </Pressable>
  );
}

export function AlertCenterContent({ items, onOpenAlert }: Props) {
  const { colors, isLight } = useAppTheme();
  const groups = groupAlertCenterItems(items);

  if (items.length === 0) {
    return (
      <ProtoGlassCard style={homeAlertPreviewSurface(colors, isLight)} padding={14}>
        <View style={styles.empty}>
          <AppIcon
            family="ionicons"
            name="notifications-off-outline"
            size={28}
            color={colors.textMuted}
          />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun message</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
            Les rappels utiles et les opportunités Fyn apparaîtront ici — toujours avec des pistes
            concrètes.
          </Text>
        </View>
      </ProtoGlassCard>
    );
  }

  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <View key={group.section} style={styles.section}>
          <ProtoSectionHeader title={ALERT_SECTION_LABELS[group.section]} />
          <View style={styles.sectionCards}>
            {group.items.map((item) => (
              <AlertCenterCard
                key={item.id}
                item={item}
                onPress={() => {
                  tapHaptic();
                  onOpenAlert(item);
                }}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.xl,
  },
  section: {
    gap: 0,
  },
  sectionCards: {
    gap: spacing.sm,
  },
  alertCard: {
    borderRadius: 16,
  },
  alertInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  alertCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  alertTitle: {
    ...typographyKit.rowTitle,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.15,
    flex: 1,
    minWidth: 0,
  },
  alertTime: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 14,
  },
  alertBody: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 14,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  emptyTitle: {
    ...typographyKit.metaSemibold,
    fontSize: 14,
  },
  emptyMessage: {
    ...typographyKit.metaMedium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  pressed: { opacity: 0.85 },
});
