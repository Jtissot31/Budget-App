import { getWealthAssetById, upsertWealthAsset } from '@/lib/db';
import { formatLoanDisplayTitle, MORTGAGE_DEFAULT_NAME, MORTGAGE_DEFAULT_REASON } from '@/lib/loanPresentation';
import type { Loan, WealthAsset } from '@/types';

export { MORTGAGE_DEFAULT_NAME, MORTGAGE_DEFAULT_REASON };

export function computeMortgageEquity(loan: {
  currentPropertyValue?: number | null;
  balanceRemaining: number;
}) {
  const propertyValue = loan.currentPropertyValue ?? 0;
  if (propertyValue <= 0) {
    return { equity: 0, equityPct: 0, propertyValue: 0 };
  }
  const equity = Math.max(propertyValue - loan.balanceRemaining, 0);
  const equityPct = Math.min((equity / propertyValue) * 100, 100);
  return { equity, equityPct, propertyValue };
}

/** Creates or updates the linked Patrimoine real-estate row for a mortgage loan. */
export async function syncMortgageWealthAsset(loan: Loan): Promise<Loan> {
  if (loan.type !== 'mortgage') return loan;

  const assetId = loan.wealthAssetId ?? `wealth-${loan.id}`;
  const existing = await getWealthAssetById(assetId);
  const downPayment = loan.downPayment ?? 0;
  const estimatedPurchase = loan.principal + downPayment;
  const purchaseCost =
    loan.purchasePrice ?? existing?.purchaseCost ?? (estimatedPurchase > 0 ? estimatedPurchase : loan.principal);
  const currentValue =
    loan.currentPropertyValue ?? existing?.currentValue ?? purchaseCost;

  const asset: WealthAsset = {
    id: assetId,
    type: 'real_estate',
    name: loan.address?.trim() || formatLoanDisplayTitle(loan),
    purchaseCost,
    purchaseDate: loan.startDate?.trim() || existing?.purchaseDate || null,
    currentValue,
    lastValuationAt: new Date().toISOString(),
    valuationSource: 'manual',
    propertyType: existing?.propertyType ?? null,
    address: loan.address?.trim() || existing?.address || null,
    photoUri: existing?.photoUri ?? null,
    linkedLoanId: loan.id,
    notes: existing?.notes ?? null,
    createdAt: existing?.createdAt ?? loan.createdAt,
  };

  await upsertWealthAsset(asset);
  return { ...loan, wealthAssetId: assetId };
}
