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
