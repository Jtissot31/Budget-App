# Diagnostic — voile sombre sur l’écran Transactions

Date : 2026-06-20  
Statut : **lecture seule — aucun fix appliqué**

## Symptôme rapporté

Un voile sombre semi-transparent semble couvrir l’écran **Transactions** (et possiblement d’autres écrans), assombrissant tout le contenu (texte, cartes, segmented tabs) **sauf** le FAB vert et l’onglet actif de la bottom nav, qui restent pleinement saturés.

---

## Synthèse

Le symptôme correspond **exactement** au empilement z-index du **backdrop speed-dial du `FloatingTabBar`** :

- Scrim noir ~52 % sur tout l’écran (`zIndex: 8`)
- Contenu des tabs **sous** la tab bar → assombri
- FAB add (`zIndex: 10`) et barre de nav (rendue après, même parent) → restent pleinement visibles

Ce n’est **pas** un overlay global du `ThemeProvider`, ni un token de fond devenu semi-transparent via la migration couleurs v2.

---

## 1. Overlays / scrims sur Transactions et composants enfants

| Source | Fichier | Style | Plein écran ? | Condition de visibilité |
|---|---|---|---|---|
| **Backdrop speed-dial Historique** | `components/FloatingTabBar.tsx` L265–280 | `rgba(0,0,0,0.52)` (dark) | Oui — `height: SCREEN_HEIGHT`, `position: absolute`, `zIndex: 8` | `showHistoryFabOptions` |
| **Backdrop speed-dial Agenda** | `components/FloatingTabBar.tsx` L347–360 | idem | idem | `showAgendaFabOptions` |
| Modals marchand / contact / récurrent | `app/(tabs)/transactions.tsx` L628–656 | `rgba(0,0,0,0.68)` ou `0.62` via modals | Oui (Modal `transparent`) | `editingMerchant`, `showContactForm`, `recurringForm != null` |
| `confirmOverlay` | `app/(tabs)/transactions.tsx` L935–940 | `rgba(0,0,0,0.52)` + `absoluteFillObject` | Style seulement | **Jamais utilisé dans le JSX** (code mort) |
| Backdrop picker récurrents | `components/AgendaView.tsx` L1073–1079 | `rgba(0,0,0,0.62)` | Modal | `showRecurringList === true` |

Aucun autre scrim plein écran identifié dans `transactions.tsx` ou ses composants directs (FlatList, SegmentedTabs, TransactionRow, MerchantDirectory, etc.).

---

## 2. Backdrop monté alors que le menu est « fermé » ?

### Logique actuelle (`FloatingTabBar.tsx`)

```tsx
const showHistoryFabOptions = isTransactionsHistoryView && isHistoryFabExpanded;
const showAgendaFabOptions = isTransactionsAgendaView && isAgendaFabExpanded;
```

Le backdrop est rendu via ternaire strict (`? … : null`) — pas de `opacity: 0` avec composant toujours monté.

Reset au changement d’écran / sous-vue :

```tsx
useEffect(() => {
  setIsHistoryFabExpanded(false);
  setIsAgendaFabExpanded(false);
}, [activeRouteName, pathname, transactionsView]);
```

### Bug classique suspecté

Si le voile est visible **au repos** (FAB non ouvert) :

- `isHistoryFabExpanded` ou `isAgendaFabExpanded` **bloqué à `true`**, ou
- speed-dial **encore ouvert** (FAB en rotation 45°) sans que l’utilisateur le perçoive.

La logique de rendu conditionnel est correcte ; le problème serait plutôt un **état React non remis à zéro**, pas un overlay toujours monté par erreur de JSX.

---

## 3. Lien avec la migration couleurs v2 ?

**Aucun remap d’opacité responsable identifié.**

| Élément | Constat |
|---|---|
| Backdrop FAB dark | Toujours `rgba(0, 0, 0, 0.52)` — non modifié par migration v2 |
| Tokens fond (`background`, `containerBackground`) | Hex opaques (`#0E0E10`, `#28282E`) |
| `confirmOverlay` Transactions | Style mort, non rendu |
| Doc migration v2 | FAB / backdrop explicitement hors scope des changements |

La migration peut avoir **augmenté le contraste perçu** (fond plus sombre + scrim noir par-dessus), sans être la cause structurelle du voile.

---

## 4. `lib/themeContext.tsx`

Aucun overlay global d’assombrissement :

- Expose `colors`, `ghost`, `mode`, `setMode`, etc.
- **Pas** de `View` scrim montée par défaut.

---

## 5. Portée par écran

| Écran | Backdrop speed-dial possible ? | Commentaire |
|---|---|---|
| **Transactions — Historique / Agenda** | **Oui** | Seul onglet avec FAB « + » speed-dial → **suspect n°1** |
| Accueil | Non | FAB AI chat sans backdrop plein écran |
| Portefeuille, Objectifs, Budget | Non | `showAddButton === false` |
| Tous (swipe entre tabs) | Opacité légère | `app/(tabs)/_layout.tsx` — `opacity` 1.0 → 0.92 pendant swipe ; **pas** un scrim noir ; FAB/nav **hors** de l’`Animated.View` |

**Conclusion :** le voile `rgba(0,0,0,0.52)` n’existe **nativement que sur Transactions (Historique/Agenda)** via `FloatingTabBar`. Si le voile apparaît aussi sur Accueil / Portefeuille **au repos**, investiguer en second lieu : Modal fantôme Android, ou `translateX` swipe bloqué non nul dans `_layout.tsx`.

---

## Cause exacte retenue (pré-fix)

| Champ | Valeur |
|---|---|
| **Composant** | `components/FloatingTabBar.tsx` |
| **Élément** | `Pressable` + style `historyFabBackdrop` (idem variante Agenda) |
| **Visibilité normale** | Uniquement quand le speed-dial du FAB « + » est ouvert sur Transactions |
| **Bug probable si permanent au repos** | État `isHistoryFabExpanded` / `isAgendaFabExpanded` non remis à `false` |

### Empilement z-index (explique le symptôme)

```
[Contenu tab]                    ← assombri par scrim
  ↑ sous tab bar
[historyFabBackdrop  zIndex: 8]  ← rgba(0,0,0,0.52)
[FAB add             zIndex: 10] ← pleinement saturé
[Bottom nav pill]                ← pleinement saturé (après FAB dans l’arbre)
```

---

## Pistes de fix (non implémentées)

1. Vérifier sur device si `isHistoryFabExpanded` est `true` au repos (FAB en 45°).
2. Forcer unmount du backdrop + garde-fou sur blur / changement de focus tab.
3. Si voile sur **tous** les écrans : auditer Modals (`visible` stuck) et `translateX` dans `_layout.tsx`.

---

## Fix appliqué (2026-06-20)

Fichier : `components/FloatingTabBar.tsx`

### Scénario exact qui causait le bug

1. Utilisateur sur **Transactions → Historique**, ouvre le speed-dial FAB (`isHistoryFabExpanded = true`) → backdrop `rgba(0,0,0,0.52)` monté (`zIndex: 8`).
2. Utilisateur tape un **autre item du bottom nav** (ex. Accueil) **sans** fermer le speed-dial via le backdrop ou le FAB.
3. L’ancien `useEffect([activeRouteName, pathname, transactionsView])` remettait les états à `false` **après** le commit de navigation React — parfois **trop tard** ou **non déclenché** si seuls des paramètres internes changeaient ; `isHistoryFabExpanded` pouvait rester `true`.
4. Au retour sur Transactions Historique, ou pendant une frame de transition : `isTransactionsHistoryView && isHistoryFabExpanded` → voile visible **sans** speed-dial intentionnellement ouvert.

Variante : app passée en arrière-plan avec speed-dial ouvert → retour foreground sans reset → voile persistant.

### Correctifs

| Garde-fou | Comportement |
|---|---|
| `collapseSpeedDials()` au **début** de chaque `onPress` tab nav | Voile disparaît **immédiatement** au tap (scénario point 5) |
| `useFocusEffect` (blur/focus tab navigator) | Reset à la sortie/retour stack au-dessus des tabs |
| `useEffect` + cleanup sur `[state.index, pathname, transactionsView]` | Reset au changement d’onglet, de pathname, Historique ↔ Agenda |
| `AppState` → `background` / `inactive` | Reset si l’app passe en arrière-plan |
| `BackHandler` si speed-dial ouvert | Android back ferme le menu au lieu de laisser le voile |

Backdrop `rgba(0,0,0,0.52)`, z-index 8/10, redesign nav pill : **inchangés**.

### Garde-fou FAB « + » — style 100 % préservé

**Aucun changement visuel ou d’animation sur le FAB add transaction.** Le fix ne modifie que *quand* le speed-dial se ferme, pas *comment* il s’ouvre ou à quoi il ressemble.

| Zone | Touché par le fix ? |
|---|---|
| `isHistoryFabExpanded` / `isAgendaFabExpanded` (reset) | **Oui** — logique uniquement |
| `useFocusEffect`, `AppState`, `BackHandler`, `onPress` tab | **Oui** — garde-fous reset |
| Couleur / gradient vert (`colors.primary`, ombre) | **Non** |
| Taille / forme (`54×54`, `borderRadius: 27`) | **Non** |
| Icône `PlusFabIcon` (`24`, `#000000`) | **Non** |
| Rotation MotiView `45deg` / `180ms` | **Non** — déclenchement inchangé, état reset externe seulement |
| Options arc speed-dial (pills Historique/Agenda) | **Non** |
| AI chat FAB (gradient séparé) | **Non** |

**Flag style FAB requis pour corriger le bug : non** — le voile persistant était purement un problème d’état `expanded` non remis à zéro, pas un conflit de style.

### Test scénario point 5 (à valider sur device)

1. Transactions → Historique → ouvrir speed-dial FAB (+).
2. Taper directement **Accueil** (ou Portefeuille) dans la bottom nav.
3. **Attendu** : voile disparaît immédiatement ; pas de scrim sur l’écran destination.

---

## Fichiers inspectés

- `app/(tabs)/transactions.tsx`
- `components/FloatingTabBar.tsx`
- `components/AgendaView.tsx`
- `components/ConfirmDeleteModal.tsx`
- `components/RecurringPaymentsForm.tsx`
- `components/PageTransition.tsx`
- `components/AppBackgroundGradient.tsx`
- `app/(tabs)/_layout.tsx`
- `app/_layout.tsx`
- `lib/themeContext.tsx`
- `constants/theme.ts`
- `docs/color-migration-v2.md`
