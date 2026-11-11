import { useQuery } from '@tanstack/react-query';
import { fetchMyHolds, type StudentHoldDto } from '../../api/admissionApi';
import { getStoredStudentId } from '../../api/client';
import { useState, useEffect } from 'react';

/**
 * Checks if a hold is currently active (CONFIRMED or unexpired HELD).
 */
export function isHoldActive(hold: StudentHoldDto): boolean {
  if (hold.status === 'CONFIRMED') {
    return true;
  }
  if (hold.status === 'HELD') {
    const exp = Date.parse(hold.expiresAt);
    return !isNaN(exp) && exp > Date.now();
  }
  return false;
}

/**
 * Gets the active hold for a specific class (if any).
 * Priority: CONFIRMED beats HELD, then earliest expiry.
 */
export function getActiveHoldForClass(
  classId: string,
  holds: StudentHoldDto[] | undefined | null
): StudentHoldDto | null {
  if (!holds || holds.length === 0) return null;
  const activeClassHolds = holds.filter((h) => h.classId === classId && isHoldActive(h));
  if (activeClassHolds.length === 0) return null;

  const confirmed = activeClassHolds.find((h) => h.status === 'CONFIRMED');
  if (confirmed) return confirmed;

  const activeHeld = activeClassHolds
    .filter((h) => h.status === 'HELD')
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));

  return activeHeld[0] || null;
}

/**
 * Derives the primary active application from a list of holds.
 * Priority: CONFIRMED beats HELD, then earliest expiry/created.
 */
export function getActiveApplication(holds: StudentHoldDto[] | undefined | null): StudentHoldDto | null {
  if (!holds || holds.length === 0) return null;

  // 1. CONFIRMED admission takes priority
  const confirmed = holds.find((h) => h.status === 'CONFIRMED');
  if (confirmed) return confirmed;

  // 2. Active (unexpired) HELD hold
  const activeHeld = holds
    .filter((h) => h.status === 'HELD')
    .filter((h) => {
      const exp = Date.parse(h.expiresAt);
      return !isNaN(exp) && exp > Date.now();
    })
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));

  return activeHeld[0] || null;
}

/**
 * Shared hook to query student holds and query active applications per class or primary.
 */
export function useActiveApplication() {
  const studentId = getStoredStudentId();

  const {
    data: holds,
    isLoading,
    refetch,
  } = useQuery<StudentHoldDto[]>({
    queryKey: ['myHolds', studentId],
    queryFn: () => {
      if (!studentId) return [];
      return fetchMyHolds(studentId);
    },
    refetchInterval: 5000,
    enabled: Boolean(studentId),
  });

  const [activeApp, setActiveApp] = useState<StudentHoldDto | null>(() => getActiveApplication(holds));

  useEffect(() => {
    const app = getActiveApplication(holds);
    setActiveApp(app);

    // If hold is HELD, set a timer to automatically clear activeApplication at zero seconds
    if (app && app.status === 'HELD') {
      const exp = Date.parse(app.expiresAt);
      const remainingMs = exp - Date.now();
      if (remainingMs > 0) {
        const timer = setTimeout(() => {
          setActiveApp(getActiveApplication(holds));
        }, remainingMs);
        return () => clearTimeout(timer);
      }
    }
  }, [holds]);

  const isHeld = activeApp?.status === 'HELD';
  const isConfirmed = activeApp?.status === 'CONFIRMED';

  return {
    holds,
    activeApplication: activeApp,
    hasActiveApplication: Boolean(activeApp),
    isHeld,
    isConfirmed,
    activeClassId: activeApp?.classId || null,
    activeClassName: activeApp?.className || null,
    activeHoldId: activeApp?.holdId || null,
    getActiveHoldForClass: (targetClassId: string) => getActiveHoldForClass(targetClassId, holds),
    hasActiveHoldForClass: (targetClassId: string) => Boolean(getActiveHoldForClass(targetClassId, holds)),
    isLoading,
    refetch,
  };
}
