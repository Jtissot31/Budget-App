import type { AppColors } from '@/constants/theme';

/** Montant dû sur la carte (partie négative du solde), aligné avec l’onglet Comptes. */
export function creditUsedFromBalance(balance: number): number {
  return Math.abs(Math.min(balance, 0));
}

/**
 * Pourcentage d’utilisation de la limite (0–100), ou undefined si pas de limite exploitable.
 * Même calcul que Portefeuille : `creditUsed / creditLimit`, plafonné à 100 %.
 */
export function creditLimitUtilizationPercent(
  balance: number,
  creditLimit: number | undefined,
): number | undefined {
  if (!(typeof creditLimit === 'number' && creditLimit > 0)) return undefined;
  const creditUsed = creditUsedFromBalance(balance);
  return Math.min((creditUsed / creditLimit) * 100, 100);
}

/** Étiquette courte pour les marqueurs de la ligne de temps : « 75 % utilisé ». */
export function formatCreditUtilTimelineLabel(utilizationPercent: number): string {
  return `${Math.round(utilizationPercent)} % utilisé`;
}

/** Couleur texte « % utilisé » : <50% vert ; 50–79% orange ; ≥80% rouge. */
export function utilizationPercentColor(
  percent: number,
  colors: Pick<AppColors, 'success' | 'warning' | 'danger'>,
): string {
  if (percent >= 80) return colors.danger;
  if (percent >= 50) return colors.warning;
  return colors.success;
}

/** Remplissage barre utilisation carte : <65% primary ; ≥65% orange vif ; ≥85% rouge vif. */
export function creditLimitUtilizationBarColor(
  utilizationPercent: number,
  theme: AppColors,
  isLight: boolean,
): string {
  if (utilizationPercent >= 85) return theme.danger;
  if (utilizationPercent >= 65) return theme.warning;
  return theme.primary;
}
