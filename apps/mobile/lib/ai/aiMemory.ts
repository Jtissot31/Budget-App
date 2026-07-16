/**
 * Lightweight local AI memory — encrypted AsyncStorage, never leaves the device.
 * Recent insights, alert views, and plan adaptations feed back into Gemini prompts.
 */
import { loadEncryptedJson, saveEncryptedJson } from './encryptedStorage';

const MEMORY_STORAGE_KEY = 'bt_ai_memory_v1';
const MAX_ENTRIES = 30;

export type AIMemoryEntryType = 'insight' | 'alert_resolution' | 'plan_adaptation';

export type AIMemoryEntry = {
  id: string;
  type: AIMemoryEntryType;
  /** Short French summary for prompt context (≤120 chars). */
  summary: string;
  createdAt: string;
  context?: Record<string, string | number | boolean | null>;
};

async function loadMemoryEntries(): Promise<AIMemoryEntry[]> {
  return (await loadEncryptedJson<AIMemoryEntry[]>(MEMORY_STORAGE_KEY)) ?? [];
}

export async function loadAIMemory(): Promise<AIMemoryEntry[]> {
  const entries = await loadMemoryEntries();
  return [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export async function appendAIMemory(
  entry: Omit<AIMemoryEntry, 'id' | 'createdAt'>,
): Promise<void> {
  const existing = await loadMemoryEntries();
  const next: AIMemoryEntry = {
    ...entry,
    id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    summary: entry.summary.slice(0, 120),
  };
  const merged = [next, ...existing].slice(0, MAX_ENTRIES);
  await saveEncryptedJson(MEMORY_STORAGE_KEY, merged);
}

/** Compact bullet list for Gemini system context. */
export function formatMemoryForPrompt(entries: AIMemoryEntry[], limit = 8): string {
  if (entries.length === 0) return '';

  const recent = entries.slice(0, limit);
  const lines = recent.map((entry) => {
    const ctx = entry.context
      ? ` (${Object.entries(entry.context)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')})`
      : '';
    return `- [${entry.type}] ${entry.summary}${ctx}`;
  });

  return ['Contexte utilisateur antérieur :', ...lines].join('\n');
}
