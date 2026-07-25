import type { ChatAction, CreerCategorieBudgetParams } from './types';
import type { MessageBlock } from '@/types/aiWidgets';

export type LocalCreateBudgetCategoryIntent = {
  name: string;
  monthlyLimit: number;
};

/** Common FR/EN aliases → display name for budget categories. */
const NAME_ALIASES: Record<string, string> = {
  gas: 'Essence',
  gasoline: 'Essence',
  fuel: 'Essence',
  carburant: 'Essence',
  essence: 'Essence',
  grocery: 'Épicerie',
  groceries: 'Épicerie',
  epicerie: 'Épicerie',
  'épicerie': 'Épicerie',
  restaurants: 'Restaurants',
  restaurant: 'Restaurants',
  transport: 'Transport',
  housing: 'Logement',
  logement: 'Logement',
  rent: 'Logement',
  loyer: 'Logement',
};

function normalizeLoose(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizeDisplayName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return trimmed;
  return trimmed
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveCategoryDisplayName(raw: string): string {
  const key = normalizeLoose(raw);
  const alias = NAME_ALIASES[key];
  if (alias) return alias;
  return capitalizeDisplayName(raw);
}

function parseAmountToken(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Detects explicit “create budget category X with $Y/month” intents.
 * Returns null when the request is incomplete or not a create-category command.
 */
export function parseCreateBudgetCategoryIntent(
  text: string,
): LocalCreateBudgetCategoryIntent | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const loose = normalizeLoose(trimmed);
  const isCreate =
    /\b(cree|creer|ajoute|ajouter|create|add)\b/.test(loose) ||
    /\b(nouvelle|nouveau)\s+(categorie|category|enveloppe)\b/.test(loose);
  const mentionsCategory = /\b(categorie|category|enveloppe)\b/.test(loose);
  if (!isCreate || !mentionsCategory) return null;

  // Prefer amount near $ or /mois markers (match on accent-folded text for reliability).
  const amountPatterns: RegExp[] = [
    /\$\s*(\d+(?:[.,]\d{1,2})?)/i,
    /(\d+(?:[.,]\d{1,2})?)\s*\$/i,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:\/\s*)?(?:par\s+)?mois\b/i,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:\/\s*)?(?:per\s+)?month\b/i,
    /(\d+(?:[.,]\d{1,2})?)\s*\/\s*mois\b/i,
  ];

  let monthlyLimit: number | null = null;
  let amountMatch: RegExpExecArray | null = null;
  for (const pattern of amountPatterns) {
    const match = pattern.exec(loose);
    if (!match) continue;
    const rawAmount = match[1];
    if (!rawAmount) continue;
    const parsed = parseAmountToken(rawAmount);
    if (parsed == null) continue;
    monthlyLimit = parsed;
    amountMatch = match;
    break;
  }

  if (monthlyLimit == null || !amountMatch) return null;

  // Strip create/category fillers from the accent-folded prefix before the amount.
  let beforeAmount = loose.slice(0, amountMatch.index).trim();
  beforeAmount = beforeAmount
    .replace(
      /^(?:s il te plait|svp|please|peux[- ]tu|pourrais[- ]tu|can you|could you)\s+/i,
      '',
    )
    .replace(/^(?:cree|creer|ajoute|ajouter|create|add)\s+/i, '')
    .replace(/^(?:moi\s+)?(?:une?|la|le|the|a|an)\s+/i, '')
    .replace(/^(?:nouvelle|nouveau|new)\s+/i, '')
    .replace(/^(?:categorie|category|enveloppe)\s+/i, '')
    .replace(/^(?:de\s+)?budget\s+/i, '')
    .replace(/^(?:budget\s+)?(?:categorie|category|enveloppe)\s+/i, '')
    .replace(/^(?:appelee?|nommee?|named|called)\s+/i, '')
    .replace(/[:\-–—]+\s*$/u, '')
    .replace(/\s+(?:de|avec|a|of|with|for)\s*$/i, '')
    .trim();

  // Fallback: words between "catégorie" and the amount.
  if (!beforeAmount) {
    const between = loose.match(
      /(?:categorie|category|enveloppe)\s+(?:de\s+)?(?:budget\s+)?(.+?)\s+(?:\$|\d)/i,
    );
    beforeAmount = between?.[1]?.trim() ?? '';
  }

  const nameRaw = beforeAmount
    .replace(/^(?:de\s+)?budget\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!nameRaw || nameRaw.length > 48) return null;
  // Reject if name still looks like boilerplate only.
  if (/^(?:de|budget|mensuel|monthly)$/i.test(nameRaw)) return null;

  return {
    name: resolveCategoryDisplayName(nameRaw),
    monthlyLimit,
  };
}

export function buildCreateBudgetCategoryAction(
  intent: LocalCreateBudgetCategoryIntent,
): ChatAction {
  const params: CreerCategorieBudgetParams = {
    nom: intent.name,
    limite_mensuelle: intent.monthlyLimit,
  };
  const limitLabel = intent.monthlyLimit.toLocaleString('fr-CA', {
    maximumFractionDigits: 2,
  });
  return {
    action: 'creer_categorie_budget',
    params,
    confirmation: `Créer la catégorie ${intent.name} (${limitLabel} $/mois)?`,
    status: 'pending',
  };
}

export function buildLocalCreateBudgetCategoryReply(intent: LocalCreateBudgetCategoryIntent): {
  content: string;
  actions: ChatAction[];
  blocks: MessageBlock[];
} {
  const action = buildCreateBudgetCategoryAction(intent);
  const content = `Bonne idée pour mieux suivre tes dépenses « ${intent.name} ».`;
  return {
    content,
    actions: [action],
    blocks: [{ type: 'text', content }],
  };
}

/** True when the user is asking to create/modify something — not to view charts. */
export function isBudgetCategoryMutationRequest(text: string): boolean {
  const loose = normalizeLoose(text);
  const isCreate =
    /\b(cree|creer|ajoute|ajouter|create|add)\b/.test(loose) ||
    /\b(nouvelle|nouveau)\s+(categorie|category|enveloppe)\b/.test(loose);
  const isModify =
    /\b(modifie|modifier|change|changer|reduire|augmente|augmenter|update|set)\b/.test(loose) &&
    /\b(categorie|category|enveloppe|budget|limite)\b/.test(loose);
  const mentionsCategory = /\b(categorie|category|enveloppe)\b/.test(loose);
  return (isCreate && mentionsCategory) || isModify;
}
