/**
 * Auto icon for savings goals from the goal name.
 * Southern / tropical destinations → MCI `palm-tree` (before generic travel → plane).
 */

export const DEFAULT_GOAL_ICON = 'flag-outline';

/** MCI palm — exists in @expo/vector-icons; not in Ionicons / MDI picker catalog. */
export const SOUTHERN_DESTINATION_ICON = 'palm-tree';

/** Southern / tropical vacation destinations (QC FR spellings). Checked before generic "voyage" → plane. */
export const SOUTHERN_DESTINATION_KEYWORDS = [
  'mexique',
  'mexico',
  'caraibe',
  'caraibes',
  'caribbean',
  'antilles',
  'cuba',
  'republique dominicaine',
  'dominicaine',
  'dominican',
  'punta cana',
  'jamaique',
  'jamaica',
  'bresil',
  'brazil',
  'colombie',
  'colombia',
  'costa rica',
  'panama',
  'perou',
  'peru',
  'equateur',
  'ecuador',
  'venezuela',
  'thailande',
  'thailand',
  'bali',
  'maldives',
  'martinique',
  'guadeloupe',
  'haiti',
  'porto rico',
  'puerto rico',
  'bahamas',
  'barbade',
  'barbados',
  'aruba',
  'curacao',
  'trinidad',
  'polynesie',
  'tahiti',
  'seychelles',
  'maurice',
  'mauritius',
  'fidji',
  'fiji',
  'philippines',
  'vietnam',
  'cambodge',
  'cambodia',
  'indonesie',
  'indonesia',
  'sri lanka',
  'cancun',
  'tulum',
  'riviera maya',
  'varadero',
];

const GENERIC_TRAVEL_ICONS = new Set([
  'airplane-outline',
  'airplane',
  'Flight',
]);

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function matchesAny(value: string, terms: readonly string[]) {
  return terms.some((term) => value.includes(term));
}

export function getAutomaticGoalIcon(name: string): string {
  const normalized = normalizeSearchText(name);
  if (matchesAny(normalized, ['urgence', 'emergency', 'securite', 'securité'])) {
    return 'shield-checkmark-outline';
  }
  // Tropical / southern country → palm (before generic travel plane)
  if (matchesAny(normalized, SOUTHERN_DESTINATION_KEYWORDS)) {
    return SOUTHERN_DESTINATION_ICON;
  }
  if (matchesAny(normalized, ['voyage', 'vacance', 'vacances', 'travel', 'trip', 'avion'])) {
    return 'airplane-outline';
  }
  if (matchesAny(normalized, ['maison', 'condo', 'logement', 'hypotheque', 'home'])) {
    return 'home-outline';
  }
  if (matchesAny(normalized, ['auto', 'voiture', 'vehicule', 'car'])) {
    return 'car-outline';
  }
  if (matchesAny(normalized, ['ecole', 'etude', 'universite', 'cours', 'school'])) {
    return 'school-outline';
  }
  if (matchesAny(normalized, ['cadeau', 'noel', 'anniversaire', 'gift'])) {
    return 'gift-outline';
  }
  if (matchesAny(normalized, ['mariage', 'amour', 'couple', 'coeur'])) {
    return 'heart-outline';
  }
  if (matchesAny(normalized, ['entreprise', 'business', 'travail', 'projet'])) {
    return 'briefcase-outline';
  }
  if (matchesAny(normalized, ['velo', 'bicycle'])) {
    return 'bicycle-outline';
  }
  if (matchesAny(normalized, ['retraite', 'placement', 'investissement', 'reer', 'celi'])) {
    return 'trophy-outline';
  }
  if (matchesAny(normalized, ['luxe', 'bijou', 'diamant'])) {
    return 'diamond-outline';
  }
  if (matchesAny(normalized, ['cash', 'argent', 'epargne', 'fonds'])) {
    return 'cash-outline';
  }
  return DEFAULT_GOAL_ICON;
}

/**
 * Icon to render for a saved goal.
 * Prefer stored icon, but upgrade stale generic travel plane → palm when the name is southern.
 */
export function resolveSavingsGoalDisplayIcon(goal: {
  name: string;
  icon?: string | null;
}): string {
  const auto = getAutomaticGoalIcon(goal.name);
  const stored = (goal.icon ?? '').trim();
  if (!stored) return auto;
  if (auto === SOUTHERN_DESTINATION_ICON && GENERIC_TRAVEL_ICONS.has(stored)) {
    return SOUTHERN_DESTINATION_ICON;
  }
  return stored;
}
