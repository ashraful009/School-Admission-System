import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import {
  I18nProvider,
  useTranslation,
  getTranslation,
  TRANSLATIONS,
  LANG_STORAGE_KEY,
} from './i18n';
import { LanguageToggle } from './components/LanguageToggle';

describe('i18n Dictionary Integrity', () => {
  it('has identical keys for both English and Bangla dictionaries', () => {
    const enKeys = Object.keys(TRANSLATIONS.en).sort();
    const bnKeys = Object.keys(TRANSLATIONS.bn).sort();

    expect(enKeys).toEqual(bnKeys);
    expect(enKeys.length).toBeGreaterThan(40);
  });

  it('interpolates parameters properly in getTranslation', () => {
    const textEn = getTranslation('en', 'seats_left', { count: 5 });
    expect(textEn).toBe('5 left');

    const textBn = getTranslation('bn', 'seats_left', { count: 5 });
    expect(textBn).toBe('5টি বাকি');
  });

  it('gracefully falls back when key is missing', () => {
    const fallback = getTranslation('en', 'NON_EXISTENT_KEY' as any);
    expect(fallback).toBe('NON_EXISTENT_KEY');
  });
});

describe('useTranslation & I18nProvider', () => {
  it('defaults to English when no language is saved in localStorage', () => {
    localStorage.removeItem(LANG_STORAGE_KEY);
    const { result } = renderHook(() => useTranslation(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });

    expect(result.current.lang).toBe('en');
    expect(result.current.t('brand_name')).toBe('School Admission');
  });

  it('switches to Bangla and persists to localStorage', () => {
    localStorage.removeItem(LANG_STORAGE_KEY);
    const { result } = renderHook(() => useTranslation(), {
      wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider>,
    });

    act(() => {
      result.current.setLang('bn');
    });

    expect(result.current.lang).toBe('bn');
    expect(result.current.t('brand_name')).toBe('স্কুল ভর্তি');
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe('bn');
  });

  it('falls back to English when rendered outside I18nProvider', () => {
    const { result } = renderHook(() => useTranslation());

    expect(result.current.lang).toBe('en');
    expect(result.current.t('brand_name')).toBe('School Admission');
  });
});

describe('LanguageToggle component', () => {
  it('renders EN and Bangla buttons and switches language on click', () => {
    localStorage.removeItem(LANG_STORAGE_KEY);

    const TestComponent = () => {
      const { t } = useTranslation();
      return (
        <div>
          <LanguageToggle />
          <span data-testid="label">{t('brand_name')}</span>
        </div>
      );
    };

    render(
      <I18nProvider>
        <TestComponent />
      </I18nProvider>,
    );

    const label = screen.getByTestId('label');
    const enButton = screen.getByRole('button', { name: 'EN' });
    const bnButton = screen.getByRole('button', { name: 'বাংলা' });

    // Initial state: English
    expect(label.textContent).toBe('School Admission');
    expect(enButton.getAttribute('aria-pressed')).toBe('true');
    expect(bnButton.getAttribute('aria-pressed')).toBe('false');

    // Click Bangla
    fireEvent.click(bnButton);
    expect(label.textContent).toBe('স্কুল ভর্তি');
    expect(bnButton.getAttribute('aria-pressed')).toBe('true');
    expect(enButton.getAttribute('aria-pressed')).toBe('false');

    // Click English back
    fireEvent.click(enButton);
    expect(label.textContent).toBe('School Admission');
    expect(enButton.getAttribute('aria-pressed')).toBe('true');
  });
});

