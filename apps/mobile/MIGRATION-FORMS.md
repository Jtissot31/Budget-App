# Migration formulaires (expo-router)

Les fichiers `app/recurring-payments.tsx` et `app/savings-goals.tsx` ne doivent **pas** rester des routes Expo (~2800 lignes).

## Une commande

Dans le terminal intégré Cursor/VS Code (`apps/mobile`) :

```powershell
cd C:\Users\emime\projects\BudgetTracker\apps\mobile
npm run move-forms
npx tsc --noEmit
npx expo start --clear
```

Ou double-clic sur `RUN-MIGRATION.bat`.

## Après migration

- `components/RecurringPaymentsForm.tsx` — code complet
- `components/SavingsGoalsForm.tsx` — code complet
- `app/recurring-payments.tsx` — **supprimé**
- `app/savings-goals.tsx` — **supprimé**
- Imports via `@/lib/recurringPaymentsForm` et `@/lib/savingsGoalsForm` (inchangés)

## Logs Metro

Au démarrage vous devriez voir :

```
[Boot] layout mount
[Boot] bootstrap timer start 500 ms
[Boot] bootstrap done — showing Stack
```

Si PowerShell n’affiche rien :

```powershell
npx expo start --clear 2>&1 | Tee-Object -FilePath expo.log
Get-Content expo.log -Tail 80
```
