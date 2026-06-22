import designSystemLucideSelection from '@/lib/designSystemLucideSelection.json';

const selectionSet = new Set<string>(designSystemLucideSelection);

export function isDesignSystemLucideIcon(name: string): boolean {
  return selectionSet.has(name);
}

export function getDesignSystemLucideSelection(): readonly string[] {
  return designSystemLucideSelection;
}
