import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Button,
  Banner,
  Pill,
  Skeleton,
  EmptyState,
  CountdownRing,
} from '../../shared/components';
import {
  fetchHoldById,
  confirmHold,
  cancelHold,
  type HoldDetailsDto,
} from '../../api/admissionApi';
import { ApiClientError, getStoredStudentId } from '../../api/client';
import { useCountdown } from '../../shared/hooks/useCountdown';
import { formatDateTime } from '../../shared/utils/date';

export const HoldApplicationPage: React.FC = () => {
  const { holdId } = useParams<{ holdId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const studentId = getStoredStudentId();

  const [isPaying, setIsPaying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch hold details (Requirement A5, U6)
  const {
    data: hold,
    isLoading: holdLoading,
    isError: holdIsError,
    error: holdError,
    refetch: refetchHold,
  } = useQuery<HoldDetailsDto>({
    queryKey: ['hold', holdId],
    queryFn: () => {
      if (!holdId) throw new Error('Missing hold ID');
      return fetchHoldById(holdId);
    },
    enabled: Boolean(holdId),
    retry: 1,
  });

  // Countdown hook with clock skew correction and zero-expiry callback (Requirement U2)
  const { secondsLeft, totalSeconds, isExpired } = useCountdown({
    expiresAt: hold?.expiresAt,
    serverTime: hold?.serverTime,
    createdAt: hold?.createdAt,
    onExpire: () => {
      // Sync hold status with the server once countdown hits 0 without reloading page
      refetchHold();
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['myHolds'] });
    },
  });

  // Calculate effective status
  const serverStatus = hold?.status;
  const effectiveStatus: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' =
    serverStatus === 'CONFIRMED'
      ? 'CONFIRMED'
      : serverStatus === 'CANCELLED'
      ? 'CANCELLED'
      : serverStatus === 'EXPIRED' || (serverStatus === 'HELD' && isExpired)
      ? 'EXPIRED'
      : 'HELD';

  // Handle Pay Admission Fee (Requirement A6, B5)
  const handlePay = async () => {
    if (!holdId || isSubmitting || effectiveStatus !== 'HELD') return;
    setIsSubmitting(true);
    setIsPaying(true);
    setErrorMessage(null);

    try {
      const confirmed = await confirmHold(holdId);
      // Update cache immediately to CONFIRMED
      queryClient.setQueryData(['hold', holdId], (prev: HoldDetailsDto | undefined) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'CONFIRMED' as const,
          confirmedAt: confirmed.confirmedAt,
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['myHolds'] });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to confirm admission payment. Please try again.');
      }
      // Refetch to sync if server rejected due to expiry or cancellation
      refetchHold();
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['myHolds'] });
    } finally {
      setIsSubmitting(false);
      setIsPaying(false);
    }
  };

  // Handle Cancel Application (Requirement A7)
  const handleCancel = async () => {
    if (!holdId || isSubmitting || effectiveStatus !== 'HELD') return;
    setIsSubmitting(true);
    setIsCancelling(true);
    setErrorMessage(null);

    try {
      await cancelHold(holdId);
      // Update cache immediately to CANCELLED
      queryClient.setQueryData(['hold', holdId], (prev: HoldDetailsDto | undefined) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'CANCELLED' as const,
        };
      });
      await queryClient.invalidateQueries({ queryKey: ['classes'] });
      await queryClient.invalidateQueries({ queryKey: ['myHolds'] });
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to cancel application. Please try again.');
      }
      refetchHold();
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['myHolds'] });
    } finally {
      setIsSubmitting(false);
      setIsCancelling(false);
    }
  };

  // 1. Loading Skeleton
  if (holdLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-xl mx-auto py-6 px-4">
        <Skeleton variant="text" width={180} />
        <Card className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Skeleton variant="title" width={160} />
            <Skeleton variant="text" width={70} height={24} />
          </div>
          <div className="flex justify-center py-6">
            <Skeleton variant="circle" width={180} height={180} />
          </div>
          <Skeleton variant="rect" height={100} className="rounded-2xl" />
          <div className="flex flex-col gap-3">
            <Skeleton variant="rect" height={44} className="rounded-2xl" />
            <Skeleton variant="rect" height={44} className="rounded-2xl" />
          </div>
        </Card>
      </div>
    );
  }

  // 2. Error / Not Found State
  if (holdIsError || !hold) {
    const isNotFound = holdError instanceof ApiClientError && holdError.code === 'NOT_FOUND';
    return (
      <div className="flex flex-col gap-6 max-w-xl mx-auto py-8 px-4">
        <EmptyState
          title={isNotFound ? 'Application Not Found' : 'Unable to Load Application'}
          description={
            isNotFound
              ? 'This seat reservation could not be found. It may have expired and been cleaned up, or the link is incorrect.'
              : holdError instanceof Error
              ? holdError.message
              : 'An unexpected error occurred while fetching your application status.'
          }
          action={
            <div className="flex gap-3">
              <Button variant="primary" onClick={() => navigate('/')}>
                Back to Classes
              </Button>
              {!isNotFound && (
                <Button variant="secondary" onClick={() => refetchHold()}>
                  Retry
                </Button>
              )}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-xl w-full mx-auto py-6 px-4 flex flex-col gap-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs sm:text-sm text-[#7A7396]">
        <Link to="/" className="hover:text-[#4B22A6] transition-colors">
          Classes
        </Link>
        <span>/</span>
        <Link to={`/classes/${hold.classId}`} className="hover:text-[#4B22A6] transition-colors truncate max-w-[150px] sm:max-w-[200px]">
          {hold.className}
        </Link>
        <span>/</span>
        <span className="text-[#241A3F] font-semibold">Application</span>
      </nav>

      {/* Main Hold Card */}
      <Card
        className={`flex flex-col gap-6 ${
          effectiveStatus === 'EXPIRED'
            ? 'border-2 border-[#F6DDE4]'
            : effectiveStatus === 'CONFIRMED'
            ? 'border-2 border-[#D9F0E3]'
            : effectiveStatus === 'CANCELLED'
            ? 'border-2 border-[#E3E0EA]'
            : ''
        }`}
      >
        {/* Card Header with Status Pill */}
        <div className="flex items-center justify-between border-b border-[#E0D9F0] pb-4">
          <div>
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                effectiveStatus === 'CONFIRMED'
                  ? 'text-[#1D7A4A]'
                  : effectiveStatus === 'EXPIRED' || effectiveStatus === 'CANCELLED'
                  ? 'text-[#B03A5B]'
                  : 'text-[#683DD0]'
              }`}
            >
              {effectiveStatus === 'CONFIRMED'
                ? 'Enrolled'
                : effectiveStatus === 'EXPIRED'
                ? 'Time Out'
                : effectiveStatus === 'CANCELLED'
                ? 'Cancelled'
                : 'Seat Reserved'}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-['Poppins'] text-[#241A3F]">
              {effectiveStatus === 'CONFIRMED'
                ? 'Admission Confirmed'
                : effectiveStatus === 'EXPIRED'
                ? 'Seat Hold Expired'
                : effectiveStatus === 'CANCELLED'
                ? 'Application Cancelled'
                : 'Seat Hold Active'}
            </h1>
          </div>
          <Pill status={effectiveStatus} />
        </div>

        {/* Action Error Banner */}
        {errorMessage && (
          <Banner
            variant="error"
            title="Action could not be completed"
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
          />
        )}

        {/* Status Specific Guidance Banners */}
        {effectiveStatus === 'EXPIRED' && (
          <Banner
            variant="error"
            title="Your seat hold has expired"
            message="The hold window elapsed before payment was completed. The seat has automatically returned to the class pool."
          />
        )}

        {effectiveStatus === 'CONFIRMED' && (
          <Banner
            variant="success"
            title="Admission Confirmed!"
            message={`Your admission fee has been recorded and your seat is permanently confirmed for ${hold.className}.`}
          />
        )}

        {effectiveStatus === 'CANCELLED' && (
          <Banner
            variant="warning"
            title="Application Cancelled"
            message="You have cancelled your application for this seat. The seat has returned to the class pool."
          />
        )}

        {/* Countdown Ring Display */}
        <div className="flex justify-center py-2">
          <CountdownRing
            secondsLeft={secondsLeft}
            totalSeconds={totalSeconds}
            isExpired={effectiveStatus === 'EXPIRED'}
            isConfirmed={effectiveStatus === 'CONFIRMED'}
            isCancelled={effectiveStatus === 'CANCELLED'}
            size={190}
          />
        </div>

        {/* Hold Details Summary (Correction 2: no fee row; Correction 8: Hold started and Hold ends) */}
        <div className="neu-inset p-4 sm:p-5 rounded-2xl flex flex-col gap-2.5 text-xs sm:text-sm">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-[#7A7396]">Class:</span>
            <span className="font-semibold text-[#241A3F]">{hold.className}</span>
          </div>

          {studentId && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#7A7396]">Student ID:</span>
              <span className="font-mono font-semibold text-[#241A3F]">{studentId}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-[#7A7396]">Hold Started:</span>
            <span className="text-[#241A3F]">{formatDateTime(hold.createdAt)}</span>
          </div>

          {effectiveStatus === 'HELD' && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#7A7396]">Hold Ends:</span>
              <span className="font-semibold text-[#683DD0]">{formatDateTime(hold.expiresAt)}</span>
            </div>
          )}

          {effectiveStatus === 'EXPIRED' && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#7A7396]">Expired At:</span>
              <span className="font-semibold text-[#B03A5B]">{formatDateTime(hold.expiresAt)}</span>
            </div>
          )}

          {effectiveStatus === 'CONFIRMED' && (
            <>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-[#7A7396]">Confirmed At:</span>
                <span className="font-semibold text-[#1D7A4A]">{formatDateTime(hold.confirmedAt)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-[#7A7396]">Status:</span>
                <span className="font-semibold text-[#1D7A4A]">Enrolled (Paid)</span>
              </div>
            </>
          )}

          {effectiveStatus === 'CANCELLED' && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#7A7396]">Status:</span>
              <span className="font-semibold text-[#B03A5B]">Cancelled</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-3 pt-1">
          {effectiveStatus === 'HELD' && (
            <>
              {/* Simulated Payment Notice (Requirement B5) */}
              <div className="p-3 rounded-xl bg-[#E4DBF7]/40 border border-[#D3C7EE] text-xs text-[#4B22A6] text-center font-medium">
                Payment is simulated. Confirming your application will secure your admission.
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={isPaying}
                  disabled={isSubmitting || isExpired || effectiveStatus !== 'HELD'}
                  onClick={handlePay}
                >
                  Pay admission fee
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  isLoading={isCancelling}
                  disabled={isSubmitting || isExpired || effectiveStatus !== 'HELD'}
                  onClick={handleCancel}
                >
                  Cancel application
                </Button>
              </div>
            </>
          )}

          {effectiveStatus === 'EXPIRED' && (
            <>
              <Button variant="primary" disabled fullWidth>
                Pay admission fee (Disabled — Hold Expired)
              </Button>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => navigate(`/classes/${hold.classId}`)}
                >
                  Apply Again
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => navigate('/')}
                >
                  Back to Classes
                </Button>
              </div>
            </>
          )}

          {effectiveStatus === 'CONFIRMED' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate('/my-applications')}
              >
                View My Applications
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/')}
              >
                Browse Other Classes
              </Button>
            </div>
          )}

          {effectiveStatus === 'CANCELLED' && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="primary"
                fullWidth
                onClick={() => navigate(`/classes/${hold.classId}`)}
              >
                Apply Again
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/')}
              >
                Back to Classes
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
