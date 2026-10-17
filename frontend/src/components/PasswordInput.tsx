import { useState, forwardRef, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cx } from './ui';

export interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string | null;
  hint?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, className, disabled, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            {...props}
            id={inputId}
            ref={ref}
            type={visible ? 'text' : 'password'}
            disabled={disabled}
            className={cx(
              'w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm shadow-xs transition-colors',
              'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500',
              disabled && 'bg-slate-50 cursor-not-allowed opacity-60',
              error
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                : 'border-slate-300 hover:border-slate-400',
              className,
            )}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer disabled:cursor-not-allowed"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error ? (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        ) : hint ? (
          <p className="text-[11px] text-slate-500">{hint}</p>
        ) : null}
      </div>
    );
  },
);

PasswordInput.displayName = 'PasswordInput';
