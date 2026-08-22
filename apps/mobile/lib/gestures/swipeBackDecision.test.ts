/**
 * Axis-dominance rules for the app-wide swipe-back gesture.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/gestures/swipeBackDecision.test.ts
 */

import assert from 'node:assert/strict';
import {
  SWIPE_BACK_ACTIVATION_DX,
  SWIPE_BACK_COMMIT_DX,
  SWIPE_BACK_COMMIT_VELOCITY,
  SWIPE_BACK_DEBOUNCE_MS,
  SWIPE_BACK_VERTICAL_ABORT_DY,
  consumeSwipeBackNavigationSlot,
  isSwipeBackBlockedPath,
  resetSwipeBackNavigationSlot,
  resolveSwipeBackDecision,
  shouldCommitSwipeBack,
} from './swipeBackDecision';

// --- Rightward, horizontally dominant → activate ---
assert.equal(resolveSwipeBackDecision(20, 0), 'activate');
assert.equal(resolveSwipeBackDecision(SWIPE_BACK_ACTIVATION_DX, 0), 'activate');
assert.equal(resolveSwipeBackDecision(40, 8), 'activate');
assert.equal(resolveSwipeBackDecision(40, -8), 'activate');
// Fast diagonal flick still counts while the horizontal axis dominates 2:1.
assert.equal(resolveSwipeBackDecision(60, 25), 'activate');

// --- Not yet far enough → keep waiting, never claim the touch ---
assert.equal(resolveSwipeBackDecision(0, 0), 'undecided');
assert.equal(resolveSwipeBackDecision(SWIPE_BACK_ACTIVATION_DX - 1, 0), 'undecided');
assert.equal(resolveSwipeBackDecision(10, 4), 'undecided');
assert.equal(resolveSwipeBackDecision(-8, 3), 'undecided');

// --- Vertical scroll must win, never a back navigation ---
assert.equal(resolveSwipeBackDecision(0, 40), 'reject');
assert.equal(resolveSwipeBackDecision(0, -40), 'reject');
assert.equal(resolveSwipeBackDecision(6, SWIPE_BACK_VERTICAL_ABORT_DY), 'reject');
// A drag that is mostly vertical is rejected even with real horizontal travel.
assert.equal(resolveSwipeBackDecision(20, 30), 'reject');
assert.equal(resolveSwipeBackDecision(30, 20), 'reject');
// A long list flick: 200px down with sloppy sideways drift must not go back.
assert.equal(resolveSwipeBackDecision(45, 200), 'reject');

// --- Leftward is never a back gesture ---
assert.equal(resolveSwipeBackDecision(-20, 0), 'reject');
assert.equal(resolveSwipeBackDecision(-80, 10), 'reject');

// Dominance is evaluated before the vertical abort so quick diagonals still work.
assert.equal(resolveSwipeBackDecision(80, 14), 'activate');

// --- Commit thresholds ---
assert.equal(shouldCommitSwipeBack(SWIPE_BACK_COMMIT_DX, 0), true);
assert.equal(shouldCommitSwipeBack(SWIPE_BACK_COMMIT_DX - 1, 0), false);
// Short but fast flick commits.
assert.equal(shouldCommitSwipeBack(30, SWIPE_BACK_COMMIT_VELOCITY), true);
// Fast but barely moved → springs back.
assert.equal(shouldCommitSwipeBack(10, 2_000), false);
// Leftward velocity never commits.
assert.equal(shouldCommitSwipeBack(30, -2_000), false);

// --- Route gating: root tabs are not dismissible ---
assert.equal(isSwipeBackBlockedPath('/'), true);
assert.equal(isSwipeBackBlockedPath('/transactions'), true);
assert.equal(isSwipeBackBlockedPath('/accounts'), true);
assert.equal(isSwipeBackBlockedPath('/budgets'), true);
assert.equal(isSwipeBackBlockedPath('/goals'), true);
assert.equal(isSwipeBackBlockedPath('/settings'), true);
assert.equal(isSwipeBackBlockedPath('/onboarding'), true);
assert.equal(isSwipeBackBlockedPath('/transactions/'), true);
assert.equal(isSwipeBackBlockedPath(null), true);
assert.equal(isSwipeBackBlockedPath(''), true);

assert.equal(isSwipeBackBlockedPath('/account-detail'), false);
assert.equal(isSwipeBackBlockedPath('/transaction-detail/42'), false);
assert.equal(isSwipeBackBlockedPath('/goal-detail'), false);
assert.equal(isSwipeBackBlockedPath('/alert-center'), false);
assert.equal(isSwipeBackBlockedPath('/documents-library'), false);
assert.equal(isSwipeBackBlockedPath('/add-transaction'), false);
assert.equal(isSwipeBackBlockedPath('/transactions-insights'), false);

// --- Debounce double-pop ---
resetSwipeBackNavigationSlot();
assert.equal(consumeSwipeBackNavigationSlot(1_000), true);
assert.equal(consumeSwipeBackNavigationSlot(1_000 + SWIPE_BACK_DEBOUNCE_MS - 1), false);
assert.equal(consumeSwipeBackNavigationSlot(1_000 + SWIPE_BACK_DEBOUNCE_MS), true);

console.log('swipeBackDecision tests OK');
