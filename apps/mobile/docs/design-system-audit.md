# Audit design system — BudgetTracker Mobile

**Date :** 20 juin 2026  
**Périmètre :** `apps/mobile` (Expo 54, React Native, Expo Router)  
**Méthode :** scan statique (.tsx, .ts, .css), revue composants/écrans — **aucune modification de code**  
**Référence design system :**

| Token | Valeur spec |
|---|---|
| Background | `#0E0E10` |
| Surface | `#1C1C1F` |
| Vert | `#4ADE80` |
| Rouge | `#FF6B6B` |
| Titres | DM Serif Display |
| Labels | DM Sans |
| Chiffres | DM Mono |
| Coins | Carrés (pas de border-radius) |

---

## Table des matières

1. [Synthèse exécutive](#1-synthèse-exécutive)
2. [Partie 1 — Extraction des couleurs](#2-partie-1--extraction-des-couleurs)
3. [Partie 2 — Vérification contre le design system](#3-partie-2--vérification-contre-le-design-system)
4. [Partie 3 — Tableau consolidé et priorités](#4-partie-3--tableau-consolidé-et-priorités)
5. [Partie 4 — Couleur sur texte complet](#5-partie-4--couleur-sur-texte-complet)
6. [Annexes](#6-annexes)

---

## 1. Synthèse exécutive

L'application possède une base token mature (`constants/theme.ts`, ~1000 lignes) mais **diverge significativement** de la spec DS fournie sur les fondamentaux :

- **Couleurs** : canvas/surface différents, double système vert/rouge coexistant
- **Typographie** : Inter est le système de facto ; DM Sans jamais appliqué ; DM Serif sur 1 composant ; DM Mono correctement limité aux articles reçu
- **Border-radius** : règle « sharp corners » non respectée (`radius.card = 18`, pills 999, FAB circulaires)
- **Hiérarchie couleur sémantique** : partiellement respectée sur les listes récentes, violée sur légendes alerte Accueil et messages warning

### Chiffres clés

| Métrique | Valeur |
|---|---|
| Fichiers avec couleurs hardcodées | 73 |
| Entrées couleur totales (hex + rgba) | 635 |
| Hex uniques | 129 |
| Composants `.tsx` | ~122 |
| Écrans/routes | 23 |

---

## 2. Partie 1 — Extraction des couleurs

### 2.1 Méthodologie

Scan récursif de tous les fichiers `.tsx`, `.ts`, `.css` pour :

- Hex (`#RGB`, `#RRGGBB`, `#RRGGBBAA`)
- `rgba()` / `rgb()` / `hsla()`
- Contexte d'usage : `backgroundColor`, `color`, `borderColor`, `shadowColor`, `fill`, `stroke`, gradients

### 2.2 Fichiers les plus chargés

| Entrées | Fichier | Nature |
|---:|---|---|
| 107 | `constants/categoryOptions.ts` | Couleurs catégories |
| 104 | `constants/theme.ts` | Tokens centralisés |
| 38 | `app/(tabs)/index.tsx` | Dashboard Accueil |
| 30 | `lib/institutionBrandColor.ts` | Couleurs marques |
| 27 | `components/BudgetMonthOverview.tsx` | Graphiques budget |
| 24 | `app/transaction-detail.tsx` | Détail transaction |
| 23 | `app/(tabs)/budgets.tsx` | Onglet Budget |
| 21 | `app/(tabs)/accounts.tsx` | Onglet Portefeuille |
| 18 | `components/CashAccountCard.tsx` | Illustration SVG wallet |
| 17 | `components/FloatingTabBar.tsx` | Bottom nav |

### 2.3 Clusters de couleurs quasi-identiques

Couleurs à distance RGB ≤ 12 regroupées par rôle :

#### Backgrounds / canvas dark

| Couleurs | Fichiers |
|---|---|
| `#0a0a0a` · `#0e0e10` · `#0f0f10` · `#111111` · `#161618` · `#08090b` · `#0a0a0c` · `#121214` · `#0b0d10` · `#0d1117` | 22 |

#### Surfaces / bordures dark

| Couleurs | Fichiers |
|---|---|
| `#181818` · `#1c1c1c` · `#1a1a1a` · `#1c1c1f` | 5 |

#### Backgrounds light

| Couleurs | Fichiers |
|---|---|
| `#efefef` · `#f0f0f0` · `#e8e8ed` · `#e8edf3` · `#e5e7eb` · `#e7e9ee` | 9 |

#### Gris neutres light

| Couleurs | Fichiers |
|---|---|
| `#f6f8fa` · `#fafafa` · `#f5f5f5` · `#f2f3f4` | 7 |

#### Bordures light

| Couleurs | Fichiers |
|---|---|
| `#d0d7de` · `#d4d4d8` · `#cbd5e1` · `#d8d8d8` | 6 |

#### Texte muted

| Couleurs | Fichiers |
|---|---|
| `#666666` · `#6b6b6b` | 3 |
| `#8b949e` · `#9090a0` | 3 |
| `#4b5563` · `#52525b` | 2 |

#### Verts (dual system)

| Couleurs | Usage |
|---|---|
| `#4ade80` | `accentGreen`, `DASHBOARD_VALUE_GREEN` |
| `#00e664` | `primary`, `success`, `dashboardPalette.green` |
| `#00a854` | Light theme primary |

#### Rouges (dual system)

| Couleurs | Usage |
|---|---|
| `#ff6b6b` | `DASHBOARD_VALUE_RED`, `CashAccountCard.negative` |
| `#ff5555` | `danger`, `dashboardPalette.red` |
| `#cf222e` | Light theme danger |

#### Oranges / warning

| Couleurs | Usage |
|---|---|
| `#e6a000` | `dashboardPalette.warning`, tokens dark |
| `#f59e0b` | `BudgetHealthCard` warning dark |
| `#d97706` | `BudgetHealthCard` warning light |
| `#c96f1a` | Light theme warning |

### 2.4 Extraction par écran (app/)

#### `app/(tabs)/index.tsx` — Dashboard Accueil

| Ligne | Couleur | Usage |
|---:|---|---|
| 674, 928, 992, 1060… | `rgba(245,245,245,0.84)` | Texte muted custom (`dashMuted`) |
| 830 | `#fff` | Icône marker alerte timeline |
| 842 | `#000` | Icône wallet marker |
| 1455 | `rgba(255,85,85,0.08)` | Background alerte danger |
| 1455 | `rgba(230,160,0,0.08)` | Background alerte warning |
| 1480 | `rgba(255,85,85,0.08)` | Background mock alerte crédit |
| 1512 | `rgba(0,168,84,0.06)` | Ambient glow light |
| 1512 | `rgba(0,230,100,0.055)` | Ambient glow dark |
| 859 | `alert.color` | **Texte légende paiement (label complet coloré)** |
| 865 | `palette.green` | **Texte légende paie (label complet coloré)** |
| 1991 | `rgba(255,235,226,0.82)` | Style `healthWarning` — **non utilisé en JSX** |
| 2382 | `rgba(255,214,198,0.82)` | Style `legendLabelRisk` — **non utilisé en JSX** |

#### `app/(tabs)/accounts.tsx` — Portefeuille

| Couleur | Usage |
|---|---|
| `#F6F8FA`, `#FFFFFF`, `#D0D7DE` | Palette light hardcodée cartes compte |
| `rgba(18, 18, 18, 0.92)` | Overlays FAB/sheets dark |
| `rgba(255, 255, 255, 0.94)` | Overlays FAB/sheets light |
| `#101010` | Fill SVG icône |
| `#ffffff` | Stroke/glyph SVG |
| `colors.danger` | Montant dette totale (badge header prêts) |

#### `app/(tabs)/budgets.tsx` — Budget

| Couleur | Usage |
|---|---|
| `#909090` | Texte muted ad hoc |
| `#34D399` | Catégorie vert menthe |
| `#F97316` | Catégorie orange |
| `#8B5CF6` | Catégorie violet |
| `#FB7185` | Catégorie rose |
| `#00A854` | Accent vert light |
| `rgba(0,230,100,0.055)` | Glow ambiant |

#### `app/(tabs)/transactions.tsx`

| Couleur | Usage |
|---|---|
| `rgba(255,255,255,0.07–0.85)` | Overlays glass merchant |
| `#000000` | `shadowColor` |
| `rgba(0, 0, 0, 0.68)` | Backdrop modal |

#### `app/(tabs)/settings.tsx`

| Couleur | Usage |
|---|---|
| `colors.primary` | Badge « Connecté » |
| `colors.successMuted` | Fond badge statut |

#### `app/transaction-detail.tsx`

| Couleur | Usage |
|---|---|
| `#0a0a0a` – `#1c1c1c` | Palette locale dark |
| `#00e664` | Success local |
| `#FAFAFA` / `#0F0F10` | Toggle articles background |
| `#FFFFFF` / `#000000` | Icônes boutons |

#### `app/add-transaction.tsx`

| Couleur | Usage |
|---|---|
| `rgba(25, 22, 18, 0.30)` / `rgba(0, 0, 0, 0.62)` | Backdrop FAB |
| `#FAFAFA` / `#0F0F10` | Section articles |
| `#FFFFFF` | Sheet background light |
| `colors.warning` | Message warning transfert |

### 2.5 Extraction composants clés

#### `components/FloatingTabBar.tsx`

| Couleur | Usage |
|---|---|
| `#003d1a` → `#007a3d` → `#00e664` | Gradient FAB AI chat dark |
| `#00a854` → `#007a3d` | Gradient FAB AI chat light |
| `#FFFFFF` | Icônes speed-dial + chat |
| `#000000` | Icône plus FAB add |
| `rgba(22, 22, 22, 0.94)` | Surface options speed-dial dark |
| `rgba(18, 18, 18, 0.90)` | Surface options speed-dial light |
| `colors.primary` | FAB add + tab actif |
| `colors.textMuted` | Tab inactif |

#### `components/CashAccountCard.tsx` (illustration SVG)

| Couleur | Usage |
|---|---|
| `#0A0A0C` | Back leather |
| `#0E0E10` | Void |
| `#121214` | Slot |
| `#1A1A1A` / `#1C1C1F` | Leather mid |
| `#FF6B6B` | Balance négative |
| `#ffffff` | Texte montant |

#### `constants/theme.ts` — Tokens vs spec

| Token | Valeur actuelle | Spec DS | Écart |
|---|---|---|---|
| `DARK_CANVAS` | `#0a0a0a` | `#0E0E10` | ❌ |
| `CONTAINER_SURFACE` | `#111111` | `#1C1C1F` | ❌ |
| `CONTAINER_BORDER` | `#1c1c1c` | — | Proche surface spec |
| `accentGreen` | `#4ADE80` | `#4ADE80` | ✓ |
| `primary` / `success` | `#00e664` | `#4ADE80` | ❌ |
| `danger` | `#ff5555` | `#FF6B6B` | ❌ (~proche) |
| `DASHBOARD_VALUE_GREEN` | `#4ADE80` | `#4ADE80` | ✓ |
| `DASHBOARD_VALUE_RED` | `#FF6B6B` | `#FF6B6B` | ✓ |
| `radius.card` | `18` | `0` | ❌ |
| `radius.pill` | `999` | `0` | ❌ |

---

## 3. Partie 2 — Vérification contre le design system

### 3.1 Couleurs hors palette

| Fichier | Sévérité | Détail |
|---|---|---|
| `constants/theme.ts` | **Élevé** | Canvas `#0a0a0a` ≠ `#0E0E10` ; surface `#111111` ≠ `#1C1C1F` |
| `constants/theme.ts` | **Élevé** | Double système vert (`#00e664` vs `#4ADE80`) et rouge (`#ff5555` vs `#FF6B6B`) |
| `app/(tabs)/budgets.tsx` | **Moyen** | Palette catégories Tailwind-like : `#34D399`, `#F97316`, `#8B5CF6`, `#FB7185` |
| `constants/categoryOptions.ts` | **Moyen** | 107 couleurs catégorie non alignées sur palette DS |
| `lib/institutionBrandColor.ts` | **Faible** | Couleurs marques externes (attendu) |
| `app/(tabs)/index.tsx` | **Moyen** | `rgba(245,245,245,0.84)` custom au lieu de `textMuted` token |

### 3.2 Typographie incohérente

**Système de facto :** Inter (Regular → ExtraBold) via `typographyKit.ts`  
**Système spec :** DM Serif Display / DM Sans / DM Mono

| Fichier | Sévérité | Détail |
|---|---|---|
| `constants/typographyKit.ts` | **Élevé** | Tous les presets utilisent Inter, pas DM |
| `lib/typographyDefaults.ts` | **Élevé** | Default global = `Inter_400Regular` |
| `app/_layout.tsx` | **Moyen** | DM Sans + DM Serif chargés ; DM Sans **jamais utilisé** dans les composants |
| `components/TransactionInsightCard.tsx` | **Moyen** | Seul usage DM Serif Display (hors règle « titres partout ») |
| `app/transaction-detail.tsx` | **Faible** | DM Mono correctement limité aux articles reçu ✓ |
| `FloatingTabBar.tsx` | **Moyen** | `fontWeight: '600'` sans fichier Inter associé (anti-pattern typographyKit) |
| `app/(tabs)/index.tsx` | **Moyen** | `fontWeight: '900'/'800'/'700'` arbitraires sur gauge/balance (hors presets) |
| `app/savings-goal-transactions.tsx` | **Moyen** | `fontWeight: '800'/'900'` sans fichiers Inter |
| `app/wealth-asset-detail.tsx` | **Moyen** | `fontWeight: '800'/'700'` mixés avec Inter files |

#### Mapping rôle → police actuelle vs spec

| Rôle | Spec | Actuel |
|---|---|---|
| Titres écran | DM Serif Display | Inter ExtraBold 32px |
| Labels / eyebrows | DM Sans Medium | Inter Medium 12px uppercase |
| Montants | DM Mono | Inter ExtraBold tabular |
| Corps | DM Sans | Inter Regular/Medium |

### 3.3 Border-radius (règle sharp corners)

| Fichier | Sévérité | Valeurs trouvées |
|---|---|---|
| `constants/theme.ts` | **Élevé** | `radius.card=18`, `sm=8`, `md=12`, `lg=16`, `pill=999` |
| `components/FloatingTabBar.tsx` | **Moyen** | FAB `borderRadius: 27`, speed-dial `radius.pill` |
| `components/DashboardDateBadge.tsx` | **Moyen** | `borderRadius: 14` |
| `components/ConfirmDeleteModal.tsx` | **Moyen** | `radius.card + 4`, `16` |
| `app/transaction-detail.tsx` | **Moyen** | 19, 17, 27, 13, multiples `radius.*` |
| `components/AgendaView.tsx` | **Moyen** | Picker sheet `borderTopRadius: 28`, handle `999` |
| `app/(tabs)/transactions.tsx` | **Moyen** | 24, 30, 22, 18 |
| `components/CashAccountCard.tsx` | **Faible** | `VIEW_RADIUS = 3` (wallet SVG — quasi sharp) |

### 3.4 Formes de container incohérentes

| Contexte | Pattern A | Pattern B | Sévérité |
|---|---|---|---|
| Cartes dashboard | `radius.card = 18` | — | Référence |
| Bottom sheets | `borderTopRadius: 28` | `radius.lg = 16` | **Moyen** |
| Modals confirmation | `radius.card + 4 = 22` | `radius.card = 18` | **Moyen** |
| FAB buttons | Circulaire (27–30px) | — | **Moyen** |
| Icon wells | `radius.md = 12` | `radius.sm = 8` | **Faible** |

### 3.5 Bottom nav bar (`FloatingTabBar.tsx`)

| Aspect | Constat | Sévérité |
|---|---|---|
| Style pill | Fond `containerBackground`, bordure top hairline | OK |
| Spacing | `paddingVertical: 11`, `paddingHorizontal: 4` — **hors grille 4/8** | **Moyen** |
| Android | `paddingTop: 9`, `paddingBottom: 7` — valeurs impaires | **Moyen** |
| Tab label | `UNIFORM_CHIP_FONT_SIZE`, `fontWeight: '600'` | **Moyen** |
| Tab hit area | `minHeight: 50` (≥ 44px) | OK |
| FAB Accueil | AI chat gradient (gauche) — absent ailleurs | **Moyen** |
| FAB Transactions | Speed-dial arc Historique/Agenda ; absent Merchants | **Moyen** |
| FAB absent | Portefeuille, Objectifs, Budget, Settings | Comportement voulu |
| Icônes | Ionicons 21px focused / muted unfocused | OK |
| Ombres FAB | `shadowOpacity: 0.35`, `elevation: 12` | **Faible** |

### 3.6 Hiérarchie / ordre des sections

| Écran | Ordre sections | Sévérité |
|---|---|---|
| Accueil (`index.tsx`) | Alertes → Soldes favoris → Prochain paiement | **Moyen** — pas de hero Valeur Nette |
| Portefeuille (`accounts.tsx`) | Valeur nette / Patrimoine en tête (référence typographyKit) | Pattern différent |
| Budget (`budgets.tsx`) | Santé budget → Allocation → Catégories | Cohérent en interne |
| Transactions | Scope tabs → contenu vue | Cohérent |

### 3.7 Espacement / padding hors grille

Échelle documentée : `4, 8, 12, 16, 24, 32` (`constants/theme.ts`)

Valeurs non conformes repérées :

| Valeur | Exemples |
|---|---|
| 1 | `FloatingTabBar` tabContent gap |
| 2 | `BudgetHealthCard` ringCenter gap, `AgendaView` yearSub marginTop |
| 3 | `FloatingTabBar` tab paddingHorizontal |
| 5 | `index.tsx` legendPair gap |
| 6 | `accounts.tsx` limitNearBanner gap |
| 7 | `index.tsx` aiInsight gap |
| 9 | `FloatingTabBar` pillAndroid paddingTop |
| 10 | `index.tsx` aiInsight padding |
| 11 | `FloatingTabBar` pill paddingVertical |
| 14 | `index.tsx` headerRow gap, gaugeRow gap, gaugeSpacer |
| 18 | `index.tsx` gaugeCard padding, aiInsight borderRadius |

### 3.8 Contraste texte/fond (seuil AA 4.5:1)

| Paire | Ratio estimé | Seuil AA | Sévérité |
|---|---|---|---|
| `#666666` sur `#0a0a0a` | ~4.5:1 | Limite | **Moyen** |
| `#6B6B6B` sur `#1C1C1C` (tab inactif) | ~4.3:1 | **Sous AA** | **Moyen** |
| `#52525B` sur `#FFFFFF` (light muted) | ~5.8:1 | OK | — |
| `rgba(245,245,245,0.84)` sur `#0a0a0a` | ~7:1 | OK | — |
| `#e6a000` (warning) sur `#111111` | ~6:1 | OK | — |
| `#00e664` (success) sur `#0a0a0a` | ~8:1 | OK | — |

### 3.9 Composants dupliqués stylés différemment

| Action | Composant A | Composant B | Sévérité |
|---|---|---|---|
| Supprimer | `ConfirmDeleteModal` (texte danger plein) | `subtleDeleteButtonStyle` (outline muted) | **Faible** |
| Feedback form | `ThemedFormMessage` (banner icon+title coloré) | Inline `<Text style={{color: warning}}>` | **Faible** |
| Status badge | `PaymentListRow` badges | `settings.tsx` statusBadge | **Faible** |
| Alerte dashboard | `MinimizedAlertCard` (barre accent) | `AlertCard` expanded (légende colorée) | **Moyen** |

### 3.10 Touch targets sous 44×44 px

| Fichier | Élément | Taille | Sévérité |
|---|---|---|---|
| `OverflowMenuButton.tsx` | Bouton menu | `minHeight: 38` | **Moyen** |
| `ModifierButton.tsx` | Bouton modifier | `minHeight: 38` | **Moyen** |
| `ItemizedArticlesEditor.tsx` | Contrôles | `minHeight: 38` | **Moyen** |
| `add-transaction.tsx` | Chips type | `minHeight: 32` | **Moyen** |
| `BudgetCategoryPicker.tsx` | Chip | `minHeight: 34` | **Moyen** |
| `RecurringPaymentsForm.tsx` | Chip | `minHeight: 34` | **Moyen** |
| `TransactionInsightCard.tsx` | Action | `minHeight: 34–36` | **Moyen** |
| `app/(tabs)/index.tsx` | Header settings | `40×40` | **Faible** (proche) |
| `FloatingTabBar.tsx` | Tab | `minHeight: 50` | OK ✓ |
| `AgendaView.tsx` | Nav hit | `minWidth/Height: 44` | OK ✓ |

### 3.11 Ombres / élévations incohérentes

| Fichier | shadowOffset | shadowOpacity | shadowRadius | elevation |
|---|---|---|---|---|
| `FloatingTabBar.tsx` | `{0, 6}` | 0.35 | 16 | 12 |
| `app/(tabs)/transactions.tsx` | `{0, 12}` | — | — | — |
| `transaction-detail.tsx` | `{0, 6}` / `{0, 4}` | — | — | — |
| `BudgetAllocationChart.tsx` | `{0, 8}` | — | — | — |
| `CashAccountCard.tsx` | `{0, 3}` | — | — | — |
| `MerchantEditModal.tsx` | `{0, 12}` | — | — | — |

Pas d'échelle d'élévation tokenisée — valeurs ad hoc par composant.

---

## 4. Partie 3 — Tableau consolidé et priorités

### 4.1 Tableau complet

| Fichier | Type de problème | Sévérité | Description |
|---|---|---|---|
| `constants/theme.ts` | Couleur hors palette | **Élevé** | Canvas `#0a0a0a` ≠ `#0E0E10` ; surface `#111111` ≠ `#1C1C1F` |
| `constants/theme.ts` | Couleur hors palette | **Élevé** | Double système vert/rouge |
| `constants/typographyKit.ts` | Typographie | **Élevé** | Inter partout au lieu de DM Serif/Sans/Mono |
| `constants/theme.ts` | Border-radius | **Élevé** | `radius.card=18`, `pill=999` — contredit sharp corners |
| `app/(tabs)/index.tsx` | Couleur sur texte complet | **Élevé** | Légendes alerte : label complet orange/vert |
| `app/(tabs)/index.tsx` | Couleur hors palette | **Moyen** | `rgba(245,245,245,0.84)` custom muted |
| `app/(tabs)/budgets.tsx` | Couleur hors palette | **Moyen** | Couleurs catégories non tokenisées |
| `segmentedTabBarDark` | Contraste AA | **Moyen** | Inactive text `#6B6B6B` sur track `#1C1C1C` ≈ 4.3:1 |
| `FloatingTabBar.tsx` | Bottom nav spacing | **Moyen** | padding 11/4/9/7 hors grille 4/8 |
| `FloatingTabBar.tsx` | Bottom nav comportement | **Moyen** | FAB contextuels hétérogènes par écran |
| `FloatingTabBar.tsx` | Border-radius | **Moyen** | FAB circulaire radius 27 |
| `FloatingTabBar.tsx` | Typographie | **Moyen** | `fontWeight: '600'` sans Inter file |
| `components/BudgetHealthCard.tsx` | Couleur sur texte complet | **Moyen** | Label statut + % entiers en couleur sémantique |
| `components/SavingsGoalsForm.tsx` | Couleur sur texte complet | **Moyen** | Paragraphe warning entier orange |
| `app/add-transaction.tsx` | Couleur sur texte complet | **Moyen** | Message warning transfert entier orange |
| `components/ThemedFormMessage.tsx` | Couleur sur texte complet | **Moyen** | Titre entier en couleur accent |
| `components/BudgetRing.tsx` | Couleur sur texte complet | **Moyen** | « X% libre » entier en vert primary |
| `components/DashboardDateBadge.tsx` | Couleur sur texte complet | **Faible** | Mois abrégé entier en vert |
| `components/WealthAssetCard.tsx` | Couleur sur texte complet | **Moyen** | Gain + pct dans même span coloré |
| `app/_layout.tsx` | Typographie | **Moyen** | DM Sans chargé, jamais utilisé |
| `app/(tabs)/index.tsx` | Hiérarchie layout | **Moyen** | Ordre sections ≠ Portefeuille |
| Multiples | Espacement hors grille | **Moyen** | Valeurs 1–18 px non multiples stricts de 4/8 |
| Multiples | Touch target | **Moyen** | Boutons secondaires 32–38px |
| Multiples | Ombres | **Moyen** | Pas d'échelle unifiée |
| `ConfirmDeleteModal` vs `subtleDeleteButtonStyle` | Composants dupliqués | **Faible** | Deux patterns delete |
| `app/(tabs)/index.tsx` | Code mort | **Faible** | `healthWarning`, `legendLabelRisk` non utilisés |

### 4.2 Résumé par catégorie

| Catégorie | Constats | Sévérité dominante |
|---|---|---|
| Couleurs | 129 hex, ~10 clusters doublons ; tokens divergent de spec | **Élevé** |
| Typographie | Inter de facto ; DM Sans inutilisé ; DM Serif ×1 ; DM Mono OK | **Élevé** |
| Border-radius | Sharp corners non respecté — radius.card=18 omniprésent | **Élevé** |
| Couleur sur texte complet | Violations sur légendes alerte, warnings, statuts | **Élevé** |
| Bottom nav | Spacing hors grille + FAB hétérogènes | **Moyen** |
| Hiérarchie écrans | Accueil vs Portefeuille ordre différent | **Moyen** |
| Espacement | Échelle 4/8 documentée, nombreuses exceptions | **Moyen** |
| Contraste | Tab inactif sous AA | **Moyen** |
| Touch targets | Contrôles secondaires < 44px | **Moyen** |
| Ombres | Pas d'échelle tokenisée | **Moyen** |
| Composants dupliqués | Delete/feedback multiples patterns | **Faible** |

### 4.3 Top 10 problèmes prioritaires

1. **Double système couleurs sémantiques** — `#00e664`/`#ff5555` (tokens) vs `#4ADE80`/`#FF6B6B` (dashboard)
2. **Background/surface ≠ spec** — `#0a0a0a`/`#111111` vs `#0E0E10`/`#1C1C1F`
3. **Typographie Inter vs DM** — quasi-totalité en Inter ; DM Sans jamais appliqué
4. **Coins arrondis omniprésents** — contredit sharp corners (cards 18px, FAB, pills 999)
5. **Légendes alerte Accueil** — labels complets en orange/vert (`"Loyer · 20 juin"`)
6. **Contraste tabs inactifs** — `#6B6B6B` sur `#1C1C1C` sous AA 4.5:1
7. **FAB bottom nav hétérogène** — AI chat / speed-dial / absent selon écran
8. **BudgetHealthCard** — label statut + pourcentage entiers en couleur sémantique
9. **Messages warning pleine largeur** — SavingsGoalsForm, add-transaction
10. **Palette budgets ad hoc** — couleurs catégorie non tokenisées

---

## 5. Partie 4 — Couleur sur texte complet

### 5.1 Règle

> La couleur sémantique (vert/rouge/orange/ambre) doit vivre sur l'**élément le plus petit possible** (icône, badge, montant). Le texte environnant reste neutre (gris/blanc).  
> Style de référence : Notion, Linear, Wealthsimple.

### 5.2 Exceptions

| Exclusion | Détail |
|---|---|
| **Data visualization** | Lignes, barres, aires, points de graphiques — couleur pleine normale et voulue |
| **Montants hero** | Chiffres monétaires / pourcentages centraux peuvent être colorés (cas ambigu) |
| **Badges compacts** | Chips statut petits (ex. « Dans 3 j ») — élément sémantique minimal |

### 5.3 Violations confirmées

| Fichier / composant | Texte / label affecté | Couleur actuelle | Garder la couleur sur… |
|---|---|---|---|
| `app/(tabs)/index.tsx` — `AlertCard` légende L859 | `{paymentName} · {date}` ex. « Loyer · 20 juin » | `alert.color` (orange `#e6a000` ou rouge) | Icône `AlertDiamondFillIcon` (déjà colorée L857) ; label en `textMuted` |
| `app/(tabs)/index.tsx` — `AlertCard` légende L865 | `Dépôt de paie estimé · {date}` | `palette.green` (`#00e664`) | Icône wallet (déjà verte L864) ; label neutre |
| `components/BudgetHealthCard.tsx` L171 | « Attention » / « Critique » / « Bien » | accent status (`#f59e0b`, `#FF6B6B`, `#4ADE80`) | Anneau SVG ou dot ; texte statut neutre |
| `components/BudgetHealthCard.tsx` L179 | `{pct}%` centre du ring | accent status | Voir note ambiguë §5.5 |
| `components/BudgetRing.tsx` L56 | `{freePercent}% libre` | `colors.primary` (vert) | Arc SVG (déjà vert) ; texte centre neutre |
| `components/DashboardDateBadge.tsx` L26 | Mois abrégé (`JAN`, `FÉV`…) | `colors.primary` | Indicateur latéral ; mois en `textMuted` |
| `components/SavingsGoalsForm.tsx` L283 | Paragraphe warning hebdomadaire complet | `colors.warning` | Icône + fond `warningMuted` ; corps en `text` |
| `app/add-transaction.tsx` L2166 | « Sélectionne deux sources différentes. » | `colors.warning` | Icône warning ; texte en `text`/`textMuted` |
| `components/ThemedFormMessage.tsx` L36 | Titre du message (`title`) | accent danger/warning/success | Icône (déjà accent L34) ; titre en `text` bold |
| `components/ConfirmDeleteModal.tsx` L143 | Label confirmation (« Supprimer ») | `colors.danger` | Icône trash ; bouton outline sans texte entier rouge |
| `components/SettingsRow.tsx` L108 | Label row destructive | `colors.danger` | Icône ; label en `text` |
| `components/WealthAssetCard.tsx` L263 | `+1 234 $ · +12,4 %` (gain + pct même span) | `success`/`danger` | Montant `$` coloré ; `· +12,4 %` en `textMuted` |
| `app/(tabs)/settings.tsx` L233 | « Connecté » | `colors.primary` | Dot vert ; texte en `text` |
| `components/ai-chat/AIChatSettingsSheet.tsx` L379 | Row highlight warning | `colors.warning` | Icône statut ; label en `text` |
| `components/RegionPickerSheet.tsx` L348, L371 | Lettre index preview + surlignées | `DASHBOARD_VALUE_GREEN` | Barre latérale ; lettres en `text`/`textMuted` |
| `components/RecurringPaymentsForm.tsx` L586 | Label « Revenu » sélectionné | `themeColors.primary` | Bordure/fond chip ; texte en `text` |
| `app/loan-detail.tsx` L234 | `{pct}%` progression prêt | `colors.danger` | Barre SVG ; label « Remboursé » neutre |
| `app/(tabs)/accounts.tsx` L3844 | Total dette badge header prêts | `colors.danger` | Montant seul coloré ; unité neutre |

### 5.4 Bonnes pratiques en place (référence)

| Composant | Pattern |
|---|---|
| `MinimizedAlertCard` | Titre/subtitle neutres ; couleur sur barre accent 5px + badge montant bordure |
| `PaymentListRow` (Accueil « Prochain paiement ») | Titre/meta neutres ; couleur sur icône well + badge statut compact |
| `TransactionRow` | Montant income en vert ; titre/meta neutres |
| `AgendaView` / `AgendaPaymentCard` | Titre `bill.name` neutre ; couleur sur icône + badge statut |
| `AlertCardWidget` (AI chat) | Titre/message neutres ; accent sur `borderLeftColor` |
| `DashboardStatCard` / `DashboardStatLegendItem` | Dot coloré + label `textMuted` ✓ |
| `LineOfCreditCharts` / `MortgageCharts` légendes | Label `textMuted` + barre colorée ✓ |

### 5.5 Cas ambigus (note séparée — ne pas traiter comme violation sans décision produit)

| Composant | Élément | Raison |
|---|---|---|
| `BudgetHealthCard` — `{pct}%` | Chiffre central du ring | Frontière montant / label de statut |
| `PaymentListRow` — badges « Dans 3 j » / « Reçu » | Texte badge compact | Chip = petit élément sémantique (pattern acceptable) |
| `PaymentDetailSheet` — `impactSummary.primary` | Valeur projection budget | Hero amount |
| `wealth-asset-detail.tsx` — hero amount | Montant principal | Pattern Wealthsimple — montant coloré |
| `TransactionRow` — `amountIncome` | Montant revenu seul | Conforme — montant seul coloré |
| `accounts.tsx` — `wealthToggleBadgeLabel` | Montant dette dans badge | Badge compact ; pas de séparation chiffre/label |
| Légendes charts | Labels adjacents data viz | **Exclus** par règle — la plupart déjà `textMuted` |
| `index.tsx` — `healthWarning`, `legendLabelRisk` | Styles définis | **Code mort** — non utilisés en JSX |

---

## 6. Annexes

### 6.1 Fichiers token / theme

| Fichier | Rôle |
|---|---|
| `constants/theme.ts` | Tokens principal (~1000 lignes) |
| `constants/typographyKit.ts` | Presets typographiques Inter |
| `constants/interFonts.ts` | Familles Inter |
| `constants/dmSerifFonts.ts` | DM Serif Display |
| `constants/ghostUi.ts` | Ghost/card surfaces |
| `constants/floatingGlassButton.ts` | FAB sizing |
| `lib/themeContext.tsx` | Provider dark/light |
| `lib/typographyDefaults.ts` | Default Text = Inter |
| `components/ai-chat/theme.ts` | Tokens AI chat |
| `components/chat/widgets/theme.ts` | Tokens AI widgets |

### 6.2 Écrans audités (23 routes)

**Tabs :** `index`, `transactions`, `accounts`, `goals`, `budgets`, `settings`  
**Stack/modal :** `add-transaction`, `account-detail`, `transaction-detail`, `contact-detail`, `merchant-detail`, `merchant-receipts`, `goal-detail`, `savings-goal-transactions`, `budget-category-transactions`, `loan-detail`, `wealth-asset-detail`, `wealth-asset-transactions`, `scan`, `ai-chat`, `ai-advisor`

### 6.3 Bottom nav — routes visibles

| Route | Label | Icône |
|---|---|---|
| `index` | Accueil | grid |
| `transactions` | Transactions | receipt |
| `accounts` | Portefeuille | wallet |
| `goals` | Objectifs | navigate-circle |
| `budgets` | Budget | pie-chart |
| `settings` | *(masqué)* | options |

---

*Rapport généré automatiquement — audit en lecture seule, juin 2026.*
