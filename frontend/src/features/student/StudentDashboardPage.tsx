import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Button,
  ProgressBar,
  Banner,
  Skeleton,
  EmptyState,
  CountdownRing,
} from '../../shared/components';
import {
  fetchClasses,
  createHold,
  type AdmissionClassDto,
} from '../../api/admissionApi';
import { ApiClientError } from '../../api/client';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { useActiveApplication } from '../../shared/hooks/useActiveApplication';
import { useTranslation } from '../../shared/i18n';

export const StudentDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, tClass } = useTranslation();

  const [applyingClassId, setApplyingClassId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll classes every 5 seconds (Requirement U3, A2)
  const {
    data: classes,
    isLoading: classesLoading,
    isError: classesIsError,
    error: classesError,
    refetch: refetchClasses,
  } = useQuery<AdmissionClassDto[]>({
    queryKey: ['classes'],
    queryFn: () => fetchClasses(),
    refetchInterval: 5000,
  });

  // Shared active applications hook
  const {
    activeApplication,
    hasActiveApplication,
    isHeld,
    isConfirmed,
    activeClassName,
    activeHoldId,
    getActiveHoldForClass,
    isLoading: holdsLoading,
    refetch: refetchHolds,
  } = useActiveApplication();

  // Summary calculations (Correction 4: real sum of availableSeats)
  const totalClassesCount = classes?.length ?? 0;
  const totalAvailableSeats = classes?.reduce((sum, c) => sum + (c.availableSeats || 0), 0) ?? 0;
  const totalCapacitySeats = classes?.reduce((sum, c) => sum + (c.totalSeats || 0), 0) ?? 0;

  // Live timer for active HELD hold
  const { secondsLeft, formattedTime, isExpired: holdIsExpired } = useCountdown({
    expiresAt: isHeld ? activeApplication?.expiresAt : undefined,
    serverTime: isHeld ? activeApplication?.serverTime : undefined,
    createdAt: isHeld ? activeApplication?.createdAt : undefined,
    onExpire: () => {
      refetchHolds();
      refetchClasses();
    },
  });

  // Refetch holds and classes when hold reaches zero
  useEffect(() => {
    if (activeApplication && isHeld && holdIsExpired) {
      refetchHolds();
      refetchClasses();
    }
  }, [activeApplication, isHeld, holdIsExpired, refetchHolds, refetchClasses]);

  // Apply handler (A4) with single in-flight submission guard (Task 2)
  const handleApply = async (classId: string) => {
    // Guard: Prevent multiple simultaneous dashboard apply requests
    if (applyingClassId) return;

    setApplyingClassId(classId);
    setErrorMessage(null);

    try {
      const hold = await createHold(classId);
      // Immediately invalidate queries so UI state is fresh
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['myHolds'] });
      navigate(`/holds/${hold.holdId}`);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to apply. Please try again.');
      }
      // Re-fetch to ensure counters & holds match server
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['myHolds'] });
    } finally {
      setApplyingClassId(null);
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* Neutral Greeting (Mockup Correction 4) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#241A3F]">
            {t('dashboard_title')}
          </h1>
          <p className="text-sm sm:text-base text-[#7A7396] mt-1">
            {t('dashboard_subtitle')}
          </p>
        </div>
      </div>

      {/* Active Application Banner (Requirement S21, D16) */}
      {hasActiveApplication && activeApplication && (
        <Banner
          variant={isConfirmed ? 'success' : 'info'}
          title={isConfirmed ? t('status_confirmed') : t('status_held')}
          message={
            isConfirmed
              ? t('banner_confirmed_enrolled', { class: tClass(activeClassName || '') })
              : t('banner_active_application', { class: tClass(activeClassName || '') })
          }
          action={
            <Link to={`/holds/${activeHoldId}`}>
              <Button size="sm" variant={isConfirmed ? 'primary' : 'secondary'}>
                {t('view_application')}
              </Button>
            </Link>
          }
        />
      )}

      {/* Global / Dismissible Application Error Banner */}
      {errorMessage && (
        <Banner
          variant="error"
          title="Application Notice"
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
        />
      )}

      {/* Classes Fetch Error Banner */}
      {classesIsError && (
        <Banner
          variant="error"
          title="Unable to load classes"
          message={classesError instanceof Error ? classesError.message : 'Failed to connect to the admission server.'}
          action={
            <Button size="sm" variant="secondary" onClick={() => refetchClasses()}>
              Retry
            </Button>
          }
        />
      )}

      {/* Summary Tiles Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {classesLoading || holdsLoading ? (
          <>
            <Skeleton variant="card" className="h-36" />
            <Skeleton variant="card" className="h-36" />
            <Skeleton variant="card" className="h-36" />
          </>
        ) : (
          <>
            {/* Tile 1: Classes Count */}
            <Card padding="md" className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#7A7396]">
                  {t('tile_shifts')}
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#E4DBF7] flex items-center justify-center text-[#4B22A6]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl sm:text-4xl font-bold font-['Poppins'] text-[#241A3F]">
                  {totalClassesCount}
                </div>
                <div className="text-xs text-[#7A7396] mt-1">
                  {t('tile_shifts')}
                </div>
              </div>
            </Card>

            {/* Tile 2: Seats Left (Real sum of availableSeats - Correction 4) */}
            <Card padding="md" className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#7A7396]">
                  {t('tile_available_seats')}
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#D9F0E3] flex items-center justify-center text-[#1D7A4A]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-3xl sm:text-4xl font-bold font-['Poppins'] text-[#4B22A6]">
                  {totalAvailableSeats}
                </div>
                <div className="text-xs text-[#7A7396] mt-1">
                  {t('label_total')}: {totalCapacitySeats}
                </div>
              </div>
            </Card>

            {/* Tile 3: Active Hold Tile (Mockup Correction 6, S21: single active application, no +N more) */}
            <Card padding="md" className="flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#7A7396]">
                  {t('tile_active_hold')}
                </span>
                {hasActiveApplication ? (
                  isConfirmed ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D9F0E3] text-[#1D7A4A]">
                      <span className="w-2 h-2 rounded-full bg-[#1D7A4A]" />
                      {t('status_confirmed')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#E4DBF7] text-[#4B22A6]">
                      <span className="w-2 h-2 rounded-full bg-[#683DD0] animate-pulse" />
                      {t('status_held')}
                    </span>
                  )
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-[#E3DFED] flex items-center justify-center text-[#7A7396]">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div className="mt-3">
                {hasActiveApplication && activeApplication ? (
                  <div className="flex flex-col gap-2">
                    <div className="font-bold text-[#241A3F] truncate text-base font-['Poppins']" title={tClass(activeApplication.className)}>
                      {tClass(activeApplication.className)}
                    </div>

                    {isHeld ? (
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-2">
                          <CountdownRing
                            secondsLeft={secondsLeft}
                            totalSeconds={600}
                            size={46}
                            strokeWidth={4}
                          />
                          <div>
                            <div className="text-lg font-bold font-mono text-[#683DD0] leading-none">
                              {formattedTime}
                            </div>
                            <span className="text-[11px] text-[#7A7396]">{t('hold_time_left')}</span>
                          </div>
                        </div>

                        <Link to={`/holds/${activeApplication.holdId}`}>
                          <Button size="sm" variant="primary">
                            {t('active_hold_view_pay')}
                          </Button>
                        </Link>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <span className="text-xs font-medium text-[#1D7A4A]">
                          {t('status_confirmed')}
                        </span>
                        <Link to={`/holds/${activeApplication.holdId}`}>
                          <Button size="sm" variant="secondary">
                            {t('view_application')}
                          </Button>
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="text-xl font-bold font-['Poppins'] text-[#7A7396]">
                      {t('no_active_hold_title')}
                    </div>
                    <div className="text-xs text-[#7A7396] mt-1">
                      {t('no_active_hold_desc')}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </section>

      {/* Class Cards Section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[#E0D9F0] pb-3">
          <h2 className="text-xl font-bold font-['Poppins'] text-[#241A3F]">
            {t('section_classes_title')}
          </h2>
          <span className="text-xs text-[#7A7396] font-medium hidden sm:inline">
            {t('section_classes_desc')}
          </span>
        </div>

        {classesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="flex flex-col gap-4">
                <Skeleton variant="title" />
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="rect" height={16} />
                <div className="flex justify-between">
                  <Skeleton variant="text" width="30%" />
                  <Skeleton variant="text" width="30%" />
                </div>
                <Skeleton variant="rect" height={44} className="mt-2" />
              </Card>
            ))}
          </div>
        ) : !classes || classes.length === 0 ? (
          <EmptyState
            title="No admission classes available"
            description="There are currently no admission classes configured or open for enrollment."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((admissionClass) => {
              const activeHoldForClass = getActiveHoldForClass(admissionClass.id);
              const hasActiveInThisClass = Boolean(activeHoldForClass);
              const isSeatsFull = admissionClass.availableSeats <= 0;
              const isApplying = applyingClassId === admissionClass.id;
              const isSubmittingAny = Boolean(applyingClassId);
              const isOtherApplying = isSubmittingAny && !isApplying;

              return (
                <Card
                  key={admissionClass.id}
                  padding="md"
                  className="flex flex-col justify-between gap-5 transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex flex-col gap-3">
                    {/* Class Name */}
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/classes/${admissionClass.id}`}
                        className="group"
                        title={`View details for ${admissionClass.name}`}
                      >
                        <h3 className="text-lg font-bold font-['Poppins'] text-[#241A3F] leading-tight group-hover:text-[#4B22A6] transition-colors">
                          {tClass(admissionClass.name)}
                        </h3>
                      </Link>
                    </div>

                    {/* Available Seats Highlight */}
                    <div className="text-sm text-[#7A7396]">
                      <span
                        className={`font-bold font-mono text-base ${
                          admissionClass.availableSeats > 0 ? 'text-[#4B22A6]' : 'text-[#B03A5B]'
                        }`}
                      >
                        {admissionClass.availableSeats}
                      </span>{' '}
                      / {admissionClass.totalSeats} {t('label_available')}
                    </div>

                    {/* Seat Capacity Bar (Held + Confirmed + Available) */}
                    <ProgressBar
                      confirmed={admissionClass.confirmedSeats}
                      held={admissionClass.heldSeats}
                      max={admissionClass.totalSeats}
                      height="md"
                    />

                    {/* Seat Breakdown Numbers */}
                    <div className="flex items-center justify-between text-xs text-[#7A7396] pt-1 border-t border-[#E0D9F0]/50">
                      <div className="flex items-center gap-1.5" title="Currently reserved by students">
                        <span className="w-2 h-2 rounded-full bg-[#683DD0]" />
                        <span>{t('label_held')}:</span>
                        <span className="font-semibold font-mono text-[#241A3F]">
                          {admissionClass.heldSeats}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5" title="Paid and confirmed enrollments">
                        <span className="w-2 h-2 rounded-full bg-[#1D7A4A]" />
                        <span>{t('label_confirmed')}:</span>
                        <span className="font-semibold font-mono text-[#241A3F]">
                          {admissionClass.confirmedSeats}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Button (Section 2.5 & 2.6: per-class restriction) */}
                  <div className="pt-2">
                    {hasActiveInThisClass && activeHoldForClass ? (
                      <div className="flex flex-col gap-1.5">
                        <Button
                          disabled
                          variant="secondary"
                          fullWidth
                          className="cursor-not-allowed opacity-75"
                          title={t('btn_already_applied')}
                        >
                          {t('btn_already_applied')}
                        </Button>
                        <Link
                          to={`/holds/${activeHoldForClass.holdId}`}
                          className="text-xs text-center font-semibold text-[#683DD0] hover:underline py-0.5"
                        >
                          {t('view_application')} →
                        </Link>
                      </div>
                    ) : isSeatsFull ? (
                      <Button
                        disabled
                        variant="secondary"
                        fullWidth
                        className="cursor-not-allowed opacity-75"
                        title="All seats in this class are currently held or confirmed"
                      >
                        {t('btn_class_full')}
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        fullWidth
                        isLoading={isApplying}
                        disabled={isOtherApplying}
                        onClick={() => handleApply(admissionClass.id)}
                      >
                        {t('btn_apply_seat')}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
