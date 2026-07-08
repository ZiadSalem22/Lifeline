import { useEffect, useState } from 'react';

/** Returns `value` after it has been stable for `ms` (trailing debounce). */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced((current) => (Object.is(current, value) ? current : value));
    }, ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
