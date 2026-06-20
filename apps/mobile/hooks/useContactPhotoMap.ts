import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { buildContactPhotoUriByKey } from '@/lib/contactHistory';
import { getContacts } from '@/lib/db';
import { dataEvents } from '@/lib/events';
import type { Contact } from '@/types';

let cachedContacts: Contact[] = [];
let listeners = new Set<() => void>();
let loadPromise: Promise<void> | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

async function refreshContacts() {
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = getContacts()
    .then((contacts) => {
      cachedContacts = contacts;
      emit();
    })
    .finally(() => {
      loadPromise = null;
    });

  await loadPromise;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (cachedContacts.length === 0 && !loadPromise) {
    void refreshContacts();
  }
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return cachedContacts;
}

let subscribedToDataEvents = false;

function ensureDataEventsSubscription() {
  if (subscribedToDataEvents) return;
  subscribedToDataEvents = true;
  dataEvents.subscribe(() => {
    void refreshContacts();
  });
}

export function useContactPhotoMap(): ReadonlyMap<string, string> {
  useEffect(() => {
    ensureDataEventsSubscription();
  }, []);

  const contacts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => buildContactPhotoUriByKey(contacts), [contacts]);
}
