import { useEffect, useSyncExternalStore } from 'react';

import { getSimulatedAccounts } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import type { SimulatedAccount } from '@/types';

let cachedAccounts: SimulatedAccount[] = [];
let listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

async function refreshSimulatedAccounts() {
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = getSimulatedAccounts()
    .then((accounts) => {
      cachedAccounts = accounts;
      emit();
    })
    .finally(() => {
      loadPromise = null;
    });

  await loadPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (cachedAccounts.length === 0 && !loadPromise) {
    void refreshSimulatedAccounts();
  }
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cachedAccounts;
}

let subscribedToDataEvents = false;

function ensureDataEventsSubscription() {
  if (subscribedToDataEvents) return;
  subscribedToDataEvents = true;
  dataEvents.subscribe(() => {
    void refreshSimulatedAccounts();
  });
}

export function useSimulatedAccounts(): SimulatedAccount[] {
  useEffect(() => {
    ensureDataEventsSubscription();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
