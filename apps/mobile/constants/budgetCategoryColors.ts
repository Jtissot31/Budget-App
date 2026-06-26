/** Fixed 10-color palette for budget categories — one unique color per category. */
export const BUDGET_CATEGORY_PALETTE = [
  '#4ADE80', // vert accent
  '#60A5FA', // bleu doux
  '#34D399', // vert teal
  '#A78BFA', // violet doux
  '#38BDF8', // cyan
  '#FB923C', // orange muted
  '#2DD4BF', // turquoise
  '#818CF8', // indigo
  '#94A3B8', // gris bleuté
  '#C96560', // rouge muted
] as const;

export type BudgetCategoryPaletteColor = (typeof BUDGET_CATEGORY_PALETTE)[number];

function normalizeHex(color: string): string {
  return color.trim().toLowerCase();
}

export function getColorForCategoryIndex(index: number): BudgetCategoryPaletteColor {
  if (index < 0) return BUDGET_CATEGORY_PALETTE[0];
  return BUDGET_CATEGORY_PALETTE[index % BUDGET_CATEGORY_PALETTE.length];
}

/** Returns the first palette color not already used (case-insensitive). */
export function assignCategoryColor(usedColors: readonly string[]): BudgetCategoryPaletteColor {
  const used = new Set(usedColors.map(normalizeHex));
  const available = BUDGET_CATEGORY_PALETTE.find((color) => !used.has(normalizeHex(color)));
  if (!available) {
    throw new Error('Toutes les couleurs de palette sont déjà utilisées.');
  }
  return available;
}
