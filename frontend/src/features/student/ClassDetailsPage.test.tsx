import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ClassDetailsPage } from './ClassDetailsPage';
import { renderWithProviders } from '../../test/testUtils';
import * as admissionApi from '../../api/admissionApi';
import { ApiClientError } from '../../api/client';
import { ERROR_MESSAGES, ERROR_MESSAGES_BN } from '../../shared/messages';

describe('ClassDetailsPage', () => {
  const mockClass: admissionApi.AdmissionClassDto = {
    id: 'class-1',
    name: 'Class 6 - Morning Shift',
    totalSeats: 60,
    heldSeats: 15,
    confirmedSeats: 25,
    availableSeats: 20,
    holdDurationSeconds: 600,
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(admissionApi, 'fetchClassById').mockResolvedValue(mockClass);
    vi.spyOn(admissionApi, 'fetchMyHolds').mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  function renderPage(classId = 'class-1', lang: 'en' | 'bn' = 'en') {
    return renderWithProviders(
      <Routes>
        <Route path="/classes/:classId" element={<ClassDetailsPage />} />
        <Route path="/holds/:holdId" element={<div>Hold Page Mock</div>} />
        <Route path="/" element={<div>Dashboard Mock</div>} />
      </Routes>,
      { initialEntries: [`/classes/${classId}`], lang },
    );
  }

  it('renders class capacity breakdown metrics', async () => {
    renderPage('class-1');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Class 6 - Morning Shift/i }),
      ).toBeTruthy();
    });

    // Check summary metrics
    expect(screen.getAllByText('60').length).toBeGreaterThan(0); // Total
    expect(screen.getAllByText('15').length).toBeGreaterThan(0); // Held
    expect(screen.getAllByText('25').length).toBeGreaterThan(0); // Confirmed
    expect(screen.getAllByText('20').length).toBeGreaterThan(0); // Available
  });

  it('displays friendly not-found state for an unknown class (404)', async () => {
    vi.spyOn(admissionApi, 'fetchClassById').mockRejectedValue(
      new ApiClientError(404, 'NOT_FOUND', ERROR_MESSAGES.NOT_FOUND, 'Class not found'),
    );

    renderPage('unknown-class');

    await waitFor(
      () => {
        expect(screen.getByText(/Class not found/i)).toBeTruthy();
        expect(screen.getByText(/The admission class you are looking for does not exist/i)).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('apply action calls createHold with the correct classId', async () => {
    const createHoldSpy = vi.spyOn(admissionApi, 'createHold').mockResolvedValue({
      holdId: 'hold-abc',
      classId: 'class-1',
      studentId: '20051234567890123',
      status: 'HELD',
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      className: 'Class 6 - Morning Shift',
      createdAt: new Date().toISOString(),
      serverTime: new Date().toISOString(),
    });

    renderPage('class-1');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Class 6 - Morning Shift/i }),
      ).toBeTruthy();
    });

    const applyBtn = screen.getByRole('button', { name: /Apply for this Seat/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(createHoldSpy).toHaveBeenCalledWith('class-1');
      expect(screen.getByText('Hold Page Mock')).toBeTruthy();
    });
  });

  it('handles full-class error and displays error message', async () => {
    vi.spyOn(admissionApi, 'createHold').mockRejectedValue(
      new ApiClientError(409, 'NO_SEATS_AVAILABLE', ERROR_MESSAGES.NO_SEATS_AVAILABLE, 'No seats left'),
    );

    renderPage('class-1');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /Class 6 - Morning Shift/i }),
      ).toBeTruthy();
    });

    const applyBtn = screen.getByRole('button', { name: /Apply for this Seat/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(ERROR_MESSAGES.NO_SEATS_AVAILABLE)).toBeTruthy();
    });
  });

  it('handles duplicate-application error and displays localized Bangla error without raw English leak', async () => {
    vi.spyOn(admissionApi, 'createHold').mockRejectedValue(
      new ApiClientError(
        409,
        'ALREADY_APPLIED_IN_CLASS',
        ERROR_MESSAGES_BN.ALREADY_APPLIED_IN_CLASS,
        'Raw backend exception message: duplicate active application.',
      ),
    );

    renderPage('class-1', 'bn');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: /ষষ্ঠ শ্রেণি - মর্নিং শিফট/i }),
      ).toBeTruthy();
    });

    const applyBtn = screen.getByRole('button', { name: /এই আসনের জন্য আবেদন করুন/i });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(screen.getByText(ERROR_MESSAGES_BN.ALREADY_APPLIED_IN_CLASS)).toBeTruthy();
    });

    // Raw English text should NOT be rendered
    expect(screen.queryByText(/Raw backend exception message/i)).toBeNull();
  });
});
