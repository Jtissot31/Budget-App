import assert from 'node:assert/strict';
import { extraToMonthly, projectDebtPayoff, type DebtPayoffInput } from './debtPayoffMath';

const debt: DebtPayoffInput = {
  id: 'visa',
  balance: 2_400,
  annualRatePercent: 19.99,
  minimumMonthly: 75,
};

const minimumsOnly = projectDebtPayoff([debt], 'avalanche', 0);
assert.equal(minimumsOnly.reachable, true);
assert.ok(minimumsOnly.monthsToDebtFree > 0);

const monthlyExtra = projectDebtPayoff([debt], 'avalanche', extraToMonthly(100, 'month'));
assert.equal(monthlyExtra.reachable, true);
assert.ok(monthlyExtra.monthsToDebtFree < minimumsOnly.monthsToDebtFree);

const weeklyMonthlyEquivalent = extraToMonthly(30, 'week');
assert.equal(weeklyMonthlyEquivalent, 130);
const weeklyExtra = projectDebtPayoff([debt], 'avalanche', weeklyMonthlyEquivalent);
assert.equal(weeklyExtra.reachable, true);
assert.ok(weeklyExtra.monthsToDebtFree < monthlyExtra.monthsToDebtFree);

const nonAmortizing = projectDebtPayoff(
  [
    {
      id: 'high-interest',
      balance: 1_000,
      annualRatePercent: 24,
      minimumMonthly: 10,
    },
  ],
  'snowball',
  0,
);
assert.equal(nonAmortizing.reachable, false);

console.log('debtPayoffMath.test.ts: ok');
