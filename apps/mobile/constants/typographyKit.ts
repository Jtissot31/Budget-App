/**
 * Typography kit — Portefeuille (`accounts.tsx`) is the reference template.
 *
 * Use only these presets (Plus Jakarta Sans named faces + `fontWeight: 'normal'`).
 * Do not mix `fontWeight: '700'/'800'` with Plus Jakarta Sans font files.
 *
 * **Money amounts:** size tokens live here (`rowAmount`, `cardMetric`, …) but the
 * font face is always {@link MONEY_AMOUNT_FONT} via {@link moneyAmountTypography}
 * in `constants/theme.ts` — do not apply these presets directly to dollar amounts.
 *
 * Hierarchy:
 * - pageTitle — screen titles (32px ExtraBold)
 * - sectionTitle — block headers: Patrimoine, Mes soldes (20px ExtraBold)
 * - eyebrow — uppercase labels above sections (12px Medium)
 * - *Amount / *Hero — tabular size tokens for money (font via theme kit)
 * - rowTitle / listPrimary / rowMeta — list & card copy
 */
import {
  jakartaBoldText,
  jakartaExtraBoldText,
  jakartaMediumText,
  jakartaRegularText,
  jakartaSemiboldText,
} from '@/constants/plusJakartaFonts';

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
  ...jakartaMediumText,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.6,
};

const tabular = { fontVariant: ['tabular-nums'] as const };

/** Canonical money font — matches `TransactionAmountLabel` (−105,68$). */
export const MONEY_AMOUNT_FONT = 'Onest_800ExtraBold';

/** @deprecated Import {@link MONEY_AMOUNT_FONT} */
export const TRANSACTION_ROW_AMOUNT_FONT = MONEY_AMOUNT_FONT;

export const typographyKit = {
  /** Portefeuille tab title, Transactions, Budgets… */
  pageTitle: {
    ...jakartaExtraBoldText,
    fontSize: 32,
    letterSpacing: -0.8,
  },

  /** Patrimoine, Prêts bancaires, Soldes des comptes, Mes soldes… */
  sectionTitle: {
    ...jakartaExtraBoldText,
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 24,
  },

  /** DashboardSectionLabel — VALEUR NETTE, Actifs hors compte… (~iOS Footnote) */
  eyebrow: {
    ...labelText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 3,
  },

  body: {
    ...jakartaRegularText,
    fontSize: sizes.body,
    lineHeight: sizes.body + 6,
  },

  bodyMedium: {
    ...jakartaMediumText,
    fontSize: sizes.body,
    lineHeight: sizes.body + 6,
  },

  bodyBold: {
    ...jakartaBoldText,
    fontSize: sizes.body,
    lineHeight: sizes.body + 6,
  },

  caption: {
    ...jakartaBoldText,
    fontSize: sizes.caption,
    lineHeight: sizes.caption + 4,
  },

  captionSemibold: {
    ...jakartaSemiboldText,
    fontSize: sizes.caption,
    lineHeight: sizes.caption + 4,
  },

  /** Delta badge, secondary labels */
  meta: {
    ...jakartaBoldText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
  },

  metaMedium: {
    ...jakartaMediumText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
  },

  metaSemibold: {
    ...jakartaSemiboldText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
  },

  micro: {
    ...jakartaBoldText,
    fontSize: sizes.micro,
    lineHeight: sizes.micro + 3,
  },

  microMedium: {
    ...jakartaMediumText,
    fontSize: sizes.micro,
    lineHeight: sizes.micro + 3,
  },

  microUpper: {
    ...jakartaExtraBoldText,
    fontSize: sizes.micro,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },

  /** List row title — Historique, transactions */
  rowTitle: {
    ...jakartaBoldText,
    fontSize: sizes.caption,
    lineHeight: sizes.caption + 4,
    letterSpacing: -0.1,
  },

  /** Account / asset name on Portefeuille cards */
  listPrimary: {
    ...jakartaBoldText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
    letterSpacing: -0.2,
  },

  listSubtitle: {
    ...jakartaMediumText,
    fontSize: sizes.meta,
    lineHeight: sizes.meta + 5,
  },

  /** Valeur nette headline */
  netWorthHero: {
    ...jakartaExtraBoldText,
    ...tabular,
    fontSize: 42,
    letterSpacing: -1.6,
  },

  /** Wealth card main value (Patrimoine carousel) */
  statHero: {
    ...jakartaExtraBoldText,
    ...tabular,
    fontSize: 28,
    letterSpacing: -0.8,
    lineHeight: 33,
  },

  /** Budget disponible, medium hero stats */
  heroStat: {
    ...jakartaExtraBoldText,
    ...tabular,
    fontSize: sizes.heroStat,
    letterSpacing: -0.5,
    lineHeight: sizes.heroStat + 4,
  },

  /** Prochain paiement / agenda card amount */
  paymentAmount: {
    ...jakartaExtraBoldText,
    ...tabular,
    fontSize: sizes.dashboardGreeting,
    letterSpacing: -0.45,
  },

  /** Chart Actifs / Dettes pills */
  cardMetric: {
    ...jakartaExtraBoldText,
    ...tabular,
    fontSize: 16,
    letterSpacing: -0.3,
  },

  /** Standard list amount column */
  rowAmount: {
    ...jakartaExtraBoldText,
    ...tabular,
    fontSize: sizes.caption,
    lineHeight: sizes.caption + 4,
    letterSpacing: -0.3,
  },

  /** Detail sheet hero amount */
  detailHero: {
    ...jakartaExtraBoldText,
    ...tabular,
    fontSize: 36,
    letterSpacing: -0.5,
    textAlign: 'center' as const,
  },

  /** Budget ring % */
  percent: {
    ...jakartaExtraBoldText,
    ...tabular,
    fontSize: sizes.dashboardGreeting,
    lineHeight: sizes.dashboardGreeting + 2,
    textAlign: 'center' as const,
  },

  /** Date badge day numeral */
  dateBadgeDay: {
    ...jakartaExtraBoldText,
    ...tabular,
    fontSize: sizes.dashboardGreeting,
    lineHeight: sizes.dashboardGreeting,
  },

  dateBadgeMonth: {
    ...jakartaExtraBoldText,
    fontSize: sizes.micro - 4,
    letterSpacing: 0.5,
  },
} as const;

/** @deprecated Import `typographyKit.pageTitle` */
export const PAGE_TITLE_STYLE = typographyKit.pageTitle;

/** @deprecated Import `typographyKit.sectionTitle` */
export const SECTION_TITLE_STYLE = typographyKit.sectionTitle;
