import React from 'react';

export type BannerVariant = 'error' | 'info' | 'warning' | 'success';

export interface BannerProps {
  variant?: BannerVariant;
  title?: string;
  message?: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
  action?: React.ReactNode;
}

const VARIANT_CONFIG: Record<
  BannerVariant,
  {
    bg: string;
    border: string;
    text: string;
    iconColor: string;
    icon: React.ReactNode;
  }
> = {
  error: {
    bg: 'bg-[#FDF2F4]',
    border: 'border-[#F6DDE4]',
    text: 'text-[#841935]',
    iconColor: 'text-[#B03A5B]',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
  info: {
    bg: 'bg-[#F2EDFB]',
    border: 'border-[#E4DBF7]',
    text: 'text-[#30166C]',
    iconColor: 'text-[#4B22A6]',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-[#FFFBEB]',
    border: 'border-[#FDE68A]',
    text: 'text-[#92400E]',
    iconColor: 'text-[#D97706]',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
    ),
  },
  success: {
    bg: 'bg-[#EDF8F1]',
    border: 'border-[#D9F0E3]',
    text: 'text-[#124B2E]',
    iconColor: 'text-[#1D7A4A]',
    icon: (
      <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
};

export const Banner: React.FC<BannerProps> = ({
  variant = 'info',
  title,
  message,
  children,
  onDismiss,
  action,
  className = '',
}) => {
  const config = VARIANT_CONFIG[variant];

  return (
    <div
      role="alert"
      className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-start gap-3.5 transition-all shadow-sm ${config.bg} ${config.border} ${config.text} ${className}`}
    >
      <div className="flex items-start gap-3.5 flex-1 min-w-0">
        <div className={`mt-0.5 shrink-0 ${config.iconColor}`}>{config.icon}</div>
        <div className="flex-1 min-w-0">
          {title && <h4 className="font-semibold text-sm mb-0.5 font-['Poppins'] break-words">{title}</h4>}
          {message && <p className="text-sm leading-relaxed break-words">{message}</p>}
          {children}
        </div>
      </div>
      {action && <div className="shrink-0 self-start sm:self-auto ml-8 sm:ml-2">{action}</div>}
      {onDismiss && (
        <button
          onClick={onDismiss}
          type="button"
          aria-label="Dismiss banner"
          className="shrink-0 p-1 rounded-lg hover:bg-black/5 active:bg-black/10 transition-colors cursor-pointer text-current opacity-70 hover:opacity-100 self-end sm:self-auto"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};
