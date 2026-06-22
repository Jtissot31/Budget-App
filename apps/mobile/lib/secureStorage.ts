import { Platform } from 'react-native';

const WEB_KEY_PREFIX = '@bt/secure:';

async function webGetItemAsync(key: string): Promise<string | null> {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(WEB_KEY_PREFIX + key);
}

async function webSetItemAsync(key: string, value: string): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(WEB_KEY_PREFIX + key, value);
}

async function webDeleteItemAsync(key: string): Promise<void> {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(WEB_KEY_PREFIX + key);
}

// Native-only — expo-secure-store's web stub lacks getValueWithKeyAsync.
const nativeSecureStore =
  Platform.OS !== 'web'
    ? (require('expo-secure-store') as typeof import('expo-secure-store'))
    : null;

export async function getSecureItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return webGetItemAsync(key);
  return nativeSecureStore!.getItemAsync(key);
}

export async function setSecureItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') return webSetItemAsync(key, value);
  return nativeSecureStore!.setItemAsync(key, value);
}

export async function deleteSecureItemAsync(key: string): Promise<void> {
  if (Platform.OS === 'web') return webDeleteItemAsync(key);
  return nativeSecureStore!.deleteItemAsync(key);
}
