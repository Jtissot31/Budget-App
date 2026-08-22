/**
 * Auto goal icon (southern palm vs generic travel plane).
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/getAutomaticGoalIcon.test.ts
 */

import assert from 'node:assert/strict';
import {
  getAutomaticGoalIcon,
  resolveSavingsGoalDisplayIcon,
  SOUTHERN_DESTINATION_ICON,
} from './getAutomaticGoalIcon';

assert.equal(getAutomaticGoalIcon('Voyage Mexique 2027'), SOUTHERN_DESTINATION_ICON);
assert.equal(getAutomaticGoalIcon('Voyage Europe'), 'airplane-outline');
assert.equal(
  resolveSavingsGoalDisplayIcon({
    name: 'Voyage Mexique 2027',
    icon: 'airplane-outline',
  }),
  SOUTHERN_DESTINATION_ICON,
);
assert.equal(
  resolveSavingsGoalDisplayIcon({
    name: 'Voyage Mexique 2027',
    icon: 'palm-tree',
  }),
  'palm-tree',
);

console.log('getAutomaticGoalIcon.test.ts: ok');
