/**
 * Month / month-range filtering used by the Documents library toolbar.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/monthRangeFilter.test.ts
 */

import assert from 'node:assert/strict';
import {
  addMonthsToKey,
  dateWithinMonthRange,
  filterByMonthRange,
  formatMonthRangeLabel,
  getLocalMonthKey,
  isMonthKey,
  isSingleMonthRange,
  monthKeyWithinRange,
  normalizeMonthRange,
} from './monthRangeFilter';

assert.equal(isMonthKey('2026-08'), true);
assert.equal(isMonthKey('2026-13'), false);
assert.equal(isMonthKey('2026-08-10'), false);

// Date-only strings must not drift to the previous month in negative UTC offsets.
assert.equal(getLocalMonthKey('2026-08-01'), '2026-08');
assert.equal(getLocalMonthKey('2026-12-31'), '2026-12');
assert.equal(getLocalMonthKey('2026-08-10T14:30:00.000Z'), '2026-08');

assert.equal(addMonthsToKey('2026-12', 1), '2027-01');
assert.equal(addMonthsToKey('2026-01', -1), '2025-12');

// Endpoints tapped in reverse order still produce a forward range.
assert.deepEqual(normalizeMonthRange('2026-08', '2026-03'), {
  start: '2026-03',
  end: '2026-08',
});
assert.equal(isSingleMonthRange({ start: '2026-08', end: '2026-08' }), true);
assert.equal(isSingleMonthRange({ start: '2026-03', end: '2026-08' }), false);
assert.equal(isSingleMonthRange(null), false);

const range = { start: '2026-03', end: '2026-08' };
assert.equal(monthKeyWithinRange('2026-03', range), true);
assert.equal(monthKeyWithinRange('2026-08', range), true);
assert.equal(monthKeyWithinRange('2026-05', range), true);
assert.equal(monthKeyWithinRange('2026-02', range), false);
assert.equal(monthKeyWithinRange('2026-09', range), false);
assert.equal(monthKeyWithinRange('2025-12', null), true);

assert.equal(dateWithinMonthRange('2026-03-01', range), true);
assert.equal(dateWithinMonthRange('2026-02-28', range), false);

const docs = [
  { id: 'a', date: '2026-08-10' },
  { id: 'b', date: '2026-05-02' },
  { id: 'c', date: '2025-11-20' },
];
assert.deepEqual(
  filterByMonthRange(docs, { start: '2026-05', end: '2026-08' }).map((d) => d.id),
  ['a', 'b'],
);
assert.deepEqual(filterByMonthRange(docs, null).map((d) => d.id), ['a', 'b', 'c']);
assert.deepEqual(
  filterByMonthRange(docs, { start: '2025-11', end: '2025-11' }).map((d) => d.id),
  ['c'],
);

assert.equal(formatMonthRangeLabel(null), 'Tous les mois');
assert.equal(formatMonthRangeLabel({ start: '2026-08', end: '2026-08' }), 'Août 2026');
assert.equal(
  formatMonthRangeLabel({ start: '2026-03', end: '2026-08' }),
  'Mars – Août 2026',
);
assert.match(formatMonthRangeLabel({ start: '2025-11', end: '2026-02' }), /2025 – .*2026$/);

console.log('monthRangeFilter tests passed');
