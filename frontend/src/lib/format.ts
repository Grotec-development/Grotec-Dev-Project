/** '+919876543210' → '+91 98765 43210'. */
export function formatE164(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    const national = digits.slice(2);
    return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
  }
  return value;
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function initialsOf(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Formats numbers with Indian grouping system (en-IN), e.g. 5,004 or 1,50,000. */
export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? Number(value) : value;
  if (Number.isNaN(num)) return '0';
  return num.toLocaleString('en-IN');
}

