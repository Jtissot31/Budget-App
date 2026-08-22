/**
 * Alert anti-spam guardrails: re-raise cooldown + per-type cap.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/alertGuardrails.test.ts
 */

import assert from 'node:assert/strict';
import type { AlertKindKey } from './alertIdentity';
import {
  ALERT_MAX_CONCURRENT,
  ALERT_RERAISE_COOLDOWN_MS,
  capAlertsPerType,
  decideAlertRaise,
  hasMateriallyWorsened,
} from './alertGuardrails';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date('2026-08-10T09:00:00.000Z');
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();

// No stored row for this identity yet.
assert.equal(decideAlertRaise({ type: 'budget_over', now, existing: null }), 'insert');

// Already unread in the list — refresh the copy, never bump it back to the top.
assert.equal(
  decideAlertRaise({
    type: 'balance_low',
    now,
    existing: { lu: false, createdAt: at(-30 * DAY_MS), raisedAt: at(-30 * DAY_MS) },
  }),
  'update',
);

// Read + inside the cooldown → stays quiet.
assert.equal(
  decideAlertRaise({
    type: 'balance_low',
    now,
    existing: { lu: true, createdAt: at(-2 * 60 * 60 * 1000), raisedAt: at(-2 * 60 * 60 * 1000) },
  }),
  'update',
);

// Read + cooldown elapsed → surfaced again.
assert.equal(
  decideAlertRaise({
    type: 'balance_low',
    now,
    existing: { lu: true, createdAt: at(-25 * 60 * 60 * 1000), raisedAt: at(-25 * 60 * 60 * 1000) },
  }),
  'reraise',
);

// A budget overrun stays a once-per-month event even after being read.
assert.equal(
  decideAlertRaise({
    type: 'budget_over',
    now,
    existing: {
      lu: true,
      createdAt: at(-10 * DAY_MS),
      raisedAt: at(-10 * DAY_MS),
      raisedMontant: 40,
    },
    montant: 48,
  }),
  'update',
);

// …unless the overrun grows materially (≥ 1.5× and ≥ 25 $).
assert.equal(
  decideAlertRaise({
    type: 'budget_over',
    now,
    existing: {
      lu: true,
      createdAt: at(-10 * DAY_MS),
      raisedAt: at(-10 * DAY_MS),
      raisedMontant: 40,
    },
    montant: 120,
  }),
  'reraise',
);

// Falls back to createdAt when a legacy row has no raisedAt.
assert.equal(
  decideAlertRaise({ type: 'fyn', now, existing: { lu: true, createdAt: at(-3 * DAY_MS) } }),
  'reraise',
);

assert.equal(hasMateriallyWorsened(40, 120), true);
assert.equal(hasMateriallyWorsened(40, 48), false);
assert.equal(hasMateriallyWorsened(1, 20), false, 'small absolute growth is not worth a re-raise');
assert.equal(hasMateriallyWorsened(0, 30), true);
assert.equal(hasMateriallyWorsened(null, 300), false);
assert.equal(hasMateriallyWorsened(-40, -120), true, 'signed amounts compare by magnitude');

assert.equal(ALERT_RERAISE_COOLDOWN_MS.balance_low, DAY_MS);
assert.equal(ALERT_RERAISE_COOLDOWN_MS.budget_over, 31 * DAY_MS);
assert.equal(ALERT_MAX_CONCURRENT.budget_over, 3);

// Cap: beyond the limit, the overflow collapses into one aggregate placed where it started.
type Row = { id: string; type: AlertKindKey };
const rows: Row[] = [
  { id: 'b1', type: 'budget_over' },
  { id: 'b2', type: 'budget_over' },
  { id: 'c1', type: 'credit_limit' },
  { id: 'b3', type: 'budget_over' },
  { id: 'b4', type: 'budget_over' },
  { id: 'b5', type: 'budget_over' },
];

const capped = capAlertsPerType(rows, {
  typeOf: (row) => row.type,
  aggregate: (type, hidden) => ({ id: `aggregate-${type}-${hidden.length}`, type }),
});
assert.deepEqual(
  capped.map((row) => row.id),
  ['b1', 'b2', 'c1', 'b3', 'aggregate-budget_over-2'],
);

// Under the cap, nothing is added.
assert.deepEqual(
  capAlertsPerType(rows.slice(0, 3), {
    typeOf: (row) => row.type,
    aggregate: () => ({ id: 'aggregate', type: 'budget_over' as AlertKindKey }),
  }).map((row) => row.id),
  ['b1', 'b2', 'c1'],
);

// Untyped rows are never capped.
assert.equal(
  capAlertsPerType(rows, { typeOf: () => null, aggregate: () => null }).length,
  rows.length,
);

// An aggregate builder returning null simply drops the overflow.
assert.deepEqual(
  capAlertsPerType(rows, {
    typeOf: (row) => row.type,
    aggregate: () => null,
    maxPerType: { budget_over: 1 },
  }).map((row) => row.id),
  ['b1', 'c1'],
);

console.log('alertGuardrails tests passed');
