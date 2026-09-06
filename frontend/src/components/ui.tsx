import { clsx, type ClassValue } from 'clsx';
import {
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import { Loader2, AlertTriangle, AlertCircle, CheckCircle2, HelpCircle, X } from 'lucide-react';

export function cx(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

const buttonVariants = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600 shadow-xs active:bg-brand-800',
  accent: 'bg-accent-500 text-white hover:bg-accent-600 focus-visible:outline-accent-500 shadow-xs active:bg-accent-700 font-semibold',
  call: 'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600 shadow-xs font-semibold active:bg-emerald-800',
  outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-xs active:bg-slate-100',
  ghost: 'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-xs active:bg-red-800 focus-visible:outline-red-600',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: 'xs' | 'sm' | 'md';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        size === 'xs' ? 'px-2 py-1 text-[11px]' : size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        buttonVariants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : null}
      {children}
    </button>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-xs placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 disabled:bg-slate-50 disabled:text-slate-400',
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        'w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-xs focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600',
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
      {children}
      {hint ? <span className="block text-[10px] text-slate-400">{hint}</span> : null}
    </label>
  );
}

export const badgeTones = {
  green: 'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
  red: 'bg-red-50 text-red-700 border border-red-200/80',
  slate: 'bg-slate-100 text-slate-600 border border-slate-200/80',
  amber: 'bg-amber-50 text-amber-700 border border-amber-200/80',
  blue: 'bg-blue-50 text-blue-700 border border-blue-200/80',
  orange: 'bg-accent-50 text-accent-700 border border-accent-200/80',
  accent: 'bg-accent-50 text-accent-700 border border-accent-200/80',
} as const;

export function Badge({ tone = 'slate', children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', badgeTones[tone])}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const raw = status || '';
  const normalized = raw.toUpperCase().trim().replace(/[-_]/g, ' ');

  // 1. Green tones: Active, Interested, Approved, Converted, Present, Paid, Completed
  if (['ACTIVE', 'INTERESTED', 'OPEN', 'APPROVED', 'CONVERTED', 'PRESENT', 'PAID', 'COMPLETED', 'HEALTHY'].includes(normalized)) {
    const label = normalized.charAt(0) + normalized.slice(1).toLowerCase();
    return <Badge tone="green">{label}</Badge>;
  }

  // 2. Blue tones: New, Scheduled, Connecting, In Progress, Submitted, Draft
  if (['NEW', 'SCHEDULED', 'CONNECTING', 'IN PROGRESS', 'SUBMITTED', 'DRAFT'].includes(normalized)) {
    const label = normalized.charAt(0) + normalized.slice(1).toLowerCase();
    return <Badge tone="blue">{label}</Badge>;
  }

  // 3. Slate tones: Inactive, Closed, Not Interested, Routine, Cancelled
  if (['INACTIVE', 'CLOSED', 'NOT INTERESTED', 'ROUTINE', 'CANCELLED', 'RETIRED'].includes(normalized)) {
    const label = normalized === 'NOT INTERESTED' ? 'Not Interested' : normalized.charAt(0) + normalized.slice(1).toLowerCase();
    return <Badge tone="slate">{label}</Badge>;
  }

  // 4. Amber tones: Follow Up, Pending, Late, Half Day, Warning, Review
  if (['FOLLOW UP', 'PENDING', 'LATE', 'HALF DAY', 'WARNING', 'REVIEW'].includes(normalized)) {
    const label = normalized === 'FOLLOW UP' ? 'Follow up' : normalized === 'HALF DAY' ? 'Half Day' : normalized.charAt(0) + normalized.slice(1).toLowerCase();
    return <Badge tone="amber">{label}</Badge>;
  }

  // 5. Red tones: Overdue, High Priority, Urgent, Rejected, Absent, Failed, Critical
  if (['OVERDUE', 'HIGH PRIORITY', 'HIGH', 'URGENT', 'REJECTED', 'ABSENT', 'FAILED', 'CRITICAL'].includes(normalized)) {
    const label = normalized === 'HIGH PRIORITY' || normalized === 'HIGH' ? 'High Priority' : normalized.charAt(0) + normalized.slice(1).toLowerCase();
    return <Badge tone="red">{label}</Badge>;
  }

  return <Badge tone="slate">{raw || '—'}</Badge>;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-lg border border-slate-200/90 bg-white shadow-xs', className)}>{children}</div>;
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">{title}</h2>
      {action}
    </div>
  );
}

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  );
}

export function THead({ children, className }: TableHTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cx('border-b border-slate-200 bg-[#f8faf8] text-[10px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10', className)}>
      {children}
    </thead>
  );
}

export function TH({ className, children, align = 'left', ...props }: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={cx('px-3.5 py-2.5 font-bold', alignClass, className)} {...props}>
      {children}
    </th>
  );
}

export function TD({ className, children, align = 'left', ...props }: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'right' | 'center' }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td className={cx('border-b border-slate-100 px-3.5 py-2 align-middle text-slate-700', alignClass, className)} {...props}>
      {children}
    </td>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded bg-slate-200/70', className)} />;
}

export function TableSkeleton({ rows = 5, cols = 6, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cx('overflow-x-auto p-4 space-y-3', className)}>
      <div className="flex gap-4 border-b border-slate-200 pb-2">
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 items-center py-2.5 border-b border-slate-100">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cx('h-3.5 flex-1', c === 0 ? 'w-1/3' : 'w-full')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {Icon ? (
        <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-400">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description ? <p className="mt-1 text-xs text-slate-500 max-w-sm">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary' | 'warning';
  isLoading?: boolean;
  withReason?: boolean;
  reasonPlaceholder?: string;
  onConfirmReason?: (reason: string) => void | Promise<void>;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
  withReason = false,
  reasonPlaceholder = 'Please specify the reason…',
  onConfirmReason,
}: ConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async () => {
    if (withReason) {
      if (!reason.trim()) {
        setError('A reason is required to proceed.');
        return;
      }
      setError(null);
      if (onConfirmReason) {
        await onConfirmReason(reason.trim());
      }
    } else {
      await onConfirm();
    }
  };

  const variantButton =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-emerald-700 hover:bg-emerald-800 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            {variant === 'danger' ? (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            ) : variant === 'warning' ? (
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            ) : (
              <HelpCircle className="h-4 w-4 text-emerald-700 shrink-0" />
            )}
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div className="text-xs text-slate-600 leading-relaxed">{description}</div>

          {withReason && (
            <div className="mt-3 space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                Reason / Justification <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={reasonPlaceholder}
                className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
              {error ? <p className="text-[11px] font-medium text-red-600">{error}</p> : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 bg-slate-50/50 rounded-b-lg">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            size="sm"
            className={cx('font-semibold shadow-xs', variantButton)}
            loading={isLoading}
            onClick={() => void handleAction()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function Alert({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
  return (
    <div
      className={cx(
        'rounded-md px-3 py-2 text-sm',
        tone === 'error' ? 'bg-red-50 text-red-700 border border-red-200/60' : 'bg-blue-50 text-blue-700 border border-blue-200/60',
      )}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
