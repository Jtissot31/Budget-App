/**
 * Persistent merchant → logo memory backed by `merchant_overrides`.
 *
 * - Demo / catalog merchants are seeded so typing their names reuses known logos.
 * - Custom uploads and discovered remote logos are remembered for later entries.
 * - Manual overrides (`useAutoLogo: false`) are never overwritten by auto-learn.
 */

import {
  getLocalMerchantLogoUri,
  getMerchantLogoUrl,
  normalizeMerchantKey,
  QUEBEC_DEMO_MERCHANT_NAMES,
  KNOWN_MERCHANT_NAMES,
  POPULAR_MERCHANT_LOGO_OPTIONS,
  RECURRING_SERVICE_LOGO_OPTIONS,
  resolveCanonicalMerchantOriginalName,
} from '@/lib/merchantLogo';
import {
  getMerchantOverrides,
  getSetting,
  getTransactions,
  setSetting,
  upsertMerchantOverride,
} from '@/lib/db';
import { dataEvents } from '@/lib/events';
import type { MerchantOverride } from '@/types';

const MEMORY_SEED_SETTING_KEY = 'merchant_logo_memory_seed_v1';

function isHttpLogoUrl(uri: string | null | undefined): boolean {
  const trimmed = uri?.trim() ?? '';
  return /^https?:\/\//i.test(trimmed);
}

/** Skip empty / tiny labels that should not become merchant memory. */
function shouldRememberMerchantName(name: string): boolean {
  const key = normalizeMerchantKey(name);
  return Boolean(key && key.length >= 2);
}

function catalogSeedNames(): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = normalizeMerchantKey(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push(trimmed);
  };

  for (const name of QUEBEC_DEMO_MERCHANT_NAMES) add(name);
  for (const name of KNOWN_MERCHANT_NAMES) add(name);
  for (const option of POPULAR_MERCHANT_LOGO_OPTIONS) add(option.label);
  for (const option of RECURRING_SERVICE_LOGO_OPTIONS) add(option.label);
  return names;
}

/**
 * Logo URI safe to persist:
 * - remote http(s) favicons (stable across restarts)
 * - custom / document file URIs
 * - not bundled asset module URIs (path can change between builds; name resolution covers those)
 */
export function logoUrlForMerchantMemory(merchantName: string, preferredUrl?: string | null): string | null {
  const preferred = preferredUrl?.trim() || null;
  if (preferred) {
    if (isHttpLogoUrl(preferred) || preferred.startsWith('file:') || preferred.startsWith('content:')) {
      return preferred;
    }
  }

  if (getLocalMerchantLogoUri(merchantName)) {
    // Bundled asset — remember by name only; runtime resolves via getMerchantLogoUrls.
    return null;
  }

  const resolved = getMerchantLogoUrl(merchantName);
  return isHttpLogoUrl(resolved) ? resolved : null;
}

export function merchantLabelHasResolvableLogo(
  label: string,
  override?: Pick<MerchantOverride, 'logoUrl' | 'icon' | 'useAutoLogo'> | null,
): boolean {
  if (override?.useAutoLogo === false) {
    return Boolean(override.logoUrl?.trim() || override.icon);
  }
  if (override?.logoUrl?.trim()) return true;
  return getMerchantLogoUrl(label) != null;
}

function buildAutoMemoryRow(
  merchantName: string,
  existing: MerchantOverride | undefined,
  options?: { logoUrl?: string | null; canonicalName?: string },
): MerchantOverride | null {
  const trimmed = merchantName.trim();
  if (!shouldRememberMerchantName(trimmed)) return null;
  if (existing?.hidden) return null;
  if (existing && existing.useAutoLogo === false) return null;

  const logoUrl = logoUrlForMerchantMemory(trimmed, options?.logoUrl ?? existing?.logoUrl ?? null);
  const hasCatalogLogo = getMerchantLogoUrl(trimmed) != null;
  if (!logoUrl && !hasCatalogLogo && !existing) return null;

  const next: MerchantOverride = {
    originalName: existing?.originalName ?? options?.canonicalName?.trim() ?? trimmed,
    displayName: existing?.displayName ?? null,
    logoUrl: logoUrl ?? existing?.logoUrl ?? null,
    icon: existing?.icon ?? null,
    useAutoLogo: true,
    hidden: false,
    updatedAt: new Date().toISOString(),
  };

  if (
    existing &&
    (existing.logoUrl ?? null) === (next.logoUrl ?? null) &&
    existing.useAutoLogo !== false &&
    !existing.hidden
  ) {
    return null;
  }

  return next;
}

/**
 * Persist (or refresh) an auto logo mapping for a merchant name.
 * No-ops when the name is empty, already manually customized, or has nothing to remember.
 */
export async function rememberMerchantLogo(
  merchantName: string,
  options?: {
    logoUrl?: string | null;
    /** Prefer this display / original name when creating a new row. */
    canonicalName?: string;
    emit?: boolean;
    /** Skip DB read when caller already resolved the override. */
    existing?: MerchantOverride | null;
  },
): Promise<boolean> {
  const trimmed = merchantName.trim();
  if (!shouldRememberMerchantName(trimmed)) return false;

  const key = normalizeMerchantKey(trimmed);
  const existing =
    options?.existing === undefined
      ? (await getMerchantOverrides()).find((row) => normalizeMerchantKey(row.originalName) === key)
      : options.existing ?? undefined;

  const next = buildAutoMemoryRow(trimmed, existing, options);
  if (!next) return false;

  await upsertMerchantOverride(next, { emit: options?.emit !== false });
  return true;
}

/** Seed catalog + transaction merchants into logo memory (idempotent). */
export async function ensureMerchantLogoMemory(): Promise<void> {
  const alreadySeeded = (await getSetting(MEMORY_SEED_SETTING_KEY, '')) === '1';
  const overrides = await getMerchantOverrides();
  const overrideByKey = new Map(
    overrides.map((row) => [normalizeMerchantKey(row.originalName), row] as const),
  );

  const transactions = await getTransactions();
  const transactionLabels = transactions
    .filter((tx) => tx.type === 'expense')
    .map((tx) => tx.label);

  /** Normalized key → preferred display / original name. */
  const namesByKey = new Map<string, string>();
  const consider = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = normalizeMerchantKey(trimmed);
    if (!key || namesByKey.has(key)) return;
    namesByKey.set(key, trimmed);
  };

  for (const name of catalogSeedNames()) consider(name);
  for (const label of transactionLabels) {
    if (getMerchantLogoUrl(label)) consider(label);
  }

  let wrote = false;
  for (const [key, name] of namesByKey) {
    const existing = overrideByKey.get(key);
    if (existing?.useAutoLogo === false || existing?.hidden) continue;

    const canonical =
      existing?.originalName ??
      resolveCanonicalMerchantOriginalName(name, transactionLabels);

    const next = buildAutoMemoryRow(canonical, existing, { canonicalName: canonical });
    if (!next) continue;

    await upsertMerchantOverride(next, { emit: false });
    overrideByKey.set(key, next);
    wrote = true;
  }

  if (!alreadySeeded) {
    await setSetting(MEMORY_SEED_SETTING_KEY, '1', { emit: false });
  }
  if (wrote) {
    dataEvents.emit();
  }
}
