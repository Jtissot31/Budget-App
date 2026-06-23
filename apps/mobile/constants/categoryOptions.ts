import { Ionicons } from '@expo/vector-icons';
import type { Category } from '@/types';

export type IconName = keyof typeof Ionicons.glyphMap;

export type BudgetPreset = Omit<Category, 'icon'> & {
  icon: IconName;
  helper: string;
  defaultLimit: number;
};

export const DEPRECATED_BUDGET_CATEGORY_IDS = ['cat-subscriptions'] as const;

export const INCOME_CATEGORY: Category = {
  id: 'cat-income',
  name: 'Revenus',
  icon: 'cash-outline',
  color: '#14B8A6',
};

export const TRANSFER_CATEGORY: Category = {
  id: 'cat-transfer',
  name: 'Transferts',
  icon: 'swap-horizontal-outline',
  color: '#64748B',
};

/** Internal placeholder for transactions without a user-selected category (SQLite FK only). */
export const UNCATEGORIZED_TRANSACTION_CATEGORY: Category = {
  id: 'cat-uncategorized',
  name: '',
  icon: 'ellipse-outline',
  color: '#64748B',
};

export const CATEGORY_COLOR_OPTIONS = [
  '#34D399',
  '#14B8A6',
  '#00A854',
  '#8B5CF6',
  '#8B5CF6',
  '#D946EF',
  '#EC4899',
  '#FB7185',
  '#FBBF24',
  '#F97316',
  '#14B8A6',
  '#64748B',
] as const;

export const BUDGET_PRESETS: BudgetPreset[] = [
  {
    id: 'cat-home',
    name: 'Appartement / maison',
    helper: 'Loyer, hypothèque, frais de logement',
    icon: 'home-outline',
    color: '#8B5CF6',
    defaultLimit: 0,
  },
  {
    id: 'cat-utilities',
    name: 'Électricité / services',
    helper: 'Hydro, chauffage, eau et services publics',
    icon: 'flash-outline',
    color: '#FBBF24',
    defaultLimit: 0,
  },
  {
    id: 'cat-phone',
    name: 'Téléphone / internet',
    helper: 'Cellulaire, internet et forfaits',
    icon: 'phone-portrait-outline',
    color: '#14B8A6',
    defaultLimit: 0,
  },
  {
    id: 'cat-food',
    name: 'Épicerie',
    helper: 'Courses et produits essentiels',
    icon: 'basket-outline',
    color: '#34D399',
    defaultLimit: 400,
  },
  {
    id: 'cat-rest',
    name: 'Restaurants / cafés',
    helper: 'Sorties, cafés et livraison',
    icon: 'restaurant-outline',
    color: '#F97316',
    defaultLimit: 200,
  },
  {
    id: 'cat-gas',
    name: 'Essence',
    helper: 'Carburant et recharge',
    icon: 'flame-outline',
    color: '#FB7185',
    defaultLimit: 150,
  },
  {
    id: 'cat-transport',
    name: 'Transport',
    helper: 'Transport en commun, taxi et stationnement',
    icon: 'train-outline',
    color: '#00A854',
    defaultLimit: 0,
  },
  {
    id: 'cat-car-payment',
    name: 'Paiement d’auto',
    helper: 'Versement mensuel du véhicule',
    icon: 'car-sport-outline',
    color: '#14B8A6',
    defaultLimit: 0,
  },
  {
    id: 'cat-car-insurance',
    name: 'Assurance auto',
    helper: 'Prime d’assurance véhicule',
    icon: 'shield-checkmark-outline',
    color: '#8B5CF6',
    defaultLimit: 0,
  },
  {
    id: 'cat-car-emergency',
    name: 'Entretien auto',
    helper: 'Réparations, pneus et entretien',
    icon: 'construct-outline',
    color: '#FBBF24',
    defaultLimit: 0,
  },
  {
    id: 'cat-shopping',
    name: 'Magasinage',
    helper: 'Achats divers et boutiques',
    icon: 'bag-handle-outline',
    color: '#EC4899',
    defaultLimit: 0,
  },
  {
    id: 'cat-clothing',
    name: 'Vêtements',
    helper: 'Vêtements, chaussures et accessoires',
    icon: 'shirt-outline',
    color: '#D946EF',
    defaultLimit: 0,
  },
  {
    id: 'cat-health',
    name: 'Santé / pharmacie',
    helper: 'Pharmacie, soins médicaux et santé',
    icon: 'medkit-outline',
    color: '#34D399',
    defaultLimit: 0,
  },
  {
    id: 'cat-insurance',
    name: 'Assurances',
    helper: 'Assurance habitation, vie et autres protections',
    icon: 'shield-checkmark-outline',
    color: '#64748B',
    defaultLimit: 0,
  },
  {
    id: 'cat-fun',
    name: 'Loisirs',
    helper: 'Divertissement, sorties et activités',
    icon: 'game-controller-outline',
    color: '#8B5CF6',
    defaultLimit: 80,
  },
  {
    id: 'cat-travel',
    name: 'Voyages',
    helper: 'Billets, hôtels et déplacements',
    icon: 'airplane-outline',
    color: '#14B8A6',
    defaultLimit: 0,
  },
  {
    id: 'cat-education',
    name: 'Éducation',
    helper: 'Cours, livres et formation',
    icon: 'school-outline',
    color: '#00A854',
    defaultLimit: 0,
  },
  {
    id: 'cat-gifts',
    name: 'Cadeaux',
    helper: 'Cadeaux, dons et occasions spéciales',
    icon: 'gift-outline',
    color: '#FB7185',
    defaultLimit: 0,
  },
  {
    id: 'cat-pets',
    name: 'Animaux',
    helper: 'Nourriture, vétérinaire et accessoires',
    icon: 'paw-outline',
    color: '#F97316',
    defaultLimit: 0,
  },
  {
    id: 'cat-home-maintenance',
    name: 'Entretien maison',
    helper: 'Réparations, meubles et équipements',
    icon: 'hammer-outline',
    color: '#64748B',
    defaultLimit: 0,
  },
  {
    id: 'cat-taxes-fees',
    name: 'Taxes / frais',
    helper: 'Taxes, frais bancaires et frais administratifs',
    icon: 'receipt-outline',
    color: '#64748B',
    defaultLimit: 0,
  },
  {
    id: 'cat-savings',
    name: 'Épargne',
    helper: 'Mise de côté et objectifs',
    icon: 'trending-up-outline',
    color: '#34D399',
    defaultLimit: 0,
  },
  {
    id: 'cat-debt',
    name: 'Dette / carte de crédit',
    helper: 'Remboursement de dettes et cartes',
    icon: 'card-outline',
    color: '#FB7185',
    defaultLimit: 0,
  },
  {
    id: 'cat-bank-loan',
    name: 'Prêt bancaire',
    helper: 'Remboursement mensuel des prêts',
    icon: 'cash-outline',
    color: '#14B8A6',
    defaultLimit: 0,
  },
  {
    id: 'cat-family',
    name: 'Famille / enfants',
    helper: 'Garderie, enfants et dépenses familiales',
    icon: 'people-outline',
    color: '#FBBF24',
    defaultLimit: 0,
  },
  {
    id: 'cat-personal-care',
    name: 'Soins personnels',
    helper: 'Coiffure, esthétique et bien-être',
    icon: 'sparkles-outline',
    color: '#D946EF',
    defaultLimit: 0,
  },
  {
    id: 'cat-sports',
    name: 'Sports',
    helper: 'Gym, équipement et activités sportives',
    icon: 'barbell-outline',
    color: '#14B8A6',
    defaultLimit: 0,
  },
  {
    id: 'cat-electronics',
    name: 'Électronique',
    helper: 'Appareils, accessoires et logiciels',
    icon: 'laptop-outline',
    color: '#14B8A6',
    defaultLimit: 0,
  },
];

/** Profil budget par défaut — utilisateur moyen (~10 catégories actives). */
const AVERAGE_USER_BUDGET_LIMITS: Record<string, number> = {
  'cat-home': 1350,
  'cat-utilities': 165,
  'cat-phone': 95,
  'cat-food': 450,
  'cat-rest': 175,
  'cat-gas': 130,
  'cat-transport': 85,
  'cat-shopping': 110,
  'cat-health': 55,
  'cat-fun': 95,
};

const AVERAGE_USER_BUDGET_IDS = [
  'cat-home',
  'cat-utilities',
  'cat-phone',
  'cat-food',
  'cat-rest',
  'cat-gas',
  'cat-transport',
  'cat-shopping',
  'cat-health',
  'cat-fun',
] as const;

export const AVERAGE_USER_BUDGET_PRESETS: BudgetPreset[] = AVERAGE_USER_BUDGET_IDS.map((id) => {
  const preset = BUDGET_PRESETS.find((entry) => entry.id === id);
  if (!preset) throw new Error(`Missing budget preset: ${id}`);
  return { ...preset, defaultLimit: AVERAGE_USER_BUDGET_LIMITS[id] ?? preset.defaultLimit };
});

export const AVERAGE_USER_MONTHLY_BUDGET_TOTAL = AVERAGE_USER_BUDGET_PRESETS.reduce(
  (sum, preset) => sum + preset.defaultLimit,
  0,
);

export const DEFAULT_CATEGORIES: Category[] = [
  ...BUDGET_PRESETS.map(({ id, name, icon, color }) => ({ id, name, icon, color })),
  INCOME_CATEGORY,
];

const CATEGORY_ICON_BY_ID: Record<string, IconName> = Object.fromEntries(
  [...BUDGET_PRESETS, INCOME_CATEGORY, TRANSFER_CATEGORY].map((category) => [category.id, category.icon]),
) as Record<string, IconName>;

type CategoryIconSource = {
  id?: string;
  name?: string;
  icon?: string | null;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string | null;
};

export function isIconName(name?: string | null): name is IconName {
  return Boolean(name && Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, name));
}

export function getCategoryIconName(category?: CategoryIconSource | null): IconName {
  const icon = category?.icon ?? category?.categoryIcon;
  if (isIconName(icon)) return icon;

  const id = category?.id ?? category?.categoryId;
  if (id && CATEGORY_ICON_BY_ID[id]) return CATEGORY_ICON_BY_ID[id];

  const name = normalizeLabel(category?.name ?? category?.categoryName ?? '');
  if (name.includes('revenu') || name.includes('salaire') || name.includes('paie')) return INCOME_CATEGORY.icon as IconName;
  if (name.includes('transfert')) return TRANSFER_CATEGORY.icon as IconName;
  if (name.includes('epicerie') || name.includes('alimentation')) return 'basket-outline';
  if (name.includes('restaurant') || name.includes('cafe')) return 'restaurant-outline';
  if (name.includes('essence') || name.includes('gas')) return 'flame-outline';
  if (name.includes('transport')) return 'train-outline';
  if (name.includes('logement') || name.includes('maison') || name.includes('appartement')) return 'home-outline';
  if (name.includes('loisir') || name.includes('divertissement')) return 'game-controller-outline';

  return 'pricetag-outline';
}

function normalizeLabel(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}

export type IconPickerOption = {
  id: string;
  label: string;
  icon: IconName;
  color: string;
};

/** Curated manual icons — shared across transactions, recurring payments, and budgets. */
export const MANUAL_ICON_PICKER_OPTIONS: IconPickerOption[] = [
  { id: 'home', label: 'Logement', icon: 'home-outline', color: '#8B5CF6' },
  { id: 'utilities', label: 'Électricité', icon: 'flash-outline', color: '#FBBF24' },
  { id: 'internet', label: 'Internet', icon: 'wifi-outline', color: '#14B8A6' },
  { id: 'phone', label: 'Téléphone', icon: 'phone-portrait-outline', color: '#22C55E' },
  { id: 'water', label: 'Eau', icon: 'water-outline', color: '#38BDF8' },
  { id: 'car', label: 'Auto', icon: 'car-sport-outline', color: '#FB7185' },
  { id: 'gas', label: 'Essence', icon: 'flame-outline', color: '#F97316' },
  { id: 'transit', label: 'Transport', icon: 'bus-outline', color: '#00A854' },
  { id: 'groceries', label: 'Épicerie', icon: 'basket-outline', color: '#34D399' },
  { id: 'restaurant', label: 'Restaurant', icon: 'restaurant-outline', color: '#F97316' },
  { id: 'cafe', label: 'Café', icon: 'cafe-outline', color: '#D97706' },
  { id: 'nightout', label: 'Sortie', icon: 'beer-outline', color: '#EAB308' },
  { id: 'subscription', label: 'Abonnement', icon: 'tv-outline', color: '#F43F5E' },
  { id: 'music', label: 'Musique', icon: 'musical-notes-outline', color: '#EC4899' },
  { id: 'gaming', label: 'Jeux', icon: 'game-controller-outline', color: '#8B5CF6' },
  { id: 'gym', label: 'Gym', icon: 'barbell-outline', color: '#34D399' },
  { id: 'cinema', label: 'Cinéma', icon: 'film-outline', color: '#A78BFA' },
  { id: 'shopping', label: 'Shopping', icon: 'bag-handle-outline', color: '#D946EF' },
  { id: 'clothing', label: 'Vêtements', icon: 'shirt-outline', color: '#FB7185' },
  { id: 'beauty', label: 'Beauté', icon: 'cut-outline', color: '#F472B6' },
  { id: 'health', label: 'Santé', icon: 'medkit-outline', color: '#EF4444' },
  { id: 'pets', label: 'Animaux', icon: 'paw-outline', color: '#F59E0B' },
  { id: 'bill', label: 'Facture', icon: 'receipt-outline', color: '#64748B' },
  { id: 'insurance', label: 'Assurance', icon: 'shield-checkmark-outline', color: '#F97316' },
  { id: 'card', label: 'Carte', icon: 'card-outline', color: '#94A3B8' },
  { id: 'wallet', label: 'Portefeuille', icon: 'wallet-outline', color: '#14B8A6' },
  { id: 'income', label: 'Revenu', icon: 'cash-outline', color: '#00A854' },
  { id: 'salary', label: 'Paie', icon: 'briefcase-outline', color: '#00A854' },
  { id: 'investment', label: 'Placement', icon: 'trending-up-outline', color: '#22C55E' },
  { id: 'travel', label: 'Voyage', icon: 'airplane-outline', color: '#38BDF8' },
  { id: 'hotel', label: 'Hôtel', icon: 'bed-outline', color: '#818CF8' },
  { id: 'education', label: 'Études', icon: 'school-outline', color: '#6366F1' },
  { id: 'gift', label: 'Cadeau', icon: 'gift-outline', color: '#EC4899' },
  { id: 'repair', label: 'Réparation', icon: 'build-outline', color: '#78716C' },
  { id: 'family', label: 'Famille', icon: 'people-outline', color: '#F472B6' },
  { id: 'other', label: 'Autre', icon: 'ellipsis-horizontal-circle-outline', color: '#94A3B8' },
];

/** Curated icons for savings goals. */
export const GOAL_ICON_PICKER_OPTIONS: IconPickerOption[] = [
  { id: 'flag', label: 'Objectif', icon: 'flag-outline', color: '#00A854' },
  { id: 'rocket', label: 'Projet', icon: 'rocket-outline', color: '#8B5CF6' },
  { id: 'trophy', label: 'Réussite', icon: 'trophy-outline', color: '#FBBF24' },
  { id: 'diamond', label: 'Luxe', icon: 'diamond-outline', color: '#38BDF8' },
  { id: 'star', label: 'Priorité', icon: 'star-outline', color: '#FACC15' },
  { id: 'home', label: 'Maison', icon: 'home-outline', color: '#A78BFA' },
  { id: 'car', label: 'Auto', icon: 'car-sport-outline', color: '#FB7185' },
  { id: 'travel', label: 'Voyage', icon: 'airplane-outline', color: '#38BDF8' },
  { id: 'education', label: 'Études', icon: 'school-outline', color: '#6366F1' },
  { id: 'wedding', label: 'Mariage', icon: 'heart-outline', color: '#EC4899' },
  { id: 'emergency', label: 'Urgence', icon: 'umbrella-outline', color: '#14B8A6' },
  { id: 'invest', label: 'Placement', icon: 'trending-up-outline', color: '#22C55E' },
  { id: 'wallet', label: 'Épargne', icon: 'wallet-outline', color: '#00A854' },
  { id: 'family', label: 'Famille', icon: 'people-outline', color: '#F472B6' },
  { id: 'health', label: 'Santé', icon: 'fitness-outline', color: '#10B981' },
  { id: 'gift', label: 'Cadeau', icon: 'gift-outline', color: '#EC4899' },
  { id: 'bike', label: 'Vélo', icon: 'bicycle-outline', color: '#34D399' },
  { id: 'tech', label: 'Techno', icon: 'laptop-outline', color: '#64748B' },
  { id: 'nature', label: 'Nature', icon: 'leaf-outline', color: '#34D399' },
  { id: 'cash', label: 'Fonds', icon: 'cash-outline', color: '#00A854' },
];

function uniqueIconNames(icons: IconName[]): IconName[] {
  return [...new Set(icons)];
}

export function getIconPickerOptionByIcon(
  icon: IconName,
  options: IconPickerOption[] = MANUAL_ICON_PICKER_OPTIONS,
): IconPickerOption | undefined {
  return options.find((option) => option.icon === icon);
}

export const TRANSACTION_ICON_OPTIONS: IconName[] = MANUAL_ICON_PICKER_OPTIONS.map((option) => option.icon);

const CATEGORY_EXTRA_ICON_OPTIONS: IconPickerOption[] = [
  { id: 'store', label: 'Commerce', icon: 'storefront-outline', color: '#94A3B8' },
  { id: 'tech', label: 'Techno', icon: 'laptop-outline', color: '#64748B' },
  { id: 'deals', label: 'Promo', icon: 'pricetag-outline', color: '#F97316' },
  { id: 'tools', label: 'Outils', icon: 'hammer-outline', color: '#78716C' },
  { id: 'maintenance', label: 'Entretien', icon: 'construct-outline', color: '#78716C' },
  { id: 'train', label: 'Train', icon: 'train-outline', color: '#00A854' },
  { id: 'misc', label: 'Divers', icon: 'sparkles-outline', color: '#8B5CF6' },
  { id: 'transfer', label: 'Transfert', icon: 'swap-horizontal-outline', color: '#64748B' },
];

export const CATEGORY_ICON_PICKER_OPTIONS: IconPickerOption[] = [
  ...MANUAL_ICON_PICKER_OPTIONS,
  ...CATEGORY_EXTRA_ICON_OPTIONS.filter(
    (extra) => !MANUAL_ICON_PICKER_OPTIONS.some((option) => option.icon === extra.icon),
  ),
];

export const CATEGORY_ICON_OPTIONS: IconName[] = CATEGORY_ICON_PICKER_OPTIONS.map((option) => option.icon);

export const GOAL_ICON_OPTIONS: IconName[] = GOAL_ICON_PICKER_OPTIONS.map((option) => option.icon);
