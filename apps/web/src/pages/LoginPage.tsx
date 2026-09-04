import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, authErrorMessage } from '../auth/AuthContext';
import { Alert, Button, Card, Field, Input } from '../components/ui';

const DEMO_PASSWORD = 'Founder@123';

const DEMO_ACCOUNTS = [
  { label: 'Founder', role: 'Full access — everything incl. Team, Audit log', email: 'founder@grotec.local' },
  { label: 'Manager/Admin', role: 'Records + team + crops (no audit log)', email: 'manager@grotec.local' },
  { label: 'Telecaller/Agent', role: 'Assigned records — customers, leads, crops', email: 'agent@grotec.local' },
  { label: 'Staff', role: 'RBAC demo — no CRM access in Phase 1', email: 'staff@grotec.local' },
];

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('agent@grotec.local');
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authed') return <Navigate to={location.state?.from ?? '/'} replace />;

  async function signIn(e: FormEvent | undefined, creds?: { email: string; password: string }) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login((creds?.email ?? email).trim(), creds?.password ?? password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">G</div>
          <h1 className="text-xl font-semibold text-slate-900">GROTEC FarmerOS — CRM</h1>
          <p className="text-sm text-slate-500">Sign in to continue</p>
        </div>

        <Card className="p-6">
          <form onSubmit={(e) => signIn(e)} className="space-y-4">
            {error ? <Alert tone="error">{error}</Alert> : null}
            <Field label="Email">
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </Card>

        <div className="mt-5">
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
            Demo credentials — dev only, click a role to sign in instantly
          </p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                disabled={busy}
                onClick={() => signIn(undefined, { email: account.email, password: DEMO_PASSWORD })}
                className="group flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-left shadow-sm transition hover:border-brand-500 hover:bg-brand-50 disabled:opacity-50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{account.label}</span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{account.role}</span>
                  </div>
                  <div className="truncate font-mono text-xs text-slate-500">
                    {account.email} <span className="text-slate-400">·</span> {DEMO_PASSWORD}
                  </div>
                </div>
                <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 group-hover:border-brand-500 group-hover:text-brand-600">
                  Sign in →
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
            Credentials are seeded in dev only (<code>FOUNDER_PASSWORD</code> / <code>SEED_EMPLOYEES</code> in the API .env) — never in production.
          </p>
        </div>
      </div>
    </div>
  );
}