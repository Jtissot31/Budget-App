import assert from 'node:assert/strict';
import {
  buildCreateBudgetCategoryAction,
  isBudgetCategoryMutationRequest,
  parseCreateBudgetCategoryIntent,
} from './localBudgetCategoryIntent';
import { detectFynChartIntents } from './fynChartWidgets';

const gasIntent = parseCreateBudgetCategoryIntent(
  'crée une categorie de budget gas 60$ par mois',
);
assert.ok(gasIntent);
assert.equal(gasIntent?.name, 'Essence');
assert.equal(gasIntent?.monthlyLimit, 60);

const restaurantIntent = parseCreateBudgetCategoryIntent(
  'Ajouter une catégorie Restaurants 400 $/mois',
);
assert.ok(restaurantIntent);
assert.equal(restaurantIntent?.name, 'Restaurants');
assert.equal(restaurantIntent?.monthlyLimit, 400);

const englishIntent = parseCreateBudgetCategoryIntent('create budget category coffee $25 per month');
assert.ok(englishIntent);
assert.equal(englishIntent?.name, 'Coffee');
assert.equal(englishIntent?.monthlyLimit, 25);

assert.equal(parseCreateBudgetCategoryIntent('montre mon budget'), null);
assert.equal(parseCreateBudgetCategoryIntent('crée une catégorie essence'), null);

assert.equal(isBudgetCategoryMutationRequest('crée une categorie de budget gas 60$ par mois'), true);
assert.equal(isBudgetCategoryMutationRequest('montre mon budget ce mois'), false);

assert.deepEqual(
  detectFynChartIntents('crée une categorie de budget gas 60$ par mois'),
  [],
  'create-category must not trigger budget overview widgets',
);
assert.ok(detectFynChartIntents('montre mon budget').includes('budget_vs_actual'));

const action = buildCreateBudgetCategoryAction(gasIntent!);
assert.equal(action.action, 'creer_categorie_budget');
assert.equal(action.status, 'pending');
assert.match(action.confirmation, /Essence/);

console.log('localBudgetCategoryIntent.test.ts: ok');
