# Where work stopped and what's next

*Last updated: Oct 26, 2026, branch `fix/nav-bar-light-theme` (PR #2).* Update this file whenever you stop.

## Done in the latest batch (needs on-device testing)
- **Expo SDK 57 → 58** (React Native 0.88, React 19.3, Reanimated 4.7, Gesture Handler 3). `InteractionManager` was removed, so use `lib/runAfterInteractions.ts`.
- **Account envelopes:** `components/wallet/EnvelopeTransferSheet.tsx` moves money from "Non attribué" or another envelope. It opens from a row on the account detail screen. *Ajouter → Virement* can also target one of the source account's envelopes; this only re-splits the balance and creates no transaction. `moveEnvelopeMoney()` lives in `lib/accountEnvelopes.ts`.
- **"Factures d'avance" (bills cushion):** a savings goal plus an envelope in a chosen account. Its target climbs a ladder: 2 weeks → 1 month → 2 months → 3 months of recurring payments. See `lib/billsCushionTiers.ts` (pure logic), `lib/billsCushion.ts` (storage) and `components/copilot/BillsCushionSheet.tsx`. The DB gained `savings_goals.linked_account_id`, `linked_envelope_id` and `tier_kind`.
- **FABs hide while scrolling down** (`lib/fabScrollVisibility.ts` + `components/tabbar/FabAutoHide.tsx`) on Activité and Agenda.
- **Agenda calendar:** each day shows the **total of all its payments**, paid or not. Paid days show "✓ amount" in grey, and income-only days show "+amount" in green. The bigger amount row no longer gets clipped on Android, and the legend shows each label above its amount.
- **Bottom tab bar:** more space above the Android system bar, labels no longer clipped, and the Wallet tab is now called **"COMPTES"**.
- **Accueil, upcoming payments:** all cards are the same height. A shortfall now shows as an amber ⚠ next to the countdown, with no extra line.
- **Primary buttons:** neutral pill (`PrimarySaveButton`, AddArticleSheet, GeminiApiKeySheet). The speed-dial bubbles are flat charcoal with no glass.
- **Merchant logos:** a large lookup table (`lib/merchantLogoDatabase.ts`) that also matches whole words in bank-style labels like "TIM HORTONS #1234 …".

## Open questions for the owner
- `lib/budgetTone.ts` was changed to **muted** red and sand (`#B86B6B` / `#A8916A`). That contradicts the "vivid colours" rule in `CLAUDE.md`. Ask before keeping it, or revert to `#EF4444` / `#F59E0B`.
- The "Virement" → envelope path in `app/add-transaction.tsx` doesn't check that the amount is ≤ the account's unassigned money. `EnvelopeTransferSheet` does check.

## Next up (from `docs/ux-audit-2026-10-21.md`)
1. **Reconcile the totals** (audit items 1 and 2). Accueil, Budget and Agenda show three different "spent this month" totals, and net worth differs between Accueil and Wallet. Use one source of truth, or label what each number measures. This is the biggest trust issue.
2. **Muted-text contrast and minimum font size** (items 4 and 5). Raise the muted text token in `constants/theme.ts` to about 4.5:1, and keep text ≥ 11–12 px.
3. **Activité header overflow at 390 pt** (item 8). Progress-ring colours (item 9) must follow the vivid tones in `budgetTone.ts`.
4. Audit items to re-check before ticking them off:
   - #3 Wallet nested buttons: `ProtoWalletHub.tsx` was reworked.
   - #6 tap targets: `PillButton` now has `hitSlop`.
   - #7 FAB overlap: auto-hide is done.
   - #10 tab naming: now "COMPTES".
5. **Type debt:** about 165 `tsc` errors, mostly RN 0.88 ref typings (`useRef<TextInput>` → `focus`/`blur`/`measureLayout` missing). Fix them file by file when you touch a file.

## Housekeeping
- An empty `App.tsx` at the repo root is an accident. It isn't committed; delete it.
