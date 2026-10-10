import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FixedScreenHeader } from '@/components/FixedScreenHeader';
import { HeaderIconButton, IconWell, ListCard, ListRow } from '@/components/kit';
import { AlertCenterContent } from '@/components/AlertCenterContent';
import { AlertTypePreferencesSheet } from '@/components/AlertTypePreferencesSheet';
import { PageTransition } from '@/components/PageTransition';
import { screenHorizontalGutter, spacing } from '@/constants/theme';
import { useAlertCenter, useAlertCenterSources } from '@/hooks/useAlertCenter';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { alertDetailRouteParams } from '@/lib/alerts';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';

export default function AlertCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const [prefsVisible, setPrefsVisible] = useState(false);
  const { recurringPayments, simulatedAccounts, incomeTransactions, ready, refresh: refreshSources } =
    useAlertCenterSources();
  const { items, unreadCount, markRead, markAllRead, refresh } = useAlertCenter({
    recurringPayments,
    simulatedAccounts,
    incomeTransactions,
    enabled: ready,
  });

  const refreshOnFocus = useCallback(() => {
    void refreshSources();
    void refresh();
  }, [refresh, refreshSources]);

  useRefreshOnFocus(refreshOnFocus);

  return (
    <PageTransition>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
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
          contentContainerStyle={[
            styles.content,
            {
              paddingHorizontal: contentGutter,
              paddingBottom: Math.max(insets.bottom + spacing.xl, 56),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
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
});
