# Budget Tracker — App mobile Expo

## Démarrage rapide

```bash
npm install
npx expo start
```

Installez **Expo Go** sur votre téléphone et scannez le QR code.

## Hors ligne

Les données sont stockées dans **SQLite** sur l’appareil. Aucune connexion requise pour consulter ou ajouter des transactions.

## Sync API

1. Lancez `src/BudgetTracker.Api` avec `dotnet run`
2. Dans l’app : **Plus** → désactivez **Mode démo**
3. URL : IP de votre PC + port (pas `localhost` sur téléphone réel)
4. **Synchroniser maintenant**
