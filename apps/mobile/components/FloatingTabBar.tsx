import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { usePathname, useRouter } from 'expo-router';
import {
  FLOATING_FAB_ICON_SIZE,
  FLOATING_FAB_RADIUS,
  FLOATING_FAB_SIZE,
  floatingGlassButtonPressed,
} from '@/constants/floatingGlassButton';
import {
  getFloatingTabBarBottomInset,
  lightColors,
  radius,
  spacing,
  typographyKit,
} from '@/constants/theme';
import { tapHaptic } from '@/lib/haptics';
import type { RecurringPaymentAddVariant } from '@/components/RecurringPaymentsForm';
import { uiEvents } from '@/lib/events';
import { chipLabelTextProps, singleLineLabelStyle } from '@/lib/textLayout';
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
// 158° → 163°: equalises visual pill gap (y-gap = R·Δsin θ − pillH).
// Equal Δθ ≠ equal Δy because sin is nonlinear; 163° centres Revenu at
// the midpoint of sin(195°)…sin(121°), giving ~25 px gap on both sides.
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

function getHistoryFabArcOffsets(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    right: -radius * Math.cos(rad) - HISTORY_FAB_OPTION_PILL_WIDTH / 2,
    bottom: radius * Math.sin(rad) - HISTORY_FAB_OPTION_ROW_HEIGHT / 2,
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
  const isAndroid = Platform.OS === 'android';
  const activeRouteName = state.routes[state.index]?.name;
  const activeRouteParams = state.routes[state.index]?.params as { view?: string } | undefined;
  const transactionsView = activeRouteName === 'transactions' ? (activeRouteParams?.view ?? 'history') : undefined;
  const isDashboard = activeRouteName === 'index';
  const isTransactionsHistoryView = transactionsView === 'history';
  const isTransactionsAgendaView = transactionsView === 'agenda';
  const isTransactionsMerchantsView = transactionsView === 'merchants';
  const showDashboardAiChatFab = isDashboard;
  const showAddButton =
    activeRouteName !== 'accounts' &&
    activeRouteName !== 'goals' &&
    activeRouteName !== 'budgets' &&
    activeRouteName !== 'settings' &&
    !isDashboard &&
    !isTransactionsMerchantsView;
  const showHistoryFabOptions = isTransactionsHistoryView && isHistoryFabExpanded;
  const showAgendaFabOptions = isTransactionsAgendaView && isAgendaFabExpanded;
  const rightThumbFabBottom = bottom + FLOATING_FAB_SIZE;

  useEffect(() => {
    setIsHistoryFabExpanded(false);
    setIsAgendaFabExpanded(false);
  }, [activeRouteName, pathname, transactionsView]);

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

  const openAiChat = () => {
    router.push('/ai-advisor');
  };

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

  const navShellBg = colors.containerBackground;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {showHistoryFabOptions ? (
        <Pressable
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
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  onPress={() => openHistoryAddTransaction(type)}
                  style={({ pressed }) => [
                    styles.historyFabOptionCard,
                    historyFabOptionsSurface,
                    { borderRadius: radius.pill },
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
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  onPress={() => openAgendaAddRecurring(variant)}
                  style={({ pressed }) => [
                    styles.historyFabOptionCard,
                    historyFabOptionsSurface,
                    { borderRadius: radius.pill },
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
      {showDashboardAiChatFab ? (
        <Pressable
          style={({ pressed }) => [
            styles.aiChatOuter,
            { bottom: rightThumbFabBottom + FAB_STACK_OFFSET_ADD },
            pressed && floatingGlassButtonPressed,
          ]}
          onPress={openAiChat}
          accessibilityRole="button"
          accessibilityLabel="Fyn — conseils budget"
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
            <PlusFabIcon size={24} color="#000000" />
          </MotiView>
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
