import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { getDefaultsForRegion } from '@/constants/regionDefaults';
import { isCountryRegion, type CountryRegion } from '@/constants/regions';
import type { ThemePreference } from '@/constants/theme';

export type { CountryRegion };

const API_URL_KEY = 'api_base_url';
const USE_MOCK_KEY = 'use_mock_only';
const THEME_PREFERENCE_KEY = 'theme_preference';
const NET_WORTH_CHART_SCOPE_KEY = 'net_worth_chart_scope';
const CURRENCY_KEY = 'display_currency';
const LANGUAGE_KEY = 'display_language';
const LANGUAGE_MANUALLY_SET_KEY = 'display_language_manual';
const REGION_KEY = 'country_region';
const DATE_FORMAT_KEY = 'date_format_preference';
const NUMPAD_MODE_KEY = 'numpad_default_mode';
const HAPTIC_FEEDBACK_KEY = 'haptic_feedback_enabled';
const AUTOCOMPLETE_KEY = 'autocomplete_enabled';
const CLOUD_ACCOUNT_CONNECTED_KEY = 'cloud_account_connected';
const DEFAULT_API = 'https://localhost:7080';

export type CurrencyCode = 'CAD' | 'USD' | 'EUR' | 'GBP' | 'CHF';
export type DisplayLanguage = 'fr-CA' | 'en-CA' | 'en-US';
export type DateFormatPreference = 'friendly' | 'numeric';
export type NumpadDefaultMode = 'decimal' | 'whole';

const VALID_CURRENCIES = new Set<CurrencyCode>(['CAD', 'USD', 'EUR', 'GBP', 'CHF']);
const VALID_LANGUAGES = new Set<DisplayLanguage>(['fr-CA', 'en-CA', 'en-US']);
const VALID_DATE_FORMATS = new Set<DateFormatPreference>(['friendly', 'numeric']);
const VALID_NUMPAD_MODES = new Set<NumpadDefaultMode>(['decimal', 'whole']);

let runtimeHapticFeedbackEnabled = true;
let runtimeAutocompleteEnabled = true;

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

export async function getDisplayCurrency(): Promise<CurrencyCode> {
  const raw = await AsyncStorage.getItem(CURRENCY_KEY);
  return raw && VALID_CURRENCIES.has(raw as CurrencyCode) ? (raw as CurrencyCode) : 'CAD';
}

export async function setDisplayCurrency(value: CurrencyCode): Promise<void> {
  await AsyncStorage.setItem(CURRENCY_KEY, value);
}

/** Maps the device locale to a supported app language (not region/country). */
export function mapDeviceLocaleToDisplayLanguage(): DisplayLanguage {
  const locale = getLocales()[0];
  const languageTag = (locale?.languageTag ?? '').toLowerCase();
  const languageCode = (locale?.languageCode ?? '').toLowerCase();
  const regionCode = (locale?.regionCode ?? '').toUpperCase();

  if (languageTag.startsWith('en-ca') || (languageCode === 'en' && regionCode === 'CA')) {
    return 'en-CA';
  }
  if (languageTag.startsWith('en-us') || languageCode === 'en') {
    return 'en-US';
  }
  if (languageCode.startsWith('fr') || languageTag.startsWith('fr')) {
    return 'fr-CA';
  }

  return languageCode.startsWith('fr') ? 'fr-CA' : 'en-CA';
}

export async function getDisplayLanguage(): Promise<DisplayLanguage> {
  const raw = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (raw && VALID_LANGUAGES.has(raw as DisplayLanguage)) {
    return raw as DisplayLanguage;
  }
  return ensureDisplayLanguageFromDevice();
}

export async function setDisplayLanguage(value: DisplayLanguage): Promise<void> {
  await AsyncStorage.multiSet([
    [LANGUAGE_KEY, value],
    [LANGUAGE_MANUALLY_SET_KEY, 'true'],
  ]);
}

/** Sets language from the phone locale on first install (no stored value yet). */
export async function ensureDisplayLanguageFromDevice(): Promise<DisplayLanguage> {
  const storedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (storedLanguage && VALID_LANGUAGES.has(storedLanguage as DisplayLanguage)) {
    return storedLanguage as DisplayLanguage;
  }

  const language = mapDeviceLocaleToDisplayLanguage();
  await AsyncStorage.setItem(LANGUAGE_KEY, language);
  return language;
}

export async function getCountryRegion(): Promise<CountryRegion> {
  const raw = await AsyncStorage.getItem(REGION_KEY);
  return raw && isCountryRegion(raw) ? raw : 'CA-QC';
}

export async function setCountryRegion(value: CountryRegion): Promise<void> {
  await AsyncStorage.setItem(REGION_KEY, value);
}

export type RegionLinkedSettings = {
  region: CountryRegion;
  currency: CurrencyCode;
  dateFormat: DateFormatPreference;
  numpadMode: NumpadDefaultMode;
};

/** Persists region and syncs currency, date format, and numpad from regional defaults. */
export async function applyRegionSettings(regionId: CountryRegion): Promise<RegionLinkedSettings> {
  const defaults = getDefaultsForRegion(regionId);

  await AsyncStorage.multiSet([
    [REGION_KEY, regionId],
    [CURRENCY_KEY, defaults.currency],
    [DATE_FORMAT_KEY, defaults.dateFormat],
    [NUMPAD_MODE_KEY, defaults.numpadMode],
  ]);

  return {
    region: regionId,
    ...defaults,
  };
}

export async function getDateFormatPreference(): Promise<DateFormatPreference> {
  const raw = await AsyncStorage.getItem(DATE_FORMAT_KEY);
  return raw && VALID_DATE_FORMATS.has(raw as DateFormatPreference)
    ? (raw as DateFormatPreference)
    : 'friendly';
}

export async function setDateFormatPreference(value: DateFormatPreference): Promise<void> {
  await AsyncStorage.setItem(DATE_FORMAT_KEY, value);
}

export async function getNumpadDefaultMode(): Promise<NumpadDefaultMode> {
  const raw = await AsyncStorage.getItem(NUMPAD_MODE_KEY);
  return raw && VALID_NUMPAD_MODES.has(raw as NumpadDefaultMode)
    ? (raw as NumpadDefaultMode)
    : 'decimal';
}

export async function setNumpadDefaultMode(value: NumpadDefaultMode): Promise<void> {
  await AsyncStorage.setItem(NUMPAD_MODE_KEY, value);
}

export async function getHapticFeedbackEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(HAPTIC_FEEDBACK_KEY);
  return raw === null ? true : raw === 'true';
}

export async function setHapticFeedbackEnabled(value: boolean): Promise<void> {
  runtimeHapticFeedbackEnabled = value;
  await AsyncStorage.setItem(HAPTIC_FEEDBACK_KEY, String(value));
}

export function isHapticFeedbackEnabled(): boolean {
  return runtimeHapticFeedbackEnabled;
}

export async function getAutocompleteEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(AUTOCOMPLETE_KEY);
  return raw === null ? true : raw === 'true';
}

export async function setAutocompleteEnabled(value: boolean): Promise<void> {
  runtimeAutocompleteEnabled = value;
  await AsyncStorage.setItem(AUTOCOMPLETE_KEY, String(value));
}

export function isAutocompleteEnabled(): boolean {
  return runtimeAutocompleteEnabled;
}

export async function getCloudAccountConnected(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(CLOUD_ACCOUNT_CONNECTED_KEY);
  return raw === 'true';
}

export async function setCloudAccountConnected(value: boolean): Promise<void> {
  await AsyncStorage.setItem(CLOUD_ACCOUNT_CONNECTED_KEY, String(value));
}

/** Loads data-entry toggles into memory for synchronous reads (haptics, autocomplete). */
export async function hydrateRuntimePreferences(): Promise<void> {
  const [haptic, autocomplete] = await Promise.all([
    getHapticFeedbackEnabled(),
    getAutocompleteEnabled(),
  ]);
  runtimeHapticFeedbackEnabled = haptic;
  runtimeAutocompleteEnabled = autocomplete;
}

/** Stub — removes cloud-backed data when backend is available. */
export async function deleteCloudData(): Promise<{ ok: boolean; message: string }> {
  if (!(await getCloudAccountConnected())) {
    return { ok: false, message: 'Aucun compte cloud connecté.' };
  }
  await setCloudAccountConnected(false);
  return {
    ok: true,
    message: 'Les données cloud seront supprimées lorsque le serveur sera disponible. Compte déconnecté localement.',
  };
}
