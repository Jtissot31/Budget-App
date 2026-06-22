# Migration typographique — Plus Jakarta Sans

**Date :** 20 juin 2026  
**Périmètre :** `apps/mobile`  
**Objectif :** Remplacer Inter / DM Sans / DM Serif Display par **Plus Jakarta Sans** comme police UI unique.  
**Contexte :** Réapplication identique au chantier précédent, depuis la base post-revert (clean).

---

## Résumé

| Métrique | Valeur |
|---|---|
| Fichiers modifiés (git) | **82** |
| Fichiers créés | 1 (`constants/plusJakartaFonts.ts` — déjà présent, inchangé vs base) |
| Fichiers supprimés | 2 (`constants/interFonts.ts`, `constants/dmSerifFonts.ts`) |
| Package ajouté | `@expo-google-fonts/plus-jakarta-sans` |
| Packages retirés | `@expo-google-fonts/inter`, `@expo-google-fonts/dm-sans`, `@expo-google-fonts/dm-serif-display` |
| Graisses chargées | 400, 500, 600, 700, 800 |
| Vérification grep Inter/DM Sans/DM Serif | **Vide ✓** |

### Exception conservée (hors scope grep)

**DM Mono** (`@expo-google-fonts/dm-mono`) reste chargé pour les lignes d'articles / reçu (`ARTICLES_MONO_FONT` dans `constants/theme.ts`, widgets AI chat). C'était hors périmètre de la migration UI.

---

## Changements par zone

### 1. Installation & chargement

- `npx expo install @expo-google-fonts/plus-jakarta-sans`
- `npm uninstall @expo-google-fonts/inter @expo-google-fonts/dm-sans @expo-google-fonts/dm-serif-display`
- `app/_layout.tsx` : charge `PlusJakartaSans_400Regular` … `800ExtraBold` + `DMMono_*`
- Retrait : Inter, DM Sans, DM Serif Display

### 2. Tokens typographiques

| Avant | Après |
|---|---|
| `constants/interFonts.ts` | `constants/plusJakartaFonts.ts` |
| `interRegularText` … `interExtraBoldText` | `jakartaRegularText` … `jakartaExtraBoldText` |
| `constants/dmSerifFonts.ts` | Supprimé |
| `constants/typographyKit.ts` | Presets inchangés (tailles/rôles), police sous-jacente = Jakarta |
| `constants/theme.ts` | Réexporte `jakarta*` + `fontFamilies` |
| `lib/typographyDefaults.ts` | Default `PlusJakartaSans_400Regular`, `fontWeight: 'normal'` |

### 3. fontWeight arbitraires corrigés (audit)

| Fichier | Correction |
|---|---|
| `components/FloatingTabBar.tsx` | `tabLabel` → `...jakartaSemiboldText` |
| `app/(tabs)/index.tsx` | `health`, `gaugeUsageLabel`, `gaugeEyebrow`, `gaugeAmountLabel`, `eyebrow`, `balanceMint`, `metricUnit`, `balanceWhite` → presets Jakarta |
| `app/savings-goal-transactions.tsx` | `sheetTitle`, `sheetSubtitle`, `goalName`, `goalMeta`, `summaryEyebrow`, `summaryAmount`, `summaryCount` |
| `app/wealth-asset-detail.tsx` | `sectionTitle`, `sectionMeta` |

### 4. Widgets AI chat

- `components/chat/widgets/theme.ts` : `aiWidgetFonts` utilise Plus Jakarta Sans (title/label) ; mono DM Mono conservé pour chiffres widget.

### 5. TransactionInsightCard

- Traitement uniforme : import `dmSerifFonts` retiré ; `jakartaExtraBoldText` importé depuis `@/constants/theme`.

---

## Fichiers modifiés (liste complète — 82)

### App / écrans (16)

- `app/_layout.tsx`
- `app/(tabs)/accounts.tsx`
- `app/(tabs)/budgets.tsx`
- `app/(tabs)/goals.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/transactions.tsx`
- `app/account-detail.tsx`
- `app/add-transaction.tsx`
- `app/contact-detail.tsx`
- `app/goal-detail.tsx`
- `app/loan-detail.tsx`
- `app/merchant-detail.tsx`
- `app/savings-goal-transactions.tsx`
- `app/scan.tsx`
- `app/transaction-detail.tsx`
- `app/wealth-asset-detail.tsx`

### Components (58)

- `components/AddArticleSheet.tsx`
- `components/AgendaView.tsx`
- `components/BankAccountCard.tsx`
- `components/BudgetAllocationChart.tsx`
- `components/BudgetCategoryPicker.tsx`
- `components/BudgetHealthCard.tsx`
- `components/BudgetMonthOverview.tsx`
- `components/BudgetRing.tsx`
- `components/CashAccountCard.tsx`
- `components/ChildSupportBreakdownChart.tsx`
- `components/ConfirmDeleteModal.tsx`
- `components/DashboardAccountBalanceCard.tsx`
- `components/DashboardStatCard.tsx`
- `components/FloatingTabBar.tsx`
- `components/GhostNumpad.tsx`
- `components/HeroChartDelta.tsx`
- `components/ItemizedArticlesEditor.tsx`
- `components/LineOfCreditCharts.tsx`
- `components/MinimizedAlertCard.tsx`
- `components/MortgageCharts.tsx`
- `components/OverflowMenuButton.tsx`
- `components/PaymentListRow.tsx`
- `components/PaymentMethodField.tsx`
- `components/PortfolioChartCard.tsx`
- `components/PrimarySaveButton.tsx`
- `components/RecurringPaymentsForm.tsx`
- `components/RegionPickerSheet.tsx`
- `components/SegmentedTabs.tsx`
- `components/SettingsPickerSheet.tsx`
- `components/SettingsRow.tsx`
- `components/ThemedConfirmModal.tsx`
- `components/ThemedFormMessage.tsx`
- `components/TransactionInsightCard.tsx`
- `components/TransferModePicker.tsx`
- `components/WealthAssetCard.tsx`
- `components/ai-chat/*` (12 fichiers)
- `components/chat/*` (7 fichiers)
- `components/chat/widgets/theme.ts`
- `components/goals/*` (5 fichiers)

### Constants / lib (5)

- `constants/plusJakartaFonts.ts` *(présent — tokens Jakarta)*
- `constants/theme.ts`
- `constants/typographyKit.ts`
- `constants/interFonts.ts` *(supprimé)*
- `constants/dmSerifFonts.ts` *(supprimé)*
- `lib/typographyDefaults.ts` *(déjà aligné Jakarta — pas de diff git)*

### Dépendances (2)

- `package.json`
- `package-lock.json`

---

## Vérification grep

Patterns recherchés dans tous les `.ts` / `.tsx` / `.json` (hors `node_modules`, hors `.expo-*`) :

```
interFonts, Inter_, DMSerif, DMSans,
interBoldText, interMediumText, interRegularText,
interSemiboldText, interExtraBoldText, dmSerif,
@expo-google-fonts/inter, @expo-google-fonts/dm-sans,
@expo-google-fonts/dm-serif, dmSerifFonts
```

**Résultat : aucune occurrence.**

---

## Non modifié (comme demandé)

- Couleurs (background, surface, accents)
- Border-radius
- Logique métier
- Layout / ordre d'affichage / nav bar
- Tailles de police (`fontSize`) — seule la famille et le fichier de graisse ont changé

---

## Test recommandé sur device

1. Relancer Metro : `npx expo start -c`
2. Vérifier le chargement des polices au boot (pas de fallback système visible)
3. Parcourir : Accueil (gauge/balance), bottom nav, Portefeuille, Objectifs sheet, Détail patrimoine
4. Ouvrir un reçu transaction-detail (DM Mono articles toujours monospace)
5. Ouvrir AI chat (widgets Jakarta)

---

*Rapport généré après réapplication typography Jakarta — prêt pour test device.*
