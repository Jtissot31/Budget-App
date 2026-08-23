/**
 * FloatingTabBar active-well guardrails — well must stay a rounded square, not a circle.
 * Run: npx --yes tsx --tsconfig tsconfig.json components/tabbar/floatingTabBarTokens.test.ts
 */

import assert from 'node:assert/strict';
import {
  FLOATING_TAB_ACTIVE_WELL_SHELL,
  TAB_ACTIVE_WELL_BORDER_RADIUS,
  TAB_ACTIVE_WELL_SIZE,
} from './floatingTabBarTokens';

assert.equal(TAB_ACTIVE_WELL_SIZE, 44, 'tab well size matches tab row touch target');
assert.ok(
  TAB_ACTIVE_WELL_BORDER_RADIUS < TAB_ACTIVE_WELL_SIZE / 2,
  'active well radius must be less than half the well size (rounded square, never circle)',
);
assert.ok(
  TAB_ACTIVE_WELL_BORDER_RADIUS >= 8 && TAB_ACTIVE_WELL_BORDER_RADIUS <= 16,
  'active well radius should stay in a moderate rounded-rect range (~radius.md–lg)',
);

assert.equal(FLOATING_TAB_ACTIVE_WELL_SHELL.width, TAB_ACTIVE_WELL_SIZE);
assert.equal(FLOATING_TAB_ACTIVE_WELL_SHELL.height, TAB_ACTIVE_WELL_SIZE);
assert.equal(FLOATING_TAB_ACTIVE_WELL_SHELL.borderRadius, TAB_ACTIVE_WELL_BORDER_RADIUS);
assert.equal(FLOATING_TAB_ACTIVE_WELL_SHELL.overflow, 'hidden');
assert.equal(FLOATING_TAB_ACTIVE_WELL_SHELL.alignSelf, 'center');

console.log('floatingTabBarTokens.test.ts: all assertions passed');
