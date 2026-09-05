import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  MapPin,
  PhoneCall,
  PhoneMissed,
  PieChart,
  Sprout,
  StickyNote,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { CallStatus, CallOutcome, DashboardRange, DashboardSummary, FollowUp, PipelineDrilldown, PipelineState } from '../lib/types';
import { formatDate, formatE164 } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, CardHeader, Spinner, cx } from '../components/ui';

const OUTCOME_LABEL: Record<CallOutcome, { label: string; tone: 'green' | 'red' | 'amber' }> = {
  INTERESTED: { label: 'Interested', tone: 'green' },
  NOT_INTERESTED: { label: 'Not interested', tone: 'red' },
  NOT_ANSWERED: { label: 'Not answered', tone: 'amber' },
};

const PIPELINE_META: Record<PipelineState, { label: string; color: string; soft: string; hint: string }> = {
  converted: { label: 'Converted', color: '#15803d', soft: 'bg-emerald-50 text-emerald-700', hint: 'With an RM owner' },
  open: { label: 'Open leads', color: '#2563eb', soft: 'bg-blue-50 text-blue-700', hint: 'Being worked by agents' },
  interested: { label: 'Interested', color: '#d97706', soft: 'bg-amber-50 text-amber-700', hint: 'Last outcome: interested' },
  not_interested: { label: 'Not interested', color: '#e11d48', soft: 'bg-rose-50 text-rose-700', hint: 'Last outcome: declined' },
  never_reached: { label: 'Not yet reached', color: '#94a3b8', soft: 'bg-slate-100 text-slate-600', hint: 'No outcome recorded yet' },
};

const RANGE_OPTIONS: Array<{ value: DashboardRange; label: string }> = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
];

const RANGE_LABEL: Record<DashboardRange, string> = { day: 'today', week: 'in the last 7 days', month: 'in the last 30 days' };

export function DashboardPage() {
  const { user } = useAuth();
  if (user?.roleCode === 'DELIVERY') {
    return <Navigate to="/hrms/attendance" replace />;
  }

  const queryClient = useQueryClient();
  const [range, setRange] = useState<DashboardRange>('day');
  const [selectedState, setSelectedState] = useState<PipelineState | null>(null);
  const [hoveredState, setHoveredState] = useState<PipelineState | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary', range],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary', { params: { range } })).data,
  });

  const drilldownQuery = useQuery({
    queryKey: ['dashboard-pipeline', selectedState],
    queryFn: async () => (await api.get<PipelineDrilldown>('/dashboard/pipeline', { params: { state: selectedState } })).data,
    enabled: selectedState !== null,
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
  const isOverdue = (dueAt: string) => new Date(dueAt).getTime() < Date.now();
  const pendingFollowUps = (followUpsQuery.data ?? []).filter((f) => f.status === 'PENDING').slice(0, 8);

  const stat = (label: string, value: number, icon: React.ReactNode, sub?: string) => (
    <Card className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub ? <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p> : <p className="mt-0.5 text-xs text-slate-200">&nbsp;</p>}
    </Card>
  );

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <LayoutDashboard className="h-6 w-6 text-brand-600" />
            {s.scope === 'me' ? `Welcome back, ${user?.fullName ?? ''}` : 'Team overview'}
          </h1>
          <p className="text-sm text-slate-500">
            {s.scope === 'me'
              ? 'Your workload and pipeline, computed from live CRM data.'
              : 'Every agent and relationship manager — computed from live CRM data.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setRange(opt.value);
                  setSelectedState(null);
                }}
                className={cx(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  range === opt.value ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Badge tone="slate">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stat('Dialed', s.calls.dialedToday, <PhoneCall className="h-4 w-4 text-slate-300" />, RANGE_LABEL[range])}
        {stat('Connected', s.calls.connectedToday, <UserCheck className="h-4 w-4 text-green-500" />, RANGE_LABEL[range])}
        {stat('Not answered', s.calls.notAnsweredToday, <PhoneMissed className="h-4 w-4 text-amber-500" />, RANGE_LABEL[range])}
        {stat('Pending follow-ups', s.followUps.pending, <CalendarClock className="h-4 w-4 text-slate-300" />, s.followUps.overdue > 0 ? `${s.followUps.overdue} overdue` : 'nothing overdue')}
        {stat('Open leads', s.leads.open, <Users className="h-4 w-4 text-blue-500" />, `${s.leads.newThisWeek} new this week`)}
        {stat('Converted', s.customers.converted, <Sprout className="h-4 w-4 text-emerald-500" />, `${s.customers.interested} interested all-time`)}
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_420px]">
        {/* Farmer pipeline — interactive donut + drill-down */}
        <Card className="flex min-h-0 flex-col">
          <CardHeader
            title={selectedState ? `${PIPELINE_META[selectedState].label} — farmers` : 'Farmer pipeline'}
            action={
              selectedState ? (
                <Button size="sm" variant="ghost" onClick={() => setSelectedState(null)}>
                  <X className="h-3.5 w-3.5" /> Back to overview
                </Button>
              ) : (
                <PieChart className="h-4 w-4 text-slate-300" />
              )
            }
          />
          {selectedState && drilldownQuery.data ? (
            <DrilldownList
              data={drilldownQuery.data}
              pending={drilldownQuery.isFetching}
              onClose={() => setSelectedState(null)}
            />
          ) : selectedState ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <Spinner label="Loading farmers…" />
            </div>
          ) : (
            <div className="grid min-h-[300px] gap-2 p-4 md:grid-cols-[minmax(0,240px)_1fr] md:gap-4">
              <PipelineDonut
                segments={s.pipeline}
                total={s.pipelineTotal}
                hovered={hoveredState}
                onHover={setHoveredState}
                onSelect={setSelectedState}
              />
              <div className="flex min-h-0 flex-col gap-1 overflow-y-auto">
                {s.pipeline.map((seg) => {
                  const meta = PIPELINE_META[seg.state];
                  const pct = s.pipelineTotal === 0 ? 0 : Math.round((seg.count / s.pipelineTotal) * 100);
                  const active = hoveredState === seg.state || selectedState === seg.state;
                  return (
                    <button
                      key={seg.state}
                      type="button"
                      onMouseEnter={() => setHoveredState(seg.state)}
                      onMouseLeave={() => setHoveredState(null)}
                      onClick={() => setSelectedState(seg.state)}
                      className={cx(
                        'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-all',
                        active ? 'border-slate-300 bg-slate-50 shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                      )}
                      title={`${meta.hint} — click to see these farmers`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">{meta.label}</span>
                          <span className="block truncate text-xs text-slate-400">{meta.hint}</span>
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={seg.count > 0 ? 'slate' : 'slate'}>{seg.count}</Badge>
                        <span className="w-10 text-right text-xs tabular-nums text-slate-400">{pct}%</span>
                        <ChevronRight className={cx('h-3.5 w-3.5 text-slate-300 transition-transform', active && 'translate-x-0.5 text-brand-600')} />
                      </span>
                    </button>
                  );
                })}
                {s.pipelineTotal === 0 ? (
                  <p className="px-3 pb-2 pt-4 text-center text-xs text-slate-400">
                    No farmers on record yet{range === 'day' ? ' — the pipeline is all-time, so this may be a fresh database' : ''}. Create a customer, then make a call to start the pipeline.
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </Card>

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
              <p className="py-8 text-center text-sm text-slate-400">No calls yet in this window.</p>
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

/** Interactive donut: hover arcs to highlight, click an arc to drill into that segment. */
function PipelineDonut({
  segments,
  total,
  hovered,
  onHover,
  onSelect,
}: {
  segments: DashboardSummary['pipeline'];
  total: number;
  hovered: PipelineState | null;
  onHover: (state: PipelineState | null) => void;
  onSelect: (state: PipelineState) => void;
}) {
  const size = 200;
  const center = size / 2;
  const radius = 76;
  const stroke = 26;
  const { arcs } = useMemo(() => {
    const arcs: Array<{ state: PipelineState; path: string }> = [];
    let angle = -Math.PI / 2; // start at 12 o'clock
    for (const seg of segments) {
      if (seg.count <= 0 || total <= 0) continue;
      const sweep = (seg.count / total) * Math.PI * 2;
      const large = sweep > Math.PI ? 1 : 0;
      const x1 = center + radius * Math.cos(angle);
      const y1 = center + radius * Math.sin(angle);
      const x2 = center + radius * Math.cos(angle + sweep);
      const y2 = center + radius * Math.sin(angle + sweep);
      arcs.push({
        state: seg.state,
        path: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      });
      angle += sweep;
    }
    return { arcs };
  }, [segments, total]);

  const active = (state: PipelineState) => hovered === state;

  return (
    <div className="flex flex-col items-center justify-center gap-3 self-center">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
          {/* background ring */}
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
          {arcs.map((arc) => {
            const meta = PIPELINE_META[arc.state];
            const isHovered = active(arc.state);
            return (
              <path
                key={arc.state}
                d={arc.path}
                fill="none"
                stroke={meta.color}
                strokeWidth={isHovered ? stroke + 6 : stroke}
                strokeLinecap="butt"
                className="cursor-pointer transition-[stroke-width,opacity] duration-150"
                opacity={hovered === null || isHovered ? 1 : 0.45}
                onMouseEnter={() => onHover(arc.state)}
                onMouseLeave={() => onHover(null)}
                onClick={() => onSelect(arc.state)}
              >
                <title>{`${meta.label}: ${segments.find((x) => x.state === arc.state)?.count ?? 0} farmers`}</title>
              </path>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold tabular-nums text-slate-900">{hovered ? segments.find((x) => x.state === hovered)?.count ?? total : total}</p>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            {hovered ? PIPELINE_META[hovered].label : 'farmers'}
          </p>
        </div>
      </div>
      <p className="text-center text-xs text-slate-400">
        Click a slice or a row to see those farmers · {total === 0 ? 'no data yet' : 'all-time pipeline, independent of the date window'}
      </p>
    </div>
  );
}

function DrilldownList({ data, pending, onClose }: { data: PipelineDrilldown; pending: boolean; onClose: () => void }) {
  const meta = PIPELINE_META[data.state];
  return (
    <div className="min-h-0 flex-1 px-4 pb-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <Badge tone="slate">{data.total} farmer{data.total === 1 ? '' : 's'}</Badge>
        <span className="text-slate-400">{meta.hint}</span>
        <span className={cx('ml-auto inline-flex items-center gap-1.5 text-slate-400', pending ? 'visible' : 'invisible')}>
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" /> refreshing…
        </span>
      </div>
      {data.items.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-slate-600">No farmers in this segment yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-slate-400">
            {data.state === 'converted' && 'Convert a Sales-interested farmer to hand them to a Relationship Manager.'}
            {data.state === 'open' && 'New leads appear here as agents pick them up from the calling queue.'}
            {data.state === 'interested' && 'Farmers whose last call ended Interested but who still need a Callback or Sales follow-through.'}
            {data.state === 'not_interested' && 'Farmers who declined on their last call — revisit later if campaigns change.'}
            {data.state === 'never_reached' && 'Farmers with no outcome yet — dial them from the agent workspace.'}
          </p>
        </div>
      ) : (
        <ul className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
          {data.items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/customers/${item.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{item.fullName}</p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-400">
                    {item.farmerCode ? <span className="font-mono">{item.farmerCode}</span> : null}
                    {item.primaryPhone ? <span>{formatE164(item.primaryPhone)}</span> : null}
                    {item.location ? (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {item.location.village ?? item.location.taluk ?? item.location.district ?? 'Location on file'}
                      </span>
                    ) : null}
                  </p>
                </div>
                {item.crops.length > 0 ? (
                  <span className="hidden shrink-0 flex-wrap justify-end gap-1 sm:flex">
                    {item.crops.slice(0, 2).map((c) => (
                      <span key={c.name} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {c.name}
                        {c.acreage > 0 ? ` · ${c.acreage}${c.unit === 'HECTARE' ? ' ha' : ' ac'}` : ''}
                      </span>
                    ))}
                    {item.crops.length > 2 ? <span className="text-[11px] text-slate-400">+{item.crops.length - 2}</span> : null}
                  </span>
                ) : null}
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Button size="sm" variant="outline" onClick={onClose}>
          <X className="h-3.5 w-3.5" /> Back to pipeline overview
        </Button>
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
