/**
 * Public env keys (EXPO_PUBLIC_*) are embedded in the JS bundle — dev-only for API keys.
 * Production should use a server proxy; never commit .env or ship shared EAS secrets widely.
 */
import Constants from 'expo-constants';

type ExpoExtra = {
  anthropicApiKey?: string;
  geminiApiKey?: string;
};

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

export function getAnthropicApiKey(): string | undefined {
  return readPublicEnv('EXPO_PUBLIC_ANTHROPIC_API_KEY', 'anthropicApiKey');
}

export function getGeminiApiKey(): string | undefined {
  return readPublicEnv('EXPO_PUBLIC_GEMINI_API_KEY', 'geminiApiKey');
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
