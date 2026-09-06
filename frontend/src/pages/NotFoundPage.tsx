import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';
import { PageHead } from '../components/PageHead';
import { useAuth } from '../auth/AuthContext';

export function NotFoundPage() {
  const { status } = useAuth();
  return (
    <>
      <PageHead
        title="Page Not Found — GROTEC FarmerOS"
        description="The page you are looking for does not exist. Return to GROTEC FarmerOS."
      />
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center max-w-md">
          <Link
            to={status === 'authed' ? '/dashboard' : '/login'}
            className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-lg hover:shadow-xl border border-slate-200/80 transition"
            aria-label="Go to GROTEC FarmerOS home"
          >
            <img
              src="/grotec_logo.webp"
              alt="GROTEC — Science for Crops"
              width={474}
              height={474}
              className="h-full w-full object-contain aspect-square"
            />
          </Link>
          <p className="text-8xl font-black text-slate-100 select-none" aria-hidden="true">404</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Page Not Found</h1>
          <p className="mt-3 text-slate-500 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist, or you may not have permission to view it.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            {status === 'authed' ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition shadow-sm"
              >
                <Home className="h-4 w-4" aria-hidden="true" />
                Go to Dashboard
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition shadow-sm"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
