/**
 * Web FloatingTabBar — portaled to `document.body` so CSS `backdrop-filter`
 * samples real page content (RN Web / gesture stacking contexts otherwise
 * isolate blur and leave a frost-looking tint).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AppState,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from "expo-router/react-navigation";
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from "expo-router/js-tabs";
import { AppIcon } from '@/components/icons/AppIcon';
import { GlassFab } from '@/components/GlassFab';
import {
  AGENDA_FAB_ADD_ACTIONS,
  AGENDA_FAB_OPTION_PILL_WIDTH,
  FAB_STACK_OFFSET_ADD,
  FAB_STACK_OFFSET_VOICE,
  getAgendaFabArcOffsets,
  getHistoryFabArcOffsets,
  HIDDEN_ROUTES,
  useShouldHideTabFabs,
  HISTORY_FAB_ADD_ACTIONS,
  HISTORY_FAB_ARC_ANGLES_DEG,
  HISTORY_FAB_ARC_RADIUS,
  HISTORY_FAB_ARC_STAGGER_MS,
  HISTORY_FAB_MAIN_SIZE,
  HISTORY_FAB_OPTION_ICON_COLOR,
  HISTORY_FAB_OPTION_PILL_WIDTH,
  HISTORY_FAB_OPTION_ROW_HEIGHT,
  PILL_BORDER_RADIUS,
  PlusFabIcon,
  ROUTE_ICONS,
  ROUTE_LABELS,
  TabButton,
  getFloatingTabBarIconColors,
  type HistoryAddTransactionType,
} from '@/components/tabbar/floatingTabBarShared';
import { VoiceCommandIcon } from '@/components/icons/VoiceCommandIcon';
import {
  SHOW_TRANSACTIONS_TAB_FABS,
  transactionsFabGlyphColor,
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
import { usePathname, useRouter } from 'expo-router';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const STYLE_ID = 'fyn-floating-tabbar-web-v2';

function ensureWebTabBarCss() {
  if (typeof document === 'undefined') return;
  document.getElementById(STYLE_ID)?.remove();
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = `
    .fyn-ftb-root {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-end;
    }
    .fyn-ftb-pill {
      pointer-events: auto;
      margin-left: 24px;
      margin-right: 24px;
      border-radius: 999px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      /* Strong dynamic blur — content scrolling under the pill must look soft */
      backdrop-filter: blur(56px) saturate(1.7);
      -webkit-backdrop-filter: blur(56px) saturate(1.7);
      box-shadow:
        0 12px 36px rgba(0, 0, 0, 0.45),
        0 0 28px rgba(255, 255, 255, 0.12),
        inset 0 0.5px 0 rgba(255, 255, 255, 0.18);
    }
    .fyn-ftb-pill--dark {
      background: rgba(12, 12, 14, 0.18);
    }
    .fyn-ftb-pill--light {
      background: rgba(255, 255, 255, 0.22);
      border-color: rgba(255, 255, 255, 0.4);
    }
  `;
  document.head.appendChild(el);
}

export function FloatingTabBar({ state, navigation, insets: navInsets }: BottomTabBarProps) {
  const [isHistoryFabExpanded, setIsHistoryFabExpanded] = useState(false);
  const [isAgendaFabExpanded, setIsAgendaFabExpanded] = useState(false);
  const safeInsets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { colors, isLight } = useAppTheme();

  useEffect(() => {
    ensureWebTabBarCss();
  }, []);

  const historyFabOptionsSurface = useMemo(
    () => ({
      backgroundColor: isLight ? 'rgba(18, 18, 18, 0.90)' : 'rgba(22, 22, 22, 0.94)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      borderWidth: 1,
    }),
    [isLight],
  );

  const bottom = getFloatingTabBarBottomInset(
    Math.max(navInsets?.bottom ?? 0, safeInsets.bottom),
  );
  const activeRouteName = state.routes[state.index]?.name;
  const isAgendaTab = activeRouteName === 'goals';
  const isTransactionsTab = activeRouteName === 'transactions';
  const hideTabFabs = useShouldHideTabFabs(pathname);
  const showAddButton =
    SHOW_TRANSACTIONS_TAB_FABS &&
    (isTransactionsTab || isAgendaTab) &&
    !hideTabFabs;
  /** Mic / waveform FAB — Transactions only, stacked above the + GlassFab. */
  const showVoiceButton =
    SHOW_TRANSACTIONS_TAB_FABS && isTransactionsTab && !hideTabFabs;
  const showHistoryFabOptions =
    isTransactionsTab && isHistoryFabExpanded && !hideTabFabs;
  const showAgendaFabOptions = isAgendaTab && isAgendaFabExpanded && !hideTabFabs;
  const rightThumbFabBottom = bottom + FLOATING_FAB_SIZE - spacing.sm;

  const collapseSpeedDials = useCallback(() => {
    setIsHistoryFabExpanded(false);
    setIsAgendaFabExpanded(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      collapseSpeedDials();
      return () => collapseSpeedDials();
    }, [collapseSpeedDials]),
  );

  useEffect(() => {
    collapseSpeedDials();
    return () => collapseSpeedDials();
  }, [state.index, pathname, hideTabFabs, collapseSpeedDials]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        collapseSpeedDials();
      }
    });
    return () => subscription.remove();
  }, [collapseSpeedDials]);

  const collapseHistoryFab = useCallback(() => setIsHistoryFabExpanded(false), []);
  const collapseAgendaFab = useCallback(() => setIsAgendaFabExpanded(false), []);

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
      router.push({ pathname: '/add-transaction', params: { type } });
    },
    [collapseHistoryFab, router],
  );

  const handleAddPress = () => {
    if (isTransactionsTab) {
      tapHaptic();
      setIsHistoryFabExpanded((expanded) => !expanded);
      return;
    }
    if (isAgendaTab) {
      tapHaptic();
      setIsAgendaFabExpanded((expanded) => !expanded);
      return;
    }
    tapHaptic();
    router.push('/add-transaction');
  };

  const handleVoicePress = useCallback(() => {
    tapHaptic();
    collapseSpeedDials();
    uiEvents.requestVoiceTransaction();
  }, [collapseSpeedDials]);

  const { active: navActiveColor, inactive: navInactiveColor, activeWell: navActiveWell, activeIndicator: navActiveIndicator } =
    getFloatingTabBarIconColors(colors, isLight);

  if (typeof document === 'undefined') {
    return null;
  }

  const ui = (
    <div className="fyn-ftb-root" style={{ paddingBottom: bottom }}>
      {/* Speed-dial layers use RN Views absolutely positioned within a full-size host */}
      <View style={styles.host} pointerEvents="box-none">
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
                bottom: rightThumbFabBottom + FAB_STACK_OFFSET_ADD + HISTORY_FAB_MAIN_SIZE / 2 - bottom,
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
                    <AppIcon
                      family="ionicons"
                      name={icon}
                      size={16}
                      color={HISTORY_FAB_OPTION_ICON_COLOR}
                    />
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
                bottom: rightThumbFabBottom + FAB_STACK_OFFSET_ADD + HISTORY_FAB_MAIN_SIZE / 2 - bottom,
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
                    <AppIcon
                      family="ionicons"
                      name={icon}
                      size={16}
                      color={HISTORY_FAB_OPTION_ICON_COLOR}
                    />
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

        {showVoiceButton ? (
          <GlassFab
            style={[
              styles.fabPosition,
              { bottom: rightThumbFabBottom + FAB_STACK_OFFSET_VOICE - bottom },
            ]}
            onPress={handleVoicePress}
            accessibilityLabel="Commande vocale"
          >
            <VoiceCommandIcon size={24} color={transactionsFabGlyphColor(colors)} />
          </GlassFab>
        ) : null}

        {showAddButton ? (
          <GlassFab
            style={[
              styles.fabPosition,
              { bottom: rightThumbFabBottom + FAB_STACK_OFFSET_ADD - bottom },
            ]}
            onPress={handleAddPress}
            accessibilityState={
              isTransactionsTab
                ? { expanded: isHistoryFabExpanded }
                : isAgendaTab
                  ? { expanded: isAgendaFabExpanded }
                  : undefined
            }
            accessibilityLabel={
              (isTransactionsTab && isHistoryFabExpanded) ||
              (isAgendaTab && isAgendaFabExpanded)
                ? "Fermer le menu d'ajout"
                : isAgendaTab
                  ? 'Ajouter un paiement récurrent'
                  : 'Nouvelle transaction'
            }
          >
            <MotiView
              animate={{
                rotate:
                  (isTransactionsTab && isHistoryFabExpanded) ||
                  (isAgendaTab && isAgendaFabExpanded)
                    ? '45deg'
                    : '0deg',
              }}
              transition={{ type: 'timing', duration: 180 }}
              style={styles.addIconWrap}
            >
              <PlusFabIcon size={24} color={transactionsFabGlyphColor(colors)} />
            </MotiView>
          </GlassFab>
        ) : null}

        <div
          className={`fyn-ftb-pill ${isLight ? 'fyn-ftb-pill--light' : 'fyn-ftb-pill--dark'}`}
          style={{ borderRadius: PILL_BORDER_RADIUS }}
        >
          <View style={styles.navContent} pointerEvents="box-none">
            {state.routes.map((route, index) => {
              if (HIDDEN_ROUTES.has(route.name)) return null;
              const focused = state.index === index;
              const icons = ROUTE_ICONS[route.name] ?? {
                outline: 'circle-outline',
                filled: 'circle',
              };
              const iconName = focused ? icons.filled : icons.outline;
              const tabLabel = ROUTE_LABELS[route.name] ?? route.name;
              const iconColor = focused ? navActiveColor : navInactiveColor;

              const onPress = () => {
                collapseSpeedDials();
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;
                if (route.name === 'transactions') {
                  if (!focused) navigation.navigate('transactions');
                  return;
                }
                if (!focused) {
                  navigation.navigate(route.name, route.params);
                }
              };

              return (
                <TabButton
                  key={route.key}
                  tabLabel={tabLabel}
                  focused={focused}
                  iconName={iconName}
                  iconColor={iconColor}
                  activeWellColor={navActiveWell}
                  activeIndicatorColor={navActiveIndicator}
                  onPress={onPress}
                />
              );
            })}
          </View>
        </div>
      </View>
    </div>
  );

  return createPortal(ui, document.body);
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
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
  addIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
