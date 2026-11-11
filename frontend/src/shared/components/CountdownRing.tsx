import React from 'react';

export interface CountdownRingProps {
  totalSeconds?: number;
  secondsLeft?: number;
  isExpired?: boolean;
  isConfirmed?: boolean;
  isCancelled?: boolean;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export const CountdownRing: React.FC<CountdownRingProps> = ({
  totalSeconds = 600,
  secondsLeft = 600,
  isExpired = false,
  isConfirmed = false,
  isCancelled = false,
  size = 220,
  strokeWidth = 14,
  className = '',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate progress ratio
  const ratio = isExpired || isCancelled
    ? 0
    : isConfirmed
    ? 1
    : Math.max(0, Math.min(1, secondsLeft / Math.max(1, totalSeconds)));

  const strokeDashoffset = circumference - ratio * circumference;

  // Format time MM:SS
  const safeSeconds = Math.max(0, Math.floor(secondsLeft));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  const timeString = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;

  const strokeColor = isConfirmed
    ? '#1D7A4A'
    : isExpired || isCancelled || safeSeconds <= 60
    ? '#B03A5B'
    : '#683DD0';

  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E3DFED"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Animated / styled stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-1000 ease-linear"
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
        {isConfirmed ? (
          <>
            <div className="w-12 h-12 rounded-full bg-[#D9F0E3] text-[#1D7A4A] flex items-center justify-center mb-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#1D7A4A] uppercase tracking-wider font-['Poppins']">
              Confirmed
            </span>
          </>
        ) : isCancelled ? (
          <>
            <div className="w-12 h-12 rounded-full bg-[#F6DDE4] text-[#B03A5B] flex items-center justify-center mb-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#B03A5B] uppercase tracking-wider font-['Poppins']">
              Cancelled
            </span>
          </>
        ) : isExpired ? (
          <>
            <div className="w-12 h-12 rounded-full bg-[#F6DDE4] text-[#B03A5B] flex items-center justify-center mb-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-[#B03A5B] uppercase tracking-wider font-['Poppins']">
              Expired
            </span>
          </>
        ) : (
          <>
            <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[#241A3F] font-['Poppins']">
              {timeString}
            </span>
            <span className="text-xs text-[#7A7396] font-medium mt-1 uppercase tracking-wider">
              Time left to pay
            </span>
          </>
        )}
      </div>
    </div>
  );
};

