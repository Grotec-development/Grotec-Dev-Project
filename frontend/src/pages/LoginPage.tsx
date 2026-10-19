import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, Lock, CheckCircle2, Loader2, ArrowRight, Sprout, Eye, EyeOff } from 'lucide-react';
import { useAuth, authErrorMessage } from '../auth/AuthContext';
import { Alert, Button, Card, Field, Input, cx } from '../components/ui';
import { PageHead } from '../components/PageHead';
import { clearLogoutReason, peekLogoutReason } from '../lib/idleReason';
import { DEMO_ACCOUNTS, DEMO_ALIASES, isDemoAccountsEnabled, type DemoAccount } from '../lib/demoAccounts';

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
  const [showPassword, setShowPassword] = useState(false);
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

    let targetEmail = (creds?.email ?? email).trim();
    const lower = targetEmail.toLowerCase();
    if (DEMO_ALIASES[lower]) {
      targetEmail = DEMO_ALIASES[lower];
    } else if (!targetEmail.includes('@') && !targetEmail.toUpperCase().startsWith('EMP')) {
      targetEmail = `${lower}@grotec.local`;
    }

    let targetPass = (creds?.password ?? password).trim();
    const passLower = targetPass.toLowerCase();
    if (passLower === 'founder@grotec2026' || passLower === 'founder@grotec2026!') targetPass = 'Founder@Grotec2026!';
    else if (passLower === 'manager@grotec2026' || passLower === 'manager@grotec2026!') targetPass = 'Manager@Grotec2026!';
    else if (passLower === 'teamleader@grotec2026' || passLower === 'teamleader@grotec2026!' || passLower === 'tl@grotec2026' || passLower === 'tl@grotec2026!') targetPass = 'TeamLeader@Grotec2026!';
    else if (passLower === 'agent1@grotec2026' || passLower === 'agent1@grotec2026!' || passLower === 'agent_1@grotec2026' || passLower === 'agent_1@grotec2026!') targetPass = 'Agent1@Grotec2026!';
    else if (passLower === 'agent2@grotec2026' || passLower === 'agent2@grotec2026!' || passLower === 'agent_2@grotec2026' || passLower === 'agent_2@grotec2026!') targetPass = 'Agent2@Grotec2026!';
    else if (passLower === 'agent@grotec2026' || passLower === 'agent@grotec2026!') targetPass = 'Agent1@Grotec2026!';
    else if (passLower === 'staff@grotec2026' || passLower === 'staff@grotec2026!' || passLower === 'hr@grotec2026' || passLower === 'hr@grotec2026!') targetPass = 'Staff@Grotec2026!';
    else if (passLower === 'delivery@grotec2026' || passLower === 'delivery@grotec2026!' || passLower === 'driver@grotec2026' || passLower === 'driver@grotec2026!') targetPass = 'Delivery@Grotec2026!';
    else if (passLower === 'superadmin@grotec2026' || passLower === 'superadmin@grotec2026!' || passLower === 'admin@grotec2026' || passLower === 'admin@grotec2026!') targetPass = 'SuperAdmin@Grotec2026!';

    if (!validateEmail(targetEmail)) return;
    if (!targetPass) {
      setError('Please enter your password');
      return;
    }

    setBusy(true);
    try {
      await login(targetEmail, targetPass);
      setSuccess(true);
      setTimeout(() => {
        navigate(location.state?.from ?? '/', { replace: true });
      }, 500);
    } catch (err: any) {
      if (err?.code === 'ERR_NETWORK' || err?.message?.includes('Network Error') || !err?.response) {
        setError('Cannot connect to server. Please check your internet connection.');
      } else if (err?.response?.status === 401) {
        setError('Employee ID or password is incorrect. Please check your spelling.');
      } else if (err?.response?.data?.error?.message) {
        setError(err.response.data.error.message);
      } else if (err?.response?.data?.message) {
        setError(Array.isArray(err.response.data.message) ? err.response.data.message.join(', ') : err.response.data.message);
      } else {
        setError('Login failed. Please verify your credentials.');
      }
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
          <div className="relative flex min-h-0 lg:min-h-screen lg:w-[45%] flex-col justify-between bg-gradient-to-b from-[#134423] via-[#0e351b] to-[#0a2714] p-5 lg:p-14 text-white overflow-hidden shadow-2xl">
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
              <div className="relative inline-block mb-2 lg:mb-5">
                <div className="h-10 w-10 lg:h-16 lg:w-16 rounded-xl lg:rounded-2xl bg-white p-1.5 lg:p-2 shadow-xl flex items-center justify-center border border-white/60">
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

              <h1 className="text-2xl lg:text-4xl font-black tracking-tight text-white leading-none">
                GROTEC
              </h1>
              <p className="text-base lg:text-2xl font-bold tracking-tight text-emerald-300 mt-0.5 lg:mt-1">
                FarmerOS
              </p>
              <p className="hidden lg:block text-xs text-amber-200/95 font-semibold mt-1 tracking-wide">
                Science for Crops · To get the soil alive...
              </p>
              
              <div className="hidden lg:inline-flex mt-3 items-center gap-1.5 rounded-full bg-emerald-800/60 border border-emerald-700/60 px-3 py-1 text-[11px] font-semibold tracking-wider text-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-400 animate-pulse" />
                Internal Operations Portal
              </div>
            </div>

            {/* Bottom Version Tag */}
            <div className="hidden lg:flex relative z-10 mt-8 pt-6 border-t border-emerald-800/60 text-xs text-emerald-300/80 justify-between items-center font-medium">
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

              <form onSubmit={(e) => signIn(e)} className="space-y-5" aria-label="Sign in form">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Employee ID or Email
                  </label>
                  <Input
                    type="text"
                    name="username"
                    autoComplete="username"
                    disabled={busy || success}
                    value={email}
                    onBlur={() => validateEmail(email)}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) validateEmail(e.target.value);
                    }}
                    placeholder="Employee ID or email"
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
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="current-password"
                      disabled={busy || success}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="py-2 pr-10 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-600 transition-all duration-200"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Primary Full-Width Forest Green Button with Gradient Shimmer & Tactile Hover */}
                <Button
                  type="submit"
                  disabled={busy || success}
                  className="w-full mt-2 py-2.5 text-xs font-bold shadow-sm bg-gradient-to-r from-brand-600 via-emerald-600 to-brand-700 hover:brightness-105 active:scale-[0.99] text-white transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
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

                {/* Quick-fill 1-Tap Credential Helper for All Roles */}
                <OneTapCredentialFill
                  busy={busy || success}
                  currentEmail={email}
                  onFill={(acc, autoSignIn) => {
                    setEmail(acc.email);
                    setPassword(acc.password || 'Grotec@2026');
                    setEmailError(null);
                    setError(null);
                    if (autoSignIn) {
                      void signIn(undefined, { email: acc.email, password: acc.password || 'Grotec@2026' });
                    }
                  }}
                />

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

            <form onSubmit={(e) => signIn(e)} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Employee ID or Email
                </label>
                <Input
                  type="text"
                  name="username"
                  autoComplete="username"
                  disabled={busy || success}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Employee ID or email"
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
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    autoComplete="current-password"
                    disabled={busy || success}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="py-2 pr-10 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-brand-600 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={busy || success}
                className="w-full mt-2 py-2.5 text-xs font-bold shadow-xs bg-brand-600 hover:bg-brand-700 text-white transition-all active:scale-[0.99] cursor-pointer"
              >
                {success ? 'Verified ✓ Redirecting...' : busy ? 'Signing in…' : 'Sign In'}
              </Button>

              {/* Quick-fill 1-Tap Credential Helper for All Roles */}
              <OneTapCredentialFill
                busy={busy || success}
                currentEmail={email}
                onFill={(acc, autoSignIn) => {
                  setEmail(acc.email);
                  setPassword(acc.password || 'Grotec@2026');
                  setEmailError(null);
                  setError(null);
                  if (autoSignIn) {
                    void signIn(undefined, { email: acc.email, password: acc.password || 'Grotec@2026' });
                  }
                }}
              />

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

interface OneTapCredentialFillProps {
  busy: boolean;
  currentEmail: string;
  onFill: (acc: DemoAccount, autoSignIn: boolean) => void;
}

function OneTapCredentialFill({ busy, currentEmail, onFill }: OneTapCredentialFillProps) {
  const [filledRole, setFilledRole] = useState<string | null>(null);

  const handleSelect = (acc: DemoAccount, autoSignIn: boolean) => {
    setFilledRole(acc.label);
    setTimeout(() => setFilledRole(null), 3000);
    onFill(acc, autoSignIn);
  };

  if (!isDemoAccountsEnabled() || DEMO_ACCOUNTS.length === 0) return null;

  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200/90 p-3 space-y-2 text-left shadow-2xs">
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-800">Quick 1-Tap Sign In:</span>
          {filledRole ? (
            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded animate-pulse">
              ✓ {filledRole}
            </span>
          ) : (
            <span className="text-[9px] text-slate-400">Select any of 5 system roles</span>
          )}
        </div>
        <span className="text-[9px] font-medium text-slate-400">Instant Demo Auth</span>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
        {DEMO_ACCOUNTS.map((acc) => {
          const isSelected = currentEmail.toLowerCase() === acc.email.toLowerCase();
          return (
            <div
              key={acc.label + acc.email}
              className={cx(
                'rounded-lg border px-2.5 py-2 transition-all flex items-center justify-between gap-2',
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/70 shadow-2xs ring-1 ring-emerald-500/20'
                  : 'border-slate-200 bg-white hover:border-emerald-400 hover:bg-slate-50/80 shadow-2xs'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900 text-[11px] leading-tight">
                    {acc.label}
                  </span>
                  <span className="text-[8px] font-semibold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded shrink-0">
                    {acc.badge}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                  {acc.email}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelect(acc, false)}
                  className="px-2 py-1 rounded bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-semibold text-[9px] text-center transition cursor-pointer"
                  title={`Fill ${acc.label} credentials`}
                >
                  Fill
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleSelect(acc, true)}
                  className="px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[9px] transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                  title={`Sign in as ${acc.label}`}
                >
                  <span>⚡</span> Sign In
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}