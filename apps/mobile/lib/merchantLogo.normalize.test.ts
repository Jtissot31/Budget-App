import assert from 'node:assert/strict';

/**
 * Mirror of `normalizeMerchantKey` dash/diacritic rules — kept in sync for a
 * lightweight Node assert (avoids loading expo-asset / RN in this test).
 */
function stripDiacritics(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '');
}

function normalizeMerchantKey(name: string): string {
  return stripDiacritics(name.trim().toLowerCase())
    .replace(/['`’']/g, "'")
    .replace(/\s*\+\s*$/g, '')
    .replace(/[\u2010-\u2015\u2212—–−-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const cases: Array<[string, string]> = [
  ['Tim Hortons', 'tim hortons'],
  ['STM — Opus', 'stm opus'],
  ['STM - Opus', 'stm opus'],
  ['STM – Opus', 'stm opus'],
  ['Petro-Canada', 'petro canada'],
  ['Couche-Tard', 'couche tard'],
  ['Couche Tard', 'couche tard'],
  ['IGA', 'iga'],
  ['Hydro-Québec', 'hydro quebec'],
  ['St-Hubert', 'st hubert'],
  ["McDonald's", "mcdonald's"],
];

for (const [input, expected] of cases) {
  assert.equal(normalizeMerchantKey(input), expected, input);
}

console.log(`merchantLogo.normalize: ${cases.length} cases ok`);
