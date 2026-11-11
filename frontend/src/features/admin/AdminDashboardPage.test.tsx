import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, cleanup } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { AdminDashboardPage } from './AdminDashboardPage';
import { renderWithProviders } from '../../test/testUtils';
import * as admissionApi from '../../api/admissionApi';

describe('AdminDashboardPage', () => {
  const mockClasses: admissionApi.AdmissionClassDto[] = [
    {
      id: 'class-1',
      name: 'Class 6 - Morning Shift',
      totalSeats: 100,
      heldSeats: 20,
      confirmedSeats: 30,
      availableSeats: 50,
      holdDurationSeconds: 600,
    },
    {
      id: 'class-2',
      name: 'Class 7 - Day Shift',
      totalSeats: 50,
      heldSeats: 10,
      confirmedSeats: 15,
      availableSeats: 25,
      holdDurationSeconds: 600,
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(admissionApi, 'fetchClasses').mockResolvedValue(mockClasses);
  });

  afterEach(() => {
    cleanup();
  });

  function renderPage() {
    return renderWithProviders(
      <Routes>
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/classes/new" element={<div>Create Class Mock</div>} />
      </Routes>,
      { initialEntries: ['/admin'] },
    );
  }

  it('aggregates total classes, total seats, held seats and confirmed seats correctly', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('tile-class-shifts')).toBeTruthy();
    });

    // 2 classes
    const classShiftsTile = screen.getByTestId('tile-class-shifts');
    expect(classShiftsTile.textContent).toContain('2');

    // Total seats: 100 + 50 = 150
    const totalSeatsTile = screen.getByTestId('tile-total-seats');
    expect(totalSeatsTile.textContent).toContain('150');

    // Held seats: 20 + 10 = 30
    const heldSeatsTile = screen.getByTestId('tile-held-seats');
    expect(heldSeatsTile.textContent).toContain('30');

    // Confirmed seats: 30 + 15 = 45
    const confirmedSeatsTile = screen.getByTestId('tile-confirmed-seats');
    expect(confirmedSeatsTile.textContent).toContain('45');
  });

  it('renders individual class breakdown cards', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
      expect(screen.getByText('Class 7 - Day Shift')).toBeTruthy();
    });
  });

  it('handles empty state when no classes exist', async () => {
    vi.spyOn(admissionApi, 'fetchClasses').mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No class shifts configured/i)).toBeTruthy();
      expect(screen.getByRole('button', { name: /Create first class/i })).toBeTruthy();
    });
  });

  it('handles error state when backend fetch fails', async () => {
    vi.spyOn(admissionApi, 'fetchClasses').mockRejectedValue(
      new Error('Failed to connect to database'),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load dashboard data/i)).toBeTruthy();
      expect(screen.getByText(/Failed to connect to database/i)).toBeTruthy();
    });
  });
});
