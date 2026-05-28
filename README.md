# Budget Tracker

Application de suivi de budget — **Expo (React Native)** pour Android/iOS + **API ASP.NET Core .NET 10**.

## Structure

```
BudgetTracker/
├── apps/mobile/          ← App Expo (UI + SQLite hors ligne)
└── src/BudgetTracker.Api ← API .NET 10
```

> L’ancien projet MAUI (`src/BudgetTracker.Mobile`) est conservé mais **n’est plus la app principale**.

## Prérequis

- [Node.js 20+](https://nodejs.org/)
- [Expo Go](https://expo.dev/go) sur votre téléphone (le plus simple avec l’IA)
- [.NET 10 SDK](https://dotnet.microsoft.com/download) pour l’API

## Lancer l’app mobile (Expo)

```bash
cd apps/mobile
npm install
npx expo start
```

Scannez le QR code avec **Expo Go** (Android) ou l’app Appareil photo / Expo Go (iOS).

- **Android émulateur :** touche `a` dans le terminal Expo  
- **iOS simulateur (Mac) :** touche `i`

## Lancer l’API .NET 10

```bash
cd src/BudgetTracker.Api
dotnet run
```

URL par défaut : `https://localhost:7080`

Dans l’app → onglet **Plus** → désactivez **Mode démo** → entrez l’URL de l’API → **Synchroniser**.

> Sur téléphone physique, `localhost` ne fonctionne pas : utilisez l’IP de votre PC (ex. `http://192.168.1.10:5080`).

## Fonctionnalités

| Écran | Description |
|-------|-------------|
| Accueil | Solde, budget mensuel, catégories, transactions récentes |
| Transactions | Liste + recherche (SQLite local) |
| Budgets | Limites par catégorie |
| **+** | Ajouter une dépense ou un revenu |
| Plus | URL API, mode démo, synchronisation |

**Hors ligne :** toutes les données sont dans SQLite sur le téléphone. La sync envoie les transactions « en attente » vers l’API quand le réseau est disponible.

## Endpoints API attendus

- `GET /api/dashboard`
- `GET /api/transactions?search=`
- `GET /api/budgets`
- `GET /api/categories`
- `POST /api/transactions`

## Travailler avec l’IA seulement

Décrivez les changements en français, une fonctionnalité à la fois, par exemple :

> « Ajoute un graphique en camembert des dépenses par catégorie sur l’écran d’accueil »
