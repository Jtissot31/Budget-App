import type { PlanTemplateDefinition } from './types';

/** Templates prédéfinis — Gemini adapte les valeurs, ne génère pas from scratch. */
export const PLAN_TEMPLATES: readonly PlanTemplateDefinition[] = [
  {
    id: 'remboursement_dettes',
    titre: 'Remboursement de dettes',
    description:
      'Priorisation avalanche (taux le plus élevé), boule de neige (plus petite dette) ou ordre personnalisé.',
    categorie: 'dette',
  },
  {
    id: 'epargne_automatique',
    titre: 'Épargne automatique',
    description: 'Versement mensuel régulier vers un objectif d’épargne précis.',
    categorie: 'epargne',
  },
  {
    id: 'fonds_urgence',
    titre: 'Fonds d’urgence',
    description: 'Constituer une réserve équivalente à 3 mois de dépenses essentielles.',
    categorie: 'epargne',
  },
  {
    id: 'optimisation_fiscale',
    titre: 'Optimisation fiscale',
    description: 'Maximiser les contributions REER/CELI selon revenus et espace disponible.',
    categorie: 'fiscal',
  },
  {
    id: 'remboursement_hypotheque',
    titre: 'Remboursement hypothèque accéléré',
    description: 'Paiements supplémentaires sur le capital pour réduire les intérêts totaux.',
    categorie: 'dette',
  },
  {
    id: 'budget_enveloppe',
    titre: 'Budget par enveloppe',
    description: 'Allocation mensuelle par catégorie de dépenses avec suivi des enveloppes.',
    categorie: 'budget',
  },
] as const;

export function getPlanTemplateById(id: string): PlanTemplateDefinition | undefined {
  return PLAN_TEMPLATES.find((template) => template.id === id);
}
