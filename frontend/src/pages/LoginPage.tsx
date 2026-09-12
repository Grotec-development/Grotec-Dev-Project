import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Lock, CheckCircle2, Loader2, ArrowRight, Sprout, Sparkles } from 'lucide-react';
import { useAuth, authErrorMessage } from '../auth/AuthContext';
import { Alert, Button, Card, Field, Input, cx } from '../components/ui';
import { PageHead } from '../components/PageHead';
import { clearLogoutReason, peekLogoutReason } from '../lib/idleReason';

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

      {/* Style Toggle Floating Pill in Top-Right */}
      <div className="fixed top-4 right-4 z-50">
        <button
          type="button"
          onClick={toggleStyle}
          className="rounded-full border border-slate-300/80 bg-white/95 backdrop-blur px-3.5 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-brand-500 transition-all duration-200"
        >
          {isMinimal ? 'Switch to Variant A (Branded Split)' : 'Switch to Variant B (Minimal Card)'}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VARIANT A: Branded Split Panel (Default) matching PDF mockup Screen 5     */}
      {/* ========================================================================= */}
      {!isMinimal ? (
        <div className="flex min-h-screen w-full flex-col lg:flex-row bg-white">
          {/* Left Panel (~45% width) - Forest Green Branded Area with Ambient Agricultural Animations */}
          <div className="relative flex min-h-[340px] lg:min-h-screen lg:w-[45%] flex-col justify-between bg-brand-900 p-8 lg:p-14 text-white overflow-hidden shadow-2xl">
            
            {/* Ambient Animated Sunbeam Sweeping across fields */}
            <div
              className="pointer-events-none absolute -inset-y-1/2 w-64 bg-gradient-to-r from-transparent via-emerald-400/10 to-transparent animate-sunbeam blur-xl"
              aria-hidden="true"
            />

            {/* Floating Organic Seed / Spore Particles */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <span className="absolute bottom-12 left-[15%] h-2 w-2 rounded-full bg-emerald-400/40 blur-[1px] animate-float-seed-1" />
              <span className="absolute bottom-20 left-[45%] h-2.5 w-2.5 rounded-full bg-emerald-300/35 blur-[1px] animate-float-seed-2" />
              <span className="absolute bottom-8 left-[70%] h-1.5 w-1.5 rounded-full bg-emerald-200/45 blur-[0.5px] animate-float-seed-3" />
              <span className="absolute bottom-28 left-[30%] h-2 w-2 rounded-full bg-emerald-400/30 blur-[1px] animate-float-seed-4" />
              <span className="absolute bottom-16 left-[85%] h-1.5 w-1.5 rounded-full bg-emerald-300/40 blur-[0.5px] animate-float-seed-5" />
            </div>

            {/* Abstract Organic Field-Row Line Art SVG with gentle swaying animation */}
            <div className="pointer-events-none absolute inset-0 opacity-15 animate-field-sway" aria-hidden="true">
              <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1200" fill="none">
                <path d="M-100,200 C200,100 400,300 900,150" stroke="#ffffff" strokeWidth="2.5" />
                <path d="M-100,350 C300,250 500,450 900,300" stroke="#ffffff" strokeWidth="2" />
                <path d="M-100,500 C250,400 450,600 900,450" stroke="#ffffff" strokeWidth="2.5" />
                <path d="M-100,650 C300,550 500,750 900,600" stroke="#ffffff" strokeWidth="2" />
                <path d="M-100,800 C200,700 450,900 900,750" stroke="#ffffff" strokeWidth="2.5" />
                <path d="M-100,950 C350,850 550,1050 900,900" stroke="#ffffff" strokeWidth="2" />
                {/* Organic leaf node curves */}
                <circle cx="280" cy="280" r="160" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="6 6" />
                <circle cx="500" cy="680" r="220" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="8 8" />
              </svg>
            </div>

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