import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { formatSecondsToMMSS, useCountdown } from './useCountdown';

describe('useCountdown', () => {
  beforeEach(() => {
    // Fake the wall clock and the monotonic clock together so time moves only when we say so.
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('corrects for client clock skew using serverTime', () => {
    // The browser clock is 5 minutes BEHIND the server.
    vi.setSystemTime(new Date('2026-11-11T04:00:00Z'));

    const { result } = renderHook(() =>
      useCountdown({
        serverTime: '2026-11-11T04:05:00Z',
        expiresAt: '2026-11-11T04:06:00Z',
        createdAt: '2026-11-11T03:56:00Z',
      }),
    );

    // Without correction this would be 360 s (6 min); with serverTime it is the real 60 s.
    expect(result.current.secondsLeft).toBe(60);
    expect(result.current.formattedTime).toBe('01:00');
    expect(result.current.totalSeconds).toBe(600);
    expect(result.current.isExpired).toBe(false);
  });

  it('flips to expired at zero and calls onExpire exactly once', () => {
    vi.setSystemTime(new Date('2026-11-11T04:00:00Z'));
    const onExpire = vi.fn();

    const { result } = renderHook(() =>
      useCountdown({
        serverTime: '2026-11-11T04:00:00Z',
        expiresAt: '2026-11-11T04:00:03Z',
        onExpire,
      }),
    );
    expect(result.current.secondsLeft).toBe(3);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.secondsLeft).toBe(1);
    expect(result.current.isExpired).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.secondsLeft).toBe(0);
    expect(result.current.isExpired).toBe(true);
    expect(onExpire).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('is expired immediately when expiresAt is already in the past', () => {
    vi.setSystemTime(new Date('2026-11-11T04:10:00Z'));
    const onExpire = vi.fn();

    const { result } = renderHook(() =>
      useCountdown({ serverTime: '2026-11-11T04:10:00Z', expiresAt: '2026-11-11T04:00:00Z', onExpire }),
    );

    expect(result.current.isExpired).toBe(true);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});

describe('formatSecondsToMMSS', () => {
  it('pads minutes and seconds and never goes negative', () => {
    expect(formatSecondsToMMSS(600)).toBe('10:00');
    expect(formatSecondsToMMSS(65)).toBe('01:05');
    expect(formatSecondsToMMSS(-4)).toBe('00:00');
  });
});

