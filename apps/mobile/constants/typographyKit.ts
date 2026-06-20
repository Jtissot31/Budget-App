/**
 * Typography kit — Portefeuille (`accounts.tsx`) is the reference template.
 *
 * Use only these presets (Inter named faces + `fontWeight: 'normal'`).
 * Do not mix `fontWeight: '700'/'800'` with Inter font files.
 *
 * Hierarchy:
 * - pageTitle — screen titles (32px ExtraBold)
 * - sectionTitle — block headers: Patrimoine, Mes soldes (20px ExtraBold)
 * - eyebrow — uppercase labels above sections (12px Medium)
 * - *Amount / *Hero — tabular ExtraBold for money & stats
 * - rowTitle / listPrimary / rowMeta — list & card copy
 */
import {
  interBoldText,
  interExtraBoldText,
  interMediumText,
  interRegularText,
  interSemiboldText,
} from '@/constants/interFonts';

/** Font sizes — keep in sync with `theme.typography` */
const sizes = {
  body: 16,
  caption: 14,
  meta: 13,
  micro: 12,
  dashboardGreeting: 18,
  heroStat: 24,
} as const;

const labelText = {
  ...interMediumText,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.6,
};

const tabular = { fontVariant: ['tabular-nums'] as const };

export const typographyKit = {
  /** Portefeuille tab title, Transactions, Budgets… */
  pageTitle: {
    ...interExtraBoldText,
    fontSize: 32,
    letterSpacing: -0.8,
  },

  /** Patrimoine, Prêts bancaires, Soldes des comptes, Mes soldes… */
  sectionTitle: {
    ...interExtraBoldText,
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 24,
  },

  /** DashboardSectionLabel — VALEUR NETTE, Actifs hors compte… */
  eyebrow: {
    ...labelText,
    fontSize: sizes.micro,
  },

  body: {
    ...interRegularText,
    fontSize: sizes.body,
    lineHeight: sizes.body + 6,
  },

  bodyMedium: {
    ...interMediumText,
    fontSize: sizes.body,
    lineHeight: sizes.body + 6,
  },

  bodyBold: {
    ...interBoldText,
    fontSize: sizes.body,
    lineHeight: sizes.body + 6,
  },

  caption: {
    ...interBoldText,
    fontSize: sizes.caption,
    lineHeight: sizes.caption + 4,
  },

  captionSemibold: {
    ...interSemiboldText,
    fontSize: sizes.caption,
    lineHeight: sizes.caption + 4,
  },

  /** Delta badge, secondary labels */
  meta: {
    ...interBoldText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
  },

  metaMedium: {
    ...interMediumText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
  },

  metaSemibold: {
    ...interSemiboldText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
  },

  micro: {
    ...interBoldText,
    fontSize: sizes.micro,
    lineHeight: sizes.micro + 3,
  },

  microMedium: {
    ...interMediumText,
    fontSize: sizes.micro,
    lineHeight: sizes.micro + 3,
  },

  microUpper: {
    ...interExtraBoldText,
    fontSize: sizes.micro,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },

  /** List row title — Historique, transactions */
  rowTitle: {
    ...interBoldText,
    fontSize: sizes.caption,
    lineHeight: sizes.caption + 4,
    letterSpacing: -0.1,
  },

  /** Account / asset name on Portefeuille cards */
  listPrimary: {
    ...interBoldText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
    letterSpacing: -0.2,
  },

  listSubtitle: {
    ...interMediumText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
  },

  /** Valeur nette headline */
  netWorthHero: {
    ...interExtraBoldText,
    ...tabular,
    fontSize: 42,
    letterSpacing: -1.6,
  },

  /** Wealth card main value (Patrimoine carousel) */
  statHero: {
    ...interExtraBoldText,
    ...tabular,
    fontSize: 28,
    letterSpacing: -0.8,
    lineHeight: 33,
  },

  /** Budget disponible, medium hero stats */
  heroStat: {
    ...interExtraBoldText,
    ...tabular,
    fontSize: sizes.heroStat,
    letterSpacing: -0.5,
    lineHeight: sizes.heroStat + 4,
  },

  /** Prochain paiement / agenda card amount */
  paymentAmount: {
    ...interExtraBoldText,
    ...tabular,
    fontSize: sizes.dashboardGreeting,
    letterSpacing: -0.45,
  },

  /** Chart Actifs / Dettes pills */
  cardMetric: {
    ...interExtraBoldText,
    ...tabular,
    fontSize: 16,
    letterSpacing: -0.3,
  },

  /** Standard list amount column */
  rowAmount: {
    ...interExtraBoldText,
    ...tabular,
    fontSize: sizes.caption,
    lineHeight: sizes.caption + 4,
    letterSpacing: -0.3,
  },

  /** Detail sheet hero amount */
  detailHero: {
    ...interExtraBoldText,
    ...tabular,
    fontSize: 36,
    letterSpacing: -0.5,
    textAlign: 'center' as const,
  },

  /** Budget ring % */
  percent: {
    ...interExtraBoldText,
    ...tabular,
    fontSize: sizes.dashboardGreeting,
    lineHeight: sizes.dashboardGreeting + 2,
    textAlign: 'center' as const,
  },

  /** Date badge day numeral */
  dateBadgeDay: {
    ...interExtraBoldText,
    ...tabular,
    fontSize: sizes.dashboardGreeting,
    lineHeight: sizes.dashboardGreeting,
  },

  dateBadgeMonth: {
    ...interExtraBoldText,
    fontSize: sizes.micro - 4,
    letterSpacing: 0.5,
  },
} as const;

/** @deprecated Import `typographyKit.pageTitle` */
export const PAGE_TITLE_STYLE = typographyKit.pageTitle;

/** @deprecated Import `typographyKit.sectionTitle` */
export const SECTION_TITLE_STYLE = typographyKit.sectionTitle;
