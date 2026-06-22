# FloatingTabBar — redesign pill minimaliste

Date : 2026-06-20  
Fichier : `components/FloatingTabBar.tsx`

## FAB — aucune modification

Le bloc FAB (AI chat dashboard, bouton add / speed-dial Historique & Agenda, backdrop, arc options, gradients, positions `rightThumbFabBottom`, `FAB_STACK_OFFSET_ADD`, styles `addOuter`, `aiChatOuter`, `fabPosition`, etc.) n’a **subi aucun changement** de code, de style ou de logique.

## Icônes MaterialCommunityIcons par tab

| Tab (route) | Inactif (outline) | Actif (filled) | Notes |
|---|---|---|---|
| Accueil (`index`) | `home-outline` | `home` | Paire native MCI ✓ |
| Transactions (`transactions`) | `receipt-text-outline` | `receipt-text` | Paire native MCI ✓ |
| Portefeuille (`accounts`) | `wallet-outline` | `wallet` | Paire native MCI ✓ |
| Objectifs (`goals`) | `flag-outline` | `flag` | Paire native MCI ✓ |
| Budget (`budgets`) | `chart-pie-outline` | `chart-pie` | Paire outline disponible ✓ — pas de fallback couleur seule |

Toutes les paires ont été vérifiées dans `@expo/vector-icons` → `MaterialCommunityIcons.json`.

## Changements barre de navigation

- Pill flottante : `marginHorizontal: 16`, `marginBottom: safeArea + 8`
- `borderRadius: radius.pill`, fond `containerBackground`, bordure hairline `colors.border`
- Padding interne : `paddingVertical: 13`, `paddingHorizontal: 20` (grille 4/8)
- Icônes seules, 21 px
- Actif : `colors.text` + icône pleine — Inactif : `colors.textMuted` + icône outline
- Suppression : labels texte, fond/pill par item actif, animation scale/opacity MotiView sur les tabs

## Touch targets

Chaque tab : `minWidth: 44`, `minHeight: 44` sur le `Pressable` (zone tactile ≥ 44×44 px).

## Accessibilité

- `accessibilityRole="tab"` sur chaque item
- `accessibilityLabel` : « Accueil », « Transactions », « Portefeuille », « Objectifs », « Budget »
- `accessibilityState={{ selected: focused }}`

## Constante thème

`FLOATING_TAB_BAR_PILL_HEIGHT` mis à jour → `70` (13 + 44 + 13) pour les overlays (ex. chat input).
