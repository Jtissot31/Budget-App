import type { LucideIcon } from 'lucide-react-native';

export type LucideCatalogEntry = {
  name: string;
  Icon: LucideIcon;
};

function isRenderableLucideIcon(icon: unknown): icon is LucideIcon {
  if (icon == null) return false;
  if (typeof icon === 'function') return true;
  if (typeof icon === 'object') {
    return '$$typeof' in icon || 'render' in icon;
  }
  return false;
}

/** Unwrap CJS default export and accept forwardRef exotic components. */
export function resolveLucideIcon(icon: unknown): LucideIcon | null {
  let candidate: unknown = icon;

  if (candidate != null && typeof candidate === 'object' && 'default' in candidate) {
    candidate = (candidate as { default: unknown }).default;
  }

  return isRenderableLucideIcon(candidate) ? candidate : null;
}

function normalizeCatalogEntry(entry: LucideCatalogEntry): LucideCatalogEntry | null {
  const Icon = resolveLucideIcon(entry.Icon);
  if (!Icon) return null;
  return { name: entry.name, Icon };
}

/** Loads the full generated catalog on demand (keeps the main bundle light). */
export async function loadLucideIconCatalog(): Promise<LucideCatalogEntry[]> {
  const module = await import('@/lib/lucideIconCatalog.generated');
  return module.LUCIDE_ICON_CATALOG.map(normalizeCatalogEntry).filter(
    (entry): entry is LucideCatalogEntry => entry != null,
  );
}
