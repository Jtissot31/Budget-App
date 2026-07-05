import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ignoreReviewTransaction,
  markReviewTransactionsSeen,
  syncTransactionReviewSettings,
} from '@/lib/transactionReviewSettings';
import {
  listTransactionsNeedingReview,
  unseenReviewCount,
} from '@/lib/transactionInsights';
import type { Transaction } from '@/types';

type ReviewQueueState = {
  ignoredIds: Set<string>;
  seenIds: Set<string>;
  ready: boolean;
};

const EMPTY_STATE: ReviewQueueState = {
  ignoredIds: new Set(),
  seenIds: new Set(),
  ready: false,
};

/**
 * Review settings for the À compléter queue. Relies on the parent screen to
 * refresh `transactions` after dataEvents — no duplicate dataEvents listener here.
 */
export function useTransactionReviewQueue(transactions: readonly Transaction[]) {
  const [settings, setSettings] = useState<ReviewQueueState>(EMPTY_STATE);
  const transactionsRef = useRef(transactions);
  transactionsRef.current = transactions;

  const reloadGenerationRef = useRef(0);
  const reloadInFlightRef = useRef<Promise<void> | null>(null);
  const needsReloadRef = useRef(false);

  const reload = useCallback(async () => {
    if (reloadInFlightRef.current) {
      needsReloadRef.current = true;
      return reloadInFlightRef.current;
    }

    const run = (async () => {
      do {
        needsReloadRef.current = false;
        const generation = ++reloadGenerationRef.current;
        const next = await syncTransactionReviewSettings(transactionsRef.current ?? []);
        if (generation !== reloadGenerationRef.current) return;
        setSettings({
          ignoredIds: new Set(next.ignoredIds),
          seenIds: new Set(next.seenIds),
          ready: true,
        });
      } while (needsReloadRef.current);
    })();

    reloadInFlightRef.current = run;
    try {
      await run;
    } finally {
      if (reloadInFlightRef.current === run) {
        reloadInFlightRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload, transactions]);

  const pendingReview = useMemo(
    () =>
      listTransactionsNeedingReview(transactions ?? [], {
        ignoredIds: settings.ignoredIds,
      }),
    [settings.ignoredIds, transactions],
  );

  const unseenCount = useMemo(
    () => unseenReviewCount(pendingReview, settings.seenIds),
    [pendingReview, settings.seenIds],
  );

  const markSeen = useCallback(
    async (transactionIds: readonly string[]) => {
      await markReviewTransactionsSeen(transactionIds);
      await reload();
    },
    [reload],
  );

  const markAllPendingSeen = useCallback(async () => {
    const ids = listTransactionsNeedingReview(transactionsRef.current ?? [], {
      ignoredIds: settings.ignoredIds,
    }).map((tx) => tx.id);
    if (ids.length === 0) return;
    await markReviewTransactionsSeen(ids);
    await reload();
  }, [reload, settings.ignoredIds]);

  const ignoreTransaction = useCallback(
    async (transactionId: string) => {
      await ignoreReviewTransaction(transactionId);
      await reload();
    },
    [reload],
  );

  return {
    ready: settings.ready,
    pendingReview,
    unseenCount,
    markSeen,
    markAllPendingSeen,
    ignoreTransaction,
    reload,
  };
}
