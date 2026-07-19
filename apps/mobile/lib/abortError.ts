/** Cross-platform abort helpers — DOMException exists on web, not in React Native/Hermes. */

export function createAbortError(message = 'Aborted'): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException(message, 'AbortError');
  }

  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

export function isAbortError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false;

  const name = (error as { name?: unknown }).name;
  if (name === 'AbortError') return true;

  return typeof DOMException !== 'undefined' && error instanceof DOMException;
}
