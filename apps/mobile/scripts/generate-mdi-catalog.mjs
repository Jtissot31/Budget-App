import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '..', 'src', 'icons');
const outFile = path.join(__dirname, '..', 'lib', 'mdiIconCatalog.ts');

const FRENCH_LABELS = {
  Apartments1StoryGabledRoof: 'Maison à pignon',
  AlertFilled: 'Alerte',
  AlertDiamondFill: 'Alerte diamant',
  Chat: 'Discussion',
  Plus: 'Ajouter',
  Transfer: 'Transfert',
  RecurringEvent: 'Récurrent',
  ShoppingBag4Fill: 'Sac courses',
  PencilSquare: 'Modifier',
  Home: 'Accueil',
  Menu: 'Menu',
  Close: 'Fermer',
  Search: 'Recherche',
  Settings: 'Paramètres',
  ArrowBack: 'Retour',
  Notifications: 'Notifications',
  Edit: 'Éditer',
  Delete: 'Supprimer',
  FilterList: 'Filtrer',
  Check: 'Cocher',
  MoreVert: 'Plus',
  Person: 'Personne',
  Restaurant: 'Restaurant',
  LocalCafe: 'Café',
  LocalGroceryStore: 'Épicerie',
  Fastfood: 'Restauration rapide',
  DirectionsCar: 'Auto',
  DirectionsBus: 'Autobus',
  LocalGasStation: 'Essence',
  Flight: 'Vol',
  Train: 'Train',
  ShoppingCart: 'Panier',
  LocalMall: 'Centre commercial',
  Storefront: 'Commerce',
  HouseMdi: 'Maison',
  Apartment: 'Appartement',
  Chair: 'Meuble',
  ElectricalServices: 'Électricité',
  Water: 'Eau',
  LocalHospital: 'Hôpital',
  LocalPharmacy: 'Pharmacie',
  FitnessCenter: 'Gym',
  MedicalServices: 'Santé',
  Movie: 'Cinéma',
  MusicNote: 'Musique',
  Sports: 'Sport',
  SportsEsports: 'Jeux',
  School: 'École',
  MenuBook: 'Livre',
  Hotel: 'Hôtel',
  Luggage: 'Voyage',
  Savings: 'Épargne',
  Star: 'Étoile',
  EmojiEvents: 'Trophée',
  MyLocation: 'Localisation',
  Payments: 'Paiements',
  Work: 'Travail',
  Business: 'Entreprise',
  CreditCard: 'Carte de crédit',
  AccountBalance: 'Banque',
  LocalAtm: 'Guichet',
  AccountBalanceWallet: 'Portefeuille',
  AttachMoney: 'Argent',
  SwapHoriz: 'Échange',
  TrendingUp: 'Hausse',
  TrendingDown: 'Baisse',
  WarningMdi: 'Avertissement',
  ErrorMdi: 'Erreur',
  InfoIcon: 'Info',
  NotificationImportant: 'Notification importante',
};

const IONICONS_TO_MDI = {
  'home-outline': 'HouseMdi',
  'flash-outline': 'ElectricalServices',
  'wifi-outline': 'ElectricalServices',
  'phone-portrait-outline': 'Notifications',
  'water-outline': 'Water',
  'car-sport-outline': 'DirectionsCar',
  'flame-outline': 'LocalGasStation',
  'bus-outline': 'DirectionsBus',
  'basket-outline': 'LocalGroceryStore',
  'restaurant-outline': 'Restaurant',
  'cafe-outline': 'LocalCafe',
  'beer-outline': 'LocalCafe',
  'tv-outline': 'Movie',
  'musical-notes-outline': 'MusicNote',
  'game-controller-outline': 'SportsEsports',
  'barbell-outline': 'FitnessCenter',
  'film-outline': 'Movie',
  'bag-handle-outline': 'ShoppingBag4Fill',
  'shirt-outline': 'LocalMall',
  'cut-outline': 'Person',
  'medkit-outline': 'MedicalServices',
  'paw-outline': 'Person',
  'receipt-outline': 'Payments',
  'shield-checkmark-outline': 'Payments',
  'card-outline': 'CreditCard',
  'wallet-outline': 'AccountBalanceWallet',
  'cash-outline': 'AttachMoney',
  'briefcase-outline': 'Work',
  'trending-up-outline': 'TrendingUp',
  'airplane-outline': 'Flight',
  'bed-outline': 'Hotel',
  'school-outline': 'School',
  'gift-outline': 'Star',
  'build-outline': 'Edit',
  'people-outline': 'Person',
  'ellipsis-horizontal-circle-outline': 'MoreVert',
  'flag-outline': 'EmojiEvents',
  'rocket-outline': 'TrendingUp',
  'trophy-outline': 'EmojiEvents',
  'diamond-outline': 'Star',
  'star-outline': 'Star',
  'heart-outline': 'Star',
  'umbrella-outline': 'Payments',
  'fitness-outline': 'FitnessCenter',
  'bicycle-outline': 'Sports',
  'laptop-outline': 'Work',
  'leaf-outline': 'Star',
  'storefront-outline': 'Storefront',
  'pricetag-outline': 'LocalMall',
  'hammer-outline': 'Edit',
  'construct-outline': 'Edit',
  'train-outline': 'Train',
  'sparkles-outline': 'Star',
  'swap-horizontal-outline': 'SwapHoriz',
  'repeat-outline': 'RecurringEvent',
  'business-outline': 'Business',
};

function parseIconFile(filePath, name) {
  const content = fs.readFileSync(filePath, 'utf8');
  const viewBoxMatch = content.match(/viewBox="([^"]+)"/);
  const paths = [...content.matchAll(/<path[^>]*d="([^"]+)"/g)].map((m) => m[1]);
  if (!paths.length) return null;
  return {
    name,
    label: FRENCH_LABELS[name] ?? name.replace(/([A-Z])/g, ' $1').trim(),
    viewBox: viewBoxMatch?.[1] ?? '0 0 24 24',
    paths,
  };
}

const files = fs.readdirSync(iconsDir).filter((f) => f.endsWith('.jsx'));
const icons = files
  .map((file) => parseIconFile(path.join(iconsDir, file), file.replace('.jsx', '')))
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

const source = `/** Auto-generated from src/icons — do not edit manually. Run: node scripts/generate-mdi-catalog.mjs */
export type MdiIconName = ${icons.map((i) => `'${i.name}'`).join(' | ')};

export type MdiIconDef = {
  name: MdiIconName;
  label: string;
  viewBox: string;
  paths: string[];
};

export const MDI_ICON_CATALOG: MdiIconDef[] = ${JSON.stringify(icons, null, 2)} as const;

export const EXPENSE_MDI_ICON: MdiIconName = 'ShoppingBag4Fill';

export const WELL_GLYPH_WHITE = '#FFFFFF';

const MDI_ICON_NAMES = new Set<string>(MDI_ICON_CATALOG.map((icon) => icon.name));

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\\p{M}/gu, '')
    .trim()
    .toLowerCase();
}

export function isMdiIconName(value?: string | null): value is MdiIconName {
  return Boolean(value && MDI_ICON_NAMES.has(value));
}

export function getMdiIconDef(name: string): MdiIconDef | undefined {
  return MDI_ICON_CATALOG.find((icon) => icon.name === name);
}

export function searchMdiIcons(query: string): MdiIconDef[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return MDI_ICON_CATALOG;
  return MDI_ICON_CATALOG.filter((icon) => {
    const haystack = normalizeSearchText(\`\${icon.name} \${icon.label}\`);
    return haystack.includes(normalized);
  });
}

/** Legacy Ionicons glyph names mapped to MDI catalog entries. */
export const IONICONS_TO_MDI: Record<string, MdiIconName> = ${JSON.stringify(IONICONS_TO_MDI, null, 2)} as const;

export function resolveStoredIconToMdi(icon?: string | null): MdiIconName | null {
  if (!icon) return null;
  if (isMdiIconName(icon)) return icon;
  return IONICONS_TO_MDI[icon] ?? null;
}

export function resolveMdiOrLegacyIcon(icon?: string | null): MdiIconName {
  return resolveStoredIconToMdi(icon) ?? 'Payments';
}
`;

fs.writeFileSync(outFile, source, 'utf8');
console.log(`Wrote ${icons.length} icons to ${outFile}`);
