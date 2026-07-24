import assert from 'node:assert/strict';

/**
 * Lightweight contract tests for plan adaptation confirm-first flow.
 * Detection against live DB is covered by integration; here we lock the API surface.
 */
import {
  acceptPlanAdaptation,
  dismissPlanAdaptation,
  getPlanAdaptationProposal,
} from './planAdaptationProposals';

async function main() {
  const missing = await getPlanAdaptationProposal('adapt-does-not-exist');
  assert.equal(missing, null);

  const acceptMissing = await acceptPlanAdaptation('adapt-does-not-exist');
  assert.equal(acceptMissing.ok, false);
  assert.match(acceptMissing.message, /plus disponible/i);

  const dismissMissing = await dismissPlanAdaptation('adapt-does-not-exist');
  assert.equal(dismissMissing.ok, false);

  console.log('planAdaptationProposals.test.ts: ok');
}

void main();
