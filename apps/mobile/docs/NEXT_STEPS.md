# Where work stopped and what's next

*Last updated: Nov 1, 2026, branch `fix/nav-bar-light-theme` (PR #2).* Update this file whenever you stop.

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

## Done Nov 1, 2026 (uncommitted, needs on-device testing)
- **Account detail:** Enveloppes, À venir and Historique are now cards with the same row. Enveloppes has a "Mis de côté / Libre" summary with a bar; À venir shows relative dates and sorts by real next occurrence; Historique has one card per month (`components/wallet/AccountHistoryList.tsx`), with the date under the amount and one net total per month.
- **Envelope creation** (`EnvelopeSheet.tsx`) is name + emoji only, starting at 0 $. Money goes in through « Virer », and editing still shows the amount. The owner rejected preset chips, big-emoji heroes and quick-amount pills as childish. The keyboard opens by itself and the sheet is tall so the form stays above it (real Android keyboard untested).
- **Envelope detail page** (`app/envelope-detail.tsx`): tapping an envelope on the account page opens it. Comptes no longer shows envelopes or expand chevrons; they are created from the account page. Amount, share of balance, round shortcuts Ajouter / Retirer / Transférer, linked goal; the owner asked for shortcuts instead of a Mouvements list. Modifier (name + emoji only) and Supprimer are in the … menu. New table `account_envelope_moves`, written by `moveEnvelopeMoney()` but not shown anywhere for now.
- **Account detail hero:** `components/wallet/AccountBankCard.tsx` draws the account as a bank card, dark graphite with a tint of the bank from `lib/institutionBrandColor.ts`, balance on it. The owner rejected a saturated version with a gold chip and a big disc as ugly. The summary card under it drops its own amount (`hideHero`) and keeps Entrées / Sorties, or the credit details, and is hidden when empty. The owner had the balance chart removed from this page.
- **Loans:** `components/loans/LoanFormSheet.tsx` is the first way to create a loan (Comptes → Prêts → Ajouter). It creates no recurring payment yet, so a new loan is not in the Agenda.
- **Loans:** `components/loans/LoanFormSheet.tsx` is the first way to create a loan (Comptes → Prêts → Ajouter). It creates no recurring payment yet, so a new loan is not in the Agenda.
- **Agenda:** calendar is the default view; next payment merged into the summary card; the « + » is `SpeedDialFab` in the tab bar, shared with Activité.
- **Options menu:** `OverflowMenuButton` sits at the bottom of the screen and runs its action after closing, because Android dropped dialogs and focus requested during the close. **Category sheet:** the limit moved to its own row under the summary.
- **FitText:** also uses native `adjustsFontSizeToFit`, because Android could measure the hidden copy clipped and end in « … ». **Status bar scrim** is in the root layout.
- **Budget tiles:** ring and icon sizes are shared with goal tiles; a dashed « Nouvelle catégorie » tile ends the grid.
- **Recurring form:** name in a filled field, account and category as chips like the transaction form; Actif and end date only show when editing. In the calendar, today and the selected day get an outline.
- **Envelope transfers:** `EnvelopeTransferSheet` follows the Virement form (big amount, numpad, chips) and names the account instead of « Non attribué ».
- **Loan cards:** headline is what is left to pay, in full (not « 208,8K »), then « à payer sur X ».
- **New category form:** name (with icon) and monthly limit only. Quick amounts, pace preview and the periodic limit were removed at the owner's request; `upsertCategoryBudget` still accepts a weekly limit.
- **Activité summary:** `SpendIncomeRatioCard` (expenses / income this month) replaces `SpendAndSaveCard`, which is now unused.
- **Expense form:** `ChipSelectField` chips no longer jump to the front (reorder spring + scroll fought each other). Toast has no FitText/spring and waits for the sheet to close. « + Ajouter » on the articles card kept its fill off Android because of a Pressable style function, now on an inner View. The 24 h impulse tip is limited to shopping categories.
- **Fake charts removed:** goal and loan charts used to draw a made-up ramp without real data (`buildDemoGoalContributionRamp`, deleted). Goal Évolution now only shows with real versements. Budget hero lost its pace bar; Patrimoine row is out of Comptes (route `/patrimoine` remains); tabs have a status bar scrim.
- **Budget colours:** `lib/budgetTone.ts` is now one vivid amber; the À surveiller section is gone and category tiles show only ring, %, name and what is left (the owner found the screen too wordy).
- **Activité:** the date filter icon was removed at the owner's request. **Goal form:** name in a filled field, target and saved side by side, hints removed. `DatePickerField` layout moved to an inner View (Android). Home carousel: two cards fit between the margins.
- **Categories:** limit raised from 10 to 30 (the owner was at 10, which hid the add button); colours repeat past the palette. « + Ajouter » sits in the section header.
- **Agenda:** calendar is the default view; next payment merged into the summary card; the « + » is `SpeedDialFab` in the tab bar, shared with Activité (`AddTransactionFab`).
- **Income icon:** the big green `$` in a tile is gone. `IncomeIcon` is now a grey `trending-up`; in `ProtoTransactionRow` it has no tile, like the logos. Expense rows without a logo keep their tile.
- **Crop:** the font wait cap went from 3 s to 20 s because fonts take longer over a tunnel. Accueil stats are centred; "+0$" / "−0$" lost their sign; "dépassé" was removed from Accueil and Copilote.
- **Scroll twitch on Android (not confirmed fixed):** reported by the owner, not reproduced. The only change is a guard in `SwipeBackHost` `onFinalize`.

## Open questions for the owner
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
