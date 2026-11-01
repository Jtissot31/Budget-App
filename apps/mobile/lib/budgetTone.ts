/**
 * Budget status colour — one vivid amber for « attention », the same as the rest of the app.
 * Used as a small signal (rings, calendar labels), never on headline amounts or sentences.
 */

const ATTENTION = '#F59E0B';

/** Over budget. */
export const BUDGET_OVER = ATTENTION;

/** Close to the limit (≥ 90 %). */
export const BUDGET_NEAR = ATTENTION;
