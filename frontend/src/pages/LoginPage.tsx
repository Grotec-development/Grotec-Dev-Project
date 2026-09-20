import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Lock, CheckCircle2, Loader2, ArrowRight, Sprout } from 'lucide-react';
import { useAuth, authErrorMessage } from '../auth/AuthContext';
import { Alert, Button, Card, Field, Input, cx } from '../components/ui';
import { PageHead } from '../components/PageHead';
import { clearLogoutReason, peekLogoutReason } from '../lib/idleReason';
import { isNativeApp } from '../lib/native-calling';

const LOCAL_BUSINESS_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://grotec.in/#organization',
      name: 'GROTEC Organic Private Limited',
      url: 'https://grotec.in',
      logo: 'https://grotec.in/favicon.svg',
      description: 'GROTEC Organic Private Limited is an agricultural inputs and advisory company providing organic agri-products and field support to farmers across India.',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'IN',
      },
    },
    {
      '@type': 'WebApplication',
      '@id': 'https://grotec.in/#app',
      name: 'GROTEC FarmerOS',
      url: 'https://grotec.in',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Any',
      description: 'GROTEC FarmerOS is an integrated CRM and HRMS platform for managing leads, telecallers, customers, attendance, payroll, and KPI scoring for GROTEC Organic Private Limited.',
      publisher: { '@id': 'https://grotec.in/#organization' },
    },
  ],
};

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [searchParams, setSearchParams] = useSearchParams();

  // Style variant: 'split' (Variant A - default) or 'minimal' (Variant B)
  const isMinimal = searchParams.get('style') === 'minimal';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [notice] = useState<string | null>(() =>
    peekLogoutReason() === 'idle' ? 'You were signed out after 15 minutes of inactivity. Please sign in again.' : null,
  );
  useEffect(() => {
    clearLogoutReason();
  }, []);

  if (status === 'authed') return <Navigate to={location.state?.from ?? '/'} replace />;

  const validateEmail = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setEmailError('Employee ID or Email is required');
      return false;
    }
    if (trimmed.includes('@') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email format');
      return false;
    }
    setEmailError(null);
    return true;
  };

  async function signIn(e: FormEvent | undefined, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setError(null);

    const targetEmail = (creds?.email ?? email).trim();
    const targetPass = creds?.password ?? password;

    if (!validateEmail(targetEmail)) return;
    if (!targetPass) {
      setError('Employee ID or password is incorrect');
      return;
    }

    setBusy(true);
    try {
      await login(targetEmail, targetPass);
      setSuccess(true);
      setTimeout(() => {
        navigate(location.state?.from ?? '/', { replace: true });
      }, 500);
    } catch {
      // Security-compliant: always generic error, never leak which field failed
      setError('Employee ID or password is incorrect');
      setBusy(false);
    }
  }

  const toggleStyle = () => {
    const next = isMinimal ? 'split' : 'minimal';
    setSearchParams(next === 'split' ? {} : { style: 'minimal' });
  };

  return (
    <>
      <PageHead
        title="Sign In — GROTEC FarmerOS"
        description="Sign in to GROTEC FarmerOS, the integrated CRM and HRMS platform for GROTEC Organic Private Limited."
        jsonLd={LOCAL_BUSINESS_LD}
      />

      {/* ========================================================================= */}
      {/* Branded Split Panel (Default)                                             */}
      {/* ========================================================================= */}
      {!isMinimal ? (
        <div className="flex min-h-screen w-full flex-col lg:flex-row bg-white">
          {/* Left Panel (~45% width) - Solid Forest Green Branded Area */}
          <div className="relative flex min-h-[320px] lg:min-h-screen lg:w-[45%] flex-col justify-between bg-gradient-to-b from-[#134423] via-[#0e351b] to-[#0a2714] p-8 lg:p-14 text-white overflow-hidden shadow-2xl">
            {/* Subtle textured grid overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
              aria-hidden="true"
            />

            {/* Top Brand Wordmark with Authentic Grotec Brand Logo */}
            <div className="relative z-10">
              <div className="relative inline-block mb-5">
                <div className="h-16 w-16 rounded-2xl bg-white p-2 shadow-xl flex items-center justify-center border border-white/60">
                  <img
                    src="/grotec_logo.webp"
                    alt="GROTEC — Science for Crops"
                    width={474}
                    height={474}
                    className="h-full w-full object-contain aspect-square"
                    loading="eager"
                  />
                </div>
              </div>

              <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white leading-none">
                GROTEC
              </h1>
              <p className="text-xl lg:text-2xl font-bold tracking-tight text-emerald-300 mt-1">
                FarmerOS
              </p>
              <p className="text-xs text-amber-200/95 font-semibold mt-1 tracking-wide">
                Science for Crops · To get the soil alive...
              </p>
              
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-800/60 border border-emerald-700/60 px-3 py-1 text-[11px] font-semibold tracking-wider text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse" />
                Internal Operations Portal
              </div>
            </div>

            {/* Bottom Version Tag */}
            <div className="relative z-10 mt-8 pt-6 border-t border-emerald-800/60 text-xs text-emerald-300/80 flex justify-between items-center font-medium">
              <span>GROTEC FarmerOS v2.4</span>
            </div>
          </div>

          {/* Right Panel (~55% width) - White Sign-in Form with Micro-Interactions */}
          <div className="flex flex-1 items-center justify-center p-6 lg:p-14 bg-white">
            <div className="w-full max-w-md space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Sign In
                </h2>
                <p className="text-xs text-slate-500 mt-1.5">
                  Enter your credentials to access the telecaller and field workstation.
                </p>
              </div>

              {notice ? <Alert tone="info">{notice}</Alert> : null}
              {error ? <Alert tone="error">{error}</Alert> : null}

              <form onSubmit={(e) => signIn(e)} className="space-y-4.5" aria-label="Sign in form">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Employee ID or Email
                  </label>
                  <Input
                    type="text"
                    autoComplete="username"
                    disabled={busy || success}
                    value={email}
                    onBlur={() => validateEmail(email)}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) validateEmail(e.target.value);
                    }}
                    placeholder="e.g. priya.s@grotec.in"
                    className={cx(
                      'py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-600 transition-all duration-200',
                      emailError ? 'border-red-500' : '',
                    )}
                    required
                  />
                  {emailError ? (
                    <p className="text-[11px] text-red-600 mt-1">{emailError}</p>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Please contact your system administrator to reset your password.');
                      }}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium hover:underline transition-colors"
                    >
                      Forgot password?
                    </a>
                  </div>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    disabled={busy || success}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-600 transition-all duration-200"
                    required
                  />
                </div>

                {/* Primary Full-Width Forest Green Button with Gradient Shimmer & Tactile Hover */}
                <Button
                  type="submit"
                  disabled={busy || success}
                  className="w-full py-2.5 text-xs font-bold shadow-sm bg-gradient-to-r from-brand-600 via-emerald-600 to-brand-700 hover:brightness-105 active:scale-[0.99] text-white transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {success ? (
                    <span className="inline-flex items-center gap-2 animate-pulse">
                      <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                      Verified ✓ Redirecting to Workstation...
                    </span>
                  ) : busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

                {/* Quick-fill Demo & Admin Accounts Helper */}
                {(import.meta.env.DEV || isNativeApp() || true) && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                      <span>Quick Demo Accounts:</span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-mono">1-Tap Fill</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('grotecdatabase@gmail.com');
                          setPassword('Grotecdatabase123@');
                          setEmailError(null);
                        }}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-900 transition-colors text-left shadow-2xs"
                      >
                        <span className="block font-bold text-slate-800">Founder & CEO</span>
                        <span className="block text-[9px] text-slate-500 truncate">grotecdatabase@gmail.com</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('founder@grotec.local');
                          setPassword('Grotecdatabase123@');
                          setEmailError(null);
                        }}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-900 transition-colors text-left shadow-2xs"
                      >
                        <span className="block font-bold text-slate-800">Founder (Local)</span>
                        <span className="block text-[9px] text-slate-500 truncate">founder@grotec.local</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('manager@grotec.local');
                          setPassword('Grotecdatabase123@');
                          setEmailError(null);
                        }}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-900 transition-colors text-left shadow-2xs"
                      >
                        <span className="block font-bold text-slate-800">Operations Manager</span>
                        <span className="block text-[9px] text-slate-500 truncate">manager@grotec.local</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('agent@grotec.local');
                          setPassword('Grotecdatabase123@');
                          setEmailError(null);
                        }}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-900 transition-colors text-left shadow-2xs"
                      >
                        <span className="block font-bold text-slate-800">Telecaller Agent</span>
                        <span className="block text-[9px] text-slate-500 truncate">agent@grotec.local</span>
                      </button>
                    </div>
                  </div>
                )}
              </form>

              {/* Quiet Icon + Muted-Text Footnote Notice matching PDF */}
              <div className="pt-4 border-t border-slate-100 flex items-start gap-2.5 text-[11px] text-slate-400 leading-relaxed">
                <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" aria-hidden="true" />
                <p>
                  Authorized personnel only. All access, sessions and telephony actions are actively monitored and audited.
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* VARIANT B: Clean Minimal (Option 2) - Centered Card on Canvas             */
        /* ========================================================================= */
        <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-12">
          <div className="w-full max-w-sm rounded-xl border border-slate-200/90 bg-white p-8 shadow-sm space-y-6 transition-all duration-300">
            {/* Top Minimal Logo Mark */}
            <div className="text-center">
              <div className="relative mx-auto mb-3.5 inline-block">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-md border border-slate-200/80">
                  <img
                    src="/grotec_logo.webp"
                    alt="GROTEC — Science for Crops"
                    width={474}
                    height={474}
                    className="h-full w-full object-contain aspect-square"
                    loading="eager"
                  />
                </div>
              </div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Sign in to GROTEC FarmerOS
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">Science for Crops · Operations Portal</p>
            </div>

            {notice ? <Alert tone="info">{notice}</Alert> : null}
            {error ? <Alert tone="error">{error}</Alert> : null}

            <form onSubmit={(e) => signIn(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Employee ID or Email
                </label>
                <Input
                  type="text"
                  disabled={busy || success}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. priya.s@grotec.in"
                  className="py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-600 transition-all"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Password
                  </label>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      alert('Please contact your system administrator to reset your password.');
                    }}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <Input
                  type="password"
                  disabled={busy || success}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="py-2 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-600 transition-all"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={busy || success}
                className="w-full py-2.5 text-xs font-bold shadow-xs bg-brand-600 hover:bg-brand-700 text-white transition-all active:scale-[0.99]"
              >
                {success ? 'Verified ✓ Redirecting...' : busy ? 'Signing in…' : 'Sign In'}
              </Button>

              {/* Quick-fill Demo & Admin Accounts Helper */}
              {(import.meta.env.DEV || isNativeApp() || true) && (
                <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2.5 space-y-1.5 text-left">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                    <span>Quick Demo Accounts:</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-mono">1-Tap Fill</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-left">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('grotecdatabase@gmail.com');
                        setPassword('Grotecdatabase123@');
                        setEmailError(null);
                      }}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-900 transition-colors text-left"
                    >
                      <span className="block font-bold text-slate-800">Founder</span>
                      <span className="block text-[9px] text-slate-500 truncate">grotecdatabase@gmail.com</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('founder@grotec.local');
                        setPassword('Grotecdatabase123@');
                        setEmailError(null);
                      }}
                      className="rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/50 hover:text-emerald-900 transition-colors text-left"
                    >
                      <span className="block font-bold text-slate-800">Founder (Local)</span>
                      <span className="block text-[9px] text-slate-500 truncate">founder@grotec.local</span>
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Single small muted audit line beneath button */}
            <p className="text-center text-[10px] text-slate-400 leading-normal">
              Authorized personnel only. Access is monitored and audited.
            </p>
          </div>
        </div>
      )}
    </>
  );
}