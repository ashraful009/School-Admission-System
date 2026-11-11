import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Button,
  ProgressBar,
  Banner,
  Skeleton,
  EmptyState,
} from '../../shared/components';
import {
  fetchClassById,
  createHold,
  type AdmissionClassDto,
} from '../../api/admissionApi';
import { ApiClientError } from '../../api/client';
import { useActiveApplication } from '../../shared/hooks/useActiveApplication';
import { useTranslation } from '../../shared/i18n';

export const ClassDetailsPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, tClass } = useTranslation();

  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll this class every 5 seconds (Requirement U3, A3)
  const {
    data: classData,
    isLoading: classLoading,
    isError: classIsError,
    error: classError,
    refetch: refetchClass,
  } = useQuery<AdmissionClassDto>({
    queryKey: ['classDetails', classId],
    queryFn: () => {
      if (!classId) throw new Error('Missing class ID');
      return fetchClassById(classId);
    },
    refetchInterval: 5000,
    retry: 1,
    enabled: Boolean(classId),
  });

  // Shared active applications hook
  const {
    getActiveHoldForClass,
  } = useActiveApplication();

  // Apply handler (A4)
  const handleApply = async () => {
    if (!classId || isApplying) return;
    setIsApplying(true);
    setErrorMessage(null);

    try {
      const hold = await createHold(classId);
      // Immediately invalidate queries so UI state is fresh across pages
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['classDetails', classId] });
      await queryClient.invalidateQueries({ queryKey: ['myHolds'] });
      navigate(`/holds/${hold.holdId}`);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to apply. Please try again.');
      }
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classDetails', classId] });
      queryClient.invalidateQueries({ queryKey: ['myHolds'] });
    } finally {
      setIsApplying(false);
    }
  };

  // 1. Loading Skeleton
  if (classLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
        <Skeleton variant="text" width={180} />
        <Skeleton variant="title" width="60%" className="h-10" />
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="rect" height={24} className="rounded-full my-2" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Skeleton variant="card" className="h-28" />
          <Skeleton variant="card" className="h-28" />
          <Skeleton variant="card" className="h-28" />
          <Skeleton variant="card" className="h-28" />
        </div>
        <Skeleton variant="card" className="h-64" />
      </div>
    );
  }

  // 2. Friendly Not-Found / Error State (Deliverable: unknown class shows a friendly not-found state)
  if (classIsError || !classData) {
    const is404 =
      classError instanceof ApiClientError
        ? classError.status === 404
        : false;

    return (
      <div className="max-w-2xl mx-auto py-12">
        <EmptyState
          title={is404 ? 'Class not found' : 'Unable to load class details'}
          description={
            is404
              ? 'The admission class you are looking for does not exist or may have been removed.'
              : classError instanceof Error
              ? classError.message
              : 'Failed to connect to the admission server. Please check your connection and retry.'
          }
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.8"
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
          action={
            <div className="flex gap-3">
              <Link to="/">
                <Button variant="primary">Back to Classes</Button>
              </Link>
              {!is404 && (
                <Button variant="secondary" onClick={() => refetchClass()}>
                  Retry
                </Button>
              )}
            </div>
          }
        />
      </div>
    );
  }

  // Derived metrics
  const takenSeats = classData.heldSeats + classData.confirmedSeats;
  const occupancyPercent =
    classData.totalSeats > 0 ? Math.round((takenSeats / classData.totalSeats) * 100) : 0;

  // Mockup Correction 7: derive N minutes from holdDurationSeconds
  const durationMinutes = Math.max(1, Math.round(classData.holdDurationSeconds / 60));

  const activeHoldForThisClass = classData ? getActiveHoldForClass(classData.id) : null;
  const hasActiveInThisClass = Boolean(activeHoldForThisClass);
  const isSeatsFull = classData.availableSeats <= 0;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm text-[#7A7396] font-medium" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-[#4B22A6] transition-colors">
          {t('nav_classes')}
        </Link>
        <span className="text-[#A59FBA]">/</span>
        <span className="text-[#241A3F] font-semibold truncate">{tClass(classData.name)}</span>
      </nav>

      {/* Active Application in this class banner */}
      {hasActiveInThisClass && activeHoldForThisClass && (
        <Banner
          variant={activeHoldForThisClass.status === 'CONFIRMED' ? 'success' : 'info'}
          title={activeHoldForThisClass.status === 'CONFIRMED' ? t('status_confirmed') : t('status_held')}
          message={
            activeHoldForThisClass.status === 'CONFIRMED'
              ? t('banner_confirmed_enrolled', { class: tClass(classData.name) })
              : t('banner_active_application', { class: tClass(classData.name) })
          }
          action={
            <Link to={`/holds/${activeHoldForThisClass.holdId}`}>
              <Button size="sm" variant={activeHoldForThisClass.status === 'CONFIRMED' ? 'primary' : 'secondary'}>
                {t('view_application')}
              </Button>
            </Link>
          }
        />
      )}

      {/* Dismissible Error Notice */}
      {errorMessage && (
        <Banner
          variant="error"
          title="Application Notice"
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Class Title & FCFS Hint (Mockup Correction 7) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 className="text-2xl sm:text-4xl font-bold font-['Poppins'] text-[#241A3F] tracking-tight">
            {tClass(classData.name)}
          </h1>
          <span className="text-xs text-[#7A7396] font-medium self-start sm:self-auto bg-[#E4DBF7]/50 px-2.5 py-1 rounded-full">
            Auto-refreshes every 5s
          </span>
        </div>
        <p className="text-sm sm:text-base text-[#7A7396]">
          {t('details_fcfs_notice', { min: durationMinutes })}
        </p>
      </div>

      {/* Progress Bar & Occupancy Label */}
      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex justify-between items-center text-sm font-semibold text-[#7A7396]">
          <span>
            <strong className="text-[#241A3F] font-mono">{takenSeats}</strong> /{' '}
            <strong className="text-[#241A3F] font-mono">{classData.totalSeats}</strong> {t('label_total')}
          </span>
          <span className="font-mono text-[#4B22A6]">{occupancyPercent}%</span>
        </div>

        <ProgressBar
          confirmed={classData.confirmedSeats}
          held={classData.heldSeats}
          max={classData.totalSeats}
          height="lg"
        />

        <div className="flex items-center justify-between text-xs text-[#7A7396] pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1D7A4A]" />
            <span>{t('label_confirmed')}:</span>
            <span className="font-semibold font-mono text-[#241A3F]">{classData.confirmedSeats}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#683DD0]" />
            <span>{t('label_held')}:</span>
            <span className="font-semibold font-mono text-[#241A3F]">{classData.heldSeats}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#E0D9F0]" />
            <span>{t('label_available')}:</span>
            <span className="font-semibold font-mono text-[#4B22A6]">{classData.availableSeats}</span>
          </div>
        </div>
      </Card>

      {/* 4 Summary Tiles: Total, Held, Confirmed, Available */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total Tile */}
        <Card padding="sm" className="flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#7A7396]">
            {t('details_tile_total')}
          </span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#241A3F] mt-2">
            {classData.totalSeats}
          </div>
        </Card>

        {/* Held Tile */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7A7396]">
            <span className="w-2 h-2 rounded-full bg-[#683DD0]" />
            <span>{t('label_held')}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#683DD0] mt-2">
            {classData.heldSeats}
          </div>
        </Card>

        {/* Confirmed Tile */}
        <Card padding="sm" className="flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7A7396]">
            <span className="w-2 h-2 rounded-full bg-[#1D7A4A]" />
            <span>{t('label_confirmed')}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#1D7A4A] mt-2">
            {classData.confirmedSeats}
          </div>
        </Card>

        {/* Available Tile */}
        <Card padding="sm" className="flex flex-col justify-between bg-gradient-to-br from-[#F7F4FC] to-[#EEEAF6]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#4B22A6]">
            {t('label_available')}
          </span>
          <div className="text-2xl sm:text-3xl font-bold font-mono text-[#4B22A6] mt-2">
            {classData.availableSeats}
          </div>
        </Card>
      </section>

      {/* Hero Apply Card: Big Available Number + Apply Button + One Seat Per Class Rule (S21, D16) */}
      <Card padding="lg" className="flex flex-col items-center justify-center text-center gap-6 mt-2">
        <div className="flex flex-col items-center">
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#7A7396] mb-1">
            {t('details_big_available')}
          </span>
          <div
            className={`text-6xl sm:text-8xl font-bold font-mono tracking-tight ${
              classData.availableSeats > 0 ? 'text-[#4B22A6]' : 'text-[#B03A5B]'
            }`}
          >
            {classData.availableSeats}
          </div>
          <span className="text-xs sm:text-sm text-[#7A7396] mt-1">
            {t('details_big_available_sub')}
          </span>
        </div>

        {/* Action Button */}
        <div className="w-full max-w-sm flex flex-col items-center gap-2">
          {hasActiveInThisClass && activeHoldForThisClass ? (
            <div className="w-full flex flex-col items-center gap-1.5">
              <Button
                disabled
                variant="secondary"
                size="lg"
                fullWidth
                className="cursor-not-allowed opacity-75"
                title={t('btn_already_applied')}
              >
                {t('btn_already_applied')}
              </Button>
              <Link
                to={`/holds/${activeHoldForThisClass.holdId}`}
                className="text-sm font-semibold text-[#683DD0] hover:underline py-1"
              >
                {t('view_application')} →
              </Link>
            </div>
          ) : isSeatsFull ? (
            <Button
              disabled
              variant="secondary"
              size="lg"
              fullWidth
              className="cursor-not-allowed opacity-75"
              title="All seats in this class are currently held or confirmed"
            >
              {t('btn_class_full')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              isLoading={isApplying}
              onClick={handleApply}
            >
              {t('details_apply_btn')}
            </Button>
          )}

          {/* Text under the button */}
          <p className="text-xs sm:text-sm text-[#7A7396] mt-2 font-medium text-center">
            {t('details_one_seat_note')}
          </p>
        </div>
      </Card>
    </div>
  );
};
