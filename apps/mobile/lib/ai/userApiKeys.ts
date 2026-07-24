/**
 * BYOK (bring your own key) for Fyn chat — stored on-device via SecureStore (native)
 * or localStorage (web). User keys override EXPO_PUBLIC_* env keys when present.
 *
 * Keys on device are extractable (rooted device / web DevTools) — acceptable for
 * personal BYOK, not for shipping a shared production key.
 */
import { Platform } from 'react-native';

import {
  deleteSecureItemAsync,
  getSecureItemAsync,
  setSecureItemAsync,
} from '@/lib/secureStorage';

const GEMINI_KEY_ALIAS = 'bt_fyn_gemini_api_key_v1';
const ANTHROPIC_KEY_ALIAS = 'bt_fyn_anthropic_api_key_v1';

type CachedKeys = {
  gemini: string | undefined;
  anthropic: string | undefined;
  hydrated: boolean;
};

const cache: CachedKeys = {
  gemini: undefined,
  anthropic: undefined,
  hydrated: false,
};

function normalizeKey(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export async function hydrateUserApiKeys(): Promise<void> {
  const [gemini, anthropic] = await Promise.all([
    getSecureItemAsync(GEMINI_KEY_ALIAS),
    getSecureItemAsync(ANTHROPIC_KEY_ALIAS),
  ]);
  cache.gemini = normalizeKey(gemini);
  cache.anthropic = normalizeKey(anthropic);
  cache.hydrated = true;
}

/** Idempotent — safe to call before chat send if boot hydrate has not finished. */
export async function ensureUserApiKeysHydrated(): Promise<void> {
  if (cache.hydrated) return;
  await hydrateUserApiKeys();
}

export function getCachedUserGeminiApiKey(): string | undefined {
  return cache.gemini;
}

export function getCachedUserAnthropicApiKey(): string | undefined {
  return cache.anthropic;
}

export function areUserApiKeysHydrated(): boolean {
  return cache.hydrated;
}

export async function setUserGeminiApiKey(value: string): Promise<void> {
  const normalized = normalizeKey(value);
  if (!normalized) {
    await clearUserGeminiApiKey();
    return;
  }
  await setSecureItemAsync(GEMINI_KEY_ALIAS, normalized);
  cache.gemini = normalized;
  cache.hydrated = true;
}

export async function setUserAnthropicApiKey(value: string): Promise<void> {
  const normalized = normalizeKey(value);
  if (!normalized) {
    await clearUserAnthropicApiKey();
    return;
  }
  await setSecureItemAsync(ANTHROPIC_KEY_ALIAS, normalized);
  cache.anthropic = normalized;
  cache.hydrated = true;
}

export async function clearUserGeminiApiKey(): Promise<void> {
  await deleteSecureItemAsync(GEMINI_KEY_ALIAS);
  cache.gemini = undefined;
  cache.hydrated = true;
}

export async function clearUserAnthropicApiKey(): Promise<void> {
  await deleteSecureItemAsync(ANTHROPIC_KEY_ALIAS);
  cache.anthropic = undefined;
  cache.hydrated = true;
}

export function getUserApiKeyStorageHint(): string {
  if (Platform.OS === 'web') {
    return 'Sur le web, la clé est stockée dans le navigateur (localStorage) — moins sécurisé qu’un téléphone. Claude peut être bloqué par CORS.';
  }
  return 'La clé est stockée de façon sécurisée sur cet appareil (SecureStore). Elle reste extractible sur un appareil compromis.';
}
