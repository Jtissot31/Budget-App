# Budget-OX

A personal finance app for tracking budgets, transactions, accounts, net worth and financial plans. It is built with **Expo (React Native)** for Android, iOS and web, and keeps all data **offline-first in SQLite** on the device. An optional **ASP.NET Core (.NET 10)** API is available for sync.

The interface is in **French**.

---

## Quick start: run the Expo dev server

```bash
cd apps/mobile
npm install
npm start
```

Scan the QR code with **Expo Go** on your phone (Android: Expo Go app; iOS: Camera app or Expo Go).
Inside the Metro terminal:

| Key | Action |
|-----|--------|
| `a` | Open on an Android emulator / connected device |
| `i` | Open on the iOS simulator (macOS only) |
| `w` | Open in the web browser |
| `r` | Reload the app |

> `npm start` always targets **Expo Go** (`--go`), even though `expo-dev-client` is installed. If Expo Go opens an old project, close it in Expo Go's recents, or clear the cache with `npm start -- --clear`.

### All mobile scripts (`apps/mobile`)

| Command | What it does |
|---------|--------------|
| `npm start` / `npm run start:go` | Metro server targeting Expo Go (default) |
| `npm run start:dev-client` | Metro server for a custom dev client / prebuild |
| `npm run android` / `npm run ios` | Start Metro and open on Android / iOS |
| `npm run web` | Start Metro for the web preview |
| `npm run run:android` / `npm run run:ios` | Local native build (`expo run:*`) |
| `npm run prebuild` / `npm run prebuild:clean` | Generate the native `android/` / `ios/` folders |
| `npm run lint` | ESLint (`expo lint`) |

---

## Features

The bottom navigation bar has five tabs, plus settings:

| Tab | Description |
|-----|-------------|
| **Accueil** (Home) | Today card, account balances, upcoming payments, budget summary, paycheck allocation widget, AI insights |
| **Activité** (Activity) | Transaction list with search, filters and month selector; insights by merchant and category; voice entry |
| **Budget** | Monthly budget by category with a donut chart, per-category detail sheets, overrun alerts and insights |
| **Agenda** | Calendar of upcoming bills, recurring payments and paychecks, with a projected cash balance |
| **Wallet** | Bank accounts, credit cards, lines of credit, loans and mortgages, plus net worth (**Patrimoine**): stocks, real estate and other assets |
| **Settings** | Theme (light / dark), profile, region, AI API keys, alert preferences, demo data |

Other features:

- **Add transactions** manually (expense, income, transfer) with a numpad, category picker, merchant logos, itemized receipts and payment methods.
- **Voice transactions**: describe a transaction out loud and it is parsed into a draft.
- **Receipt scanning and storage**, plus a **documents library**.
- **Savings goals** with progress tracking, projections and deposit history.
- **Financial plans**: debt payoff and savings plans with recommendations and timelines.
- **Loans and mortgages**: amortization, repayment progress and utilization charts.
- **Stock portfolio**: holdings, per-ticker detail and portfolio charts.
- **Alert center**: credit-limit warnings, insufficient funds, budget overruns and upcoming payments, with per-type preferences.
- **Subscriptions insights**: detects recurring charges.
- **AI assistant (Fyn / copilot)**: financial insights and alert explanations using Gemini or Anthropic. Data is sanitized before it is sent.
- **Onboarding** flow for first launch.
- **Offline-first**: everything works without network access; only AI features need a connection.

---

## Project structure

```
BudgetTracker/
├── apps/mobile/                 ← Expo app (main app)
│   ├── app/                     ← Screens (expo-router, file-based routing)
│   │   └── (tabs)/              ← Bottom tab screens
│   ├── components/              ← UI components (kit/, budget/, wallet/, dashboard/, ...)
│   ├── constants/               ← Theme tokens, fonts
│   ├── lib/                     ← Business logic, SQLite (db.ts), seed data, AI (lib/ai), plans (lib/plans)
│   ├── modules/samsung-liquid-glass/  ← Local native module (nav bar glass effect)
│   ├── app.json / app.config.js ← Expo config
│   └── eas.json                 ← EAS build profiles
├── src/BudgetTracker.Api/       ← .NET 10 API (minimal, for sync)
└── src/BudgetTracker.Mobile/    ← Legacy MAUI app (no longer maintained)
```

### Tech stack

- Expo SDK 57, React Native 0.86, React 19, TypeScript
- expo-router (navigation), expo-sqlite (local database)
- NativeWind / Tailwind + react-native-reusables (UI primitives)
- react-native-reanimated, Moti, gesture-handler (animations and gestures)
- react-native-svg and Skia (charts)
- Lucide and Material Design icons, Plus Jakarta Sans / Inter / DM Mono fonts

---

## Configuration

Create `apps/mobile/.env` (it is git-ignored):

```env
# AI features (optional; keys can also be entered in Settings)
EXPO_PUBLIC_GEMINI_API_KEY=
EXPO_PUBLIC_ANTHROPIC_API_KEY=

# Demo data: on by default in __DEV__ (Expo Go), forced off in EAS builds
EXPO_PUBLIC_SEED_DEMO=
EXPO_PUBLIC_USE_MOCK_DATA=
```

> `EXPO_PUBLIC_*` values are bundled into the app, so never put production secrets in them.

---

## Building an APK (EAS)

```bash
cd apps/mobile
npx eas build -p android --profile preview      # standalone release APK
npx eas build -p android --profile development  # dev-client APK
npx eas build -p android --profile production   # Play Store app bundle (.aab)
```

All EAS profiles turn off demo seed data and mock data.

---

## Optional: .NET API

```bash
cd src/BudgetTracker.Api
dotnet run
```

The API listens on `https://localhost:7080` and `http://localhost:5080`. It currently exposes stub endpoints:

- `GET /api/dashboard`
- `GET /api/transactions`
- `GET /api/budgets`
- `GET /api/categories`
- `POST /api/transactions`

> On a physical phone, `localhost` doesn't work: use your PC's LAN IP (for example `http://192.168.1.10:5080`).

---

## Important notes

- **Metro runs on port 8081.** Only one Metro instance should be running at a time.
- **The web preview can hide Android layout bugs.** For example, `Pressable` style functions and `flex: 1` text can render differently on a device, so always check UI changes on a real Android phone.
- **Native module:** `samsung-liquid-glass` is a local module. Its native effect only works in a dev client or native build, not in Expo Go.
- **Design reference:** the Transactions screens are the reference style for the rest of the app. Design reference screenshots (`ref-ui-*.png`, `verify-s25-*.png`) in `apps/mobile` are kept on purpose.
- **Tests:** unit tests live next to the code as `lib/**/*.test.ts`.
