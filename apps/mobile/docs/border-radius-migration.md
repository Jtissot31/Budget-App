# Migration border-radius — Wealthsimple-style

Date : 2026-06-20  
Scope : `apps/mobile` — tokens `radius.*`, sheets/modals/cards/badges, cohérence containers.

## Nouveau système (source unique — `constants/theme.ts`)

| Token | Avant | Après | Usage |
|---|---|---|---|
| `radius.sm` | 8 | **8** | Badges, chips, icon wells, date badges |
| `radius.md` | 12 | **10** | Inputs, petits containers |
| `radius.card` | 18 | **14** | Cards principales (dashboard, listes, comptes) |
| `radius.lg` | 16 | **20** | Bottom sheets, modals, gros containers |
| `radius.pill` | 999 | **999** | Pills, drag handles, FAB, avatars |
| `radius.xl` (deprecated) | 18 | **14** | → `radius.card` |
| `radius.xxl` (deprecated) | 18 | **20** | → `radius.lg` |

## Fichiers modifiés

### Tokens & composants centraux
- `constants/theme.ts`
- `components/DashboardCard.tsx` (commentaire)
- `components/BottomSheet.tsx` — sheet top `radius.xxl` → `radius.lg`
- `components/SurfaceCard.tsx` — hérite de `radius.card` (14 via token)
- `components/ConfirmDeleteModal.tsx` — modal card `radius.lg`, icon well `radius.md`
- `components/ThemedConfirmModal.tsx` — modal `radius.lg`, boutons `radius.md`
- `components/DashboardDateBadge.tsx` — `14` → `radius.sm` (8)
- `components/BankAccountCard.tsx` — `CARD_RADIUS` → `radius.card` (14)

### Fichiers flaggés audit (étape 2)
| Fichier | Changements |
|---|---|
| `components/FloatingTabBar.tsx` | **Aucun** — FAB `borderRadius: 27` (circulaire) conservé |
| `components/DashboardDateBadge.tsx` | `14` → `radius.sm` |
| `components/ConfirmDeleteModal.tsx` | `radius.card+4` / `16` → `radius.lg` / `radius.md` |
| `app/transaction-detail.tsx` | Sheets top `radius.card` → `radius.lg` ; boutons ronds `19`/`27`/`17`/`13` **intacts** |
| `components/AgendaView.tsx` | Picker sheet `28` → `radius.lg` ; handle `999` intact |
| `app/(tabs)/transactions.tsx` | Modal sheet `30` → `radius.lg` ; card `18` → `radius.card` ; icônes rondes `24`/`22` intactes |

### Cohérence containers (étape 3.4) — propagation
Bottom sheets / modals unifiés sur `radius.lg` :
- `components/RecurringPaymentsForm.tsx`
- `components/SavingsGoalsForm.tsx`
- `components/SettingsPickerSheet.tsx`
- `components/RegionPickerSheet.tsx`
- `components/IconPickerSheet.tsx`
- `components/ContactFormModal.tsx`
- `components/AddArticleSheet.tsx`
- `components/ai-chat/AIChatSettingsSheet.tsx`
- `components/ai-chat/AIChatSettingDetailSheet.tsx`
- `components/PaymentDetailSheet.tsx`
- `app/add-transaction.tsx`
- `app/account-detail.tsx`
- `app/(tabs)/accounts.tsx`
- `app/(tabs)/budgets.tsx`
- `app/(tabs)/index.tsx` (selector sheet)
- `app/savings-goal-transactions.tsx`
- `app/wealth-asset-transactions.tsx`
- `app/budget-category-transactions.tsx`
- `components/MerchantEditModal.tsx`

Constantes `DETAIL_SHEET_TOP_RADIUS = 22` supprimées → `radius.lg` inline.

Mappings hardcodés → tokens :
- `18` → `radius.card` (cards)
- `17` / `16` / `15` → `radius.md` (inputs, petits shells)
- `30` / `28` / `22` (sheets/modals) → `radius.lg`
- `14` (badges/icon wells) → `radius.sm` dans : `SavingsGoalsForm`, `RecurringPaymentsForm`, `goals.tsx`, `budgets.tsx`, `DiamondLevelBadge`, `WealthAssetCard`, `BudgetMonthOverview`

## Ancien → nouveau (extraits notables)

| Emplacement | Avant | Après |
|---|---|---|
| `theme.ts` `radius.card` | 18 | 14 |
| `theme.ts` `radius.lg` | 16 | 20 |
| `theme.ts` `radius.md` | 12 | 10 |
| Bottom sheets (global) | 28 / 22 / `card+4` | `radius.lg` (20) |
| `DashboardDateBadge` | 14 | `radius.sm` (8) |
| Modals confirmation | 22 / `card+4` | `radius.lg` (20) |
| Cards hardcodées `18` | 18 | `radius.card` (14) |
| Inputs / chips `17` | 17 | `radius.md` (10) |

## Éléments circulaires / illustratifs — non touchés

| Élément | Fichier | Valeur conservée |
|---|---|---|
| FAB AI | `FloatingTabBar.tsx` | `borderRadius: 27` |
| Bouton retour 38×38 | `transaction-detail.tsx`, écrans détail | `19` |
| FAB reçu 54×54 | `transaction-detail.tsx` | `27` |
| Close preview 34×34 | `transaction-detail.tsx` | `17` |
| Icon well insight 26×26 | `transaction-detail.tsx` | `13` |
| Empty state icons 48×48 | divers | `24` |
| Header icon 40×40 | `index.tsx` | `20` |
| Shortfall badge 28×28 | `index.tsx` | `14` |
| Manage chart btn 44×44 | `accounts.tsx` | `22` |
| Confirm icon 44×44 | `transactions.tsx` | `22` |
| Illustration wallet SVG | `CashAccountCard.tsx` | `VIEW_RADIUS = 3` |
| Graphiques data viz | `BudgetAllocationChart.tsx`, etc. | couleurs + radius internes inchangés |

## Cas ambigus (flaggés, non modifiés)

1. **Bulles chat / AI** (`AIChatMessage`, `InputBar`, `AIChatInputBar`, etc.) — `borderRadius: 20` / `24` laissés tels quels (containers messaging, hors liste audit explicite).
2. **`BottomSheet` handle** — `borderRadius: 2` (barre 4px) vs `radius.pill` sur d'autres handles ; fonctionnel, pas un container.
3. **`BankAccountCard` CARD.fill** `#28282E` — couleur migrée précédemment ; seul `CARD_RADIUS` → token ici.
4. **`SegmentedTabs`** — utilise encore `radius.card - 3` / `radius.xxl` (deprecated → 20) ; hérite des nouveaux tokens sans refactor dédié.
5. **`ReceiptCaptureActions` `borderRadius: 21`** — bouton ~42px circulaire, laissé.

## Test device

```bash
npx expo start -c
```

Vérifier : bottom sheets (Agenda, transactions, add-transaction), modals suppression, cards dashboard/Portefeuille, date badge Accueil, FAB toujours rond.
