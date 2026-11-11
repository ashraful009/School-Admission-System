import { useEffect, useRef, useState } from 'react';

export interface UseCountdownOptions {
  expiresAt?: string | null;
  serverTime?: string | null;
  createdAt?: string | null;
  onExpire?: () => void;
}

export interface UseCountdownReturn {
  secondsLeft: number;
  totalSeconds: number;
  formattedTime: string;
  isExpired: boolean;
  minutes: number;
  seconds: number;
}

/**
 * Pure calculation function for remaining seconds given an expiresAt timestamp,
 * reference server time, and monotonic performance elapsed time.
 */
export function calculateRemainingSeconds({
  expiresAt,
  referenceServerMs,
  referencePerfMs,
  hasServerTime,
  clockSkewMs,
}: {
  expiresAt?: string | null;
  referenceServerMs: number;
  referencePerfMs: number;
  hasServerTime: boolean;
  clockSkewMs: number;
}): number {
  if (!expiresAt) return 0;
  const expiresMs = Date.parse(expiresAt);
  if (isNaN(expiresMs)) return 0;

  let nowEstimatedServerMs: number;
  if (hasServerTime && typeof performance !== 'undefined') {
    const elapsedMs = performance.now() - referencePerfMs;
    nowEstimatedServerMs = referenceServerMs + elapsedMs;
  } else {
    nowEstimatedServerMs = Date.now() + clockSkewMs;
  }

  const diffMs = expiresMs - nowEstimatedServerMs;
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Format raw seconds as MM:SS (e.g. 09:45)
 */
export function formatSecondsToMMSS(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Tested-friendly countdown hook with clock skew correction.
 * - Measures serverTime offset at each fetch.
 * - Monotonic performance timer ensures countdown follows server time even if user changes browser/system clock.
 * - Calls onExpire callback once when 0 is reached.
 */
export function useCountdown({
  expiresAt,
  serverTime,
  createdAt,
  onExpire,
}: UseCountdownOptions): UseCountdownReturn {
  // Anchors for server time skew and monotonic tracking
  const refServerMs = useRef<number>(Date.now());
  const refPerfMs = useRef<number>(typeof performance !== 'undefined' ? performance.now() : 0);
  const hasServerTime = useRef<boolean>(false);
  const clockSkewMs = useRef<number>(0);

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const hasCalledOnExpire = useRef<boolean>(false);

  // Update server time reference anchors whenever serverTime is provided/updated
  useEffect(() => {
    if (serverTime) {
      const sMs = Date.parse(serverTime);
      if (!isNaN(sMs)) {
        refServerMs.current = sMs;
        refPerfMs.current = typeof performance !== 'undefined' ? performance.now() : 0;
        hasServerTime.current = true;
        clockSkewMs.current = sMs - Date.now();
      }
    }
  }, [serverTime]);

  // Compute total duration in seconds from createdAt to expiresAt if available
  const totalSeconds = (() => {
    if (expiresAt && createdAt) {
      const exp = Date.parse(expiresAt);
      const created = Date.parse(createdAt);
      if (!isNaN(exp) && !isNaN(created) && exp > created) {
        return Math.max(1, Math.round((exp - created) / 1000));
      }
    }
    return 600; // default 10 minutes fallback
  })();

  const getRemaining = () =>
    calculateRemainingSeconds({
      expiresAt,
      referenceServerMs: refServerMs.current,
      referencePerfMs: refPerfMs.current,
      hasServerTime: hasServerTime.current,
      clockSkewMs: clockSkewMs.current,
    });

  const [secondsLeft, setSecondsLeft] = useState<number>(getRemaining);

  // Handle countdown interval and zero-reach trigger
  useEffect(() => {
    const current = getRemaining();
    setSecondsLeft(current);

    if (current > 0) {
      hasCalledOnExpire.current = false;
    }

    if (!expiresAt || current <= 0) {
      if (expiresAt && current <= 0 && !hasCalledOnExpire.current) {
        hasCalledOnExpire.current = true;
        onExpireRef.current?.();
      }
      return;
    }

    const intervalId = setInterval(() => {
      const remaining = getRemaining();
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(intervalId);
        if (!hasCalledOnExpire.current) {
          hasCalledOnExpire.current = true;
          onExpireRef.current?.();
        }
      }
    }, 1000);

    // Resync immediately when tab becomes visible after being backgrounded/throttled
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const remaining = getRemaining();
        setSecondsLeft(remaining);
        if (remaining <= 0 && !hasCalledOnExpire.current) {
          hasCalledOnExpire.current = true;
          onExpireRef.current?.();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [expiresAt, serverTime]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formattedTime = formatSecondsToMMSS(secondsLeft);
  const isExpired = secondsLeft <= 0;

  return {
    secondsLeft,
    totalSeconds,
    formattedTime,
    isExpired,
    minutes,
    seconds,
  };
}

