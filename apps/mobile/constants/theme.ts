import { Platform } from 'react-native';

/** Minimal UI tokens */
export const darkColors = {
  background: '#000000',
  surface: 'rgba(16, 16, 20, 0.94)',
  surfaceSolid: '#101014',
  /** Panneau affleurant le fond (#000) tout en restant discret — cartes IA, rangées mises en avant */
  surfaceElevated: '#16161d',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.16)',
  cardBorder: 'rgba(80,85,90,0.45)',
  text: '#ffffff',
  /** Lisible sur fond sombre : puces, onglets inactifs */
  textSecondary: '#e7e9ee',
  textMuted: '#9aa3af',
  primary: '#00F5A0',
  primaryAlt: '#9B8CFF',
  success: '#35E985',
  successMuted: 'rgba(53, 233, 133, 0.12)',
  danger: '#FF6B7A',
  dangerMuted: 'rgba(255, 107, 122, 0.13)',
  warning: '#FFB15C',
  purple: '#B48CFF',
  purpleMuted: 'rgba(180, 140, 255, 0.13)',
  cyanMuted: 'rgba(56, 189, 248, 0.13)',
  blueMuted: 'rgba(96, 165, 250, 0.13)',
  navPill: 'rgba(14, 14, 18, 0.96)',
} as const;

export const lightColors = {
  background: '#F7F8FA',
  surface: 'rgba(255, 255, 255, 0.94)',
  surfaceSolid: '#FFFFFF',
  /** Démarquée du fond page (#F7F8FA) pour les rangées IA / sous-cartes */
  surfaceElevated: '#FFFFFF',
  border: 'rgba(15, 23, 42, 0.08)',
  borderStrong: 'rgba(15, 23, 42, 0.14)',
  cardBorder: 'rgba(200,205,215,0.75)',
  text: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  primary: '#00A870',
  primaryAlt: '#6D5DF6',
  success: '#0F9F5F',
  successMuted: 'rgba(15, 159, 95, 0.12)',
  danger: '#D94A57',
  dangerMuted: 'rgba(217, 74, 87, 0.12)',
  warning: '#C96F1A',
  purple: '#6D5DF6',
  purpleMuted: 'rgba(109, 93, 246, 0.12)',
  cyanMuted: 'rgba(2, 132, 199, 0.12)',
  blueMuted: 'rgba(37, 99, 235, 0.12)',
  navPill: 'rgba(255, 255, 255, 0.96)',
} as const;

export type AppColors = typeof darkColors;
export type ThemePreference = 'dark' | 'light';

export const themeColors: Record<ThemePreference, AppColors> = {
  dark: darkColors,
  light: lightColors,
};

export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

/** Standard progress bar track height — matches account credit/utilization bars. */
export const PROGRESS_BAR_TRACK_HEIGHT = 8;

export const fontFamilies = {
  rounded: Platform.select({
    ios: 'AvenirNext-DemiBold',
    android: 'sans-serif-rounded',
    default: 'System',
  }),
  roundedHeavy: Platform.select({
    ios: 'AvenirNext-Bold',
    android: 'sans-serif-rounded',
    default: 'System',
  }),
} as const;

/**
 * Échelle unifiée : body pour le texte courant, caption/meta pour le secondaire,
 * screenTitle pour les titres d’écran, heroStat / displayAmount pour les gros chiffres.
 */
export const typography = {
  fontFamily: fontFamilies.rounded,
  fontFamilyHeavy: fontFamilies.roundedHeavy,
  screenTitle: 22,
  /** Alias de `screenTitle` (écrans qui utilisent encore `typography.title`). */
  title: 22,
  body: 16,
  caption: 14,
  meta: 13,
  micro: 12,
  /**
   * Accueil tableau de bord : plus lisible que caption, reste sous le prénom (`screenTitle`).
   */
  dashboardGreeting: 18,
  /** Montant central (anneau budget, etc.) */
  heroStat: 24,
  /** Alias de `heroStat` (composant anneau). */
  heroAmount: 24,
  /** Grand montant (numpad nouvelle transaction) */
  displayAmount: 38,
} as const;

/**
 * Décalage supplémentaire au-dessus de la zone sûre basse sur Android (pilule gestuelle /
 * barre 3 boutons) — garde la barre plus basse tout en respectant l'inset système.
 */
export const FLOATING_TABBAR_ANDROID_BOTTOM_EXTRA = spacing.sm;

const FLOATING_NAV_BASE_PADDING = 112;

/** Espace réservé sous le contenu pour la barre flottante + zone sûre */
export const FLOATING_NAV_CONTENT_PADDING =
  FLOATING_NAV_BASE_PADDING +
  (Platform.OS === 'android' ? FLOATING_TABBAR_ANDROID_BOTTOM_EXTRA : 0);

/** Espace standard entre un titre/en-tête de page et son premier contenu. */
export const PAGE_TITLE_CONTENT_GAP = spacing.lg;
