import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Button,
  Banner,
  Pill,
  Skeleton,
  EmptyState,
} from '../../shared/components';
import {
  fetchMyHolds,
  confirmHold,
  cancelHold,
  type StudentHoldDto,
} from '../../api/admissionApi';
import { ApiClientError, getStoredStudentId } from '../../api/client';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { formatDateTime } from '../../shared/utils/date';

interface ApplicationRowProps {
  hold: StudentHoldDto;
  isActionRunning: boolean;
  onPay: (holdId: string) => Promise<void>;
  onCancel: (holdId: string) => Promise<void>;
  onExpired: () => void;
}

const ApplicationRow: React.FC<ApplicationRowProps> = ({
  hold,
  isActionRunning,
  onPay,
  onCancel,
  onExpired,
}) => {
  const navigate = useNavigate();
  const [isPaying, setIsPaying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Reusable countdown hook with clock-skew correction (Requirement U2, U6)
  const { formattedTime, isExpired } = useCountdown({
    expiresAt: hold.expiresAt,
    serverTime: hold.serverTime,
    createdAt: hold.createdAt,
    onExpire: onExpired,
  });

  // Calculate live effective status
  const effectiveStatus: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' =
    hold.status === 'CONFIRMED'
      ? 'CONFIRMED'
      : hold.status === 'CANCELLED'
      ? 'CANCELLED'
      : hold.status === 'EXPIRED' || (hold.status === 'HELD' && isExpired)
      ? 'EXPIRED'
      : 'HELD';

  const handlePayClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActionRunning || effectiveStatus !== 'HELD') return;
    setIsPaying(true);
    try {
      await onPay(hold.holdId);
    } finally {
      setIsPaying(false);
    }
  };

  const handleCancelClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isActionRunning || effectiveStatus !== 'HELD') return;
    setIsCancelling(true);
    try {
      await onCancel(hold.holdId);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleApplyAgainClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/classes/${hold.classId}`);
  };

  const handleViewDetailsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/holds/${hold.holdId}`);
  };

  return (
    <Card
      onClick={() => navigate(`/holds/${hold.holdId}`)}
      className="cursor-pointer hover:translate-y-[-2px] transition-all duration-200 flex flex-col gap-4 p-4 sm:p-5"
    >
      {/* Top Header: Class Name, Status Pill, Helper Text */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-bold font-['Poppins'] text-[#241A3F]">
              {hold.className}
            </h2>
          </div>

          {/* Helper Text based on status */}
          <div className="text-xs sm:text-sm font-medium">
            {effectiveStatus === 'HELD' && (
              <span className="text-[#683DD0] inline-flex items-center gap-1.5 font-semibold">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ends in {formattedTime}
              </span>
            )}

            {effectiveStatus === 'CONFIRMED' && (
              <span className="text-[#1D7A4A] inline-flex items-center gap-1.5 font-semibold">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Paid {formatDateTime(hold.confirmedAt || hold.createdAt)}
              </span>
            )}

            {effectiveStatus === 'EXPIRED' && (
              <span className="text-[#7A7396] inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 text-[#B03A5B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Payment time ended
              </span>
            )}

            {effectiveStatus === 'CANCELLED' && (
              <span className="text-[#B03A5B] inline-flex items-center gap-1.5 font-medium">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancelled by you
              </span>
            )}
          </div>
        </div>

        {/* Status Pill */}
        <div className="self-start sm:self-center">
          <Pill status={effectiveStatus} />
        </div>
      </div>

      {/* Footer / Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E0D9F0]/60">
        <span className="text-xs text-[#7A7396]">
          Applied: {formatDateTime(hold.createdAt)}
        </span>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {effectiveStatus === 'HELD' && (
            <>
              <Button
                size="sm"
                variant="primary"
                isLoading={isPaying}
                disabled={isActionRunning}
                onClick={handlePayClick}
              >
                Pay fee
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isLoading={isCancelling}
                disabled={isActionRunning}
                onClick={handleCancelClick}
              >
                Cancel
              </Button>
            </>
          )}

          {effectiveStatus === 'EXPIRED' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleApplyAgainClick}
            >
              Apply again
            </Button>
          )}

          {effectiveStatus === 'CANCELLED' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleApplyAgainClick}
            >
              Apply again
            </Button>
          )}

          {effectiveStatus === 'CONFIRMED' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleViewDetailsClick}
            >
              View details
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

export const MyApplicationsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const studentId = getStoredStudentId();

  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionRunning, setIsActionRunning] = useState(false);

  // Poll student applications every 5 seconds (Requirement U3, U4, A8)
  const {
    data: applications,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<StudentHoldDto[]>({
    queryKey: ['myHolds', studentId],
    queryFn: () => {
      if (!studentId) return [];
      return fetchMyHolds(studentId);
    },
    refetchInterval: 5000,
    enabled: Boolean(studentId),
  });

  // Action: Pay Fee directly from the list
  const handlePay = async (holdId: string) => {
    setIsActionRunning(true);
    setActionError(null);
    try {
      const res = await confirmHold(holdId);
      // Immediately update local cache to CONFIRMED
      queryClient.setQueryData(
        ['myHolds', studentId],
        (prev: StudentHoldDto[] | undefined) => {
          if (!prev) return prev;
          return prev.map((item) =>
            item.holdId === holdId
              ? {
                  ...item,
                  status: 'CONFIRMED' as const,
                  confirmedAt: res.confirmedAt,
                }
              : item
          );
        }
      );
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['hold', holdId] });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to confirm admission fee payment.');
      }
      refetch();
    } finally {
      setIsActionRunning(false);
    }
  };

  // Action: Cancel Hold directly from the list
  const handleCancel = async (holdId: string) => {
    setIsActionRunning(true);
    setActionError(null);
    try {
      await cancelHold(holdId);
      // Immediately update local cache to CANCELLED
      queryClient.setQueryData(
        ['myHolds', studentId],
        (prev: StudentHoldDto[] | undefined) => {
          if (!prev) return prev;
          return prev.map((item) =>
            item.holdId === holdId
              ? {
                  ...item,
                  status: 'CANCELLED' as const,
                }
              : item
          );
        }
      );
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['hold', holdId] });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to cancel application.');
      }
      refetch();
    } finally {
      setIsActionRunning(false);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto py-6 px-4 flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#241A3F]">
            My Applications
          </h1>
          <p className="text-sm text-[#7A7396] mt-1">
            Track and manage your admission applications, live countdowns, and confirmed seats.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/')}
          className="self-start sm:self-auto"
        >
          Browse Classes
        </Button>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <Banner
          variant="error"
          title="Action Failed"
          message={actionError}
          onDismiss={() => setActionError(null)}
        />
      )}

      {/* 1. Loading State */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-32" />
        </div>
      )}

      {/* 2. Error State */}
      {!isLoading && isError && (
        <EmptyState
          title="Unable to load applications"
          description={
            error instanceof Error ? error.message : 'An error occurred while loading your applications.'
          }
          action={
            <Button variant="primary" onClick={() => refetch()}>
              Try Again
            </Button>
          }
        />
      )}

      {/* 3. Empty State */}
      {!isLoading && !isError && (!applications || applications.length === 0) && (
        <EmptyState
          title="No applications yet"
          description="You have not submitted any class seat reservations yet. Explore available classes to hold a seat."
          action={
            <Button variant="primary" onClick={() => navigate('/')}>
              Explore Classes
            </Button>
          }
        />
      )}

      {/* 4. Applications List */}
      {!isLoading && !isError && applications && applications.length > 0 && (
        <div className="flex flex-col gap-4">
          {applications.map((app) => (
            <ApplicationRow
              key={app.holdId}
              hold={app}
              isActionRunning={isActionRunning}
              onPay={handlePay}
              onCancel={handleCancel}
              onExpired={() => {
                refetch();
                queryClient.invalidateQueries({ queryKey: ['classes'] });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};
