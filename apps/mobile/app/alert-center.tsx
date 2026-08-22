import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/components/icons/AppIcon';
import { AlertCenterContent } from '@/components/AlertCenterContent';
import { AlertTypePreferencesSheet } from '@/components/AlertTypePreferencesSheet';
import { OnyxContainer } from '@/components/OnyxContainer';
import { PageTransition } from '@/components/PageTransition';
import { SCREEN_TOP_GUTTER } from '@/constants/ghostUi';
import {
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';
import {
  PAGE_TITLE_STYLE,
  screenHorizontalGutter,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { useAlertCenter, useAlertCenterSources } from '@/hooks/useAlertCenter';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { alertDetailRouteParams } from '@/lib/alerts';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import {
  resolveUserPickedIconWellBackground,
  userPickedIconCornerRadius,
} from '@/lib/userPickedIcon';

const SHORTCUT_ICON_WELL = 36;

export default function AlertCenterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isLight } = useAppTheme();
  const contentGutter = Platform.OS === 'web' ? 0 : screenHorizontalGutter(insets);
  const iconWellBg = resolveUserPickedIconWellBackground(isLight);
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
            Messages
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Préférences des alertes"
            hitSlop={8}
            onPress={() => {
              tapHaptic();
              setPrefsVisible(true);
            }}
            style={({ pressed }) => [
              styles.headerAction,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.containerBorder,
              },
              pressed && styles.pressed,
            ]}
          >
            <AppIcon family="ionicons" name="options-outline" size={18} color={colors.text} />
          </Pressable>
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

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voir tous les types d’alertes"
            onPress={() => {
              tapHaptic();
              router.push('/alert-types');
            }}
            style={({ pressed }) => [pressed && onyxContainerPressedStyle()]}
          >
            <OnyxContainer halo={false} style={styles.typesShortcut}>
              <View
                style={[
                  styles.typesShortcutIcon,
                  {
                    backgroundColor: iconWellBg,
                    borderRadius: userPickedIconCornerRadius(SHORTCUT_ICON_WELL),
                  },
                ]}
              >
                <AppIcon
                  family="ionicons"
                  name="notifications-outline"
                  size={17}
                  color={colors.textSecondary}
                />
              </View>
              <View style={styles.typesShortcutCopy}>
                <Text style={[styles.typesShortcutTitle, { color: colors.text }]}>
                  Voir tous les types d’alertes
                </Text>
                <Text style={[styles.typesShortcutMeta, { color: colors.textMuted }]}>
                  Ce que l’app peut t’envoyer, et ce que tu reçois
                </Text>
              </View>
              <AppIcon
                family="ionicons"
                name="chevron-forward"
                size={16}
                color={colors.textMuted}
              />
            </OnyxContainer>
          </Pressable>
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
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    gap: spacing.md,
  },
  typesShortcut: {
    ...onyxContainerRowLayoutStyle(),
    marginTop: spacing.sm,
  },
  typesShortcutIcon: {
    width: SHORTCUT_ICON_WELL,
    height: SHORTCUT_ICON_WELL,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  typesShortcutCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  typesShortcutTitle: {
    ...typographyKit.rowTitle,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: -0.15,
  },
  typesShortcutMeta: {
    ...typographyKit.micro,
    fontSize: 11,
    lineHeight: 14,
  },
  pressed: { opacity: 0.72 },
});
