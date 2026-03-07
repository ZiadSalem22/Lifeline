import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import loadingManager from '../utils/loadingManager';

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(null);
  const visibleSinceRef = useRef(0);
  const MIN_VISIBLE_MS = 200;

  const onChange = useCallback((val) => {
    // val is now an object { isLoading, message }
    const nextIsLoading = !!(val && val.isLoading);
    const nextMessage = val && val.message ? val.message : null;
    if (nextIsLoading) {
      // became loading
      visibleSinceRef.current = Date.now();
      setLoadingMessage(nextMessage);
      setIsLoading(true);
    } else {
      // became not loading; ensure min visible duration to avoid flicker
      const elapsed = Date.now() - (visibleSinceRef.current || 0);
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      if (remaining > 0) {
        setTimeout(() => {
          setIsLoading(false);
          setLoadingMessage(null);
        }, remaining);
      } else {
        setIsLoading(false);
        setLoadingMessage(null);
      }
      visibleSinceRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const unsub = loadingManager.subscribe(onChange);
    return unsub;
  }, [onChange]);

  const startLoading = (message = null) => loadingManager.startLoading(message);
  const stopLoading = (id = null) => loadingManager.stopLoading(id);

  const setLoading = (v) => {
    // allow manual override: if true -> call startLoading once; if false -> call stopLoading once
    if (v) startLoading(); else stopLoading();
  };

  const value = {
    isLoading,
    loadingMessage,
    setLoading,
    startLoading,
    stopLoading,
  };

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
}

export default LoadingContext;
