import { getSetting, setSetting } from '@/lib/db';
import { evaluateAlerts, markAlertRead } from '@/lib/ai/alertService';
import type { AIAlert, AlertCategory } from '@/lib/ai/types';

export type AlertCenterKind =
  | 'low_funds'
  | 'credit_limit'
  | 'budget_over'
  | 'high_interest_debt'
  | 'fyn';

export type AlertCenterSection = 'urgent' | 'opportunities';

export type AlertCenterSeverity = 'danger' | 'warning' | 'info' | 'success';

export type AlertCenterItem = {
  id: string;
  kind: AlertCenterKind;
  section: AlertCenterSection;
  severity: AlertCenterSeverity;
  title: string;
  message: string;
  /** ISO timestamp used for sorting and display. */
  timestamp: string;
  read: boolean;
  accountId?: string;
  /** Present for Fyn-backed alerts — used with `markAlertRead`. */
  fynAlertId?: string;
  /** Optional numeric amount from Fyn alerts. */
  montant?: number | null;
};

export const ALERT_SECTION_ORDER: AlertCenterSection[] = ['urgent', 'opportunities'];

export const ALERT_SECTION_LABELS: Record<AlertCenterSection, string> = {
  urgent: 'URGENT',
  opportunities: 'OPPORTUNITÉS',
};

const PAYMENT_READ_KEY = (id: string) => `alert_center_read_${id}`;

export async function isPaymentAlertRead(id: string): Promise<boolean> {
  return (await getSetting(PAYMENT_READ_KEY(id), '')) === '1';
}

export async function markPaymentAlertRead(id: string): Promise<void> {
  await setSetting(PAYMENT_READ_KEY(id), '1');
}

function aiSeverityToCenter(type: AIAlert['type']): AlertCenterSeverity {
  if (type === 'critique') return 'danger';
  if (type === 'attention') return 'warning';
  return 'info';
}

function aiCategoryToKind(alert: { categorie: AlertCategory; titre: string }): AlertCenterKind {
  if (alert.categorie === 'solde_bas' || alert.categorie === 'fonds_insuffisants') return 'low_funds';
  if (alert.categorie === 'budget') return 'budget_over';
  const lowerTitle = alert.titre.toLowerCase();
  if (alert.categorie === 'credit' && lowerTitle.includes('dette')) return 'high_interest_debt';
  if (alert.categorie === 'credit') return 'credit_limit';
  return 'fyn';
}

export function alertSectionForKind(kind: AlertCenterKind): AlertCenterSection {
  if (kind === 'high_interest_debt' || kind === 'fyn') return 'opportunities';
  return 'urgent';
}

export function paymentAlertSeverityFromTitle(title: string): AlertCenterSeverity {
  const lower = title.toLowerCase();
  if (lower.includes('limite') || lower.includes('crédit') || lower.includes('credit')) {
    return 'danger';
  }
  return 'warning';
}

export function paymentAlertKindFromTitle(title: string): AlertCenterKind {
  const lower = title.toLowerCase();
  if (lower.includes('limite') || lower.includes('crédit') || lower.includes('credit')) {
    return 'credit_limit';
  }
  if (lower.includes('budget')) return 'budget_over';
  return 'low_funds';
}

export function groupAlertCenterItems(
  items: AlertCenterItem[],
): { section: AlertCenterSection; items: AlertCenterItem[] }[] {
  const buckets = new Map<AlertCenterSection, AlertCenterItem[]>();
  for (const section of ALERT_SECTION_ORDER) {
    buckets.set(section, []);
  }
  for (const item of items) {
    buckets.get(item.section)?.push(item);
  }
  return ALERT_SECTION_ORDER.map((section) => ({
    section,
    items: buckets.get(section) ?? [],
  })).filter((group) => group.items.length > 0);
}

export type PaymentAlertSource = {
  id: string;
  title: string;
  body: string;
  dateLabel: string;
  paymentDateRaw?: Date;
  accountId?: string;
};

export async function paymentSourcesToCenterItems(
  sources: PaymentAlertSource[],
): Promise<AlertCenterItem[]> {
  const readFlags = await Promise.all(sources.map((source) => isPaymentAlertRead(source.id)));
  return sources.map((source, index) => {
    const kind = paymentAlertKindFromTitle(source.title);
    return {
      id: `payment-${source.id}`,
      kind,
      section: alertSectionForKind(kind),
      severity: paymentAlertSeverityFromTitle(source.title),
      title: source.title,
      message: source.body,
      timestamp: (source.paymentDateRaw ?? new Date()).toISOString(),
      read: readFlags[index] ?? false,
      accountId: source.accountId,
    };
  });
}

function aiAlertToCenterItem(alert: AIAlert): AlertCenterItem {
  const kind = aiCategoryToKind(alert);
  return {
    id: `fyn-${alert.id}`,
    kind,
    section: alertSectionForKind(kind),
    severity: aiSeverityToCenter(alert.type),
    title: alert.titre,
    message: alert.message,
    timestamp: alert.createdAt,
    read: alert.lu,
    accountId: alert.compteReference ?? undefined,
    fynAlertId: alert.id,
    montant: alert.montant,
  };
}

export async function loadFynAlertCenterItems(): Promise<AlertCenterItem[]> {
  const alerts = await evaluateAlerts();
  return alerts.map(aiAlertToCenterItem);
}

export async function composeAlertCenterItems(
  paymentSources: PaymentAlertSource[],
): Promise<AlertCenterItem[]> {
  const [paymentItems, fynItems] = await Promise.all([
    paymentSourcesToCenterItems(paymentSources),
    loadFynAlertCenterItems(),
  ]);

  const merged = [...paymentItems, ...fynItems];
  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return merged;
}

export function countUnreadAlerts(items: AlertCenterItem[]): number {
  return items.filter((item) => !item.read).length;
}

export async function markAlertCenterItemRead(item: AlertCenterItem): Promise<void> {
  if (item.fynAlertId) {
    await markAlertRead(item.fynAlertId);
    return;
  }
  const paymentId = item.id.startsWith('payment-') ? item.id.slice('payment-'.length) : item.id;
  await markPaymentAlertRead(paymentId);
}

export function formatAlertCenterTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (diffMinutes < 1) return "À l'instant";
  if (dayDiff === 0 && diffHours < 24) {
    if (diffHours < 1) return `Il y a ${Math.max(1, diffMinutes)} min`;
    return `Il y a ${diffHours} h`;
  }
  if (dayDiff === 1) return 'Hier';
  if (dayDiff < 7) return `Il y a ${dayDiff} j`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
