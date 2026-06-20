import { getSetting, setSetting } from '@/lib/db';

const TRANSFER_REASON_SUGGESTIONS_KEY = 'transfer_reason_suggestions';

export const DEFAULT_TRANSFER_REASONS = [
  'Travail',
  'Remboursement',
  'Don',
  'Cadeau',
  'Partage',
  'Loyer',
  'Épargne',
  'Prêt',
] as const;

function parseCustomSuggestions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

function normalizeReasonKey(reason: string): string {
  return reason.trim().toLowerCase();
}

function mergeTransferReasonSuggestions(custom: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const reason of [...DEFAULT_TRANSFER_REASONS, ...custom]) {
    const trimmed = reason.trim();
    const key = normalizeReasonKey(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }

  return merged;
}

export async function getTransferReasonSuggestions(): Promise<string[]> {
  const raw = await getSetting(TRANSFER_REASON_SUGGESTIONS_KEY, '[]');
  return mergeTransferReasonSuggestions(parseCustomSuggestions(raw));
}

export async function saveTransferReasonSuggestion(reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) return;

  const isDefault = DEFAULT_TRANSFER_REASONS.some(
    (preset) => normalizeReasonKey(preset) === normalizeReasonKey(trimmed),
  );
  if (isDefault) return;

  const raw = await getSetting(TRANSFER_REASON_SUGGESTIONS_KEY, '[]');
  const custom = parseCustomSuggestions(raw);
  const key = normalizeReasonKey(trimmed);
  if (custom.some((item) => normalizeReasonKey(item) === key)) return;

  await setSetting(TRANSFER_REASON_SUGGESTIONS_KEY, JSON.stringify([...custom, trimmed]));
}
