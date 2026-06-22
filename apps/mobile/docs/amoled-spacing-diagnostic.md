# Diagnostic — couleur « moins AMOLED » & espacements déréglés

**Date :** 20 juin 2026  
**Périmètre :** `apps/mobile` — lecture seule, aucun fix appliqué  
**Méthode :** comparaison `git diff HEAD` (102 fichiers modifiés non commités) vs dernier commit `7f6e645`. Les 4 chantiers (typo, couleurs v2, border-radius, nav bar + fix FAB) sont tous dans le working tree — pas de commits séparés par chantier.

**Références chantiers :**
- `docs/typography-migration-jakarta.md`
- `docs/color-migration-v2.md`
- `docs/border-radius-migration.md`
- `docs/floating-tab-bar-redesign.md`
- `docs/transactions-scrim-diagnostic.md`

---

## Section 1 — Couleur « moins AMOLED / moins noir »

### 1.1 Valeurs actuelles (`constants/theme.ts`)

| Token | Valeur actuelle | Rôle |
|---|---|---|
| `DARK_CANVAS` | `#0E0E10` | Canvas app dark |
| `CANVAS_CHARCOAL` | `#0E0E10` (= `DARK_CANVAS`) | Alias écran |
| `darkColors.background` | `#0E0E10` (via `dashboardPalette.bg`) | Fond thème |
| `darkColors.screenCanvas` | `#0E0E10` | Canvas pages |
| `CONTAINER_SURFACE` | `#28282E` | Cards, listes, nav pill (`containerBackground`) |
| `CONTAINER_BORDER` | `#36363E` | Bordures containers |
| `surfaceElevated` | `#323238` | Surfaces surélevées |
| `iconBox` / `input` | `#222228` | Wells icônes |
| `segmentedTabBarDark.track` | `#323238` | Pills segmentées (Portefeuille, etc.) |

`AppBackgroundGradient.tsx` peint le dark mode en `#0E0E10` via `DARK_CANVAS`. `_layout.tsx` et `(tabs)/_layout.tsx` utilisent `colors.background` → même valeur.

### 1.2 Le canvas n’a **jamais** été `#000000` pur

Dans HEAD commité, le canvas global était déjà `#0a0a0a` (introduit au commit `b56739b` « fond charcoal » sous `#0A0A0A`). Le `#000000` n’apparaît que pour ombres, icônes sur fond vert, texte sur boutons — **pas** comme fond d’écran.

La migration v2 a donc fait `#0a0a0a` → `#0E0E10`, pas `#000000` → `#0E0E10`.

**Delta perceptuel canvas :** RGB `(10,10,10)` → `(14,14,16)` — légèrement plus clair, avec une infime teinte bleue sur le canal B. Ce n’est pas le principal facteur visuel.

### 1.3 Remplacements canvas / surface pendant la migration couleurs v2

| Fichier | Ancien | Nouveau | Demandé v2 ? |
|---|---|---|---|
| `constants/theme.ts` — `DARK_CANVAS` | `#0a0a0a` | `#0E0E10` | **Oui** (spec v2) |
| `constants/theme.ts` — `CONTAINER_SURFACE` | `#111111` | `#28282E` | **Oui** |
| `constants/theme.ts` — `CONTAINER_BORDER` | `#1c1c1c` | `#36363E` | **Oui** |
| `constants/theme.ts` — `surfaceElevated` | `#1F1F23` | `#323238` | **Oui** |
| `constants/theme.ts` — `iconBox` | `#181818` | `#222228` | **Oui** |
| `constants/theme.ts` — `codeBg` | `#161618` | `#141418` | **Oui** |
| `constants/theme.ts` — `segmentedTabBarDark.track` | `#1C1C1C` | `#323238` | **Oui** (dérivé surface) |
| `constants/theme.ts` — `segmentedTabBarDark.activePill` | `#2C2C2C` | `#3A3A42` | **Oui** |
| `app/transaction-detail.tsx` — `SHARE_THEME.screenBg` | `#0a0a0a` | `#0E0E10` | **Oui** |
| `app/transaction-detail.tsx` — `SHARE_THEME.surface` | `#111111` | `#28282E` | **Oui** |
| `app/transaction-detail.tsx` — `SHARE_THEME.surfaceElevated` | `#181818` | `#323238` | **Oui** |
| `components/CashAccountCard.tsx` — `back` / `void` | `#0A0A0C` | `#0E0E10` | **Oui** (alignement canvas) |
| `components/CashAccountCard.tsx` — `slot`, `leatherMid` | `#181818`, `#1F1F23` | `#222228`, `#323238` | **Oui** |
| `components/chat/widgets/theme.ts` — `surface` | `#1C1C1F` | `#28282E` | **Oui** |
| `components/chat/widgets/theme.ts` — `background` | (via theme) | `#0E0E10` | **Oui** |
| `app/add-transaction.tsx` — fond modal dark | `#0F0F10` | `colors.background` (`#0E0E10`) | **Oui** (doc migration) |

**Impact visuel dominant :** les **surfaces** passent de `#111111` (quasi-noir) à `#28282E` (gris moyen). Cards, nav pill, search bars, sheets — tout ce qui utilise `colors.containerBackground` — est nettement plus clair qu’avant. C’est probablement la cause principale du ressenti « moins AMOLED », plus que le canvas lui-même.

### 1.4 Incohérences résiduelles (canvas / surfaces)

| Fichier | Valeur | Écart vs v2 | Notes |
|---|---|---|---|
| `components/RootErrorBoundary.tsx` | `#0A0A0A` | Plus sombre que canvas v2 | Hors scope migration (flaggé dans doc) |
| `app/transaction-detail.tsx` L972 | `#0F0F10` (cardFill local) | Entre ancien et v2 | Non migré |
| `GOAL_PROGRESS_TRACK_DARK` + usages `#08090B` | `#08090B` | **Plus sombre** que canvas | goals, loan-detail, wealth-asset-detail, ChildSupportBreakdownChart, chat/widgets |
| `app/(tabs)/accounts.tsx` L3714 | `#101010` (fill carte bancaire) | Illustration, plus sombre | Volontaire (doc migration) |
| `components/chat/MessageBubble.tsx` | `#111111` texte bulle user | Ancien surface, non migré | Doc migration : laissé intact |
| `components/chat/InputBar.tsx` | `#111111` icône send | Idem | Idem |
| `ThemedConfirmModal`, `budgets.tsx`, `AIChatSettingDetailSheet` | `#0a0a0a` texte sur bouton vert | Texte, pas fond | Inchangé depuis HEAD |
| `FloatingTabBar.tsx` — `navShellBg` | `colors.containerBackground` | **Avant** : pill `#111111` sur canvas `#0a0a0a` → quasi-monochrome. **Après** : pill `#28282E` sur canvas `#0E0E10` → contraste net, barre très visible | Effet de bord du chantier couleurs sur le redesign nav |

### 1.5 Cohérence globale `#0E0E10`

- **Canvas centralisé : cohérent** — `DARK_CANVAS`, `colors.background`, `AppBackgroundGradient`, `_layout.tsx` pointent tous vers `#0E0E10`.
- **Surfaces centralisées : cohérentes** via `CONTAINER_SURFACE` / `containerBackground` → `#28282E`.
- **Incohérences locales** listées en 1.4 — surtout `#08090B`, `#0F0F10`, `#0A0A0A`, `#111111` dans chat/erreur/progress tracks.

**Conclusion couleur :** le ressenti « moins noir / moins AMOLED » est **attendu et demandé** par la spec v2. Le canvas n’a bougé que légèrement (`#0a0a0a` → `#0E0E10`). Le changement massif vient des **surfaces** (`#111111` → `#28282E`) et de la nav pill qui hérite de `containerBackground`.

---

## Section 2 — Espacements / placements de conteneurs déréglés

### 2.1 Méthode & périmètre

Comparaison `git diff HEAD` croisée avec les 4 prompts documentés. Changements classés :

- **Demandé** = explicitement dans le prompt du chantier
- **Effet token** = aucune ligne modifiée dans le fichier, mais valeur `radius.*` / `spacing.*` / `containerBackground` changée en amont
- **Non demandé** = modification layout absente des docs de chantier

**Note :** `spacing.*` n’a **pas** changé de valeur (`xs:4, sm:8, md:12, lg:16, xl:24, xxl:32`). Seuls `radius.*` et `FLOATING_TAB_BAR_PILL_HEIGHT` ont bougé.

### 2.2 Changements de tokens à effet layout global

| Token | Avant (HEAD) | Après | Chantier | Effet layout |
|---|---|---|---|---|
| `radius.card` | 18 px | **14 px** | border-radius | Cards visuellement plus « plates », contenu interne légèrement différent |
| `radius.md` | 12 px | **10 px** | border-radius | Inputs, chips, icon wells plus serrés |
| `radius.lg` | 16 px | **20 px** | border-radius | Sheets/modals **plus arrondis** en haut (+4 px) |
| `radius.xxl` | 18 px | **20 px** | border-radius | SegmentedTabs `md`/`lg` track radius |
| `SegmentedTabs` sm/section `tabRadius` | `radius.card - 3` (=15) | `radius.md` (=10) | border-radius fix | Pills segmentées plus petites → hauteur visuelle des controls réduite |
| `FLOATING_TAB_BAR_PILL_HEIGHT` | iOS 72 / Android 66 | **70** (fixe) | nav redesign | Overlays chat (`getFloatingTabBarOverlayInset`) recalculés partiellement |
| `FLOATING_NAV_CONTENT_PADDING` | **112** (inchangé) | **112** | — | **⚠️ Potentiel décalage** — voir 2.3 |

### 2.3 `FloatingTabBar.tsx` — dérive cumulative (3 chantiers + fix FAB)

| Changement | Avant | Après | Chantier | Demandé ? |
|---|---|---|---|---|
| Structure nav | Barre pleine largeur + `borderTop` + `paddingBottom: safeArea` | Pill flottante `marginH:16`, `marginBottom: safeArea+8`, bordure complète | nav redesign | **Oui** |
| Padding interne nav | `paddingV:11`, `paddingH:4` (+ Android 9/7) | `paddingV:13`, `paddingH:20` | nav redesign | **Oui** |
| Labels tabs | Texte + icône, `minHeight:50`, `gap:1` | Icônes seules, `minWH:44` | nav redesign | **Oui** |
| Couleur icône active | `colors.primary` (vert) | `colors.text` (blanc) | nav redesign | **Oui** |
| Fond nav | `containerBackground` (#111111) | même token (#28282E) | couleurs v2 | **Oui** (via token) |
| `borderRadius` nav | `radius.pill` dans tabContent | `PILL_BORDER_RADIUS=999` inline | radius + fix Hermes | **Oui** (équivalent) |
| AI FAB gradient | `#00e664` | `#4ADE80` | couleurs v2 | **Oui** (spec accent) |
| `collapseSpeedDials()` guards | 1 seul `useEffect` | `useFocusEffect` + 3 effects + BackHandler | fix FAB scrim | **Oui** (logique seule) |
| Positions FAB (`bottom`, `right`, `zIndex`, arc) | — | — | — | **Inchangées** ✓ |

**⚠️ Risque de décalage scroll / overlay (non corrigé) :**

- **Occupation verticale nav iOS :** avant `safeBottom + 72px` ; après `safeBottom + 8 + 70 = safeBottom + 78px` (+6 px).
- **`FLOATING_NAV_CONTENT_PADDING = 112`** n’a pas été recalculé pour le `marginBottom: spacing.sm` supplémentaire ni pour le passage edge-to-edge → pill flottante.
- Tous les écrans qui scrollent utilisent encore `insets.bottom + FLOATING_NAV_CONTENT_PADDING` (accounts, transactions, budgets, goals, settings, AgendaView…) — risque de contenu trop bas ou trop haut selon device.

### 2.4 Fichiers avec changements layout **non demandés**

#### `app/(tabs)/transactions.tsx` — refactor structurel non documenté

| Propriété | Avant | Après | Demandé ? |
|---|---|---|---|
| Emplacement filtres Historique | Dans `ListHeaderComponent` | Déplacé dans `tabsWrap` (hors scroll) | **Non** |
| `tabsWrap` | — | `+paddingHorizontal: PAGE_PADDING_HORIZONTAL`, `+marginBottom: spacing.md` | **Non** |
| `historyListHeader` | `marginTop: spacing.lg` | **Supprimé** | **Non** |
| `historyFilterWrap` | `marginBottom: spacing.xl` | `marginBottom: 0` | **Non** |
| `list.paddingTop` | `spacing.xxl` (32 px) | `spacing.lg` (16 px) | **Non** |
| Filtres container `marginBottom` | `spacing.lg` quand replié | `0` quand replié | **Non** |

**Impact probable :** historique Transactions plus compact en haut (−16 px paddingTop, −32 px marginBottom filtres, −24 px marginTop header), filtres visibles hors du scroll — changement de placement notable, absent de tous les docs de chantier.

#### `app/(tabs)/settings.tsx` — correction couleur #13

| Propriété | Changement | Demandé ? |
|---|---|---|
| Badge « Connecté » | Ajout dot 6×6 + `gap: spacing.xs` + `flexDirection: row` | **Oui** (fix couleur-sur-texte, migration couleurs) |

Impact layout mineur (+6 px dot).

#### Autres fichiers — typographie & border-radius uniquement

| Fichier | Type de diff layout | Demandé ? |
|---|---|---|
| `app/(tabs)/index.tsx` | Seulement `borderRadius` hardcodé → tokens | **Oui** (border-radius) |
| `app/(tabs)/accounts.tsx` | `scrollEnabled={!accountListDragging}` (reorder comptes) | **Hors 4 chantiers** (feature reorder) |
| `components/MinimizedAlertCard.tsx`, `ContactDirectory.tsx` | Refactors importants (527+ / 347+ lignes) — pas analysés ligne à ligne ; diffs spacing ambigus (reformat) | **À valider visuellement** |
| `constants/typographyKit.ts` | Familles de polices Jakarta, pas de changement `fontSize`/`lineHeight` dans le diff | Typo : **pas de spacing explicite** |
| ~60 fichiers border-radius | `18→radius.card`, `28/30→radius.lg`, `14→radius.sm` etc. | **Oui** (border-radius) |

### 2.5 Effets token « sans toucher le fichier » — décalages visuels possibles

Même sans modification de `padding`/`margin`, ces changements de token décalent visuellement :

| Composant / zone | Token affecté | Effet |
|---|---|---|
| Toutes les cards (`DashboardCard`, `SurfaceCard`, listes) | `radius.card` 18→14 | Coins moins arrondis, silhouette légèrement différente |
| Bottom sheets (20+ fichiers) | `radius.lg` 16→20 | Coins supérieurs plus arrondis — contenu header peut paraître plus « aéré » ou décalé |
| SegmentedTabs (Portefeuille, Transactions, Budget) | `tabRadius` 15→10 | Pills internes plus petites dans le track |
| Icon wells / badges date | `radius.sm` via `14→8` | Wells plus carrés |
| Nav pill flottante | `containerBackground` + layout redesign | Barre plus claire, flottante, sans labels — **changement de placement majeur demandé** |
| Texte Jakarta vs Inter | Métriques de police différentes | Hauteurs de ligne implicites différentes dans ~82 fichiers — **effet typo non quantifié dans le diff** |

### 2.6 Synthèse espacements — changé vs demandé

| Source | Demandé | Non demandé / risque |
|---|---|---|
| Nav pill redesign | Layout flottant, padding 13/20, icons-only, height 70 | `FLOATING_NAV_CONTENT_PADDING` (112) pas resynchronisé |
| Fix FAB scrim | Logique reset speed-dial | Aucun impact layout |
| Migration border-radius | Tokens + propagation ~60 fichiers | Effets visuels cumulés (cards −4 px radius, sheets +4 px) |
| Migration couleurs v2 | Couleurs uniquement (spec) | Nav pill plus claire → paraît « moins intégrée » au canvas |
| Migration typo Jakarta | Polices | Métriques texte différentes (effet secondaire possible) |
| **`transactions.tsx`** | Radius sheets/cards seulement (doc) | **Refactor filtres + spacing (−48 px cumulé en haut)** |
| **`accounts.tsx`** | Radius + couleurs | `scrollEnabled` reorder (feature séparée) |

---

## Recommandations pour validation (sans fix)

1. **Couleur :** confirmer si le ressenti vient du canvas (`#0E0E10`) ou surtout des surfaces (`#28282E`) + nav pill claire.
2. **Espacements :** tester Transactions Historique (refactor filtres) et le clearance bas sur Accueil / Portefeuille avec la pill flottante (+6 px vs ancien iOS, `FLOATING_NAV_CONTENT_PADDING` fixe à 112).
3. **Priorité fix si confirmé :** `transactions.tsx` spacing (non documenté) > resync `FLOATING_NAV_CONTENT_PADDING` > harmoniser résidus `#08090B` / `#0F0F10`.

---

*Rapport généré en lecture seule — aucune modification de code applicatif.*
