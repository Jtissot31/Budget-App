import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AIAlert } from '@/lib/ai/types';
import { alertKindKeyForAiAlert } from '@/lib/alertIdentity';
import type { AlertCenterItem, AlertCenterKind, AlertCenterSeverity } from '@/lib/alerts';
import { dataEvents } from '@/lib/events';

const STORAGE_KEY = 'alert_type_preferences_v1';

/**
 * User-facing alert types that can be enabled/disabled.
 * Maps to generated payment + Fyn/evaluate alert kinds.
 */
export const ALERT_TYPE_PREFERENCE_IDS = [
  'credit_limit',
  'low_funds',
  'balance_low',
  'budget_over',
  'plan_adaptation',
  'fyn',
] as const;

export type AlertTypePreferenceId = (typeof ALERT_TYPE_PREFERENCE_IDS)[number];

export type AlertTypePreferences = Record<AlertTypePreferenceId, boolean>;

export const ALERT_TYPE_PREFERENCE_LABELS: Record<AlertTypePreferenceId, string> = {
  credit_limit: 'Alerte marge insuffisante',
  low_funds: 'Alerte solde insuffisant',
  balance_low: 'Alerte solde bas',
  budget_over: 'Alerte budget dépassé',
  plan_adaptation: 'Alerte adaptation de plan',
  fyn: 'Autres alertes Fyn',
};

/**
 * When each type actually fires — mirrors the generators
 * (`buildPaymentAlertSources`, `evaluateAlerts`, `evaluateAndSurfacePlanAdaptations`).
 */
const ALERT_TYPE_PREFERENCE_TRIGGERS: Record<AlertTypePreferenceId, string> = {
  credit_limit:
    'Quand un paiement à venir sur une carte de crédit dépasserait la limite, ou laisserait moins de 10 % de marge libre.',
  low_funds:
    'Quand le solde du compte ne couvre pas un paiement récurrent à venir — le manque tient compte de ton prochain dépôt de paie.',
  balance_low:
    'Quand un compte chèque visible descend sous 200 $, même sans paiement imminent.',
  budget_over:
    'Quand les dépenses d’une enveloppe dépassent son plafond pour le mois en cours.',
  plan_adaptation:
    'Quand Fyn repère un ajustement utile sur un plan actif (cadence, objectif, extra, plafond) — rien n’est appliqué avant ta confirmation.',
  fyn: 'Les autres messages de Fyn : conseils et suivis qui n’entrent dans aucune catégorie ci-dessus.',
};

/** Messages/Accueil item kind each type produces — used for icon, accent and section. */
const ALERT_TYPE_PREFERENCE_KINDS: Record<AlertTypePreferenceId, AlertCenterKind> = {
  credit_limit: 'credit_limit',
  low_funds: 'low_funds',
  balance_low: 'low_funds',
  budget_over: 'budget_over',
  plan_adaptation: 'plan_adaptation',
  fyn: 'fyn',
};

/**
 * Severity the generators assign for Accueil triangle tint:
 * - danger (rouge) — déjà vrai maintenant (budget dépassé, solde bas, over-limit)
 * - warning (jaune) — risque à venir (paiement / marge future)
 * - info — non stress (plan / Fyn)
 */
const ALERT_TYPE_PREFERENCE_SEVERITIES: Record<AlertTypePreferenceId, AlertCenterSeverity> = {
  credit_limit: 'warning',
  low_funds: 'warning',
  balance_low: 'danger',
  budget_over: 'danger',
  plan_adaptation: 'info',
  fyn: 'info',
};

export type AlertTypeCatalogEntry = {
  id: AlertTypePreferenceId;
  label: string;
  trigger: string;
  kind: AlertCenterKind;
  severity: AlertCenterSeverity;
};

/** Every alert type the app can send — single source for « Types d’alertes ». */
export const ALERT_TYPE_CATALOG: AlertTypeCatalogEntry[] = ALERT_TYPE_PREFERENCE_IDS.map((id) => ({
  id,
  label: ALERT_TYPE_PREFERENCE_LABELS[id],
  trigger: ALERT_TYPE_PREFERENCE_TRIGGERS[id],
  kind: ALERT_TYPE_PREFERENCE_KINDS[id],
  severity: ALERT_TYPE_PREFERENCE_SEVERITIES[id],
}));

export function defaultAlertTypePreferences(): AlertTypePreferences {
  return {
    credit_limit: true,
    low_funds: true,
    balance_low: true,
    budget_over: true,
    plan_adaptation: true,
    fyn: true,
  };
}

function normalizePreferences(raw: unknown): AlertTypePreferences {
  const defaults = defaultAlertTypePreferences();
  if (!raw || typeof raw !== 'object') return defaults;
  const next = { ...defaults };
  for (const id of ALERT_TYPE_PREFERENCE_IDS) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === 'boolean') next[id] = value;
  }
  return next;
}

export async function getAlertTypePreferences(): Promise<AlertTypePreferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAlertTypePreferences();
    return normalizePreferences(JSON.parse(raw) as unknown);
  } catch {
    return defaultAlertTypePreferences();
  }
}

export async function setAlertTypePreferences(
  prefs: AlertTypePreferences,
): Promise<AlertTypePreferences> {
  const next = normalizePreferences(prefs);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  dataEvents.emit();
  return next;
}

export async function setAlertTypePreference(
  id: AlertTypePreferenceId,
  enabled: boolean,
): Promise<AlertTypePreferences> {
  const current = await getAlertTypePreferences();
  return setAlertTypePreferences({ ...current, [id]: enabled });
}

export function isAlertTypeEnabled(
  prefs: AlertTypePreferences,
  id: AlertTypePreferenceId,
): boolean {
  return prefs[id] !== false;
}

/** Map a Messages / Accueil item to a preference id (null = always hidden). */
export function preferenceIdForAlertItem(
  item: Pick<AlertCenterItem, 'id' | 'kind'>,
): AlertTypePreferenceId | null {
  return preferenceIdForKind(item.kind, item.id.startsWith('payment-'));
}

export function preferenceIdForKind(
  kind: AlertCenterKind,
  fromPaymentSource: boolean,
): AlertTypePreferenceId | null {
  switch (kind) {
    case 'credit_limit':
      return 'credit_limit';
    case 'budget_over':
      return 'budget_over';
    case 'plan_adaptation':
      return 'plan_adaptation';
    case 'fyn':
      return 'fyn';
    case 'high_interest_debt':
      return null;
    case 'low_funds':
      // Payment « solde insuffisant » vs Fyn « solde bas » (threshold).
      return fromPaymentSource ? 'low_funds' : 'balance_low';
    default:
      return 'fyn';
  }
}

/** Map a persisted AI alert to a preference id. */
export function preferenceIdForAiAlert(
  alert: Pick<AIAlert, 'categorie' | 'adaptationProposalId'>,
): AlertTypePreferenceId {
  const kind = alertKindKeyForAiAlert(alert);
  return kind === 'other' ? 'fyn' : kind;
}

export function filterAlertItemsByPreferences<T extends Pick<AlertCenterItem, 'id' | 'kind'>>(
  items: T[],
  prefs: AlertTypePreferences,
): T[] {
  return items.filter((item) => {
    const id = preferenceIdForAlertItem(item);
    if (id == null) return false;
    return isAlertTypeEnabled(prefs, id);
  });
}

export function filterAiAlertsByPreferences(
  alerts: AIAlert[],
  prefs: AlertTypePreferences,
): AIAlert[] {
  return alerts.filter((alert) =>
    isAlertTypeEnabled(prefs, preferenceIdForAiAlert(alert)),
  );
}
