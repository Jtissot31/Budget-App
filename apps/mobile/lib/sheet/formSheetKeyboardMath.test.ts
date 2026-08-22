/**
 * Pure clamp helpers for Android form-sheet keyboard avoidance.
 * Run: npx --yes tsx --tsconfig tsconfig.json lib/sheet/formSheetKeyboardMath.test.ts
 */

import assert from 'node:assert/strict';
import {
  FORM_SHEET_MIN_VISIBLE_HEIGHT,
  FORM_SHEET_TOP_MARGIN,
  clampFormSheetKeyboardInset,
  formSheetHostAlreadyResized,
  formSheetKeyboardClampedHeight,
  formSheetMaxHeight,
} from './formSheetKeyboardMath';

const WINDOW = 900;

// --- clampFormSheetKeyboardInset ---
assert.equal(clampFormSheetKeyboardInset(0, WINDOW), 0);
assert.equal(clampFormSheetKeyboardInset(-10, WINDOW), 0);
assert.equal(clampFormSheetKeyboardInset(320, WINDOW), 320);
// Over-count (bad screenY) must not demand a sheet shorter than the min visible band.
assert.equal(
  clampFormSheetKeyboardInset(WINDOW, WINDOW),
  WINDOW - FORM_SHEET_MIN_VISIBLE_HEIGHT - FORM_SHEET_TOP_MARGIN,
);

// --- formSheetHostAlreadyResized ---
assert.equal(formSheetHostAlreadyResized(WINDOW, WINDOW), false);
assert.equal(formSheetHostAlreadyResized(WINDOW - 20, WINDOW), false);
assert.equal(formSheetHostAlreadyResized(WINDOW - 200, WINDOW), true);

// --- Stable height (default): keyboard inset must NOT shrink the panel ---
const desired = Math.round(WINDOW * 0.92);
assert.equal(
  formSheetMaxHeight({ windowHeight: WINDOW, hostHeight: WINDOW, keyboardInset: 360 }),
  WINDOW - FORM_SHEET_TOP_MARGIN,
);
assert.equal(
  formSheetKeyboardClampedHeight(desired, WINDOW, 360, WINDOW),
  Math.min(desired, WINDOW - FORM_SHEET_TOP_MARGIN),
);

// --- When host resized (adjustResize leftover), fit host — still no inset subtract ---
const resizedHost = WINDOW - 360;
assert.equal(
  formSheetMaxHeight({ windowHeight: WINDOW, hostHeight: resizedHost, keyboardInset: 360 }),
  resizedHost,
);
assert.equal(
  formSheetKeyboardClampedHeight(desired, WINDOW, 360, resizedHost),
  resizedHost,
);

// --- Legacy mode: subtract capped keyboard inset when stablePanelHeight is false ---
const inset = 360;
const expectedCeiling = WINDOW - inset - FORM_SHEET_TOP_MARGIN;
assert.equal(
  formSheetMaxHeight({
    windowHeight: WINDOW,
    hostHeight: WINDOW,
    keyboardInset: inset,
    stablePanelHeight: false,
  }),
  expectedCeiling,
);
assert.equal(
  formSheetKeyboardClampedHeight(desired, WINDOW, inset, WINDOW, undefined, false),
  expectedCeiling,
);

// --- Window already shrunk by adjustResize (host≈window) — use screenHeight ---
const shrunkWindow = WINDOW - 360;
assert.equal(
  formSheetMaxHeight({
    windowHeight: shrunkWindow,
    hostHeight: shrunkWindow,
    keyboardInset: 360,
    screenHeight: WINDOW,
  }),
  shrunkWindow,
);
assert.equal(
  formSheetKeyboardClampedHeight(desired, shrunkWindow, 360, shrunkWindow, WINDOW),
  shrunkWindow,
);

// --- Legacy tall keyboard clamp ---
const tallKeyboard = 520;
const available = WINDOW - tallKeyboard - FORM_SHEET_TOP_MARGIN; // 292
assert.ok(available < FORM_SHEET_MIN_VISIBLE_HEIGHT + 60);
assert.equal(
  formSheetKeyboardClampedHeight(desired, WINDOW, tallKeyboard, WINDOW, undefined, false),
  Math.max(FORM_SHEET_MIN_VISIBLE_HEIGHT, available),
);

// --- Desired smaller than ceiling stays as-is ---
assert.equal(formSheetKeyboardClampedHeight(400, WINDOW, 0, WINDOW), 400);

console.log('formSheetKeyboardMath tests passed');
