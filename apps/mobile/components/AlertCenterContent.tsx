import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { Ionicons } from '@expo/vector-icons';
import type { LucideIcon } from 'lucide-react-native';
import {
  containerSurfaceStyle,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  radius,
  spacing,
  typography,
} from '@/constants/theme';
import { useAppTheme } from '@/lib/themeContext';
import {
  ALERT_SECTION_LABELS,
  formatAlertCenterTimestamp,
  groupAlertCenterItems,
  type AlertCenterItem,
  type AlertCenterSection,
} from '@/lib/alerts';
import { getSelectedLucideIcon } from '@/lib/iconMigration/selectedLucideIcons';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  items: AlertCenterItem[];
  onMarkRead: (item: AlertCenterItem) => void;
};

const MESSAGES_COLORS = {
  screen: '#000000',
  urgent: '#FBBF24',
  opportunities: '#34D399',
  description: 'rgba(255,255,255,0.55)',
  timestamp: 'rgba(255,255,255,0.38)',
  title: '#FFFFFF',
  filterButton: '#1A1A1A',
} as const;

const CircleAlertIcon = getSelectedLucideIcon('CircleAlert');
const BrainIcon = getSelectedLucideIcon('Brain');

function sectionAccent(section: AlertCenterSection): string {
  return section === 'urgent' ? MESSAGES_COLORS.urgent : MESSAGES_COLORS.opportunities;
}

function sectionLucideIcon(section: AlertCenterSection): LucideIcon | null {
  return section === 'urgent' ? CircleAlertIcon : BrainIcon;
}

function AlertCenterCard({
  item,
  onPress,
}: {
  item: AlertCenterItem;
  onPress: () => void;
}) {
  const { isLight } = useAppTheme();
  const surface = containerSurfaceStyle(isLight);
  const accent = sectionAccent(item.section);
  const SectionIcon = sectionLucideIcon(item.section);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !item.read }}
      style={({ pressed }) => [styles.card, surface, pressed && styles.pressed]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconSlot}>
          {SectionIcon ? (
            <SectionIcon
              size={18}
              color={accent}
              strokeWidth={item.section === 'urgent' ? 2.5 : 2.25}
              fill="transparent"
            />
          ) : (
            <Ionicons
              name={item.section === 'urgent' ? 'alert-circle-outline' : 'bulb-outline'}
              size={18}
              color={accent}
            />
          )}
        </View>

        <View style={styles.cardMain}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {!item.read ? (
              <View style={[styles.unreadDot, { backgroundColor: accent }]} accessibilityLabel="Non lu" />
            ) : null}
          </View>
          <Text style={styles.cardDescription} numberOfLines={4}>
            {item.message}
          </Text>
        </View>
      </View>

      <Text style={styles.cardTimestamp}>{formatAlertCenterTimestamp(item.timestamp)}</Text>
    </Pressable>
  );
}

export function AlertCenterContent({ items, onMarkRead }: Props) {
  const groups = groupAlertCenterItems(items);

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <AppIcon family="ionicons" name="notifications-off-outline" size={28} color={MESSAGES_COLORS.timestamp} />
        <Text style={styles.emptyTitle}>Aucun message</Text>
        <Text style={styles.emptyMessage}>
          Les alertes de fonds, de limite de crédit et les opportunités Fyn apparaîtront ici.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <View key={group.section} style={styles.section}>
          <Text style={[styles.sectionHeader, { color: sectionAccent(group.section) }]}>
            {ALERT_SECTION_LABELS[group.section]}
          </Text>
          <View style={styles.sectionCards}>
            {group.items.map((item) => (
              <AlertCenterCard
                key={item.id}
                item={item}
                onPress={() => {
                  tapHaptic();
                  onMarkRead(item);
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
    gap: spacing.sm,
  },
  sectionHeader: {
    ...jakartaSemiboldText,
    fontSize: typography.micro,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionCards: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.xs,
  },
  pressed: { opacity: 0.82 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconSlot: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    flexShrink: 0,
  },
  cardTitle: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    lineHeight: typography.body + 3,
    color: MESSAGES_COLORS.title,
    flex: 1,
    minWidth: 0,
  },
  cardDescription: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
    color: MESSAGES_COLORS.description,
  },
  cardTimestamp: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    color: MESSAGES_COLORS.timestamp,
    alignSelf: 'flex-end',
    marginTop: 1,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    ...jakartaSemiboldText,
    fontSize: typography.body,
    color: MESSAGES_COLORS.title,
  },
  emptyMessage: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
    textAlign: 'center',
    color: MESSAGES_COLORS.description,
  },
});
