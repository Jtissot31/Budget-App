# Mapping actuel — composants → tokens

Extracted from `apps/mobile/` (no invented tokens). Status: **aligned** = uses theme/Onyx kit as intended; **partial** = mix of tokens + hardcodes or alternate radius; **divergent** = local palette or conflicting greens/radii.

| Component | Location | Tokens / patterns used | Status |
|-----------|----------|------------------------|--------|
| **OnyxContainer** | `components/OnyxContainer.tsx` | Re-exports `PlanFinanceContainer`; `ONYX_CONTAINER`, theme `containerBackground`/`containerBorder`, halo, 13px | aligned |
| **PlanFinanceContainer** | `components/plans/PlanFinanceContainer.tsx` | `planFinanceContainerShellStyle`, `planFinanceCardHalo`, hairline, 13px | aligned |
| **PrimarySaveButton** | `components/PrimarySaveButton.tsx` | `colors.primary` (`#00e664` dark), `colors.background` text, `radius.sm` (8), Jakarta ExtraBold 16 | partial — CTA green ≠ `#4ADE80` accent |
| **FloatingTabBar** | `components/FloatingTabBar.tsx` | Blur glass hardcodes, `colors.accentGreen` FAB, `spacing`/`typographyKit`, insets helpers | partial — bar tint not from `DARK_CANVAS` token |
| **DashboardAccountBalanceCard** | `components/DashboardAccountBalanceCard.tsx` | `PlanFinanceContainer`, compact tile padding, pressed style, `moneyAmountTypography` card, `typographyKit` | aligned |
| **PlanCard** | `components/plans/PlanCard.tsx` | `OnyxContainer` (full), `DashboardCard` (home), pressed Onyx style, `moneyAmountTypography`, `planCardPresentation` | partial — multi-layout shells |
| **BudgetCategoryRow** | `components/budget/BudgetCategoryRow.tsx` | `containerBackground`/`containerBorder`, `radius.lg` (16), `moneyAmountTypography`, ProgressBar | partial — not Onyx 13; custom selected elevate |
| **BudgetCategoryIcon** | `components/budget/BudgetCategoryIcon.tsx` + `lib/budgetCategoryIcon.ts` | Well `#28282E`, size 36, radius 10 | divergent vs `ICON_WELL_SIZE` 34 / `#181818` input |
| **BudgetCategorySuggestionTile** | `components/budget/BudgetCategorySuggestionTile.tsx` | Budget suggestion tile (category flow) | partial — verify against Onyx when touching |
| **add-budget-category** | `app/add-budget-category.tsx` | `colors.input`/`border`, glass `controlStrong`, `FORM_SECTION_LABEL_STYLE`, sheet `containerBackground` | partial — form glass, not Onyx cards |
| **add-transaction** | `app/add-transaction.tsx` | `containerSurfaceStyle`, `chipSelectableShellStyle`, `colors.input`, `PrimarySaveButton`, `radius.lg`/`pill` | partial — 16–18 radius family |
| **SurfaceCard** | `components/SurfaceCard.tsx` | Default `radius.card` **18**, glass/surface family | aligned to legacy surface (not Onyx) |
| **ThemeSegmentedControl** | `components/ThemeSegmentedControl.tsx` | `segmentedTabBar*` / `liquidSegmentedSpring` | aligned |
| **PremiumSwitch** | `components/PremiumSwitch.tsx` | `toggleTrackOff` `#28282E`, `accentGreen` on-track | aligned |
| **DashboardCard** | `components/DashboardCard.tsx` | Home plan rows / dashboard cards | partial — home shell vs Onyx full |
| **BankAccountCard / CashAccountCard / LoanCard** | `components/*` | Money typography; CashAccountCard hardcodes void `#0E0E10` | partial / divergent void color |
| **TransactionRow** | `components/TransactionRow.tsx` (or equiv.) | `transactionRowAmountTypography`, list typography | aligned (no DM Mono) |
| **AI chat theme** | `components/ai-chat/theme.ts` | Local `#0E0E10` / `#28282E` / `#4ADE80` | divergent from `DARK_CANVAS` / `#111111` |
| **FynAvatar** | `components/ai-chat/FynAvatar.tsx` | Status `#4ADE80`, border default `#0E0E10` | divergent canvas match to chat |
| **Plan finance buttons/inputs** | `constants/planFinanceKit.ts` helpers | accent `#4ADE80`, input `#1A1A1D`, border rgba, radius 13 | aligned to plan kit; border ≠ theme `#1c1c1c` |
| **HubLoansSection / StockHoldingTile / WealthHoldingTile** | patrimoine / hub | Onyx / PlanFinanceContainer row & compact padding | aligned (reference impls) |
| **ProgressBar** | `components/ProgressBar.tsx` | `PROGRESS_BAR_TRACK_HEIGHT` 8; goal fill `#4ADE80` | aligned |
| **TransactionDetailSheet** | `components/TransactionDetailSheet.tsx` | — | **locked — do not modify** |
| **Articles / receipt** | transaction-detail ARTICLES | `ARTICLES_MONO_FONT`, `articlesReceiptTypography` | aligned (DM Mono scoped) |

## Token sources (quick)

| Concern | File |
|---------|------|
| Colors, spacing, radius, money helpers | `constants/theme.ts` |
| Onyx / plan finance shell | `constants/planFinanceKit.ts` |
| Label hierarchy | `constants/typographyKit.ts` |
| Jakarta faces | `constants/plusJakartaFonts.ts` |
| Money face | `constants/interFonts.ts` |
| Chat palette | `components/ai-chat/theme.ts` |

## Status legend for migrations

- Prefer **Onyx** for new interactive list/grid cards.
- Keep **containerSurface / SurfaceCard 18px** for alert / glass surfaces until explicitly migrated.
- Prefer **`accentGreen` `#4ADE80`** for Disponible/success UI; note CTAs still on **`primary` `#00e664`**.
