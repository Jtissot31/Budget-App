/**
 * In-app guided visit stops (real tabs + Fyn entry).
 * Labels match FloatingTabBar / tabs layout.
 */

export type TourStopId =
  | 'home'
  | 'transactions'
  | 'plans'
  | 'accounts'
  | 'budgets'
  | 'fyn';

export type TourTargetId =
  | 'tab:index'
  | 'tab:transactions'
  | 'tab:goals'
  | 'tab:accounts'
  | 'tab:budgets'
  | 'fyn-entry';

export type TourStop = {
  id: TourStopId;
  title: string;
  body: string;
  /** Expo-router path under the tab navigator */
  href: '/' | '/transactions' | '/goals' | '/accounts' | '/budgets';
  /** Registered spotlight target (`useAppTourTarget`) */
  targetId: TourTargetId;
};

export const ONBOARDING_TOUR_STOPS: TourStop[] = [
  {
    id: 'home',
    title: 'Accueil',
    body: 'Ton tableau de bord : disponible, insights et raccourcis vers ce qui compte aujourd’hui.',
    href: '/',
    targetId: 'tab:index',
  },
  {
    id: 'transactions',
    title: 'Transactions',
    body: 'L’historique de tes mouvements — dépenses, revenus et virements, filtrables par mois.',
    href: '/transactions',
    targetId: 'tab:transactions',
  },
  {
    id: 'plans',
    title: 'Plan financier',
    body: 'Objectifs d’épargne, dettes et stratégies pas à pas pour avancer concrètement.',
    href: '/goals',
    targetId: 'tab:goals',
  },
  {
    id: 'accounts',
    title: 'Portefeuille',
    body: 'Tes comptes et avoirs regroupés : soldes, prêts et patrimoine au même endroit.',
    href: '/accounts',
    targetId: 'tab:accounts',
  },
  {
    id: 'budgets',
    title: 'Budget',
    body: 'Catégories, plafonds et progression du mois pour garder le contrôle des dépenses.',
    href: '/budgets',
    targetId: 'tab:budgets',
  },
  {
    id: 'fyn',
    title: 'Fyn',
    body: 'Ton conseiller IA : depuis Plan financier, ouvre « Parler à Fyn » pour clarifier ton budget.',
    href: '/goals',
    targetId: 'fyn-entry',
  },
];
