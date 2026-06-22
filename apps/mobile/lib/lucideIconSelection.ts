import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const STORAGE_KEY = 'design-system:lucide-icon-selection';

async function syncSelectionToDevProject(names: string[]): Promise<void> {
  if (!__DEV__ || names.length === 0) return;

  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0] ?? 'localhost';

  try {
    await fetch(`http://${host}:8081/__design-system/lucide-selection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(names),
    });
  } catch {
    // Metro may be offline — selection stays in AsyncStorage only.
  }
}

export async function getSelectedLucideIconNames(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const names = parsed.filter((name): name is string => typeof name === 'string' && name.length > 0);
    void syncSelectionToDevProject(names);
    return names;
  } catch {
    return [];
  }
}

export async function setSelectedLucideIconNames(names: string[]): Promise<void> {
  const unique = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(unique));
  void syncSelectionToDevProject(unique);
}

export async function toggleSelectedLucideIcon(name: string): Promise<string[]> {
  const current = await getSelectedLucideIconNames();
  const next = current.includes(name)
    ? current.filter((item) => item !== name)
    : [...current, name].sort((a, b) => a.localeCompare(b));
  await setSelectedLucideIconNames(next);
  return next;
}

export async function clearSelectedLucideIcons(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Dev: push AsyncStorage selection to Metro → lib/designSystemLucideSelection.json */
export async function exportSelectedLucideIconsToProject(): Promise<number> {
  const names = await getSelectedLucideIconNames();
  await syncSelectionToDevProject(names);
  return names.length;
}
