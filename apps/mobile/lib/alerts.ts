import { getSetting, setSetting } from '@/lib/db';
import { evaluateAlerts, markAlertRead } from '@/lib/ai/alertService';
import type { AIAlert, AlertCategory } from '@/lib/ai/types';
import {
  ALERT_SECTION_LABELS_REASSURING,
  normalizeAlertDisplayTitle,
  paymentKindFromSourceTitle,
  suppressGenericBudgetOverAlerts,
} from '@/lib/alertPresentation';
import { capAlertsPerType } from '@/lib/alertGuardrails';
import {
  dedupeAlertItemsByIdentity,
  paymentAlertIdentityKey,
  resolveAlertIdentityKey,
  type AlertKindKey,
} from '@/lib/alertIdentity';

export type AlertCenterKind =
  | 'low_funds'
  | 'credit_limit'
  | 'budget_over'
  | 'high_interest_debt'
  | 'plan_adaptation'
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
  /** Linked upcoming payment is a recurring bill (subscriptions, telecom, rent, etc.). */
  recurring?: boolean;
  /** Merchant or label for the payment tied to this alert. */
  paymentName?: string;
  /** Pending plan adaptation — confirm before apply. */
  adaptationProposalId?: string;
  /** Plan id for plan_adaptation alerts. */
  relatedPlanId?: string;
  /** Stable identity (type + entity + period) — two items never share one key. */
  dedupeKey?: string;
};

export const ALERT_SECTION_ORDER: AlertCenterSection[] = ['urgent', 'opportunities'];

export const ALERT_SECTION_LABELS: Record<AlertCenterSection, string> = ALERT_SECTION_LABELS_REASSURING;

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

function aiCategoryToKind(alert: {
  categorie: AlertCategory;
  titre: string;
  adaptationProposalId?: string;
}): AlertCenterKind {
  if (alert.categorie === 'plan' || alert.adaptationProposalId) return 'plan_adaptation';
  if (alert.categorie === 'solde_bas' || alert.categorie === 'fonds_insuffisants') return 'low_funds';
  if (alert.categorie === 'budget') return 'budget_over';
  const lowerTitle = alert.titre.toLowerCase();
  if (
    alert.categorie === 'credit' &&
    (lowerTitle.includes('dette') ||
      lowerTitle.includes('taux élevé') ||
      lowerTitle.includes('prioriser le remboursement'))
  ) {
    return 'high_interest_debt';
  }
  if (alert.categorie === 'credit') return 'credit_limit';
  return 'fyn';
}

export function alertSectionForKind(kind: AlertCenterKind): AlertCenterSection {
  if (kind === 'high_interest_debt' || kind === 'fyn' || kind === 'plan_adaptation') {
    return 'opportunities';
  }
  return 'urgent';
}

/**
 * Payment-sourced Accueil severity.
 * Default **warning** (yellow / à venir). Callers may set `PaymentAlertSource.severity`
 * to `danger` when the risk is already true now (e.g. credit `over_limit`).
 */
export function paymentAlertSeverityFromTitle(_title: string): AlertCenterSeverity {
  return 'warning';
}

export function paymentAlertSeverityForSource(
  source: Pick<PaymentAlertSource, 'title' | 'kind' | 'severity'>,
): AlertCenterSeverity {
  if (source.severity) return source.severity;
  return paymentAlertSeverityFromTitle(source.title);
}

export function paymentAlertKindFromTitle(title: string): AlertCenterKind {
  return paymentKindFromSourceTitle(title);
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
  /** Prefer explicit kind over title heuristics. */
  kind?: AlertCenterKind;
  /**
   * Optional override — `danger` when already critical now (e.g. over limit);
   * omit for default upcoming `warning` (yellow).
   */
  severity?: AlertCenterSeverity;
  /** True when the alert is tied to a recurring bill. */
  recurring?: boolean;
  /** Merchant or label for the payment tied to this alert. */
  paymentName?: string;
};

export async function paymentSourcesToCenterItems(
  sources: PaymentAlertSource[],
): Promise<AlertCenterItem[]> {
  const readFlags = await Promise.all(sources.map((source) => isPaymentAlertRead(source.id)));
  return sources.map((source, index) => {
    const kind = source.kind ?? paymentAlertKindFromTitle(source.title);
    return {
      id: `payment-${source.id}`,
      kind,
      dedupeKey: paymentAlertIdentityKey(kind, source.id),
      section: alertSectionForKind(kind),
      severity: paymentAlertSeverityForSource(source),
      title: normalizeAlertDisplayTitle(source.title),
      message: source.body,
      timestamp: (source.paymentDateRaw ?? new Date()).toISOString(),
      read: readFlags[index] ?? false,
      accountId: source.accountId,
      recurring: source.recurring,
      paymentName: source.paymentName,
    };
  });
}

function aiAlertToCenterItem(alert: AIAlert): AlertCenterItem {
  const kind = aiCategoryToKind(alert);
  return {
    id: `fyn-${alert.id}`,
    kind,
    dedupeKey: resolveAlertIdentityKey(alert),
    section: alertSectionForKind(kind),
    severity: aiSeverityToCenter(alert.type),
    title: normalizeAlertDisplayTitle(alert.titre),
    message: alert.message,
    timestamp: alert.createdAt,
    read: alert.lu,
    accountId: alert.compteReference ?? undefined,
    fynAlertId: alert.id,
    adaptationProposalId: alert.adaptationProposalId,
    relatedPlanId: alert.relatedPlanId,
    montant: alert.montant,
  };
}

export async function loadFynAlertCenterItems(): Promise<AlertCenterItem[]> {
  // evaluateAlerts already runs evaluateAndSurfacePlanAdaptations first.
  const alerts = await evaluateAlerts();
  return suppressGenericBudgetOverAlerts(
    alerts.map(aiAlertToCenterItem).filter((item) => item.kind !== 'high_interest_debt'),
  );
}

/** Single summary row standing in for alerts hidden by the per-type cap. */
function buildAggregateAlertItem(
  kind: AlertCenterKind,
  hidden: AlertCenterItem[],
): AlertCenterItem | null {
  if (hidden.length === 0) return null;
  const newest = hidden.reduce((latest, item) =>
    new Date(item.timestamp).getTime() > new Date(latest.timestamp).getTime() ? item : latest,
  );

  const title =
    kind === 'budget_over'
      ? `${hidden.length} autres enveloppes dépassées`
      : `${hidden.length} autres alertes similaires`;
  const message =
    kind === 'budget_over'
      ? 'Plusieurs enveloppes ont dépassé leur plafond ce mois-ci. Revoir la répartition remet le budget dans le rythme.'
      : 'D’autres alertes du même type attendent. Ouvre la liste complète pour les passer en revue.';

  return {
    id: `aggregate-${kind}`,
    kind,
    dedupeKey: `aggregate:${kind}`,
    section: alertSectionForKind(kind),
    severity: newest.severity,
    title,
    message,
    timestamp: newest.timestamp,
    read: hidden.every((item) => item.read),
  };
}

export async function composeAlertCenterItems(
  paymentSources: PaymentAlertSource[],
): Promise<AlertCenterItem[]> {
  const { filterAlertItemsByPreferences, getAlertTypePreferences, preferenceIdForAlertItem } =
    await import('@/lib/alertTypePreferences');
  const [paymentItems, fynItems, prefs] = await Promise.all([
    paymentSourcesToCenterItems(paymentSources),
    loadFynAlertCenterItems(),
    getAlertTypePreferences(),
  ]);

  // High-interest debt is not an alert/notification — exclude Accueil + « Tout voir ».
  const merged = suppressGenericBudgetOverAlerts(
    filterAlertItemsByPreferences(
      [...paymentItems, ...fynItems].filter((item) => item.kind !== 'high_interest_debt'),
      prefs,
    ),
  );
  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Backstop: even if a generator regresses, one identity yields at most one row.
  const deduped = dedupeAlertItemsByIdentity(merged);

  return capAlertsPerType(deduped, {
    typeOf: (item): AlertKindKey | null => preferenceIdForAlertItem(item),
    aggregate: (_type, hidden) => buildAggregateAlertItem(hidden[0].kind, hidden),
  });
}

/** Compact 24h clock for alert cards (e.g. « 09:00 », « 14:32 »). */
export function formatAlertClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
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

/** Expo Router params for `/alert-detail` (hub + Accueil). */
export function alertDetailRouteParams(item: AlertCenterItem): Record<string, string> {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    message: item.message,
    accountId: item.accountId ?? '',
    montant: item.montant != null ? String(item.montant) : '',
    recurring: item.recurring === true ? '1' : item.recurring === false ? '0' : '',
    paymentName: item.paymentName ?? '',
    adaptationProposalId: item.adaptationProposalId ?? '',
    relatedPlanId: item.relatedPlanId ?? '',
  };
}

/** Hub id for a dashboard payment alert source (`live` → `payment-live`). */
export function paymentAlertCenterId(sourceId: string): string {
  return sourceId.startsWith('payment-') ? sourceId : `payment-${sourceId}`;
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
