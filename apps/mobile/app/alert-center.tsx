import { useCallback } from 'react';
import { AppIcon } from '@/components/icons/AppIcon';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCenterContent } from '@/components/AlertCenterContent';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import { jakartaExtraBoldText, PAGE_PADDING_HORIZONTAL, spacing } from '@/constants/theme';
import { useAlertCenter, useAlertCenterSources } from '@/hooks/useAlertCenter';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { alertDetailRouteParams } from '@/lib/alerts';
import { tapHaptic } from '@/lib/haptics';

const MESSAGES_SCREEN_BG = '#000000';

export default function AlertCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_GUTTER + spacing.md }]}>
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
            <AppIcon family="ionicons" name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Messages
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? 'Tout marquer comme lu' : 'Filtrer'}
            hitSlop={8}
            onPress={() => {
              tapHaptic();
              if (unreadCount > 0) void markAllRead();
            }}
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
          >
            <AppIcon family="ionicons" name="options-outline" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom + spacing.xl, 56) },
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
        </ScrollView>
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: MESSAGES_SCREEN_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  backHit: {
    padding: spacing.xs,
    flexShrink: 0,
  },
  headerTitle: {
    flex: 1,
    ...jakartaExtraBoldText,
    fontSize: 26,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    minWidth: 0,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    paddingHorizontal: PAGE_PADDING_HORIZONTAL,
    gap: spacing.md,
  },
  pressed: { opacity: 0.72 },
});
