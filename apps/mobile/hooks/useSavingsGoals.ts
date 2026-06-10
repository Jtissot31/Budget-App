import { useEffect, useSyncExternalStore } from 'react';

import { getSavingsGoals } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import type { SavingsGoal } from '@/types';

let cachedGoals: Pick<SavingsGoal, 'id' | 'name'>[] = [];
let listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

async function refreshSavingsGoals() {
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = getSavingsGoals()
    .then((goals) => {
      cachedGoals = goals;
      emit();
    })
    .finally(() => {
      loadPromise = null;
    });

  await loadPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (cachedGoals.length === 0 && !loadPromise) {
    void refreshSavingsGoals();
  }
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cachedGoals;
}

let subscribedToDataEvents = false;

function ensureDataEventsSubscription() {
  if (subscribedToDataEvents) return;
  subscribedToDataEvents = true;
  dataEvents.subscribe(() => {
    void refreshSavingsGoals();
  });
}

export function useSavingsGoals(): Pick<SavingsGoal, 'id' | 'name'>[] {
  useEffect(() => {
    ensureDataEventsSubscription();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
