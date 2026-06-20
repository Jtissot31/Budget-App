import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type ActivityPhase =
  | 'analyse_finances'
  | 'reflexion'
  | 'recherche_web'
  | 'analyse'
  | 'redaction';

export type ActivityPhaseConfig = {
  label: string;
  completedLabel: string;
  icon: ComponentProps<typeof Ionicons>['name'];
};

export const ACTIVITY_PHASE_CONFIG: Record<ActivityPhase, ActivityPhaseConfig> = {
  analyse_finances: {
    label: 'Analyse de vos finances…',
    completedLabel: 'Finances analysées',
    icon: 'wallet-outline',
  },
  reflexion: {
    label: 'Réflexion…',
    completedLabel: 'Réflexion terminée',
    icon: 'bulb-outline',
  },
  recherche_web: {
    label: 'Recherche en ligne…',
    completedLabel: 'Recherche en ligne effectuée',
    icon: 'search-outline',
  },
  analyse: {
    label: 'Analyse des données…',
    completedLabel: 'Données analysées',
    icon: 'analytics-outline',
  },
  redaction: {
    label: 'Rédaction de la réponse…',
    completedLabel: 'Réponse rédigée',
    icon: 'create-outline',
  },
};

/** Phases emitted during a normal chat request (no web search). */
export const DEFAULT_CHAT_ACTIVITY_SEQUENCE: ActivityPhase[] = [
  'analyse_finances',
  'reflexion',
  'analyse',
  'redaction',
];

export function getActivityPhaseLabel(phase: ActivityPhase, completed = false): string {
  const config = ACTIVITY_PHASE_CONFIG[phase];
  return completed ? config.completedLabel : config.label;
}
