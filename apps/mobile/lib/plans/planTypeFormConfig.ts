/**
 * Source de vérité **par type de plan** pour le formulaire de création
 * (`app/plans/create.tsx`) et l'écran de progression
 * (`components/plans/PlanDetailScreen.tsx` via `planDashboardAdapter`).
 *
 * Le formulaire et la progression partagent cette configuration : les champs,
 * libellés (FR), cadences, validations et métriques restent cohérents par
 * construction avec le type sélectionné.
 */

import type { DashboardPlanMetric } from '@/lib/dashboardPlansMock';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { formatFriendlyDateLabel } from '@/lib/formatFriendlyDateLabel';
import { formatDebtFreeDuration } from './debtPayoffMath';
import {
  PLAN_SUBTYPE_LABELS,
  planCategoryForSubtype,
  planEtapesCompletees,
  planProgressionPourcent,
  planSubtypeSansMontantCible,
  type PlanActifOuTermine,
  type PlanCategory,
  type PlanParametres,
  type PlanSubtype,
} from './Plan';

export { usesDebtPayoffWizard } from './debtPlanCandidates';
export type { DebtPlanCandidate } from './debtPlanCandidates';

// ─── Descripteurs de champ ──────────────────────────────────────────────────

export type PlanFieldKind = 'money' | 'percent' | 'integer' | 'account' | 'cadence' | 'date';

export type PlanFieldKey =
  | 'montant_cible'
  | 'compte_lie'
  | 'cadence'
  | 'date_cible'
  | 'solde_initial'
  | 'taux_interet'
  | 'paiement_mensuel'
  | 'budget_mensuel'
  | 'duree_jours'
  | 'pourcentage_reserve';

export type PlanCadenceOption = {
  id: string;
  label: string;
  /** Suffixe injecté dans le libellé de cadence (« 150 $ / semaine »). */
  suffix: string;
};

export type PlanFormField = {
  key: PlanFieldKey;
  kind: PlanFieldKind;
  /** Libellé eyebrow (FR, majuscules). */
  label: string;
  placeholder?: string;
  required: boolean;
  cadenceOptions?: readonly PlanCadenceOption[];
  defaultCadenceId?: string;
  defaultAmount?: string;
};

export type PlanTypeFormConfig = {
  fields: readonly PlanFormField[];
};

// ─── Cadences réutilisables ─────────────────────────────────────────────────

const CADENCE_HEBDO_MENSUEL: readonly PlanCadenceOption[] = [
  { id: 'week', label: 'Semaine', suffix: 'semaine' },
  { id: 'month', label: 'Mois', suffix: 'mois' },
];

const CADENCE_MENSUEL_ANNUEL: readonly PlanCadenceOption[] = [
  { id: 'month', label: 'Mois', suffix: 'mois' },
  { id: 'year', label: 'Année', suffix: 'année' },
];

// ─── Champs par catégorie ───────────────────────────────────────────────────

const CATEGORY_FIELDS: Record<PlanCategory, readonly PlanFormField[]> = {
  epargne: [
    { key: 'montant_cible', kind: 'money', label: 'MONTANT CIBLE', placeholder: 'Ex. 10 000', required: true },
    { key: 'compte_lie', kind: 'account', label: 'COMPTE LIÉ', required: true },
    {
      key: 'cadence',
      kind: 'cadence',
      label: 'CADENCE',
      required: true,
      cadenceOptions: CADENCE_HEBDO_MENSUEL,
      defaultCadenceId: 'week',
      defaultAmount: '150',
    },
    { key: 'date_cible', kind: 'date', label: 'DATE CIBLE', required: false },
  ],
  investissement: [
    { key: 'montant_cible', kind: 'money', label: 'OBJECTIF DE COTISATION', placeholder: 'Ex. 7 000', required: true },
    { key: 'compte_lie', kind: 'account', label: 'COMPTE ENREGISTRÉ', required: true },
    {
      key: 'cadence',
      kind: 'cadence',
      label: 'COTISATION',
      required: true,
      cadenceOptions: CADENCE_MENSUEL_ANNUEL,
      defaultCadenceId: 'month',
      defaultAmount: '300',
    },
    { key: 'date_cible', kind: 'date', label: 'DATE CIBLE', required: false },
  ],
  dette: [
    { key: 'solde_initial', kind: 'money', label: 'SOLDE ACTUEL', placeholder: 'Ex. 8 400', required: true },
    { key: 'taux_interet', kind: 'percent', label: "TAUX D'INTÉRÊT (%)", placeholder: 'Ex. 19,99', required: false },
    { key: 'paiement_mensuel', kind: 'money', label: 'PAIEMENT MENSUEL', placeholder: 'Ex. 420', required: true },
    { key: 'compte_lie', kind: 'account', label: 'DETTE / COMPTE LIÉ', required: false },
    { key: 'date_cible', kind: 'date', label: 'DATE CIBLE', required: false },
  ],
  budget: [
    { key: 'budget_mensuel', kind: 'money', label: 'BUDGET MENSUEL', placeholder: 'Ex. 4 000', required: true },
    { key: 'compte_lie', kind: 'account', label: 'COMPTES SUIVIS', required: false },
  ],
  fiscal: [
    { key: 'montant_cible', kind: 'money', label: 'MONTANT À RÉSERVER', placeholder: 'Ex. 6 000', required: true },
    { key: 'pourcentage_reserve', kind: 'percent', label: '% DE CHAQUE ENTRÉE', placeholder: 'Ex. 25', required: false },
    { key: 'compte_lie', kind: 'account', label: 'COMPTE DE RÉSERVE', required: false },
    { key: 'date_cible', kind: 'date', label: 'ÉCHÉANCE', required: false },
  ],
  risque: [
    { key: 'montant_cible', kind: 'money', label: 'MONTANT CIBLE', placeholder: 'Ex. 2 000', required: true },
    { key: 'compte_lie', kind: 'account', label: 'COMPTE LIÉ', required: false },
    {
      key: 'cadence',
      kind: 'cadence',
      label: 'CADENCE',
      required: false,
      cadenceOptions: CADENCE_HEBDO_MENSUEL,
      defaultCadenceId: 'month',
      defaultAmount: '100',
    },
    { key: 'date_cible', kind: 'date', label: 'DATE CIBLE', required: false },
  ],
  comportemental: [{ key: 'date_cible', kind: 'date', label: 'DATE DE DÉBUT', required: false }],
};

// ─── Surcharges par sous-type ───────────────────────────────────────────────

const SUBTYPE_FIELD_OVERRIDES: Partial<Record<PlanSubtype, readonly PlanFormField[]>> = {
  revue_protection: [{ key: 'date_cible', kind: 'date', label: 'ÉCHÉANCE DE LA REVUE', required: false }],
  no_spend_challenge: [
    { key: 'duree_jours', kind: 'integer', label: 'DURÉE DU DÉFI (JOURS)', placeholder: 'Ex. 30', required: true },
    { key: 'date_cible', kind: 'date', label: 'DATE DE DÉBUT', required: false },
  ],
  reduction_abonnements: [
    { key: 'paiement_mensuel', kind: 'money', label: 'ÉCONOMIE MENSUELLE VISÉE', placeholder: 'Ex. 80', required: false },
    { key: 'date_cible', kind: 'date', label: 'ÉCHÉANCE', required: false },
  ],
  sortie_categorie_derapage: [
    { key: 'budget_mensuel', kind: 'money', label: 'PLAFOND DE LA CATÉGORIE', placeholder: 'Ex. 300', required: false },
    { key: 'date_cible', kind: 'date', label: 'ÉCHÉANCE', required: false },
  ],
};

export function getPlanTypeFormConfig(subtype: PlanSubtype): PlanTypeFormConfig {
  const override = SUBTYPE_FIELD_OVERRIDES[subtype];
  if (override) return { fields: override };
  const category = planCategoryForSubtype(subtype);
  return { fields: CATEGORY_FIELDS[category] };
}

// ─── Parsing ────────────────────────────────────────────────────────────────

export function parsePlanAmountInput(value: string | undefined): number | null {
  if (value == null) return null;
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePlanIntegerInput(value: string | undefined): number | null {
  const parsed = parsePlanAmountInput(value);
  if (parsed == null) return null;
  return Math.round(parsed);
}

// ─── Assemblage du plan à la création ───────────────────────────────────────

export type PlanCreationInput = {
  subtype: PlanSubtype;
  /** Valeurs brutes (chaînes) des champs texte / montant / pourcentage / date. */
  values: Partial<Record<PlanFieldKey, string>>;
  /** Libellé du compte résolu (champ `compte_lie`). */
  accountLabel?: string;
  /** Libellé composite de cadence, ex. « 150 $ / semaine » (champ `cadence`). */
  cadenceLabel?: string;
};

export type AssembledPlanFields = {
  montant_cible: number | null;
  montant_actuel: number;
  compte_lie?: string;
  cadence?: string;
  date_cible?: string;
  parametres?: PlanParametres;
};

export function assemblePlanCreationFields(input: PlanCreationInput): AssembledPlanFields {
  const { subtype, values, accountLabel, cadenceLabel } = input;
  const config = getPlanTypeFormConfig(subtype);
  const result: AssembledPlanFields = { montant_cible: null, montant_actuel: 0 };
  const parametres: PlanParametres = {};

  for (const field of config.fields) {
    switch (field.key) {
      case 'montant_cible': {
        const v = parsePlanAmountInput(values.montant_cible);
        if (v != null) result.montant_cible = v;
        break;
      }
      case 'solde_initial': {
        const v = parsePlanAmountInput(values.solde_initial);
        if (v != null) {
          parametres.solde_initial = v;
          result.montant_cible = v;
          result.montant_actuel = 0;
        }
        break;
      }
      case 'budget_mensuel': {
        const v = parsePlanAmountInput(values.budget_mensuel);
        if (v != null) {
          parametres.budget_mensuel = v;
          result.montant_cible = v;
          result.montant_actuel = 0;
        }
        break;
      }
      case 'taux_interet': {
        const v = parsePlanAmountInput(values.taux_interet);
        if (v != null) parametres.taux_interet = v;
        break;
      }
      case 'pourcentage_reserve': {
        const v = parsePlanAmountInput(values.pourcentage_reserve);
        if (v != null) parametres.pourcentage_reserve = v;
        break;
      }
      case 'paiement_mensuel': {
        const v = parsePlanAmountInput(values.paiement_mensuel);
        if (v != null) {
          parametres.paiement_mensuel = v;
          if (!result.cadence) result.cadence = `${formatDisplayMoneyAbsolute(v)} / mois`;
        }
        break;
      }
      case 'duree_jours': {
        const v = parsePlanIntegerInput(values.duree_jours);
        if (v != null) parametres.duree_jours = v;
        break;
      }
      case 'compte_lie': {
        if (accountLabel) result.compte_lie = accountLabel;
        break;
      }
      case 'cadence': {
        if (cadenceLabel) result.cadence = cadenceLabel;
        break;
      }
      case 'date_cible': {
        const d = values.date_cible?.trim();
        if (d) result.date_cible = d;
        break;
      }
    }
  }

  if (Object.keys(parametres).length > 0) result.parametres = parametres;
  return result;
}

// ─── Validation ─────────────────────────────────────────────────────────────

export type PlanValidationError = { title: string; message: string };

export function validatePlanCreation(input: PlanCreationInput): PlanValidationError | null {
  const config = getPlanTypeFormConfig(input.subtype);

  for (const field of config.fields) {
    if (field.kind === 'account') {
      if (field.required && !input.accountLabel) {
        return { title: 'Compte requis', message: `Choisissez « ${titleCase(field.label)} » pour ce plan.` };
      }
      continue;
    }

    if (field.kind === 'cadence') {
      const amount = parsePlanAmountInput(cadenceAmountFromLabel(input.cadenceLabel));
      if (field.required && (amount == null || amount <= 0)) {
        return { title: 'Cadence invalide', message: 'Indiquez un montant de cadence supérieur à 0.' };
      }
      continue;
    }

    if (field.kind === 'date') {
      if (field.required && !input.values.date_cible?.trim()) {
        return { title: 'Date requise', message: `Indiquez « ${titleCase(field.label)} ».` };
      }
      continue;
    }

    // money / percent / integer
    const raw = input.values[field.key];
    const parsed = field.kind === 'integer' ? parsePlanIntegerInput(raw) : parsePlanAmountInput(raw);

    if (field.required && (parsed == null || parsed <= 0)) {
      return {
        title: `${titleCase(field.label)} requis`,
        message: `Indiquez « ${titleCase(field.label)} » avec une valeur supérieure à 0.`,
      };
    }
    if (field.kind === 'percent' && parsed != null && (parsed < 0 || parsed > 100)) {
      return { title: 'Pourcentage invalide', message: 'Indiquez un pourcentage entre 0 et 100.' };
    }
  }

  return null;
}

function cadenceAmountFromLabel(label: string | undefined): string | undefined {
  if (!label) return undefined;
  return label.split('$')[0]?.trim() || label.replace(/[^0-9.,]/g, '');
}

function titleCase(label: string): string {
  const lower = label.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

// ─── Vue de progression par type ────────────────────────────────────────────

export type PlanTypeProgressView = {
  heroPrimary: string;
  heroSecondary: string;
  metrics: DashboardPlanMetric[];
};

function money(value: number): string {
  return formatDisplayMoneyAbsolute(value);
}

function formatPercentValue(value: number): string {
  return String(value).replace('.', ',');
}

function friendlyDate(value: string | undefined): string {
  if (!value) return '—';
  return formatFriendlyDateLabel(value);
}

function planHasMonetaryTarget(plan: PlanActifOuTermine): boolean {
  if (planSubtypeSansMontantCible(plan.subtype)) return false;
  return plan.montant_cible != null && plan.montant_cible > 0;
}

export function buildPlanTypeProgressView(plan: PlanActifOuTermine): PlanTypeProgressView {
  const parametres = plan.parametres ?? {};
  const pct = planProgressionPourcent(plan);

  if (plan.category === 'dette') {
    const parametresDebts = parametres.dettes ?? [];
    const initial =
      parametres.solde_initial ??
      (parametresDebts.length > 0
        ? parametresDebts.reduce((sum, d) => sum + d.solde, 0)
        : plan.montant_cible ?? 0);
    const repaid = plan.montant_actuel ?? 0;
    const remaining = Math.max(0, initial - repaid);
    const metrics: DashboardPlanMetric[] = [
      { id: 'balance', label: 'Solde restant', value: money(remaining), tone: 'warning' },
    ];

    if (parametresDebts.length > 0) {
      const ordered = [...parametresDebts].sort((a, b) => a.ordre - b.ordre);
      const focus = ordered.find((d) => d.solde > 0) ?? ordered[0];
      if (focus) {
        metrics.push({
          id: 'focus',
          label: 'Priorité',
          value: `#${focus.ordre} · ${focus.label}`,
        });
      }
      metrics.push({
        id: 'count',
        label: 'Dettes au plan',
        value: String(parametresDebts.length),
      });
    }

    if (parametres.extra_paiement != null && parametres.extra_paiement > 0) {
      const cadence = parametres.extra_cadence === 'week' ? 'semaine' : 'mois';
      metrics.push({
        id: 'extra',
        label: 'Extra',
        value: `${money(parametres.extra_paiement)}/${cadence}`,
        tone: 'positive',
      });
    } else if (parametres.paiement_mensuel != null) {
      metrics.push({
        id: 'payment',
        label: 'Paiement',
        value: `${money(parametres.paiement_mensuel)}/mois`,
        tone: 'positive',
      });
    }

    if (parametres.projection_jours != null && parametres.projection_jours > 0) {
      metrics.push({
        id: 'eta',
        label: 'Libre de dettes',
        value: formatDebtFreeDuration(parametres.projection_jours),
      });
    } else if (plan.date_cible) {
      metrics.push({ id: 'eta', label: 'Libération visée', value: friendlyDate(plan.date_cible) });
    }

    if (parametres.taux_interet != null && parametresDebts.length === 0) {
      metrics.push({ id: 'rate', label: "Taux d'intérêt", value: `${formatPercentValue(parametres.taux_interet)} %` });
    }

    const strategyLabel =
      parametres.strategie_dette != null
        ? PLAN_SUBTYPE_LABELS[plan.subtype]
        : null;

    return {
      heroPrimary: `${money(remaining)} restants`,
      heroSecondary: strategyLabel
        ? `${pct} % remboursé · ${strategyLabel}`
        : `${pct} % remboursé · sur ${money(initial)}`,
      metrics,
    };
  }

  if (plan.category === 'budget') {
    const budget = parametres.budget_mensuel ?? plan.montant_cible ?? 0;
    const spent = plan.montant_actuel ?? 0;
    const remaining = Math.max(0, budget - spent);
    const metrics: DashboardPlanMetric[] = [
      { id: 'envelope', label: 'Enveloppe mensuelle', value: money(budget) },
      { id: 'spent', label: 'Dépensé', value: money(spent) },
      { id: 'margin', label: 'Marge restante', value: money(remaining), tone: pct >= 85 ? 'danger' : 'default' },
    ];
    return {
      heroPrimary: `${money(spent)} / ${money(budget)}`,
      heroSecondary: `${money(remaining)} restants ce mois`,
      metrics,
    };
  }

  if (planHasMonetaryTarget(plan)) {
    const target = plan.montant_cible ?? 0;
    const current = plan.montant_actuel ?? 0;
    const remaining = Math.max(0, target - current);
    const metrics: DashboardPlanMetric[] = [
      { id: 'remaining', label: 'Reste à atteindre', value: money(remaining) },
    ];
    if (plan.cadence) metrics.push({ id: 'cadence', label: 'Cadence', value: plan.cadence, tone: 'positive' });
    if (parametres.pourcentage_reserve != null) {
      metrics.push({ id: 'reserve', label: 'Part réservée', value: `${formatPercentValue(parametres.pourcentage_reserve)} %` });
    }
    if (plan.date_cible) {
      metrics.push({ id: 'eta', label: plan.category === 'fiscal' ? 'Échéance' : 'Date cible', value: friendlyDate(plan.date_cible) });
    }
    return {
      heroPrimary: `${money(current)} / ${money(target)}`,
      heroSecondary: `${pct} % · ${money(remaining)} restants`,
      metrics,
    };
  }

  // Sans cible monétaire — progression par étapes (comportemental, revue, etc.).
  const { done, total } = planEtapesCompletees(plan);
  const metrics: DashboardPlanMetric[] = [];
  if (parametres.duree_jours != null) {
    metrics.push({ id: 'duration', label: 'Durée', value: `${parametres.duree_jours} jours` });
  }
  if (parametres.paiement_mensuel != null) {
    metrics.push({ id: 'save', label: 'Économie visée', value: `${money(parametres.paiement_mensuel)}/mois`, tone: 'positive' });
  }
  if (parametres.budget_mensuel != null) {
    metrics.push({ id: 'cap', label: 'Plafond', value: money(parametres.budget_mensuel) });
  }
  if (plan.date_cible) {
    metrics.push({ id: 'eta', label: 'Échéance', value: friendlyDate(plan.date_cible) });
  }
  return {
    heroPrimary: total > 0 ? `${done}/${total} étapes` : 'Plan en cours',
    heroSecondary: total > 0 ? `${pct} % complété` : 'Suis les étapes pour progresser',
    metrics,
  };
}
