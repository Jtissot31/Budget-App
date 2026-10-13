/**
 * Account envelopes — split one account's balance into named portions
 * (Dépenses, Factures, Loisirs…). Amounts are set by the user; whatever isn't
 * assigned shows as « Non attribué ». Transactions don't move envelope money (v1).
 */
import { getDb } from '@/lib/db';
import { dataEvents } from '@/lib/events';

export type AccountEnvelope = {
  id: string;
  accountId: string;
  name: string;
  /** Ionicons glyph name. */
  icon: string;
  amount: number;
  displayOrder: number;
  createdAt: string;
};

type EnvelopeRow = {
  id: string;
  account_id: string;
  name: string;
  icon: string | null;
  amount: number;
  display_order: number;
  created_at: string;
};

export const DEFAULT_ENVELOPE_ICON = 'wallet-outline';

/** One-tap starting points in the « Nouvelle enveloppe » sheet. */
export const ENVELOPE_PRESETS: { name: string; icon: string }[] = [
  { name: 'Dépenses', icon: 'cart-outline' },
  { name: 'Factures', icon: 'receipt-outline' },
  { name: 'Loisirs', icon: 'game-controller-outline' },
  { name: 'Épargne', icon: 'leaf-outline' },
  { name: 'Urgence', icon: 'medkit-outline' },
];

export const ENVELOPE_ICONS = [
  'cart-outline',
  'receipt-outline',
  'game-controller-outline',
  'leaf-outline',
  'medkit-outline',
  'home-outline',
  'car-outline',
  'airplane-outline',
  'gift-outline',
  'restaurant-outline',
  'school-outline',
  'paw-outline',
] as const;

function fromRow(row: EnvelopeRow): AccountEnvelope {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    icon: row.icon || DEFAULT_ENVELOPE_ICON,
    amount: Number(row.amount) || 0,
    displayOrder: Number(row.display_order) || 0,
    createdAt: row.created_at,
  };
}

/** All envelopes grouped by account id, each list in display order. */
export async function getEnvelopesByAccount(): Promise<Record<string, AccountEnvelope[]>> {
  const db = await getDb();
  const rows = await db.getAllAsync<EnvelopeRow>('SELECT * FROM account_envelopes');
  const grouped: Record<string, AccountEnvelope[]> = {};
  for (const envelope of rows.map(fromRow)) {
    (grouped[envelope.accountId] ??= []).push(envelope);
  }
  for (const list of Object.values(grouped)) {
    list.sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt));
  }
  return grouped;
}

export function newEnvelopeId(): string {
  return `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveEnvelope(envelope: AccountEnvelope, isNew: boolean): Promise<void> {
  const db = await getDb();
  if (isNew) {
    await db.runAsync(
      `INSERT INTO account_envelopes (id, account_id, name, icon, amount, display_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        envelope.id,
        envelope.accountId,
        envelope.name,
        envelope.icon,
        envelope.amount,
        envelope.displayOrder,
        envelope.createdAt,
      ],
    );
  } else {
    await db.runAsync('UPDATE account_envelopes SET name = ?, icon = ?, amount = ? WHERE id = ?', [
      envelope.name,
      envelope.icon,
      envelope.amount,
      envelope.id,
    ]);
  }
  dataEvents.emit();
}

export async function deleteEnvelope(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM account_envelopes WHERE id = ?', [id]);
  dataEvents.emit();
}
