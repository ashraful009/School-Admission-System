import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { StudentIdentityPage } from './StudentIdentityPage';
import { STUDENT_ID_KEY, clearStoredStudentId, isValidStudentId } from '../../api/client';

describe('isValidStudentId', () => {
  it('accepts exactly 17 digits', () => {
    expect(isValidStudentId('20051234567890123')).toBe(true);
  });

  it.each([
    ['16 digits', '2005123456789012'],
    ['18 digits', '200512345678901234'],
    ['letters', '2005123456789012a'],
    ['empty', ''],
    ['inner space', '20051234 67890123'],
  ])('rejects %s', (_label, value) => {
    expect(isValidStudentId(value)).toBe(false);
  });
});

describe('StudentIdentityPage', () => {
  beforeEach(() => clearStoredStudentId());
  afterEach(() => cleanup());

  function renderPage() {
    render(
      <MemoryRouter initialEntries={['/identity']}>
        <Routes>
          <Route path="/identity" element={<StudentIdentityPage />} />
          <Route path="/" element={<p>Classes page</p>} />
        </Routes>
      </MemoryRouter>,
    );
    return {
      input: screen.getByLabelText('Birth Registration Number') as HTMLInputElement,
      button: screen.getByRole('button', { name: 'Continue to Classes' }) as HTMLButtonElement,
    };
  }

  it('keeps Continue disabled until 17 digits and strips non-digits', () => {
    const { input, button } = renderPage();

    fireEvent.change(input, { target: { value: '12345abc' } });
    expect(input.value).toBe('12345');
    expect(screen.getByText(/Only numeric digits/)).toBeTruthy();
    expect(button.disabled).toBe(true);

    fireEvent.change(input, { target: { value: '20051234567890123' } });
    expect(button.disabled).toBe(false);
  });

  it('stores a valid id and navigates to the classes page', () => {
    const { input, button } = renderPage();

    fireEvent.change(input, { target: { value: '20051234567890123' } });
    fireEvent.click(button);

    expect(localStorage.getItem(STUDENT_ID_KEY)).toBe('20051234567890123');
    expect(screen.getByText('Classes page')).toBeTruthy();
  });
});

