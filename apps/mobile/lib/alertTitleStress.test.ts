/**
 * Alert title stress-word segments.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/alertTitleStress.test.ts
 */

import assert from 'node:assert/strict';
import { splitAlertTitleStressSegments } from './alertTitleStress';

assert.deepEqual(splitAlertTitleStressSegments('Marge insuffisante'), [
  { text: 'Marge ', stress: false },
  { text: 'insuffisante', stress: true },
]);

assert.deepEqual(
  splitAlertTitleStressSegments('La marge approche dangereusement la limite'),
  [
    { text: 'La marge approche ', stress: false },
    { text: 'dangereusement', stress: true },
    { text: ' la limite', stress: false },
  ],
);

assert.deepEqual(splitAlertTitleStressSegments('Marge de crédit dépassée'), [
  { text: 'Marge de crédit ', stress: false },
  { text: 'dépassée', stress: true },
]);

// Legacy prefixed titles still stress « insuffisante » if shown before normalize.
assert.deepEqual(splitAlertTitleStressSegments('Abonnement cloud : marge insuffisante'), [
  { text: 'Abonnement cloud : marge ', stress: false },
  { text: 'insuffisante', stress: true },
]);

assert.deepEqual(splitAlertTitleStressSegments('Budget Épicerie dépassé'), [
  { text: 'Budget Épicerie ', stress: false },
  { text: 'dépassé', stress: true },
]);

// Legacy titles with overrun amount: only « dépassé » is stressed (amount is plain).
assert.deepEqual(splitAlertTitleStressSegments('Budget Épicerie dépassé de 324,95$'), [
  { text: 'Budget Épicerie ', stress: false },
  { text: 'dépassé', stress: true },
  { text: ' de 324,95$', stress: false },
]);

assert.deepEqual(splitAlertTitleStressSegments('Prêt auto : taux élevé'), [
  { text: 'Prêt auto : taux ', stress: false },
  { text: 'élevé', stress: true },
]);

assert.deepEqual(splitAlertTitleStressSegments('Compte chèque : solde bas'), [
  { text: 'Compte chèque : solde ', stress: false },
  { text: 'bas', stress: true },
]);

assert.deepEqual(splitAlertTitleStressSegments('Risque de dépassement de marge'), [
  { text: 'Risque de dépassement de marge', stress: false },
]);

console.log('alertTitleStress.test.ts: ok');
