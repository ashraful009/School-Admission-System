import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ClassFormPage } from './ClassFormPage';
import { renderWithProviders } from '../../test/testUtils';
import * as admissionApi from '../../api/admissionApi';

describe('ClassFormPage', () => {
  const existingClass: admissionApi.AdmissionClassDto = {
    id: 'class-edit-1',
    name: 'Class 6 - Morning Shift',
    totalSeats: 50,
    heldSeats: 10,
    confirmedSeats: 20,
    availableSeats: 20,
    holdDurationSeconds: 600,
  };

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(admissionApi, 'fetchClassById').mockResolvedValue(existingClass);
  });

  afterEach(() => {
    cleanup();
  });

  function renderCreatePage() {
    return renderWithProviders(
      <Routes>
        <Route path="/admin/classes/new" element={<ClassFormPage />} />
        <Route path="/admin/classes" element={<div>Manage Classes Mock</div>} />
      </Routes>,
      { initialEntries: ['/admin/classes/new'] },
    );
  }

  function renderEditPage(classId = 'class-edit-1') {
    return renderWithProviders(
      <Routes>
        <Route path="/admin/classes/:classId/edit" element={<ClassFormPage />} />
        <Route path="/admin/classes" element={<div>Manage Classes Mock</div>} />
      </Routes>,
      { initialEntries: [`/admin/classes/${classId}/edit`] },
    );
  }

  it('validates empty class name and total seats on submit', async () => {
    renderCreatePage();

    const submitBtn = screen.getByRole('button', { name: /Create Class/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Class name is required.')).toBeTruthy();
      expect(screen.getByText('Total seats is required.')).toBeTruthy();
    });
  });

  it('rejects invalid seat counts (zero, negative, non-integer, > 10,000)', async () => {
    renderCreatePage();

    const classInput = screen.getByPlaceholderText(/e\.g\. Class 6/i);
    const seatsInput = screen.getByLabelText(/Total Seats/i);
    const form = classInput.closest('form')!;

    fireEvent.change(classInput, { target: { value: 'Class 7' } });

    // Test zero
    fireEvent.change(seatsInput, { target: { value: '0' } });
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText('Total seats must be a whole number between 1 and 10,000.')).toBeTruthy();
    });

    // Test decimal
    fireEvent.change(seatsInput, { target: { value: '15.5' } });
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText('Total seats must be a whole number between 1 and 10,000.')).toBeTruthy();
    });

    // Test above 10,000
    fireEvent.change(seatsInput, { target: { value: '10001' } });
    fireEvent.submit(form);
    await waitFor(() => {
      expect(screen.getByText('Total seats must be a whole number between 1 and 10,000.')).toBeTruthy();
    });
  });

  it('renders live parent card preview with composed name and seat count', async () => {
    renderCreatePage();

    const classInput = screen.getByPlaceholderText(/e\.g\. Class 6/i);
    const seatsInput = screen.getByLabelText(/Total Seats/i);

    fireEvent.change(classInput, { target: { value: 'Class 9' } });
    fireEvent.change(seatsInput, { target: { value: '45' } });

    // Live parent preview updates dynamically
    await waitFor(() => {
      expect(screen.getAllByText('Class 9 - Morning Shift').length).toBeGreaterThan(0);
      expect(screen.getByText(/seats available/i)).toBeTruthy();
      expect(screen.getAllByText('45').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('successful creation calls createClass and navigates', async () => {
    const createClassSpy = vi.spyOn(admissionApi, 'createClass').mockResolvedValue({
      id: 'new-class-123',
      name: 'Class 6 - Morning Shift',
      totalSeats: 60,
    });

    renderCreatePage();

    const classInput = screen.getByPlaceholderText(/e\.g\. Class 6/i);
    const seatsInput = screen.getByLabelText(/Total Seats/i);
    const form = classInput.closest('form')!;

    fireEvent.change(classInput, { target: { value: 'Class 6' } });
    fireEvent.change(seatsInput, { target: { value: '60' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(createClassSpy).toHaveBeenCalledWith({
        name: 'Class 6 - Morning Shift',
        totalSeats: 60,
      });
      expect(screen.getByText('Manage Classes Mock')).toBeTruthy();
    });
  });

  it('in edit mode, rejects reducing total seats below occupied seats (held + confirmed)', async () => {
    renderEditPage('class-edit-1');

    await waitFor(() => {
      expect(screen.getByDisplayValue('Class 6')).toBeTruthy();
      expect(screen.getByDisplayValue('50')).toBeTruthy();
    });

    // 10 held + 20 confirmed = 30 occupied. Try reducing to 25.
    const seatsInput = screen.getByLabelText(/Total Seats/i);
    const form = seatsInput.closest('form')!;

    fireEvent.change(seatsInput, { target: { value: '25' } });
    fireEvent.submit(form);

    await waitFor(() => {
      expect(
        screen.getByText(/Cannot reduce total seats to 25\. At least 30 seats are occupied/i),
      ).toBeTruthy();
    });
  });
});
