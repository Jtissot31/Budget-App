export type TourTargetRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type MeasureFn = () => Promise<TourTargetRect | null>;

const measures = new Map<string, MeasureFn>();
const measureListeners = new Set<() => void>();

function emitMeasureChange(): void {
  measureListeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.warn('[AppTourTargets] listener failed', error);
    }
  });
}

export function registerAppTourTarget(id: string, measure: MeasureFn): () => void {
  measures.set(id, measure);
  emitMeasureChange();
  return () => {
    if (measures.get(id) === measure) {
      measures.delete(id);
      emitMeasureChange();
    }
  };
}

export function subscribeAppTourTargets(listener: () => void): () => void {
  measureListeners.add(listener);
  return () => {
    measureListeners.delete(listener);
  };
}

export async function measureAppTourTarget(id: string): Promise<TourTargetRect | null> {
  const measure = measures.get(id);
  if (!measure) return null;
  try {
    return await measure();
  } catch (error) {
    console.warn('[AppTourTargets] measure failed', id, error);
    return null;
  }
}

/** Scroll / reveal hooks for targets that sit below the fold. */
type RevealFn = () => void;
const revealers = new Map<string, RevealFn>();

export function registerAppTourRevealer(id: string, reveal: RevealFn): () => void {
  revealers.set(id, reveal);
  return () => {
    if (revealers.get(id) === reveal) {
      revealers.delete(id);
    }
  };
}

export function revealAppTourTarget(id: string): void {
  const reveal = revealers.get(id);
  if (!reveal) return;
  try {
    reveal();
  } catch (error) {
    console.warn('[AppTourTargets] reveal failed', id, error);
  }
}
