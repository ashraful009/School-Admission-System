import React from 'react';

export type HoldStatus = 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';

export interface PillProps {
  status: HoldStatus;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const STATUS_CONFIG: Record<HoldStatus, { bg: string; text: string; defaultLabel: string; dotColor: string }> = {
  HELD: {
    bg: 'bg-[#E4DBF7]',
    text: 'text-[#4B22A6]',
    defaultLabel: 'HELD',
    dotColor: 'bg-[#4B22A6]',
  },
  CONFIRMED: {
    bg: 'bg-[#D9F0E3]',
    text: 'text-[#1D7A4A]',
    defaultLabel: 'CONFIRMED',
    dotColor: 'bg-[#1D7A4A]',
  },
  EXPIRED: {
    bg: 'bg-[#E3E0EA]',
    text: 'text-[#6E6885]',
    defaultLabel: 'EXPIRED',
    dotColor: 'bg-[#6E6885]',
  },
  CANCELLED: {
    bg: 'bg-[#F6DDE4]',
    text: 'text-[#B03A5B]',
    defaultLabel: 'CANCELLED',
    dotColor: 'bg-[#B03A5B]',
  },
};

export const Pill: React.FC<PillProps> = ({
  status,
  label,
  size = 'md',
  className = '',
}) => {
  const config = STATUS_CONFIG[status];
  const displayLabel = label || config.defaultLabel;

  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full tracking-wider uppercase select-none transition-colors duration-150 ${config.bg} ${config.text} ${sizeClasses} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      <span>{displayLabel}</span>
    </span>
  );
};

