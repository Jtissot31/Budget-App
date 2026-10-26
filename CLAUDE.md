# Budget-OX: notes for coding agents

Personal budget app. The real product is **`apps/mobile`** (Expo / React Native, offline-first SQLite). The .NET API in `src/` is optional and mostly untouched. The whole UI is **in French**.

**Before starting, read [`apps/mobile/docs/NEXT_STEPS.md`](apps/mobile/docs/NEXT_STEPS.md).** It lists where work stopped, what's half-done and what to do next.

## Run it
```bash
cd apps/mobile
npm install
npm start               # Expo Go, LAN
npm start -- --tunnel   # Expo Go through a tunnel (phone off the Wi-Fi)
```
- The owner tests on an **Android phone with Expo Go**. The web preview (`localhost:8081`) hides Android layout bugs, so it isn't proof that something works.
- On SDK 58 the tunnel URL looks like `exp://<id>.on.expo.app` and is printed under the QR code. It takes about a minute to appear. If the tunnel fails, fall back to LAN mode and give the owner `exp://<PC LAN IP>:8081`.
- Start Metro somewhere it keeps running, such as a terminal tab. Background shells get killed when the agent's turn ends.

## Checks
- `npx tsc --noEmit -p apps/mobile` has **about 165 errors that were already there**. Most come from the React Native 0.88 ref types (`focus`/`blur`/`measureLayout` "does not exist") and `node:assert` in `*.test.ts`. Don't add new errors in the files you touch.
- Unit tests are plain `node:assert` files next to the code (`lib/**/*.test.ts`).

## Design rules (from the owner, keep them)
- **Reference style:** the Transactions tab and the transaction detail pages. Match them everywhere: minimal, premium, Wealthsimple-like. Reuse `components/kit` (FitText, ListCard/ListRow, PressScale, Reveal, charts) rather than inventing new card styles. Don't restyle the Transactions pages themselves.
- **Vivid colours, calm by restraint.** No pastel or washed-out palettes. Put colour only on rings, bars and short labels, never on headline amounts.
- **Encouraging tone.** No alarm-red, "urgent" or "dépassé" on Accueil or Copilote. Use green for good news and amber for attention, and celebrate wins.
- **Primary buttons** are neutral pills (theme text colour on background), not brand green (`components/PrimarySaveButton.tsx`).
- **Liquid glass** = `components/kit/GlassLens.tsx`, a snapshot lens. No live blur, no white rims.
- **Android pitfalls:**
  - Don't put fill, border or flexDirection in a `Pressable` style *function*. Put them on an inner `View`.
  - Use `flexShrink`, not `flex: 1`, on texts inside rows.
  - Use measured whole-pixel widths, not `%`, for grids.
  - Avoid negative `letterSpacing` with bold custom fonts; Android clips the last glyph.
  - Give small text an explicit `lineHeight`.
- Never let text crop. Test at 320 px width and with a large Android font scale.
