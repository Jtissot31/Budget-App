/**
 * API keys for Fyn — resolution order:
 * 1. User BYOK key (SecureStore / localStorage), hydrated at boot
 * 2. EXPO_PUBLIC_* env / expo.extra (dev-only; embedded in JS bundle)
 *
 * Production multi-user apps should prefer a server proxy; BYOK is for personal use.
 */
import Constants from 'expo-constants';

import {
  getCachedUserAnthropicApiKey,
  getCachedUserGeminiApiKey,
} from './userApiKeys';

type ExpoExtra = {
  anthropicApiKey?: string;
  geminiApiKey?: string;
};

export type FynApiKeySource = 'user' | 'env' | null;

function getExtra(): ExpoExtra {
  return (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
}

function readPublicEnv(
  envName: 'EXPO_PUBLIC_ANTHROPIC_API_KEY' | 'EXPO_PUBLIC_GEMINI_API_KEY',
  extraKey: keyof ExpoExtra,
): string | undefined {
  const fromProcess = process.env[envName]?.trim();
  if (fromProcess) return fromProcess;

  const fromExtra = getExtra()[extraKey]?.trim();
  return fromExtra || undefined;
}

function resolveKey(
  userKey: string | undefined,
  envKey: string | undefined,
): { key: string | undefined; source: FynApiKeySource } {
  if (userKey) return { key: userKey, source: 'user' };
  if (envKey) return { key: envKey, source: 'env' };
  return { key: undefined, source: null };
}

export function getAnthropicApiKey(): string | undefined {
  return resolveKey(
    getCachedUserAnthropicApiKey(),
    readPublicEnv('EXPO_PUBLIC_ANTHROPIC_API_KEY', 'anthropicApiKey'),
  ).key;
}

export function getGeminiApiKey(): string | undefined {
  return resolveKey(
    getCachedUserGeminiApiKey(),
    readPublicEnv('EXPO_PUBLIC_GEMINI_API_KEY', 'geminiApiKey'),
  ).key;
}

export function getAnthropicApiKeySource(): FynApiKeySource {
  return resolveKey(
    getCachedUserAnthropicApiKey(),
    readPublicEnv('EXPO_PUBLIC_ANTHROPIC_API_KEY', 'anthropicApiKey'),
  ).source;
}

export function getGeminiApiKeySource(): FynApiKeySource {
  return resolveKey(
    getCachedUserGeminiApiKey(),
    readPublicEnv('EXPO_PUBLIC_GEMINI_API_KEY', 'geminiApiKey'),
  ).source;
}

export function isAnthropicApiKeyConfigured(): boolean {
  return Boolean(getAnthropicApiKey());
}

export function isGeminiApiKeyConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

/** Fyn chat — Gemini preferred, Anthropic fallback. */
export function isFynChatApiKeyConfigured(): boolean {
  return isGeminiApiKeyConfigured() || isAnthropicApiKeyConfigured();
}
