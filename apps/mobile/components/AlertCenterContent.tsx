import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/icons/AppIcon';
import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import {
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaSemiboldText,
  spacing,
  typography,
} from '@/constants/theme';
import { planFinanceContainerPressedStyle, planFinanceKit } from '@/constants/planFinanceKit';
import { useAppTheme } from '@/lib/themeContext';
import {
  ALERT_SECTION_LABELS,
  formatAlertCenterTimestamp,
  groupAlertCenterItems,
  type AlertCenterItem,
  type AlertCenterSection,
} from '@/lib/alerts';
import { alertListIcon } from '@/lib/alertPresentation';
import { tapHaptic } from '@/lib/haptics';

type Props = {
  items: AlertCenterItem[];
  onOpenAlert: (item: AlertCenterItem) => void;
};

const SECTION_ACCENT: Record<AlertCenterSection, string> = {
  urgent: planFinanceKit.colors.accent,
  opportunities: planFinanceKit.colors.accent,
};

function AlertCenterCard({
  item,
  onPress,
}: {
  item: AlertCenterItem;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const icon = alertListIcon(item.kind);
  const accent = SECTION_ACCENT[item.section];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir l'alerte ${item.title}`}
      accessibilityState={{ selected: !item.read }}
      style={({ pressed }) => [pressed && planFinanceContainerPressedStyle()]}
    >
      <PlanFinanceContainer style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconSlot, { backgroundColor: 'rgba(74, 222, 128, 0.12)' }]}>
            <AppIcon family={icon.family} name={icon.name} size={18} color={accent} />
          </View>

          <View style={styles.cardMain}>
            <View style={styles.titleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                {item.title}
              </Text>
              {!item.read ? (
                <View
                  style={[styles.unreadDot, { backgroundColor: accent }]}
                  accessibilityLabel="Non lu"
                />
              ) : null}
            </View>
            <Text style={[styles.cardDescription, { color: colors.textMuted }]} numberOfLines={3}>
              {item.message}
            </Text>
          </View>
        </View>

        <Text style={[styles.cardTimestamp, { color: colors.textMuted }]}>
          {formatAlertCenterTimestamp(item.timestamp)}
        </Text>
      </PlanFinanceContainer>
    </Pressable>
  );
}

export function AlertCenterContent({ items, onOpenAlert }: Props) {
  const { colors } = useAppTheme();
  const groups = groupAlertCenterItems(items);

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <AppIcon family="ionicons" name="notifications-off-outline" size={28} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun message</Text>
        <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
          Les rappels utiles et les opportunités Fyn apparaîtront ici — toujours avec des pistes
          concrètes.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <View key={group.section} style={styles.section}>
          <Text style={[styles.sectionHeader, { color: SECTION_ACCENT[group.section] }]}>
            {ALERT_SECTION_LABELS[group.section]}
          </Text>
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconSlot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    gap: 4,
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
    marginTop: 6,
    flexShrink: 0,
  },
  cardTitle: {
    ...jakartaExtraBoldText,
    fontSize: typography.body,
    lineHeight: typography.body + 3,
    flex: 1,
    minWidth: 0,
  },
  cardDescription: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
  },
  cardTimestamp: {
    ...jakartaMediumText,
    fontSize: typography.micro,
    alignSelf: 'flex-end',
    marginTop: 2,
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
  },
  emptyMessage: {
    ...jakartaMediumText,
    fontSize: typography.meta,
    lineHeight: typography.meta + 4,
    textAlign: 'center',
  },
});
