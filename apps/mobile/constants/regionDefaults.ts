import { parseRegionId, type CountryRegion } from '@/constants/regions';
import type {
  CurrencyCode,
  DateFormatPreference,
  DisplayLanguage,
  NumpadDefaultMode,
} from '@/lib/settings';

export type RegionSettingsDefaults = {
  currency: CurrencyCode;
  language: DisplayLanguage;
  dateFormat: DateFormatPreference;
  numpadMode: NumpadDefaultMode;
};

/** Swiss cantons where French is the primary official language. */
const SWISS_FRENCH_CANTONS = new Set(['FR', 'GE', 'JU', 'NE', 'VD', 'VS']);

/** Canadian provinces/territories where English is the primary working language. */
const CANADIAN_ENGLISH_REGIONS = new Set([
  'AB',
  'BC',
  'MB',
  'NL',
  'NS',
  'NT',
  'NU',
  'ON',
  'PE',
  'SK',
  'YT',
]);

/** EU member states and other EUR-area countries. */
const EUR_COUNTRIES = new Set([
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GF',
  'GP',
  'GR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MC',
  'ME',
  'MF',
  'MQ',
  'MT',
  'NL',
  'PM',
  'PT',
  'RE',
  'SI',
  'SK',
  'SM',
  'VA',
  'YT',
  'AD',
  'BL',
  'HR',
  'AX',
]);

/** Countries mapped to GBP (UK and Crown Dependencies). */
const GBP_COUNTRIES = new Set(['GB', 'GG', 'JE', 'IM', 'FK']);

/** Countries mapped to CHF. */
const CHF_COUNTRIES = new Set(['CH', 'LI']);

/** Countries mapped to USD. */
const USD_COUNTRIES = new Set([
  'US',
  'EC',
  'SV',
  'PA',
  'PR',
  'GU',
  'VI',
  'AS',
  'MP',
  'TC',
  'VG',
  'BM',
  'KY',
  'PW',
  'MH',
  'FM',
  'TL',
  'ZW',
]);

/** French-speaking countries and territories. */
const FRENCH_LANGUAGE_COUNTRIES = new Set([
  'FR',
  'BE',
  'LU',
  'MC',
  'GF',
  'GP',
  'MQ',
  'RE',
  'YT',
  'MF',
  'PM',
  'BL',
  'WF',
  'NC',
  'PF',
  'SN',
  'CI',
  'ML',
  'BF',
  'NE',
  'TG',
  'BJ',
  'CD',
  'CG',
  'GA',
  'CM',
  'MA',
  'DZ',
  'TN',
  'HT',
  'RW',
  'BI',
  'TD',
  'CF',
  'DJ',
  'KM',
  'SC',
  'VU',
  'MC',
  'LU',
]);

/** US English defaults. */
const US_ENGLISH_COUNTRIES = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP']);

function currencyForCountry(countryCode: string): CurrencyCode {
  if (countryCode === 'CA') return 'CAD';
  if (CHF_COUNTRIES.has(countryCode)) return 'CHF';
  if (GBP_COUNTRIES.has(countryCode)) return 'GBP';
  if (EUR_COUNTRIES.has(countryCode)) return 'EUR';
  if (USD_COUNTRIES.has(countryCode)) return 'USD';
  return 'USD';
}

function languageForCountry(countryCode: string, regionCode?: string): DisplayLanguage {
  if (countryCode === 'CA') {
    return regionCode && CANADIAN_ENGLISH_REGIONS.has(regionCode) ? 'en-CA' : 'fr-CA';
  }
  if (countryCode === 'CH') {
    return regionCode && SWISS_FRENCH_CANTONS.has(regionCode) ? 'fr-CA' : 'en-CA';
  }
  if (US_ENGLISH_COUNTRIES.has(countryCode)) return 'en-US';
  if (FRENCH_LANGUAGE_COUNTRIES.has(countryCode)) return 'fr-CA';
  if (GBP_COUNTRIES.has(countryCode)) return 'en-CA';
  return 'en-CA';
}

function dateFormatForCountry(countryCode: string): DateFormatPreference {
  if (US_ENGLISH_COUNTRIES.has(countryCode)) return 'numeric';
  return 'friendly';
}

function defaultsForCountry(
  countryCode: string,
  regionCode?: string,
): RegionSettingsDefaults {
  return {
    currency: currencyForCountry(countryCode),
    language: languageForCountry(countryCode, regionCode),
    dateFormat: dateFormatForCountry(countryCode),
    numpadMode: 'decimal',
  };
}

/** Returns currency, language, and related defaults for a region ID. */
export function getDefaultsForRegion(regionId: CountryRegion): RegionSettingsDefaults {
  const { countryCode, regionCode } = parseRegionId(regionId);
  return defaultsForCountry(countryCode, regionCode);
}
