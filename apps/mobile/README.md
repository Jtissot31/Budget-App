# Budget Tracker — App mobile Expo

## Démarrage rapide

```bash
npm install
npx expo start
```

Installez **Expo Go** sur votre téléphone et scannez le QR code.

## Hors ligne

Les données sont stockées dans **SQLite** sur l’appareil. Aucune connexion requise pour consulter ou ajouter des transactions.

## Mode développement (données démo)

En build **`__DEV__`** (Expo Go, simulateur, `expo start --web`), l’app partage le même jeu de données fictives sur **web, iOS et Android** :

- Comptes alignés sur `DASHBOARD_ACCOUNTS` (Desjardins, épargne, Visa, argent comptant)
- ~**170 transactions** sur **12 semaines** (Historique non vide au premier lancement)
- Au démarrage, si Historique a **moins de 50 lignes visibles** (base native corrompue, lignes orphelines, seed partiel), les transactions sont **effacées et resemées** automatiquement — **sans désinstaller l’app**
- Les soldes des comptes démo sont remis aux valeurs initiales lors d’un reseed

En production (`__DEV__` = false), le seed ne s’exécute que lorsque Historique est **totalement vide**.

## Sync API

1. Lancez `src/BudgetTracker.Api` avec `dotnet run`
2. Dans l’app : **Plus** → désactivez **Mode démo**
3. URL : IP de votre PC + port (pas `localhost` sur téléphone réel)
4. **Synchroniser maintenant**
