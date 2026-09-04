import type { ReactNode } from 'react';
import { Card } from '../components/ui';

interface Props {
  title: string;
  month: string;
  description: string;
  bullets: string[];
  children?: ReactNode;
}

export function MonthPlaceholder({ title, month, description, bullets }: Props) {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">
          {description}
        </p>
      </div>
      <Card className="max-w-2xl p-6">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
          Ships in {month} of the CRM build
        </span>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600">
          {bullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
