import { useEffect, useState } from 'react';

/** Returns `value` after it stays unchanged for `delayMs` (default 200ms). */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
