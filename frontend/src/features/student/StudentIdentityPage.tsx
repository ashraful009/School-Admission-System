import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Banner } from '../../shared/components';
import { getStoredStudentId, isValidStudentId, setStoredStudentId } from '../../api/client';
import { useTranslation } from '../../shared/i18n';

export const StudentIdentityPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const existingId = getStoredStudentId() || '';
  const [studentId, setStudentId] = useState(existingId);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    // If student ID changes externally (e.g. storage event or Change clicked), sync it
    const handleIdChange = () => {
      setStudentId(getStoredStudentId() || '');
    };
    window.addEventListener('student-id-changed', handleIdChange);
    return () => {
      window.removeEventListener('student-id-changed', handleIdChange);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow control/navigation keys
    if (
      ['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    // Block non-digit keys and display friendly message
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      setError(t('err_digits_only'));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 17);

    // If pasted or entered non-numeric characters
    if (rawVal.length > 0 && /\D/.test(rawVal)) {
      setError(t('err_digits_only'));
    } else if (touched && digitsOnly.length < 17 && digitsOnly.length > 0) {
      setError(t('err_exact_17_digits', { count: digitsOnly.length }));
    } else {
      setError(null);
    }

    setStudentId(digitsOnly);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    const trimmed = studentId.trim();

    if (!trimmed) {
      setError(t('err_enter_id'));
      return;
    }

    if (trimmed.length < 17) {
      setError(t('err_exact_17_digits', { count: trimmed.length }));
      return;
    }

    if (!isValidStudentId(trimmed)) {
      setError(t('err_17_numeric_digits'));
      return;
    }

    // Persist to localStorage with fallback
    setStoredStudentId(trimmed);

    // Navigate to the Classes page (Requirement U6)
    navigate('/');
  };

  const isComplete = studentId.length === 17;

  return (
    <div className="max-w-xl mx-auto py-8 sm:py-16">
      <Card className="flex flex-col gap-6">
        {/* Header matching Mockup 1 */}
        <div className="text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-[#E4DBF7] flex items-center justify-center text-[#4B22A6] mb-3 shadow-inner">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#241A3F]">
            {t('identity_title')}
          </h1>
          <p className="text-sm text-[#7A7396] mt-2 max-w-md leading-relaxed">
            {t('identity_desc')}
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center px-1">
              <label htmlFor="birth-registration-input" className="text-sm font-semibold text-[#241A3F]">
                {t('identity_label')}
              </label>
              {/* Live n / 17 digit counter */}
              <span
                className={`text-xs font-mono font-semibold transition-colors ${
                  isComplete
                    ? 'text-[#1D7A4A]'
                    : studentId.length > 0
                    ? 'text-[#683DD0]'
                    : 'text-[#7A7396]'
                }`}
                aria-live="polite"
              >
                {isComplete
                  ? t('identity_digits_complete', { count: studentId.length })
                  : t('identity_digits_counter', { count: studentId.length })}
              </span>
            </div>

            <Input
              id="birth-registration-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={17}
              placeholder="e.g. 20051234567890123"
              value={studentId}
              onKeyDown={handleKeyDown}
              onChange={handleInputChange}
              error={error || undefined}
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2"
                  />
                </svg>
              }
            />
          </div>

          {/* Context Banner */}
          <Banner
            variant="info"
            title={t('identity_info_title')}
            message={t('identity_info_msg')}
          />

          {/* Continue Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={studentId.length !== 17}
              className="py-4 text-base font-semibold"
            >
              {t('identity_submit')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
