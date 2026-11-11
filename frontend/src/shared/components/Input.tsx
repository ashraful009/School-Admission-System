import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, rightElement, className = '', id, disabled, ...rest }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-semibold text-[#241A3F] pl-1">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-4 pointer-events-none text-[#7A7396]">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            disabled={disabled}
            className={`w-full neu-inset px-4 py-3.5 text-[#241A3F] placeholder-[#7A7396] text-base transition-colors duration-200 outline-none border border-transparent focus:border-[#6B3FD4] ${
              icon ? 'pl-11' : ''
            } ${rightElement ? 'pr-12' : ''} ${
              error ? 'border-[#B03A5B] focus:border-[#B03A5B]' : ''
            } ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
            {...rest}
          />
          {rightElement && (
            <div className="absolute right-4 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-[#B03A5B] pl-1 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-[#7A7396] pl-1">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';

