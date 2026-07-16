# Mobile app — agent instructions



## Dev server (Metro) — user-managed



- **Do not** run `npm start`, `npx expo start`, or open a Cursor terminal to start Metro unless the user **explicitly asks** to start or restart the dev server.

- Assume Metro is already running on port **8081** (user starts it in their own terminal).

- If asked to start Metro: `npm start` from `apps/mobile` only (uses `BROWSER=none` — no Edge auto-open).

- **Never** auto-open `localhost:8081` in Cursor browser unless the user explicitly asks.



## UI reference screenshots

Do NOT delete `ref-ui-*.png` or `verify-s25-*.png` in apps/mobile — kept for budget rebuild design reference.

## Default card container (design tokens)

**Canonical shell** for patrimoine tiles, plan cards, and new interactive list/grid rows:
`PlanFinanceContainer` (`components/plans/PlanFinanceContainer.tsx`).

- Tokens: `PLAN_FINANCE_CONTAINER`, `planFinanceCardHalo`, `planFinanceContainerShellStyle`,
  `planFinanceContainerRowLayoutStyle`, `planFinanceContainerCompactTilePaddingStyle`,
  `planFinanceContainerPressedStyle` — all in `constants/planFinanceKit.ts`
- Fill/outline: `colors.containerBackground` + `colors.containerBorder` (theme-aware)
- Pressed: opacity `0.82` on outer `Pressable`
- Dashboard / alert surfaces without halo: `containerSurfaceStyle()` in `constants/theme.ts`

See `.cursor/rules/plan-finance-container.mdc` for agent usage patterns.

