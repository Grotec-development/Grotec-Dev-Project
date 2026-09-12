import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Phone,
  Clock,
  Users,
  Contact,
  TrendingUp,
  ArrowUpRight,
  PhoneCall,
  PhoneForwarded,
  Trophy,
  Award,
  Sparkles,
  BarChart2,
  Calendar,
  Layers,
  Activity,
  UserCheck,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { DashboardSummary, FollowUp } from '../lib/types';
import { formatDate, formatE164 } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Spinner, StatusBadge, cx } from '../components/ui';

export function DashboardPage() {
  const { user, hasPermission } = useAuth();

  if (user?.roleCode === 'DELIVERY') {
    return <Navigate to="/hrms/attendance" replace />;
  }
  if (user?.roleCode === 'STAFF') {
    return <Navigate to="/hrms/employees" replace />;
  }

  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [pulseHoverIndex, setPulseHoverIndex] = useState<number | null>(null);

  // 1. Dashboard summary (real CRM counts)
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary', { params: { range: 'day' } })).data,
  });

  // 2. 7-Day call report (real historical calls)
  const sevenDaysAgo = useMemo(() => {
    const d = new Date(Date.now() - 6 * 86400000);
    return d.toISOString().slice(0, 10);
  }, []);

  const callsReportQuery = useQuery({
    queryKey: ['dashboard-7day-calls', sevenDaysAgo],
    queryFn: async () => (await api.get<{ items: any[]; total: number }>('/reports/calls', {
      params: { startDate: sevenDaysAgo, pageSize: 200 },
    })).data,
  });

  // 3. Leaderboard query (real operational telecaller metrics)
  const leaderboardQuery = useQuery({
    queryKey: ['dashboard-leaderboard', leaderboardPeriod],
    queryFn: async () => (await api.get<{ leaderboard: any[]; totalAgents: number; currentAgentRank: number | null }>('/reports/leaderboard', {
      params: { period: leaderboardPeriod },
    })).data,
  });

  const s = summaryQuery.data;

  // Compute 7-day daily call counts
  const pulseData = useMemo(() => {
    const days: Array<{ label: string; dateStr: string; calls: number; isToday: boolean }> = [];
    const now = new Date();
    const callItems = callsReportQuery.data?.items || [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });

      // Count calls started on this calendar day
      let count = callItems.filter((c) => (c.startedAt || '').startsWith(dateStr)).length;
      // Fallback: If current day, ensure s?.calls?.dialedToday is reflected
      if (i === 0 && s?.calls?.dialedToday) {
        count = Math.max(count, s.calls.dialedToday);
      }

      days.push({
        label: dayName,
        dateStr,
        calls: count,
        isToday: i === 0,
      });
    }
    return days;
  }, [callsReportQuery.data, s?.calls?.dialedToday]);

  const maxPulse = useMemo(() => {
    const m = Math.max(...pulseData.map((d) => d.calls), 1);
    return Math.max(m, 10); // Minimum scale height of 10 calls
  }, [pulseData]);

  // Today's calls progress numbers
  const dialedToday = s?.calls?.dialedToday || 0;
  const completedToday = s?.calls?.completedToday || 0;
  const connectedToday = s?.calls?.connectedToday || 0;
  const completionPercent = dialedToday > 0 ? Math.min(100, Math.round((completedToday / dialedToday) * 100)) : (completedToday > 0 ? 100 : 0);

  // SVG Donut calculation for Today's progress (Radius 36, circumference ~226.2)
  const donutR = 36;
  const donutC = 2 * Math.PI * donutR;
  const donutOffset = donutC - (completionPercent / 100) * donutC;

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {summaryQuery.isError ? (
        <Alert tone="error">
          <div className="flex items-center justify-between">
            <span>Failed to load live dashboard summary. Showing cached operational data.</span>
            <Button size="xs" variant="outline" onClick={() => void summaryQuery.refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      ) : null}

      {/* ============================================================
          LAYER 1: FIRST VIEW (ABOVE THE FOLD)
          - Greeting, context, today's status
          - Primary KPI Row (Today's Target, Existing Customers, Prospects, New Leads)
          - 7-Day Call Pulse Trend Graph
         ============================================================ */}

      {/* Top Greeting Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {user?.roleCode === 'FOUNDER' ? 'Founder Workspace' : user?.roleCode === 'MANAGER' ? 'Operations Manager' : 'Agent Mode'}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">{todayFormatted}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Welcome back, {user?.fullName || 'Telecaller'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time farm advisory calls, farmer portfolio updates, and team productivity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-emerald-50/70 border border-emerald-200/80 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Telephony System Ready</span>
          </div>
          <Link
            to="/agent"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition"
          >
            <Phone className="h-3.5 w-3.5 fill-current" />
            <span>Open Agent Mode</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Today's Calls Progress (with Minimal Donut Chart) */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-500 transition">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Today&apos;s Progress
            </p>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {completedToday}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                / {dialedToday > 0 ? dialedToday : (completedToday || '0')} calls
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 font-bold mt-2 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>{connectedToday} connected today</span>
            </p>
          </div>

          {/* Minimal Donut Ring */}
          <div className="relative h-16 w-16 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
              <circle
                cx="44"
                cy="44"
                r={donutR}
                className="stroke-slate-100"
                strokeWidth="7"
                fill="none"
              />
              <circle
                cx="44"
                cy="44"
                r={donutR}
                className="stroke-emerald-600 transition-all duration-700 ease-out"
                strokeWidth="7"
                strokeDasharray={donutC}
                strokeDashoffset={donutOffset}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs font-black text-slate-900 leading-none">
                {completionPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* KPI 2: Existing Customers */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-emerald-500 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Existing Customers
              </p>
              <Users className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {(s?.customers?.total ?? 0).toLocaleString()}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700">
                Active Directory
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                style={{ width: s?.customers?.total ? '100%' : '15%' }}
              />
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
            <Link
              to="/customers"
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
            >
              <span>View directory</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
            <Link
              to="/agent"
              className="text-[11px] font-bold text-slate-600 hover:text-slate-900"
            >
              Call now &rarr;
            </Link>
          </div>
        </div>

        {/* KPI 3: Prospects / Open Pipeline */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-emerald-500 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Prospects &amp; Leads
              </p>
              <Contact className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {s?.leads?.open ?? 0}
              </span>
              <span className="text-[11px] font-semibold text-blue-600">
                Open Pipeline
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: s?.leads?.open ? '72%' : '20%' }}
              />
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Closed: {s?.leads?.closedTotal ?? 0}</span>
            <Link
              to="/leads"
              className="font-bold text-blue-700 hover:text-blue-800 flex items-center gap-0.5"
            >
              <span>View pipeline</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* KPI 4: New Leads (This Week) */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs hover:border-emerald-500 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                New Leads (This Week)
              </p>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {s?.leads?.newThisWeek ?? 0}
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                Recent Ingestion
              </span>
            </div>
            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: s?.leads?.newThisWeek ? '85%' : '25%' }}
              />
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Pending follow-ups: {s?.followUps?.pending ?? 0}</span>
            <Link
              to="/leads"
              className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
            >
              <span>Open leads</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* 7-Day Call Pulse Trend Graph & Quick Queue Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: 7-Day Call Pulse (~65% width) */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-700" />
                <span>7-Day Call Pulse</span>
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Daily telecaller volume across the rolling 7-day period
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-900">
                {pulseData.reduce((sum, d) => sum + d.calls, 0)} calls
              </span>
              <span className="text-[10px] text-slate-400 block">7-day aggregate</span>
            </div>
          </div>

          {/* SVG Line Graph */}
          <div className="relative pt-4 pb-2">
            <svg viewBox="0 0 560 140" className="w-full h-40 overflow-visible">
              <defs>
                <linearGradient id="pulseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                const y = 110 - ratio * 90;
                return (
                  <line
                    key={idx}
                    x1="30"
                    y1={y}
                    x2="530"
                    y2={y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                );
              })}

              {/* Area fill */}
              <polygon
                points={`30,110 ${pulseData
                  .map((d, i) => {
                    const x = 30 + i * (500 / 6);
                    const y = 110 - (d.calls / maxPulse) * 90;
                    return `${x},${y}`;
                  })
                  .join(' ')} 530,110`}
                fill="url(#pulseGradient)"
              />

              {/* Trend line */}
              <polyline
                points={pulseData
                  .map((d, i) => {
                    const x = 30 + i * (500 / 6);
                    const y = 110 - (d.calls / maxPulse) * 90;
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Points & Interactive Nodes */}
              {pulseData.map((d, i) => {
                const x = 30 + i * (500 / 6);
                const y = 110 - (d.calls / maxPulse) * 90;
                const isHovered = pulseHoverIndex === i;

                return (
                  <g
                    key={d.dateStr}
                    onMouseEnter={() => setPulseHoverIndex(i)}
                    onMouseLeave={() => setPulseHoverIndex(null)}
                    className="cursor-pointer"
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? '6' : d.isToday ? '5' : '3.5'}
                      className={cx(
                        'transition-all duration-150',
                        d.isToday
                          ? 'fill-emerald-700 stroke-white stroke-2 drop-shadow-xs'
                          : isHovered
                          ? 'fill-emerald-600 stroke-white stroke-2'
                          : 'fill-white stroke-emerald-600 stroke-2',
                      )}
                    />
                    {/* Value Badge above node */}
                    <text
                      x={x}
                      y={y - 8}
                      textAnchor="middle"
                      className={cx(
                        'text-[10px] font-bold font-mono transition-opacity',
                        d.isToday || isHovered ? 'fill-slate-900 opacity-100' : 'fill-slate-400 opacity-70',
                      )}
                    >
                      {d.calls}
                    </text>
                    {/* X-axis Label */}
                    <text
                      x={x}
                      y="130"
                      textAnchor="middle"
                      className={cx(
                        'text-[10px] transition-colors',
                        d.isToday ? 'fill-emerald-800 font-bold' : 'fill-slate-400 font-medium',
                      )}
                    >
                      {d.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Graph footer */}
          <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-600 inline-block" />
              <span className="font-semibold text-slate-700">Calls Dialed</span>
            </div>
            <span className="text-[11px] text-slate-400">
              Updated live from CRM telephony records
            </span>
          </div>
        </div>

        {/* Right: Up Next Call Queue Preview (~35% width) */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Up Next in Queue
                </h2>
              </div>
              <Link
                to="/agent"
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
              >
                Full Queue &rarr;
              </Link>
            </div>

            <p className="text-xs text-slate-500">Open the calling workspace to view your assigned queue.</p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <Link
              to="/agent"
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-700 transition"
            >
              <span>Launch Calling Session</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ============================================================
          LAYER 2: SCROLL DOWN — PERFORMANCE OVERVIEW
          - Completed, Connected, Interested, Converted
          - Sales Generated (Safe empty state / unavailable indicator)
         ============================================================ */}
      <section className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-emerald-700" />
              <span>Performance Overview</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cumulative conversion pipeline and disposition effectiveness
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            Telemetry: Real CRM Activity
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* Card 1: Calls Completed */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Calls Completed
            </p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {completedToday}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              {dialedToday} dialed today
            </p>
          </div>

          {/* Card 2: Connected */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Connected Conversations
            </p>
            <p className="text-2xl font-black text-emerald-700 mt-1">
              {connectedToday}
            </p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1">
              {dialedToday > 0 ? `${Math.round((connectedToday / dialedToday) * 100)}% reach rate` : 'Active session'}
            </p>
          </div>

          {/* Card 3: Interested */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Interested Farmers
            </p>
            <p className="text-2xl font-black text-blue-700 mt-1">
              {s?.customers?.interested ?? 0}
            </p>
            <p className="text-[10px] text-blue-600 font-semibold mt-1">
              Follow-up scheduled
            </p>
          </div>

          {/* Card 4: Converted */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Converted Farmers
            </p>
            <p className="text-2xl font-black text-emerald-800 mt-1">
              {s?.customers?.converted ?? 0}
            </p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1">
              Active Client Accounts
            </p>
          </div>

          {/* Card 5: Sales Generated (Strictly Real Data / Empty State) */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Sales Generated
            </p>
            <p className="text-2xl font-black text-slate-400 mt-1">
              —
            </p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Orders module pending
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          LAYER 3: SCROLL FURTHER — OPERATIONAL LEADERBOARD
          - Deterministic ranks, agent stats, real telecaller data
         ============================================================ */}
      <section className="pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span>Operational Leaderboard</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Telecaller calling volume, call connections, and customer conversion rankings
            </p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setLeaderboardPeriod(p)}
                className={cx(
                  'px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer capitalize',
                  leaderboardPeriod === p
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          {leaderboardQuery.isLoading ? (
            <div className="p-10 flex justify-center">
              <Spinner label="Loading operational leaderboard…" />
            </div>
          ) : (leaderboardQuery.data?.leaderboard || []).length === 0 ? (
            <div className="p-12 text-center">
              <Trophy className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No telecaller activity recorded for this period</p>
              <p className="text-xs text-slate-400 mt-1">
                Completed calls and conversions will populate rankings automatically.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-16 text-center">Rank</th>
                    <th className="py-3 px-4">Telecaller / Agent</th>
                    <th className="py-3 px-4 text-right">Calls Dialed</th>
                    <th className="py-3 px-4 text-right">Connected</th>
                    <th className="py-3 px-4 text-right">Interested / Follow-up</th>
                    <th className="py-3 px-4 text-right">Converted</th>
                    <th className="py-3 px-4 text-right">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(leaderboardQuery.data?.leaderboard || []).map((agent: any) => {
                    const isCurrent = agent.isCurrentAgent || agent.agentId === user?.id;

                    return (
                      <tr
                        key={agent.agentId}
                        className={cx(
                          'transition-colors',
                          isCurrent ? 'bg-emerald-50/60 font-semibold' : 'hover:bg-slate-50/60',
                        )}
                      >
                        <td className="py-3 px-4 text-center">
                          {agent.rank === 1 ? (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-800 font-black text-xs">
                              1
                            </span>
                          ) : agent.rank === 2 ? (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-slate-700 font-black text-xs">
                              2
                            </span>
                          ) : agent.rank === 3 ? (
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-50 text-amber-700 font-black text-xs">
                              3
                            </span>
                          ) : (
                            <span className="font-mono text-slate-500 font-bold">#{agent.rank}</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{agent.fullName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({agent.employeeCode})</span>
                            {isCurrent && (
                              <span className="rounded bg-emerald-600 text-white px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block">{agent.department}</span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                          {agent.callsDialed}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                          {agent.callsConnected}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {agent.followUpsCompleted || 0}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                          {agent.leadsConverted || 0}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">
                          {agent.conversionRate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
