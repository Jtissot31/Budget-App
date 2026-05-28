import type { AccountKind } from '@/types';

/** Comptes fictifs pour l’aperçu tableau de bord (alignés sur l’onglet Comptes). */
export const DASHBOARD_ACCOUNTS: {
  id: string;
  name: string;
  number: string;
  balance: number;
  domain: string;
  kind: AccountKind;
  /** Limite fictive pour l’avertissement « capacité de la carte » sur le tableau de bord. */
  creditLimit?: number;
}[] = [
  {
    id: '1',
    name: 'Desjardins · 4521',
    number: '****4521',
    balance: 3240.5,
    domain: 'desjardins.com',
    kind: 'checking',
  },
  {
    id: '2',
    name: 'Épargne',
    number: '****7832',
    balance: 12840,
    domain: 'desjardins.com',
    kind: 'savings',
  },
  {
    id: '3',
    name: 'Visa · 9104',
    number: '****9104',
    balance: -580.42,
    domain: 'visa.com',
    kind: 'credit',
    creditLimit: 2500,
  },
];
