/** Month boundaries and French labels for the Budget page selector. */

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

export function startOfNextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);
}

export function isSameMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

/** True when `date` falls in the calendar month of today. */
export function isCurrentMonth(date: Date): boolean {
  return isSameMonth(date, new Date());
}

export function isMonthBefore(left: Date, right: Date): boolean {
  const leftKey = left.getFullYear() * 12 + left.getMonth();
  const rightKey = right.getFullYear() * 12 + right.getMonth();
  return leftKey < rightKey;
}

export function isMonthAfter(left: Date, right: Date): boolean {
  const leftKey = left.getFullYear() * 12 + left.getMonth();
  const rightKey = right.getFullYear() * 12 + right.getMonth();
  return leftKey > rightKey;
}

export function clampMonthToRange(month: Date, earliest: Date, latest: Date): Date {
  if (isMonthBefore(month, earliest)) return startOfMonth(earliest);
  if (isMonthAfter(month, latest)) return startOfMonth(latest);
  return startOfMonth(month);
}

/** "Juin 2026" — capitalized French month + year for the selector. */
export function formatBudgetMonthLabel(date: Date): string {
  const label = date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "JUIN" — uppercase French month name for the minimal selector. */
export function formatBudgetMonthName(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long' }).toUpperCase();
}

/** "2026" — year for the minimal selector. */
export function formatBudgetMonthYear(date: Date): string {
  return String(date.getFullYear());
}

/** Shared alias for month selectors outside the Budget page. */
export const formatMonthName = formatBudgetMonthName;

/** Shared alias for month selectors outside the Budget page. */
export const formatMonthYear = formatBudgetMonthYear;

/** Uppercase eyebrow for the donut hub when viewing a past month. */
export function formatBudgetMonthEyebrow(date: Date): string {
  return formatBudgetMonthLabel(date).toUpperCase();
}
