import { Platform } from 'react-native';

/**
 * Yield to the browser event loop so paint / timers can run.
 * Web memory SQLite is sync under async wrappers — long `await` chains never
 * reach macrotasks (setTimeout / rAF) unless we explicitly yield.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    if (Platform.OS === 'web' && typeof setTimeout === 'function') {
      setTimeout(resolve, 0);
      return;
    }
    // Native: microtask is enough; InteractionManager is heavier.
    queueMicrotask(resolve);
  });
}

/** Yield every `every` iterations during long seed / migration loops (web-critical). */
export async function yieldEvery(index: number, every = 8): Promise<void> {
  if (index > 0 && index % every === 0) {
    await yieldToEventLoop();
  }
}
