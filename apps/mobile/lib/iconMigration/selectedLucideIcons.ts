import type { LucideIcon } from 'lucide-react-native';
import { resolveLucideIcon } from '@/lib/lucideIconCatalog';

import ArrowDownFromLineMod from 'lucide-react-native/dist/cjs/icons/arrow-down-from-line.js';
import ArrowLeftRightMod from 'lucide-react-native/dist/cjs/icons/arrow-left-right.js';
import ArrowUpDownMod from 'lucide-react-native/dist/cjs/icons/arrow-up-down.js';
import ArrowUpToLineMod from 'lucide-react-native/dist/cjs/icons/arrow-up-to-line.js';
import BanknoteArrowDownMod from 'lucide-react-native/dist/cjs/icons/banknote-arrow-down.js';
import BanknoteCheckMod from 'lucide-react-native/dist/cjs/icons/banknote-check.js';
import BrainMod from 'lucide-react-native/dist/cjs/icons/brain.js';
import ChartPieMod from 'lucide-react-native/dist/cjs/icons/chart-pie.js';
import ChevronUpMod from 'lucide-react-native/dist/cjs/icons/chevron-up.js';
import CircleAlertMod from 'lucide-react-native/dist/cjs/icons/circle-alert.js';
import CloudSyncMod from 'lucide-react-native/dist/cjs/icons/cloud-sync.js';
import CompassMod from 'lucide-react-native/dist/cjs/icons/compass.js';
import ContactRoundMod from 'lucide-react-native/dist/cjs/icons/contact-round.js';
import CreditCardMod from 'lucide-react-native/dist/cjs/icons/credit-card.js';
import EyeMod from 'lucide-react-native/dist/cjs/icons/eye.js';
import EyeClosedMod from 'lucide-react-native/dist/cjs/icons/eye-closed.js';
import EyeOffMod from 'lucide-react-native/dist/cjs/icons/eye-off.js';
import GoalMod from 'lucide-react-native/dist/cjs/icons/goal.js';
import HandCoinsMod from 'lucide-react-native/dist/cjs/icons/hand-coins.js';
import HandHeartMod from 'lucide-react-native/dist/cjs/icons/hand-heart.js';
import HeartHandshakeMod from 'lucide-react-native/dist/cjs/icons/heart-handshake.js';
import HouseMod from 'lucide-react-native/dist/cjs/icons/house.js';
import ListFilterMod from 'lucide-react-native/dist/cjs/icons/list-filter.js';
import MessageCircleMod from 'lucide-react-native/dist/cjs/icons/message-circle.js';
import MoveMod from 'lucide-react-native/dist/cjs/icons/move.js';
import ReceiptTextMod from 'lucide-react-native/dist/cjs/icons/receipt-text.js';
import ScanFaceMod from 'lucide-react-native/dist/cjs/icons/scan-face.js';
import ScanLineMod from 'lucide-react-native/dist/cjs/icons/scan-line.js';
import ScanTextMod from 'lucide-react-native/dist/cjs/icons/scan-text.js';
import SearchMod from 'lucide-react-native/dist/cjs/icons/search.js';
import ShieldMod from 'lucide-react-native/dist/cjs/icons/shield.js';
import ShieldAlertMod from 'lucide-react-native/dist/cjs/icons/shield-alert.js';
import ShieldCheckMod from 'lucide-react-native/dist/cjs/icons/shield-check.js';
import ShoppingBagMod from 'lucide-react-native/dist/cjs/icons/shopping-bag.js';
import StoreMod from 'lucide-react-native/dist/cjs/icons/store.js';
import TrendingDownMod from 'lucide-react-native/dist/cjs/icons/trending-down.js';
import TrendingUpMod from 'lucide-react-native/dist/cjs/icons/trending-up.js';
import TriangleAlertMod from 'lucide-react-native/dist/cjs/icons/triangle-alert.js';
import UploadMod from 'lucide-react-native/dist/cjs/icons/upload.js';
import WalletMod from 'lucide-react-native/dist/cjs/icons/wallet.js';
import WalletCardsMod from 'lucide-react-native/dist/cjs/icons/wallet-cards.js';
import WalletMinimalMod from 'lucide-react-native/dist/cjs/icons/wallet-minimal.js';

function bind(name: string, mod: unknown): [string, LucideIcon] | null {
  const Icon = resolveLucideIcon(mod);
  return Icon ? [name, Icon] : null;
}

const SELECTED_LUCIDE_ICONS = new Map<string, LucideIcon>(
  [
    bind('ArrowDownFromLine', ArrowDownFromLineMod),
    bind('ArrowLeftRight', ArrowLeftRightMod),
    bind('ArrowUpDown', ArrowUpDownMod),
    bind('ArrowUpToLine', ArrowUpToLineMod),
    bind('BanknoteArrowDown', BanknoteArrowDownMod),
    bind('BanknoteCheck', BanknoteCheckMod),
    bind('Brain', BrainMod),
    bind('ChartPie', ChartPieMod),
    bind('ChevronUp', ChevronUpMod),
    bind('CircleAlert', CircleAlertMod),
    bind('CloudSync', CloudSyncMod),
    bind('Compass', CompassMod),
    bind('ContactRound', ContactRoundMod),
    bind('CreditCard', CreditCardMod),
    bind('Eye', EyeMod),
    bind('EyeClosed', EyeClosedMod),
    bind('EyeOff', EyeOffMod),
    bind('Goal', GoalMod),
    bind('HandCoins', HandCoinsMod),
    bind('HandHeart', HandHeartMod),
    bind('HeartHandshake', HeartHandshakeMod),
    bind('House', HouseMod),
    bind('ListFilter', ListFilterMod),
    bind('MessageCircle', MessageCircleMod),
    bind('Move', MoveMod),
    bind('ReceiptText', ReceiptTextMod),
    bind('ScanFace', ScanFaceMod),
    bind('ScanLine', ScanLineMod),
    bind('ScanText', ScanTextMod),
    bind('Search', SearchMod),
    bind('Shield', ShieldMod),
    bind('ShieldAlert', ShieldAlertMod),
    bind('ShieldCheck', ShieldCheckMod),
    bind('ShoppingBag', ShoppingBagMod),
    bind('Store', StoreMod),
    bind('TrendingDown', TrendingDownMod),
    bind('TrendingUp', TrendingUpMod),
    bind('TriangleAlert', TriangleAlertMod),
    bind('Upload', UploadMod),
    bind('Wallet', WalletMod),
    bind('WalletCards', WalletCardsMod),
    bind('WalletMinimal', WalletMinimalMod),
  ].filter((entry): entry is [string, LucideIcon] => entry != null),
);

export function getSelectedLucideIcon(name: string): LucideIcon | null {
  return SELECTED_LUCIDE_ICONS.get(name) ?? null;
}
