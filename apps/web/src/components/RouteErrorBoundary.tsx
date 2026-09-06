import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

export function RouteErrorBoundary() {
  const error = useRouteError();

  let title = 'Unexpected Application Error';
  let message = 'An unexpected error occurred while rendering this section.';

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`;
    message = error.data?.message || message;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200/90 bg-white p-6 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-100">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-xs text-slate-600 font-mono bg-slate-50 p-2.5 rounded border border-slate-100 text-left overflow-x-auto break-all leading-relaxed">
          {message}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reload Page
          </button>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-700 shadow-xs"
          >
            <Home className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}