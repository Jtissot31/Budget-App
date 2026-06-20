import { parseRaisonFromNote } from '@/lib/accountTransactionFlow';
import { normalizeSearch } from '@/lib/categoryInference';
import { formatNumberDisplay } from '@/lib/formatNumber';
import type { ItemizedNote } from '@/lib/itemizedNote';
import type { Transaction } from '@/types';

export type TransactionInsight = {
  title: string;
  tip: string;
};

function formatMoney(amount: number): string {
  return formatNumberDisplay(amount, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function getIncomeInsight(
  tx: Pick<Transaction, 'label' | 'amount' | 'categoryName'> & { incomeReason?: string | null },
): TransactionInsight {
  const source = normalizeSearch(tx.label);
  const category = normalizeSearch(tx.categoryName ?? '');
  const reason = normalizeSearch(tx.incomeReason ?? '');
  const combined = `${source} ${category} ${reason}`;

  if (
    ['salaire', 'paie', 'paye', 'payroll', 'employeur', 'employe', 'travail', 'depot direct', 'direct deposit'].some((term) =>
      combined.includes(term),
    )
  ) {
    return {
      title: 'Conseil IA',
      tip: 'Revenu stable — chaque paie renforce ta sécurité financière. Pense à **affecter une part à l’épargne** dès l’arrivée.',
    };
  }

  if (
    ['freelance', 'autonome', 'consultant', 'honoraire', 'mandat', 'contrat', 'prestation'].some((term) =>
      combined.includes(term),
    )
  ) {
    return {
      title: 'Conseil IA',
      tip: 'Bravo pour ton **travail indépendant** — chaque mandat compte. Mets de côté **25 à 30 %** pour les charges futures.',
    };
  }

  if (['vente', 'ventes', 'revente'].some((term) => combined.includes(term))) {
    return {
      title: 'Conseil IA',
      tip: 'Belle vente — **réinvestis une partie** du profit ou mets-la de côté pour ne pas la diluer dans les dépenses courantes.',
    };
  }

  if (['remboursement', 'refund', 'retour', 'rebate'].some((term) => combined.includes(term))) {
    return {
      title: 'Conseil IA',
      tip: 'Bien vu de **récupérer cet argent** — c’est un petit coup de pouce qui revient directement dans ton budget.',
    };
  }

  if (
    ['dividende', 'interet', 'placement', 'investissement', 'rendement', 'coupon'].some((term) =>
      combined.includes(term),
    )
  ) {
    return {
      title: 'Conseil IA',
      tip: 'Revenu passif — ton argent **travaille pour toi**. Réinvestis une partie pour accélérer l’effet boule de neige.',
    };
  }

  if (['cadeau', 'don', 'partage', 'part du', 'anniversaire'].some((term) => combined.includes(term))) {
    return {
      title: 'Conseil IA',
      tip: 'Un geste qui fait du bien — **profite-en** ou mets-le de côté pour un objectif qui te tient à cœur.',
    };
  }

  if (['loyer', 'locatif', 'location', 'bail'].some((term) => combined.includes(term))) {
    return {
      title: 'Conseil IA',
      tip: 'Revenu locatif solide — pense à **provisionner** pour l’entretien et les imprévus du bien.',
    };
  }

  if (['prime', 'bonus', 'commission', 'pourboire'].some((term) => combined.includes(term))) {
    return {
      title: 'Conseil IA',
      tip: 'Un bon coup de pouce ! **Évite de l’absorber** dans les dépenses courantes — oriente-le vers un objectif.',
    };
  }

  if (tx.amount >= 500) {
    return {
      title: 'Conseil IA',
      tip: `Un revenu de **${formatMoney(tx.amount)} $** — c’est le bon moment pour **réviser tes priorités** d’épargne et de remboursement.`,
    };
  }

  return {
    title: 'Conseil IA',
    tip: 'Chaque revenu **renforce ton budget** — c’est le bon moment pour vérifier tes objectifs d’épargne.',
  };
}

function getExpenseInsight(
  tx: Pick<Transaction, 'label' | 'amount' | 'categoryName'>,
  items: ItemizedNote[] = [],
): TransactionInsight {
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

export function getTransactionInsight(
  tx: Pick<Transaction, 'label' | 'amount' | 'type' | 'categoryName' | 'note'>,
  items: ItemizedNote[] = [],
): TransactionInsight | null {
  if (tx.type === 'transfer') return null;
  if (tx.type === 'income') {
    return getIncomeInsight({
      ...tx,
      incomeReason: parseRaisonFromNote(tx.note),
    });
  }
  return getExpenseInsight(tx, items);
}
