import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ThemePreference } from '@/constants/theme';

const API_URL_KEY = 'api_base_url';
const USE_MOCK_KEY = 'use_mock_only';
const THEME_PREFERENCE_KEY = 'theme_preference';
const NET_WORTH_CHART_SCOPE_KEY = 'net_worth_chart_scope';
const DEFAULT_API = 'https://localhost:7080';

/** What the Portefeuille net-worth card totals and trend include. */
export type NetWorthChartScope = 'accounts_only' | 'inclusive';

export async function getApiBaseUrl(): Promise<string> {
  return (await AsyncStorage.getItem(API_URL_KEY)) ?? DEFAULT_API;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(API_URL_KEY, url.trim().replace(/\/$/, ''));
}

export async function getUseMockOnly(): Promise<boolean> {
  const v = await AsyncStorage.getItem(USE_MOCK_KEY);
  return v === null ? true : v === 'true';
}

export async function setUseMockOnly(value: boolean): Promise<void> {
  await AsyncStorage.setItem(USE_MOCK_KEY, String(value));
}

export async function getThemePreference(): Promise<ThemePreference> {
  const value = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
  return value === 'light' ? 'light' : 'dark';
}

export async function setThemePreference(value: ThemePreference): Promise<void> {
  await AsyncStorage.setItem(THEME_PREFERENCE_KEY, value);
}

export async function getNetWorthChartScope(): Promise<NetWorthChartScope> {
  const raw = await AsyncStorage.getItem(NET_WORTH_CHART_SCOPE_KEY);
  return raw === 'accounts_only' ? 'accounts_only' : 'inclusive';
}

export async function setNetWorthChartScope(scope: NetWorthChartScope): Promise<void> {
  await AsyncStorage.setItem(NET_WORTH_CHART_SCOPE_KEY, scope);
}

const WEALTH_SECTION_EXPANDED_KEY = 'wealth_section_expanded';

/**
 * Returns null when the user has never explicitly set this preference.
 * Callers should treat null as "auto: expand if assets exist, collapse if empty".
 */
export async function getWealthSectionExpanded(): Promise<boolean | null> {
  const raw = await AsyncStorage.getItem(WEALTH_SECTION_EXPANDED_KEY);
  if (raw === null) return null;
  return raw === 'true';
}

export async function setWealthSectionExpanded(value: boolean): Promise<void> {
  await AsyncStorage.setItem(WEALTH_SECTION_EXPANDED_KEY, String(value));
}

const LOANS_SECTION_EXPANDED_KEY = 'loans_section_expanded';

/**
 * Returns null when the user has never explicitly set this preference.
 * Callers should treat null as "auto: expand if loans exist, collapse if empty".
 */
export async function getLoansSectionExpanded(): Promise<boolean | null> {
  const raw = await AsyncStorage.getItem(LOANS_SECTION_EXPANDED_KEY);
  if (raw === null) return null;
  return raw === 'true';
}

export async function setLoansSectionExpanded(value: boolean): Promise<void> {
  await AsyncStorage.setItem(LOANS_SECTION_EXPANDED_KEY, String(value));
}
