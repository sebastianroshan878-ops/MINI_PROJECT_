import { useEffect, useRef } from 'react';

// Runs `callback` now and then again every `ms` milliseconds (used for "real-time" screens).
export function usePolling(callback, ms = 10000, deps = []) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    saved.current();
    const id = setInterval(() => saved.current(), ms);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);
}
