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

export const CATEGORY_COLOR_OPTIONS = [
  '#34D399',
  '#38BDF8',
  '#3B82F6',
  '#6366F1',
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
    color: '#38BDF8',
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
    color: '#3B82F6',
    defaultLimit: 0,
  },
  {
    id: 'cat-car-payment',
    name: 'Paiement d’auto',
    helper: 'Versement mensuel du véhicule',
    icon: 'car-sport-outline',
    color: '#38BDF8',
    defaultLimit: 0,
  },
  {
    id: 'cat-car-insurance',
    name: 'Assurance auto',
    helper: 'Prime d’assurance véhicule',
    icon: 'shield-checkmark-outline',
    color: '#6366F1',
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
    color: '#38BDF8',
    defaultLimit: 0,
  },
  {
    id: 'cat-education',
    name: 'Éducation',
    helper: 'Cours, livres et formation',
    icon: 'school-outline',
    color: '#3B82F6',
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
    color: '#38BDF8',
    defaultLimit: 0,
  },
];

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

export const CATEGORY_ICON_OPTIONS: IconName[] = [
  'basket-outline',
  'restaurant-outline',
  'cafe-outline',
  'flame-outline',
  'train-outline',
  'car-outline',
  'car-sport-outline',
  'construct-outline',
  'home-outline',
  'flash-outline',
  'phone-portrait-outline',
  'bag-handle-outline',
  'shirt-outline',
  'medkit-outline',
  'shield-checkmark-outline',
  'game-controller-outline',
  'airplane-outline',
  'school-outline',
  'gift-outline',
  'paw-outline',
  'hammer-outline',
  'receipt-outline',
  'cash-outline',
  'briefcase-outline',
  'swap-horizontal-outline',
  'trending-up-outline',
  'card-outline',
  'wallet-outline',
  'people-outline',
  'sparkles-outline',
  'barbell-outline',
  'laptop-outline',
  'storefront-outline',
  'pricetag-outline',
];

export const TRANSACTION_ICON_OPTIONS: IconName[] = [
  'receipt-outline',
  'storefront-outline',
  'basket-outline',
  'cart-outline',
  'restaurant-outline',
  'cafe-outline',
  'flame-outline',
  'train-outline',
  'car-outline',
  'home-outline',
  'flash-outline',
  'phone-portrait-outline',
  'repeat-outline',
  'bag-handle-outline',
  'shirt-outline',
  'medkit-outline',
  'shield-checkmark-outline',
  'game-controller-outline',
  'airplane-outline',
  'school-outline',
  'gift-outline',
  'paw-outline',
  'hammer-outline',
  'cash-outline',
  'briefcase-outline',
  'swap-horizontal-outline',
  'trending-up-outline',
  'card-outline',
  'wallet-outline',
  'people-outline',
  'sparkles-outline',
  'barbell-outline',
  'laptop-outline',
  'pricetag-outline',
];
