import { dataEvents } from '@/lib/events';
import {
  getRecurringPayments,
  getSetting,
  setSetting,
  upsertRecurringPayment,
} from '@/lib/db';
import type { RecurringPayment } from '@/types';

/** Bump to force a re-seed of the demo recurring payments (only when the user has none). */
const RECURRING_PAYMENTS_SEED_VERSION = '3';
const RECURRING_PAYMENTS_SEED_KEY = 'recurring_payments_seed_version';

/** Demo comptes alignés sur constants/dashboardMockAccounts.ts. */
const CHECKING = { id: '1', label: 'Desjardins · 4521' } as const;
const CREDIT = { id: '3', label: 'Visa · 9104' } as const;

type MockRecurringPayment = {
  id: string;
  name: string;
  amount: number;
  /** Jour du mois (échéance) — sert à calculer nextDate sur le mois courant. */
  dueDay: number;
  account: { id: string; label: string };
  categoryId: string;
  icon: string;
  color: string;
};

/**
 * Liste mockup de paiements récurrents mensuels (libellés FR, contexte QC).
 * Marchands connus (Netflix, Spotify…) : le logo est résolu automatiquement
 * via getMerchantLogoUrl dans l'agenda, l'icône/couleur sert de repli.
 */
const MOCK_RECURRING_PAYMENTS: MockRecurringPayment[] = [
  { id: 'seed-rp-loyer', name: 'Loyer', amount: 1250, dueDay: 1, account: CHECKING, categoryId: 'cat-home', icon: 'home-outline', color: '#8B5CF6' },
  { id: 'seed-rp-econofitness', name: 'Éconofitness', amount: 24.15, dueDay: 3, account: CHECKING, categoryId: 'cat-sports', icon: 'barbell-outline', color: '#34D399' },
  { id: 'seed-rp-spotify', name: 'Spotify', amount: 11.99, dueDay: 6, account: CREDIT, categoryId: 'cat-fun', icon: 'musical-notes-outline', color: '#22C55E' },
  { id: 'seed-rp-hydro', name: 'Hydro-Québec', amount: 94.5, dueDay: 8, account: CHECKING, categoryId: 'cat-utilities', icon: 'flash-outline', color: '#FBBF24' },
  { id: 'seed-rp-auto-pret', name: 'Paiement auto', amount: 389, dueDay: 10, account: CHECKING, categoryId: 'cat-car-payment', icon: 'car-sport-outline', color: '#14B8A6' },
  { id: 'seed-rp-videotron', name: 'Vidéotron', amount: 84.99, dueDay: 12, account: CREDIT, categoryId: 'cat-phone', icon: 'wifi-outline', color: '#14B8A6' },
  { id: 'seed-rp-fizz', name: 'Fizz Mobile', amount: 39, dueDay: 15, account: CREDIT, categoryId: 'cat-phone', icon: 'phone-portrait-outline', color: '#22C55E' },
  { id: 'seed-rp-bell', name: 'Bell Mobilité', amount: 65, dueDay: 15, account: CREDIT, categoryId: 'cat-phone', icon: 'phone-portrait-outline', color: '#3B82F6' },
  { id: 'seed-rp-netflix', name: 'Netflix', amount: 20.99, dueDay: 18, account: CREDIT, categoryId: 'cat-fun', icon: 'tv-outline', color: '#F43F5E' },
  { id: 'seed-rp-assurance-auto', name: 'Assurance auto', amount: 132, dueDay: 20, account: CHECKING, categoryId: 'cat-car-insurance', icon: 'shield-checkmark-outline', color: '#FB7185' },
  { id: 'seed-rp-disney', name: 'Disney+', amount: 12.99, dueDay: 22, account: CREDIT, categoryId: 'cat-fun', icon: 'tv-outline', color: '#6366F1' },
  { id: 'seed-rp-icloud', name: 'iCloud+', amount: 3.99, dueDay: 25, account: CREDIT, categoryId: 'cat-phone', icon: 'cloud-outline', color: '#38BDF8' },
  { id: 'seed-rp-assurance-hab', name: 'Assurance habitation', amount: 38, dueDay: 28, account: CHECKING, categoryId: 'cat-insurance', icon: 'shield-checkmark-outline', color: '#64748B' },
];

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Ancre nextDate au jour d'échéance du MOIS COURANT (même s'il est déjà passé).
 * L'agenda génère ensuite les occurrences mensuelles vers l'avant : marqueurs sur
 * tout le mois affiché + liste « À venir » (30 jours). Robuste quelle que soit la date.
 */
function monthlyNextDate(now: Date, dueDay: number): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dueDay, daysInMonth);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function buildMockRecurringPayments(now: Date): RecurringPayment[] {
  const createdAt = now.toISOString();
  return MOCK_RECURRING_PAYMENTS.map((item) => ({
    id: item.id,
    name: item.name,
    amount: item.amount,
    kind: 'payment',
    accountId: item.account.id,
    accountLabel: item.account.label,
    categoryId: item.categoryId,
    frequency: 'monthly',
    dueDay: item.dueDay,
    nextDate: monthlyNextDate(now, item.dueDay),
    endDate: null,
    active: true,
    icon: item.icon,
    color: item.color,
    logoUrl: null,
    createdAt,
  }));
}

/**
 * Insère la liste mockup de paiements récurrents quand l'utilisateur n'en a aucun.
 * Idempotent : gardé par un setting de version, ne clobbe jamais des données existantes.
 * L'agenda (onglet Agenda) se rafraîchit via dataEvents et affiche les paiements
 * sur le calendrier (lignes ambre) + dans « À venir ».
 */
export async function seedRecurringPaymentsIfMissing(): Promise<boolean> {
  const version = await getSetting(RECURRING_PAYMENTS_SEED_KEY, '0');
  if (version === RECURRING_PAYMENTS_SEED_VERSION) return false;

  const existing = await getRecurringPayments();
  let seeded = false;

  const payments = buildMockRecurringPayments(new Date());
  const existingIds = new Set(existing.map((payment) => payment.id));

  if (existing.length === 0) {
    for (const payment of payments) {
      await upsertRecurringPayment(payment);
    }
    seeded = true;
  } else {
    for (const payment of payments) {
      if (existingIds.has(payment.id)) continue;
      await upsertRecurringPayment(payment);
      seeded = true;
    }
  }

  await setSetting(RECURRING_PAYMENTS_SEED_KEY, RECURRING_PAYMENTS_SEED_VERSION);
  if (seeded) {
    dataEvents.emit();
  }
  return seeded;
}
