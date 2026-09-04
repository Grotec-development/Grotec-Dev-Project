import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarClock,
  CheckCircle2,
  LayoutDashboard,
  PhoneCall,
  PhoneMissed,
  StickyNote,
  UserCheck,
  Users,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { CallStatus, CallOutcome, DashboardSummary, FollowUp } from '../lib/types';
import { formatDate, formatE164 } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, CardHeader, Spinner, cx } from '../components/ui';

const OUTCOME_LABEL: Record<CallOutcome, { label: string; tone: 'green' | 'red' | 'amber' }> = {
  INTERESTED: { label: 'Interested', tone: 'green' },
  NOT_INTERESTED: { label: 'Not interested', tone: 'red' },
  NOT_ANSWERED: { label: 'Not answered', tone: 'amber' },
};

export function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary')).data,
  });

  const followUpsQuery = useQuery({
    queryKey: ['dashboard-followups'],
    queryFn: async () => (await api.get<FollowUp[]>('/follow-ups')).data,
  });

  const completeFollowUp = useMutation({
    mutationFn: async (id: string) => api.post(`/follow-ups/${id}/complete`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-followups'] });
    },
    onError: () => undefined,
  });

  if (summaryQuery.isError) {
    return (
      <div className="p-8">
        <Alert tone="error">{errorMessage(summaryQuery.error)}</Alert>
      </div>
    );
  }
  if (!summaryQuery.data) {
    return (
      <div className="p-8">
        <Spinner label="Loading dashboard…" />
      </div>
    );
  }

  const s = summaryQuery.data;
  const scopeLabel = s.scope === 'me' ? 'Your day' : 'Team day';
  const isOverdue = (dueAt: string) => new Date(dueAt).getTime() < Date.now();
  const pendingFollowUps = (followUpsQuery.data ?? [])
    .filter((f) => f.status === 'PENDING')
    .slice(0, 8);

  const stat = (label: string, value: number, sub?: string) => (
    <Card className="px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-slate-400">{sub}</p> : null}
    </Card>
  );

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <LayoutDashboard className="h-6 w-6 text-brand-600" />
            {scopeLabel}
          </h1>
          <p className="text-sm text-slate-500">
            {s.scope === 'me' ? `Welcome back, ${user?.fullName ?? ''}` : 'Team-wide overview across every agent and relationship manager'} — computed from live CRM data.
          </p>
        </div>
        <Badge tone="slate" >
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stat('Dialed today', s.calls.dialedToday)}
        {stat('Connected', s.calls.connectedToday)}
        {stat('Not answered', s.calls.notAnsweredToday)}
        {stat('Pending follow-ups', s.followUps.pending, s.followUps.overdue > 0 ? `${s.followUps.overdue} overdue` : 'nothing overdue')}
        {stat('Open leads', s.leads.open, `${s.leads.newThisWeek} new this week`)}
        {stat('Converted customers', s.customers.converted, `${s.customers.interested} interested all-time`)}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Follow-ups due */}
        <Card className="flex min-h-0 flex-col">
          <CardHeader
            title="Follow-ups due"
            action={
              <span className="flex items-center gap-2 text-xs text-slate-400">
                <Badge tone="amber">{s.followUps.dueToday} due today</Badge>
                <Badge tone={s.followUps.overdue > 0 ? 'red' : 'green'}>{s.followUps.overdue} overdue</Badge>
              </span>
            }
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {followUpsQuery.isPending ? (
              <Spinner label="Loading follow-ups…" />
            ) : pendingFollowUps.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No pending follow-ups. Record an Interested → Callback outcome on a call to schedule one.
              </p>
            ) : (
              <ul className="space-y-2">
                {pendingFollowUps.map((f) => {
                  const overdue = isOverdue(f.dueAt);
                  const dueToday = new Date(f.dueAt).toDateString() === new Date().toDateString();
                  return (
                    <li
                      key={f.id}
                      className={cx(
                        'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
                        overdue ? 'border-red-100 bg-red-50/60' : dueToday ? 'border-amber-100 bg-amber-50/60' : 'border-slate-100',
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CalendarClock className={cx('h-4 w-4 shrink-0', overdue ? 'text-red-500' : 'text-slate-400')} />
                          <p className="truncate text-sm font-medium text-slate-800">{f.customer?.fullName ?? 'Customer'}</p>
                          <Badge tone={overdue ? 'red' : dueToday ? 'amber' : 'slate'}>
                            {overdue ? 'overdue' : dueToday ? 'today' : formatDate(f.dueAt)}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate pl-6 text-xs text-slate-500">
                          {f.note}
                          {f.agent ? <span className="text-slate-400"> · scheduled by {f.agent.fullName}</span> : null}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => completeFollowUp.mutate(f.id)} disabled={completeFollowUp.isPending}>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Complete
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Recent activity */}
        <Card className="flex min-h-0 flex-col">
          <CardHeader title="Recent calls" action={<StickyNote className="h-4 w-4 text-slate-300" />} />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {s.recentActivity.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No calls yet today.</p>
            ) : (
              <ul className="space-y-2">
                {s.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {a.status === 'NOT_ANSWERED' ? (
                        <PhoneMissed className="h-4 w-4 shrink-0 text-slate-300" />
                      ) : a.outcome === 'INTERESTED' ? (
                        <UserCheck className="h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <PhoneCall className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{a.customerName ?? 'Unlinked number'}</p>
                        <p className="truncate text-xs text-slate-400">
                          {formatE164(a.phoneNumber)} · {formatDate(a.startedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {a.outcome ? <Badge tone={OUTCOME_LABEL[a.outcome]?.tone ?? 'slate'}>{OUTCOME_LABEL[a.outcome]?.label ?? a.outcome}</Badge> : null}
                      <CallStateChip status={a.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CallStateChip({ status }: { status: CallStatus }) {
  if (status === 'ENDED' || status === 'CONNECTED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (status === 'NOT_ANSWERED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <PhoneMissed className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
      <Users className="h-3.5 w-3.5" />
      {status.replace('_', ' ')}
    </span>
  );
}
