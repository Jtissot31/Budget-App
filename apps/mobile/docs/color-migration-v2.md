# Migration couleurs — palette v2

Date : 2026-06-20  
Scope : `apps/mobile` — tokens UI, palettes locales, règle couleur-sur-texte (18 corrections audit).

## Palette v2 (source unique)

| Token | Valeur |
|---|---|
| `background` / `DARK_CANVAS` | `#0E0E10` |
| `surface` / `CONTAINER_SURFACE` | `#28282E` |
| `accentGreen` / `ACCENT_GREEN` | `#4ADE80` |
| `accentRed` / `ACCENT_RED` | `#C96560` |
| `accentWarning` / `ACCENT_WARNING` | `#C9974A` |
| `CONTAINER_BORDER` | `#36363E` |
| `surfaceElevated` (dark) | `#323238` |
| `iconBox` / `input` (dark) | `#222228` |

## Fichiers modifiés

### Tokens centraux
- `constants/theme.ts` — palette v2, suppression double vert/rouge UI, `accentWarning` first-class, muted rgba recalibrés
- `constants/ghostUi.ts` — `mint` / `kingdom` → `#4ADE80`

### Palettes locales (audit)
- `app/(tabs)/index.tsx` — `rgba(245,245,245,0.84)` → `colors.textMuted` / `#666666` fallbacks StyleSheet
- `app/transaction-detail.tsx` — `SHARE_THEME` harmonisé v2
- `app/add-transaction.tsx` — fond modal `#0F0F10` → `colors.background` ; warning transfert
- `components/CashAccountCard.tsx` — hiérarchie wallet sur nouvelles surfaces + `negative` v2
- `components/ai-chat/theme.ts` — `ACCENT_GREEN` / surfaces thème
- `components/chat/widgets/theme.ts` — `surface` → `#28282E`

### Alignements UI connexes (hors graphiques)
- `components/BankAccountCard.tsx` — `negative` / `positive` v2
- `components/BudgetMonthOverview.tsx` — seuils budget + chips insight v2
- `components/BudgetHealthCard.tsx` — accents v2 + statut
- `components/RecurringPaymentsForm.tsx` — `DEFAULT_COLOR` v2

## Remplacements token (ancien → v2)

| Ancien | Nouveau | Zone |
|---|---|---|
| `#0a0a0a`, `#111111`, `#161618` | `#0E0E10` / `#141418` | canvas, codeBg |
| `#181818`, `#1c1c1c`, `#1a1a1a`, `#1c1c1f` | `#28282E` / `#323238` | surface, elevated |
| `#00e664`, `#00a854` | `#4ADE80` | primary, success, green |
| `#ff5555`, `#cf222e`, `#FF6B6B` | `#C96560` | danger, red |
| `#e6a000`, orange legacy | `#C9974A` | warning |
| `rgba(245,245,245,0.84)` | `colors.textMuted` / `#666666` | Accueil muted |

**Non modifié (volontaire)** : `chartTokens`, `goalGreenPalette`, `portfolioLight/Dark.chartCurve`, couleurs internes des fichiers graphiques listés, `constants/categoryOptions.ts`, palette catégories `budgets.tsx`, `lib/institutionBrandColor.ts`.

## 18 corrections couleur-sur-texte

| # | Fichier | Correction |
|---|---|---|
| 1 | `app/(tabs)/index.tsx` L860 | Légende paiement alerte : texte `muted`, couleur sur `AlertDiamondFillIcon` |
| 2 | `app/(tabs)/index.tsx` L866 | Légende paie estimée : texte `muted`, couleur sur icône wallet |
| 3 | `components/BudgetHealthCard.tsx` L171 | Labels Attention/Critique/Bien : dot coloré + texte `muted` |
| 4 | `components/BudgetRing.tsx` L56 | `{pct}% libre` → `textMuted` (arc SVG reste `primary`) |
| 5 | `components/DashboardDateBadge.tsx` L26 | Mois → `textMuted` + barre latérale `primary` |
| 6 | `components/SavingsGoalsForm.tsx` L283 | Warning : icône + fond `warningMuted`, texte neutre |
| 7 | `app/add-transaction.tsx` L2166 | Warning transfert : icône + texte `textMuted` |
| 8 | `components/ThemedFormMessage.tsx` L36 | Titre → `colors.text` (icône colorée inchangée) |
| 9 | `components/ConfirmDeleteModal.tsx` L143 | Icône trash `danger`, label bouton `text` |
| 10 | `components/SettingsRow.tsx` L108 | Icône `danger`, label `text` |
| 11 | `components/WealthAssetCard.tsx` L263 | Montant $ coloré, `· +X %` en `textMuted` |
| 12 | `app/(tabs)/settings.tsx` L233 | Dot vert + « Connecté » en `text` |
| 13 | `components/ai-chat/AIChatSettingsSheet.tsx` L379 | Row quota warning : icône warning, value `text` |
| 14 | `components/RegionPickerSheet.tsx` L348 | Preview lettre : barre gauche verte, texte neutre |
| 15 | `components/RegionPickerSheet.tsx` L371 | Index : barre latérale highlight, lettres `textMuted` |
| 16 | `components/RecurringPaymentsForm.tsx` L422 | Chip Revenu/Paiement : fond/bordure selected, texte neutre |
| 17 | `app/loan-detail.tsx` L197 | `{pct} %` → `textMuted` (barre SVG colorée) |
| 18 | `app/(tabs)/accounts.tsx` L3844 | Badge dette : montant `danger`, `$` `textMuted` |

## Cas ambigus laissés intacts

- `BudgetHealthCard` — `{pct}%` centre du ring (coloré)
- `PaymentListRow` — badges compacts
- `PaymentDetailSheet` — `impactSummary.primary`
- `wealth-asset-detail.tsx` — hero amount
- `TransactionRow` — `amountIncome`
- `accounts.tsx` — `wealthToggleBadgeLabel` (autres usages)
- `RecurringPaymentsForm` — `impactSummary.primary` quand type revenu (montant projeté, pas label chip)

## Graphiques — confirmation non-touchés

Aucune modification dans :
- `LineOfCreditCharts.tsx`
- `MortgageCharts.tsx`
- `BudgetAllocationChart.tsx`
- `PortfolioChartCard.tsx`
- `HeroChartDelta.tsx`
- `ChildSupportBreakdownChart.tsx`
- `constants/linearChart.ts` / `chartTokens` dans `theme.ts`

## Doutes / flags

1. **`BudgetMonthOverview` insight chips** — `sparkColor` mini-sparklines mis à jour v2 (pas un fichier graphique audit, mais tracé SVG). À valider visuellement.
2. **`FloatingTabBar.tsx` FAB gradient** — encore `#00e664` dans le dégradé ; hors liste explicite, laissé tel quel.
3. **`RootErrorBoundary.tsx`** — écran d’erreur legacy `#0A0A0A` / `#00E664` ; hors scope UI principal.
4. **`MessageBubble.tsx` / `InputBar.tsx`** — contrastes `#111111` sur bulles vertes ; fonctionnels, non migrés.
5. **`loan-detail.tsx` L234** — carte « Solde » dette entre amis : montant hero reste `danger` (montant, pas label %) — différent de la correction barre progression L197.
6. **`BankAccountCard` CARD.fill `#101010`** — illustration carte bancaire, non listée dans l’audit surface ; seuls `negative`/`positive` alignés v2.

## Test device

```bash
npx expo start -c
```

Vérifier : Accueil (légendes alertes), Santé budget, Portefeuille (badge dettes), Paramètres (Connecté), formulaires warning, picker régions.
