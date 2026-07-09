> **Generated:** 2026-07-08 (read-only audit of `apps/mobile`)
>
> **Post-audit deltas (not reflected in tables below):**
> - `DashboardAccountBalanceCard.tsx` — `chevron-forward` removed from credit account rows
> - `lib/accountBalancePresentation.ts` — credit type label changed from « Carte de crédit » to « Crédit »

# Icon Usage Audit — `apps/mobile`

## 1. Methodology & exclusions

**Scope:** All TypeScript/TSX under `apps/mobile` (`app/`, `components/`, `lib/`, `constants/`, `src/icons/`). Searched with ripgrep for:

- `lucide-react-native`, `AppIcon`, `selectedLucideIcons`, `getSelectedLucideIcon`
- `@expo/vector-icons` (`Ionicons`, `MaterialCommunityIcons`, `MaterialIcons`)
- `MdiIcon`, `MdiIconGlyph`, `WealthMaterialIcon`, `UserPickedIconWell`, `UserPickedIconBadge`, `BudgetCategoryIcon`, `TransactionAvatar`, `MerchantLogo`, `LogoIconFrame`
- Inline `react-native-svg` / custom SVG components
- `require('*.png')` / merchant logo assets
- Config/mock `icon:` keys

**Excluded:**

- Build artifacts (`.expo-syntax-check2/`, `.expo-export-test/`, `.expo-web-*`, etc.)
- `lib/lucideIconCatalog.generated.ts` (~1,739 Lucide catalog entries — listed in Infrastructure, not line-by-line)
- Design reference PNGs (`ref-ui-*.png`, `verify-s25-*.png`)
- **`components/TransactionDetailSheet.tsx`** — protected/locked; no icon imports detected via search
- **`react-native-vector-icons`** — not imported directly; bundled only via `@expo/vector-icons`

**Emoji:** No UI/mock emoji-as-icon usage found.

**Line numbers:** From workspace scan at audit time; may shift with edits.

---

## 2. Summary counts

### By library / type (static references)

| Library / type | Approx. count | Notes |
|---|---:|---|
| **Ionicons** (`@expo/vector-icons`) | **201** | Direct `<Ionicons name=…>` JSX |
| **AppIcon** (Lucide or legacy fallback) | **19** JSX + **18** settings `icon=` props | Resolves via `iconMap` + `selectedLucideIcons` |
| **MaterialCommunityIcons** | **~28** | Tab bar (via AppIcon), plans, AI chat, widgets |
| **MaterialIcons** | **~17** | Plans explorer, AI chat chrome |
| **Lucide direct** (bypass AppIcon) | **~9** | `MonthSelector`, `BudgetShortcutCards`, `AlertCenterContent`, dev picker |
| **MdiIcon / MdiIconGlyph** | **~12** JSX | Custom SVG path catalog |
| **WealthMaterialIcon** (SVG + PNG) | **5** usage sites | gold/platinum/diamond SVG; silver PNG |
| **Custom inline SVG** | **3** components | `FloatingTabBar` Plus FAB, `ShoppingBag4FillIcon`, chart components |
| **Image / merchant logos** | **13** bundled PNGs + remote favicons | `lib/merchantLogo.ts` |
| **Config `icon:` keys** | **~270** | `categoryOptions`, seeds, detail section configs |
| **MDI catalog definitions** | **157** | `lib/mdiIconCatalog.ts` |
| **Lucide selected bundle** | **42** | `selectedLucideIcons.ts` |
| **Legacy→Lucide map entries** | **40** | `lib/iconMigration/iconMap.ts` |

**Total documented static references: ~530+** (JSX + config keys + catalog entries)

### By screen / area (JSX + screen-local config)

| Screen / area | Refs (approx.) |
|---|---:|
| Accueil (`index` + dashboard components) | 45 |
| Portefeuille (`accounts`, holdings, wealth) | 55 |
| Historique / Transactions | 95 |
| Budget | 25 |
| Plans financiers / Goals | 55 |
| Paie | 12 |
| Chat IA / Fyn | 35 |
| Paramètres | 20 |
| Detail routes (stock, wealth, txn, goal, loan, contact, merchant) | 80 |
| Composants partagés (nav, FAB, modals, pickers) | 90 |
| Lib / constantes / infrastructure | 270+ |

---

## 3. Dynamic / runtime icon systems

These resolve icons at runtime — not one static glyph per line.

| System | Entry point | Resolution order |
|---|---|---|
| **AppIcon** | `components/icons/AppIcon.tsx` | `resolveLucideNameForLegacy(family,name)` → if in `designSystemLucideSelection.json` → `getSelectedLucideIcon()` else `LegacyVectorIcon` (Ionicons/MCI/Material) |
| **LegacyVectorIcon** | `components/icons/LegacyVectorIcon.tsx` | Switch on `family`: ionicons / material-community / material |
| **UserPickedIconWell** | `components/UserPickedIconWell.tsx` | cover image → merchant logo URL chain → Lucide (MCI legacy name) → MdiIcon → AppIcon (MCI) → Ionicons fallback |
| **UserPickedIconBadge** | `components/UserPickedIconBadge.tsx` | LogoIconFrame → MdiIcon (expense bag) → MdiIcon → Ionicons |
| **TransactionAvatar** | `components/TransactionAvatar.tsx` | Contact photo → merchant logo → manual icon → type-based fallback via `resolveTransactionMerchantLogo` |
| **MerchantLogo** | `components/MerchantLogo.tsx` | Remote/local logo image → `MdiIconGlyph` fallback |
| **BudgetCategoryIcon** | `components/budget/BudgetCategoryIcon.tsx` | `resolveBudgetCategoryDisplayIcon()` → filled/outline Ionicons or Lucide name |
| **MdiIcon / MdiIconGlyph** | `components/MdiIcon.tsx`, `MdiIconGlyph.tsx` | `getMdiIconDef(name)` from `MDI_ICON_CATALOG` (157 icons) |
| **WealthMaterialIcon** | `components/WealthMaterialIcon.tsx` | `silver` → PNG; gold/platinum/diamond → inline SVG |
| **resolveLoanIcon** | `lib/loanIcons.ts` | Loan type defaults → `resolveMdiOrLegacyIcon(stored)` |
| **accountBalanceIconForKind** | `lib/accountBalancePresentation.ts:165` | credit→`card-outline`, savings→`cash-outline`, cash/checking→`wallet-outline` |
| **getCategoryIcon** (plans) | `lib/plans/planCardPresentation.ts:31` | Fixed MCI map per `PlanCategory` |
| **Merchant logos** | `lib/merchantLogo.ts` | Local bundled PNG → Google favicon → DDG fallback |
| **Lucide dev catalog** | `lib/lucideIconCatalog.ts` + `.generated.ts` | Full Lucide catalog; selection persisted via `lucideIconSelection.ts` |

**FloatingTabBar tab icons** (`components/FloatingTabBar.tsx:47–56`): MCI via AppIcon — `home-outline`, `receipt-text-outline`, `compass-outline`, `wallet-outline`, `chart-pie-outline` (filled variants defined but outline used at L525).

**FAB speed-dial icons** (same file): History — `swap-horizontal-outline`, `arrow-down-circle-outline`, `cash-outline`; Agenda — `repeat-outline`, `document-text-outline`, `trending-up-outline`; Plus FAB — custom SVG `PlusFabIcon` (L69–78).

---

## 4. Full tables by screen

*Columns: File | Icon name/source | Library/type | Context | Line*

---

### Accueil (`app/(tabs)/index.tsx` + dashboard)

#### AppIcon / Lucide migration layer

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `app/(tabs)/index.tsx` | `settings-outline` | AppIcon → Ionicons/Lucide | Header settings button | 1572 |
| `components/AlertCenterButton.tsx` | `notifications-outline` | AppIcon → Ionicons | Alert center FAB | 35 |
| `components/dashboard/HomeAvailableNowHero.tsx` | `eye-outline` / `eye-off-outline` | AppIcon → MCI/Lucide | Balance visibility toggle | 44–46 |
| `components/dashboard/HomeInsightCard.tsx` | `auto-awesome` | AppIcon → Material/Lucide (`Brain`) | INSIGHT badge | 25 |
| `components/dashboard/HomeInsightCard.tsx` | `alert-circle-outline` | AppIcon → MCI/Lucide | Insight warning row | 30 |
| `components/dashboard/HomePlansCarousel.tsx` | `auto-awesome` | AppIcon → Material | Section header sparkle | 56 |
| `components/dashboard/HomePlansCarousel.tsx` | `{plan.icon}` (mock: shield-check, credit-card, wallet) | AppIcon → MCI | Plan carousel cards | 85 |
| `components/PaycheckAllocationWidget.tsx` | `chevron-forward` | AppIcon → Ionicons | Paie widget trailing | 60 |

#### Ionicons (direct)

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `app/(tabs)/index.tsx` | `chevron-up` | Ionicons | Chart expand | 776 |
| `app/(tabs)/index.tsx` | `caret-down` | Ionicons | Period selector | 823 |
| `app/(tabs)/index.tsx` | `wallet` | Ionicons | Legend chip | 851 |
| `app/(tabs)/index.tsx` | `caret-down` | Ionicons | Legend | 861 |
| `app/(tabs)/index.tsx` | `wallet` | Ionicons | Legend | 873 |
| `app/(tabs)/index.tsx` | `close` | Ionicons | Dismiss overlay | 1675 |

#### MaterialCommunityIcons (direct)

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `components/dashboard/HomeNetWorthHero.tsx` | `eye-outline` / `eye-off-outline` | MaterialCommunityIcons | Net worth visibility | 59–61 |

#### Dynamic / image

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `components/DashboardAccountBalanceCard.tsx` | `{accountBalanceIconForKind(kind)}` | Ionicons (dynamic) | Account row fallback | 90–91 |
| `components/DashboardAccountBalanceCard.tsx` | `chevron-forward` | Ionicons | Row chevron | 115 |
| `components/TransactionRow.tsx` | `TransactionAvatar` | UserPickedIconWell / logos | History list avatar | 161 |
| `components/dashboard/HomePlansCarousel.tsx` | mock plan icons | Config | `shield-check-outline`, `credit-card-outline`, `wallet-outline` | 26, 35, 44 |

---

### Portefeuille (`accounts` tab + wealth)

#### Ionicons

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `app/(tabs)/accounts.tsx` | `close` | Ionicons | Sheet dismiss | 1809 |
| `app/(tabs)/accounts.tsx` | `chevron-up` / `chevron-down` | Ionicons | Reorder controls | 1841, 1855 |
| `app/(tabs)/accounts.tsx` | `wallet-outline` | Ionicons | Checking type | 1923 |
| `app/(tabs)/accounts.tsx` | `business-outline` | Ionicons | Institution | 1939, 2020 |
| `app/(tabs)/accounts.tsx` | `pencil-outline` | Ionicons | Edit alias | 1955 |
| `app/(tabs)/accounts.tsx` | `sparkles-outline` | Ionicons | Auto logo | 1993 |
| `app/(tabs)/accounts.tsx` | `home-outline` | Ionicons | Real estate fallback | 2168 |
| `app/(tabs)/accounts.tsx` | `{typeOption.icon}` | Ionicons (dynamic) | Wealth/loan type chips | 2197, 2720 |
| `app/(tabs)/accounts.tsx` | `{option.icon}` | Ionicons (dynamic) | Add-account type list | 3271 |
| `app/(tabs)/accounts.tsx` | `chevron-forward` | Ionicons | Navigation | 3277 |
| `app/(tabs)/accounts.tsx` | `close` | Ionicons | Modal close | 3322 |
| `app/(tabs)/accounts.tsx` | `person-outline` | Ionicons | Contact chip | 3413 |
| `app/(tabs)/accounts.tsx` | `person-add-outline` | Ionicons | Add contact | 3434 |
| `app/(tabs)/accounts.tsx` | `bar-chart-outline` | Ionicons | Portfolio section | 3513 |
| `app/(tabs)/accounts.tsx` | `add` | Ionicons | Add holding | 3542 |
| `app/(tabs)/accounts.tsx` | `image-outline` | Ionicons | Logo picker | 3619 |
| `components/PatrimoineHoldingsSections.tsx` | `add` | Ionicons | Add stock/crypto | 103, 130 |
| `components/WealthAssetCard.tsx` | `home-outline` | Ionicons | Real estate tile | 73 |
| `components/WealthAssetCard.tsx` | `diamond-outline` | Ionicons | Generic wealth fallback | 87 |
| `app/account-detail.tsx` | `{row.icon}` | Ionicons (dynamic) | Info rows | 311 |
| `app/account-detail.tsx` | `chevron-down` | Ionicons | Picker | 445 |
| `app/account-detail.tsx` | `chevron-back` | Ionicons | Back | 733 |
| `app/account-detail.tsx` | `search-outline` / `close-circle` | Ionicons | Transaction search | 966, 983 |
| `app/account-detail.tsx` | `close` | Ionicons | Sheet close | 1119 |
| `app/account-detail.tsx` | `wallet-outline` / `business-outline` / `pencil-outline` | Ionicons | Account edit | 1128, 1142, 1158 |
| `app/account-detail.tsx` | `{type.icon}` | Ionicons (dynamic) | Kind selector | 1222 |
| `app/account-detail.tsx` | `trash-outline` | Ionicons | Delete | 1314 |
| `app/account-detail.tsx` | `business-outline` | Ionicons | Institution row | 1456 |

#### WealthMaterialIcon / UserPicked / MDI

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `app/(tabs)/accounts.tsx` | `{wealthMaterial}` | WealthMaterialIcon (SVG/PNG) | Wealth form preview | 2162, 2166 |
| `app/(tabs)/accounts.tsx` | `{option.id}` (material) | WealthMaterialIcon | Material picker | 2229 |
| `app/(tabs)/accounts.tsx` | `{loanIcon}` | UserPickedIconWell → MdiIcon | Loan icon well | 2502 |
| `app/(tabs)/accounts.tsx` | — | MdiIconPicker | Icon search grid | 2512 |
| `components/WealthAssetCard.tsx` | `{asset.material}` | WealthMaterialIcon | Card header | 81 |

#### Config keys (`accounts.tsx`)

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `app/(tabs)/accounts.tsx` | `card-outline`, `wallet-outline`, `cash-outline` | Ionicons keys | Account kinds | 202–205 |
| `app/(tabs)/accounts.tsx` | `diamond-outline`, `home-outline` | Ionicons keys | Wealth types | 232–233 |
| `app/(tabs)/accounts.tsx` | `people-outline`, `cash-outline`, `card-outline`, `home-outline`, `heart-outline` | Ionicons keys | Loan types | 260–264 |
| `app/(tabs)/accounts.tsx` | (duplicate add-flow options) | Ionicons keys | Add sheets | 275–298 |

---

### Historique / Transactions

#### AppIcon

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `components/transactions/TransactionsViewHeader.tsx` | `scan-outline` | AppIcon | Scan button | 75 |
| `components/transactions/TransactionsViewHeader.tsx` | `search-outline` | AppIcon | Search field | 99 |
| `components/transactions/TransactionsViewHeader.tsx` | `filter` / `filter-outline` | AppIcon | History filters | 123–125 |
| `app/(tabs)/transactions.tsx` | `receipt-outline` | AppIcon | Empty state | 531 |
| `app/(tabs)/transactions.tsx` | `scan-outline` | AppIcon | Scan CTA | 554 |

#### Ionicons (representative — full list)

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `components/FloatingTabBar.tsx` | `{icon}` (history FAB) | Ionicons | Virement/Dépense/Revenu | 356 |
| `components/FloatingTabBar.tsx` | `{icon}` (agenda FAB) | Ionicons | Abonnement/Paiements/Revenus | 440 |
| `app/add-transaction.tsx` | `close`, `business-outline`, `person-add-outline`, `receipt-outline`, `add`, `add-circle-outline` | Ionicons | Form chrome & articles | 1507, 1654, 1673, 1694, 2279, 2308, 2334, 2433 |
| `app/scan.tsx` | `chevron-back`, `flash-outline` | Ionicons | Scanner | 178, 200 |
| `app/transaction-detail/[transactionId].tsx` | `close`, `share-outline`, `download-outline`, `sparkles-outline`, `receipt-outline`, `wallet-outline`, `add-outline`, `scan-outline`, `images-outline`, `camera-outline`, `chevron-forward`, `chevron-back` | Ionicons | Detail/share/receipt UI | 620, 652, 677, 827, 859, 916, 929, 1075, 1128, 1183, 1214, 1224, 1243, 1274, 1293, 2067 |
| `components/AgendaView.tsx` | `calendar-outline`, `checkmark-circle-outline` | Ionicons | Empty states | 893, 915 |
| `components/TransactionInsightCard.tsx` | `sparkles-outline`, `chevron-up`, `chevron-down` | Ionicons | AI insight card | 179, 189, 233, 243 |
| `app/transactions-insights.tsx` | `chevron-back`, `checkmark-circle-outline` | Ionicons | Insights header/CTA | 261, 298, 347 |
| `app/merchant-detail.tsx` | `chevron-back`, `receipt-outline`, `search-outline`, `close-circle` | Ionicons | Merchant detail | 264, 345, 389, 409, 425 |
| `app/merchant-receipts.tsx` | `chevron-back`, `search-outline`, `receipt-outline` | Ionicons | Receipt list | 130, 143, 184 |
| `components/MerchantDirectory.tsx` | `chevron-forward`, `search-outline`, `close-circle`, `add-outline`, `add` | Ionicons | Directory | 105, 177, 193, 221, 246 |
| `components/MerchantEditModal.tsx` | (8× Ionicons — close, search, chevrons, etc.) | Ionicons | Merchant editor | various |
| `components/PaymentDetailSheet.tsx` | `close`, `sparkles`, `trash-outline` | Ionicons | Recurring payment sheet | 786, 841, 921 |
| `components/ReceiptCaptureActions.tsx` | (3× Ionicons) | Ionicons | Receipt capture | — |
| `components/ItemizedArticlesEditor.tsx` | (2× Ionicons) | Ionicons | Article lines | — |
| `components/OverflowMenuButton.tsx` | `ellipsis-horizontal` | Ionicons | Overflow | — |
| `components/SyncStatusBadge.tsx` | cloud icon | Ionicons | Sync status | — |
| `components/AgendaPaymentRow.tsx` | dynamic via `resolveBillDisplayIcon` | UserPickedIconWell | Agenda row | 120 |

#### FloatingTabBar config (Historique/Agenda FAB)

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `components/FloatingTabBar.tsx` | `swap-horizontal-outline` | Ionicons key | History FAB — Virement | 94 |
| `components/FloatingTabBar.tsx` | `arrow-down-circle-outline` | Ionicons key | History FAB — Dépense | 100 |
| `components/FloatingTabBar.tsx` | `cash-outline` | Ionicons key | History FAB — Revenu | 106 |
| `components/FloatingTabBar.tsx` | `repeat-outline` | Ionicons key | Agenda FAB — Abonnement | 133 |
| `components/FloatingTabBar.tsx` | `document-text-outline` | Ionicons key | Agenda FAB — Paiements | 139 |
| `components/FloatingTabBar.tsx` | `trending-up-outline` | Ionicons key | Agenda FAB — Revenus | 145 |
| `components/FloatingTabBar.tsx` | `PlusFabIcon` (SVG path) | Custom SVG | Main FAB | 69–78 |
| `components/FloatingTabBar.tsx` | `home-outline`, `receipt-text-outline`, `compass-outline`, `wallet-outline`, `chart-pie-outline` | AppIcon→MCI | Tab bar (5 tabs) | 47–56, 562–565 |

---

### Budget

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `app/(tabs)/budgets.tsx` | `add` | Ionicons | Add category | 258, 330 |
| `app/(tabs)/budgets.tsx` | `pie-chart-outline` | Ionicons | Empty state | 308 |
| `components/budget/BudgetCategoryRow.tsx` | `BudgetCategoryIcon` | Ionicons/Lucide dynamic | Category row | 67 |
| `components/budget/BudgetCategoryIcon.tsx` | `add` | Ionicons | Add variant | 39 |
| `components/budget/BudgetCategoryIcon.tsx` | `{displayIcon.name}` / `{ionName}` | Ionicons (resolved) | Category glyph | 82, 89, 92 |
| `components/budget/BudgetCategoryDetailSheet.tsx` | `close`, `wallet-outline`, `list-outline` | Ionicons | Sheet chrome | 315, 362, 408 |
| `components/budget/BudgetCategoryAddRow.tsx` | `BudgetCategoryIcon variant="add"` | Ionicons | Add row | 25 |
| `components/budget/BudgetShortcutCards.tsx` | `ChevronRight`, `Target`, `TrendingUp` | Lucide direct | Shortcut cards | 8–10 |
| `components/MonthSelector.tsx` | `ChevronLeft`, `ChevronRight` | Lucide direct | Month nav | 10–11 |
| `app/budget-category-transactions.tsx` | `chevron-back` | Ionicons | Back | 206 |
| `lib/budgetCategories.ts` | `House`, `ShoppingBag`, `Car`, `Smartphone`, `Utensils`, `Gamepad2`, `Shirt`, `HeartPulse`, `CircleAlert` | Lucide names (mock) | Demo categories | 46–54 |

---

### Plans financiers (Goals tab + hub)

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `components/plans/PlanFinancierHub.tsx` | `plus` | MaterialCommunityIcons | Create plan | 121 |
| `components/plans/FynChatEntryCard.tsx` | `chevron-right` | MaterialCommunityIcons | Chat entry | 32 |
| `components/plans/PlanCard.tsx` | `getCategoryIcon(plan.category)` | MaterialCommunityIcons | Plan card | 45–46 |
| `components/plans/HubSavingsGoalsSection.tsx` | `UserPickedIconWell` | MDI/Ionicons dynamic | Goal tiles | 149, 183 |
| `components/plans/HubSavingsGoalsSection.tsx` | `chevron-forward`, `add` | Ionicons | Section chrome | 165, 197, 213, 229 |
| `components/plans/HubLoansSection.tsx` | `UserPickedIconWell` + `chevron-forward`, `add` | Mixed | Loans hub | 108, 148, 164 |
| `components/plans/ExploreMorePlansRow.tsx` | `chevron-forward` | Ionicons | Explorer link | 37 |
| `components/SavingsGoalsForm.tsx` | `close`, `UserPickedIconWell` | Mixed | Goal form | 228, 474 |
| `components/goals/GoalProgressionRow.tsx` | `MdiIcon` / `{icon}` Ionicons | MDI/Ionicons | Progress row | 35, 37 |
| `app/goal-detail.tsx` | `chevron-back`, `search-outline`, `close-circle` | Ionicons | Header/search | 1049, 1270, 1304 |
| `app/savings-goals.tsx` | `arrow-back`, `{goal.icon}`, `chevron-right` | MaterialIcons/MCI | Goals list | 45, 85, 98 |
| `app/plans-list.tsx` | `arrow-back`, `{plan.icon}`, `chevron-right`, `flag` | Material/MCI | Plans list | 43, 78, 89, 119 |
| `components/plans/PlanDetailScreen.tsx` | `arrow-back`, `more-horiz`, `{plan.icon}` | Material/MCI | Plan detail | 53, 67, 84 |
| `components/plans/PlanTemplateDetailScreen.tsx` | `arrow-back`, `getCategoryIcon(category)` | Material/MCI | Template | 64, 77 |
| `components/plans/PlanExplorerSection.tsx` | `auto-awesome`, `keyboard-arrow-down` | MaterialIcons | Explorer header | 98, 102 |
| `components/plans/ExplorerPlansScreen.tsx` | `arrow-back`, `auto-awesome` | MaterialIcons | Explorer | 109, 137 |
| `components/dashboard/PlanUi.tsx` | `flag`, `check-circle` / `radio-button-unchecked` | MaterialIcons | Plan steps UI | 56, 75–76 |
| `lib/plans/planCardPresentation.ts` | `shield-check-outline`, `credit-card-outline`, `piggy-bank-outline`, `wallet-outline`, `file-document-outline`, `shield-alert-outline`, `target` | MCI keys | Category icons | 31–38 |

---

### Paie

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `components/paycheck/PaycheckAllocationScreen.tsx` | `{line.icon}` | AppIcon→MCI | Allocation line | 61 |
| `components/paycheck/PaycheckAllocationScreen.tsx` | `arrow-forward` | AppIcon→Ionicons | Arrow | 72 |
| `components/paycheck/PaycheckAllocationScreen.tsx` | `checkmark-circle` | AppIcon/Ionicons | Confirm | 312, 83 |
| `components/paycheck/PaycheckAllocationScreen.tsx` | `chevron-back` | Ionicons | Back | 221 |
| `components/PaycheckAllocationWidget.tsx` | `chevron-forward` | AppIcon | Accueil widget | 60 |
| `lib/paycheckAllocation.ts` | `home-outline`, `beach`, `shield-outline`, `credit-card-outline` | MCI/Ionicons keys | Mock allocation lines | 24, 32, 40, 48 |

---

### Chat IA / Fyn

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `components/ai-chat/AIChatHeader.tsx` | `arrow-back`, `sparkles`, `dots-vertical` | Material/MCI | Chat header | 62, 69, 91 |
| `components/ai-chat/AIChatInputBar.tsx` | `plus`, `camera-outline`, `send`, `microphone` | MaterialCommunityIcons | Input bar | 55, 81, 97, 106 |
| `components/ai-chat/AIChatMultimodalInput.tsx` | same set | MaterialCommunityIcons | Multimodal input | 117, 142, 158, 168 |
| `components/ai-chat/AIChatProjectionWidget.tsx` | `chart-timeline-variant`, `check-circle-outline` | MaterialCommunityIcons | Projection widget | 25, 46 |
| `components/ai-chat/AIChatPlanSuggestionsBubble.tsx` | `check-circle` | MaterialCommunityIcons | Plan suggestion | 130 |
| `components/chat/ChatHeader.tsx` | Ionicons | Ionicons | Legacy chat header | — |
| `components/chat/InputBar.tsx` | Ionicons (2×) | Ionicons | Legacy input | — |
| `components/chat/widgets/ProgressCardWidget.tsx` | `{iconName}`, `check-circle-outline` | MaterialCommunityIcons | Widget | 36, 64 |
| `components/ai-chat/FynAvatar.tsx` | `fyn-avatar.png` | Image PNG | Avatar | 4 |
| `components/AlertCenterContent.tsx` | `CircleAlert`, `Brain` | Lucide via getSelectedLucideIcon | Section headers | 39–40 |
| `components/AlertCenterContent.tsx` | `notifications-off-outline` | Ionicons | Empty state | 113 |
| `lib/ai/activityPhases.ts` | `wallet-outline`, `bulb-outline`, `search-outline`, `analytics-outline`, `create-outline` | Ionicons keys | Activity phases | 21–41 |

---

### Paramètres

Settings rows pass `icon=` to `SettingsRow` → **AppIcon** (`components/SettingsRow.tsx:98`).

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `app/(tabs)/settings.tsx` | `person` / `person-outline` | AppIcon→Ionicons | Cloud account | 257 |
| `app/(tabs)/settings.tsx` | `color-palette-outline` | AppIcon | Theme | 275 |
| `app/(tabs)/settings.tsx` | `earth-outline` | AppIcon | Region | 293 |
| `app/(tabs)/settings.tsx` | `cash-outline` | AppIcon | Currency | 304 |
| `app/(tabs)/settings.tsx` | `language-outline` | AppIcon | Language | 315 |
| `app/(tabs)/settings.tsx` | `phone-portrait-outline` | AppIcon | Haptic | 326 |
| `app/(tabs)/settings.tsx` | `sparkles-outline` | AppIcon | Autocomplete | 336 |
| `app/(tabs)/settings.tsx` | `calendar-outline` | AppIcon | Date format | 346 |
| `app/(tabs)/settings.tsx` | `keypad-outline` | AppIcon | Numpad | 366 |
| `app/(tabs)/settings.tsx` | `repeat-outline` | AppIcon | Pay frequency | 390 |
| `app/(tabs)/settings.tsx` | `calendar-outline` (×2) | AppIcon | Pay dates | 397, 413 |
| `app/(tabs)/settings.tsx` | `cash-outline` | AppIcon | Pay amount | 429 |
| `app/(tabs)/settings.tsx` | `key-outline` | AppIcon | Anthropic key | 451 |
| `app/(tabs)/settings.tsx` | `analytics-outline` | AppIcon | AI data mode | 488 |
| `app/(tabs)/settings.tsx` | `chatbubble-ellipses-outline` | AppIcon | AI quota | 502 |
| `app/(tabs)/settings.tsx` | `trash-outline` | AppIcon | Clear chat | 514 |
| `app/(tabs)/settings.tsx` | `grid-outline` | AppIcon | Lucide icon picker nav | 552 |
| `components/SettingsRow.tsx` | `chevron-forward` | Ionicons | Default accessory | 156 |

---

### Detail screens (stock, wealth, goal, loan, contact)

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `app/stock/[ticker].tsx` | `chevron-back` | Ionicons | Back | 101 |
| `components/stock/StockDetailSections.tsx` | `chevron-forward` (×2) | Ionicons | Section links | 172, 386 |
| `components/stock/StockPriceDataModal.tsx` | `close` | Ionicons | Modal | 78 |
| `app/wealth-asset-detail.tsx` | `chevron-back`, `chevron-forward` | Ionicons | Nav | 255, 324 |
| `app/wealth-asset-transactions.tsx` | `chevron-back`, `home-outline` | Ionicons | Header/hero | 189, 226 |
| `app/savings-goal-transactions.tsx` | `chevron-back`, `{iconName}` | Ionicons dynamic | Header/hero | 176, 206 |
| `app/contact-detail.tsx` | `person`, `pencil-outline`, `chevron-back`, `search-outline`, `close-circle` | Ionicons | Contact UI | 321, 335, 444, 510, 526 |
| `app/loan-detail.tsx` | `chevron-back`, `trash-outline` (config) | Ionicons | Loan detail | —, 273 |
| `lib/loanDetailSections.ts` | ~45 `icon:` keys | Ionicons keys | Detail rows | 62–467 |
| `lib/wealthAssetDetailSections.ts` | ~20 `icon:` keys | Ionicons keys | Wealth detail rows | 28–179 |

---

### Composants partagés

| File | Icon name/source | Library/type | Context | Line |
|---|---|---|---|---:|
| `components/Fab.tsx` | `add` | Ionicons | Generic FAB | 25 |
| `components/ConfirmDeleteModal.tsx` | Ionicons | Ionicons | Delete confirm | — |
| `components/ThemedConfirmModal.tsx` | `{resolvedIcon}` | Ionicons | Variant icons | 108 |
| `components/ThemedConfirmModal.tsx` | checkmark/alert/warning/info keys | Config | Variants | 52–67 |
| `components/SettingsPickerSheet.tsx` | `close`, `checkmark-circle` | Ionicons | Picker | 98, 142 |
| `components/MinimalDatePicker.tsx` | `calendar-clear-outline`, chevrons | Ionicons | Date picker | 59|9, 187, 197, 223 |
| `components/EditableField.tsx` | `chevron-down`, `checkmark` | Ionicons | Field indicators | 390, 394 |
| `components/SegmentedTabs.tsx` | optional tab icons | Ionicons | Tabs | — |
| `components/MdiIconPicker.tsx` | `search-outline`, `close-circle`, `MdiIconGlyph` | Ionicons + MDI | Icon search grid | — |
| `components/IconPickerSheet.tsx` | `MdiIcon Close/Search`, `UserPickedIconBadge` | MDI + badge | Sheet | 105, 115, 155 |
| `components/TransferModePicker.tsx` | `MdiIcon` | MDI | Transfer modes | 139 |
| `components/PaymentMethodField.tsx` | account kind icons | Ionicons | Payment chips | — |
| `components/ModifierButton.tsx` | Ionicons | Ionicons | Edit affordance | — |
| `components/RegionPickerSheet.tsx` | 6× Ionicons | Ionicons | Region picker | — |
| `components/ContactFormModal.tsx` | `close` | Ionicons | Modal | 93 |
| `components/ContactDirectory.tsx` | 2× Ionicons | Ionicons | Directory | — |
| `components/ContactMerchantRow.tsx` | `MerchantLogo` | Logo/MDI | Row | 43 |
| `components/UserPickedIconBadge.tsx` | `MdiIcon EXPENSE_MDI_ICON`, `{p}` Mdi/Ionicons | MDI/Ionicons | Badge | 113+ |
| `components/icons/ShoppingBag4FillIcon.tsx` | shopping bag SVG | Custom SVG | Expense default (via MDI catalog) | 4 |
| `components/dev/LucideIconPickerScreen.tsx` | `CatalogLucideIcon`, `chevron-back`, `checkmark` | Lucide catalog + Ionicons | Dev tool | 163, 248, 298, 301 |

---

## 5. Lib / constantes (icon keys)

### `constants/categoryOptions.ts` — **98** `icon:` references

Includes: transaction type defaults (`cash-outline`, `swap-horizontal-outline`, `ellipse-outline`), **24** seeded expense categories (L57–273), **36** `MANUAL_ICON_PICKER_OPTIONS` (L376–411), **20** `SAVINGS_GOAL_ICON_OPTIONS` (L416–435), **8** `CATEGORY_EXTRA_ICON_OPTIONS` (L451–458).

### Other lib config files

| File | Count | Icon sources |
|---|---:|---|
| `lib/seedRecurringPayments.ts` | 13 | Ionicons (`home-outline`, `barbell-outline`, `musical-notes-outline`, …) |
| `lib/dashboardPlansMock.ts` | 3 | MCI-style names |
| `lib/savingsGoalsMock.ts` | 4 | Ionicons + `beach`, `chart-line` |
| `lib/seedLoans.ts` | 3 | MDI names (`DirectionsCar`, `Apartments1StoryGabledRoof`, `CreditCard`) |
| `lib/paycheckAllocation.ts` | 4 | MCI/Ionicons |
| `lib/budgetCategories.ts` | 9 | Lucide PascalCase mock names |
| `lib/loanDetailSections.ts` | ~45 | Ionicons outline names |
| `lib/wealthAssetDetailSections.ts` | ~20 | Ionicons outline names |
| `lib/ai/actionExecutor.ts` | 1 | `flag-outline` |
| `lib/expenseIcon.ts` | 1 | `shopping-bag-4-fill` marker → MDI `ShoppingBag4Fill` |
| `lib/loanIcons.ts` | 5 defaults | MDI: `Person`, `CreditCard`, `Apartments1StoryGabledRoof`, `FavoriteBorder`, `AttachMoney` |

---

## 6. Infrastructure (catalogs & migrations)

### Lucide (`selectedLucideIcons.ts`) — 42 bound icons

`ArrowDownFromLine`, `ArrowLeftRight`, `ArrowUpDown`, `ArrowUpToLine`, `BanknoteArrowDown`, `BanknoteCheck`, `Brain`, `ChartPie`, `ChevronUp`, `CircleAlert`, `CloudSync`, `Compass`, `ContactRound`, `CreditCard`, `Eye`, `EyeClosed`, `EyeOff`, `Goal`, `HandCoins`, `HandHeart`, `HeartHandshake`, `House`, `ListFilter`, `MessageCircle`, `Move`, `ReceiptText`, `ScanFace`, `ScanLine`, `ScanText`, `Search`, `Shield`, `ShieldAlert`, `ShieldCheck`, `ShoppingBag`, `Store`, `TrendingDown`, `TrendingUp`, `TriangleAlert`, `Upload`, `Wallet`, `WalletCards`, `WalletMinimal`

### `lib/iconMigration/iconMap.ts` — 40 legacy→Lucide mappings

Tab bar, navigation, finance, people, AI, visibility, upload/sync families (lines 14–73).

### MDI catalog — **157** icons

`lib/mdiIconCatalog.ts` — auto-generated from `src/icons/*.jsx` (159 source files). Each entry: `{ name, label, viewBox, paths[] }`.

### Merchant PNG assets (`lib/merchantLogo.ts`)

| Asset | Merchant |
|---|---|
| `assets/merchants/tim-hortons.png` | Tim Hortons |
| `assets/merchants/iga.png` | IGA |
| `assets/merchants/stm.png` | STM |
| `assets/merchants/netflix.png` | Netflix |
| `assets/merchants/rem.png` | REM |
| `assets/merchants/jean-coutu.png` | Jean Coutu |
| `assets/merchants/petro-canada.png` | Petro-Canada |
| `assets/merchants/maxi.png` | Maxi |
| `assets/merchants/couche-tard.png` | Couche-Tard |
| `assets/merchants/mcdonalds.png` | McDonald's |
| `assets/merchants/super-c.png` | Super C |
| `assets/merchants/visa.png` | Visa |
| `assets/icons/silver-metal.png` | Silver bullion (WealthMaterialIcon) |
| `assets/images/fyn-avatar.png` | Fyn AI avatar |

Remote favicon URLs resolved at runtime via `getMerchantLogoUrls()` (not static line refs).

### Lucide full catalog

`lib/lucideIconCatalog.generated.ts` — **~1,739** Lucide icons available in dev picker (`app/lucide-icons.tsx` → `LucideIconPickerScreen`).

---

## 7. Notable findings

1. **Dual migration path:** New screens use `AppIcon` (Lucide when mapped + selected); most UI still uses raw **Ionicons** (~201 calls).
2. **Plans stack** prefers **MaterialCommunityIcons / MaterialIcons** directly, not AppIcon.
3. **No direct `react-native-vector-icons`** dependency in source — only via Expo.
4. **No emoji icons** in UI or mock data.
5. **Expense default** is MDI `ShoppingBag4Fill`, not Ionicons (`lib/expenseIcon.ts`).
6. **Budget mock categories** store **Lucide PascalCase** names (`House`, `ShoppingBag`, …) resolved in `lib/budgetCategoryIcon.ts`.
7. **`HomeNetWorthHero`** still uses raw MCI for eye toggle while **`HomeAvailableNowHero`** uses AppIcon for the same pattern — inconsistency.

---

*End of audit. Total static references documented: **~530+** (201 Ionicons JSX + 37 AppIcon/Material JSX + ~270 config keys + 157 MDI catalog + 42 Lucide selected + 13 PNG assets + migration maps).*

[REDACTED]