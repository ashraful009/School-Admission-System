import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ManageClassesPage } from './ManageClassesPage';
import { renderWithProviders } from '../../test/testUtils';
import * as admissionApi from '../../api/admissionApi';

describe('ManageClassesPage', () => {
  const mockClasses: admissionApi.AdmissionClassDto[] = [
    {
      id: 'class-1',
      name: 'Class 6 - Morning Shift',
      totalSeats: 60,
      heldSeats: 10,
      confirmedSeats: 20,
      availableSeats: 30,
      holdDurationSeconds: 600,
    },
    {
      id: 'class-2',
      name: 'Class 10 - Day Shift',
      totalSeats: 40,
      heldSeats: 5,
      confirmedSeats: 15,
      availableSeats: 20,
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
        <Route path="/admin/classes" element={<ManageClassesPage />} />
        <Route path="/admin/classes/new" element={<div>Create Class Mock</div>} />
        <Route path="/admin/classes/:classId/edit" element={<div>Edit Class Mock</div>} />
      </Routes>,
      { initialEntries: ['/admin/classes'] },
    );
  }

  it('renders class table with seat statistics', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('manage-classes-table')).toBeTruthy();
      expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
      expect(screen.getByText('Class 10 - Day Shift')).toBeTruthy();
    });

    // Class 1 row seat stats
    const row1 = screen.getByTestId('manage-class-row-class-1');
    expect(row1.textContent).toContain('60'); // total
    expect(row1.textContent).toContain('10'); // held
    expect(row1.textContent).toContain('20'); // confirmed
    expect(row1.textContent).toContain('30'); // available
  });

  it('search input filters classes by name', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
      expect(screen.getByText('Class 10 - Day Shift')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText(/Search classes/i);
    fireEvent.change(searchInput, { target: { value: 'Class 10' } });

    // Only Class 10 should be visible
    expect(screen.queryByText('Class 6 - Morning Shift')).toBeNull();
    expect(screen.getByText('Class 10 - Day Shift')).toBeTruthy();

    // Reset search
    fireEvent.change(searchInput, { target: { value: '' } });
    expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
    expect(screen.getByText('Class 10 - Day Shift')).toBeTruthy();
  });

  it('shows no matches card when search finds no results', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Class 6 - Morning Shift')).toBeTruthy();
    });

    const searchInput = screen.getByPlaceholderText(/Search classes/i);
    fireEvent.change(searchInput, { target: { value: 'Non-existent class' } });

    expect(screen.getByText(/No classes match "Non-existent class"/i)).toBeTruthy();
  });

  it('handles empty state when no classes are configured', async () => {
    vi.spyOn(admissionApi, 'fetchClasses').mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/No admission classes configured/i)).toBeTruthy();
    });
  });

  it('handles error state when backend fetch fails', async () => {
    vi.spyOn(admissionApi, 'fetchClasses').mockRejectedValue(
      new Error('Failed to load admission classes from server'),
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Failed to load classes/i)).toBeTruthy();
      expect(screen.getByText(/Failed to load admission classes from server/i)).toBeTruthy();
    });
  });
});

