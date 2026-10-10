import { GlassFab } from '@/components/GlassFab';
import { VoiceCommandIcon } from '@/components/icons/VoiceCommandIcon';
import { useShouldHideTabFabs } from '@/components/tabbar/floatingTabBarShared';
import { SHOW_TRANSACTIONS_TAB_FABS, transactionsFabGlyphColor } from '@/constants/fabStyles';
import { jakartaBoldText } from '@/constants/theme';
import { uiEvents } from '@/lib/events';
import { tapHaptic } from '@/lib/haptics';
import { useAppTheme } from '@/lib/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { usePathname } from 'expo-router';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type TabItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
};

const TABS: TabItem[] = [
  { key: 'Home', label: 'ACCUEIL', icon: 'home-outline', activeIcon: 'home' },
  { key: 'Activity', label: 'ACTIVITÉ', icon: 'receipt-outline', activeIcon: 'receipt' },
  { key: 'Budget', label: 'BUDGET', icon: 'pie-chart-outline', activeIcon: 'pie-chart' },
  { key: 'Agenda', label: 'AGENDA', icon: 'calendar-outline', activeIcon: 'calendar' },
  { key: 'Balance', label: 'WALLET', icon: 'wallet-outline', activeIcon: 'wallet' },
];

/** Expo-router screen names for the five existing tab destinations. */
const TAB_KEY_TO_ROUTE: Record<string, string> = {
  Home: 'index',
  Activity: 'transactions',
  Budget: 'budgets',
  Agenda: 'goals',
  Balance: 'accounts',
};

const ROUTE_TO_TAB_KEY: Record<string, string> = {
  index: 'Home',
  transactions: 'Activity',
  budgets: 'Budget',
  goals: 'Agenda',
  accounts: 'Balance',
};

interface BottomNavBarProps {
  currentTab: string;
  onTabPress: (tabKey: string) => void;
}

export function BottomNavBar({ currentTab, onTabPress }: BottomNavBarProps) {
  const insets = useSafeAreaInsets();
  const { isLight } = useAppTheme();
  const activeColor = isLight ? '#0A0A0F' : '#FFFFFF';
  const inactiveColor = isLight ? '#8E8E9A' : '#71717A';
  const solidFill = Platform.OS !== 'ios';

  return (
    <View
      style={[
        styles.container,
        solidFill && { backgroundColor: isLight ? '#FFFFFF' : '#09090B' },
        { borderTopColor: isLight ? 'rgba(0, 0, 0, 0.08)' : '#27272A' },
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={80} tint={isLight ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
      ) : null}

      <View style={styles.navRow}>
        {TABS.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => onTabPress(tab.key)}
              style={styles.tabButton}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={21}
                color={isActive ? activeColor : inactiveColor}
              />
              <Text style={[styles.tabLabel, { color: isActive ? activeColor : inactiveColor }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Custom `Tabs` bar. The row is in normal flow so the navigator slot matches the
 * dock and does not leave an empty band above it. Web and Android use a solid fill;
 * iOS blurs the content behind the same row.
 * Voice dictation stays a separate control, only on Activity, drawn above the row.
 */
export function AppBottomTabBar({ state, navigation }: BottomTabBarProps) {
  const pathname = usePathname();
  const { colors } = useAppTheme();
  const hideTabFabs = useShouldHideTabFabs(pathname);
  const activeRouteName = state.routes[state.index]?.name ?? '';
  const currentTab = ROUTE_TO_TAB_KEY[activeRouteName] ?? '';
  const showVoice =
    SHOW_TRANSACTIONS_TAB_FABS && activeRouteName === 'transactions' && !hideTabFabs;

  const onTabPress = (tabKey: string) => {
    const routeName = TAB_KEY_TO_ROUTE[tabKey];
    if (!routeName) return;
    const route = state.routes.find((item) => item.name === routeName);
    if (!route) return;

    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (event.defaultPrevented) return;
    if (state.routes[state.index]?.key === route.key) return;

    if (route.name === 'transactions') {
      navigation.navigate('transactions');
      return;
    }
    navigation.navigate(route.name, route.params);
  };

  const onVoicePress = () => {
    tapHaptic();
    uiEvents.requestVoiceTransaction();
  };

  return (
    <View pointerEvents="box-none" collapsable={false} style={styles.host}>
      {showVoice ? (
        <GlassFab
          onPress={onVoicePress}
          accessibilityLabel="Commande vocale"
          style={styles.voiceFab}
        >
          <VoiceCommandIcon size={22} color={transactionsFabGlyphColor(colors)} />
        </GlassFab>
      ) : null}
      <BottomNavBar currentTab={currentTab} onTabPress={onTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    backgroundColor: 'transparent',
  },
  container: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 10,
    overflow: 'hidden',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  tabLabel: {
    ...jakartaBoldText,
    fontSize: 9,
    letterSpacing: -0.2,
  },
  voiceFab: {
    position: 'absolute',
    right: 20,
    bottom: '100%',
    marginBottom: 12,
    zIndex: 2,
  },
});
