import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  as?: React.ElementType;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  as: Component = 'div',
  ...rest
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6 lg:p-8',
    lg: 'p-5 sm:p-8 lg:p-10',
  }[padding];

  return (
    <Component
      className={`neu-card ${paddingClasses} ${className}`}
      {...rest}
    >
      {children}
    </Component>
  );
};

