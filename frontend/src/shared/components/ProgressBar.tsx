import React from 'react';

export interface ProgressBarProps {
  value?: number;
  max?: number;
  confirmed?: number;
  held?: number;
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  confirmed,
  held,
  height = 'md',
  showLabel = false,
  className = '',
}) => {
  const heightClasses = {
    sm: 'h-2',
    md: 'h-3.5',
    lg: 'h-5',
  }[height];

  // If confirmed / held are passed, compute multi-segmented progress
  const hasDetailedSeats = confirmed !== undefined || held !== undefined;
  const safeTotal = Math.max(1, max);

  const confirmedPct = hasDetailedSeats ? Math.min(100, Math.max(0, ((confirmed || 0) / safeTotal) * 100)) : 0;
  const heldPct = hasDetailedSeats ? Math.min(100 - confirmedPct, Math.max(0, ((held || 0) / safeTotal) * 100)) : 0;
  const standardPct = !hasDetailedSeats ? Math.min(100, Math.max(0, ((value || 0) / safeTotal) * 100)) : 0;

  return (
    <div className={`w-full flex flex-col gap-1.5 ${className}`}>
      <div className={`w-full neu-inset p-0.5 overflow-hidden flex ${heightClasses}`}>
        {hasDetailedSeats ? (
          <>
            {/* Confirmed portion (Green) */}
            {confirmedPct > 0 && (
              <div
                style={{ width: `${confirmedPct}%` }}
                className="h-full bg-gradient-to-r from-[#1D7A4A] to-[#2ecc71] rounded-l-full transition-all duration-300"
                title={`Confirmed: ${confirmed}`}
              />
            )}
            {/* Held portion (Purple) */}
            {heldPct > 0 && (
              <div
                style={{ width: `${heldPct}%` }}
                className={`h-full bg-gradient-to-r from-[#683DD0] to-[#8c5bf5] ${
                  confirmedPct === 0 ? 'rounded-l-full' : ''
                } ${confirmedPct + heldPct >= 99 ? 'rounded-r-full' : ''} transition-all duration-300`}
                title={`Held: ${held}`}
              />
            )}
          </>
        ) : (
          <div
            style={{ width: `${standardPct}%` }}
            className="h-full bg-gradient-to-r from-[#683DD0] to-[#4C23A8] rounded-full transition-all duration-300"
          />
        )}
      </div>

      {showLabel && (
        <div className="flex justify-between items-center text-xs text-[#7A7396] px-1 font-medium">
          <span>{hasDetailedSeats ? `${(confirmed || 0) + (held || 0)} occupied` : `${value || 0} / ${max}`}</span>
          <span>{hasDetailedSeats ? `${Math.max(0, safeTotal - (confirmed || 0) - (held || 0))} available` : `${Math.round(standardPct)}%`}</span>
        </div>
      )}
    </div>
  );
};

