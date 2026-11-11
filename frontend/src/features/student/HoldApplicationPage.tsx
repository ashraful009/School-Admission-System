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
import { useTranslation } from '../../shared/i18n';

export const HoldApplicationPage: React.FC = () => {
  const { holdId } = useParams<{ holdId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const studentId = getStoredStudentId();
  const { t, tClass } = useTranslation();

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
                ? t('status_confirmed')
                : effectiveStatus === 'EXPIRED'
                ? t('status_expired')
                : effectiveStatus === 'CANCELLED'
                ? t('status_cancelled')
                : t('status_held')}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold font-['Poppins'] text-[#241A3F]">
              {effectiveStatus === 'CONFIRMED'
                ? t('hold_confirmed_banner_title')
                : effectiveStatus === 'EXPIRED'
                ? t('hold_expired_banner_title')
                : effectiveStatus === 'CANCELLED'
                ? t('hold_cancelled_banner_title')
                : t('hold_title')}
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
            title={t('hold_expired_banner_title')}
            message={t('hold_expired_banner_desc')}
          />
        )}

        {effectiveStatus === 'CONFIRMED' && (
          <Banner
            variant="success"
            title={t('hold_confirmed_banner_title')}
            message={t('hold_confirmed_banner_desc', { name: tClass(hold.className) })}
          />
        )}

        {effectiveStatus === 'CANCELLED' && (
          <Banner
            variant="warning"
            title={t('hold_cancelled_banner_title')}
            message={t('hold_cancelled_banner_desc')}
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
            <span className="text-[#7A7396]">{t('hold_class_name')}:</span>
            <span className="font-semibold text-[#241A3F]">{tClass(hold.className)}</span>
          </div>

          {studentId && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#7A7396]">{t('hold_student_id')}:</span>
              <span className="font-mono font-semibold text-[#241A3F]">{studentId}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <span className="text-[#7A7396]">{t('hold_started_at')}:</span>
            <span className="text-[#241A3F]">{formatDateTime(hold.createdAt)}</span>
          </div>

          {effectiveStatus === 'HELD' && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#7A7396]">{t('hold_expires_at')}:</span>
              <span className="font-semibold text-[#683DD0]">{formatDateTime(hold.expiresAt)}</span>
            </div>
          )}

          {effectiveStatus === 'EXPIRED' && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#7A7396]">{t('hold_expires_at')}:</span>
              <span className="font-semibold text-[#B03A5B]">{formatDateTime(hold.expiresAt)}</span>
            </div>
          )}

          {effectiveStatus === 'CONFIRMED' && (
            <>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-[#7A7396]">{t('hold_confirmed_at')}:</span>
                <span className="font-semibold text-[#1D7A4A]">{formatDateTime(hold.confirmedAt)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                <span className="text-[#7A7396]">Status:</span>
                <span className="font-semibold text-[#1D7A4A]">{t('status_confirmed')}</span>
              </div>
            </>
          )}

          {effectiveStatus === 'CANCELLED' && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
              <span className="text-[#7A7396]">Status:</span>
              <span className="font-semibold text-[#B03A5B]">{t('status_cancelled')}</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-3 pt-1">
          {effectiveStatus === 'HELD' && (
            <>
              {/* Simulated Payment Notice (Requirement B5) */}
              <div className="p-3 rounded-xl bg-[#E4DBF7]/40 border border-[#D3C7EE] text-xs text-[#4B22A6] text-center font-medium">
                {t('hold_simulated_notice_desc')}
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
                  {isPaying ? t('hold_btn_paying') : t('hold_btn_pay')}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  fullWidth
                  isLoading={isCancelling}
                  disabled={isSubmitting || isExpired || effectiveStatus !== 'HELD'}
                  onClick={handleCancel}
                >
                  {isCancelling ? t('hold_btn_cancelling') : t('hold_btn_cancel')}
                </Button>
              </div>
            </>
          )}

          {effectiveStatus === 'EXPIRED' && (
            <>
              <Button variant="primary" disabled fullWidth>
                {t('hold_btn_pay_disabled_expired')}
              </Button>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  variant="primary"
                  fullWidth
                  onClick={() => navigate(`/classes/${hold.classId}`)}
                >
                  {t('hold_apply_again')}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() => navigate('/')}
                >
                  {t('details_back')}
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
                {t('nav_my_applications')}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/')}
              >
                {t('details_back')}
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
                {t('hold_apply_again')}
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => navigate('/')}
              >
                {t('details_back')}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
