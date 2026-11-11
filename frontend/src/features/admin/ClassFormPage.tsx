import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Button,
  Input,
  ProgressBar,
  Banner,
  Skeleton,
  EmptyState,
} from '../../shared/components';
import {
  fetchClassById,
  createClass,
  updateClass,
  type AdmissionClassDto,
} from '../../api/admissionApi';
import { ApiClientError } from '../../api/client';
import { useTranslation } from '../../shared/i18n';

const KNOWN_SHIFTS = ['Morning Shift', 'Day Shift'] as const;
type ShiftType = (typeof KNOWN_SHIFTS)[number];

export const ClassFormPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { classId } = useParams<{ classId?: string }>();
  const isEditMode = Boolean(classId);

  // Form states
  const [classField, setClassField] = useState('');
  const [shift, setShift] = useState<ShiftType>('Morning Shift');
  const [totalSeats, setTotalSeats] = useState('');

  // Status & Validation states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<{
    classField?: string;
    totalSeats?: string;
  }>({});

  // In edit mode: fetch existing class details (A3)
  const {
    data: existingClass,
    isLoading: isFetchingClass,
    isError: isFetchError,
    error: fetchError,
  } = useQuery<AdmissionClassDto>({
    queryKey: ['class', classId],
    queryFn: () => fetchClassById(classId!),
    enabled: isEditMode && Boolean(classId),
  });

  // Populate form fields in edit mode
  useEffect(() => {
    if (existingClass) {
      // Split name if it matches <text> - <known shift>; otherwise entire name into classField
      const match = existingClass.name.match(/^(.*?)\s*-\s*(Morning Shift|Day Shift)$/);
      if (match) {
        setClassField(match[1]);
        setShift(match[2] as ShiftType);
      } else {
        setClassField(existingClass.name);
        setShift('Morning Shift');
      }
      setTotalSeats(existingClass.totalSeats.toString());
    }
  }, [existingClass]);

  // Composed name for API and live preview
  const trimmedClass = classField.trim();
  const composedName = trimmedClass ? `${trimmedClass} - ${shift}` : '';

  // Occupied seats for preview and validation
  const existingHeld = existingClass?.heldSeats || 0;
  const existingConfirmed = existingClass?.confirmedSeats || 0;
  const existingOccupied = existingHeld + existingConfirmed;

  const seatsNum = Number(totalSeats) || 0;
  const previewAvailable = isEditMode
    ? Math.max(0, seatsNum - existingOccupied)
    : seatsNum;

  // Validation function mirroring backend rules (Section 6 & 7)
  const validateForm = (): boolean => {
    const errors: { classField?: string; totalSeats?: string } = {};

    if (!trimmedClass) {
      errors.classField = 'Class name is required.';
    } else if (composedName.length > 100) {
      errors.classField = `Full class name cannot exceed 100 characters (currently ${composedName.length}).`;
    }

    if (!totalSeats.trim()) {
      errors.totalSeats = 'Total seats is required.';
    } else {
      const parsed = Number(totalSeats);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10000) {
        errors.totalSeats = 'Total seats must be a whole number between 1 and 10,000.';
      } else if (isEditMode && parsed < existingOccupied) {
        errors.totalSeats = `Cannot reduce total seats to ${parsed}. At least ${existingOccupied} seats are occupied (${existingHeld} held, ${existingConfirmed} confirmed).`;
      }
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit handler (A1 for Create, A9 for Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    const seats = Number(totalSeats);

    try {
      if (isEditMode && classId) {
        await updateClass(classId, {
          name: composedName,
          totalSeats: seats,
        });

        // Invalidate queries so class lists and details update immediately
        await queryClient.invalidateQueries({ queryKey: ['classes'] });
        await queryClient.invalidateQueries({ queryKey: ['class', classId] });

        navigate('/admin/classes', {
          state: {
            successMessage: `Class "${composedName}" was updated successfully.`,
          },
        });
      } else {
        await createClass({
          name: composedName,
          totalSeats: seats,
        });

        // Invalidate queries so new class appears on list within 5s
        await queryClient.invalidateQueries({ queryKey: ['classes'] });

        navigate('/admin/classes', {
          state: {
            successMessage: `Class "${composedName}" with ${seats} seats was created successfully.`,
          },
        });
      }
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.code === 'TOTAL_SEATS_BELOW_OCCUPIED' && existingOccupied !== undefined) {
          // Plain language friendly message with minimum allowed in active language
          setServerError(
            t('form_err_seats_below_occupied', {
              count: existingOccupied,
              held: existingHeld ?? 0,
              confirmed: existingConfirmed ?? 0,
            }) || err.message
          );
        } else {
          setServerError(err.message || 'Failed to save class. Please check your inputs.');
        }
      } else {
        setServerError('An unexpected error occurred while saving. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditMode && isFetchingClass) {
    return (
      <div className="flex flex-col gap-6 py-4">
        <Skeleton variant="title" width="40%" />
        <Skeleton variant="card" className="h-96" />
      </div>
    );
  }

  if (isEditMode && isFetchError) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          title="Class not found"
          description={
            fetchError instanceof Error
              ? fetchError.message
              : 'The requested admission class could not be loaded or may have been removed.'
          }
          action={
            <Link to="/admin/classes">
              <Button variant="primary">Back to classes</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-12" data-testid="class-form-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E0D9F0] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/admin/classes"
              className="text-xs font-bold text-[#7A7396] hover:text-[#4B22A6] tracking-wider uppercase font-['Poppins'] transition-colors"
            >
              {t('nav_admin_manage_classes')}
            </Link>
            <span className="text-xs text-[#7A7396]">/</span>
            <span className="text-xs font-bold text-[#683DD0] tracking-wider uppercase font-['Poppins']">
              {isEditMode ? t('form_edit_title') : t('form_create_title')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#241A3F]">
            {isEditMode ? t('form_edit_title') : t('form_create_title')}
          </h1>
          <p className="text-sm text-[#7A7396] mt-0.5">
            {isEditMode ? t('form_edit_subtitle') : t('form_create_subtitle')}
          </p>
        </div>
      </div>

      {/* Server Error Banner */}
      {serverError && (
        <Banner
          variant="error"
          title="Unable to save class"
          message={serverError}
          onDismiss={() => setServerError(null)}
        />
      )}

      {/* Main Two-Column Layout: Form on Left, Live Preview on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form */}
        <div className="lg:col-span-7">
          <Card padding="lg" className="flex flex-col gap-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              {/* Class Field */}
              <Input
                label={t('form_label_class')}
                placeholder={t('form_placeholder_class')}
                value={classField}
                onChange={(e) => {
                  setClassField(e.target.value);
                  if (clientErrors.classField) {
                    setClientErrors((prev) => ({ ...prev, classField: undefined }));
                  }
                }}
                error={clientErrors.classField}
                helperText="Enter class or standard level (1-100 characters combined)"
                autoFocus
              />

              {/* Shift Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="shift-select"
                  className="text-sm font-semibold text-[#241A3F] pl-1 font-['Poppins']"
                >
                  {t('form_label_shift')}
                </label>
                <div className="relative">
                  <select
                    id="shift-select"
                    value={shift}
                    onChange={(e) => setShift(e.target.value as ShiftType)}
                    className="w-full neu-inset px-4 py-3.5 text-[#241A3F] text-base rounded-2xl outline-none focus:ring-2 focus:ring-[#683DD0]/30 transition-all bg-transparent appearance-none cursor-pointer"
                  >
                    {KNOWN_SHIFTS.map((s) => (
                      <option key={s} value={s} className="text-[#241A3F] bg-[#EEEAF6]">
                        {s === 'Morning Shift' ? t('shift_morning') : t('shift_day')}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#7A7396]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-xs text-[#7A7396] pl-1">
                  Class name: <strong className="text-[#4B22A6]">{composedName || '<Class> - <Shift>'}</strong>
                </p>
              </div>

              {/* Total Seats Field */}
              <Input
                label={t('form_label_total_seats')}
                type="number"
                min="1"
                max="10000"
                step="1"
                placeholder="e.g. 20"
                value={totalSeats}
                onChange={(e) => {
                  setTotalSeats(e.target.value);
                  if (clientErrors.totalSeats) {
                    setClientErrors((prev) => ({ ...prev, totalSeats: undefined }));
                  }
                }}
                error={clientErrors.totalSeats}
                helperText={
                  isEditMode
                    ? `Minimum allowed: ${existingOccupied} seats (${existingHeld} held + ${existingConfirmed} confirmed)`
                    : t('form_seats_help')
                }
              />

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-3 border-t border-[#E0D9F0]">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="min-w-[130px]"
                >
                  {isEditMode ? t('form_btn_update') : t('form_btn_create')}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={isSubmitting}
                  onClick={() => navigate('/admin/classes')}
                >
                  {t('form_btn_cancel')}
                </Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Right Column: Live Parent Preview Card */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#7A7396] uppercase tracking-wider font-['Poppins']">
              {t('form_preview_title')}
            </span>
            <span className="text-xs text-[#683DD0] font-semibold bg-[#E4DBF7] px-2 py-0.5 rounded-full">
              {t('nav_student')}
            </span>
          </div>

          <Card padding="md" className="flex flex-col justify-between gap-5 border border-[#E0D9F0]">
            <div className="flex flex-col gap-3">
              {/* Class Name */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold font-['Poppins'] text-[#241A3F] leading-tight">
                  {composedName || 'Class Name - Shift'}
                </h3>
              </div>

              {/* Available Seats Highlight */}
              <div className="text-sm text-[#7A7396]">
                <span
                  className={`font-bold font-mono text-base ${
                    previewAvailable > 0 ? 'text-[#4B22A6]' : 'text-[#B03A5B]'
                  }`}
                >
                  {previewAvailable}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-[#241A3F]">
                  {seatsNum || 0}
                </span>{' '}
                seats available
              </div>

              {/* Multi-segment capacity progress bar */}
              <ProgressBar
                confirmed={existingConfirmed}
                held={existingHeld}
                max={Math.max(1, seatsNum)}
                height="md"
              />

              {/* Breakdown Figures */}
              <div className="flex items-center justify-between text-xs text-[#7A7396] pt-1 border-t border-[#E0D9F0]/50">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#683DD0]" />
                  <span>Held:</span>
                  <span className="font-semibold font-mono text-[#241A3F]">
                    {existingHeld}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#1D7A4A]" />
                  <span>Confirmed:</span>
                  <span className="font-semibold font-mono text-[#241A3F]">
                    {existingConfirmed}
                  </span>
                </div>
              </div>
            </div>

            {/* Preview Action Button */}
            <div className="pt-2 flex flex-col gap-2">
              <Button
                disabled
                variant="secondary"
                fullWidth
                className="opacity-70 cursor-default"
              >
                Apply now (Preview)
              </Button>
              <p className="text-[11px] text-center text-[#7A7396]">
                You can hold one seat per class at a time.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

