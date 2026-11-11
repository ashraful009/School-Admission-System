import React from 'react';

export interface SkeletonProps {
  variant?: 'text' | 'title' | 'rect' | 'circle' | 'card';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className = '',
}) => {
  const variantStyles = {
    text: 'h-4 w-full rounded-md',
    title: 'h-7 w-2/3 rounded-lg',
    rect: 'h-24 w-full rounded-2xl',
    circle: 'h-12 w-12 rounded-full',
    card: 'h-48 w-full rounded-[26px]',
  }[variant];

  const inlineStyles: React.CSSProperties = {
    width: width !== undefined ? width : undefined,
    height: height !== undefined ? height : undefined,
  };

  return (
    <div
      style={inlineStyles}
      className={`animate-pulse bg-gradient-to-r from-[#E3DFED] via-[#ECE8F5] to-[#E3DFED] ${variantStyles} ${className}`}
    />
  );
};

