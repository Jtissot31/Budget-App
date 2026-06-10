import { normalizeSearch } from '@/lib/categoryInference';
import type { ItemizedNote } from '@/lib/itemizedNote';
import type { Transaction } from '@/types';

export type TransactionInsight = {
  title: string;
  tip: string;
};

function formatMoney(amount: number): string {
  return amount.toLocaleString('fr-CA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function getTransactionInsight(
  tx: Pick<Transaction, 'label' | 'amount' | 'type' | 'categoryName'>,
  items: ItemizedNote[] = [],
): TransactionInsight | null {
  if (tx.type !== 'expense') return null;

  const merchant = normalizeSearch(tx.label);
  const category = normalizeSearch(tx.categoryName ?? '');
  const amount = tx.amount;

  if (items.length > 0) {
    const discretionary = items.filter((item) => {
      const name = normalizeSearch(item.name);
      return ['cafe', 'coffee', 'snack', 'chips', 'bonbon', 'soda', 'biere', 'wine', 'vin', 'dessert', 'bar'].some((term) =>
        name.includes(term),
      );
    });
    if (discretionary.length > 0) {
      const extra = discretionary.reduce((sum, item) => sum + item.price, 0);
      if (extra >= 5) {
        return {
          title: 'Conseil IA',
          tip: `En retirant **${discretionary.length} article${discretionary.length > 1 ? 's' : ''} non essentiel${discretionary.length > 1 ? 's' : ''}** (~${formatMoney(extra)} $), tu pourrais économiser sur cette sortie.`,
        };
      }
    }
  }

  if (category.includes('restaurant') || category.includes('repas') || merchant.includes('starbucks') || merchant.includes('restaurant')) {
    if (amount >= 25) {
      return {
        title: 'Conseil IA',
        tip: 'Préparer un repas similaire à la maison coûte souvent **40 à 60 % moins cher** qu’au restaurant pour le même type de repas.',
      };
    }
    return {
      title: 'Conseil IA',
      tip: 'Emmène une **tasse réutilisable** ou un snack — les petits extras (boisson, dessert) font souvent monter la facture de 20 %.',
    };
  }

  if (category.includes('epicerie') || category.includes('alimentation') || merchant.includes('metro') || merchant.includes('iga')) {
    return {
      title: 'Conseil IA',
      tip: 'Compare les **produits de marque maison** et planifie tes repas de la semaine — tu peux réduire l’épicerie de **15 à 25 %** sans sacrifier la qualité.',
    };
  }

  if (category.includes('transport') || category.includes('essence') || merchant.includes('shell') || merchant.includes('esso')) {
    return {
      title: 'Conseil IA',
      tip: 'Regroupe tes déplacements et vérifie les **apps de rabais essence** — quelques cents au litre s’accumulent vite sur un mois.',
    };
  }

  if (category.includes('loisir') || category.includes('divertissement') || merchant.includes('netflix') || merchant.includes('spotify')) {
    return {
      title: 'Conseil IA',
      tip: 'Audite tes **abonnements actifs** une fois par trimestre — beaucoup d’utilisateurs paient pour des services peu utilisés.',
    };
  }

  if (amount >= 100) {
    return {
      title: 'Conseil IA',
      tip: `Pour une dépense de **${formatMoney(amount)} $**, attends **24 h** avant un achat similaire — ça aide à distinguer l’essentiel de l’impulsif.`,
    };
  }

  if (amount >= 15) {
    return {
      title: 'Conseil IA',
      tip: 'Fixe un **plafond hebdomadaire** pour cette catégorie et active une alerte quand tu atteignes 80 % du budget.',
    };
  }

  return {
    title: 'Conseil IA',
    tip: 'Note les **petites dépenses récurrentes** — elles semblent anodines mais représentent souvent 10 à 15 % du budget mensuel.',
  };
}
