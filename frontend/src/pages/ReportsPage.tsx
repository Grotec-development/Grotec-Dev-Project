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

export function ReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'calls' | 'followups' | 'farmers'>('leaderboard');

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

  const [downloading, setDownloading] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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
          endpoint === 'leaderboard/export'
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
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 p-1 border border-slate-200/80">
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
          </div>
        </div>

        {exportError && (
          <Alert tone="error">
            {exportError}
          </Alert>
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
      </div>
    </>
  );
}
