import {
  BUDGET_AMBER_MAX_PERCENT,
  BUDGET_GREEN_MAX_PERCENT,
  type CategoryBudgetUsage,
} from '@/lib/categoryBudgetUsage';
import { normalizeSearch } from '@/lib/categoryInference';
import { formatNumberDisplay } from '@/lib/formatNumber';
import type { TransactionInsight } from '@/lib/transactionInsight';

function formatMoney(amount: number): string {
  return formatNumberDisplay(amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getCategorySpecificTip(category: string, remaining: number): TransactionInsight | null {
  if (category.includes('epicerie') || category.includes('alimentation')) {
    return {
      title: 'Conseil IA',
      tip: 'Compare les **marques maison** et planifie tes repas de la semaine — tu peux réduire l’épicerie de **15 à 25 %** sans sacrifier la qualité.',
    };
  }

  if (category.includes('restaurant') || category.includes('repas')) {
    return {
      title: 'Conseil IA',
      tip: 'Préparer un repas similaire à la maison coûte souvent **40 à 60 % moins cher** — garde les sorties pour les occasions spéciales.',
    };
  }

  if (category.includes('transport') || category.includes('essence')) {
    return {
      title: 'Conseil IA',
      tip: 'Regroupe tes déplacements et vérifie les **apps de rabais essence** — quelques cents au litre s’accumulent vite sur un mois.',
    };
  }

  if (category.includes('loisir') || category.includes('divertissement')) {
    return {
      title: 'Conseil IA',
      tip: 'Audite tes **abonnements actifs** une fois par trimestre — beaucoup d’utilisateurs paient pour des services peu utilisés.',
    };
  }

  if (remaining > 0) {
    return {
      title: 'Conseil IA',
      tip: `Bon rythme — il te reste **${formatMoney(remaining)} $** ce mois-ci. Continue sur cette lancée.`,
    };
  }

  return null;
}

export function getCategoryBudgetInsight(
  categoryName: string,
  spent: number,
  limit: number,
  usage: CategoryBudgetUsage,
): TransactionInsight {
  const category = normalizeSearch(categoryName);
  const spentValue = Math.max(0, spent);
  const limitValue = Math.max(0, limit);
  const overAmount = Math.max(0, spentValue - limitValue);
  const remaining = Math.max(0, limitValue - spentValue);
  const pct = usage.usagePercent;

  if (limitValue === 0 && spentValue === 0) {
    return {
      title: 'Conseil IA',
      tip: 'Définis une **limite mensuelle** pour cette catégorie — c’est le meilleur moyen de suivre tes dépenses.',
    };
  }

  if (usage.isZeroLimitOverspend) {
    return {
      title: 'Conseil IA',
      tip: `Tu as dépensé **${formatMoney(spentValue)} $** sans limite fixée. Ajoute un plafond mensuel pour mieux contrôler cette catégorie.`,
    };
  }

  if (pct > BUDGET_AMBER_MAX_PERCENT) {
    return {
      title: 'Conseil IA',
      tip: `Tu es à **${pct} %** du budget — soit **${formatMoney(overAmount)} $** de trop. Réduis les achats non essentiels ou réajuste la limite si elle est irréaliste.`,
    };
  }

  if (usage.isOverBudget) {
    return {
      title: 'Conseil IA',
      tip: `Dépassement de **${formatMoney(overAmount)} $** (${pct} %). Reprends **2 à 3 dépenses récentes** — souvent un petit ajustement suffit pour revenir dans la cible.`,
    };
  }

  if (pct === BUDGET_GREEN_MAX_PERCENT) {
    return {
      title: 'Conseil IA',
      tip: 'Limite atteinte pile — **évite les achats impulsifs** d’ici la fin du mois pour rester dans le vert.',
    };
  }

  if (pct >= 80) {
    return {
      title: 'Conseil IA',
      tip: `Il te reste **${formatMoney(remaining)} $** (${100 - pct} % du budget). Planifie tes prochains achats pour ne pas dépasser.`,
    };
  }

  const categoryTip = getCategorySpecificTip(category, remaining);
  if (categoryTip) return categoryTip;

  if (spentValue === 0) {
    return {
      title: 'Conseil IA',
      tip: 'Aucune dépense ce mois-ci — garde cette catégorie en tête quand tu planifies tes achats.',
    };
  }

  return {
    title: 'Conseil IA',
    tip: `Bon rythme — **${pct} %** utilisé avec **${formatMoney(remaining)} $** restants. Continue sur cette lancée.`,
  };
}
