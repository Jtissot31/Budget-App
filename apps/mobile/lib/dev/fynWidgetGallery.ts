import type { AIWidgetData } from '@/types/aiWidgets';

export type FynWidgetGalleryEntry = {
  id: string;
  /** French section title shown above the preview. */
  typeLabel: string;
  /** Optional hint about render path or usage. */
  subtitle?: string;
  data: AIWidgetData;
};

/** Mock payloads for every Fyn chat widget type — mirrors chatService examples and cashflow edge cases. */
export const FYN_WIDGET_GALLERY: FynWidgetGalleryEntry[] = [
  {
    id: 'progress_card',
    typeLabel: 'Carte de progression',
    subtitle: 'Objectif unique avec barre de progression',
    data: {
      type: 'progress_card',
      label: "Fonds d'urgence",
      icon: 'shield-check-outline',
      value_label: '12 600,00 $',
      percent: 70,
      percent_label: "70 % de l'objectif",
      status_line: 'Paiement hypothèque sécurisé',
      actions: [{ label: 'Voir le plan' }],
    },
  },
  {
    id: 'debt_table',
    typeLabel: 'Tableau de dettes',
    subtitle: 'Dettes accélérables avec totaux',
    data: {
      type: 'debt_table',
      label: 'Dettes actives',
      columns: {
        payment: 'Paie. min.',
      },
      rows: [
        {
          name: 'Visa Desjardins',
          balance: '4 200 $',
          rate: '19,9 %',
          payment: '125 $',
        },
        {
          name: 'Prêt auto',
          balance: '8 500 $',
          rate: '6,5 %',
          payment: '320 $',
        },
      ],
      total: {
        label: 'Total',
        balance: '12 700 $',
        payment: '445 $',
      },
    },
  },
  {
    id: 'comparison_card',
    typeLabel: 'Carte de comparaison',
    subtitle: 'Scénarios textuels sans graphique',
    data: {
      type: 'comparison_card',
      label: 'Scénarios de remboursement',
      items: [
        { label: 'Avalanche (intérêts)', value: '−1 240 $', highlight: true },
        { label: 'Boule de neige', value: '−980 $' },
        { label: 'Minimum seulement', value: '−420 $' },
      ],
      footer: "Économie d'intérêts sur 12 mois",
    },
  },
  {
    id: 'alert_card_warning',
    typeLabel: 'Carte d\'alerte',
    subtitle: 'Avertissement budget dépassé',
    data: {
      type: 'alert_card',
      severity: 'warning',
      title: 'Budget restaurants dépassé',
      message: 'Tu as utilisé 112 % de ton enveloppe ce mois-ci.',
      action: { label: 'Voir le budget' },
    },
  },
  {
    id: 'alert_card_success',
    typeLabel: 'Carte d\'alerte (succès)',
    subtitle: 'Confirmation après action Fyn',
    data: {
      type: 'alert_card',
      severity: 'success',
      title: 'Action confirmée',
      message: 'La catégorie Restaurants est maintenant dans ton budget à 400 $/mois.',
    },
  },
  {
    id: 'balance_summary_card',
    typeLabel: 'Carte solde total',
    subtitle: 'Clean Financial Dashboard (Figma) — solde avec pill de tendance',
    data: {
      type: 'balance_summary_card',
      label: 'Solde total',
      value_label: '5 240,00 $',
      trend_label: '+10 % par rapport au mois dernier',
      positive: true,
      action: { label: 'Voir les comptes' },
    },
  },
  {
    id: 'bar_chart_categories',
    typeLabel: 'Graphique à barres',
    subtitle: 'Dépenses par catégorie (BarChartWidget)',
    data: {
      type: 'bar_chart',
      label: 'Dépenses par catégorie',
      items: [
        { label: 'Logement', value: 1450, value_label: '1 450 $', limit: 1500, limit_label: '1 500 $' },
        { label: 'Épicerie', value: 620, value_label: '620 $', limit: 700, limit_label: '700 $' },
        { label: 'Transport', value: 280, value_label: '280 $', limit: 300, limit_label: '300 $' },
        { label: 'Restaurants', value: 336, value_label: '336 $', limit: 300, limit_label: '300 $' },
      ],
      caption: 'Mois en cours · barre = dépensé sur limite mensuelle',
      action: { label: 'Voir toutes les catégories' },
    },
  },
  {
    id: 'bar_chart_cashflow',
    typeLabel: 'Graphique à barres (revenus vs dépenses)',
    subtitle: 'Normalisé en CashflowComparisonWidget dans le chat',
    data: {
      type: 'bar_chart',
      label: 'Revenus vs dépenses (moyenne mensuelle)',
      items: [
        { label: 'Revenus', value: 3000, value_label: '3 000,00 $' },
        { label: 'Dépenses', value: 2200, value_label: '2 200,00 $' },
      ],
      caption: 'Surplus moyen de 800,00 $ par mois',
    },
  },
  {
    id: 'cashflow_comparison_deficit',
    typeLabel: 'Comparaison cashflow',
    subtitle: 'Déficit léger — cas 2037 $ / 2049 $',
    data: {
      type: 'cashflow_comparison',
      label: 'Revenus vs dépenses (moyenne mensuelle)',
      income: 2037,
      expenses: 2049,
      income_label: '2 037,00 $',
      expenses_label: '2 049,00 $',
      surplus: -12,
      caption: 'Déficit moyen de 12,00 $ par mois',
      period: 'Moyenne 3 mois',
    },
  },
  {
    id: 'cashflow_comparison_surplus',
    typeLabel: 'Comparaison cashflow (surplus)',
    subtitle: 'Revenus supérieurs aux dépenses',
    data: {
      type: 'cashflow_comparison',
      label: 'Revenus vs dépenses (moyenne mensuelle)',
      income: 3000,
      expenses: 2200,
      income_label: '3 000,00 $',
      expenses_label: '2 200,00 $',
      surplus: 800,
      caption: 'Surplus moyen de 800,00 $ par mois',
      period: 'Moyenne mensuelle',
    },
  },
  {
    id: 'allocation_chart_budget',
    typeLabel: 'Graphique d\'allocation',
    subtitle: 'Répartition du budget mensuel',
    data: {
      type: 'allocation_chart',
      label: 'Répartition du budget',
      segments: [
        { label: 'Essentiels', value: 55, percent: 55 },
        { label: 'Loisirs', value: 20, percent: 20 },
        { label: 'Épargne', value: 25, percent: 25 },
      ],
      caption: 'Part du revenu net mensuel',
    },
  },
  {
    id: 'allocation_chart_subscriptions',
    typeLabel: 'Graphique d\'allocation (abonnements)',
    subtitle: 'Paiements récurrents actifs',
    data: {
      type: 'allocation_chart',
      label: 'Abonnements et paiements récurrents',
      segments: [
        { label: 'Netflix', value: 24.99 },
        { label: 'Spotify', value: 12.99 },
        { label: 'Internet', value: 79.95 },
        { label: 'Assurance auto', value: 142.5 },
      ],
      caption: '4 paiements actifs.',
    },
  },
];
