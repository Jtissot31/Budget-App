# Mobile app — agent instructions



## Dev server (Metro) — user-managed



- **Do not** run `npm start`, `npx expo start`, or open a Cursor terminal to start Metro unless the user **explicitly asks** to start or restart the dev server.

- Assume Metro is already running on port **8081** (user starts it in their own terminal).

- If asked to start Metro: `npm start` from `apps/mobile` only (uses `BROWSER=none` — no Edge auto-open).

- **Never** auto-open `localhost:8081` in Cursor browser unless the user explicitly asks.



## UI reference screenshots

Do NOT delete `ref-ui-*.png` or `verify-s25-*.png` in apps/mobile — kept for budget rebuild design reference.

