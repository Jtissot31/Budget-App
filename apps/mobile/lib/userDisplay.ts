import { getSetting, setSetting } from '@/lib/db';

const KEY = 'user_display_name';
const DEFAULT_DISPLAY_NAME = 'Jérémie';

/** Reject empty / numeric seed-version leaks (e.g. `"1"`) so the greeting stays human. */
function sanitizeDisplayName(raw: string, fallback: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  if (/^\d+$/.test(trimmed)) return fallback;
  return trimmed;
}

export async function getUserDisplayName(): Promise<string> {
  const stored = await getSetting(KEY, DEFAULT_DISPLAY_NAME);
  return sanitizeDisplayName(stored, DEFAULT_DISPLAY_NAME);
}

/** Persist greeting name (onboarding / profil). Empty or numeric values are ignored. */
export async function setUserDisplayName(name: string): Promise<string> {
  const sanitized = sanitizeDisplayName(name, '');
  if (!sanitized) {
    return getUserDisplayName();
  }
  await setSetting(KEY, sanitized, { emit: false });
  return sanitized;
}
