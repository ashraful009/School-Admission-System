import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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

export const ManageClassesPage: React.FC = () => {
  const location = useLocation();
  const { t, tClass } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [successNotice, setSuccessNotice] = useState<string | null>(
    (location.state as { successMessage?: string })?.successMessage || null
  );

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

  const classList = classes ?? [];
  const filteredClasses = classList.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="flex flex-col gap-6 pb-12" data-testid="manage-classes-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-[#7A7396] tracking-wider uppercase font-['Poppins']">
              Administration
            </span>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#E4DBF7] text-[#4B22A6]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#683DD0] animate-pulse" />
              Live 5s
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-['Poppins'] text-[#241A3F]">
            {t('manage_classes_title')}
          </h1>
          <p className="text-sm text-[#7A7396] mt-0.5">
            {t('manage_classes_subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/admin/classes/new">
            <Button variant="primary" size="md">
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              {t('manage_btn_new_class')}
            </Button>
          </Link>
        </div>
      </div>

      {/* Success notice from Create / Edit */}
      {successNotice && (
        <Banner
          variant="success"
          title="Success"
          message={successNotice}
          onDismiss={() => {
            setSuccessNotice(null);
            window.history.replaceState({}, document.title);
          }}
        />
      )}

      {/* Error state */}
      {isError && (
        <Banner
          variant="error"
          title="Failed to load classes"
          message={error instanceof Error ? error.message : 'Unable to connect to the admission backend.'}
          action={
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      )}

      {/* Filter / Search Bar (if classes exist) */}
      {!isLoading && classList.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-72 relative">
            <input
              type="text"
              placeholder="Search classes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full neu-inset px-4 py-2 text-sm text-[#241A3F] placeholder-[#7A7396] rounded-xl outline-none focus:ring-2 focus:ring-[#683DD0]/30 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#7A7396] hover:text-[#241A3F]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="text-xs text-[#7A7396] self-end sm:self-center font-medium">
            Showing <strong className="text-[#241A3F]">{filteredClasses.length}</strong> of{' '}
            <strong className="text-[#241A3F]">{classList.length}</strong> shifts
          </div>
        </div>
      )}

      {/* Table Container */}
      {isLoading ? (
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 flex flex-col gap-3">
            <Skeleton variant="title" width="30%" />
            <Skeleton variant="rect" height={48} />
            <Skeleton variant="rect" height={48} />
            <Skeleton variant="rect" height={48} />
            <Skeleton variant="rect" height={48} />
          </div>
        </Card>
      ) : classList.length === 0 ? (
        /* Empty State */
        <EmptyState
          title="No admission classes configured"
          description="There are currently no admission classes or shifts in the system. Get started by creating your first class shift."
          action={
            <Link to="/admin/classes/new">
              <Button variant="primary">
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Create class
              </Button>
            </Link>
          }
        />
      ) : filteredClasses.length === 0 ? (
        /* Search No Matches */
        <Card padding="lg" className="text-center py-8">
          <p className="text-[#7A7396] text-sm mb-3">No classes match "{searchTerm}".</p>
          <Button size="sm" variant="secondary" onClick={() => setSearchTerm('')}>
            Reset search
          </Button>
        </Card>
      ) : (
        /* Table of Classes */
        <Card padding="none" className="overflow-hidden neu-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]" data-testid="manage-classes-table">
              <thead>
                <tr className="border-b border-[#E0D9F0] bg-[#F7F4FC]/80 text-[#7A7396] text-xs uppercase tracking-wider font-semibold font-['Poppins']">
                  <th className="py-3.5 px-4 sm:px-6">{t('manage_th_class_name')}</th>
                  <th className="py-3.5 px-4 text-center">{t('manage_th_total')}</th>
                  <th className="py-3.5 px-4 text-center">{t('manage_th_held')}</th>
                  <th className="py-3.5 px-4 text-center">{t('manage_th_confirmed')}</th>
                  <th className="py-3.5 px-4 text-center font-bold text-[#4B22A6]">{t('manage_th_available')}</th>
                  <th className="py-3.5 px-4">{t('manage_th_occupancy')}</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">{t('manage_th_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0D9F0]/60 text-sm">
                {filteredClasses.map((item) => {
                  const occupied = item.heldSeats + item.confirmedSeats;
                  const pct = item.totalSeats > 0 ? Math.round((occupied / item.totalSeats) * 100) : 0;
                  const isFull = item.availableSeats <= 0;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-[#E4DBF7]/20 transition-colors"
                      data-testid={`manage-class-row-${item.id}`}
                    >
                      {/* Class shift */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex flex-col">
                          <Link
                            to={`/classes/${item.id}`}
                            className="font-bold text-[#241A3F] hover:text-[#4B22A6] transition-colors font-['Poppins']"
                            title="View student class details"
                          >
                            {tClass(item.name)}
                          </Link>
                          <span className="text-xs text-[#7A7396] mt-0.5">
                            Hold duration: {Math.round(item.holdDurationSeconds / 60)} min
                          </span>
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-4 px-4 text-center font-mono font-medium text-[#241A3F]">
                        {item.totalSeats}
                      </td>

                      {/* Held */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`font-mono font-semibold ${
                            item.heldSeats > 0 ? 'text-[#683DD0]' : 'text-[#7A7396]'
                          }`}
                        >
                          {item.heldSeats}
                        </span>
                      </td>

                      {/* Confirmed */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`font-mono font-semibold ${
                            item.confirmedSeats > 0 ? 'text-[#1D7A4A]' : 'text-[#7A7396]'
                          }`}
                        >
                          {item.confirmedSeats}
                        </span>
                      </td>

                      {/* Available (bold) */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`font-mono font-bold text-base ${
                            isFull ? 'text-[#B03A5B]' : 'text-[#4B22A6]'
                          }`}
                        >
                          {item.availableSeats}
                        </span>
                      </td>

                      {/* Filled bar */}
                      <td className="py-4 px-4">
                        <div className="w-36 sm:w-44 flex flex-col gap-1">
                          <ProgressBar
                            confirmed={item.confirmedSeats}
                            held={item.heldSeats}
                            max={item.totalSeats}
                            height="sm"
                          />
                          <div className="flex items-center justify-between text-[11px] text-[#7A7396]">
                            <span>{pct}% filled</span>
                            <span className={isFull ? 'text-[#B03A5B] font-semibold' : ''}>
                              {item.availableSeats} left
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Edit button */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <Link to={`/admin/classes/${item.id}/edit`}>
                          <Button size="sm" variant="secondary">
                            Edit
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

