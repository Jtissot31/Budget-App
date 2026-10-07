# Budget Tracker — App mobile Expo

## Démarrage rapide (Expo Go)

```powershell
cd apps/mobile
npm install
npm start
```

`npm start` force **Expo Go** (`--go`) même si `expo-dev-client` est installé.
Scanne le QR avec **Expo Go** (pas un ancien APK / prebuild).

| Script | Cible |
|--------|--------|
| `npm start` / `npm run start:go` | Expo Go (JS courant) |
| `npm run start:dev-client` | Dev client / prebuild (`exp+budget-tracker://`) |
| `npm run run:android` | Build natif local (`android/`) — séparé de Go |

Si Expo Go ouvre encore un vieux projet : ferme le projet récent dans Expo Go, ou `npm start -- --clear`.

## Shell Luna (MVP)

Au lancement, l’app ouvre **`/luna-shell`** (drawer finance + chat Fyn).
Les hubs SQLite (comptes, budget, transactions, épargne) restent accessibles via le menu hamburger.
UI Luna = **react-native-reusables** (shadcn-RN) + NativeWind — pas de shadcn DOM / Next.js.

## Hors ligne

Les données métier sont dans **SQLite**. Le chat Fyn (IA) est gated hors ligne ; les hubs finance fonctionnent sans Wi‑Fi.

## Mode développement (données démo)

En build **`__DEV__`** (Expo Go, simulateur), seed démo partagé — voir historique du projet pour détails.
