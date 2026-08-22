/**
 * Validation + French copy for the « Nouvelle catégorie » budget form.
 *
 * Every rejection is attached to the field that caused it, so the confirm button
 * never has to be disabled with a label the screen does not explain. The single
 * hard block is the category ceiling (`MAX_BUDGET_CATEGORIES`, one palette color
 * per category); allocating more than the monthly income is a soft warning —
 * over-allocating is a diagnosis the user wants to read, not a wall.
 */
import { formatDisplayMoneyAbsoluteExact } from '@/lib/formatDisplayMoney';
import { sanitizeNumericInput } from '@/lib/formatNumber';
import { MAX_BUDGET_CATEGORIES } from '@/lib/budgetCategoryModel';

export const MAX_BUDGET_CATEGORY_NAME_LENGTH = 40;
export const MAX_BUDGET_CATEGORY_LIMIT = 1_000_000;

export const BUDGET_PERIOD_EXCEEDS_MONTHLY_MESSAGE =
  'Le montant ne peut pas dépasser la limite mensuelle.';

/** @deprecated Prefer {@link BUDGET_PERIOD_EXCEEDS_MONTHLY_MESSAGE}. */
export const PERIOD_ABOVE_MONTHLY_MESSAGE = BUDGET_PERIOD_EXCEEDS_MONTHLY_MESSAGE;

export type BudgetCategoryFieldKey = 'name' | 'limit' | 'period';

export type BudgetCategoryIssueCode =
  | 'name-required'
  | 'name-too-long'
  | 'name-duplicate'
  | 'limit-required'
  | 'limit-not-a-number'
  | 'limit-not-positive'
  | 'limit-too-large'
  | 'period-not-a-number'
  | 'period-above-monthly';

export type BudgetCategoryNoticeCode = 'envelope-exceeded';

export type BudgetCategoryFieldIssue = {
  field: BudgetCategoryFieldKey;
  code: BudgetCategoryIssueCode;
  message: string;
};

export type BudgetCategoryNotice = {
  code: BudgetCategoryNoticeCode;
  message: string;
};

export type BudgetCategoryBlocker = {
  code: 'at-capacity';
  message: string;
};

/**
 * Minimal shape needed to validate against stored rows. The optional flags let
 * the duplicate check ignore rows that must never block a creation (deleted,
 * archived, another month, non-monthly envelope).
 */
export type BudgetCategoryLike = {
  id: string;
  name: string;
  limit?: number;
  period?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  /** `YYYY-MM` when the row only exists for one month; nullish = every month. */
  monthKey?: string | null;
};

/** Alias kept for call sites / tests that named the shape after the storage type. */
export type ExistingBudgetCategory = BudgetCategoryLike;

/** Trimmed, accent-folded, case-folded, whitespace-collapsed comparison key. */
export function categoryNameComparisonKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Display name actually stored: trimmed, inner whitespace collapsed. */
export function normalizeCategoryName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** « août 2026 » — lowercase inline month for mid-sentence copy. */
export function formatInlineMonthLabel(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function isLiveForMonth(category: BudgetCategoryLike, targetMonthKey: string | null): boolean {
  if (category.deletedAt) return false;
  if (category.archivedAt) return false;
  if (category.period != null && category.period !== 'monthly') return false;
  if (category.monthKey == null || targetMonthKey == null) return true;
  return category.monthKey === targetMonthKey;
}

export type FindConflictingCategoryOptions = {
  /** Restricts the check to rows living in that month. */
  monthDate?: Date;
  /** Row currently being edited — it can never conflict with itself. */
  excludeId?: string | null;
};

/**
 * Existing category colliding with `name` — case, accents and extra spaces folded.
 * Deleted, archived, other-month and non-monthly rows are skipped so a stale row
 * can never reject a legitimate creation.
 */
export function findConflictingCategory<T extends BudgetCategoryLike>(
  name: string,
  existing: readonly T[] = [],
  options?: FindConflictingCategoryOptions,
): T | null {
  const key = categoryNameComparisonKey(name);
  if (!key) return null;

  const targetMonthKey = options?.monthDate ? monthKeyOf(options.monthDate) : null;
  return (
    existing.find(
      (category) =>
        category.id !== options?.excludeId &&
        isLiveForMonth(category, targetMonthKey) &&
        categoryNameComparisonKey(category.name) === key,
    ) ?? null
  );
}

/** @deprecated Prefer {@link findConflictingCategory}. */
export const findDuplicateBudgetCategory = findConflictingCategory;

export type BudgetLimitRejection = 'empty' | 'not-a-number' | 'not-positive' | 'too-large';

export type BudgetLimitParse =
  | { ok: true; value: number }
  | { ok: false; reason: BudgetLimitRejection };

/** Parses a typed amount, keeping the reason a value was refused. */
export function parseBudgetLimitInput(raw: string): BudgetLimitParse {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };

  // `sanitizeNumericInput` drops the sign — read it before it disappears.
  const isNegative = /^[-−]/.test(trimmed);
  const sanitized = sanitizeNumericInput(trimmed);
  if (!sanitized || sanitized === '.' || sanitized === ',') {
    return { ok: false, reason: 'not-a-number' };
  }

  const parsed = Number.parseFloat(sanitized);
  if (!Number.isFinite(parsed)) return { ok: false, reason: 'not-a-number' };
  if (isNegative || parsed <= 0) return { ok: false, reason: 'not-positive' };
  if (parsed > MAX_BUDGET_CATEGORY_LIMIT) return { ok: false, reason: 'too-large' };
  return { ok: true, value: parsed };
}

// --- French copy ------------------------------------------------------------

/**
 * Names the colliding category explicitly — an unnamed « ce nom existe déjà »
 * reads like a false positive when the user cannot see the offending row.
 * Categories are not month-scoped yet, so the label describes the month the
 * Budget screen is showing (today by default).
 */
export function describeDuplicateCategory(
  category: Pick<BudgetCategoryLike, 'name'>,
  monthDate: Date = new Date(),
): string {
  return `Une catégorie « ${category.name} » existe déjà pour ${formatInlineMonthLabel(monthDate)}. Modifie sa limite au lieu d'en créer une deuxième.`;
}

/** Label of the escape hatch offered next to a duplicate name. */
export function describeDuplicateResolution(
  category: Pick<BudgetCategoryLike, 'name'>,
  limit: number,
): string {
  return `Mettre « ${category.name} » à ${formatDisplayMoneyAbsoluteExact(limit)}`;
}

export function describeCategoryCapacityBlocker(max: number = MAX_BUDGET_CATEGORIES): string {
  return `Tu as déjà ${max} catégories, c'est le maximum. Supprime ou fusionne une catégorie pour faire de la place.`;
}

export function describeLimitRejection(reason: BudgetLimitRejection): string {
  switch (reason) {
    case 'empty':
      return 'Indique une limite mensuelle, par exemple 100$.';
    case 'not-a-number':
      return 'Entre un montant en chiffres, par exemple 100.';
    case 'not-positive':
      return 'La limite doit être supérieure à 0$.';
    case 'too-large':
      return limitTooLargeMessage();
  }
}

export function limitTooLargeMessage(max: number = MAX_BUDGET_CATEGORY_LIMIT): string {
  return `Limite trop élevée — reste sous ${formatDisplayMoneyAbsoluteExact(max)}.`;
}

export function describeNameTooLong(max: number = MAX_BUDGET_CATEGORY_NAME_LENGTH): string {
  return `Nom trop long — garde-le sous ${max} caractères.`;
}

export function describeEnvelopeExceeded(
  projectedTotal: number,
  monthlyIncome: number,
  monthDate?: Date,
): string {
  const monthBit = monthDate
    ? ` pour ${formatInlineMonthLabel(monthDate)}`
    : '';
  return `Le total des catégories (${formatDisplayMoneyAbsoluteExact(projectedTotal)}) dépasse ton revenu mensuel (${formatDisplayMoneyAbsoluteExact(monthlyIncome)})${monthBit}. Tu peux créer quand même — réduis une limite pour rester dans l'enveloppe.`;
}

// --- Income headroom (soft warning) ----------------------------------------

export type BudgetAllocationHeadroomInput = {
  /** Sum of the monthly limits already allocated to the other categories. */
  otherCategoriesAllocatedTotal: number;
  /** Monthly limit of the category being created; null while unset. */
  categoryLimit: number | null;
  /** Monthly average income, when onboarding knows it. */
  monthlyIncome: number | null;
  /** Month label for soft-warning copy. */
  monthDate?: Date;
};

export type BudgetAllocationHeadroom = {
  projectedTotal: number;
  /** Income − projected total; null when the income is unknown. */
  remaining: number | null;
  exceedsIncome: boolean;
  /** Non-blocking copy, with both numbers spelled out. */
  warning: string | null;
};

/**
 * Compares the projected allocation to the monthly income. Never blocks: the
 * form only surfaces the numbers so the user can decide.
 */
export function computeBudgetAllocationHeadroom(
  input: BudgetAllocationHeadroomInput,
): BudgetAllocationHeadroom {
  const categoryLimit = input.categoryLimit ?? 0;
  const projectedTotal = Math.max(0, input.otherCategoriesAllocatedTotal) + categoryLimit;
  const monthlyIncome = input.monthlyIncome;
  const known = monthlyIncome != null && monthlyIncome > 0;
  const remaining = known ? monthlyIncome - projectedTotal : null;
  const exceedsIncome = input.categoryLimit != null && known && projectedTotal > monthlyIncome;

  return {
    projectedTotal,
    remaining,
    exceedsIncome,
    warning: exceedsIncome
      ? describeEnvelopeExceeded(projectedTotal, monthlyIncome, input.monthDate)
      : null,
  };
}

function sumLiveAllocated(
  existing: readonly BudgetCategoryLike[],
  options: { excludeId?: string | null; monthDate?: Date },
): number {
  const targetMonthKey = options.monthDate ? monthKeyOf(options.monthDate) : null;
  return existing.reduce((sum, category) => {
    if (category.id === options.excludeId) return sum;
    if (!isLiveForMonth(category, targetMonthKey)) return sum;
    return sum + Math.max(0, category.limit ?? 0);
  }, 0);
}

// --- Draft validation ------------------------------------------------------

export type BudgetCategoryDraft = {
  name: string;
  /** Raw text of the monthly limit field. */
  limitInput: string;
  /** Raw text of the optional weekly / biweekly field. */
  periodInput?: string;
  /** Alias of {@link periodInput} — kept for older call sites / tests. */
  periodLimitInput?: string;
  existing?: readonly BudgetCategoryLike[];
  /** Row being edited — excluded from the duplicate check and the ceiling. */
  editingCategoryId?: string | null;
  /** Month the form writes into — scopes duplicates and labels the copy. */
  monthDate?: Date;
  maxCategories?: number;
  /**
   * Monthly average income. When set, over-allocation becomes a soft notice —
   * never a field error and never flips `ok` to false.
   */
  monthlyIncome?: number | null;
  /**
   * Override for soft envelope math. Defaults to the sum of live category limits
   * excluding the row being edited.
   */
  otherCategoriesAllocatedTotal?: number;
};

const LIMIT_ISSUE_CODES: Record<BudgetLimitRejection, BudgetCategoryIssueCode> = {
  empty: 'limit-required',
  'not-a-number': 'limit-not-a-number',
  'not-positive': 'limit-not-positive',
  'too-large': 'limit-too-large',
};

export type BudgetCategoryValidation = {
  /** True when the draft is savable. Soft warnings never flip this. */
  ok: boolean;
  issues: BudgetCategoryFieldIssue[];
  fieldErrors: Partial<Record<BudgetCategoryFieldKey, string>>;
  firstInvalidField: BudgetCategoryFieldKey | null;
  /** Hard stop that belongs to no field — the category ceiling. */
  blocker: string | null;
  /** Structured capacity block (same text as {@link blocker}). */
  blocked: BudgetCategoryBlocker | null;
  /** Soft notices — never affect `ok`. */
  notices: BudgetCategoryNotice[];
  /** Existing row colliding with the typed name, when there is one. */
  conflict: BudgetCategoryLike | null;
  /** Display name to store (trimmed, whitespace collapsed). */
  normalizedName: string;
  limit: number | null;
  /** Alias of {@link limit}. */
  parsedLimit: number | null;
  periodLimit: number | null;
  /** Projected sum of category limits after this draft is applied. */
  projectedAllocatedTotal: number;
};

/** Pulls `{ id, name }` off a validation result when a duplicate blocked save. */
export function duplicateFromValidation(
  validation: Pick<BudgetCategoryValidation, 'conflict'>,
): { id: string; name: string } | null {
  if (!validation.conflict) return null;
  return { id: validation.conflict.id, name: validation.conflict.name };
}

/**
 * Single source of truth for the add / edit category form: `ok` is exactly
 * "no field error and no hard block", so a disabled confirm button and the
 * visible messages can never disagree. Envelope overrun is a soft notice only.
 */
export function validateBudgetCategoryDraft(
  draft: BudgetCategoryDraft,
): BudgetCategoryValidation {
  const existing = draft.existing ?? [];
  const maxCategories = draft.maxCategories ?? MAX_BUDGET_CATEGORIES;
  const isEditing = draft.editingCategoryId != null;
  const issues: BudgetCategoryFieldIssue[] = [];

  const normalizedName = normalizeCategoryName(draft.name);
  let conflict: BudgetCategoryLike | null = null;

  if (!normalizedName) {
    issues.push({
      field: 'name',
      code: 'name-required',
      message: 'Indique un nom pour cette catégorie.',
    });
  } else if (normalizedName.length > MAX_BUDGET_CATEGORY_NAME_LENGTH) {
    issues.push({ field: 'name', code: 'name-too-long', message: describeNameTooLong() });
  } else {
    conflict = findConflictingCategory(normalizedName, existing, {
      monthDate: draft.monthDate,
      excludeId: draft.editingCategoryId,
    });
    if (conflict) {
      issues.push({
        field: 'name',
        code: 'name-duplicate',
        message: describeDuplicateCategory(conflict, draft.monthDate),
      });
    }
  }

  const limitParse = parseBudgetLimitInput(draft.limitInput);
  if (!limitParse.ok) {
    issues.push({
      field: 'limit',
      code: LIMIT_ISSUE_CODES[limitParse.reason],
      message: describeLimitRejection(limitParse.reason),
    });
  }
  const limit = limitParse.ok ? limitParse.value : null;

  let periodLimit: number | null = null;
  const periodRaw = draft.periodInput ?? draft.periodLimitInput ?? '';
  if (periodRaw.trim()) {
    const periodParse = parseBudgetLimitInput(periodRaw);
    if (periodParse.ok) {
      periodLimit = periodParse.value;
      if (limit != null && periodLimit > limit) {
        issues.push({
          field: 'period',
          code: 'period-above-monthly',
          message: BUDGET_PERIOD_EXCEEDS_MONTHLY_MESSAGE,
        });
      }
    } else {
      issues.push({
        field: 'period',
        code: 'period-not-a-number',
        message: 'Laisse vide ou indique un montant supérieur à 0.',
      });
    }
  }

  const liveCount = existing.filter((category) =>
    isLiveForMonth(category, draft.monthDate ? monthKeyOf(draft.monthDate) : null),
  ).length;
  const blocked: BudgetCategoryBlocker | null =
    !isEditing && liveCount >= maxCategories
      ? { code: 'at-capacity', message: describeCategoryCapacityBlocker(maxCategories) }
      : null;
  const blocker = blocked?.message ?? null;

  const otherAllocated =
    draft.otherCategoriesAllocatedTotal ??
    sumLiveAllocated(existing, {
      excludeId: draft.editingCategoryId,
      monthDate: draft.monthDate,
    });
  const headroom = computeBudgetAllocationHeadroom({
    otherCategoriesAllocatedTotal: otherAllocated,
    categoryLimit: limit,
    monthlyIncome: draft.monthlyIncome ?? null,
    monthDate: draft.monthDate,
  });
  const notices: BudgetCategoryNotice[] = headroom.warning
    ? [{ code: 'envelope-exceeded', message: headroom.warning }]
    : [];

  const fieldErrors: Partial<Record<BudgetCategoryFieldKey, string>> = {};
  for (const issue of issues) {
    if (fieldErrors[issue.field] == null) {
      fieldErrors[issue.field] = issue.message;
    }
  }

  const fieldOrder: BudgetCategoryFieldKey[] = ['name', 'limit', 'period'];
  const firstInvalidField = fieldOrder.find((field) => fieldErrors[field] != null) ?? null;

  return {
    ok: firstInvalidField == null && blocked == null,
    issues,
    fieldErrors,
    firstInvalidField,
    blocker,
    blocked,
    notices,
    conflict,
    normalizedName,
    limit,
    parsedLimit: limit,
    periodLimit,
    projectedAllocatedTotal: headroom.projectedTotal,
  };
}
