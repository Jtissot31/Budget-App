import { getApiBaseUrl } from '@/lib/settings';
import { inferCategoryForItem, normalizeSearch } from '@/lib/categoryInference';
import type { ItemizedNote } from '@/lib/itemizedNote';
import type { Category } from '@/types';

export type ScannedReceiptItem = {
  name: string;
  price: number;
  categoryId?: string | null;
  categoryName?: string | null;
};

export type ReceiptScanResult = {
  merchant?: string;
  items: ScannedReceiptItem[];
  total: number;
  rawText?: string;
  source: 'api' | 'text' | 'heuristic';
};

const RECEIPT_LINE =
  /^(?<name>[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s'&./-]{1,48}?)\s+(?<price>\d{1,4}[.,]\d{2})\s*(?:\$|CAD)?$/i;

const RECEIPT_LINE_REVERSED =
  /^(?<price>\d{1,4}[.,]\d{2})\s*(?:\$|CAD)?\s+(?<name>[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s'&./-]{1,48})$/i;

const SKIP_LINE =
  /^(total|sous-total|subtotal|taxe|tps|tvq|gst|hst|balance|montant|visa|mastercard|debit|credit|merci|thank|change|caisse|date|heure)/i;

const MERCHANT_TEMPLATES: Record<string, string[]> = {
  grocery: ['Lait 2%', 'Pain multigrains', 'Oeufs', 'Bananes', 'Fromage'],
  restaurant: ['Plat principal', 'Boisson', 'Dessert', 'Pourboire'],
  coffee: ['Café', 'Muffin', 'Eau'],
  gas: ['Essence régulière'],
  pharmacy: ['Médicament', 'Vitamines', 'Soins personnels'],
  default: ['Article 1', 'Article 2', 'Article 3'],
};

function parsePrice(raw: string): number {
  const parsed = parseFloat(raw.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseReceiptText(text: string): ScannedReceiptItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: ScannedReceiptItem[] = [];

  for (const line of lines) {
    if (SKIP_LINE.test(line)) continue;

    const forward = line.match(RECEIPT_LINE);
    if (forward?.groups) {
      items.push({
        name: forward.groups.name.trim(),
        price: parsePrice(forward.groups.price),
      });
      continue;
    }

    const reversed = line.match(RECEIPT_LINE_REVERSED);
    if (reversed?.groups) {
      items.push({
        name: reversed.groups.name.trim(),
        price: parsePrice(reversed.groups.price),
      });
    }
  }

  return items.filter((item) => item.name.length > 1 && item.price > 0);
}

function detectTemplateKey(merchant?: string): keyof typeof MERCHANT_TEMPLATES {
  const normalized = normalizeSearch(merchant ?? '');
  if (!normalized) return 'default';
  if (['metro', 'iga', 'provigo', 'maxi', 'costco', 'walmart', 'epicerie', 'super c'].some((term) => normalized.includes(term))) {
    return 'grocery';
  }
  if (['starbucks', 'tim hortons', 'cafe', 'restaurant', 'mcdonald', 'subway', 'pizza'].some((term) => normalized.includes(term))) {
    return normalized.includes('starbucks') || normalized.includes('cafe') || normalized.includes('tim') ? 'coffee' : 'restaurant';
  }
  if (['shell', 'esso', 'petro', 'essence', 'gas'].some((term) => normalized.includes(term))) {
    return 'gas';
  }
  if (['pharmaprix', 'jean coutu', 'pharmacie'].some((term) => normalized.includes(term))) {
    return 'pharmacy';
  }
  return 'default';
}

function splitTotalAcrossItems(total: number, labels: string[]): ScannedReceiptItem[] {
  if (labels.length === 0 || total <= 0) return [];

  const weights = labels.map((_, index) => 1 + (index === 0 ? 0.6 : 0));
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let allocated = 0;

  return labels.map((name, index) => {
    if (index === labels.length - 1) {
      return { name, price: roundMoney(Math.max(total - allocated, 0.01)) };
    }
    const price = roundMoney((total * weights[index]) / weightSum);
    allocated += price;
    return { name, price };
  });
}

export function generateHeuristicReceiptItems(merchant: string | undefined, total: number): ScannedReceiptItem[] {
  const templateKey = detectTemplateKey(merchant);
  const labels = MERCHANT_TEMPLATES[templateKey];
  if (templateKey === 'gas' || total <= 0) {
    return [{ name: labels[0], price: roundMoney(total) }];
  }
  const count = total >= 80 ? Math.min(labels.length, 4) : total >= 35 ? Math.min(labels.length, 3) : Math.min(labels.length, 2);
  return splitTotalAcrossItems(total, labels.slice(0, count));
}

export function mapScannedItemsToCategories(
  items: ScannedReceiptItem[],
  categories: Category[],
  merchantHint?: string,
): ItemizedNote[] {
  return items.map((item) => {
    const category = inferCategoryForItem(item.name, categories, merchantHint);
    return {
      name: item.name,
      price: item.price,
      categoryId: category?.id ?? item.categoryId ?? null,
      categoryName: category?.name ?? item.categoryName ?? null,
    };
  });
}

async function tryReceiptScanApi(imageUri: string): Promise<ReceiptScanResult | null> {
  try {
    const base = await getApiBaseUrl();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${base}/api/receipts/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUri }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const payload = (await res.json()) as {
      merchant?: string;
      items?: ScannedReceiptItem[];
      rawText?: string;
      total?: number;
    };

    if (!Array.isArray(payload.items) || payload.items.length === 0) return null;

    const items = payload.items
      .filter((item) => item?.name && Number(item.price) > 0)
      .map((item) => ({
        name: String(item.name).trim(),
        price: roundMoney(Number(item.price)),
        categoryId: item.categoryId ?? null,
        categoryName: item.categoryName ?? null,
      }));

    if (items.length === 0) return null;

    return {
      merchant: payload.merchant,
      items,
      total: roundMoney(payload.total ?? items.reduce((sum, item) => sum + item.price, 0)),
      rawText: payload.rawText,
      source: 'api',
    };
  } catch {
    return null;
  }
}

export async function scanReceiptImage(
  imageUri: string,
  options: {
    merchantHint?: string;
    totalHint?: number;
    rawText?: string;
  } = {},
): Promise<ReceiptScanResult> {
  if (options.rawText?.trim()) {
    const parsed = parseReceiptText(options.rawText);
    if (parsed.length > 0) {
      return {
        merchant: options.merchantHint,
        items: parsed,
        total: roundMoney(parsed.reduce((sum, item) => sum + item.price, 0)),
        rawText: options.rawText,
        source: 'text',
      };
    }
  }

  const apiResult = await tryReceiptScanApi(imageUri);
  if (apiResult) return apiResult;

  const total = options.totalHint && options.totalHint > 0 ? options.totalHint : 0;
  const items =
    total > 0
      ? generateHeuristicReceiptItems(options.merchantHint, total)
      : [{ name: 'Article scanné', price: 0 }];

  return {
    merchant: options.merchantHint,
    items,
    total: roundMoney(total || items.reduce((sum, item) => sum + item.price, 0)),
    source: 'heuristic',
  };
}

export function serializeScanItemsForRoute(items: ItemizedNote[]): string {
  return JSON.stringify(
    items.map((item) => ({
      name: item.name,
      price: item.price,
      categoryId: item.categoryId ?? null,
      categoryName: item.categoryName ?? null,
    })),
  );
}

export function parseScanItemsFromRoute(raw?: string): ItemizedNote[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): ItemizedNote[] => {
      if (!entry || typeof entry !== 'object') return [];
      const record = entry as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const price = typeof record.price === 'number' ? record.price : Number(record.price);
      if (!name || !Number.isFinite(price)) return [];
      return [{
        name,
        price: roundMoney(price),
        categoryId: typeof record.categoryId === 'string' ? record.categoryId : null,
        categoryName: typeof record.categoryName === 'string' ? record.categoryName : null,
      }];
    });
  } catch {
    return [];
  }
}
