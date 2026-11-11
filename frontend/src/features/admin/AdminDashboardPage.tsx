import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  Button,
  ProgressBar,
  Banner,
  Skeleton,
  EmptyState,
} from '../../shared/components';
import { fetchClasses } from '../../api/admissionApi';
import type { AdmissionClassDto } from '../../api/admissionApi';
import { useTranslation } from '../../shared/i18n';

export const AdminDashboardPage: React.FC = () => {
  const { t, tClass } = useTranslation();
  // Poll classes every 5 seconds (Requirement U3, A2)
  const {
    data: classes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AdmissionClassDto[]>({
    queryKey: ['classes'],
    queryFn: () => fetchClasses(),
    refetchInterval: 5000,
  });

  // Overall computations from A2 classes array
  const classList = classes ?? [];
  const classShiftsCount = classList.length;
  const totalSeats = classList.reduce((sum, c) => sum + (c.totalSeats || 0), 0);
  const totalHeld = classList.reduce((sum, c) => sum + (c.heldSeats || 0), 0);
  const totalConfirmed = classList.reduce((sum, c) => sum + (c.confirmedSeats || 0), 0);
  const totalAvailable = classList.reduce((sum, c) => sum + (c.availableSeats || 0), 0);

  const totalOccupied = totalHeld + totalConfirmed;
  const occupancyPercentage = totalSeats > 0 ? Math.round((totalOccupied / totalSeats) * 100) : 0;

  return (
    <div className="flex flex-col gap-8 pb-12" data-testid="admin-dashboard">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#7A7396] tracking-wider uppercase font-['Poppins']">
              Overview
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E4DBF7] text-[#4B22A6]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#683DD0] animate-pulse" />
              Live 5s
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#241A3F]">
            {t('admin_dashboard_title')}
          </h1>
          <p className="text-sm text-[#7A7396] mt-0.5">
            {t('admin_dashboard_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/classes/new">
            <Button variant="primary" size="md">
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              {t('nav_admin_create_class')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <Banner
          variant="error"
          title="Failed to load dashboard data"
          message={error instanceof Error ? error.message : 'Unable to connect to the admission backend.'}
          action={
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      )}

      {/* 4 Required Metric Tiles: Class shifts, Total seats, Held (waiting for payment), Confirmed */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {isLoading ? (
          <>
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
            <Skeleton variant="card" className="h-32" />
          </>
        ) : (
          <>
            {/* Tile 1: Class shifts */}
            <Card padding="md" className="flex flex-col justify-between" data-testid="tile-class-shifts">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#7A7396]">
                  Class shifts
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#E4DBF7] flex items-center justify-center text-[#4B22A6]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-bold font-['Poppins'] text-[#241A3F]">
                  {classShiftsCount}
                </div>
                <div className="text-xs text-[#7A7396] mt-1">
                  Active shifts configured
                </div>
              </div>
            </Card>

            {/* Tile 2: Total seats */}
            <Card padding="md" className="flex flex-col justify-between" data-testid="tile-total-seats">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#7A7396]">
                  Total seats
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#E0D9F0] flex items-center justify-center text-[#241A3F]">
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
              <div className="mt-3">
                <div className="text-3xl font-bold font-['Poppins'] text-[#241A3F]">
                  {totalSeats}
                </div>
                <div className="text-xs text-[#7A7396] mt-1">
                  Total institution capacity
                </div>
              </div>
            </Card>

            {/* Tile 3: Held (waiting for payment) */}
            <Card padding="md" className="flex flex-col justify-between" data-testid="tile-held-seats">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#7A7396]">
                  Held (waiting for payment)
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#E4DBF7] flex items-center justify-center text-[#4B22A6]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-bold font-['Poppins'] text-[#683DD0]">
                  {totalHeld}
                </div>
                <div className="text-xs text-[#7A7396] mt-1">
                  Pending fee payment
                </div>
              </div>
            </Card>

            {/* Tile 4: Confirmed */}
            <Card padding="md" className="flex flex-col justify-between" data-testid="tile-confirmed-seats">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#7A7396]">
                  Confirmed
                </span>
                <div className="w-9 h-9 rounded-xl bg-[#D9F0E3] flex items-center justify-center text-[#1D7A4A]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-bold font-['Poppins'] text-[#1D7A4A]">
                  {totalConfirmed}
                </div>
                <div className="text-xs text-[#7A7396] mt-1">
                  Paid and finalized enrollments
                </div>
              </div>
            </Card>
          </>
        )}
      </section>

      {/* Capacity Overview Bar (if classes exist) */}
      {!isLoading && classShiftsCount > 0 && (
        <Card padding="md" className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold text-[#7A7396] uppercase tracking-wider font-['Poppins']">
                System Capacity
              </span>
              <h3 className="text-base font-bold text-[#241A3F] font-['Poppins']">
                Overall Admission Progress
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-[#1D7A4A]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1D7A4A]" />
                Confirmed: {totalConfirmed}
              </span>
              <span className="flex items-center gap-1.5 text-[#683DD0]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#683DD0]" />
                Held: {totalHeld}
              </span>
              <span className="flex items-center gap-1.5 text-[#7A7396]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#cfc8e2]" />
                Available: {totalAvailable}
              </span>
            </div>
          </div>

          <ProgressBar
            confirmed={totalConfirmed}
            held={totalHeld}
            max={totalSeats}
            height="lg"
          />

          <div className="flex items-center justify-between text-xs text-[#7A7396]">
            <span>
              <strong className="text-[#241A3F]">{totalOccupied}</strong> of {totalSeats} seats occupied ({occupancyPercentage}%)
            </span>
            <span>
              <strong className="text-[#4B22A6]">{totalAvailable}</strong> seats currently open for admission
            </span>
          </div>
        </Card>
      )}

      {/* Seats by class shift Section */}
      <section className="flex flex-col gap-4" data-testid="seats-by-class-shift">
        <div className="flex items-center justify-between border-b border-[#E0D9F0] pb-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold font-['Poppins'] text-[#241A3F]">
              Seats by class shift
            </h2>
            {!isLoading && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#E4DBF7] text-[#4B22A6]">
                {classShiftsCount} {classShiftsCount === 1 ? 'shift' : 'shifts'}
              </span>
            )}
          </div>
          <span className="text-xs text-[#7A7396] font-medium hidden sm:inline">
            Auto-refreshes every 5s
          </span>
        </div>

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <Skeleton variant="title" width="40%" />
                  <Skeleton variant="text" width="15%" />
                </div>
                <Skeleton variant="rect" height={16} />
                <div className="flex justify-between">
                  <Skeleton variant="text" width="25%" />
                  <Skeleton variant="text" width="25%" />
                </div>
              </Card>
            ))}
          </div>
        ) : classShiftsCount === 0 ? (
          /* Empty state */
          <EmptyState
            title="No class shifts configured"
            description="There are currently no admission classes or shifts in the system. Create class shifts to open admissions."
            action={
              <Link to="/admin/classes/new">
                <Button variant="primary">
                  <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Create first class
                </Button>
              </Link>
            }
          />
        ) : (
          /* Seats by class shift Bars */
          <div className="flex flex-col gap-4">
            {classList.map((shift) => {
              const isFull = shift.availableSeats <= 0;
              const shiftOccupied = shift.confirmedSeats + shift.heldSeats;
              const shiftPct = shift.totalSeats > 0 ? Math.round((shiftOccupied / shift.totalSeats) * 100) : 0;

              return (
                <Card
                  key={shift.id}
                  padding="md"
                  className="flex flex-col gap-3 transition-transform duration-200 hover:-translate-y-0.5"
                  data-testid={`class-shift-row-${shift.id}`}
                >
                  {/* Top Bar: Name and "n left" */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/classes/${shift.id}`}
                        className="text-base sm:text-lg font-bold font-['Poppins'] text-[#241A3F] hover:text-[#4B22A6] transition-colors"
                        title="View class details"
                      >
                        {tClass(shift.name)}
                      </Link>
                    </div>

                    {/* "n left" indicator (Explicit requirement) */}
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
                          isFull
                            ? 'bg-[#F6DDE4] text-[#B03A5B]'
                            : 'bg-[#E4DBF7] text-[#4B22A6]'
                        }`}
                      >
                        <span className="font-mono text-sm">{shift.availableSeats}</span> left
                      </span>

                      <Link
                        to={`/admin/classes/${shift.id}/edit`}
                        className="text-xs font-semibold text-[#7A7396] hover:text-[#4B22A6] transition-colors p-1"
                        title="Edit class"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>

                  {/* Progress bar with confirmed and held */}
                  <ProgressBar
                    confirmed={shift.confirmedSeats}
                    held={shift.heldSeats}
                    max={shift.totalSeats}
                    height="md"
                  />

                  {/* Seat breakdown figures */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-[#7A7396] pt-1 border-t border-[#E0D9F0]/40 gap-2">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#1D7A4A]" />
                        <span>Confirmed:</span>
                        <strong className="font-mono text-[#241A3F]">{shift.confirmedSeats}</strong>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#683DD0]" />
                        <span>Held:</span>
                        <strong className="font-mono text-[#241A3F]">{shift.heldSeats}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span>
                        Occupied: <strong className="text-[#241A3F]">{shiftOccupied}</strong> / {shift.totalSeats} ({shiftPct}%)
                      </span>
                      <span>•</span>
                      <span>
                        Capacity: <strong className="text-[#241A3F]">{shift.totalSeats}</strong> seats
                      </span>
                    </div>
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

