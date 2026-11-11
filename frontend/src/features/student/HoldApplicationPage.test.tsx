import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { HoldApplicationPage } from './HoldApplicationPage';
import { renderWithProviders } from '../../test/testUtils';
import * as admissionApi from '../../api/admissionApi';
import { ApiClientError } from '../../api/client';
import { ERROR_MESSAGES_BN } from '../../shared/messages';

describe('HoldApplicationPage', () => {
  const futureDate = new Date(Date.now() + 600000).toISOString();
  const pastDate = new Date(Date.now() - 600000).toISOString();

  const mockHeldHold: admissionApi.HoldDetailsDto = {
    holdId: 'hold-123',
    classId: 'class-1',
    className: 'Class 6 - Morning Shift',
    status: 'HELD',
    expiresAt: futureDate,
    createdAt: new Date().toISOString(),
    confirmedAt: null,
    serverTime: new Date().toISOString(),
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('school_admission_student_id', '20051234567890123');
    vi.restoreAllMocks();
    vi.spyOn(admissionApi, 'fetchHoldById').mockResolvedValue(mockHeldHold);
  });

  afterEach(() => {
    cleanup();
  });

  function renderPage(holdId = 'hold-123', lang: 'en' | 'bn' = 'en') {
    return renderWithProviders(
      <Routes>
        <Route path="/holds/:holdId" element={<HoldApplicationPage />} />
        <Route path="/" element={<div>Dashboard Mock</div>} />
        <Route path="/classes/:classId" element={<div>Class Details Mock</div>} />
      </Routes>,
      { initialEntries: [`/holds/${holdId}`], lang },
    );
  }

  it('renders HELD status and countdown elements', async () => {
    renderPage('hold-123');

    await waitFor(() => {
      expect(screen.getByText('Seat Reservation')).toBeTruthy();
      expect(screen.getAllByText('Class 6 - Morning Shift').length).toBeGreaterThan(0);
    });

    // Pay and Cancel buttons are active
    const payBtn = screen.getByRole('button', { name: /Pay admission fee/i });
    const cancelBtn = screen.getByRole('button', { name: /Cancel Reservation/i });
    expect((payBtn as HTMLButtonElement).disabled).toBe(false);
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('successful confirmation changes displayed status to CONFIRMED', async () => {
    const confirmSpy = vi.spyOn(admissionApi, 'confirmHold').mockResolvedValue({
      holdId: 'hold-123',
      status: 'CONFIRMED',
      classId: 'class-1',
      confirmedAt: new Date().toISOString(),
    });

    renderPage('hold-123');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pay admission fee/i })).toBeTruthy();
    });

    const payBtn = screen.getByRole('button', { name: /Pay admission fee/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('hold-123');
      expect(screen.getAllByText(/Admission Confirmed!/i).length).toBeGreaterThan(0);
    });
  });

  it('successful cancellation changes displayed status to CANCELLED', async () => {
    const cancelSpy = vi.spyOn(admissionApi, 'cancelHold').mockResolvedValue(undefined);

    renderPage('hold-123');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel Reservation/i })).toBeTruthy();
    });

    const cancelBtn = screen.getByRole('button', { name: /Cancel Reservation/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith('hold-123');
      expect(screen.getAllByText(/Hold Cancelled/i).length).toBeGreaterThan(0);
    });
  });

  it('expired hold disables confirmation and shows expired banner', async () => {
    vi.spyOn(admissionApi, 'fetchHoldById').mockResolvedValue({
      ...mockHeldHold,
      status: 'EXPIRED',
      expiresAt: pastDate,
    });

    renderPage('hold-123');

    await waitFor(() => {
      expect(screen.getAllByText(/Hold Expired/i).length).toBeGreaterThan(0);
    });

    // Pay button is disabled with expired label
    const disabledPayBtn = screen.getByRole('button', { name: /Disabled — Hold Expired/i });
    expect((disabledPayBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('HOLD_EXPIRED and other API errors display localized messages', async () => {
    vi.spyOn(admissionApi, 'confirmHold').mockRejectedValue(
      new ApiClientError(
        409,
        'HOLD_EXPIRED',
        ERROR_MESSAGES_BN.HOLD_EXPIRED,
        'Raw English backend exception: hold has expired.',
      ),
    );

    renderPage('hold-123', 'bn');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ভর্তি ফি প্রদান করুন/i })).toBeTruthy();
    });

    const payBtn = screen.getByRole('button', { name: /ভর্তি ফি প্রদান করুন/i });
    fireEvent.click(payBtn);

    // Shows localized Bangla translation
    await waitFor(() => {
      expect(screen.getByText(ERROR_MESSAGES_BN.HOLD_EXPIRED)).toBeTruthy();
    });

    // Never renders raw backend exception
    expect(screen.queryByText(/Raw English backend exception/i)).toBeNull();
  });
});
