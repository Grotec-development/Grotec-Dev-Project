import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  Trophy,
  PhoneCall,
  Clock,
  Users,
  Filter,
  Medal,
  Award,
  RefreshCw,
  Search,
  BarChart2,
  Coffee,
  ShieldCheck,
  Layers,
  SlidersHorizontal,
  ArrowRight,
  IndianRupee,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, CardHeader, Spinner, StatusBadge, cx } from '../components/ui';
import { PageHead } from '../components/PageHead';
import { formatDate } from '../lib/format';
import type {
  CallReportItem,
  FollowUpReportItem,
  CustomerReportItem,
  LeaderboardResponse,
  AgentPerformanceResponse,
  AgentPerformanceItem,
  FseFunnelResponse,
  DynamicBiResponse,
  Page,
} from '../lib/types';

function triggerCsvDownload(csvData: string, filename: string) {
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export function ReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'performance' | 'leaderboard' | 'calls' | 'followups' | 'farmers' | 'funnel' | 'dynamic-bi'>('performance');

  // Performance Analytics filters
  const [performancePeriod, setPerformancePeriod] = useState<'today' | 'week' | 'month'>('today');
  const [performanceSearch, setPerformanceSearch] = useState<string>('');

  // Leaderboard filters
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<'today' | 'week' | 'month'>('month');

  // Call Activity filters
  const [callStatus, setCallStatus] = useState<string>('');
  const [callOutcome, setCallOutcome] = useState<string>('');
  const [callPage, setCallPage] = useState<number>(1);

  // Follow-Up filters
  const [followUpStatus, setFollowUpStatus] = useState<string>('');
  const [followUpOverdue, setFollowUpOverdue] = useState<boolean>(false);
  const [followUpPage, setFollowUpPage] = useState<number>(1);

  // Farmer Master filters
  const [farmerStatus, setFarmerStatus] = useState<string>('');
  const [farmerSoilType, setFarmerSoilType] = useState<string>('');
  const [farmerSearch, setFarmerSearch] = useState<string>('');
  const [farmerPage, setFarmerPage] = useState<number>(1);

  // FSE 360° Funnel filters
  const [funnelFseId, setFunnelFseId] = useState<string>('');
  const [funnelStartDate, setFunnelStartDate] = useState<string>('');
  const [funnelEndDate, setFunnelEndDate] = useState<string>('');

  // Dynamic BI filters
  const [biDistrict, setBiDistrict] = useState<string>('');
  const [biTaluk, setBiTaluk] = useState<string>('');
  const [biVillage, setBiVillage] = useState<string>('');
  const [biProduct, setBiProduct] = useState<string>('');
  const [biDeliveryStatus, setBiDeliveryStatus] = useState<string>('');
  const [biPaymentStatus, setBiPaymentStatus] = useState<string>('');
  const [biPage, setBiPage] = useState<number>(1);

  const [downloading, setDownloading] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Employees Query for FSE filters
  const employeesQuery = useQuery({
    queryKey: ['employees-for-reports'],
    queryFn: async () => {
      const res = await api.get<Page<{ id: string; fullName: string; employeeCode: string | null }>>('/employees', {
        params: { pageSize: 100 },
      });
      return res.data;
    },
  });

  // FSE 360° Funnel Query
  const funnelQuery = useQuery({
    queryKey: ['reports-fse-funnel', funnelFseId, funnelStartDate, funnelEndDate],
    queryFn: async () => {
      const res = await api.get<FseFunnelResponse>('/reports/fse-funnel', {
        params: {
          fseId: funnelFseId || undefined,
          startDate: funnelStartDate || undefined,
          endDate: funnelEndDate || undefined,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'funnel',
  });

  // Dynamic BI Query
  const biQuery = useQuery({
    queryKey: ['reports-dynamic-bi', biDistrict, biTaluk, biVillage, biProduct, biDeliveryStatus, biPaymentStatus, biPage],
    queryFn: async () => {
      const res = await api.get<DynamicBiResponse>('/reports/dynamic-bi', {
        params: {
          district: biDistrict || undefined,
          taluk: biTaluk || undefined,
          village: biVillage || undefined,
          product: biProduct || undefined,
          deliveryStatus: biDeliveryStatus || undefined,
          paymentStatus: biPaymentStatus || undefined,
          page: biPage,
          pageSize: 25,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'dynamic-bi',
  });

  // 0. Agent Performance Query
  const performanceQuery = useQuery({
    queryKey: ['reports-agent-performance', performancePeriod],
    queryFn: async () => {
      const res = await api.get<AgentPerformanceResponse>('/reports/agent-performance', {
        params: { period: performancePeriod },
      });
      return res.data;
    },
    enabled: activeTab === 'performance',
  });

  // 1. Leaderboard Query
  const leaderboardQuery = useQuery({
    queryKey: ['reports-leaderboard', leaderboardPeriod],
    queryFn: async () => {
      const res = await api.get<LeaderboardResponse>('/reports/leaderboard', {
        params: { period: leaderboardPeriod },
      });
      return res.data;
    },
  });

  // 2. Calls Report Query
  const callsQuery = useQuery({
    queryKey: ['reports-calls', callStatus, callOutcome, callPage],
    queryFn: async () => {
      const res = await api.get<Page<CallReportItem>>('/reports/calls', {
        params: {
          status: callStatus || undefined,
          outcome: callOutcome || undefined,
          page: callPage,
          pageSize: 25,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'calls',
  });

  // 3. Follow-Ups Report Query
  const followUpsQuery = useQuery({
    queryKey: ['reports-followups', followUpStatus, followUpOverdue, followUpPage],
    queryFn: async () => {
      const res = await api.get<Page<FollowUpReportItem>>('/reports/follow-ups', {
        params: {
          status: followUpStatus || undefined,
          overdue: followUpOverdue ? 'true' : undefined,
          page: followUpPage,
          pageSize: 25,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'followups',
  });

  // 4. Farmers Report Query
  const farmersQuery = useQuery({
    queryKey: ['reports-farmers', farmerStatus, farmerSoilType, farmerSearch, farmerPage],
    queryFn: async () => {
      const res = await api.get<Page<CustomerReportItem>>('/reports/customers', {
        params: {
          status: farmerStatus || undefined,
          soilType: farmerSoilType || undefined,
          search: farmerSearch.trim() || undefined,
          page: farmerPage,
          pageSize: 25,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'farmers',
  });

  const handleExport = async (endpoint: string, defaultName: string) => {
    try {
      setDownloading(endpoint);
      setExportError(null);
      const res = await api.get<string>(`/reports/${endpoint}`, {
        responseType: 'text',
        params:
          endpoint === 'agent-performance/export'
            ? { period: performancePeriod }
            : endpoint === 'leaderboard/export'
            ? { period: leaderboardPeriod }
            : endpoint === 'calls/export'
            ? { status: callStatus || undefined, outcome: callOutcome || undefined }
            : endpoint === 'follow-ups/export'
            ? { status: followUpStatus || undefined, overdue: followUpOverdue ? 'true' : undefined }
            : { status: farmerStatus || undefined, soilType: farmerSoilType || undefined, search: farmerSearch.trim() || undefined },
      });
      triggerCsvDownload(res.data, defaultName);
    } catch (err: any) {
      setExportError(errorMessage(err) || 'Failed to download CSV export');
    } finally {
      setDownloading(null);
    }
  };

  const handleBiExport = async () => {
    try {
      setDownloading('dynamic-bi');
      setExportError(null);
      const res = await api.get<string>('/reports/dynamic-bi/export', {
        responseType: 'text',
        params: {
          district: biDistrict || undefined,
          taluk: biTaluk || undefined,
          village: biVillage || undefined,
          product: biProduct || undefined,
          deliveryStatus: biDeliveryStatus || undefined,
          paymentStatus: biPaymentStatus || undefined,
        },
      });
      triggerCsvDownload(res.data, `dynamic_bi_report_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err: any) {
      setExportError(errorMessage(err) || 'Failed to download Dynamic BI CSV export');
    } finally {
      setDownloading(null);
    }
  };

  const isManagement = user?.roleCode === 'FOUNDER' || user?.roleCode === 'MANAGER';

  return (
    <>
      <PageHead
        title="CRM Reports & Leaderboard — GROTEC FarmerOS"
        description="Authentic operational CRM activity, telecaller performance leaderboard, and CSV data exports."
      />

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Operational Reports & Leaderboard
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Verifiable activity metrics computed from genuine call logs, follow-up discipline, and farmer records.
            </p>
          </div>

          {/* Tab buttons */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-100 p-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                activeTab === 'performance'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <BarChart2 className="h-3.5 w-3.5 text-blue-600" />
              Agent Performance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                activeTab === 'leaderboard'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              Leaderboard
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calls')}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                activeTab === 'calls'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
              Call Activity
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('followups')}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                activeTab === 'followups'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Clock className="h-3.5 w-3.5 text-sky-600" />
              Follow-Ups
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('farmers')}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                activeTab === 'farmers'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Users className="h-3.5 w-3.5 text-purple-600" />
              Farmer Master
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('funnel')}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                activeTab === 'funnel'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Layers className="h-3.5 w-3.5 text-indigo-600" />
              FSE 360° Funnel
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dynamic-bi')}
              className={cx(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                activeTab === 'dynamic-bi'
                  ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-rose-600" />
              Dynamic BI Filters
            </button>
          </div>
        </div>

        {exportError && (
          <Alert tone="error">
            {exportError}
          </Alert>
        )}

        {/* TAB 0: AGENT PERFORMANCE ANALYTICS */}
        {activeTab === 'performance' && (
          <div className="space-y-4">
            {/* Top controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Analytics Period:</span>
                  <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setPerformancePeriod('today')}
                      className={cx(
                        'px-2.5 py-1 rounded font-medium transition',
                        performancePeriod === 'today' ? 'bg-white font-bold text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => setPerformancePeriod('week')}
                      className={cx(
                        'px-2.5 py-1 rounded font-medium transition',
                        performancePeriod === 'week' ? 'bg-white font-bold text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      Past 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => setPerformancePeriod('month')}
                      className={cx(
                        'px-2.5 py-1 rounded font-medium transition',
                        performancePeriod === 'month' ? 'bg-white font-bold text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                      )}
                    >
                      Current Month
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={performanceSearch}
                    onChange={(e) => setPerformanceSearch(e.target.value)}
                    placeholder="Filter agent or code..."
                    className="pl-8 pr-3 py-1 text-xs rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 w-44"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isManagement && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleExport('agent-performance/export', `grotec_agent_performance_${performancePeriod}.csv`)}
                    disabled={downloading === 'agent-performance/export'}
                  >
                    {downloading === 'agent-performance/export' ? (
                      <span>Exporting...</span>
                    ) : (
                      <>
                        <Download className="h-3 w-3 mr-1 text-emerald-700" />
                        Export Performance CSV
                      </>
                    )}
                  </Button>
                )}
                <Button size="xs" variant="ghost" onClick={() => void performanceQuery.refetch()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Team Summary Cards */}
            {performanceQuery.data?.teamSummary && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Calls Dialed</span>
                    <PhoneCall className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {performanceQuery.data.teamSummary.totalCallsDialed}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                    {performanceQuery.data.teamSummary.totalCallsConnected} connected ({performanceQuery.data.teamSummary.teamConnectionRate}%)
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Total Talk Time</span>
                    <Clock className="h-4 w-4 text-sky-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {formatSeconds(performanceQuery.data.teamSummary.totalTalkTimeSeconds)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Active telecalling voice time
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Breaks Logged</span>
                    <Coffee className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {performanceQuery.data.teamSummary.totalBreakMinutes}m
                  </div>
                  <div className="text-[11px] text-amber-600 font-medium mt-0.5">
                    Total team rest & meal breaks
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Quality Score</span>
                    <ShieldCheck className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {performanceQuery.data.teamSummary.avgQualityScore}%
                  </div>
                  <div className="text-[11px] text-purple-600 font-medium mt-0.5">
                    Documentation & follow-up adherence
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Shift Uptime</span>
                    <BarChart2 className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-xl font-black text-slate-900">
                    {performanceQuery.data.teamSummary.totalUptimeHours} hrs
                  </div>
                  <div className="text-[11px] text-blue-600 font-medium mt-0.5">
                    {performanceQuery.data.teamSummary.totalAgents} roster telecallers
                  </div>
                </div>
              </div>
            )}

            {/* Agents Performance Table */}
            <Card>
              <CardHeader
                title="Telecaller Performance Roster (Calls, Break Compliance, Call Quality, and Shift Uptime)"
              />
              <div className="overflow-x-auto">
                {performanceQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner label="Loading telecaller performance metrics..." />
                  </div>
                ) : (() => {
                  const filteredAgents = (performanceQuery.data?.agents || []).filter((agent) => {
                    if (!performanceSearch.trim()) return true;
                    const query = performanceSearch.toLowerCase();
                    return (
                      agent.fullName.toLowerCase().includes(query) ||
                      agent.employeeCode.toLowerCase().includes(query) ||
                      agent.department.toLowerCase().includes(query)
                    );
                  });

                  if (filteredAgents.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-500 text-xs">
                        No telecaller performance records match the current filter.
                      </div>
                    );
                  }

                  return (
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Agent</th>
                          <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Calls (Dialed / Conn.)</th>
                          <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Talk Time</th>
                          <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Dispositions</th>
                          <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Breaks Logged</th>
                          <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Quality Score</th>
                          <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Shift Uptime</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {filteredAgents.map((agent) => {
                          const gradeTone =
                            agent.quality.grade === 'EXCELLENT'
                              ? 'green'
                              : agent.quality.grade === 'GOOD'
                              ? 'blue'
                              : 'amber';

                          return (
                            <tr
                              key={agent.agentId}
                              className={cx(
                                'hover:bg-slate-50/80 transition-colors',
                                agent.isCurrentAgent && 'bg-emerald-50/40 font-medium'
                              )}
                            >
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                      {agent.fullName}
                                      {agent.isCurrentAgent && (
                                        <span className="rounded bg-emerald-100 text-emerald-800 px-1 py-0.2 text-[9px] font-bold">
                                          YOU
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono">
                                      {agent.employeeCode} • {agent.department}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-bold text-slate-900">
                                  {agent.calls.connected} <span className="font-normal text-slate-400">/ {agent.calls.dialed}</span>
                                </div>
                                <div className="text-[11px] text-emerald-600 font-semibold">
                                  {agent.calls.connectionRate}% connect rate
                                </div>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-bold text-slate-900">
                                  {formatSeconds(agent.calls.totalTalkTimeSeconds)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  avg {formatSeconds(agent.calls.avgTalkTimeSeconds)} / call
                                </div>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 text-[11px]">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/60" title="Interested">
                                    ★ {agent.calls.dispositions.interested}
                                  </span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200" title="Not Interested">
                                    ✗ {agent.calls.dispositions.notInterested}
                                  </span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200" title="Not Answered">
                                    ⊘ {agent.calls.dispositions.notAnswered}
                                  </span>
                                </div>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Coffee className="h-3.5 w-3.5 text-amber-600" />
                                  <span className="font-bold text-slate-900">{agent.breaks.totalMinutes}m</span>
                                  <span className="text-[11px] text-slate-500">({agent.breaks.count} breaks)</span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  avg {agent.breaks.averageMinutes}m / break
                                </div>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm text-slate-900">
                                    {agent.quality.score}%
                                  </span>
                                  <Badge tone={gradeTone}>{agent.quality.grade}</Badge>
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Notes: {agent.quality.notesDocumentedRate}% • Substantive: {agent.quality.meaningfulDurationRate}%
                                </div>
                              </td>

                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-bold text-slate-900">
                                  {agent.uptime.uptimeHours} hrs
                                </div>
                                <div className="text-[11px] text-blue-600 font-semibold">
                                  {agent.uptime.utilizationPercent}% utilization
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 1: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4">
            {/* Top controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Performance Period:</span>
                <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setLeaderboardPeriod('today')}
                    className={cx(
                      'px-2.5 py-1 rounded font-medium transition',
                      leaderboardPeriod === 'today' ? 'bg-white font-bold text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardPeriod('week')}
                    className={cx(
                      'px-2.5 py-1 rounded font-medium transition',
                      leaderboardPeriod === 'week' ? 'bg-white font-bold text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    Past 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardPeriod('month')}
                    className={cx(
                      'px-2.5 py-1 rounded font-medium transition',
                      leaderboardPeriod === 'month' ? 'bg-white font-bold text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    )}
                  >
                    Current Month
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isManagement && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => handleExport('leaderboard/export', `grotec_leaderboard_${leaderboardPeriod}.csv`)}
                    disabled={downloading === 'leaderboard/export'}
                  >
                    {downloading === 'leaderboard/export' ? (
                      <span>Exporting...</span>
                    ) : (
                      <>
                        <Download className="h-3 w-3 mr-1 text-emerald-700" />
                        Export Leaderboard CSV
                      </>
                    )}
                  </Button>
                )}
                <Button size="xs" variant="ghost" onClick={() => void leaderboardQuery.refetch()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Current Agent Rank Highlight */}
            {leaderboardQuery.data?.currentAgentRank && (
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white font-black text-sm">
                    #{leaderboardQuery.data.currentAgentRank}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-900">Your Current Standing</p>
                    <p className="text-[11px] text-emerald-700">
                      Ranked #{leaderboardQuery.data.currentAgentRank} among {leaderboardQuery.data.totalAgents} active telecaller agents.
                    </p>
                  </div>
                </div>
                <Badge tone="green">Active Telecaller</Badge>
              </div>
            )}

            {/* Leaderboard Table */}
            <Card>
              <CardHeader
                title="Operational Agent Rankings (Calls Connected → Leads Converted → Completed Follow-Ups → Talk Time)"
              />
              <div className="overflow-x-auto">
                {leaderboardQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner label="Computing live operational metrics..." />
                  </div>
                ) : leaderboardQuery.data?.leaderboard?.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Rank</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Agent</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Code</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Calls Dialed</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Calls Connected</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Talk Time (min)</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Follow-Ups Done</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Conversions</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Conv. Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {leaderboardQuery.data.leaderboard.map((item) => {
                        const talkTimeMin = Math.round(item.totalTalkTimeSeconds / 60);
                        return (
                          <tr
                            key={item.agentId}
                            className={cx(
                              'hover:bg-slate-50/70 transition-colors',
                              item.isCurrentAgent && 'bg-emerald-50/50 font-semibold'
                            )}
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              {item.rank === 1 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-900 border border-amber-300">
                                  <Medal className="h-3.5 w-3.5 text-amber-600 fill-amber-500" /> 1st
                                </span>
                              ) : item.rank === 2 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-black text-slate-800 border border-slate-300">
                                  <Award className="h-3.5 w-3.5 text-slate-500" /> 2nd
                                </span>
                              ) : item.rank === 3 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-800 border border-amber-200">
                                  <Award className="h-3.5 w-3.5 text-amber-700" /> 3rd
                                </span>
                              ) : (
                                <span className="text-slate-500 font-bold ml-2">#{item.rank}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{item.fullName}</span>
                                {item.isCurrentAgent && (
                                  <span className="text-[10px] rounded bg-emerald-100 text-emerald-800 px-1 py-0.2 font-bold">
                                    You
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                              {item.employeeCode}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-slate-700">
                              {item.callsDialed}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-emerald-700">
                              {item.callsConnected}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-slate-700">
                              {talkTimeMin}m
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-sky-700">
                              {item.followUpsCompleted}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-emerald-800">
                              {item.leadsConverted}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-slate-700">
                              {item.conversionRate}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    No telecaller activity recorded for the selected window.
                  </div>
                )}
              </div>
            </Card>

            {/* Note on deferred revenue KPIs */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700">Data Integrity Notice:</span> Rankings reflect actual
              telephony and CRM operational activity (dialed calls, connected conversations, completed follow-ups, and sales handoffs).
              Revenue and commercial order volume rankings are strictly deferred to Phase 2 commercial transaction integration.
            </div>
          </div>
        )}

        {/* TAB 2: CALL ACTIVITY REPORT */}
        {activeTab === 'calls' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-600">Filters:</span>

                <select
                  value={callStatus}
                  onChange={(e) => {
                    setCallStatus(e.target.value);
                    setCallPage(1);
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                >
                  <option value="">All Call Statuses</option>
                  <option value="ENDED">Connected & Ended</option>
                  <option value="NOT_ANSWERED">Not Answered</option>
                  <option value="BUSY">Busy</option>
                  <option value="FAILED">Failed</option>
                </select>

                <select
                  value={callOutcome}
                  onChange={(e) => {
                    setCallOutcome(e.target.value);
                    setCallPage(1);
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                >
                  <option value="">All Dispositions</option>
                  <option value="INTERESTED">Interested</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                  <option value="CALLBACK_REQUESTED">Callback Requested</option>
                  <option value="WRONG_NUMBER">Wrong Number</option>
                  <option value="NO_ANSWER">No Answer</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleExport('calls/export', 'grotec_calls_report.csv')}
                  disabled={downloading === 'calls/export'}
                >
                  {downloading === 'calls/export' ? (
                    <span>Exporting...</span>
                  ) : (
                    <>
                      <Download className="h-3 w-3 mr-1 text-emerald-700" />
                      Export CSV
                    </>
                  )}
                </Button>
                <Button size="xs" variant="ghost" onClick={() => void callsQuery.refetch()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card>
              <div className="overflow-x-auto">
                {callsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner label="Loading call activity logs..." />
                  </div>
                ) : callsQuery.data?.items?.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Date & Time</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Agent</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Farmer</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Phone</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Outcome</th>
                        <th className="px-4 py-3 text-right font-bold uppercase tracking-wider">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {callsQuery.data.items.map((call) => (
                        <tr key={call.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-mono">
                            {formatDate(call.startedAt)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-semibold text-slate-800">
                              {call.agent?.fullName || '—'}
                            </span>
                            {call.agent?.employeeCode && (
                              <span className="ml-1 text-[11px] text-slate-400 font-mono">
                                ({call.agent.employeeCode})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-900">
                            {call.customer?.fullName || 'Unattached'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">
                            {call.phoneNumber}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge
                              tone={
                                call.status === 'ENDED'
                                  ? 'green'
                                  : call.status === 'NOT_ANSWERED'
                                  ? 'amber'
                                  : 'slate'
                              }
                            >
                              {call.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {call.outcome ? (
                              <Badge tone={call.outcome === 'INTERESTED' ? 'green' : 'slate'}>
                                {call.outcome}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-slate-700">
                            {call.durationSeconds > 0 ? `${call.durationSeconds}s` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    No calls found matching the selected filter criteria.
                  </div>
                )}
              </div>

              {/* Pagination */}
              {callsQuery.data && callsQuery.data.total > 25 && (
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs">
                  <span className="text-slate-500">
                    Showing {(callPage - 1) * 25 + 1}–{Math.min(callPage * 25, callsQuery.data.total)} of{' '}
                    {callsQuery.data.total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setCallPage((p) => Math.max(1, p - 1))}
                      disabled={callPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setCallPage((p) => p + 1)}
                      disabled={callPage * 25 >= callsQuery.data.total}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 3: FOLLOW-UPS REPORT */}
        {activeTab === 'followups' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-600">Filters:</span>

                <select
                  value={followUpStatus}
                  onChange={(e) => {
                    setFollowUpStatus(e.target.value);
                    setFollowUpPage(1);
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={followUpOverdue}
                    onChange={(e) => {
                      setFollowUpOverdue(e.target.checked);
                      setFollowUpPage(1);
                    }}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Overdue Only</span>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleExport('follow-ups/export', 'grotec_follow_ups.csv')}
                  disabled={downloading === 'follow-ups/export'}
                >
                  {downloading === 'follow-ups/export' ? (
                    <span>Exporting...</span>
                  ) : (
                    <>
                      <Download className="h-3 w-3 mr-1 text-emerald-700" />
                      Export CSV
                    </>
                  )}
                </Button>
                <Button size="xs" variant="ghost" onClick={() => void followUpsQuery.refetch()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card>
              <div className="overflow-x-auto">
                {followUpsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner label="Loading follow-up discipline report..." />
                  </div>
                ) : followUpsQuery.data?.items?.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Due Date</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Farmer</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Agent</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Note</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Completed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {followUpsQuery.data.items.map((fu) => {
                        const isOverdue = fu.status === 'PENDING' && new Date(fu.dueAt) < new Date();
                        return (
                          <tr key={fu.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600">
                              {formatDate(fu.dueAt)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {isOverdue ? (
                                <Badge tone="red">Overdue</Badge>
                              ) : fu.status === 'COMPLETED' ? (
                                <Badge tone="green">Completed</Badge>
                              ) : (
                                <Badge tone="amber">Pending</Badge>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">
                              {fu.customer?.fullName || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                              {fu.agent?.fullName || '—'}
                            </td>
                            <td className="px-4 py-3 max-w-xs truncate text-slate-600" title={fu.note}>
                              {fu.note || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                              {fu.completedAt ? formatDate(fu.completedAt) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    No follow-ups found for the selected criteria.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 4: FARMER MASTER */}
        {activeTab === 'farmers' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="relative">
                  <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={farmerSearch}
                    onChange={(e) => {
                      setFarmerSearch(e.target.value);
                      setFarmerPage(1);
                    }}
                    placeholder="Search farmer or phone..."
                    className="rounded border border-slate-200 bg-slate-50 pl-7 pr-3 py-1 text-xs w-44"
                  />
                </div>

                <select
                  value={farmerStatus}
                  onChange={(e) => {
                    setFarmerStatus(e.target.value);
                    setFarmerPage(1);
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>

                <select
                  value={farmerSoilType}
                  onChange={(e) => {
                    setFarmerSoilType(e.target.value);
                    setFarmerPage(1);
                  }}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
                >
                  <option value="">All Soil Types</option>
                  <option value="Red loam">Red loam</option>
                  <option value="Clay">Clay</option>
                  <option value="Alluvial">Alluvial</option>
                  <option value="Black cotton">Black cotton</option>
                  <option value="Sandy loam">Sandy loam</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => handleExport('customers/export', 'grotec_farmers.csv')}
                  disabled={downloading === 'customers/export'}
                >
                  {downloading === 'customers/export' ? (
                    <span>Exporting...</span>
                  ) : (
                    <>
                      <Download className="h-3 w-3 mr-1 text-emerald-700" />
                      Export Master CSV
                    </>
                  )}
                </Button>
                <Button size="xs" variant="ghost" onClick={() => void farmersQuery.refetch()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card>
              <div className="overflow-x-auto">
                {farmersQuery.isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Spinner label="Loading farmer master directory..." />
                  </div>
                ) : farmersQuery.data?.items?.length ? (
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Farmer Code</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Full Name</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Primary Phone</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Soil Type</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Location</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider">Registered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {farmersQuery.data.items.map((farmer) => {
                        const loc = farmer.locations?.[0];
                        const locText = [loc?.village, loc?.taluk, loc?.district].filter(Boolean).join(', ') || '—';
                        return (
                          <tr key={farmer.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500 font-bold">
                              {farmer.farmerCode || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-900">
                              {farmer.fullName}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-700">
                              {farmer.phones?.[0]?.phoneE164 || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {farmer.soilType ? (
                                <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200/60">
                                  {farmer.soilType}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 max-w-xs truncate text-slate-600" title={locText}>
                              {locText}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusBadge status={farmer.status} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-500 font-mono">
                              {formatDate(farmer.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    No farmers found matching the search criteria.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB: FSE 360° BUSINESS FUNNEL */}
        {activeTab === 'funnel' && (
          <div className="space-y-6">
            {/* Filter controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Field Sales Executive:</span>
                  <select
                    value={funnelFseId}
                    onChange={(e) => setFunnelFseId(e.target.value)}
                    className="rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                  >
                    <option value="">All FSEs (Entire Organization)</option>
                    {employeesQuery.data?.items?.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} {emp.employeeCode ? `(${emp.employeeCode})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">From:</span>
                  <input
                    type="date"
                    value={funnelStartDate}
                    onChange={(e) => setFunnelStartDate(e.target.value)}
                    className="rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">To:</span>
                  <input
                    type="date"
                    value={funnelEndDate}
                    onChange={(e) => setFunnelEndDate(e.target.value)}
                    className="rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                  />
                </div>

                {(funnelFseId || funnelStartDate || funnelEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFunnelFseId('');
                      setFunnelStartDate('');
                      setFunnelEndDate('');
                    }}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded bg-rose-50 border border-rose-200/60"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => funnelQuery.refetch()}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className={cx('h-3.5 w-3.5', funnelQuery.isFetching && 'animate-spin')} />
                  Refresh Funnel
                </Button>
              </div>
            </div>

            {funnelQuery.isLoading ? (
              <Card className="p-12 text-center">
                <Spinner label="Computing 12-stage commercial funnel..." />
              </Card>
            ) : funnelQuery.isError ? (
              <Alert tone="error">{errorMessage(funnelQuery.error) || 'Failed to load FSE Funnel metrics.'}</Alert>
            ) : funnelQuery.data ? (
              <div className="space-y-6">
                {/* Conversion KPIs Summary Ribbon */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 border border-indigo-200/80 rounded-xl p-3 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700">Attempt Rate</div>
                    <div className="text-xl font-bold text-indigo-950 mt-1">{funnelQuery.data.conversions.attemptRate}</div>
                    <div className="text-[10px] text-indigo-600 mt-0.5">Assigned to Dialled</div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200/80 rounded-xl p-3 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Connect Rate</div>
                    <div className="text-xl font-bold text-blue-950 mt-1">{funnelQuery.data.conversions.connectRate}</div>
                    <div className="text-[10px] text-blue-600 mt-0.5">Attempts to Connected</div>
                  </div>
                  <div className="bg-gradient-to-br from-cyan-50 to-cyan-100/50 border border-cyan-200/80 rounded-xl p-3 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-700">Quality Conv.</div>
                    <div className="text-xl font-bold text-cyan-950 mt-1">{funnelQuery.data.conversions.qualityRate}</div>
                    <div className="text-[10px] text-cyan-600 mt-0.5">&gt;90s structured discussion</div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/80 rounded-xl p-3 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Lead Conversion</div>
                    <div className="text-xl font-bold text-amber-950 mt-1">{funnelQuery.data.conversions.leadRate}</div>
                    <div className="text-[10px] text-amber-600 mt-0.5">Interest to Qualified Lead</div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200/80 rounded-xl p-3 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Booking Conv.</div>
                    <div className="text-xl font-bold text-emerald-950 mt-1">{funnelQuery.data.conversions.bookingRate}</div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">Leads to Booked Orders</div>
                  </div>
                  <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 border border-teal-200/80 rounded-xl p-3 shadow-2xs">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Collection Rate</div>
                    <div className="text-xl font-bold text-teal-950 mt-1">{funnelQuery.data.conversions.collectionRate}</div>
                    <div className="text-[10px] text-teal-600 mt-0.5">Delivered to Collected</div>
                  </div>
                </div>

                {/* 12-Stage Visual Commercial Funnel Pipeline */}
                <Card className="p-6">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-600" />
                        12-Stage Commercial Conversion Pipeline
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Complete lead lifecycle tracking from cold assignment down to cash collection & returns.
                      </p>
                    </div>
                    {funnelQuery.data.summary.returns > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        Returns: {funnelQuery.data.summary.returns} ({funnelQuery.data.conversions.returnRate})
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {funnelQuery.data.stages.map((stage) => {
                      const isFinancial = stage.isAmount;
                      const formattedVal = isFinancial
                        ? `₹${Number(stage.count).toLocaleString('en-IN')}`
                        : Number(stage.count).toLocaleString('en-IN');

                      let badgeTone = 'bg-slate-100 text-slate-800 border-slate-200';
                      if (stage.stage <= 3) badgeTone = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                      else if (stage.stage <= 6) badgeTone = 'bg-blue-50 text-blue-800 border-blue-200';
                      else if (stage.stage <= 8) badgeTone = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                      else if (stage.stage <= 11) badgeTone = 'bg-amber-50 text-amber-800 border-amber-200';
                      else badgeTone = 'bg-teal-50 text-teal-800 border-teal-200';

                      return (
                        <div
                          key={stage.stage}
                          className="relative flex flex-col justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className={cx('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', badgeTone)}>
                                Stage {stage.stage}
                              </span>
                              {isFinancial && (
                                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  Commercial
                                </span>
                              )}
                            </div>
                            <h3 className="text-xs font-bold text-slate-800 mt-2.5">
                              {stage.name}
                            </h3>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                            <span className={cx('text-2xl font-black tracking-tight', isFinancial ? 'text-emerald-700' : 'text-slate-900')}>
                              {formattedVal}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>

                {/* Agent Comparison Table (when aggregate view is active) */}
                {funnelQuery.data.agentComparison && funnelQuery.data.agentComparison.length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHeader
                      title="Field Sales Executives (FSE) Comparison & Benchmarks"
                    />
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <tr>
                            <th className="px-4 py-3 text-left">FSE Representative</th>
                            <th className="px-4 py-3 text-right">Assigned</th>
                            <th className="px-4 py-3 text-right">Attempts</th>
                            <th className="px-4 py-3 text-right">Connected</th>
                            <th className="px-4 py-3 text-right">Bookings</th>
                            <th className="px-4 py-3 text-right">Booking Value</th>
                            <th className="px-4 py-3 text-right">Collections</th>
                            <th className="px-4 py-3 text-right">Conversion</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {funnelQuery.data.agentComparison.map((agent, idx) => {
                            const convRate = agent.assigned > 0
                              ? `${((agent.bookings / agent.assigned) * 100).toFixed(1)}%`
                              : '0.0%';
                            return (
                              <tr key={agent.agentId} className="hover:bg-slate-50/70">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">
                                      #{idx + 1}
                                    </span>
                                    <div>
                                      <div className="font-bold text-slate-900">{agent.fullName}</div>
                                      <div className="font-mono text-[10px] text-slate-400">{agent.employeeCode || '—'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-slate-600">
                                  {agent.assigned}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-slate-600">
                                  {agent.attempts}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-blue-700">
                                  {agent.connected}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-emerald-700">
                                  {agent.bookings}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-slate-900">
                                  ₹{agent.bookingValue.toLocaleString('en-IN')}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-teal-700">
                                  ₹{agent.collections.toLocaleString('en-IN')}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-indigo-700">
                                  {convRate}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* TAB: DYNAMIC BUSINESS INTELLIGENCE (BI) FILTERS */}
        {activeTab === 'dynamic-bi' && (
          <div className="space-y-6">
            {/* Multi-Dimensional Filter Control Bar */}
            <Card className="p-4 bg-white shadow-2xs">
              <div className="border-b border-slate-200 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-rose-600" />
                    Multi-Dimensional Query & Filter Engine
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Instantly query cross-sections (e.g. District = Madurai + Delivery Status = Pending) to compute counts and values.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBiExport}
                    disabled={downloading === 'dynamic-bi'}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Download className={cx('h-3.5 w-3.5', downloading === 'dynamic-bi' && 'animate-spin')} />
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">District</label>
                  <select
                    value={biDistrict}
                    onChange={(e) => {
                      setBiDistrict(e.target.value);
                      setBiPage(1);
                    }}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                  >
                    <option value="">All Districts</option>
                    <option value="Madurai">Madurai</option>
                    <option value="Dharmapuri">Dharmapuri</option>
                    <option value="Trichy">Trichy</option>
                    <option value="Erode">Erode</option>
                    <option value="Coimbatore">Coimbatore</option>
                    <option value="Tanjore">Tanjore</option>
                    <option value="Salem">Salem</option>
                    <option value="Dindigul">Dindigul</option>
                    <option value="Theni">Theni</option>
                    <option value="Tirunelveli">Tirunelveli</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Taluk</label>
                  <input
                    type="text"
                    placeholder="e.g. Palani"
                    value={biTaluk}
                    onChange={(e) => {
                      setBiTaluk(e.target.value);
                      setBiPage(1);
                    }}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Village</label>
                  <input
                    type="text"
                    placeholder="e.g. Alagar"
                    value={biVillage}
                    onChange={(e) => {
                      setBiVillage(e.target.value);
                      setBiPage(1);
                    }}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Product</label>
                  <input
                    type="text"
                    placeholder="e.g. Booster"
                    value={biProduct}
                    onChange={(e) => {
                      setBiProduct(e.target.value);
                      setBiPage(1);
                    }}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Delivery Status</label>
                  <select
                    value={biDeliveryStatus}
                    onChange={(e) => {
                      setBiDeliveryStatus(e.target.value);
                      setBiPage(1);
                    }}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                  >
                    <option value="">All Delivery Statuses</option>
                    <option value="PENDING">PENDING</option>
                    <option value="DISPATCHED">DISPATCHED</option>
                    <option value="IN_TRANSIT">IN TRANSIT</option>
                    <option value="DELIVERED">DELIVERED</option>
                    <option value="RETURNED">RETURNED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment Status</label>
                  <select
                    value={biPaymentStatus}
                    onChange={(e) => {
                      setBiPaymentStatus(e.target.value);
                      setBiPage(1);
                    }}
                    className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-600 focus:bg-white focus:outline-none"
                  >
                    <option value="">All Payment Statuses</option>
                    <option value="PENDING">PENDING</option>
                    <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                    <option value="PAID">PAID</option>
                  </select>
                </div>
              </div>

              {(biDistrict || biTaluk || biVillage || biProduct || biDeliveryStatus || biPaymentStatus) && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">
                    Active Filters: {[biDistrict, biTaluk, biVillage, biProduct, biDeliveryStatus, biPaymentStatus].filter(Boolean).join(' • ')}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setBiDistrict('');
                      setBiTaluk('');
                      setBiVillage('');
                      setBiProduct('');
                      setBiDeliveryStatus('');
                      setBiPaymentStatus('');
                      setBiPage(1);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold"
                  >
                    <RotateCcw className="h-3 w-3" /> Clear All Filters
                  </button>
                </div>
              )}
            </Card>

            {/* Instant KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matching Orders</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {biQuery.data?.summary.totalMatching ?? 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Orders matching criteria</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unique Farmers</div>
                <div className="text-2xl font-black text-blue-700 mt-1">
                  {biQuery.data?.summary.uniqueFarmers ?? 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Distinct farmers in selection</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Booking Value</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">
                  ₹{(biQuery.data?.summary.totalBookingValue ?? 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Gross booked commercial value</div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Collected Value</div>
                <div className="text-2xl font-black text-teal-700 mt-1">
                  ₹{(biQuery.data?.summary.totalCollectedValue ?? 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">Realized cash receipts</div>
              </div>
            </div>

            {/* Orders Data Table */}
            <Card className="overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Detailed Query Results ({biQuery.data?.total ?? 0} total records)
                </span>
                {biQuery.data && biQuery.data.totalPages > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      disabled={biPage <= 1}
                      onClick={() => setBiPage((p) => Math.max(1, p - 1))}
                      className="px-2 py-1 rounded border border-slate-200 bg-white disabled:opacity-50 text-slate-700 hover:bg-slate-50"
                    >
                      Prev
                    </button>
                    <span className="font-semibold text-slate-600">
                      Page {biPage} of {biQuery.data.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={biPage >= biQuery.data.totalPages}
                      onClick={() => setBiPage((p) => p + 1)}
                      className="px-2 py-1 rounded border border-slate-200 bg-white disabled:opacity-50 text-slate-700 hover:bg-slate-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                {biQuery.isLoading ? (
                  <div className="py-12 text-center">
                    <Spinner label="Executing multi-dimensional query..." />
                  </div>
                ) : biQuery.isError ? (
                  <div className="p-4">
                    <Alert tone="error">{errorMessage(biQuery.error) || 'Failed to execute query.'}</Alert>
                  </div>
                ) : biQuery.data?.results && biQuery.data.results.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <tr>
                        <th className="px-4 py-3 text-left">Order #</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Farmer</th>
                        <th className="px-4 py-3 text-left">Location</th>
                        <th className="px-4 py-3 text-left">Products</th>
                        <th className="px-4 py-3 text-right">Order Value</th>
                        <th className="px-4 py-3 text-left">Delivery Status</th>
                        <th className="px-4 py-3 text-right">Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {biQuery.data.results.map((item) => {
                        const locText = [item.customer.village, item.customer.taluk, item.customer.district].filter(Boolean).join(', ') || '—';
                        const productsText = item.items?.map((p) => `${p.productName} (x${p.quantity})`).join(', ') || '—';
                        const totalCollected = item.paymentReceipts?.reduce((s, r) => s + (Number(r.amount) || 0), 0) || 0;
                        const deliveryStatus = item.dispatches?.[0]?.status || 'PENDING';

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70">
                            <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-slate-800">
                              {item.orderNumber}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-500">
                              {formatDate(item.createdAt)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{item.customer.fullName}</div>
                              <div className="font-mono text-[10px] text-slate-400">
                                {item.customer.farmerCode ? `${item.customer.farmerCode} • ` : ''}{item.customer.primaryPhone || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-xs truncate text-slate-600" title={locText}>
                              {locText}
                            </td>
                            <td className="px-4 py-3 max-w-xs truncate text-slate-700" title={productsText}>
                              {productsText}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-slate-900">
                              ₹{Number(item.totalAmount).toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusBadge status={deliveryStatus} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right font-mono font-bold text-teal-700">
                              ₹{totalCollected.toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-slate-500">
                    No orders found matching the filter criteria.
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
