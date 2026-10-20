import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { cx } from './ui';

export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'w-full py-1 px-3 text-xs font-medium flex items-center justify-between gap-2 shadow-xs transition-all duration-200 z-50',
        !isOnline
          ? 'bg-amber-600 text-white border-b border-amber-700'
          : 'bg-emerald-600 text-white border-b border-emerald-700 animate-in fade-in slide-in-from-top-1'
      )}
    >
      <div className="flex items-center gap-2 max-w-full truncate mx-auto">
        {!isOnline ? (
          <>
            <WifiOff className="h-3.5 w-3.5 shrink-0 animate-pulse text-amber-200" />
            <span className="truncate">
              <strong>Offline Mode:</strong> Cached data shown. New updates will sync when reconnected.
            </span>
          </>
        ) : (
          <>
            <Wifi className="h-3.5 w-3.5 shrink-0 text-emerald-200" />
            <span className="truncate">
              <strong>Back Online:</strong> Live network connection restored.
            </span>
          </>
        )}
      </div>
      {!isOnline && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 flex items-center gap-1 bg-amber-700 hover:bg-amber-800 text-white px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
