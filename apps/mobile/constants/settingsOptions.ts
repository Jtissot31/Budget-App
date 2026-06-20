import type {
  CurrencyCode,
  DateFormatPreference,
  DisplayLanguage,
  NumpadDefaultMode,
} from '@/lib/settings';

export type SettingsOption<T extends string> = {
  id: T;
  label: string;
  description?: string;
  icon?: string;
};

export const CURRENCY_OPTIONS: SettingsOption<CurrencyCode>[] = [
  { id: 'CAD', label: 'CAD ($)', description: 'Dollar canadien' },
  { id: 'USD', label: 'USD ($)', description: 'Dollar américain' },
  { id: 'EUR', label: 'EUR (€)', description: 'Euro' },
  { id: 'GBP', label: 'GBP (£)', description: 'Livre sterling' },
  { id: 'CHF', label: 'CHF (Fr.)', description: 'Franc suisse' },
];

export const LANGUAGE_OPTIONS: SettingsOption<DisplayLanguage>[] = [
  { id: 'fr-CA', label: 'Français', description: 'Interface et dates en français' },
  { id: 'en-CA', label: 'English', description: 'Interface in English, fr-CA dates' },
  { id: 'en-US', label: 'EN (US)', description: 'Interface in English, US formats' },
];

export const DATE_FORMAT_OPTIONS: SettingsOption<DateFormatPreference>[] = [
  { id: 'friendly', label: 'Amical', description: 'Aujourd\'hui, Hier, 12 janvier 2026' },
  { id: 'numeric', label: 'Numérique', description: '2026-01-12' },
];

export const NUMPAD_MODE_OPTIONS: SettingsOption<NumpadDefaultMode>[] = [
  { id: 'decimal', label: 'Décimales', description: 'Permet les centimes par défaut' },
  { id: 'whole', label: 'Entiers', description: 'Montants arrondis au dollar' },
];

export function labelForOption<T extends string>(
  options: SettingsOption<T>[],
  id: T,
): string {
  return options.find((option) => option.id === id)?.label ?? id;
}
