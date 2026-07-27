# Fyn / BudgetTracker — Design System (extracted)

> **Source of truth:** live code under `apps/mobile/` (`constants/theme.ts`, `constants/planFinanceKit.ts`, `constants/typographyKit.ts`, Cursor rules).  
> **Rule:** extract only what exists — do not invent tokens. Differences vs external “known specs” are documented in [§6 Inconsistencies](#6-inconsistencies--known-spec-diffs).

Generated from the codebase. Prefer importing theme helpers over hardcoding hex.

---

## 1. Philosophy

| Principle | Practice in code |
|-----------|------------------|
| Dark-first charcoal canvas | Screen fill is `DARK_CANVAS` / `#0a0a0a`, not pitch `#000` |
| One card shell for new interactive tiles | **Onyx** (`OnyxContainer` / `PlanFinanceContainer`) — 13px, hairline, optional halo |
| Theme-aware colors | `useAppTheme().colors` — dark defaults in `darkColors`, light in `lightColors` |
| Labels ≠ money fonts | UI copy → **Plus Jakarta Sans**; dollar amounts → **Inter 800** via `moneyAmountTypography()` |
| DM Mono is locked | Receipt **ARTICLES** only (`articlesReceiptTypography`) |
| No invented shells | Do not reimplement `#111` + 13px + hairline inline — use Onyx helpers |
| Visual verify on device | Design changes: ADB screenshots on Samsung S25 Ultra before/after (Expo Go) |

**Protected:** `components/TransactionDetailSheet.tsx` — do not modify unless explicitly requested.

---

## 2. Colors

### 2.1 Canonical dark surfaces (theme kit)

| Token | Hex / value | Source | Role |
|-------|-------------|--------|------|
| `DARK_CANVAS` / `background` / `screenCanvas` | `#0a0a0a` | `theme.ts` | App / screen canvas |
| `CONTAINER_SURFACE` / `containerBackground` / `surface` | `#111111` | `theme.ts` | Cards, list rows, sheets |
| `CONTAINER_BORDER` / `containerBorder` | `#1c1c1c` | `theme.ts` | Standard 1px / Onyx outline via theme colors |
| `iconBox` / `input` (dark) | `#181818` | `dashboardPalette` | Icon wells, glass inputs |
| `surfaceElevated` | `#1F1F23` | `darkColors` | Elevated wells |
| `toggleTrackOff` | `#28282E` | `darkColors` | PremiumSwitch off track (also reused in chat AI bubble) |
| `codeBg` | `#161618` | `darkColors` | Code-ish surfaces |
| `borderSubtle` | `rgba(255,255,255,0.07)` | `darkColors` | Soft dividers |

### 2.2 Accents & semantics (dark)

| Token | Hex | Notes |
|-------|-----|-------|
| `accentGreen` / `DASHBOARD_VALUE_GREEN` / plan `accent` | `#4ADE80` | Disponible / success accent (ADB rule, plan finance, goals) |
| `primary` / `success` / `dashboardPalette.green` | `#00e664` | **Different green** — primary CTAs (`PrimarySaveButton` uses this) |
| `chartTokens.line` | `#00E676` | Chart stroke (third green family) |
| `danger` / `dashboardPalette.red` | `#ff5555` | Errors / destructive |
| `DASHBOARD_VALUE_RED` | `#FF6B6B` | Accueil value direction only |
| `warning` | `#e6a000` | Warnings |
| `purple` | `#B48CFF` | Accent purple |
| `text` | `#ffffff` | Primary text |
| `textSecondary` / `subtext` | `#666666` | Muted copy |

### 2.3 Segmented controls (dark)

| Token | Value |
|-------|-------|
| Track | `#1C1C1C` |
| Active pill | `#2C2C2C` |
| Active text | `#FFFFFF` |
| Inactive text | `#6B6B6B` |

### 2.4 Plan finance kit colors (parallel palette)

Used by plan hub helpers (`planFinanceInputStyle`, primary/secondary buttons). Shell fill still comes from theme `containerBackground` when using `OnyxContainer`.

| Token | Value |
|-------|-------|
| background | `#0a0a0a` (`DARK_CANVAS`) |
| surface | `#111111` |
| surfaceElevated | `#2E2E34` |
| input | `#1A1A1D` |
| accent | `#4ADE80` |
| danger | `#C96560` |
| warning | `#C9974A` |
| border | `rgba(255,255,255,0.12)` |
| textMuted | `rgba(255,255,255,0.55)` |
| textOnAccent | `#0a0a0a` |

### 2.5 AI chat dark palette (local, not `darkColors`)

`components/ai-chat/theme.ts` — **diverges** from main canvas:

| Token | Value |
|-------|-------|
| background | `#0E0E10` |
| surface | `#1F1F23` |
| aiBubble | `#28282E` |
| primary / userBubble | `#4ADE80` |
| border | `rgba(255,255,255,0.12)` |

### 2.6 Light (summary)

Canvas `#F0F0F0`, cards `#FFFFFF`, border `#C0C0C8`, primary/success `#00A854`, accentGreen still `#4ADE80`, danger `#CF222E`.

---

## 3. Typography

### 3.1 Families

| Use | Font | Helpers |
|-----|------|---------|
| UI labels / body | Plus Jakarta Sans (`PlusJakartaSans_400Regular` … `_800ExtraBold`) | `jakarta*Text`, `typographyKit` |
| Money / tabular $ | Inter ExtraBold (`Inter_800ExtraBold`) | `moneyAmountTypography({ tier })` |
| Receipt ARTICLES only | DM Mono | `articlesReceiptTypography` |

Deprecated aliases: `inter*Text` → Jakarta (migrating screens).

### 3.2 Size scale (`theme.typography` + kit)

| Token | px |
|-------|-----|
| micro | 12 |
| meta | 13 |
| caption | 14 |
| body | 16 |
| dashboardGreeting | 18 |
| sectionTitle (kit) | 20 |
| screenTitle / title | 22 |
| heroStat / heroAmount | 24 |
| pageTitle (kit) | 32 |
| displayAmount | 38 |

### 3.3 Money tiers (`moneyAmountTypography`)

| Tier | ~size | Typical use |
|------|-------|-------------|
| `row` | 14 | List amounts |
| `card` | 16 | Card metrics |
| `stat` | 24 | Stat blocks |
| `hero` | 28 | Card heroes |
| `detailHero` | 36 | Transaction detail hero |
| `netWorth` | 42 | Portfolio headline |

### 3.4 Kit presets (labels)

`pageTitle` 32 ExtraBold · `sectionTitle` 20 ExtraBold · `eyebrow` uppercase meta Medium · `rowTitle` / `listPrimary` · tags via `tagTypography` (10px uppercase).

---

## 4. Spacing & radius

### 4.1 Spacing (4px scale — documented as **only** these steps)

```
xs: 4 · sm: 8 · md: 12 · lg: 16 · xl: 24 · xxl: 32
```

- Page horizontal padding: `PAGE_PADDING_HORIZONTAL` = `spacing.lg` (16)
- Portfolio section gap: `PORTFOLIO_SECTION_GAP` = 16; break = 32
- Onyx list gap: 8 (`ONYX_CONTAINER.listGap`)

### 4.2 Global radius (`theme.radius`)

| Token | px | Notes |
|-------|-----|-------|
| sm | 8 | Inputs, small controls, PrimarySaveButton |
| md | 12 | Chips / mid |
| lg | 16 | Many form controls (`add-transaction`) |
| card / xl / xxl | **18** | `containerSurfaceStyle` / SurfaceCard family |
| pill | 999 | Pills / progress tracks |

### 4.3 Onyx / plan finance radius

| Token | px |
|-------|-----|
| card / button | **13** |
| small | 8 |
| iconButton | 20 |

**Locked dual system:** new interactive cards → **13px Onyx**; dashboard alert / glass surface family → **18px** + 1px border, no halo.

---

## 5. Component rules & interaction patterns

### 5.1 Onyx container (canonical new cards)

- Component: `OnyxContainer` (= `PlanFinanceContainer`)
- Fill / outline: `colors.containerBackground` + `colors.containerBorder`
- Radius 13 · `StyleSheet.hairlineWidth` · halo on by default (`planFinanceCardHalo`)
- Press: outer `Pressable` + `onyxContainerPressedStyle()` → opacity **0.82**, scale **0.975**
- Padding: row 12 · compact tile H/T 12 bottom 14 · full card 20

**Do not use for:** glass inputs, segmented controls, surfaces that must stay `containerSurfaceStyle` (18px).

### 5.2 `containerSurfaceStyle` (legacy / alerts)

1px border, theme card fill, **caller supplies** `borderRadius` (typically `radius.card` = 18). No halo.

### 5.3 Primary save CTA

`PrimarySaveButton` — `colors.primary` (`#00e664` dark), text on `colors.background`, `radius.sm` (8), pressed opacity 0.72.

Plan finance primary button helper uses **`#4ADE80`** and radius **13** — different CTA recipe.

### 5.4 Floating tab bar

Blur glass (`expo-blur`), hard-coded dark tint `rgba(22,22,22,0.94)`, border `rgba(255,255,255,0.10–0.12)`, FAB uses `colors.accentGreen` (`#4ADE80`). Icon-only tabs; insets via `getFloatingTabBarBottomInset`.

### 5.5 Segmented controls

`ThemeSegmentedControl` / `SegmentedTabs` — liquid spring presets; colors from `segmentedTabBarDark` / theme `segmentedTab*`. Not for boolean toggles → `PremiumSwitch`.

### 5.6 Chips

Constant `CHIP_BORDER_WIDTH` 1.5; horizontal pad `spacing.md`; selection changes color, not border width (`chipSelectableShellStyle`).

### 5.7 Forms (add-transaction / add-budget-category)

- Inputs: `colors.input` (`#181818` dark) + `colors.border`; often `radius.lg` (16)
- Section eyebrows: `FORM_SECTION_LABEL_STYLE` / `formSectionLabelStyle()`
- Save: `PrimarySaveButton`
- Budget category icon wells often `#28282E` (`BUDGET_CATEGORY_ICON_WELL_BG`)

### 5.8 Money & delete affordances

- Amounts: always `moneyAmountTypography` / row helpers — never DM Mono on dashboard
- Subtle delete: `subtleDeleteButtonStyle` + `destructiveTextActionStyle` (danger tint, not full-bleed red)

### 5.9 Icons

- List/card wells: `ICON_WELL_SIZE` = 34
- Merchant / account logos: `MERCHANT_LOGO_SIZE` = 48

---

## 6. Locked decisions

| Decision | Status |
|----------|--------|
| Canvas `#0a0a0a`, cards `#111111` | Locked in `theme.ts` + ADB rule |
| Accent green `#4ADE80` for Disponible / goals / plan accent | Locked |
| Onyx 13px + halo for new interactive tiles | Locked (Cursor rules + AGENTS.md) |
| Plus Jakarta for UI; Inter ExtraBold for money | Locked |
| DM Mono = ARTICLES only | Locked |
| `TransactionDetailSheet.tsx` protected | Locked |
| Metro started by user only | Locked |
| Design verify = S25 Ultra ADB captures | Locked |

---

## 6b. Inconsistencies & known-spec diffs

### vs external known specs

| Spec claimed | Actual in main theme | Diff |
|--------------|----------------------|------|
| Background `#0E0E10` | `#0a0a0a` (`DARK_CANVAS`) | **Main app is darker / different.** `#0E0E10` appears in **AI chat** palette and a few hardcodes (`CashAccountCard` void, FynAvatar status border). |
| Surface `#28282E` | `#111111` (`CONTAINER_SURFACE`) | **Main cards are `#111111`.** `#28282E` = toggle off track, chat AI bubble, budget category icon well — not the card fill. |
| Green `#4ADE80` | Present as `accentGreen` | **Matches** for accent / Disponible. But `primary`/`success` remain `#00e664`; charts also use `#00E676`. |
| Font Plus Jakarta Sans | Yes for UI | **Matches.** Money uses Inter; ARTICLES use DM Mono. |
| Spacing 4px scale | `4,8,12,16,24,32` | **Matches** documented scale (some one-offs like tag vertical pad `3`, plan `cardGap` `14`). |

### Internal inconsistencies (same codebase)

1. **Three greens:** `#4ADE80` (accent) · `#00e664` (primary CTA) · `#00E676` (charts).
2. **Two card radii:** Onyx **13** vs `radius.card` **18** (`containerSurfaceStyle` / SurfaceCard).
3. **Two borders:** theme `containerBorder` `#1c1c1c` vs plan kit / chat `rgba(255,255,255,0.12)` (ADB rule cites rgba).
4. **Two canvases:** app `#0a0a0a` vs Fyn chat `#0E0E10`.
5. **CTA recipes:** `PrimarySaveButton` → primary `#00e664` + radius 8; `planFinancePrimaryButtonStyle` → `#4ADE80` + radius 13.
6. **Danger reds:** theme `#ff5555` vs plan kit `#C96560` vs dashboard value `#FF6B6B`.
7. **Deprecated aliases:** `inter*Text` = Jakarta; AGENTS.md still says PlanFinanceContainer while rules prefer Onyx naming.
8. **dm-mono rule text** still says “Labels → Inter” in places; code migrated labels to Jakarta — money remains Inter.

---

## Related files

- Tokens export: [`design-tokens.js`](./design-tokens.js)
- Component map: [`MAPPING_ACTUEL.md`](./MAPPING_ACTUEL.md)
- Code: `constants/theme.ts`, `constants/planFinanceKit.ts`, `constants/typographyKit.ts`, `constants/plusJakartaFonts.ts`, `constants/interFonts.ts`
