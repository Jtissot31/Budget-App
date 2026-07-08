import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  BackHandler,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { AppIcon } from '@/components/icons/AppIcon';
import { usePathname, useRouter } from 'expo-router';
import {
  TRANSACTIONS_FAB_ICON_COLOR_ORIGINAL,
  TRANSACTIONS_FAB_STYLE_ORIGINAL,
} from '@/constants/fabStyles';
import {
  FLOATING_FAB_SIZE,
  floatingGlassButtonPressed,
} from '@/constants/floatingGlassButton';
import {
  getFloatingTabBarBottomInset,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import type { RecurringPaymentAddVariant } from '@/components/RecurringPaymentsForm';
import { uiEvents } from '@/lib/events';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
import { useAppTheme } from '@/lib/themeContext';

/** Matches `radius.pill` (999) — literal avoids Hermes `radius` binding clashes in this module. */
const PILL_BORDER_RADIUS = 999;

const TAB_ICON_SIZE = 21;
/** Expands icon-only tab target to 44×44 without a sized pressable background. */
const TAB_HIT_SLOP = { top: 11, bottom: 11, left: 11, right: 11 } as const;

/** Material Community Icons — outline only (icon-only tabs, no filled circles). */
const ROUTE_ICONS: Record<
  string,
  { outline: keyof typeof MaterialCommunityIcons.glyphMap; filled: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  index: { outline: 'home-outline', filled: 'home' },
  transactions: { outline: 'receipt-text-outline', filled: 'receipt-text' },
  goals: { outline: 'compass-outline', filled: 'compass' },
  accounts: { outline: 'wallet-outline', filled: 'wallet' },
  budgets: { outline: 'chart-pie-outline', filled: 'chart-pie' },
};

const ROUTE_LABELS: Record<string, string> = {
  index: 'Accueil',
  accounts: 'Portefeuille',
  goals: 'Plan financier',
  transactions: 'Transactions',
  budgets: 'Budget',
  settings: 'Réglages',
};

const HIDDEN_ROUTES = new Set(['settings']);

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

type HistoryAddTransactionType = 'expense' | 'income' | 'transfer';

const HISTORY_FAB_OPTION_ICON_COLOR = '#FFFFFF';

const HISTORY_FAB_ADD_ACTIONS: {
  type: HistoryAddTransactionType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}[] = [
  {
    type: 'transfer',
    label: 'Virement',
    icon: 'swap-horizontal-outline',
    accessibilityLabel: 'Ajouter un virement',
  },
  {
    type: 'expense',
    label: 'Dépense',
    icon: 'arrow-down-circle-outline',
    accessibilityLabel: 'Ajouter une dépense',
  },
  {
    type: 'income',
    label: 'Revenu',
    icon: 'cash-outline',
    accessibilityLabel: 'Ajouter un revenu',
  },
];

/** Vertical stack above tab bar: add (lowest) → type options when Historique FAB expanded. */
const FAB_STACK_OFFSET_ADD = 104;
const HISTORY_FAB_MAIN_SIZE = 54;
const HISTORY_FAB_OPTION_ROW_HEIGHT = 44;
/** Arc speed-dial: radius and angles (°) from FAB center — 180° = left, 90° = up. */
const HISTORY_FAB_ARC_RADIUS = 125;
const HISTORY_FAB_ARC_ANGLES_DEG = [195, 163, 121] as const;
const HISTORY_FAB_OPTION_PILL_WIDTH = 132;
const HISTORY_FAB_ARC_STAGGER_MS = 55;
const SCREEN_HEIGHT = Dimensions.get('window').height;

const AGENDA_FAB_OPTION_PILL_WIDTH = 132;

const AGENDA_FAB_ADD_ACTIONS: {
  variant: RecurringPaymentAddVariant;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
}[] = [
  {
    variant: 'subscription',
    label: 'Abonnement',
    icon: 'repeat-outline',
    accessibilityLabel: 'Ajouter un abonnement',
  },
  {
    variant: 'bill',
    label: 'Paiements',
    icon: 'document-text-outline',
    accessibilityLabel: 'Ajouter un paiement récurrent',
  },
  {
    variant: 'income',
    label: 'Revenus',
    icon: 'trending-up-outline',
    accessibilityLabel: 'Ajouter un revenu récurrent',
  },
];

function getHistoryFabArcOffsets(angleDeg: number, arcRadius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    right: -arcRadius * Math.cos(rad) - HISTORY_FAB_OPTION_PILL_WIDTH / 2,
    bottom: arcRadius * Math.sin(rad) - HISTORY_FAB_OPTION_ROW_HEIGHT / 2,
  };
}

function getAgendaFabArcOffsets(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    right: -r * Math.cos(rad) - AGENDA_FAB_OPTION_PILL_WIDTH / 2,
    bottom: r * Math.sin(rad) - HISTORY_FAB_OPTION_ROW_HEIGHT / 2,
  };
}

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const [isHistoryFabExpanded, setIsHistoryFabExpanded] = useState(false);
  const [isAgendaFabExpanded, setIsAgendaFabExpanded] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { colors, isLight } = useAppTheme();
  const historyFabOptionsSurface = useMemo(
    () => ({
      backgroundColor: isLight ? 'rgba(18, 18, 18, 0.90)' : 'rgba(22, 22, 22, 0.94)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
    }),
    [isLight],
  );
  const bottom = getFloatingTabBarBottomInset(insets.bottom);
  const activeRouteName = state.routes[state.index]?.name;
  const activeRouteParams = state.routes[state.index]?.params as { view?: string } | undefined;
  const transactionsView = activeRouteName === 'transactions' ? (activeRouteParams?.view ?? 'history') : undefined;
  const isDashboard = activeRouteName === 'index';
  const isTransactionsHistoryView = transactionsView === 'history';
  const isTransactionsAgendaView = transactionsView === 'agenda';
  const isTransactionsMerchantsView = transactionsView === 'merchants';
  const showAddButton =
    activeRouteName !== 'accounts' &&
    activeRouteName !== 'goals' &&
    activeRouteName !== 'budgets' &&
    activeRouteName !== 'settings' &&
    !isDashboard &&
    !isTransactionsMerchantsView;
  const showHistoryFabOptions = isTransactionsHistoryView && isHistoryFabExpanded;
  const showAgendaFabOptions = isTransactionsAgendaView && isAgendaFabExpanded;
  const rightThumbFabBottom = bottom + FLOATING_FAB_SIZE - spacing.sm;

  const collapseSpeedDials = useCallback(() => {
    setIsHistoryFabExpanded(false);
    setIsAgendaFabExpanded(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      collapseSpeedDials();
      return () => {
        collapseSpeedDials();
      };
    }, [collapseSpeedDials]),
  );

  useEffect(() => {
    collapseSpeedDials();
    return () => {
      collapseSpeedDials();
    };
  }, [state.index, pathname, transactionsView, collapseSpeedDials]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        collapseSpeedDials();
      }
    });
    return () => subscription.remove();
  }, [collapseSpeedDials]);

  useEffect(() => {
    if (!isHistoryFabExpanded && !isAgendaFabExpanded) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      collapseSpeedDials();
      return true;
    });
    return () => subscription.remove();
  }, [collapseSpeedDials, isAgendaFabExpanded, isHistoryFabExpanded]);

  const collapseHistoryFab = useCallback(() => {
    setIsHistoryFabExpanded(false);
  }, []);

  const collapseAgendaFab = useCallback(() => {
    setIsAgendaFabExpanded(false);
  }, []);

  const openAgendaAddRecurring = useCallback(
    (variant: RecurringPaymentAddVariant) => {
      tapHaptic();
      collapseAgendaFab();
      uiEvents.requestNewRecurringPayment(variant);
    },
    [collapseAgendaFab],
  );

  const openHistoryAddTransaction = useCallback(
    (type: HistoryAddTransactionType) => {
      tapHaptic();
      collapseHistoryFab();
      router.push({
        pathname: '/add-transaction',
        params: { type },
      });
    },
    [collapseHistoryFab, router],
  );

  const handleAddPress = () => {
    if (isTransactionsHistoryView) {
      tapHaptic();
      setIsHistoryFabExpanded((expanded) => !expanded);
      return;
    }

    if (isTransactionsAgendaView) {
      tapHaptic();
      setIsAgendaFabExpanded((expanded) => !expanded);
      return;
    }

    tapHaptic();
    router.push('/add-transaction');
  };

  const tabBarBorderColor = isLight ? colors.border : 'rgba(255, 255, 255, 0.12)';

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {showHistoryFabOptions ? (
        <Pressable
          pointerEvents="auto"
          style={[
            styles.historyFabBackdrop,
            {
              height: SCREEN_HEIGHT,
              backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.52)',
            },
          ]}
          onPress={() => {
            tapHaptic();
            collapseHistoryFab();
          }}
          accessibilityRole="button"
          accessibilityLabel="Fermer le menu d'ajout"
        />
      ) : null}
      {showHistoryFabOptions ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.historyFabArcAnchor,
            {
              right: spacing.lg + HISTORY_FAB_MAIN_SIZE / 2,
              bottom: rightThumbFabBottom + FAB_STACK_OFFSET_ADD + HISTORY_FAB_MAIN_SIZE / 2,
            },
          ]}
        >
          {HISTORY_FAB_ADD_ACTIONS.map(({ type, label, icon, accessibilityLabel }, index) => {
            const arcOffsets = getHistoryFabArcOffsets(
              HISTORY_FAB_ARC_ANGLES_DEG[index],
              HISTORY_FAB_ARC_RADIUS,
            );
            const fabCenterOffsets = {
              right: -HISTORY_FAB_OPTION_PILL_WIDTH / 2,
              bottom: -HISTORY_FAB_OPTION_ROW_HEIGHT / 2,
            };

            return (
              <MotiView
                key={type}
                from={{ opacity: 0, ...fabCenterOffsets }}
                animate={{ opacity: 1, ...arcOffsets }}
                exit={{ opacity: 0, ...fabCenterOffsets }}
                transition={{
                  type: 'timing',
                  duration: 220,
                  delay: index * HISTORY_FAB_ARC_STAGGER_MS,
                }}
                style={styles.historyFabArcOption}
              >
                <Pressable
                  pointerEvents="auto"
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  onPress={() => openHistoryAddTransaction(type)}
                  style={({ pressed }) => [
                    styles.historyFabOptionCard,
                    historyFabOptionsSurface,
                    { borderRadius: PILL_BORDER_RADIUS },
                    pressed && [
                      floatingGlassButtonPressed,
                      { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                    ],
                  ]}
                >
                  <Ionicons name={icon} size={16} color={HISTORY_FAB_OPTION_ICON_COLOR} />
                  <Text
                    style={[
                      styles.historyFabOptionLabel,
                      singleLineLabelStyle,
                      { color: HISTORY_FAB_OPTION_ICON_COLOR },
                    ]}
                    {...chipLabelTextProps()}
                  >
                    {label}
                  </Text>
                </Pressable>
              </MotiView>
            );
          })}
        </View>
      ) : null}
      {showAgendaFabOptions ? (
        <Pressable
          pointerEvents="auto"
          style={[
            styles.historyFabBackdrop,
            {
              height: SCREEN_HEIGHT,
              backgroundColor: isLight ? 'rgba(25, 22, 18, 0.30)' : 'rgba(0, 0, 0, 0.52)',
            },
          ]}
          onPress={() => {
            tapHaptic();
            collapseAgendaFab();
          }}
          accessibilityRole="button"
          accessibilityLabel="Fermer le menu d'ajout"
        />
      ) : null}
      {showAgendaFabOptions ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.historyFabArcAnchor,
            {
              right: spacing.lg + HISTORY_FAB_MAIN_SIZE / 2,
              bottom: rightThumbFabBottom + FAB_STACK_OFFSET_ADD + HISTORY_FAB_MAIN_SIZE / 2,
            },
          ]}
        >
          {AGENDA_FAB_ADD_ACTIONS.map(({ variant, label, icon, accessibilityLabel }, index) => {
            const arcOffsets = getAgendaFabArcOffsets(
              HISTORY_FAB_ARC_ANGLES_DEG[index],
              HISTORY_FAB_ARC_RADIUS,
            );
            const fabCenterOffsets = {
              right: -AGENDA_FAB_OPTION_PILL_WIDTH / 2,
              bottom: -HISTORY_FAB_OPTION_ROW_HEIGHT / 2,
            };

            return (
              <MotiView
                key={variant}
                from={{ opacity: 0, ...fabCenterOffsets }}
                animate={{ opacity: 1, ...arcOffsets }}
                exit={{ opacity: 0, ...fabCenterOffsets }}
                transition={{
                  type: 'timing',
                  duration: 220,
                  delay: index * HISTORY_FAB_ARC_STAGGER_MS,
                }}
                style={[styles.historyFabArcOption, { width: AGENDA_FAB_OPTION_PILL_WIDTH }]}
              >
                <Pressable
                  pointerEvents="auto"
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  onPress={() => openAgendaAddRecurring(variant)}
                  style={({ pressed }) => [
                    styles.historyFabOptionCard,
                    historyFabOptionsSurface,
                    { borderRadius: PILL_BORDER_RADIUS },
                    pressed && [
                      floatingGlassButtonPressed,
                      { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                    ],
                  ]}
                >
                  <Ionicons name={icon} size={16} color={HISTORY_FAB_OPTION_ICON_COLOR} />
                  <Text
                    style={[
                      styles.historyFabOptionLabel,
                      singleLineLabelStyle,
                      { color: HISTORY_FAB_OPTION_ICON_COLOR },
                    ]}
                    {...chipLabelTextProps()}
                  >
                    {label}
                  </Text>
                </Pressable>
              </MotiView>
            );
          })}
        </View>
      ) : null}
      {showAddButton ? (
        <Pressable
          pointerEvents="auto"
          style={({ pressed }) => [
            styles.fabPosition,
            styles.addOuter,
            {
              bottom: rightThumbFabBottom + FAB_STACK_OFFSET_ADD,
              backgroundColor: colors.accentGreen,
              shadowColor: colors.accentGreen,
            },
            pressed && floatingGlassButtonPressed,
          ]}
          onPress={handleAddPress}
          accessibilityRole="button"
          accessibilityState={
            isTransactionsHistoryView
              ? { expanded: isHistoryFabExpanded }
              : isTransactionsAgendaView
                ? { expanded: isAgendaFabExpanded }
                : undefined
          }
          accessibilityLabel={
            (isTransactionsHistoryView && isHistoryFabExpanded) ||
            (isTransactionsAgendaView && isAgendaFabExpanded)
              ? 'Fermer le menu d\'ajout'
              : 'Nouvelle transaction'
          }
        >
          <MotiView
            animate={{
              rotate:
                (isTransactionsHistoryView && isHistoryFabExpanded) ||
                (isTransactionsAgendaView && isAgendaFabExpanded)
                  ? '45deg'
                  : '0deg',
            }}
            transition={{ type: 'timing', duration: 180 }}
            style={styles.addIconWrap}
          >
            <PlusFabIcon size={24} color={TRANSACTIONS_FAB_ICON_COLOR_ORIGINAL} />
          </MotiView>
        </Pressable>
      ) : null}

      <View
        pointerEvents="box-none"
        collapsable={false}
        style={[styles.fixedNavShell, { paddingBottom: bottom }]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.fixedNavBackground,
            {
              backgroundColor: colors.background,
              borderTopColor: tabBarBorderColor,
            },
          ]}
        />
        <View style={styles.navContent} pointerEvents="box-none">
          {state.routes.map((route, index) => {
            if (HIDDEN_ROUTES.has(route.name)) return null;
            const focused = state.index === index;
            const icons = ROUTE_ICONS[route.name] ?? {
              outline: 'circle-outline',
              filled: 'circle',
            };
            const iconName = icons.outline;
            const tabLabel = ROUTE_LABELS[route.name] ?? route.name;
            const iconColor = focused ? colors.text : colors.textMuted;

            const onPress = () => {
              collapseSpeedDials();

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
              <TouchableWithoutFeedback
                key={route.key}
                onPress={onPress}
                hitSlop={TAB_HIT_SLOP}
                accessibilityRole="tab"
                accessibilityLabel={tabLabel}
                accessibilityState={{ selected: focused }}
              >
                <View style={styles.tab}>
                  <AppIcon
                    family="material-community"
                    name={iconName}
                    size={TAB_ICON_SIZE}
                    color={iconColor}
                  />
                </View>
              </TouchableWithoutFeedback>
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
  fixedNavShell: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  fixedNavBackground: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 13,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  historyFabBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
  },
  historyFabArcAnchor: {
    position: 'absolute',
    width: 0,
    height: 0,
    zIndex: 11,
  },
  historyFabArcOption: {
    position: 'absolute',
    width: HISTORY_FAB_OPTION_PILL_WIDTH,
  },
  historyFabOptionCard: {
    minHeight: HISTORY_FAB_OPTION_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  historyFabOptionLabel: {
    ...typographyKit.meta,
    textAlign: 'center',
    maxWidth: '100%',
    letterSpacing: 0.1,
  },
  fabPosition: {
    position: 'absolute',
    right: spacing.lg,
    zIndex: 10,
  },
  addOuter: {
    ...TRANSACTIONS_FAB_STYLE_ORIGINAL,
  },
  addIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  tab: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
    overflow: 'visible',
  },
  pressed: { opacity: 0.75 },
});
