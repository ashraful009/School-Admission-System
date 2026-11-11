import React from 'react';
import { Card } from './Card';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = '',
}) => {
  return (
    <Card className={`text-center flex flex-col items-center justify-center py-12 px-6 ${className}`}>
      <div className="w-16 h-16 rounded-full bg-[#E4DBF7] flex items-center justify-center text-[#4B22A6] mb-4 shadow-inner">
        {icon || (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>
      <h3 className="text-xl font-bold text-[#241A3F] mb-1.5 font-['Poppins']">{title}</h3>
      <p className="text-sm text-[#7A7396] max-w-sm mb-6 leading-relaxed">{description}</p>
      {action && <div>{action}</div>}
    </Card>
  );
};

