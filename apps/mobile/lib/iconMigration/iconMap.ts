import type { LegacyIconFamily } from './legacyIconBackup';

export type LegacyIconKey = `${LegacyIconFamily}:${string}`;

function key(family: LegacyIconFamily, name: string): LegacyIconKey {
  return `${family}:${name}`;
}

/**
 * Maps legacy vector icon identifiers → Lucide icon names (PascalCase).
 * AppIcon only renders Lucide when the target name is in designSystemLucideSelection.json.
 */
export const LEGACY_TO_LUCIDE_MAP: Partial<Record<LegacyIconKey, string>> = {
  // Tab bar (Material Community)
  [key('material-community', 'home')]: 'House',
  [key('material-community', 'home-outline')]: 'House',
  [key('material-community', 'receipt-text')]: 'ReceiptText',
  [key('material-community', 'receipt-text-outline')]: 'ReceiptText',
  [key('material-community', 'wallet')]: 'Wallet',
  [key('material-community', 'wallet-outline')]: 'Wallet',
  [key('material-community', 'chart-pie')]: 'ChartPie',
  [key('material-community', 'chart-pie-outline')]: 'ChartPie',
  [key('material-community', 'flag')]: 'Goal',
  [key('material-community', 'flag-outline')]: 'Goal',
  [key('material-community', 'compass')]: 'Compass',
  [key('material-community', 'compass-outline')]: 'Compass',

  // Ionicons — navigation & chrome
  [key('ionicons', 'chevron-up')]: 'ChevronUp',
  [key('ionicons', 'home-outline')]: 'House',

  // Actions
  [key('ionicons', 'search-outline')]: 'Search',
  [key('ionicons', 'scan-outline')]: 'ScanLine',
  [key('ionicons', 'filter-outline')]: 'ListFilter',
  [key('ionicons', 'filter')]: 'ListFilter',

  // Finance / accounts
  [key('ionicons', 'wallet-outline')]: 'Wallet',
  [key('ionicons', 'wallet')]: 'Wallet',
  [key('ionicons', 'business-outline')]: 'Store',
  [key('ionicons', 'receipt-outline')]: 'ReceiptText',
  [key('ionicons', 'cash-outline')]: 'HandCoins',
  [key('ionicons', 'cash-banknotes-outline')]: 'CashBanknotesStack',
  [key('ionicons', 'swap-horizontal-outline')]: 'ArrowLeftRight',
  [key('ionicons', 'arrow-down-circle-outline')]: 'BanknoteArrowDown',
  [key('ionicons', 'trending-up-outline')]: 'TrendingUp',
  [key('ionicons', 'trending-down-outline')]: 'TrendingDown',
  [key('ionicons', 'pie-chart-outline')]: 'ChartPie',

  // People / contacts
  [key('ionicons', 'person-outline')]: 'ContactRound',
  [key('ionicons', 'person')]: 'ContactRound',
  [key('ionicons', 'person-add-outline')]: 'ContactRound',

  // AI / insights
  [key('ionicons', 'sparkles-outline')]: 'Brain',
  [key('material', 'auto-awesome')]: 'Brain',
  [key('material-community', 'sparkles')]: 'Brain',
  [key('material-community', 'alert-circle-outline')]: 'CircleAlert',

  // Paycheck / shields / cards
  [key('material-community', 'shield-outline')]: 'Shield',
  [key('material-community', 'shield-check-outline')]: 'ShieldCheck',
  [key('material-community', 'credit-card-outline')]: 'CreditCard',
  [key('material-community', 'home-outline')]: 'House',

  // Visibility
  [key('material-community', 'eye-outline')]: 'Eye',
  [key('material-community', 'eye-off-outline')]: 'EyeOff',

  // Upload / sync
  [key('ionicons', 'cloud-upload-outline')]: 'Upload',
  [key('ionicons', 'cloud-outline')]: 'CloudSync',

  // Ionicons — navigation & chrome
  [key('ionicons', 'arrow-back')]: 'ArrowLeft',
  [key('ionicons', 'arrow-forward')]: 'ArrowRight',
  [key('ionicons', 'arrow-forward-outline')]: 'ArrowRight',
  [key('ionicons', 'arrow-up')]: 'ArrowUp',
  [key('ionicons', 'caret-down')]: 'ChevronDown',
  [key('ionicons', 'chevron-back')]: 'ChevronLeft',
  [key('ionicons', 'chevron-down')]: 'ChevronDown',
  [key('ionicons', 'chevron-forward')]: 'ChevronRight',
  [key('ionicons', 'close')]: 'X',
  [key('ionicons', 'close-circle')]: 'CircleX',
  [key('ionicons', 'grid-outline')]: 'LayoutGrid',
  [key('ionicons', 'options-outline')]: 'SlidersHorizontal',
  [key('ionicons', 'settings-outline')]: 'Settings',

  // Ionicons — actions
  [key('ionicons', 'add')]: 'Plus',
  [key('ionicons', 'add-outline')]: 'Plus',
  [key('ionicons', 'add-circle-outline')]: 'CirclePlus',
  [key('ionicons', 'checkmark')]: 'Check',
  [key('ionicons', 'checkmark-circle')]: 'CircleCheck',
  [key('ionicons', 'checkmark-circle-outline')]: 'CircleCheck',
  [key('ionicons', 'checkmark-done-outline')]: 'CheckCheck',
  [key('ionicons', 'create-outline')]: 'PenLine',
  [key('ionicons', 'download-outline')]: 'Download',
  [key('ionicons', 'ellipsis-horizontal')]: 'Ellipsis',
  [key('ionicons', 'ellipsis-horizontal-circle-outline')]: 'CircleEllipsis',
  [key('ionicons', 'pencil-outline')]: 'Pencil',
  [key('ionicons', 'search')]: 'Search',
  [key('ionicons', 'share-outline')]: 'Share',
  [key('ionicons', 'trash-outline')]: 'Trash2',

  // Ionicons — notifications
  [key('ionicons', 'notifications')]: 'Bell',
  [key('ionicons', 'notifications-outline')]: 'Bell',
  [key('ionicons', 'notifications-off-outline')]: 'BellOff',

  // Ionicons — finance & charts
  [key('ionicons', 'bar-chart-outline')]: 'ChartNoAxesColumn',
  [key('ionicons', 'card-outline')]: 'CreditCard',
  [key('ionicons', 'credit-card-outline')]: 'CreditCard',
  [key('ionicons', 'stats-chart-outline')]: 'ChartNoAxesColumn',
  [key('ionicons', 'trending-up')]: 'TrendingUp',

  // Ionicons — calendar & time
  [key('ionicons', 'alarm-outline')]: 'AlarmClock',
  [key('ionicons', 'calendar-clear-outline')]: 'CalendarX',
  [key('ionicons', 'calendar-outline')]: 'Calendar',
  [key('ionicons', 'hourglass-outline')]: 'Hourglass',
  [key('ionicons', 'repeat-outline')]: 'Repeat',
  [key('ionicons', 'time-outline')]: 'Clock',
  [key('ionicons', 'timer-outline')]: 'Timer',

  // Ionicons — documents & lists
  [key('ionicons', 'document-text-outline')]: 'FileText',
  [key('ionicons', 'list-outline')]: 'List',

  // Ionicons — media & capture
  [key('ionicons', 'camera-outline')]: 'Camera',
  [key('ionicons', 'flash-outline')]: 'Zap',
  [key('ionicons', 'image-outline')]: 'Image',
  [key('ionicons', 'images-outline')]: 'Images',
  [key('ionicons', 'mic-outline')]: 'Mic',

  // Ionicons — travel & places
  [key('ionicons', 'airplane-outline')]: 'Plane',
  [key('ionicons', 'bed-outline')]: 'Bed',
  [key('ionicons', 'bus-outline')]: 'Bus',
  [key('ionicons', 'car-outline')]: 'Car',
  [key('ionicons', 'car-sport-outline')]: 'CarFront',
  [key('ionicons', 'globe-outline')]: 'Globe',
  [key('ionicons', 'locate-outline')]: 'LocateFixed',
  [key('ionicons', 'location-outline')]: 'MapPin',
  [key('ionicons', 'train-outline')]: 'TrainFront',

  // Ionicons — shopping & food
  [key('ionicons', 'bag-handle-outline')]: 'ShoppingBag',
  [key('ionicons', 'basket-outline')]: 'ShoppingBasket',
  [key('ionicons', 'beer-outline')]: 'Beer',
  [key('ionicons', 'bicycle-outline')]: 'Bike',
  [key('ionicons', 'cafe-outline')]: 'Coffee',
  [key('ionicons', 'pricetag-outline')]: 'Tag',
  [key('ionicons', 'restaurant-outline')]: 'Utensils',
  [key('ionicons', 'storefront-outline')]: 'Store',

  // Ionicons — health & fitness
  [key('ionicons', 'barbell-outline')]: 'Dumbbell',
  [key('ionicons', 'fitness-outline')]: 'HeartPulse',
  [key('ionicons', 'medkit-outline')]: 'BriefcaseMedical',

  // Ionicons — entertainment
  [key('ionicons', 'film-outline')]: 'Film',
  [key('ionicons', 'game-controller-outline')]: 'Gamepad2',
  [key('ionicons', 'musical-notes-outline')]: 'Music',
  [key('ionicons', 'tv-outline')]: 'Tv',

  // Ionicons — nature & objects
  [key('ionicons', 'diamond-outline')]: 'Gem',
  [key('ionicons', 'flame')]: 'Flame',
  [key('ionicons', 'flame-outline')]: 'Flame',
  [key('ionicons', 'leaf-outline')]: 'Leaf',
  [key('ionicons', 'paw-outline')]: 'PawPrint',
  [key('ionicons', 'umbrella-outline')]: 'Umbrella',
  [key('ionicons', 'water-outline')]: 'Droplets',

  // Ionicons — education & work
  [key('ionicons', 'briefcase-outline')]: 'Briefcase',
  [key('ionicons', 'laptop-outline')]: 'Laptop',
  [key('ionicons', 'rocket-outline')]: 'Rocket',
  [key('ionicons', 'school-outline')]: 'GraduationCap',

  // Ionicons — people & goals
  [key('ionicons', 'flag-outline')]: 'Goal',
  [key('ionicons', 'heart-outline')]: 'Heart',
  [key('ionicons', 'people-outline')]: 'Users',

  // Ionicons — security & shields
  [key('ionicons', 'shield-check-outline')]: 'ShieldCheck',
  [key('ionicons', 'shield-checkmark-outline')]: 'ShieldCheck',
  [key('ionicons', 'shield-outline')]: 'Shield',

  // Ionicons — settings & system
  [key('ionicons', 'analytics-outline')]: 'ChartNoAxesColumn',
  [key('ionicons', 'chatbubble-ellipses-outline')]: 'MessageCircle',
  [key('ionicons', 'cloud-done-outline')]: 'CloudCheck',
  [key('ionicons', 'cloud-offline-outline')]: 'CloudOff',
  [key('ionicons', 'color-palette-outline')]: 'Palette',
  [key('ionicons', 'earth-outline')]: 'Globe',
  [key('ionicons', 'key-outline')]: 'Key',
  [key('ionicons', 'language-outline')]: 'Languages',
  [key('ionicons', 'phone-portrait-outline')]: 'Smartphone',
  [key('ionicons', 'refresh-outline')]: 'RefreshCw',
  [key('ionicons', 'sparkles')]: 'Sparkles',
  [key('ionicons', 'sync-outline')]: 'RefreshCw',
  [key('ionicons', 'wifi-outline')]: 'Wifi',

  // Ionicons — alerts & info
  [key('ionicons', 'alert-circle-outline')]: 'CircleAlert',
  [key('ionicons', 'information-circle-outline')]: 'Info',
  [key('ionicons', 'warning-outline')]: 'TriangleAlert',

  // Ionicons — weather & light
  [key('ionicons', 'bulb-outline')]: 'Lightbulb',
  [key('ionicons', 'moon-outline')]: 'Moon',
  [key('ionicons', 'sunny-outline')]: 'Sun',

  // Ionicons — tools & misc categories
  [key('ionicons', 'build-outline')]: 'Wrench',
  [key('ionicons', 'calculator-outline')]: 'Calculator',
  [key('ionicons', 'construct-outline')]: 'Hammer',
  [key('ionicons', 'cut-outline')]: 'Scissors',
  [key('ionicons', 'ellipse-outline')]: 'Circle',
  [key('ionicons', 'gift-outline')]: 'Gift',
  [key('ionicons', 'hammer-outline')]: 'Hammer',
  [key('ionicons', 'play-outline')]: 'Play',
  [key('ionicons', 'shirt-outline')]: 'Shirt',
  [key('ionicons', 'star-outline')]: 'Star',
  [key('ionicons', 'trophy-outline')]: 'Trophy',

  // Material Community — actions & chrome
  [key('material-community', 'camera-outline')]: 'Camera',
  [key('material-community', 'car-outline')]: 'Car',
  [key('material-community', 'chart-line')]: 'ChartLine',
  [key('material-community', 'chart-timeline-variant')]: 'ChartLine',
  [key('material-community', 'check-circle')]: 'CircleCheck',
  [key('material-community', 'check-circle-outline')]: 'CircleCheck',
  [key('material-community', 'chevron-right')]: 'ChevronRight',
  [key('material-community', 'dots-vertical')]: 'EllipsisVertical',
  [key('material-community', 'file-document-outline')]: 'FileText',
  [key('material-community', 'microphone')]: 'Mic',
  [key('material-community', 'piggy-bank-outline')]: 'PiggyBank',
  [key('material-community', 'plus')]: 'Plus',
  [key('material-community', 'send')]: 'Send',
  [key('material-community', 'shield-alert-outline')]: 'ShieldAlert',
  [key('material-community', 'target')]: 'Target',

  // Material Icons — navigation & chrome
  [key('material', 'arrow-back')]: 'ArrowLeft',
  [key('material', 'check-circle')]: 'CircleCheck',
  [key('material', 'chevron-right')]: 'ChevronRight',
  [key('material', 'flag')]: 'Goal',
  [key('material', 'keyboard-arrow-down')]: 'ChevronDown',
  [key('material', 'more-horiz')]: 'Ellipsis',
  [key('material', 'radio-button-unchecked')]: 'Circle',
};

export function resolveLucideNameForLegacy(family: LegacyIconFamily, name: string): string | null {
  return LEGACY_TO_LUCIDE_MAP[`${family}:${name}`] ?? null;
}
