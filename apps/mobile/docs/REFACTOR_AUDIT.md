# REFACTOR_AUDIT — Design tokens + fyn-ui consistency

**Date:** 2026-07-27  
**Scope:** `apps/mobile/app/**/*.tsx`, `apps/mobile/components/**/*.tsx`  
**Excluded:** `node_modules`, `dist`, **`components/TransactionDetailSheet.tsx`** (locked)  
**ADB (S25):** no device attached (`adb devices` empty) — visual captures **skipped** for this pass.

---

## Summary counts (raw scans)

| Category | `app/` | `components/` (excl. locked sheet) | Combined |
|----------|--------|--------------------------------------|----------|
| Hex `#…` literals | **34** | **141** | **~175** |
| `fontSize: N` hardcodes | **59** | **213** | **~272** |
| `borderRadius: N` hardcodes | **74** | **120** | **~194** |
| Spacing magic (`padding`/`margin`/`gap`: N) | **243** | **290** | **~533** |

Hundreds of hardcodes exist. Many are acceptable noise (shadows `#000`, icon glyph colors, chart illustration palettes, `StyleSheet.hairlineWidth`, one-off 1–4px). This audit prioritizes **high-traffic screens** and **token-identical swaps**. Tables below are **representative (~30–50 / category)**, not exhaustive.

**fyn-ui adoption today:** only `app/fyn-ui-lab.tsx` + the library itself imports `@/constants/design-tokens` / `@/components/fyn-ui`. Production screens still use `useAppTheme()`, `constants/theme.ts`, Onyx / `PlanFinanceContainer`.

---

## 1. Inconsistances Trouvées

### 1.1 Couleurs Hardcodées (high-impact)

| Location | Color | Should Be | Issue |
|----------|-------|-----------|-------|
| `app/alert-center.tsx` | `#000000` (screen bg) | *keep* or document — no pitch-black token (`COLORS.dark.canvas` = `#0a0a0a`) | Diverges from design-system “canvas ≠ pitch #000” |
| `app/alert-center.tsx` | `#FFFFFF` (title / icons) | `COLORS.text` / `COLORS.dark.text` | Identical `#ffffff` — safe swap |
| `app/alert-center.tsx` | `#1A1A1A` (filter btn) | *keep* — closest `COLORS.planFinance.input` = `#1A1A1D` | Near-miss; swap would tint |
| `app/(tabs)/index.tsx` | `#fff` / `#000` (icon colors) | `COLORS.text` / on-accent via theme | Dashboard hero chrome |
| `app/(tabs)/accounts.tsx` | `#F6F8FA`, `#FFFFFF`, `#D0D7DE` | `COLORS.light.*` / theme light surfaces | Local light-section palette not in tokens |
| `app/transaction-detail/[transactionId].tsx` | Local palette `#0a0a0a`…`#00e664` | `COLORS.dark.*` | Duplicates theme; **do not touch sheet**; route screen OK later |
| `app/onboarding.tsx` | `#000000`, `#111111` | canvas / `COLORS.surface` | Pitch vs charcoal |
| `app/transactions-insights.tsx` | `#0a0a0a` | `COLORS.dark.canvas` / `DARK_CANVAS` | Safe identical swap |
| `app/loan-detail.tsx` / `wealth-asset-detail.tsx` | `#E8EDF3` / `#08090B` | theme track helpers if added | Repeated progress-track pair |
| `components/CashAccountCard.tsx` | `#0E0E10`, `#0A0A0C`, `#121214`… | *feature palette* — map only if product wants theme | Known void divergence vs canvas |
| `components/BankAccountCard.tsx` | `#101010`, `#ffffff` | surface/text tokens where identical | Card-local dark |
| `components/BlinkingCursor.tsx` | `#4ADE80` | `COLORS.green` / `accentGreen` | Safe |
| `components/ai-chat/FynAvatar.tsx` | `#4ADE80`, `#0E0E10` | `COLORS.green`, `COLORS.aiChatDark.background` | Chat canvas ≠ main canvas |
| `components/FloatingTabBar.tsx` | `#FFFFFF`, `#6B6B6B`, `#111111` | text / segmented inactive / surface | Nav chrome |
| `components/PaycheckAllocationWidget.tsx` | `AVAILABLE_GREEN = #4ADE80` | `COLORS.green` | Duplicated across paycheck files |
| `components/paycheck/PaycheckAllocationScreen.tsx` | same | `COLORS.green` | Duplicate const |
| `components/dev/LucideIconPickerScreen.tsx` | `#4ADE80` | `COLORS.green` | Dev screen — easy win |
| `components/RecurringPaymentsForm.tsx` | `#00A854`, `#F43F5E`, `#4ADE80`… | chart/light primary / category colors | Form defaults + mode tints |
| `components/chat/widgets/BarChartWidget.tsx` | local `#00E664`, `#E6A000`… | `COLORS.dark.primary`, `COLORS.amber` | Widget-local chart kit |
| `components/plans/AvalancheStrategyContent.tsx` | illustration hex stack | *skip* (decorative scene) | Not product chrome |
| `components/plans/SnowballStrategyContent.tsx` | same | *skip* | Same |
| `components/TransactionArticlesReceiptCard.tsx` | `#FAFAFA`, `#0F0F10`, `#C8C8CE` | receipt-specific — keep; DM Mono OK here | Articles surface |
| `components/AddArticleSheet.tsx` | `#000000` on CTA text | `COLORS.textOnGreen` is `#0a0a0a` — **not** identical | Don’t force; near-miss |
| `components/RootErrorBoundary.tsx` | `#F5F5F5` | light text / fallback | Rare path |
| `app/budget-category-transactions.tsx` | contrast helper `#000`/`#FFF` | keep (algorithmic) | Not a style token issue |

**Acceptable / skip (noise):** `shadowColor: '#000000'`, SVG fill one-offs, metal icon fills (`WealthMaterialIcon`), strategy comic palettes, ActivityIndicator `#000` on green FABs when matching existing CTA.

---

### 1.2 Spacing Inconsistent

| Location | Value(s) | Should Be | Issue |
|----------|----------|-----------|-------|
| `app/(tabs)/index.tsx` | dozens of magic padding/gap | `SPACING.*` / `spacing` from theme | Highest density (~65 spacing literals) |
| `app/(tabs)/accounts.tsx` | ~48 spacing literals | `SPACING` / `PAGE_PADDING_HORIZONTAL` | Portfolio sections partly use portfolio gaps |
| `app/add-transaction.tsx` | ~42 spacing literals | `SPACING` + form field gaps | Form layout |
| `app/alert-center.tsx` | `Math.max(…, 56)` bottom pad | no 56 token — keep or add later | One-off |
| `app/(tabs)/settings.tsx` | `paddingVertical: 3`, `14` | `SPACING.tagPaddingVertical` (3), near `planCardGap` (14) | StyleSheet leftovers |
| `components/RecurringPaymentsForm.tsx` | ~20 spacing literals | `SPACING` | Large form |
| `components/AgendaView.tsx` | ~13 | `SPACING` | Agenda density |
| `components/WealthAssetCard.tsx` | ~9 | `SPACING` / Onyx row padding | Card internals |
| `components/BudgetDonut.tsx` | ~8 | chart layout — often keep | Geometry |
| `components/ai-chat/AIChatMessage.tsx` | ~8 | chat bubble padding | Chat kit |
| Many files | `padding: 12` | `SPACING.md` / `SPACING.onyxRowPadding` | Same value, many spellings |
| Many files | `gap: 8` | `SPACING.sm` / `onyxListGap` | Same |
| Many files | `paddingHorizontal: 16` | `SPACING.lg` / `pagePaddingHorizontal` | Same as theme `PAGE_PADDING_HORIZONTAL` |

**Acceptable / skip:** `padding: 1` with border compensation, safe-area math, chart plot insets, hairline-adjacent 0.5 offsets.

---

### 1.3 Border Radius Issues

| Location | Value | Should Be | Issue |
|----------|-------|-----------|-------|
| `app/(tabs)/index.tsx` | 24, 20, 18, 16, 14, 12, 11, 10, 7, 4, 3… | `RADIUS.pill` / `card` (18) / `lg` (16) / `md` (12) / `onyx` (13) / `sm` (8) | Dashboard is the worst radius salad |
| `app/(tabs)/accounts.tsx` | many | same | Portfolio + section cards |
| `app/(tabs)/settings.tsx` | `13` | `RADIUS.onyx` | Amount input |
| `app/alert-center.tsx` | `20` | `RADIUS.planIconButton` | Filter chip |
| `app/merchant-receipts.tsx` / `scan.tsx` | `19` | *keep* — nearest `RADIUS.card` = 18 | Would change look if forced |
| `app/(tabs)/transactions.tsx` | several | theme radius | List chrome |
| `components/budget/BudgetCategoryRow.tsx` | often 16 | `RADIUS.lg` — **not** Onyx 13 | Known partial (MAPPING_ACTUEL) |
| `components/paycheck/PaycheckAllocationScreen.tsx` | ~10 hardcodes | map to scale | Dense UI |
| `components/AgendaView.tsx` | ~6 | mix | Agenda cards |
| `components/AgendaCashHeroCard.tsx` | ~5 | mix | Hero |
| Dual systems | **18** (`containerSurface` / `SurfaceCard`) vs **13** (Onyx) | Keep both by role | Do **not** unify blindly |
| fyn-ui `Card` | `RADIUS.lg` (**16**) | vs Onyx **13** | **Not a drop-in** for Onyx rows |

**Acceptable / skip:** `borderRadius: 999` / `pill`, progress bar `3`–`4`, chart dots.

---

### 1.4 Font Size Inconsistencies

| Location | Value | Should Be | Issue |
|----------|-------|-----------|-------|
| `app/alert-center.tsx` | `26` | no exact token (heroStat 24 / screenTitle 22) | Keep until token added |
| `app/(tabs)/index.tsx` | 28, 30, 26, 11, 10… | `TYPOGRAPHY.moneyTiers.*` / `sizes.*` + `moneyAmountTypography()` | Mix of display + micro |
| `app/onboarding.tsx` | ~11 fontSize literals | typography kit | Marketing/onboarding |
| `app/plans/create.tsx` | ~5 | kit | Wizard |
| `app/transaction-detail/[transactionId].tsx` | ~10 | kit + **DM Mono only in articles** | Enforce dm-mono rule |
| `components/plans/DebtPlanWizard.tsx` | ~18 | kit | Wizard density |
| `components/PaycheckAllocationWidget.tsx` | ~9 | kit | Widget |
| `components/BankAccountCard.tsx` | ~7 | `moneyAmountTypography` where amounts | Mixed |
| `components/TransactionArticlesReceiptCard.tsx` | mono sizes | `articlesReceiptTypography` / `TYPOGRAPHY.families.articles*` | **Allowed** DM Mono zone |
| Widespread | `fontSize: 14` / `16` / `12` | `TYPOGRAPHY.sizes.caption` / `body` / `micro` | Easy bulk later |
| fyn-ui vs app | Jakarta in tokens; Inter for money via theme helper | Prefer `moneyAmountTypography()` for $ | Don’t put Inter in fyn-ui Body |

---

### 1.5 Duplicate Components

| Existing | fyn-ui counterpart | Guidance |
|----------|-------------------|----------|
| `PrimarySaveButton` | `Button` `variant="primary"` | **Not drop-in** — primary CTA uses `#00e664` + radius 8; fyn-ui primary uses `COLORS.green` (`#4ADE80`) + `RADIUS.md` (12) |
| `SurfaceCard` / `containerSurfaceStyle` (18px, no halo) | `Card` (16px, dark flat tokens) | Keep SurfaceCard for alerts/glass; Onyx for interactive list/grid |
| `OnyxContainer` / `PlanFinanceContainer` | `Card` | **Prefer Onyx** for patrimoine / plan / hub rows — Card radius/padding differ |
| `SettingsRow` / `SettingsNavigationRow` | `ListItem` | Evaluate per screen; Settings already polished — don’t swap without parity check |
| `BudgetCategoryRow` | `BudgetRow` | Similar intent; BudgetCategoryRow has selection/elevate — migrate carefully |
| `Divider` (ad-hoc `View` borders) | `fyn-ui/Divider` | Safe where 1px `#1c1c1c` matches |
| Inline `Pressable`+`Text` CTAs | `Button` | Only when look matches (lab / new surfaces) |
| `Badge` ad-hoc pills | `fyn-ui/Badge` | Check status colors vs theme danger/warning |
| `ThemeSegmentedControl` / chips | `RadioGroup` | Different UX — keep segmented for tabs |

**Lab only today:** `app/fyn-ui-lab.tsx` showcases the library. Production should adopt **progressively**, never force Card over Onyx when shells differ.

---

## 2. Token mapping (actual API)

### Source of truth

| Layer | Path | Role |
|-------|------|------|
| **Unified tokens (new)** | `apps/mobile/constants/design-tokens.ts` | `COLORS`, `SPACING`, `RADIUS`, `BORDER`, `ICON`, `TYPOGRAPHY`, `COMPONENTS` |
| Runtime theme | `apps/mobile/constants/theme.ts` | `spacing`, `radius`, `typography`, `DARK_CANVAS`, `moneyAmountTypography()`, `containerSurfaceStyle()`, `PAGE_*` |
| Onyx / plan shell | `apps/mobile/constants/planFinanceKit.ts` | `ONYX_CONTAINER` / `PLAN_FINANCE_CONTAINER`, halo, pressed, row padding |
| Label kit | `apps/mobile/constants/typographyKit.ts` | page/section/eyebrow |
| Docs extract | `apps/mobile/docs/design-system/` | DESIGN_SYSTEM.md, MAPPING_ACTUEL.md, design-tokens.js |
| Theme hook | `useAppTheme()` from `@/lib/themeContext` | Live light/dark `colors` |

**There is no `@design/design-tokens` or `@components` alias.** Only `@/*` → `apps/mobile/*` (see `tsconfig.json`).

### Template name → this repo

| User template | Actual export | Notes |
|---------------|---------------|-------|
| `COLORS.background` | `COLORS.dark.canvas` / `COLORS.dark.background` **or** `useAppTheme().colors.background` | Flat `COLORS.surface` etc. exist for fyn-ui dark-first |
| `COLORS.primary` | Nested: `COLORS.dark.primary` (`#00e664`) vs flat `COLORS.green` (`#4ADE80`) | **Two greens** — CTA vs Disponible |
| `SPACING.xs…xxl` | `SPACING` **and** theme `spacing` | Same 4/8/12/16/24/32 scale + extras (`onyxCardPadding`, …) |
| `RADIUS.*` | `RADIUS` **and** theme `radius` | Extra: `onyx: 13`, `planIconButton: 20` — theme `radius` has no onyx |
| `TYPOGRAPHY.*` | `TYPOGRAPHY.sizes` / `.families` / `.body` / `.h2` / `.moneyTiers` | Money: prefer `moneyAmountTypography()` from theme |
| Components | `@/components/fyn-ui` | Button, Card, Input, RadioGroup, Badge, BudgetRow, Divider, ListItem |

### When to keep Onyx vs fyn-ui Card

| Use | Component |
|-----|-----------|
| New interactive list/grid tiles, plan hub, patrimoine holdings | **`OnyxContainer`** / `PlanFinanceContainer` |
| Alert / glass / legacy 18px surfaces | `containerSurfaceStyle` / `SurfaceCard` |
| New lab / greenfield forms matching fyn-ui specs | `fyn-ui` Card / Input / Button |
| Protected | **Never** `TransactionDetailSheet.tsx` |

---

## 3. Ordered refactor list

### 3.1 SIMPLE (start here)

| # | Screen / file | Why simple |
|---|---------------|------------|
| 1 | `app/alert-center.tsx` | ~130 lines; few hex/radius; no Onyx/Card conflict |
| 2 | `components/dev/LucideIconPickerScreen.tsx` (+ thin `app/lucide-icons.tsx`) | Dev tool; `#4ADE80` + radius 8 map cleanly |
| 3 | `app/(tabs)/widgets.tsx` | Already mostly theme tokens — light pass |
| 4 | `app/(tabs)/settings.tsx` | Mostly themed; leftover 13/3/14 in StyleSheet |
| 5 | `app/merchant-receipts.tsx` | Moderate size; radius 19 keep; token spacing |
| 6 | `app/ai-advisor.tsx` / `app/fyn-chat.tsx` | Thin wrappers — skip or N/A |
| 7 | `app/scan.tsx` | Header chrome + radius 19 |

### 3.2 MEDIUM

| # | Screen | Notes |
|---|--------|-------|
| 8 | `app/alert-detail.tsx` | Already Onyx rows — token leftover fonts |
| 9 | `app/contact-detail.tsx` | Detail layout |
| 10 | `app/merchant-detail.tsx` | |
| 11 | `app/savings-goals.tsx` / `goal-detail.tsx` | Goals + charts |
| 12 | `app/plans-list.tsx` / `plans/explore` | Plan lists |
| 13 | `app/add-budget-category.tsx` | Forms + glass |
| 14 | `app/loan-detail.tsx` / `wealth-asset-detail.tsx` | Track color pair |
| 15 | `app/onboarding.tsx` | Marketing sizes + pitch black |
| 16 | `app/transactions-insights.tsx` | |

### 3.3 COMPLEX (last)

| # | Screen | Notes |
|---|--------|-------|
| 17 | `app/(tabs)/transactions.tsx` + Agenda components | Large; AgendaCashHeroCard |
| 18 | `app/(tabs)/budgets.tsx` + budget/* | BudgetRow vs BudgetCategoryRow |
| 19 | `app/(tabs)/accounts.tsx` (Portefeuille) | Light-section hex + holdings |
| 20 | Plan financier hub (`PlanFinancierHub`, plans create/detail, strategies) | Onyx-heavy; illustration files skip |
| 21 | `app/(tabs)/index.tsx` **Dashboard** | Worst radius/font salad; high risk |
| 22 | `app/add-transaction.tsx` | Dense form |
| 23 | `app/transaction-detail/[transactionId].tsx` | Local palette; articles DM Mono; **never** edit locked sheet |
| 24 | AI chat stack (`ai-chat`, widgets, bubbles) | Parallel `aiChatDark` palette |

---

## 4. Import conventions (this repo)

```ts
// Design tokens (static / fyn-ui / StyleSheet literals that match dark)
import { COLORS, SPACING, RADIUS, TYPOGRAPHY, COMPONENTS, BORDER } from '@/constants/design-tokens';

// Live theme (preferred for theme-aware screens)
import { useAppTheme } from '@/lib/themeContext';
import {
  spacing,
  radius,
  typography,
  typographyKit,
  moneyAmountTypography,
  PAGE_PADDING_HORIZONTAL,
  DARK_CANVAS,
} from '@/constants/theme';

// Onyx shell (interactive cards — not fyn-ui Card)
import { OnyxContainer } from '@/components/OnyxContainer';
// or: import { PlanFinanceContainer } from '@/components/plans/PlanFinanceContainer';
import {
  ONYX_CONTAINER,
  onyxContainerPressedStyle,
  onyxContainerRowLayoutStyle,
} from '@/constants/planFinanceKit';

// fyn-ui (only when drop-in safe)
import { Button, Card, Input, Badge, BudgetRow, Divider, ListItem, RadioGroup } from '@/components/fyn-ui';
```

**Do not invent:** `@design/design-tokens`, `@components`, `@/design-tokens`.

**DM Mono:** only ARTICLES / receipt UI (`articlesReceiptTypography`, `TYPOGRAPHY.families.articles*`).

---

## 5. Pass rules (for implementers)

1. Visual must stay identical — swap only when token value **equals** the hardcoded value.
2. Near-misses (`#000` vs `#0a0a0a`, `#1A1A1A` vs `#1A1A1D`, radius 19 vs 18) → leave + note.
3. Prefer Onyx over fyn-ui Card when shells differ.
4. Never modify `TransactionDetailSheet.tsx`.
5. Do not start Metro; do not open browser.
6. Design changes: ADB before/after on S25 when device connected.
7. Commit per screen with message style `refactor([ScreenName]): use design tokens and components`.

---

## 6. This pass status

| Item | Status |
|------|--------|
| `REFACTOR_AUDIT.md` | **Done** (this file) |
| Screen 1: AlertCenter (`app/alert-center.tsx`) | **Committed** — `COLORS.text`, `RADIUS.planIconButton`; near-miss hex kept |
| Screen 2: LucideIcons (`components/dev/LucideIconPickerScreen.tsx`) | **Committed** — `COLORS.green`, `RADIUS.sm`, typography sizes |
| ADB captures | Skipped (no device) |
| **Next screen** | `app/(tabs)/widgets.tsx` or `app/(tabs)/settings.tsx` (StyleSheet leftovers) |
