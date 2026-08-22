/**
 * Dictée vocale → brouillon de transaction.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/parseSpokenTransaction.test.ts
 */

import assert from 'node:assert/strict';
import { parseSpokenTransaction, type SpokenTransactionContext } from './parseSpokenTransaction';
import type { Category, SimulatedAccount } from '../types';

function account(partial: Partial<SimulatedAccount> & Pick<SimulatedAccount, 'id' | 'name' | 'kind'>): SimulatedAccount {
  return { balance: 0, createdAt: '2026-01-01T00:00:00.000Z', ...partial };
}

const ACCOUNTS: SimulatedAccount[] = [
  account({ id: 'acc-visa', name: 'Visa Desjardins', kind: 'credit', institution: 'Desjardins', last4: '4321' }),
  account({ id: 'acc-cheque', name: 'Compte chèque Desjardins', kind: 'checking', institution: 'Desjardins' }),
  account({ id: 'acc-epargne', name: 'Épargne Tangerine', kind: 'savings', institution: 'Tangerine' }),
];

const CATEGORIES: Category[] = [
  { id: 'cat-gas', name: 'Essence', icon: 'flame-outline', color: '#FB7185' },
  { id: 'cat-food', name: 'Épicerie', icon: 'basket-outline', color: '#34D399' },
  { id: 'cat-rest', name: 'Restaurants / cafés', icon: 'restaurant-outline', color: '#F97316' },
  { id: 'cat-health', name: 'Santé / pharmacie', icon: 'medkit-outline', color: '#34D399' },
];

const MERCHANTS = ['Petro-Canada', 'IGA', "McDonald's", 'Tim Hortons', 'Super C', 'Netflix', 'Jean Coutu'];

const CONTEXT: SpokenTransactionContext = {
  accounts: ACCOUNTS,
  categories: CATEGORIES,
  merchants: MERCHANTS,
};

// --- Phrase de référence (demande utilisateur) -------------------------------

const reference = parseSpokenTransaction(
  "je viens de mettre 50$ de gas chez petro canada avec ma carte Visa Desjardins",
  CONTEXT,
);
assert.equal(reference.type, 'expense');
assert.equal(reference.amount, 50);
assert.equal(reference.merchant, 'Petro-Canada');
assert.equal(reference.categoryId, 'cat-gas');
assert.equal(reference.accountId, 'acc-visa');
assert.equal(reference.accountLabel, 'Visa Desjardins');
assert.deepEqual(reference.missing, []);

// --- Montants ---------------------------------------------------------------

assert.equal(parseSpokenTransaction("j'ai payé 12,50$ chez Tim Hortons", CONTEXT).amount, 12.5);
assert.equal(parseSpokenTransaction('acheté pour 1 500 $ chez IGA', CONTEXT).amount, 1500);
assert.equal(parseSpokenTransaction('dépense de $75.99 chez IGA', CONTEXT).amount, 75.99);
assert.equal(parseSpokenTransaction('20 dollars et 45 cents chez IGA', CONTEXT).amount, 20.45);
assert.equal(parseSpokenTransaction("j'ai mis 50 de gas", CONTEXT).amount, 50, 'nombre nu accepté si isolé');

// Mots-nombres français
assert.equal(parseSpokenTransaction("cinquante dollars d'essence", CONTEXT).amount, 50);
assert.equal(parseSpokenTransaction('quatre-vingt-dix-neuf dollars chez IGA', CONTEXT).amount, 99);
assert.equal(parseSpokenTransaction('soixante-quinze piastres chez IGA', CONTEXT).amount, 75);
assert.equal(parseSpokenTransaction('deux cents dollars chez IGA', CONTEXT).amount, 200);
assert.equal(parseSpokenTransaction('mille dollars chez IGA', CONTEXT).amount, 1000);
assert.equal(parseSpokenTransaction('vingt dollars et cinquante cents chez IGA', CONTEXT).amount, 20.5);

// Le numéro de carte n'est jamais confondu avec le montant.
const withCardDigits = parseSpokenTransaction(
  "j'ai payé 45$ avec ma carte terminant par 4321",
  CONTEXT,
);
assert.equal(withCardDigits.amount, 45);
assert.equal(withCardDigits.accountId, 'acc-visa');

// Deux nombres nus sans devise → montant non deviné.
assert.equal(parseSpokenTransaction('2 cafés 8 muffins chez Tim Hortons', CONTEXT).amount, null);

// --- Marchands --------------------------------------------------------------

assert.equal(parseSpokenTransaction("j'ai payé 15$ chez McDonalds", CONTEXT).merchant, "McDonald's");
assert.equal(parseSpokenTransaction('30$ chez Jean Coutu', CONTEXT).merchant, 'Jean Coutu');
assert.equal(
  parseSpokenTransaction("j'ai dépensé 25$ chez Boulangerie Duc", CONTEXT).merchant,
  'Boulangerie Duc',
  'commerce hors catalogue capturé après « chez »',
);
assert.equal(parseSpokenTransaction("j'ai mis 40$ à la pharmacie", CONTEXT).merchant, 'Pharmacie');
assert.equal(parseSpokenTransaction("j'ai dépensé 20$", CONTEXT).merchant, null);
assert.equal(
  parseSpokenTransaction("50$ d'essence avec ma carte Visa Desjardins", CONTEXT).merchant,
  null,
  'la banque de la carte n’est pas un marchand',
);

// --- Catégories -------------------------------------------------------------

assert.equal(parseSpokenTransaction('20$ de gas chez Petro-Canada', CONTEXT).categoryId, 'cat-gas');
assert.equal(parseSpokenTransaction("60$ d'épicerie chez IGA", CONTEXT).categoryId, 'cat-food');
assert.equal(parseSpokenTransaction('12$ de café chez Tim Hortons', CONTEXT).categoryId, 'cat-rest');
assert.equal(parseSpokenTransaction('35$ à la pharmacie Jean Coutu', CONTEXT).categoryId, 'cat-health');

// Catégorie absente du budget de l'utilisateur → on laisse vide plutôt que d'inventer.
assert.equal(
  parseSpokenTransaction('20$ de gas chez Petro-Canada', {
    ...CONTEXT,
    categories: [CATEGORIES[1]],
  }).categoryId,
  null,
);

// --- Comptes ----------------------------------------------------------------

assert.equal(
  parseSpokenTransaction('50$ chez IGA sur mon compte chèque Desjardins', CONTEXT).accountId,
  'acc-cheque',
);
assert.equal(
  parseSpokenTransaction('50$ chez IGA avec ma carte', CONTEXT).accountId,
  null,
  'indice trop vague → aucun compte deviné',
);
assert.equal(parseSpokenTransaction('50$ chez IGA', CONTEXT).accountId, null);

// Aucun compte enregistré → repli sur le sélecteur manuel du formulaire.
assert.equal(
  parseSpokenTransaction('50$ chez IGA avec ma carte de crédit', { ...CONTEXT, accounts: [] }).accountId,
  'credit',
);

// --- Dépense vs revenu ------------------------------------------------------

const paie = parseSpokenTransaction(
  "j'ai reçu ma paie de 1500$ dans mon compte chèque Desjardins",
  CONTEXT,
);
assert.equal(paie.type, 'income');
assert.equal(paie.amount, 1500);
assert.equal(paie.accountId, 'acc-cheque');
assert.equal(paie.categoryId, null, 'un revenu ne prend pas de catégorie de budget');

assert.equal(parseSpokenTransaction("on m'a remboursé 20$", CONTEXT).type, 'income');
assert.equal(parseSpokenTransaction("j'ai été payé par mon employeur 800$", CONTEXT).type, 'income');
assert.equal(parseSpokenTransaction("j'ai payé 50$ chez IGA", CONTEXT).type, 'expense');
assert.equal(
  parseSpokenTransaction("j'ai un reçu de 40$ chez IGA", CONTEXT).type,
  'expense',
  '« un reçu » (le papier) reste une dépense',
);

// --- Entrées incomplètes / invalides ---------------------------------------

const empty = parseSpokenTransaction('   ', CONTEXT);
assert.equal(empty.transcript, '');
assert.equal(empty.amount, null);
assert.equal(empty.merchant, null);
assert.deepEqual(empty.missing, ['amount', 'merchant', 'category', 'account']);

const gibberish = parseSpokenTransaction('euh bonjour comment ça va', CONTEXT);
assert.equal(gibberish.amount, null);
assert.equal(gibberish.categoryId, null);
assert.deepEqual(gibberish.missing, ['amount', 'merchant', 'category', 'account']);

// Contexte vide : ne jamais planter ni inventer de valeurs.
const noContext = parseSpokenTransaction('50$ de gas chez Petro-Canada');
assert.equal(noContext.amount, 50);
assert.equal(noContext.merchant, 'Petro Canada');
assert.equal(noContext.categoryId, null);
assert.equal(noContext.accountId, null);

console.log('parseSpokenTransaction: OK');
