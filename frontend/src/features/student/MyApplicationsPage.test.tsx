import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { MyApplicationsPage } from './MyApplicationsPage';
import { renderWithProviders } from '../../test/testUtils';
import * as admissionApi from '../../api/admissionApi';
import { ApiClientError } from '../../api/client';
import { ERROR_MESSAGES } from '../../shared/messages';

describe('MyApplicationsPage', () => {
  const futureDate = new Date(Date.now() + 600000).toISOString();
  const pastDate = new Date(Date.now() - 600000).toISOString();

  const mockHolds: admissionApi.StudentHoldDto[] = [
    {
      holdId: 'hold-1',
      classId: 'class-1',
      className: 'Class 6 - Morning Shift',
      status: 'HELD',
      expiresAt: futureDate,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
      serverTime: new Date().toISOString(),
    },
    {
      holdId: 'hold-2',
      classId: 'class-2',
      className: 'Class 7 - Day Shift',
      status: 'CONFIRMED',
      expiresAt: futureDate,
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      serverTime: new Date().toISOString(),
    },
    {
      holdId: 'hold-3',
      classId: 'class-3',
      className: 'Class 8 - Day Shift',
      status: 'EXPIRED',
      expiresAt: pastDate,
      createdAt: pastDate,
      confirmedAt: null,
      serverTime: new Date().toISOString(),
    },
    {
      holdId: 'hold-4',
      classId: 'class-4',
      className: 'Class 9 - Morning Shift',
      status: 'CANCELLED',
      expiresAt: futureDate,
      createdAt: new Date().toISOString(),
      confirmedAt: null,
      serverTime: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('school_admission_student_id', '20051234567890123');
    vi.restoreAllMocks();
    vi.spyOn(admissionApi, 'fetchMyHolds').mockResolvedValue(mockHolds);
  });

  afterEach(() => {
    cleanup();
  });

  function renderPage(lang: 'en' | 'bn' = 'en') {
    return renderWithProviders(
      <Routes>
        <Route path="/me/holds" element={<MyApplicationsPage />} />
        <Route path="/" element={<div>Classes Page Mock</div>} />
        <Route path="/holds/:holdId" element={<div>Hold Details Mock</div>} />
      </Routes>,
      { initialEntries: ['/me/holds'], lang },
    );
  }

  it('renders applications and displays all four statuses correctly', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('My Applications')).toBeTruthy();
      expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
      expect(screen.getByText('Class 7 - Day Shift')).toBeTruthy();
      expect(screen.getByText('Class 8 - Day Shift')).toBeTruthy();
      expect(screen.getByText('Class 9 - Morning Shift')).toBeTruthy();
    });

    // Check status badges / pills
    expect(screen.getAllByText('HELD').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CONFIRMED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('EXPIRED').length).toBeGreaterThan(0);
    expect(screen.getAllByText('CANCELLED').length).toBeGreaterThan(0);
  });

  it('displays empty state when no applications exist', async () => {
    vi.spyOn(admissionApi, 'fetchMyHolds').mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No applications found/i)).toBeTruthy();
      expect(screen.getAllByRole('button', { name: /Browse Classes/i }).length).toBeGreaterThan(0);
    });
  });

  it('handles API failure with friendly error state', async () => {
    vi.spyOn(admissionApi, 'fetchMyHolds').mockRejectedValue(
      new Error('Failed to fetch applications'),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Unable to load applications/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Try Again/i })).toBeTruthy();
    });
  });

  it('supports in-list confirmation payment action for HELD application', async () => {
    const confirmSpy = vi.spyOn(admissionApi, 'confirmHold').mockResolvedValue({
      holdId: 'hold-1',
      status: 'CONFIRMED',
      classId: 'class-1',
      confirmedAt: new Date().toISOString(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
    });

    const payBtn = screen.getByRole('button', { name: /Pay Now/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('hold-1');
    });
  });

  it('supports in-list cancel action for HELD application', async () => {
    const cancelSpy = vi.spyOn(admissionApi, 'cancelHold').mockResolvedValue(undefined);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
    });

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith('hold-1');
    });
  });

  it('displays localized error when action fails and does not leak raw backend message', async () => {
    vi.spyOn(admissionApi, 'confirmHold').mockRejectedValue(
      new ApiClientError(
        409,
        'HOLD_EXPIRED',
        ERROR_MESSAGES.HOLD_EXPIRED,
        'Raw backend exception message: hold expired at server.',
      ),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Pay Now/i })).toBeTruthy();
    });

    const payBtn = screen.getByRole('button', { name: /Pay Now/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(screen.getByText(ERROR_MESSAGES.HOLD_EXPIRED)).toBeTruthy();
    });

    expect(screen.queryByText(/Raw backend exception message/i)).toBeNull();
  });
});
