import type { DetailSection } from '@/components/DetailSectionRows';
import { formatCompactGainDollars } from '@/lib/formatCompactGainDollars';
import { formatDisplayMoneyAbsolute } from '@/lib/formatDisplayMoney';
import { computeLoanRepaymentProgress } from '@/lib/loanPresentation';
import {
  computeRealEstateNetEquity,
  formatWealthShortDate,
  getWealthValuationAsOfDisplay,
  valuationSourceLabel,
  wealthAssetHeroSubtitle,
  wealthAssetTypeShortTag,
  wealthMaterialLabel,
} from '@/lib/wealthAssetPresentation';
import type { Loan, WealthAsset } from '@/types';

function buildRealEstateSections(
  asset: WealthAsset,
  linkedLoan: Loan | null,
  gain: number,
  gainTone: string,
): DetailSection[] {
  const equity = computeRealEstateNetEquity(asset, linkedLoan);
  const patrimoineRows: DetailSection['rows'] = [];

  if (asset.currentValue > 0) {
    patrimoineRows.push({
      label: 'Valeur marchande actuelle',
      value: formatDisplayMoneyAbsolute(asset.currentValue),
      icon: 'home-outline',
      valueLayout: 'amount',
    });
  }

  if (equity.hasMortgage && linkedLoan?.type === 'mortgage') {
    const { paidAmount } = computeLoanRepaymentProgress(linkedLoan);
    const principal = Math.max(Number(linkedLoan.principal) || 0, 0);

    if (principal > 0) {
      patrimoineRows.push({
        label: 'Payé sur l’hypothèque',
        value: formatDisplayMoneyAbsolute(paidAmount),
        icon: 'checkmark-circle-outline',
        valueLayout: 'amount',
      });
    }

    patrimoineRows.push({
      label: 'Restant sur l’hypothèque',
      value: formatDisplayMoneyAbsolute(equity.mortgageBalance),
      icon: 'document-text-outline',
      valueLayout: 'amount',
    });

    patrimoineRows.push({
      label: 'Équité nette',
      value: formatDisplayMoneyAbsolute(equity.netEquity),
      icon: 'shield-checkmark-outline',
      valueLayout: 'amount',
    });
  } else if (equity.hasMortgage) {
    patrimoineRows.push({
      label: 'Restant sur l’hypothèque',
      value: formatDisplayMoneyAbsolute(equity.mortgageBalance),
      icon: 'document-text-outline',
      valueLayout: 'amount',
    });
    patrimoineRows.push({
      label: 'Équité nette',
      value: formatDisplayMoneyAbsolute(equity.netEquity),
      icon: 'shield-checkmark-outline',
      valueLayout: 'amount',
    });
  }

  const achatRows: DetailSection['rows'] = [];
  if (asset.purchaseCost > 0) {
    achatRows.push({
      label: 'Valeur à l’achat',
      value: formatDisplayMoneyAbsolute(asset.purchaseCost),
      icon: 'cash-outline',
      valueLayout: 'amount',
    });
  }
  if (asset.purchaseDate?.trim()) {
    achatRows.push({
      label: 'Date d’achat',
      value: formatWealthShortDate(asset.purchaseDate),
      icon: 'calendar-outline',
    });
  }
  if (asset.purchaseCost > 0) {
    achatRows.push({
      label: gain >= 0 ? 'Plus-value' : 'Perte',
      value: formatCompactGainDollars(gain, { leadingPlusWhenPositive: true }),
      icon: 'trending-up-outline',
      valueColor: gainTone,
      valueLayout: 'amount',
    });
  }

  const infosRows: DetailSection['rows'] = [];
  const propertyType = asset.propertyType?.trim();
  if (propertyType && !propertyType.toLowerCase().includes('immobilier')) {
    infosRows.push({
      label: 'Type de bien',
      value: propertyType,
      icon: 'pricetag-outline',
    });
  } else {
    infosRows.push({
      label: 'Type',
      value: wealthAssetTypeShortTag(asset),
      icon: 'pricetag-outline',
    });
  }

  if (asset.address?.trim()) {
    infosRows.push({
      label: 'Adresse',
      value: asset.address.trim(),
      icon: 'location-outline',
    });
  }

  if (asset.notes?.trim()) {
    infosRows.push({
      label: 'Notes',
      value: asset.notes.trim(),
      icon: 'document-text-outline',
    });
  }

  return [
    { title: 'Patrimoine', rows: patrimoineRows },
    { title: 'Achat', rows: achatRows },
    { title: 'Infos', rows: infosRows },
  ];
}

function buildPreciousMaterialSections(
  asset: WealthAsset,
  gain: number,
  gainTone: string,
  openedAt: Date | null,
): DetailSection[] {
  const valuationAsOf = getWealthValuationAsOfDisplay(asset, openedAt);
  const spec = wealthAssetHeroSubtitle(asset);

  const valorisationRows: DetailSection['rows'] = [];
  if (asset.currentValue > 0) {
    valorisationRows.push({
      label: 'Valeur actuelle',
      value: formatDisplayMoneyAbsolute(asset.currentValue),
      icon: 'trending-up-outline',
      valueLayout: 'amount',
    });
  }
  valorisationRows.push({
    label: 'Source',
    value: valuationSourceLabel(asset),
    icon: 'globe-outline',
  });
  valorisationRows.push({
    label: 'Actualisation',
    value: valuationAsOf.title,
    icon: 'time-outline',
  });

  const achatRows: DetailSection['rows'] = [];
  if (asset.purchaseCost > 0) {
    achatRows.push({
      label: 'Coût d’achat',
      value: formatDisplayMoneyAbsolute(asset.purchaseCost),
      icon: 'cash-outline',
      valueLayout: 'amount',
    });
  }
  if (asset.purchaseDate?.trim()) {
    achatRows.push({
      label: 'Date d’achat',
      value: formatWealthShortDate(asset.purchaseDate),
      icon: 'calendar-outline',
    });
  }
  if (asset.purchaseCost > 0) {
    achatRows.push({
      label: gain >= 0 ? 'Plus-value' : 'Perte',
      value: formatCompactGainDollars(gain, { leadingPlusWhenPositive: true }),
      icon: 'trending-up-outline',
      valueColor: gainTone,
      valueLayout: 'amount',
    });
  }

  const specRows: DetailSection['rows'] = [];
  if (asset.material) {
    specRows.push({
      label: 'Matériau',
      value: wealthMaterialLabel(asset.material),
      icon: 'diamond-outline',
    });
  }
  if (spec) {
    specRows.push({
      label: 'Spécifications',
      value: spec,
      icon: 'information-circle-outline',
    });
  }
  if (asset.notes?.trim()) {
    specRows.push({
      label: 'Notes',
      value: asset.notes.trim(),
      icon: 'document-text-outline',
    });
  }

  return [
    { title: 'Valorisation', rows: valorisationRows },
    { title: 'Achat', rows: achatRows },
    { title: 'Spécifications', rows: specRows },
  ];
}

export function buildWealthAssetDetailSections(
  asset: WealthAsset,
  linkedLoan: Loan | null,
  gain: number,
  gainTone: string,
  openedAt: Date | null,
): DetailSection[] {
  if (asset.type === 'real_estate') {
    return buildRealEstateSections(asset, linkedLoan, gain, gainTone);
  }
  return buildPreciousMaterialSections(asset, gain, gainTone, openedAt);
}
