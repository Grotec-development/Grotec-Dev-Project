import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { Alert, Card } from '../components/ui';

export function RestrictedPage() {
  return (
    <div className="p-8">
      <Card className="max-w-lg p-6">
        <div className="flex items-start gap-3 mb-4">
          <ShieldAlert className="h-6 w-6 shrink-0 text-red-500 mt-0.5" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-semibold text-slate-900 mb-1">Access Restricted</h1>
            <Alert tone="error">
              You do not have permission to view this section. Contact the Founder or your Manager if you believe this is an error.
            </Alert>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </Link>
      </Card>
    </div>
  );
}
