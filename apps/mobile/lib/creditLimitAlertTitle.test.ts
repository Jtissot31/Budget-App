/**
 * Credit-limit alert title thresholds.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/creditLimitAlertTitle.test.ts
 */

import assert from 'node:assert/strict';
import {
  buildCreditLimitAlertReason,
  CREDIT_LIMIT_ALERT_REASONS,
  isCreditLimitExceededTitle,
  parseUtilizationPctFromMessage,
} from './creditLimitAlertCopy';

assert.equal(isCreditLimitExceededTitle(91), false);
assert.equal(isCreditLimitExceededTitle(98), false);
assert.equal(isCreditLimitExceededTitle(98.4), false);
assert.equal(isCreditLimitExceededTitle(98.5), true); // rounds to 99
assert.equal(isCreditLimitExceededTitle(99), true);
assert.equal(isCreditLimitExceededTitle(100), true);
assert.equal(isCreditLimitExceededTitle(100, true), true);
assert.equal(isCreditLimitExceededTitle(50, true), true);
assert.equal(isCreditLimitExceededTitle(null), false);

assert.equal(buildCreditLimitAlertReason(undefined, 91), CREDIT_LIMIT_ALERT_REASONS.approaching);
assert.equal(buildCreditLimitAlertReason(undefined, 98), CREDIT_LIMIT_ALERT_REASONS.approaching);
assert.equal(buildCreditLimitAlertReason(undefined, 99), CREDIT_LIMIT_ALERT_REASONS.exceeded);
assert.equal(buildCreditLimitAlertReason(undefined, 80, true), CREDIT_LIMIT_ALERT_REASONS.exceeded);

assert.equal(
  parseUtilizationPctFromMessage(
    'Après le paiement de 450,00 $, environ 91 % de la limite sera utilisée.',
  ),
  91,
);
assert.equal(
  parseUtilizationPctFromMessage(
    'Après le paiement de 450,00 $, la limite de crédit serait dépassée.',
  ),
  null,
);

console.log('creditLimitAlertTitle.test.ts: ok');
