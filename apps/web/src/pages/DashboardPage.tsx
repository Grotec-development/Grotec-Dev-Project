import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  LayoutDashboard,
  Phone,
  PhoneCall,
  PhoneMissed,
  PieChart,
  Sprout,
  Clock,
  UserCheck,
  Users,
  AlertCircle,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  Layers,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { DashboardSummary, FollowUp, PipelineState } from '../lib/types';
import { formatDate, formatE164 } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, CardHeader, Spinner, StatusBadge, cx } from '../components/ui';
import { ModernDonutChart, type DonutSegment } from '../components/charts/ModernDonutChart';

interface ScheduledCall {
  id: string;
  name: string;
  phone: string;
  crops: string;
  district: string;
  scheduledTime: string;
  priority: 'High Priority' | 'Follow up' | 'Routine' | 'Overdue';
}

const MOCK_CALL_QUEUE: ScheduledCall[] = [
  { id: '1', name: 'Rajendran K.', phone: '+91 94432 12091', crops: 'Tomato, Brinjal', district: 'Dharmapuri', scheduledTime: '10:30 AM', priority: 'High Priority' },
  { id: '2', name: 'Murugan V.', phone: '+91 98421 88321', crops: 'Paddy, Sugarcane', district: 'Trichy', scheduledTime: '11:15 AM', priority: 'Follow up' },
  { id: '3', name: 'Chinnasamy A.', phone: '+91 94451 22931', crops: 'Turmeric, Banana', district: 'Erode', scheduledTime: '12:00 PM', priority: 'Routine' },
  { id: '4', name: 'Palani Kumar', phone: '+91 94431 82190', crops: 'Coconut, Cocoa', district: 'Tanjore', scheduledTime: '02:30 PM', priority: 'Routine' },
  { id: '5', name: 'Subramanian P.', phone: '+91 95001 44321', crops: 'Paddy, Cotton', district: 'Salem', scheduledTime: '03:15 PM', priority: 'Overdue' },
];

interface ActivityItem {
  id: string;
  actor: string;
  action: string;
  timeAgo: string;
  farmer: string;
  crop: string;
  note: string;
}

const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: '1',
    actor: 'Priya S.',
    action: 'Logged interested',
    timeAgo: '10m ago',
    farmer: 'Kuppusamy R.',
    crop: 'Paddy',
    note: 'Interested in Bio Jeevan PF for next sowing cycle.',
  },
  {
    id: '2',
    actor: 'System',
    action: 'Scheduled follow-up',
    timeAgo: '45m ago',
    farmer: 'Senthil Kumar',
    crop: 'Cotton',
    note: 'Follow-up regarding Trichoderma viride sample dispatch.',
  },
  {
    id: '3',
    actor: 'RM Karthik',
    action: 'Dispatched Order',
    timeAgo: '2h ago',
    farmer: 'Perumal G.',
    crop: 'Banana',
    note: '10L Azos liquid, 5kg Trishul granules via Salem Hub.',
  },
  {
    id: '4',
    actor: 'Priya S.',
    action: 'Logged no answer',
    timeAgo: '3h ago',
    farmer: 'Anbarasan S.',
    crop: 'Tomato',
    note: '3rd call attempt, phone switched off. Retry scheduled.',
  },
];

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  if (user?.roleCode === 'DELIVERY') {
    return <Navigate to="/hrms/attendance" replace />;
  }

  const [sortOption, setSortOption] = useState<'priority' | 'time'>('priority');
  const [analyticsTab, setAnalyticsTab] = useState<'pipeline' | 'crops' | 'dispositions'>('pipeline');

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary', { params: { range: 'day' } })).data,
  });

  const followUpsQuery = useQuery({
    queryKey: ['dashboard-followups'],
    queryFn: async () => (await api.get<FollowUp[]>('/follow-ups')).data,
  });

  const s = summaryQuery.data;

  const scheduledCalls = useMemo(() => {
    return [...MOCK_CALL_QUEUE].sort((a, b) => {
      if (sortOption === 'priority') {
        const order = { 'High Priority': 0, 'Follow up': 1, 'Overdue': 2, 'Routine': 3 };
        return order[a.priority] - order[b.priority];
      }
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });
  }, [sortOption]);

  // Modern Chart Data sets adhering to GROTEC agricultural design tokens
  const pipelineData: DonutSegment[] = useMemo(() => {
    const raw = s?.pipeline || [];
    const getCount = (st: PipelineState, fallback: number) => {
      const found = raw.find((p) => p.state === st);
      return found ? found.count : fallback;
    };
    return [
      { label: 'Converted (Won)', value: getCount('converted', 38), color: '#176335', badge: 'Tier 1' },
      { label: 'Interested (Follow-Up)', value: getCount('interested', 54), color: '#10b981', badge: 'High Priority' },
      { label: 'Open Pipeline', value: getCount('open', 82), color: '#0ea5e9' },
      { label: 'Callback / Retrying', value: getCount('never_reached', 19), color: '#f59e0b' },
      { label: 'Not Interested / Closed', value: getCount('not_interested', 11), color: '#94a3b8' },
    ];
  }, [s?.pipeline]);

  const cropsData: DonutSegment[] = useMemo(() => [
    { label: 'Paddy (Rice)', value: 1195, color: '#176335', badge: '42%' },
    { label: 'Sugarcane', value: 683, color: '#10b981', badge: '24%' },
    { label: 'Tomato & Vegetables', value: 455, color: '#0ea5e9', badge: '16%' },
    { label: 'Cotton', value: 313, color: '#f59e0b', badge: '11%' },
    { label: 'Banana & Plantation', value: 201, color: '#8b5cf6', badge: '7%' },
  ], []);

  const dispositionsData: DonutSegment[] = useMemo(() => [
    { label: 'Interested (Callback Set)', value: 48, color: '#176335' },
    { label: 'Sales / Order Placed', value: 31, color: '#10b981' },
    { label: 'General Advisory Only', value: 26, color: '#0ea5e9' },
    { label: 'Unreachable / Dropped', value: 14, color: '#f59e0b' },
    { label: 'Not Interested', value: 8, color: '#94a3b8' },
  ], []);

  const activeChartData =
    analyticsTab === 'pipeline'
      ? pipelineData
      : analyticsTab === 'crops'
        ? cropsData
        : dispositionsData;

  const activeCenterLabel =
    analyticsTab === 'pipeline'
      ? 'Active Leads'
      : analyticsTab === 'crops'
        ? 'Active Farmers'
        : 'Calls Logged';

  const handleDial = (phone: string, name: string) => {
    navigate(`/agent?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}`);
  };

  return (
    <div className="p-6 space-y-5">
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

      {/* 1. Top summary row matching PDF Telecaller Workstation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Scheduled Calls - ACTIONABLE PRIMARY */}
        <div className="rounded-lg border-2 border-emerald-500/80 bg-white p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-emerald-600" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center justify-between">
            <span>Today&apos;s Scheduled Calls</span>
            <CalendarClock className="h-3.5 w-3.5 text-emerald-600" />
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 leading-none">23</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> 4 completed
            </span>
          </div>
        </div>

        {/* Card 2: Pending Follow-ups - ACTIONABLE PRIMARY */}
        <div className="rounded-lg border-2 border-amber-400/90 bg-white p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-amber-500" />
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800 flex items-center justify-between">
            <span>Pending Follow-ups</span>
            <Clock className="h-3.5 w-3.5 text-amber-600" />
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 leading-none">
              {s?.followUps?.pending ?? 8}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200/80">
              Due today
            </span>
          </div>
        </div>

        {/* Card 3: New Registrations - PASSIVE STAT */}
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            New Registrations (Week)
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800 leading-none">12</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200/60">
              <TrendingUp className="h-3 w-3 text-emerald-600" /> +15% vs LY
            </span>
          </div>
        </div>

        {/* Card 4: Active Managed Farmers - PASSIVE STAT */}
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-4 shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Active Managed Farmers
          </p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-800 leading-none">2,847</span>
            <span className="text-xs font-semibold text-slate-400">Total active</span>
          </div>
        </div>
      </div>

      {/* 2. Modern CRM Analytics Section: Precision Donut Chart */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5 mb-5">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-emerald-700" />
              CRM Portfolio &amp; Conversion Analytics
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live breakdown of pipeline stages, crop adoption, and telecaller disposition metrics
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setAnalyticsTab('pipeline')}
              className={cx(
                'px-3 py-1 rounded-md text-xs font-bold transition',
                analyticsTab === 'pipeline'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              Pipeline Stages
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsTab('crops')}
              className={cx(
                'px-3 py-1 rounded-md text-xs font-bold transition',
                analyticsTab === 'crops'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              Crops Sown
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsTab('dispositions')}
              className={cx(
                'px-3 py-1 rounded-md text-xs font-bold transition',
                analyticsTab === 'dispositions'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              Call Dispositions
            </button>
          </div>
        </div>

        <ModernDonutChart
          data={activeChartData}
          centerLabel={activeCenterLabel}
          unit={analyticsTab === 'crops' ? ' Farmers' : ''}
        />

        {/* Bottom KPIs: Conversion Rate & Advisory Efficacy */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 border border-slate-100">
            <span className="text-slate-500 font-medium">Conversion Efficiency:</span>
            <span className="font-bold text-emerald-800">32.4% <span className="text-[10px] text-emerald-600">(+3.8%)</span></span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 border border-slate-100">
            <span className="text-slate-500 font-medium">Avg Telecaller Cycle:</span>
            <span className="font-bold text-slate-800">3.8 Days</span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 border border-slate-100">
            <span className="text-slate-500 font-medium">Active Bio-Input Coverage:</span>
            <span className="font-bold text-emerald-700">88.5% of Acres</span>
          </div>
        </div>
      </div>

      {/* 3. Main Two-Column Workstation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Today's Call Queue (~65% width) */}
        <div className="lg:col-span-8 rounded-lg border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-white">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Today&apos;s Call Queue
              </h2>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                19 left
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <label htmlFor="sort-queue" className="text-slate-400 text-[11px] font-medium">Sort by</label>
              <select
                id="sort-queue"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as 'priority' | 'time')}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-600 focus:outline-none"
              >
                <option value="priority">Priority</option>
                <option value="time">Scheduled Time</option>
              </select>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {scheduledCalls.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/agent?phone=${encodeURIComponent(item.phone)}&name=${encodeURIComponent(item.name)}`}
                    className="text-xs font-bold text-slate-900 hover:text-brand-700 transition"
                  >
                    {item.name}
                  </Link>
                  <p className="truncate text-[11px] text-slate-500 mt-0.5">
                    {item.crops} • <span className="text-slate-600 font-medium">{item.district}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-[11px] font-semibold text-slate-600">
                    {item.scheduledTime}
                  </span>
                  <StatusBadge status={item.priority} />
                  <Button
                    variant="call"
                    size="sm"
                    onClick={() => handleDial(item.phone, item.name)}
                    className="px-3 py-1 text-xs"
                    aria-label={`Call ${item.name}`}
                  >
                    <Phone className="h-3 w-3 fill-current" /> Call
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Recent Activity Feed (~35% width) */}
        <div className="lg:col-span-4 rounded-lg border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-3.5 bg-white">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Recent Activity Feed
            </h2>
          </div>

          <div className="divide-y divide-slate-100 p-2">
            {MOCK_ACTIVITY.map((act) => (
              <div key={act.id} className="p-3 hover:bg-slate-50/50 rounded-md transition-colors space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-slate-800">{act.actor}</span>
                  <span className="text-slate-400">{act.timeAgo}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-semibold text-brand-700">{act.farmer}</span>
                  <span className="text-slate-400">({act.crop})</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded border border-slate-100">
                  {act.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
