import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FixedScreenHeader,
  fixedHeaderScrollStyle,
  fixedHeaderScreenStyle,
} from '@/components/FixedScreenHeader';
import {
  HeaderIconButton,
  IconWell,
  ListCard,
  ListRow,
  PillButton,
  RingGauge,
  SummaryCard,
} from '@/components/kit';
import { AppIcon } from '@/components/icons/AppIcon';
import { AlertCenterContent } from '@/components/AlertCenterContent';
import { CopilotCard } from '@/components/copilot/CopilotCard';
import { AlertTypePreferencesSheet } from '@/components/AlertTypePreferencesSheet';
import { PageTransition } from '@/components/PageTransition';
import { PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import { useAlertCenter, useAlertCenterSources } from '@/hooks/useAlertCenter';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { alertDetailRouteParams } from '@/lib/alerts';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export default function AlertCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [prefsVisible, setPrefsVisible] = useState(false);
  const { recurringPayments, simulatedAccounts, incomeTransactions, ready, refresh: refreshSources } =
    useAlertCenterSources();
  const { items, unreadCount, markRead, markAllRead, refresh } = useAlertCenter({
    recurringPayments,
    simulatedAccounts,
    incomeTransactions,
    enabled: ready,
  });

  const urgentCount = items.filter((item) => item.severity === 'danger').length;
  const watchCount = items.filter((item) => item.severity === 'warning').length;

  const refreshOnFocus = useCallback(() => {
    void refreshSources();
    void refresh();
  }, [refresh, refreshSources]);

  useRefreshOnFocus(refreshOnFocus);

  return (
    <PageTransition>
      <View style={[fixedHeaderScreenStyle, styles.screen, { backgroundColor: colors.background }]}>
        <FixedScreenHeader
          title="Messages"
          onBack={() => router.back()}
          trailing={
            <HeaderIconButton
              icon="options-outline"
              accessibilityLabel="Préférences des alertes"
              onPress={() => {
                tapHaptic();
                setPrefsVisible(true);
              }}
            />
          }
        />

        <ScrollView
          style={fixedHeaderScrollStyle}
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: PAGE_PADDING_HORIZONTAL,
              paddingBottom: Math.max(insets.bottom + spacing.xl, 56),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SummaryCard
            label={unreadCount > 0 ? 'Non lus' : 'Messages'}
            amount={unreadCount > 0 ? String(unreadCount) : 'Tout est lu'}
            badge={
              urgentCount > 0
                ? { label: `${urgentCount} urgent${urgentCount > 1 ? 's' : ''}`, color: colors.danger }
                : { label: 'Rien d’urgent', color: colors.accentGreen }
            }
            aside={
              <RingGauge
                progress={items.length > 0 ? 1 - unreadCount / items.length : 1}
                color={urgentCount > 0 ? colors.danger : colors.accentGreen}
                size={64}
                stroke={7}
              >
                <AppIcon family="ionicons" name="notifications-outline" size={20} color={colors.text} />
              </RingGauge>
            }
            stats={[
              { label: 'Messages', value: String(items.length) },
              { label: 'Urgents', value: String(urgentCount), color: urgentCount > 0 ? colors.danger : undefined },
              { label: 'À surveiller', value: String(watchCount), color: watchCount > 0 ? colors.warning : undefined },
            ]}
          >
            {unreadCount > 0 ? (
              <View style={styles.markAll}>
                <PillButton label="Tout marquer comme lu" icon="checkmark-done" onPress={() => void markAllRead()} />
              </View>
            ) : null}
          </SummaryCard>
          <CopilotCard limit={6} />
          <AlertCenterContent
            items={items}
            onOpenAlert={(item) => {
              void markRead(item);
              router.push({
                pathname: '/alert-detail',
                params: alertDetailRouteParams(item),
              });
            }}
          />

          <ListCard style={styles.typesShortcut}>
            <ListRow
              leading={<IconWell icon="notifications-outline" />}
              title="Types d’alertes"
              subtitle="Ce que l’app peut t’envoyer, et ce que tu reçois"
              chevron
              isLast
              onPress={() => router.push('/alert-types')}
            />
          </ListCard>
        </ScrollView>

        <AlertTypePreferencesSheet
          visible={prefsVisible}
          onClose={() => setPrefsVisible(false)}
          unreadCount={unreadCount}
          onMarkAllRead={() => {
            void markAllRead();
          }}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing.md },
  typesShortcut: { marginTop: spacing.sm },
  markAll: { alignItems: 'flex-start' },
});
