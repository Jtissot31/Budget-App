import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { usePathname, useRouter } from 'expo-router';
import { uiEvents } from '@/lib/events';
import {
  FLOATING_FAB_ICON_SIZE,
  FLOATING_FAB_RADIUS,
  FLOATING_FAB_SIZE,
  FLOATING_FAB_VISUAL_SCALE,
  floatingGlassButtonPressed,
  floatingGlassFabSurface,
} from '@/constants/floatingGlassButton';
import { getFloatingTabBarBottomInset, lightColors, radius, spacing } from '@/constants/theme';
import { UNIFORM_CHIP_FONT_SIZE } from '@/lib/uniformGroupStyles';
import { useAppTheme } from '@/lib/themeContext';

/** Icônes plus actuelles (lignes fines, lecture type apps finance / iOS) */
const ROUTE_ICONS: Record<string, { outline: keyof typeof Ionicons.glyphMap; filled: keyof typeof Ionicons.glyphMap }> = {
  index: { outline: 'grid-outline', filled: 'grid' },
  accounts: { outline: 'wallet-outline', filled: 'wallet' },
  goals: { outline: 'navigate-circle-outline', filled: 'navigate-circle' },
  transactions: { outline: 'receipt-outline', filled: 'receipt' },
  budgets: { outline: 'pie-chart-outline', filled: 'pie-chart' },
  settings: { outline: 'options-outline', filled: 'options' },
};

const ROUTE_LABELS: Record<string, string> = {
  index: 'Accueil',
  accounts: 'Portefeuille',
  goals: 'Objectifs',
  transactions: 'Transactions',
  budgets: 'Budget',
  settings: 'Réglages',
};

const HIDDEN_ROUTES = new Set(['settings']);

/** Brand green AI FAB gradients (expo-linear-gradient, 3-stop) */
const AI_CHAT_FAB_GRADIENT_DARK = ['#003d1a', '#007a3d', '#00e664'] as const;
const AI_CHAT_FAB_GRADIENT_LIGHT = [lightColors.primary, '#00a854', '#007a3d'] as const;
const AI_CHAT_FAB_GRADIENT_LOCATIONS = [0, 0.5, 1] as const;

const aiGraphic = (base: number) => Math.round(base * FLOATING_FAB_VISUAL_SCALE);

/** `Plus` from src/icons — React Native SVG. */
function PlusFabIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M19 11h-6V5a1 1 0 0 0-2 0v6H5a1 1 0 0 0 0 2h6v6a1 1 0 0 0 2 0v-6h6a1 1 0 0 0 0-2Z"
      />
    </Svg>
  );
}

/** `RecurringEvent` from src/icons — React Native SVG. */
function RecurringEventFabIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 2048 2048" fill="none">
      <Path
        fill={color}
        d="M256 1536h768v128H128V128h256V0h128v128h896V0h128v128h256v896h-128V640H256v896zm0-1280v256h1408V256h-128v128h-128V256H512v128H384V256H256zm1792 896v384h-384v-128h190q-45-60-112-94t-142-34q-59 0-111 20t-95 55t-70 85t-38 107l-127-22q14-81 54-149t98-118t133-78t156-28q91 0 174 35t146 102v-137h128zm-448 768q58 0 111-20t95-55t70-85t38-107l127 22q-14 81-54 149t-98 118t-133 78t-156 28q-91 0-174-35t-146-102v137h-128v-384h384v128h-190q45 60 112 94t142 34z"
      />
    </Svg>
  );
}

/** `Chat` from src/icons — React Native SVG. */
function DashboardChatIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M3 20.077V4.615q0-.69.463-1.152Q3.925 3 4.615 3h14.77q.69 0 1.152.463q.463.462.463 1.152v10.77q0 .69-.462 1.153q-.463.462-1.153.462H6.077L3 20.077ZM6.5 13.5h7v-1h-7v1Zm0-3h11v-1h-11v1Zm0-3h11v-1h-11v1Z"
      />
    </Svg>
  );
}

/** Vertical stack above tab bar: add (lowest) → scan when Historique FAB expanded. */
const FAB_STACK_OFFSET_ADD = 104;
const FAB_STACK_OFFSET_SCAN = 188;

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const [isHistoryFabExpanded, setIsHistoryFabExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { colors, isLight } = useAppTheme();
  const fabSurface = floatingGlassFabSurface(colors, isLight);
  const bottom = getFloatingTabBarBottomInset(insets.bottom);
  const isAndroid = Platform.OS === 'android';
  const activeRouteName = state.routes[state.index]?.name;
  const activeRouteParams = state.routes[state.index]?.params as { view?: string } | undefined;
  const transactionsView = activeRouteName === 'transactions' ? (activeRouteParams?.view ?? 'history') : undefined;
  const isDashboard = activeRouteName === 'index';
  const isTransactionsHistoryView = transactionsView === 'history';
  const isTransactionsMerchantsView = transactionsView === 'merchants';
  const showDashboardAiChatFab = isDashboard;
  const showAddButton =
    activeRouteName !== 'accounts' &&
    activeRouteName !== 'goals' &&
    activeRouteName !== 'budgets' &&
    activeRouteName !== 'settings' &&
    !isDashboard &&
    !isTransactionsMerchantsView;
  const showHistoryScanFab = isTransactionsHistoryView && isHistoryFabExpanded;
  const shouldAddRecurringPayment = transactionsView === 'agenda';
  const fabIconColor = colors.text;
  const fabBadgeContentColor = isLight ? '#FFFFFF' : '#111111';
  const rightThumbFabBottom = bottom + FLOATING_FAB_SIZE;

  useEffect(() => {
    setIsHistoryFabExpanded(false);
  }, [activeRouteName, pathname, transactionsView]);

  const openManualTransaction = () => {
    setIsHistoryFabExpanded(false);
    router.push('/add-transaction');
  };

  const openAiScan = () => {
    setIsHistoryFabExpanded(false);
    router.push('/scan');
  };

  const openAiChat = () => {
    router.push('/ai-chat');
  };

  const handleAddPress = () => {
    if (isTransactionsHistoryView) {
      if (isHistoryFabExpanded) {
        openManualTransaction();
      } else {
        setIsHistoryFabExpanded(true);
      }
      return;
    }

    if (shouldAddRecurringPayment) {
      uiEvents.requestNewRecurringPayment();
      return;
    }

    router.push('/add-transaction');
  };

  const navShellBg = colors.cardBackground;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {showDashboardAiChatFab ? (
        <Pressable
          style={({ pressed }) => [
            styles.aiChatOuter,
            { bottom: rightThumbFabBottom + FAB_STACK_OFFSET_ADD },
            pressed && floatingGlassButtonPressed,
          ]}
          onPress={openAiChat}
          accessibilityRole="button"
          accessibilityLabel="Assistant IA — conseils budget"
        >
          <LinearGradient
            colors={isLight ? [...AI_CHAT_FAB_GRADIENT_LIGHT] : [...AI_CHAT_FAB_GRADIENT_DARK]}
            locations={[...AI_CHAT_FAB_GRADIENT_LOCATIONS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ ...StyleSheet.absoluteFillObject, borderRadius: FLOATING_FAB_RADIUS }}
          />
          <View style={styles.aiChatIconWrap}>
            <DashboardChatIcon size={FLOATING_FAB_ICON_SIZE + 5} color="#FFFFFF" />
          </View>
        </Pressable>
      ) : null}
      {showHistoryScanFab ? (
        <Pressable
          style={({ pressed }) => [
            styles.aiScanOuter,
            fabSurface,
            { bottom: rightThumbFabBottom + FAB_STACK_OFFSET_SCAN },
            pressed && floatingGlassButtonPressed,
          ]}
          onPress={openAiScan}
          accessibilityRole="button"
          accessibilityLabel="Scanner une facture avec l'IA"
        >
          <View style={styles.aiScanIconWrap}>
            <View style={styles.aiScanFrame}>
              <View style={[styles.aiScanCorner, styles.aiScanCornerTopLeft, { borderColor: fabIconColor }]} />
              <View style={[styles.aiScanCorner, styles.aiScanCornerTopRight, { borderColor: fabIconColor }]} />
              <View style={[styles.aiScanCorner, styles.aiScanCornerBottomLeft, { borderColor: fabIconColor }]} />
              <View style={[styles.aiScanCorner, styles.aiScanCornerBottomRight, { borderColor: fabIconColor }]} />
              <View style={styles.aiScanLines}>
                <View style={[styles.aiScanLine, { backgroundColor: fabIconColor }]} />
                <View style={[styles.aiScanLine, styles.aiScanLineShort, { backgroundColor: fabIconColor }]} />
                <View style={[styles.aiScanLine, { backgroundColor: fabIconColor }]} />
              </View>
            </View>
            <View
              style={[
                styles.aiScanBadge,
                {
                  backgroundColor: fabIconColor,
                  borderColor: colors.borderStrong,
                },
              ]}
            >
              <Text style={[styles.aiScanBadgeText, { color: fabBadgeContentColor }]}>AI</Text>
            </View>
          </View>
        </Pressable>
      ) : null}
      {showAddButton ? (
        <Pressable
          style={({ pressed }) => [
            styles.addOuter,
            styles.fabPosition,
            {
              bottom: rightThumbFabBottom + FAB_STACK_OFFSET_ADD,
              backgroundColor: colors.primary,
              shadowColor: colors.primary,
            },
            pressed && floatingGlassButtonPressed,
          ]}
          onPress={handleAddPress}
          accessibilityRole="button"
          accessibilityState={
            isTransactionsHistoryView ? { expanded: isHistoryFabExpanded } : undefined
          }
          accessibilityLabel={shouldAddRecurringPayment ? 'Nouveau paiement récurrent' : 'Nouvelle transaction'}
        >
          <View style={styles.addIconWrap}>
            {shouldAddRecurringPayment ? (
              <RecurringEventFabIcon size={28} color="#000000" />
            ) : (
              <PlusFabIcon size={24} color="#000000" />
            )}
          </View>
        </Pressable>
      ) : null}

      <View
        style={[
          styles.navShell,
          {
            paddingBottom: bottom,
            backgroundColor: navShellBg,
            borderTopColor: isLight ? colors.border : colors.border,
          },
        ]}
      >
        <View style={[styles.pill, isAndroid && styles.pillAndroid]}>
          {state.routes.map((route, index) => {
            if (HIDDEN_ROUTES.has(route.name)) return null;
            const focused = state.index === index;
            const icons = ROUTE_ICONS[route.name] ?? {
              outline: 'ellipse-outline',
              filled: 'ellipse',
            };
            const iconName = focused ? icons.filled : icons.outline;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (event.defaultPrevented) return;

              if (route.name === 'transactions') {
                const subView = (route.params as { view?: string } | undefined)?.view;
                if (!focused || (subView && subView !== 'history')) {
                  navigation.navigate('transactions', { view: 'history' });
                }
                return;
              }

              if (!focused) {
                navigation.navigate(route.name, route.params);
              }
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
              >
                <MotiView
                  animate={{
                    scale: focused ? 1 : 0.98,
                    opacity: focused ? 1 : 0.86,
                  }}
                  transition={{ type: 'timing', duration: 180 }}
                  style={styles.tabContent}
                >
                  <Ionicons name={iconName} size={21} color={focused ? colors.primary : colors.textMuted} />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: focused ? colors.text : colors.textMuted },
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {ROUTE_LABELS[route.name] ?? route.name}
                  </Text>
                </MotiView>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'stretch',
    backgroundColor: 'transparent',
  },
  navShell: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fabPosition: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 10,
  },
  addOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  aiChatOuter: {
    position: 'absolute',
    right: spacing.sm,
    zIndex: 12,
    width: FLOATING_FAB_SIZE,
    height: FLOATING_FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: FLOATING_FAB_RADIUS,
    overflow: 'hidden',
  },
  aiChatIconWrap: {
    width: FLOATING_FAB_SIZE,
    height: FLOATING_FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  aiScanOuter: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 11,
  },
  aiScanIconWrap: {
    width: aiGraphic(28),
    height: aiGraphic(28),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  aiScanFrame: {
    width: aiGraphic(22),
    height: aiGraphic(22),
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiScanCorner: {
    position: 'absolute',
    width: aiGraphic(6),
    height: aiGraphic(6),
  },
  aiScanCornerTopLeft: {
    left: 0,
    top: 0,
    borderTopWidth: aiGraphic(1.5),
    borderLeftWidth: aiGraphic(1.5),
    borderTopLeftRadius: aiGraphic(2),
  },
  aiScanCornerTopRight: {
    right: 0,
    top: 0,
    borderTopWidth: aiGraphic(1.5),
    borderRightWidth: aiGraphic(1.5),
    borderTopRightRadius: aiGraphic(2),
  },
  aiScanCornerBottomLeft: {
    left: 0,
    bottom: 0,
    borderBottomWidth: aiGraphic(1.5),
    borderLeftWidth: aiGraphic(1.5),
    borderBottomLeftRadius: aiGraphic(2),
  },
  aiScanCornerBottomRight: {
    right: 0,
    bottom: 0,
    borderBottomWidth: aiGraphic(1.5),
    borderRightWidth: aiGraphic(1.5),
    borderBottomRightRadius: aiGraphic(2),
  },
  aiScanLines: {
    width: aiGraphic(11),
    gap: aiGraphic(2),
  },
  aiScanLine: {
    width: aiGraphic(11),
    height: aiGraphic(1.5),
    borderRadius: aiGraphic(1),
    opacity: 0.76,
  },
  aiScanLineShort: {
    width: aiGraphic(8),
  },
  aiScanBadge: {
    position: 'absolute',
    right: aiGraphic(-3),
    bottom: aiGraphic(-1),
    minWidth: aiGraphic(18),
    height: aiGraphic(13),
    borderRadius: aiGraphic(6),
    borderWidth: aiGraphic(1.5),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: aiGraphic(3),
  },
  aiScanBadgeText: {
    fontSize: aiGraphic(7),
    lineHeight: aiGraphic(9),
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  addIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 11,
    paddingHorizontal: 4,
  },
  pillAndroid: {
    paddingTop: 9,
    paddingBottom: 7,
  },
  tab: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingVertical: 1,
    minWidth: 0,
  },
  tabContent: {
    flex: 1,
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 3,
  },
  tabLabel: {
    width: '100%',
    minWidth: 0,
    flexShrink: 1,
    fontSize: UNIFORM_CHIP_FONT_SIZE,
    lineHeight: UNIFORM_CHIP_FONT_SIZE + 2,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: { opacity: 0.75 },
});
