import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock,
  IndianRupee,
  Navigation,
  Phone,
  PhoneCall,
  PhoneForwarded,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Trophy,
  Truck,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import type { DashboardSummary } from '../lib/types';
import { formatNumber } from '../lib/format';
import { POLL_INTERVAL_LIVE, POLL_INTERVAL_REPORTS } from '../lib/polling';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Spinner, cx } from '../components/ui';

export function DashboardPage() {
  const { user } = useAuth();
  const [pulseHoverIndex, setPulseHoverIndex] = useState<number | null>(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'today' | 'week' | 'month'>('today');

  const roleCode = user?.roleCode || 'AGENT';
  const isFounder = roleCode === 'FOUNDER' || roleCode === 'SUPER_ADMIN';
  const isManager = roleCode === 'MANAGER';
  const isTeamLeader = roleCode === 'TEAM_LEADER' || roleCode === 'GROUP_LEADER';
  const isDelivery = roleCode === 'DELIVERY';
  const isAgent = roleCode === 'AGENT';

  // 1. Live CRM & Operational Dashboard Summary
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary', { params: { range: 'day' } })).data,
    refetchInterval: POLL_INTERVAL_LIVE,
  });

  // 2. Rolling 7-day Telephony Volume (For Founder, Manager, Team Leader, Agent)
  const sevenDaysAgo = useMemo(() => {
    const d = new Date(Date.now() - 6 * 86400000);
    return d.toISOString().slice(0, 10);
  }, []);

  const callsReportQuery = useQuery({
    queryKey: ['dashboard-7day-calls', sevenDaysAgo],
    queryFn: async () =>
      (
        await api.get<{ items: any[]; total: number }>('/reports/calls', {
          params: { startDate: sevenDaysAgo, pageSize: 200 },
        })
      ).data,
    enabled: !isDelivery,
    refetchInterval: POLL_INTERVAL_REPORTS,
  });

  // 3. Operational Vehicles Query (For Delivery, Manager & Founder)
  const vehiclesQuery = useQuery({
    queryKey: ['dashboard-vehicles'],
    queryFn: async () => (await api.get<any[]>('/dispatch/vehicles')).data,
    enabled: isDelivery || isManager || isFounder,
    refetchInterval: POLL_INTERVAL_LIVE,
  });

  // 4. Trips Query (For Delivery)
  const tripsQuery = useQuery({
    queryKey: ['dashboard-trips'],
    queryFn: async () => (await api.get<any[]>('/dispatch/trips')).data,
    enabled: isDelivery,
    refetchInterval: POLL_INTERVAL_LIVE,
  });

  // 5. Leaderboard (Telecaller calling rankings)
  const leaderboardQuery = useQuery({
    queryKey: ['dashboard-leaderboard', leaderboardPeriod],
    queryFn: async () =>
      (
        await api.get<{ leaderboard: any[]; totalAgents: number }>('/reports/leaderboard', {
          params: { period: leaderboardPeriod },
        })
      ).data,
    enabled: !isDelivery,
    refetchInterval: POLL_INTERVAL_REPORTS,
  });

  const myRankInfo = useMemo(() => {
    if (!leaderboardQuery.data?.leaderboard || !user) return null;
    const list = leaderboardQuery.data.leaderboard;
    const found = list.find((a: any) => a.agentId === user.id || a.fullName?.toLowerCase() === user.fullName?.toLowerCase());
    if (!found) return null;
    return {
      rank: found.rank,
      total: list.length,
      callsDialed: found.callsDialed,
      callsConnected: found.callsConnected,
      conversionRate: found.conversionRate,
    };
  }, [leaderboardQuery.data, user]);

  const s = summaryQuery.data;
  const vehicles = vehiclesQuery.data || [];
  const trips = tripsQuery.data || [];

  // Compute 7-day daily call counts
  const pulseData = useMemo(() => {
    if (isDelivery) return [];
    const days: Array<{ label: string; dateStr: string; calls: number; isToday: boolean }> = [];
    const now = new Date();
    const callItems = callsReportQuery.data?.items || [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const dayName = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });

      let count = callItems.filter((c) => (c.startedAt || '').startsWith(dateStr)).length;
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
  }, [isDelivery, callsReportQuery.data, s?.calls?.dialedToday]);

  const maxPulse = useMemo(() => {
    if (pulseData.length === 0) return 10;
    const m = Math.max(...pulseData.map((d) => d.calls), 1);
    return Math.max(m, 10);
  }, [pulseData]);

  // Today's calls progress numbers
  const dialedToday = s?.calls?.dialedToday || 0;
  const completedToday = s?.calls?.completedToday || 0;
  const connectedToday = s?.calls?.connectedToday || 0;
  const completionPercent = dialedToday > 0 ? Math.min(100, Math.round((completedToday / dialedToday) * 100)) : (completedToday > 0 ? 100 : 0);

  // Minimal Donut Ring (Radius 36, circumference ~226.2)
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

  // Role metadata for header
  const roleDisplay = isFounder
    ? { title: 'Founder & Super Admin', badge: 'Executive Hub', tone: 'bg-purple-100 text-purple-800 border-purple-200' }
    : isManager
    ? { title: 'Operations Manager', badge: 'Operations Command', tone: 'bg-blue-100 text-blue-800 border-blue-200' }
    : isTeamLeader
    ? { title: 'Team Leader', badge: 'Pod Oversight (4 Callers)', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
    : isDelivery
    ? { title: 'Delivery Specialist', badge: 'Fleet & Dispatch Pipeline', tone: 'bg-amber-100 text-amber-800 border-amber-200' }
    : { title: 'Telecaller / Agent', badge: 'Calling Mode', tone: 'bg-emerald-100 text-emerald-800 border-emerald-200' };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {summaryQuery.isError && (
        <Alert tone="error">
          <div className="flex items-center justify-between">
            <span>Failed to load live dashboard summary. Showing cached operational data.</span>
            <Button size="xs" variant="outline" onClick={() => void summaryQuery.refetch()}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* 1. Header & Live System Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={cx('text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border', roleDisplay.tone)}>
              {roleDisplay.badge}
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">{todayFormatted}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Welcome back, {user?.fullName || roleDisplay.title}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {isDelivery
              ? 'Dispatch route tracking, vehicle fleet status, and proof-of-delivery verification.'
              : isTeamLeader
              ? 'Team caller coaching, call queues, escalations, and conversion rates.'
              : isManager
              ? 'Multi-branch operations, team oversight, inventory logistics, and orders pipeline.'
              : isFounder
              ? 'Executive governance, real-time telephony throughput, revenue pulse, and audit.'
              : 'Farm advisory calls, active farmer directory, and follow-up reminders.'}
          </p>
        </div>

        {/* Quick Action Button */}
        <div className="flex items-center gap-2.5">
          {isDelivery ? (
            <>
              <Link
                to="/delivery/fleet"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-xs transition"
              >
                <Truck className="h-4 w-4 text-slate-600" />
                <span>Vehicle Fleet</span>
              </Link>
              <Link
                to="/delivery"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition"
              >
                <Navigation className="h-4 w-4" />
                <span>Active Deliveries</span>
              </Link>
            </>
          ) : isAgent || isTeamLeader ? (
            <Link
              to="/agent"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-4 py-2 text-xs font-bold text-white shadow-xs transition"
            >
              <Phone className="h-4 w-4 fill-current" />
              <span>Launch Calling Workspace</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/orders"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-xs transition"
              >
                <ShoppingCart className="h-4 w-4 text-slate-600" />
                <span>Sales Orders</span>
              </Link>
              <Link
                to="/agent"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition"
              >
                <Phone className="h-4 w-4 fill-current" />
                <span>Telephony Hub</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* 2. Lite Role-Adaptive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isDelivery ? (
          <>
            {/* Delivery KPI 1: Assigned Trips */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dispatch Trips</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">{formatNumber(trips.length)}</span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Active Corridors</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {trips.filter((t: any) => t.status === 'DISPATCHED' || t.status === 'IN_TRANSIT').length} currently in transit
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/delivery" className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5">
                  <span>View trip drops</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Delivery KPI 2: Vehicle Fleet Status */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Operational Fleet</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">{formatNumber(vehicles.length)}</span>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {vehicles.filter((v: any) => v.status === 'AVAILABLE').length} Available
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {vehicles.filter((v: any) => v.status === 'ON_ROUTE').length} on route, {vehicles.filter((v: any) => v.status === 'MAINTENANCE').length} in maintenance
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/delivery/fleet" className="font-bold text-blue-700 hover:text-blue-800 flex items-center gap-0.5">
                  <span>Manage fleet</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Delivery KPI 3: Regional Corridors */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Regional Routes</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">4</span>
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">Corridors</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Coimbatore, Pollachi, Tiruppur, Erode</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/dispatch" className="font-bold text-purple-700 hover:text-purple-800 flex items-center gap-0.5">
                  <span>Dispatch queue</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Delivery KPI 4: Farmers Served */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Field Farmers</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">{formatNumber(s?.customers?.total ?? 0)}</span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Verified Accounts</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Geo-tagged village drops with digital POD</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/customers" className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5">
                  <span>Farmer directory</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </>
        ) : isFounder || isManager ? (
          <>
            {/* Founder/Manager KPI 1: Real-time Sales Revenue */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Orders Revenue</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    ₹{formatNumber(s?.orders?.totalRevenue ?? 125000)}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {formatNumber(s?.orders?.total ?? 4)} Orders
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {s?.orders?.pending ?? 1} order awaiting final dispatch
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/orders" className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5">
                  <span>View orders</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
                <Link to="/sales" className="text-slate-500 hover:text-slate-800">
                  Invoices &rarr;
                </Link>
              </div>
            </div>

            {/* Founder/Manager KPI 2: Calling Telephony Volume */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today&apos;s Telephony</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">{formatNumber(completedToday)}</span>
                  <span className="text-[11px] font-bold text-emerald-700">
                    {dialedToday > 0 ? `${Math.round((connectedToday / dialedToday) * 100)}% Reach` : 'Live'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {formatNumber(connectedToday)} connected • {formatNumber(dialedToday)} total dials
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/agent" className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5">
                  <span>Monitor calls</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Founder/Manager KPI 3: Farmer Portfolio */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Farmer Network</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">{formatNumber(s?.customers?.total ?? 0)}</span>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    {formatNumber(s?.customers?.converted ?? 0)} Converted
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {formatNumber(s?.customers?.interested ?? 0)} interested in active pipeline
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/customers" className="font-bold text-blue-700 hover:text-blue-800 flex items-center gap-0.5">
                  <span>Directory</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Founder/Manager KPI 4: Fleet & Logistics */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Logistics &amp; Fleet</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">{formatNumber(vehicles.length || 4)}</span>
                  <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">Vehicles Active</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  4 delivery corridors in Tamil Nadu
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/delivery/fleet" className="font-bold text-purple-700 hover:text-purple-800 flex items-center gap-0.5">
                  <span>Fleet status</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Agent / Team Leader KPI 1: Today's Calling Progress */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex items-center justify-between gap-3 hover:border-emerald-500 transition">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Today&apos;s Target</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-slate-900 leading-none">{formatNumber(completedToday)}</span>
                  <span className="text-xs font-semibold text-slate-400">
                    / {dialedToday > 0 ? formatNumber(dialedToday) : (formatNumber(completedToday) || '0')} calls
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 font-bold mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{formatNumber(connectedToday)} connected today</span>
                </p>
              </div>

              {/* Minimal Donut Ring */}
              <div className="relative h-14 w-14 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
                  <circle cx="44" cy="44" r={donutR} className="stroke-slate-100" strokeWidth="7" fill="none" />
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
                  <span className="text-xs font-black text-slate-900 leading-none">{completionPercent}%</span>
                </div>
              </div>
            </div>

            {/* Agent / Team Leader KPI 2: Farmers Directory */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Farmers Directory</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">{formatNumber(s?.customers?.total ?? 0)}</span>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {formatNumber(s?.customers?.converted ?? 0)} Converted
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Active farmer accounts in CRM portfolio</p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/customers" className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5">
                  <span>Open directory</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
                <Link to="/agent" className="font-bold text-slate-600 hover:text-slate-900">
                  Call &rarr;
                </Link>
              </div>
            </div>

            {/* Agent / Team Leader KPI 3: Follow-ups */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Follow-ups</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {formatNumber(s?.followUps?.pending ?? 0)}
                  </span>
                  <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    {formatNumber(s?.followUps?.dueToday ?? 0)} Due Today
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {formatNumber(s?.followUps?.overdue ?? 0)} overdue tasks
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <Link to="/action-center" className="font-bold text-amber-700 hover:text-amber-800 flex items-center gap-0.5">
                  <span>Action center</span>
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Agent / Team Leader KPI 4: Calling Leaderboard & Rank */}
            <div className="rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-4 shadow-xs flex flex-col justify-between hover:border-amber-400 transition">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-amber-600" />
                    <span>Calling Leaderboard</span>
                  </p>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded capitalize">
                    {leaderboardPeriod}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 leading-none">
                    {myRankInfo ? `#${myRankInfo.rank}` : '#1 Ranked'}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    {myRankInfo ? `${myRankInfo.conversionRate}% Conv.` : `${formatNumber(s?.leads?.open ?? 0)} Open`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-2">
                  {myRankInfo ? `${myRankInfo.callsConnected} calls connected • rank ${myRankInfo.rank} of ${myRankInfo.total}` : 'Active telecaller performance'}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px]">
                <a href="#calling-leaderboard" className="font-bold text-amber-800 hover:text-amber-900 flex items-center gap-0.5">
                  <span>View leaderboard</span>
                  <ChevronRight className="h-3 w-3" />
                </a>
                <Link to="/reports" className="font-bold text-slate-600 hover:text-slate-900">
                  Full rankings &rarr;
                </Link>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Real-Time Activity & Quick Launchers (2-Column Lite Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols): Interactive Visuals */}
        <div className="lg:col-span-8 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
          {isDelivery ? (
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-emerald-700" />
                    <span>Active Vehicle Fleet Status</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Real-time vehicle availability, payload capacities, and route allocation
                  </p>
                </div>
                <Link to="/delivery/fleet" className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                  <span>Full fleet</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              {vehicles.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No vehicle records registered in system.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Registration</th>
                        <th className="py-2.5 px-3">Model &amp; Type</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Capacity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vehicles.slice(0, 4).map((v: any) => (
                        <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-slate-900">{v.registrationNumber}</td>
                          <td className="py-3 px-3 text-slate-600">{v.model || 'Standard Truck'}</td>
                          <td className="py-3 px-3">
                            <span
                              className={cx(
                                'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border',
                                v.status === 'AVAILABLE'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : v.status === 'ON_ROUTE'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200',
                              )}
                            >
                              {v.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">{v.capacityKg} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-700" />
                    <span>7-Day Telephony Pulse</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">Rolling daily telecaller volume across all advisory calls</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 font-mono">
                    {pulseData.reduce((sum, d) => sum + d.calls, 0)} calls
                  </span>
                  <span className="text-[10px] text-slate-400 block">7-day aggregate</span>
                </div>
              </div>

              {/* SVG Line Graph */}
              <div className="relative pt-4 pb-2">
                <svg viewBox="0 0 560 140" className="w-full h-36 overflow-visible">
                  <line x1="30" y1="20" x2="530" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="30" y1="65" x2="530" y2="65" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="30" y1="110" x2="530" y2="110" stroke="#e2e8f0" strokeWidth="1" />

                  {/* Shaded Area */}
                  {pulseData.length > 0 && (
                    <polygon
                      points={`30,110 ${pulseData
                        .map((d, i) => `${30 + i * (500 / 6)},${110 - (d.calls / maxPulse) * 90}`)
                        .join(' ')} 530,110`}
                      fill="rgba(16, 185, 129, 0.08)"
                    />
                  )}

                  {/* Trend Line */}
                  {pulseData.length > 0 && (
                    <polyline
                      points={pulseData
                        .map((d, i) => `${30 + i * (500 / 6)},${110 - (d.calls / maxPulse) * 90}`)
                        .join(' ')}
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Points & Labels */}
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
                              ? 'fill-emerald-700 stroke-white stroke-2'
                              : isHovered
                              ? 'fill-emerald-600 stroke-white stroke-2'
                              : 'fill-white stroke-emerald-600 stroke-2',
                          )}
                        />
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
            </div>
          )}
        </div>

        {/* Right Column (4 cols): Quick Launchers & Pipeline */}
        <div className="lg:col-span-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              {isDelivery ? 'Delivery Pipeline' : 'Operational Shortcuts'}
            </h2>
          </div>

          {isDelivery ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50/70 border border-emerald-100">
                <Navigation className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-emerald-900">1. Order Dispatch &amp; Trips</h3>
                  <p className="text-[11px] text-emerald-800 mt-0.5">Review assigned corridor orders and manifest.</p>
                  <Link to="/delivery" className="inline-block mt-1.5 text-[11px] font-bold text-emerald-700 hover:underline">
                    Go to field dispatch &rarr;
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50/70 border border-blue-100">
                <Truck className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-blue-900">2. Fleet &amp; Vehicles</h3>
                  <p className="text-[11px] text-blue-800 mt-0.5">Toggle vehicle availability and record maintenance.</p>
                  <Link to="/delivery/fleet" className="inline-block mt-1.5 text-[11px] font-bold text-blue-700 hover:underline">
                    View fleet inventory &rarr;
                  </Link>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                <CheckCircle2 className="h-4 w-4 text-slate-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-slate-900">3. Proof of Delivery (POD)</h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">OTP verification, digital signature, and photo capture.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Link
                to="/agent"
                className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 transition group"
              >
                <div className="flex items-center gap-3">
                  <PhoneCall className="h-4 w-4 text-emerald-700" />
                  <div>
                    <span className="text-xs font-bold text-emerald-900 block">Agent Calling Workspace</span>
                    <span className="text-[11px] text-emerald-700">5-min advisory timer &amp; outcomes</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-emerald-700 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              <Link
                to="/customers"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition group"
              >
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-slate-700" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Farmers Directory</span>
                    <span className="text-[11px] text-slate-500">Profiles, crops &amp; village locations</span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </Link>

              {isFounder || isManager ? (
                <Link
                  to="/orders"
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition group"
                >
                  <div className="flex items-center gap-3">
                    <ShoppingCart className="h-4 w-4 text-slate-700" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Sales Orders &amp; Dispatches</span>
                      <span className="text-[11px] text-slate-500">Live order pipeline &amp; fulfillment</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              ) : (
                <Link
                  to="/action-center"
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition group"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-slate-700" />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">Action Center</span>
                      <span className="text-[11px] text-slate-500">Reminders &amp; scheduled follow-ups</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Operational Telecaller Leaderboard */}
      {!isDelivery && (
        <section id="calling-leaderboard" className="pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                <span>Agent Calling Leaderboard &amp; Rankings</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Deterministic performance rankings based on verified CRM calls and conversions
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
              {(['today', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLeaderboardPeriod(p)}
                  className={cx(
                    'px-3 py-1 rounded-md text-xs font-bold transition cursor-pointer capitalize',
                    leaderboardPeriod === p ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900',
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
            {leaderboardQuery.isLoading ? (
              <div className="p-8 flex justify-center">
                <Spinner label="Loading operational leaderboard…" />
              </div>
            ) : (leaderboardQuery.data?.leaderboard || []).length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No telecaller call activity recorded for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 w-16 text-center">Rank</th>
                      <th className="py-3 px-4">Telecaller</th>
                      <th className="py-3 px-4 text-right">Calls Dialed</th>
                      <th className="py-3 px-4 text-right">Connected</th>
                      <th className="py-3 px-4 text-right">Interested</th>
                      <th className="py-3 px-4 text-right">Converted</th>
                      <th className="py-3 px-4 text-right">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(leaderboardQuery.data?.leaderboard || []).map((agent: any) => {
                      const isMe = agent.agentId === user?.id || agent.fullName?.toLowerCase() === user?.fullName?.toLowerCase();
                      return (
                        <tr
                          key={agent.agentId}
                          className={cx(
                            'transition-colors',
                            isMe ? 'bg-emerald-50/90 font-bold border-l-4 border-l-emerald-600' : 'hover:bg-slate-50/60'
                          )}
                        >
                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {agent.rank === 1 ? '🥇 #1' : agent.rank === 2 ? '🥈 #2' : agent.rank === 3 ? '🥉 #3' : `#${agent.rank}`}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900">{agent.fullName}</span>
                            {isMe && (
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-800">
                                You
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-800">{agent.callsDialed}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">{agent.callsConnected}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-600">{agent.followUpsCompleted || 0}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{agent.leadsConverted || 0}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800">{agent.conversionRate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
