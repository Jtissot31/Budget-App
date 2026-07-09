import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

export const PAYCHECK_MOCK_AMOUNT = 2800;
export const PAYCHECK_MOCK_SOURCE_ACCOUNT = 'Compte chèque';

type MdiIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type PaycheckAllocationLine = {
  id: string;
  label: string;
  amount: number;
  destinationLabel: string;
  icon: MdiIconName;
  segmentColor: string;
};

export const PAYCHECK_MOCK_ALLOCATIONS: PaycheckAllocationLine[] = [
  {
    id: 'bills',
    label: 'Loyer & factures',
    amount: 1200,
    destinationLabel: 'Enveloppe · Charges fixes',
    icon: 'home-outline',
    segmentColor: '#A8A8A8',
  },
  {
    id: 'vacation',
    label: 'Vacances été',
    amount: 200,
    destinationLabel: 'Plan · Vacances été',
    icon: 'beach',
    segmentColor: '#8A8A8A',
  },
  {
    id: 'emergency',
    label: "Fonds d'urgence",
    amount: 150,
    destinationLabel: "Enveloppe · Fonds d'urgence",
    icon: 'shield-outline',
    segmentColor: '#6E6E6E',
  },
  {
    id: 'visa',
    label: 'Remboursement Visa',
    amount: 300,
    destinationLabel: 'Plan · Remboursement dettes',
    icon: 'credit-card-outline',
    segmentColor: '#565656',
  },
];

export function getPaycheckAllocatedTotal(lines: readonly PaycheckAllocationLine[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

export function getPaycheckAvailableAmount(
  paycheckAmount: number,
  lines: readonly PaycheckAllocationLine[],
): number {
  return paycheckAmount - getPaycheckAllocatedTotal(lines);
}
