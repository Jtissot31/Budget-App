import type { Category } from '@/types';

export type CategoryRule = {
  categoryIds: string[];
  categoryNames: string[];
  keywords: string[];
};

export const CATEGORY_RULES: CategoryRule[] = [
  {
    categoryIds: ['cat-rest'],
    categoryNames: ['restaurant', 'cafe', 'repas', 'livraison'],
    keywords: [
      'starbucks',
      'tim hortons',
      'cafe',
      'coffee',
      'restaurant',
      'resto',
      'pizza',
      'subway',
      'mcdonald',
      'doordash',
      'uber eats',
      'ubereats',
      'skip',
      'sushi',
      'boulangerie',
      'brunch',
    ],
  },
  {
    categoryIds: ['cat-food'],
    categoryNames: ['epicerie', 'grocery', 'alimentation', 'nourriture', 'courses'],
    keywords: [
      'epicerie',
      'grocery',
      'groceries',
      'iga',
      'metro',
      'provigo',
      'maxi',
      'walmart',
      'costco',
      'instacart',
      'whole foods',
      'carrefour',
      'super c',
      'loblaws',
      'fruiterie',
      'marche',
      'pain',
      'lait',
      'oeuf',
      'viande',
      'legume',
    ],
  },
  {
    categoryIds: ['cat-gas', 'cat-transport'],
    categoryNames: ['gas', 'essence', 'transport', 'carburant'],
    keywords: ['gas', 'gaz', 'essence', 'fuel', 'shell', 'esso', 'petro-canada', 'petro canada', 'carburant', 'station service'],
  },
  {
    categoryIds: ['cat-fun'],
    categoryNames: ['loisir', 'loisirs', 'divertissement'],
    keywords: [
      'netflix',
      'spotify',
      'amazon prime',
      'prime video',
      'subscription',
      'abonnement',
      'mensualite',
      'paiement mensuel',
      'apple music',
      'apple tv',
      'google one',
      'adobe',
      'dropbox',
      'notion',
      'slack',
      'zoom',
      'icloud',
      'disney',
      'disney plus',
      'crave',
    ],
  },
  {
    categoryIds: ['cat-phone'],
    categoryNames: ['telephone', 'facture', 'internet', 'cellulaire'],
    keywords: ['telephone', 'cellulaire', 'internet', 'telus', 'bell', 'rogers', 'videotron', 'phone', 'fizz', 'koodo', 'virgin'],
  },
  {
    categoryIds: ['cat-home-maintenance', 'cat-home'],
    categoryNames: ['entretien maison', 'renovation', 'quincaillerie', 'outil', 'outils', 'reparations'],
    keywords: [
      'tape a mesurer',
      'tape amesurer',
      'ruban a mesurer',
      'metre a ruban',
      'outil',
      'outils',
      'quincaillerie',
      'renovation',
      'reparation',
      'reparations',
      'entretien maison',
      'home depot',
      'rona',
      'canac',
      'bmr',
      'marteau',
      'vis',
      'clou',
      'perceuse',
      'tournevis',
      'scie',
      'peinture',
    ],
  },
  {
    categoryIds: ['cat-home'],
    categoryNames: ['appartement', 'maison', 'loyer', 'logement', 'hypotheque'],
    keywords: ['loyer', 'rent', 'maison', 'appartement', 'home depot', 'ikea', 'hydro', 'electricite', 'chauffage', 'hypotheque'],
  },
  {
    categoryIds: ['cat-car-payment', 'cat-car-insurance', 'cat-car-emergency'],
    categoryNames: ['auto', 'reparations', 'vehicule', 'assurance auto'],
    keywords: ['auto', 'car', 'garage', 'pneu', 'tires', 'vehicule', 'canadian tire', 'mecanique', 'huile', 'permis', 'saaq', 'assurance auto'],
  },
  {
    categoryIds: ['cat-bank-loan'],
    categoryNames: ['pret bancaire'],
    keywords: ['pret', 'loan', 'banque', 'interac', 'paypal', 'stripe'],
  },
  {
    categoryIds: ['cat-fun'],
    categoryNames: ['loisir', 'loisirs', 'divertissement', 'sortie', 'fun'],
    keywords: ['cinema', 'film', 'jeu', 'jeux', 'concert', 'billet', 'sortie', 'bar', 'arcade', 'theatre', 'loisir', 'loisirs'],
  },
  {
    categoryIds: [],
    categoryNames: ['sante', 'pharmacie', 'medical', 'medicament'],
    keywords: ['pharmacie', 'pharmaprix', 'jean coutu', 'uniprix', 'medicament', 'dentiste', 'docteur', 'clinique', 'lunettes'],
  },
  {
    categoryIds: [],
    categoryNames: ['vetement', 'vetements', 'shopping', 'magasin', 'achats', 'chaussure'],
    keywords: ['amazon', 'zara', 'hm', 'h&m', 'uniqlo', 'simons', 'winners', 'marshalls', 'vetement', 'vetements', 'linge', 'chaussure', 'chaussures'],
  },
  {
    categoryIds: [],
    categoryNames: ['voyage', 'vacances', 'hotel', 'avion'],
    keywords: ['airbnb', 'hotel', 'vol', 'avion', 'air canada', 'transat', 'uber', 'taxi', 'train', 'bus', 'opus', 'stm', 'voyage'],
  },
];

/** Keywords for contact transfer reasons (raison du transfert). */
export const TRANSFER_REASON_RULES: CategoryRule[] = [
  {
    categoryIds: ['cat-home'],
    categoryNames: ['appartement', 'maison', 'loyer', 'logement'],
    keywords: ['loyer', 'coloc', 'colocation', 'logement', 'appart', 'appartement', 'hypotheque', 'bail'],
  },
  {
    categoryIds: ['cat-rest'],
    categoryNames: ['restaurant', 'repas', 'cafe'],
    keywords: ['restaurant', 'resto', 'repas', 'dejeuner', 'diner', 'souper', 'cafe', 'brunch', 'pizza', 'sushi'],
  },
  {
    categoryIds: ['cat-food'],
    categoryNames: ['epicerie', 'alimentation', 'courses'],
    keywords: ['epicerie', 'courses', 'nourriture', 'alimentation', 'marche', 'boulangerie'],
  },
  {
    categoryIds: ['cat-fun'],
    categoryNames: ['loisir', 'loisirs', 'divertissement', 'cadeau'],
    keywords: ['cadeau', 'anniversaire', 'fete', 'noel', 'sortie', 'cinema', 'concert', 'bar', 'plaisir'],
  },
  {
    categoryIds: [],
    categoryNames: ['vetement', 'vetements', 'shopping', 'achats'],
    keywords: ['vetement', 'vetements', 'chaussure', 'shopping', 'magasin', 'achat', 'achats'],
  },
  {
    categoryIds: ['cat-bank-loan'],
    categoryNames: ['pret', 'remboursement', 'emprunt'],
    keywords: ['pret', 'emprunt', 'remboursement', 'rembourser', 'dette', 'solde du'],
  },
  {
    categoryIds: ['cat-gas', 'cat-transport'],
    categoryNames: ['transport', 'essence', 'carburant'],
    keywords: ['essence', 'gaz', 'transport', 'taxi', 'uber', 'bus', 'metro', 'train'],
  },
  {
    categoryIds: [],
    categoryNames: ['sante', 'pharmacie', 'medical'],
    keywords: ['pharmacie', 'medicament', 'sante', 'clinique', 'dentiste', 'docteur'],
  },
  {
    categoryIds: ['cat-home-maintenance', 'cat-home'],
    categoryNames: ['entretien maison', 'renovation', 'reparation'],
    keywords: ['renovation', 'reparation', 'entretien', 'quincaillerie', 'outil'],
  },
  {
    categoryIds: ['cat-phone'],
    categoryNames: ['telephone', 'internet', 'facture'],
    keywords: ['facture', 'internet', 'telephone', 'cellulaire', 'hydro', 'electricite'],
  },
];

const DISCRETIONARY_CATEGORY_TERMS = [
  'depense inutile',
  'depenses inutiles',
  'inutile',
  'non essentiel',
  'non essentiels',
  'discretionnaire',
  'extra',
  'plaisir',
  'loisir',
  'loisirs',
  'divertissement',
];

const GENERAL_FALLBACK_CATEGORY_TERMS = ['autre', 'autres', 'divers', 'general', 'misc', 'depenses'];

export function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizeSearch(input: string): string {
  return stripDiacritics(input.trim().toLowerCase())
    .replace(/['']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeSearch(input: string): string[] {
  const normalized = normalizeSearch(input);
  return normalized ? normalized.split(' ') : [];
}

function compactSearch(input: string): string {
  return normalizeSearch(input).replace(/\s+/g, '');
}

function tokenMatchesKeyword(token: string, keywordToken: string): boolean {
  if (token === keywordToken) return true;
  if (keywordToken.length < 4) return false;
  return token === `${keywordToken}s` || token === `${keywordToken}x`;
}

function tokenSequenceMatches(tokens: string[], keywordTokens: string[]): boolean {
  if (keywordTokens.length === 0 || keywordTokens.length > tokens.length) return false;

  for (let start = 0; start <= tokens.length - keywordTokens.length; start += 1) {
    const sequenceMatches = keywordTokens.every((keywordToken, offset) =>
      tokenMatchesKeyword(tokens[start + offset], keywordToken),
    );
    if (sequenceMatches) return true;
  }

  return false;
}

export function searchMatchesKeyword(text: string, keyword: string): boolean {
  const tokens = tokenizeSearch(text);
  const keywordTokens = tokenizeSearch(keyword);
  if (keywordTokens.length === 0) return false;

  if (keywordTokens.length === 1) {
    return tokens.some((token) => tokenMatchesKeyword(token, keywordTokens[0]));
  }

  if (tokenSequenceMatches(tokens, keywordTokens)) return true;

  const compactKeyword = compactSearch(keyword);
  return compactKeyword.length >= 8 && compactSearch(text).includes(compactKeyword);
}

function addUniqueCategory(target: Category[], category?: Category) {
  if (!category || target.some((item) => item.id === category.id)) return;
  target.push(category);
}

/** Keep inference/picker results inside the budget-active category set passed by callers. */
function pickAllowedCategoryId(categoryId: string | null | undefined, categories: Category[]): string | null {
  if (!categoryId) return null;
  return categories.some((category) => category.id === categoryId) ? categoryId : null;
}

function categoryNameMatches(category: Category, terms: string[]): boolean {
  return terms.some((term) => searchMatchesKeyword(category.name, term));
}

function findCategoriesByName(categories: Category[], terms: string[]): Category[] {
  return categories.filter((category) => categoryNameMatches(category, terms));
}

function getRuleCategoryMatches(rule: CategoryRule, categories: Category[]): Category[] {
  const allowedIds = new Set(categories.map((category) => category.id));
  const matches: Category[] = [];
  for (const id of rule.categoryIds) {
    if (!allowedIds.has(id)) continue;
    addUniqueCategory(matches, categories.find((category) => category.id === id));
  }
  for (const category of categories) {
    if (categoryNameMatches(category, rule.categoryNames)) {
      addUniqueCategory(matches, category);
    }
  }
  return matches;
}

export function getRelevantCategoryChoices(text: string, categories: Category[], selectedId: string | null): Category[] {
  const normalized = normalizeSearch(text);
  const matches: Category[] = [];

  if (normalized) {
    for (const rules of [CATEGORY_RULES, TRANSFER_REASON_RULES]) {
      for (const rule of rules) {
        const matchesKeyword = rule.keywords.some((keyword) => searchMatchesKeyword(normalized, keyword));
        if (!matchesKeyword) continue;

        for (const category of getRuleCategoryMatches(rule, categories)) {
          addUniqueCategory(matches, category);
        }
      }
    }
  }

  for (const category of findCategoriesByName(categories, DISCRETIONARY_CATEGORY_TERMS)) {
    addUniqueCategory(matches, category);
  }

  if (matches.length === 0) {
    for (const category of findCategoriesByName(categories, GENERAL_FALLBACK_CATEGORY_TERMS).slice(0, 2)) {
      addUniqueCategory(matches, category);
    }
  }

  addUniqueCategory(matches, categories.find((category) => category.id === selectedId));
  return matches.length > 0 ? matches : categories.slice(0, 1);
}

export function getCategorySearchChoices(query: string, categories: Category[], selectedId: string | null): Category[] {
  const normalized = normalizeSearch(query);
  const matches: Category[] = [];

  addUniqueCategory(matches, categories.find((category) => category.id === selectedId));

  const filtered = normalized
    ? categories.filter((category) => {
        const categoryName = normalizeSearch(category.name);
        const queryTokens = tokenizeSearch(query);
        return (
          categoryName.includes(normalized) ||
          queryTokens.every((token) => categoryName.split(' ').some((nameToken) => nameToken.startsWith(token)))
        );
      })
    : categories;

  for (const category of filtered.slice(0, 8)) {
    addUniqueCategory(matches, category);
  }

  return matches.slice(0, 8);
}

export function inferCategoryId(text: string, categories: Category[], fallbackId: string | null): string | null {
  const normalized = normalizeSearch(text);
  if (!normalized) return pickAllowedCategoryId(fallbackId, categories);

  const ruleSets = [CATEGORY_RULES, TRANSFER_REASON_RULES];
  for (const rules of ruleSets) {
    for (const rule of rules) {
      const matchesKeyword = rule.keywords.some((keyword) => searchMatchesKeyword(normalized, keyword));
      if (!matchesKeyword) continue;

      const [match] = getRuleCategoryMatches(rule, categories);
      const allowed = pickAllowedCategoryId(match?.id, categories);
      if (allowed) return allowed;
    }
  }

  const directCategoryMatch = categories.find((category) => {
    const categoryName = normalizeSearch(category.name);
    return categoryName.length >= 4 && searchMatchesKeyword(normalized, categoryName);
  });
  if (directCategoryMatch) return directCategoryMatch.id;

  return pickAllowedCategoryId(fallbackId, categories);
}

export function inferCategoryIdFromTransferReason(
  reason: string,
  categories: Category[],
  fallbackId: string | null,
): string | null {
  const normalized = normalizeSearch(reason);
  if (!normalized) return pickAllowedCategoryId(fallbackId, categories);

  for (const rule of TRANSFER_REASON_RULES) {
    const matchesKeyword = rule.keywords.some((keyword) => searchMatchesKeyword(normalized, keyword));
    if (!matchesKeyword) continue;

    const [match] = getRuleCategoryMatches(rule, categories);
    const allowed = pickAllowedCategoryId(match?.id, categories);
    if (allowed) return allowed;
  }

  return inferCategoryId(reason, categories, fallbackId);
}

export function inferCategoryForItem(
  itemName: string,
  categories: Category[],
  merchantHint?: string,
): Category | null {
  const categoryId = inferCategoryId(itemName, categories, null)
    ?? (merchantHint ? inferCategoryId(merchantHint, categories, null) : null);
  return categoryId ? categories.find((category) => category.id === categoryId) ?? null : null;
}

/** Split budget-active categories into an inferred suggestion and the rest. */
export function partitionBudgetCategories(
  categories: Category[],
  searchText: string,
  selectedId: string | null,
  options?: { transferReason?: string },
): { suggested: Category | null; others: Category[] } {
  const inferredId = options?.transferReason
    ? inferCategoryIdFromTransferReason(
        options.transferReason,
        categories,
        inferCategoryId(searchText, categories, null),
      )
    : inferCategoryId(searchText, categories, null);

  const suggestedId =
    pickAllowedCategoryId(inferredId, categories)
    ?? pickAllowedCategoryId(selectedId, categories)
    ?? categories[0]?.id
    ?? null;
  const suggested = suggestedId ? categories.find((category) => category.id === suggestedId) ?? null : null;
  const others = categories.filter((category) => category.id !== suggestedId);
  return { suggested, others };
}
