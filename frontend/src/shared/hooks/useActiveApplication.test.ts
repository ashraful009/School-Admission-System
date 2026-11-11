import { describe, expect, it } from 'vitest';
import { isHoldActive, getActiveApplication, getActiveHoldForClass } from './useActiveApplication';
import type { StudentHoldDto } from '../../api/admissionApi';

describe('useActiveApplication helpers', () => {
  const futureIso = new Date(Date.now() + 60000).toISOString();
  const pastIso = new Date(Date.now() - 60000).toISOString();

  const baseHold: StudentHoldDto = {
    holdId: 'hold-1',
    classId: 'class-1',
    className: 'Class 6 - Morning',
    status: 'HELD',
    createdAt: new Date().toISOString(),
    expiresAt: futureIso,
    confirmedAt: null,
    serverTime: new Date().toISOString(),
  };

  it('isHoldActive correctly identifies active statuses', () => {
    expect(isHoldActive({ ...baseHold, status: 'CONFIRMED' })).toBe(true);
    expect(isHoldActive({ ...baseHold, status: 'HELD', expiresAt: futureIso })).toBe(true);
    expect(isHoldActive({ ...baseHold, status: 'HELD', expiresAt: pastIso })).toBe(false);
    expect(isHoldActive({ ...baseHold, status: 'CANCELLED' })).toBe(false);
    expect(isHoldActive({ ...baseHold, status: 'EXPIRED' })).toBe(false);
  });

  it('getActiveApplication returns null for empty or null list', () => {
    expect(getActiveApplication(null)).toBeNull();
    expect(getActiveApplication([])).toBeNull();
  });

  it('getActiveApplication prioritizes CONFIRMED over HELD', () => {
    const heldHold: StudentHoldDto = {
      ...baseHold,
      holdId: 'hold-held',
      status: 'HELD',
      expiresAt: futureIso,
    };
    const confirmedHold: StudentHoldDto = {
      ...baseHold,
      holdId: 'hold-conf',
      status: 'CONFIRMED',
      expiresAt: pastIso,
      confirmedAt: new Date().toISOString(),
    };

    const result = getActiveApplication([heldHold, confirmedHold]);
    expect(result?.holdId).toBe('hold-conf');
    expect(result?.status).toBe('CONFIRMED');
  });

  it('getActiveApplication selects active HELD hold and ignores expired', () => {
    const expiredHold: StudentHoldDto = {
      ...baseHold,
      holdId: 'hold-exp',
      status: 'HELD',
      expiresAt: pastIso,
    };
    const activeHold: StudentHoldDto = {
      ...baseHold,
      holdId: 'hold-active',
      status: 'HELD',
      expiresAt: futureIso,
    };

    const result = getActiveApplication([expiredHold, activeHold]);
    expect(result?.holdId).toBe('hold-active');
  });

  it('getActiveApplication returns null when all holds are expired or cancelled', () => {
    const expiredHold: StudentHoldDto = {
      ...baseHold,
      holdId: 'hold-exp',
      status: 'EXPIRED',
    };
    const cancelledHold: StudentHoldDto = {
      ...baseHold,
      holdId: 'hold-canc',
      status: 'CANCELLED',
    };

    expect(getActiveApplication([expiredHold, cancelledHold])).toBeNull();
  });

  describe('getActiveHoldForClass (Section 2.5 & 2.6 per-class isolation)', () => {
    it('returns active hold for target class and null for unrelated class', () => {
      const class1Hold: StudentHoldDto = {
        ...baseHold,
        holdId: 'hold-c1',
        classId: 'class-1',
        status: 'HELD',
        expiresAt: futureIso,
      };

      expect(getActiveHoldForClass('class-1', [class1Hold])?.holdId).toBe('hold-c1');
      expect(getActiveHoldForClass('class-2', [class1Hold])).toBeNull();
    });

    it('allows active holds in different classes simultaneously', () => {
      const class1Hold: StudentHoldDto = {
        ...baseHold,
        holdId: 'hold-c1',
        classId: 'class-1',
        className: 'Class 6 - Morning Shift',
        status: 'HELD',
        expiresAt: futureIso,
      };
      const class2Hold: StudentHoldDto = {
        ...baseHold,
        holdId: 'hold-c2',
        classId: 'class-2',
        className: 'Class 6 - Day Shift',
        status: 'CONFIRMED',
        confirmedAt: new Date().toISOString(),
      };

      const holds = [class1Hold, class2Hold];

      const activeC1 = getActiveHoldForClass('class-1', holds);
      const activeC2 = getActiveHoldForClass('class-2', holds);
      const activeC3 = getActiveHoldForClass('class-3', holds);

      expect(activeC1?.holdId).toBe('hold-c1');
      expect(activeC1?.status).toBe('HELD');

      expect(activeC2?.holdId).toBe('hold-c2');
      expect(activeC2?.status).toBe('CONFIRMED');

      expect(activeC3).toBeNull();
    });

    it('returns null if hold in target class is expired or cancelled', () => {
      const expiredC1: StudentHoldDto = {
        ...baseHold,
        holdId: 'hold-exp',
        classId: 'class-1',
        status: 'EXPIRED',
      };
      const cancelledC1: StudentHoldDto = {
        ...baseHold,
        holdId: 'hold-canc',
        classId: 'class-1',
        status: 'CANCELLED',
      };

      expect(getActiveHoldForClass('class-1', [expiredC1, cancelledC1])).toBeNull();
    });

    it('prioritizes CONFIRMED over HELD within the same class', () => {
      const heldC1: StudentHoldDto = {
        ...baseHold,
        holdId: 'hold-held',
        classId: 'class-1',
        status: 'HELD',
        expiresAt: futureIso,
      };
      const confC1: StudentHoldDto = {
        ...baseHold,
        holdId: 'hold-conf',
        classId: 'class-1',
        status: 'CONFIRMED',
        confirmedAt: new Date().toISOString(),
      };

      const result = getActiveHoldForClass('class-1', [heldC1, confC1]);
      expect(result?.holdId).toBe('hold-conf');
      expect(result?.status).toBe('CONFIRMED');
    });
  });
});
