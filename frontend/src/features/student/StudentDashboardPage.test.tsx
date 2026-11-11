import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { StudentDashboardPage } from './StudentDashboardPage';
import { renderWithProviders } from '../../test/testUtils';
import * as admissionApi from '../../api/admissionApi';
import { ApiClientError } from '../../api/client';
import { ERROR_MESSAGES, ERROR_MESSAGES_BN } from '../../shared/messages';
import { LANG_STORAGE_KEY } from '../../shared/i18n';

describe('StudentDashboardPage', () => {
  const mockClasses: admissionApi.AdmissionClassDto[] = [
    {
      id: 'class-1',
      name: 'Class 6 - Morning Shift',
      totalSeats: 50,
      heldSeats: 10,
      confirmedSeats: 15,
      availableSeats: 25,
      holdDurationSeconds: 600,
    },
    {
      id: 'class-2',
      name: 'Class 7 - Day Shift',
      totalSeats: 30,
      heldSeats: 10,
      confirmedSeats: 20,
      availableSeats: 0, // Full
      holdDurationSeconds: 600,
    },
    {
      id: 'class-3',
      name: 'Class 8 - Day Shift',
      totalSeats: 40,
      heldSeats: 5,
      confirmedSeats: 5,
      availableSeats: 30,
      holdDurationSeconds: 600,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(admissionApi, 'fetchClasses').mockResolvedValue(mockClasses);
    vi.spyOn(admissionApi, 'fetchMyHolds').mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders classes from mocked GET /classes and displays seat metrics', async () => {
    renderWithProviders(<StudentDashboardPage />);

    // Wait for classes to load
    await waitFor(() => {
      expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
      expect(screen.getByText('Class 7 - Day Shift')).toBeTruthy();
      expect(screen.getByText('Class 8 - Day Shift')).toBeTruthy();
    });

    // Check summary seat counts: 25 available out of 50 total for Class 1
    expect(screen.getByText('25')).toBeTruthy();
    expect(screen.getByText('30')).toBeTruthy();
  });

  it('disables Apply button for full class', async () => {
    renderWithProviders(<StudentDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Class 7 - Day Shift')).toBeTruthy();
    });

    // Class 2 is full: button displays 'Class Full' and is disabled
    const fullBtn = screen.getByRole('button', { name: /Class Full/i });
    expect(fullBtn).toBeTruthy();
    expect((fullBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows empty state when no classes are returned', async () => {
    vi.spyOn(admissionApi, 'fetchClasses').mockResolvedValue([]);

    renderWithProviders(<StudentDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/No admission classes available/i)).toBeTruthy();
    });
  });

  it('shows error banner when classes fetch fails', async () => {
    vi.spyOn(admissionApi, 'fetchClasses').mockRejectedValue(
      new Error('Network connection timeout'),
    );

    renderWithProviders(<StudentDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Network connection timeout/i)).toBeTruthy();
    });
  });

  describe('Task 2 — Global in-flight apply guard & sequential submissions', () => {
    it('starting an application for Class A disables Class B Apply button', async () => {
      // Create a pending promise for createHold to keep it in-flight
      let resolveHold: (val: admissionApi.CreateHoldResponseDto) => void;
      const pendingPromise = new Promise<admissionApi.CreateHoldResponseDto>((resolve) => {
        resolveHold = resolve;
      });

      vi.spyOn(admissionApi, 'createHold').mockImplementation(() => pendingPromise);

      renderWithProviders(<StudentDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
      });

      const applyButtons = screen.getAllByRole('button', { name: /Apply for Seat/i });
      expect(applyButtons.length).toBe(2); // Class 1 and Class 3 (Class 2 is full)

      const class1Btn = applyButtons[0];
      const class3Btn = applyButtons[1];

      // Click apply on Class 1
      fireEvent.click(class1Btn);

      // Class 1 button shows loading indicator
      await waitFor(() => {
        expect(class1Btn.textContent).toContain('Loading...');
      });

      // While Class 1 is in-flight, Class 3 button must be disabled
      expect((class3Btn as HTMLButtonElement).disabled).toBe(true);

      // Resolve the in-flight hold to clean up
      resolveHold!({
        holdId: 'hold-123',
        classId: 'class-1',
        studentId: '20051234567890123',
        status: 'HELD',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        className: 'Class 6 - Morning Shift',
        createdAt: new Date().toISOString(),
        serverTime: new Date().toISOString(),
      });
    });

    it('a second click on Class B while Class A is submitting does not initiate another request', async () => {
      let resolveHold: (val: admissionApi.CreateHoldResponseDto) => void;
      const pendingPromise = new Promise<admissionApi.CreateHoldResponseDto>((resolve) => {
        resolveHold = resolve;
      });

      const createHoldSpy = vi.spyOn(admissionApi, 'createHold').mockImplementation(() => pendingPromise);

      renderWithProviders(<StudentDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
      });

      const applyButtons = screen.getAllByRole('button', { name: /Apply for Seat/i });
      const class1Btn = applyButtons[0];
      const class3Btn = applyButtons[1];

      // Click Class 1
      fireEvent.click(class1Btn);
      expect(createHoldSpy).toHaveBeenCalledTimes(1);
      expect(createHoldSpy).toHaveBeenCalledWith('class-1');

      // Attempt second click on Class 3 while Class 1 is in-flight
      fireEvent.click(class3Btn);

      // No second createHold request should be initiated
      expect(createHoldSpy).toHaveBeenCalledTimes(1);

      // Clean up in-flight promise
      resolveHold!({
        holdId: 'hold-123',
        classId: 'class-1',
        studentId: '20051234567890123',
        status: 'HELD',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        className: 'Class 6 - Morning Shift',
        createdAt: new Date().toISOString(),
        serverTime: new Date().toISOString(),
      });
    });

    it('when Class A request fails, buttons become available again', async () => {
      vi.spyOn(admissionApi, 'createHold').mockRejectedValueOnce(
        new ApiClientError(409, 'NO_SEATS_AVAILABLE', ERROR_MESSAGES.NO_SEATS_AVAILABLE, 'No seats left.'),
      );

      renderWithProviders(<StudentDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
      });

      const applyButtons = screen.getAllByRole('button', { name: /Apply for Seat/i });
      const class1Btn = applyButtons[0];
      const class3Btn = applyButtons[1];

      fireEvent.click(class1Btn);

      // Error banner is displayed
      await waitFor(() => {
        expect(screen.getByText(ERROR_MESSAGES.NO_SEATS_AVAILABLE)).toBeTruthy();
      });

      // Buttons are re-enabled
      expect((class1Btn as HTMLButtonElement).disabled).toBe(false);
      expect((class3Btn as HTMLButtonElement).disabled).toBe(false);
    });

    it('after Class A succeeds, student can still apply to Class B (sequential submissions)', async () => {
      const createHoldSpy = vi
        .spyOn(admissionApi, 'createHold')
        .mockResolvedValueOnce({
          holdId: 'hold-1',
          classId: 'class-1',
          studentId: '20051234567890123',
          status: 'HELD',
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          className: 'Class 6 - Morning Shift',
          createdAt: new Date().toISOString(),
          serverTime: new Date().toISOString(),
        })
        .mockResolvedValueOnce({
          holdId: 'hold-2',
          classId: 'class-3',
          studentId: '20051234567890123',
          status: 'HELD',
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          className: 'Class 8 - Day Shift',
          createdAt: new Date().toISOString(),
          serverTime: new Date().toISOString(),
        });

      renderWithProviders(<StudentDashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
      });

      const applyButtons = screen.getAllByRole('button', { name: /Apply for Seat/i });
      const class1Btn = applyButtons[0];
      const class3Btn = applyButtons[1];

      // First apply to Class 1
      fireEvent.click(class1Btn);
      await waitFor(() => {
        expect(createHoldSpy).toHaveBeenCalledWith('class-1');
      });

      // Then apply to Class 3 sequentially
      fireEvent.click(class3Btn);
      await waitFor(() => {
        expect(createHoldSpy).toHaveBeenCalledWith('class-3');
      });

      expect(createHoldSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Task 1 — Bangla localization precedence on dashboard', () => {
    it('displays Bangla error translation when in Bangla mode and backend returns error', async () => {
      localStorage.setItem(LANG_STORAGE_KEY, 'bn');

      vi.spyOn(admissionApi, 'createHold').mockRejectedValueOnce(
        new ApiClientError(
          409,
          'ALREADY_APPLIED_IN_CLASS',
          ERROR_MESSAGES_BN.ALREADY_APPLIED_IN_CLASS,
          'Raw English backend error message: Student has active hold.',
        ),
      );

      renderWithProviders(<StudentDashboardPage />, { lang: 'bn' });

      await waitFor(() => {
        expect(screen.getByText(/ষষ্ঠ শ্রেণি - মর্নিং শিফট/i)).toBeTruthy();
      });

      const applyButtons = screen.getAllByRole('button', { name: /আবেদন করুন/i });
      fireEvent.click(applyButtons[0]);

      // Bangla translation must be displayed in the error banner
      await waitFor(() => {
        expect(screen.getByText(ERROR_MESSAGES_BN.ALREADY_APPLIED_IN_CLASS)).toBeTruthy();
      });

      // Raw English message must NOT be shown
      expect(screen.queryByText(/Raw English backend error message/i)).toBeNull();
    });
  });
});

