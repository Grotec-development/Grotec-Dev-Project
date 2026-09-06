import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BarChart3,
  CheckCircle2,
  Lock,
  Plus,
  ShieldCheck,
  Target,
  TrendingUp,
  RotateCcw,
  Users,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Spinner,
  StatusBadge,
  TD,
  TH,
  THead,
  Table,
  cx,
} from '../../components/ui';

export function KpiPage() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const isFounder = user?.roleCode === 'FOUNDER';
  const canMy = !isFounder && hasPermission('kpi.read');
  const canTeam = hasPermission('kpi.manage') || hasPermission('hrms.kpi.configure');

  const paramTab = searchParams.get('tab');
  const activeTab: 'my' | 'team' = !canMy ? 'team' : (!canTeam ? 'my' : (paramTab === 'team' ? 'team' : 'my'));

  const setActiveTab = (tab: 'my' | 'team') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const currentPeriodStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [period, setPeriod] = useState(currentPeriodStr);
  const [teamScores, setTeamScores] = useState<any[]>([]);
  const [myScore, setMyScore] = useState<any>(null);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Freeze Modal
  const [freezeEmployee, setFreezeEmployee] = useState<any>(null);
  const [freezeNotes, setFreezeNotes] = useState('');
  const [coachingActions, setCoachingActions] = useState('');

  // Target Modal
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [targetForm, setTargetForm] = useState({
    period: currentPeriodStr,
    metric: 'CALLS_DIALED',
    targetValue: 100,
    weight: 1,
  });

  const fetchMyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [scoreRes, targetsRes] = await Promise.all([
        api.get(`/kpi/my/score/${period}`),
        api.get('/kpi/targets', { params: { period } }),
      ]);
      setMyScore(scoreRes.data || null);
      setTargets(Array.isArray(targetsRes.data) ? targetsRes.data : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load your KPI scorecard');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamRes, targetsRes] = await Promise.all([
        api.get(`/kpi/team-summary/${period}`),
        api.get('/kpi/targets', { params: { period } }),
      ]);
      const rawData = teamRes.data;
      const scores = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.scores)
        ? rawData.scores
        : [];
      setTeamScores(scores);
      setTargets(Array.isArray(targetsRes.data) ? targetsRes.data : []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load team performance summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'my' && canMy) {
      void fetchMyData();
    } else if (activeTab === 'team' && canTeam) {
      void fetchTeamData();
    }
  }, [activeTab, period]);

  const handleCompute = async () => {
    setComputing(true);
    setError(null);
    try {
      await api.post(`/kpi/compute?period=${period}`, {});
      if (activeTab === 'team') await fetchTeamData();
      else await fetchMyData();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to compute live KPI scores');
    } finally {
      setComputing(false);
    }
  };

  const handleFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeEmployee?.employee?.id) return;
    try {
      await api.post(`/kpi/freeze/${freezeEmployee.employee.id}/${period}`, {
        reviewNotes: freezeNotes,
        coachingActions,
      });
      setFreezeEmployee(null);
      void fetchTeamData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to freeze KPI score');
    }
  };

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/kpi/targets', {
        ...targetForm,
        targetValue: Number(targetForm.targetValue),
        weight: Number(targetForm.weight),
      });
      setShowTargetModal(false);
      if (activeTab === 'team') void fetchTeamData();
      else void fetchMyData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save target');
    }
  };

  const safeTeamScores = Array.isArray(teamScores) ? teamScores : [];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {activeTab === 'my' ? 'My Performance Scorecard' : 'Team Performance & KPIs'}
          </h1>
          <p className="text-sm text-slate-500">
            {activeTab === 'my'
              ? 'Your monthly KPI achievement, calling metrics, conversion rate, and evaluation status.'
              : 'Live telecaller calling activity, conversion rates, weighted scorecard evaluations, and period score freezing.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'team' && canTeam && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompute}
                disabled={computing}
                className="gap-1.5 text-xs font-semibold"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {computing ? 'Computing…' : 'Compute Live Scores'}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowTargetModal(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                Configure Target
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dual Tab Mode Switcher (Manager with both roles) */}
      {canMy && canTeam && (
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={cx(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer',
              activeTab === 'my'
                ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <Target className="h-4 w-4" />
            My Performance Scorecard
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={cx(
              'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer',
              activeTab === 'team'
                ? 'border-brand-600 text-brand-700 bg-brand-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <Users className="h-4 w-4" />
            Team KPI & Scores
          </button>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {/* Period Selector & PRD Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700">Evaluation Period:</span>
          <Input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-48"
          />
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-md">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          <span>Historical score immutability enforced upon freezing per PRD §7.4.2</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MY PERFORMANCE SCORECARD (Self-Service)                           */}
      {/* ========================================================================= */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {loading && !myScore ? (
            <Spinner label="Loading performance scorecard…" />
          ) : !myScore ? (
            <div className="py-12 text-center text-sm text-slate-500 space-y-3">
              <p>No KPI score calculated for {period} yet.</p>
              <Button size="sm" onClick={handleCompute} disabled={computing}>
                {computing ? 'Computing…' : 'Compute My Score'}
              </Button>
            </div>
          ) : (
            <>
              {/* Scorecard KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-4 border-l-4 border-l-brand-600 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Performance</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">{myScore.overallScore ?? '—'}%</span>
                    <Badge
                      tone={
                        myScore.performanceStatus === 'Exceeds Expectations'
                          ? 'green'
                          : myScore.performanceStatus === 'Meets Expectations'
                          ? 'slate'
                          : 'amber'
                      }
                    >
                      {myScore.performanceStatus}
                    </Badge>
                  </div>
                  <div className="mt-2 w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-brand-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, Number(myScore.overallScore) || 0)}%` }}
                    />
                  </div>
                </Card>

                <Card className="p-4 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Calling Activity</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {myScore.actualValues?.CALLS_DIALED ?? 0}
                    <span className="text-xs font-normal text-slate-400 ml-1">dialed</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Connected: <span className="font-semibold text-brand-600">{myScore.actualValues?.CALLS_CONNECTED ?? 0}</span>
                  </p>
                </Card>

                <Card className="p-4 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversion & Leads</div>
                  <div className="mt-2 text-2xl font-bold text-emerald-600">
                    {myScore.actualValues?.LEADS_CONVERTED ?? 0}
                    <span className="text-xs font-normal text-slate-400 ml-1">converted</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Rate: <span className="font-semibold text-slate-700">{myScore.actualValues?.CONVERSION_RATE ?? 0}%</span>
                  </p>
                </Card>

                <Card className="p-4 shadow-xs">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Discipline & Attendance</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {myScore.actualValues?.ATTENDANCE ?? 100}%
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    CRM Discipline: <span className="font-semibold text-slate-700">{myScore.actualValues?.CRM_DISCIPLINE ?? 100}%</span>
                  </p>
                </Card>
              </div>

              {myScore.isFrozen && (
                <Alert tone="info">
                  <div className="space-y-1 text-xs">
                    <div className="font-bold text-slate-800">Performance Review Locked by Management</div>
                    {myScore.reviewNotes && (
                      <div><span className="font-semibold">Review Notes:</span> {myScore.reviewNotes}</div>
                    )}
                    {myScore.coachingActions && (
                      <div><span className="font-semibold">Coaching / Action Plan:</span> {myScore.coachingActions}</div>
                    )}
                  </div>
                </Alert>
              )}

              {/* Targets Breakdown */}
              <Card>
                <CardHeader title={`Personal Target Breakdown — ${period}`} />
                <Table>
                  <THead>
                    <tr>
                      <TH>Metric</TH>
                      <TH>Target</TH>
                      <TH>Actual Achieved</TH>
                      <TH>Achievement %</TH>
                      <TH>Weight</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {Object.keys(myScore.targetValues || {}).length === 0 ? (
                      <tr>
                        <TD colSpan={5} className="py-8 text-center text-sm text-slate-500">
                          No explicit targets set for this period. Standard activity evaluations apply.
                        </TD>
                      </tr>
                    ) : (
                      Object.entries(myScore.targetValues || {}).map(([metric, targetVal]) => {
                        const actual = myScore.actualValues?.[metric] ?? '—';
                        const ach = myScore.achievementPercentages?.[metric] ?? '—';
                        const weight = myScore.weights?.[metric] ?? 1;
                        return (
                          <tr key={metric}>
                            <TD className="font-semibold">{metric.replace(/_/g, ' ')}</TD>
                            <TD>{String(targetVal)}</TD>
                            <TD className="font-medium text-brand-700">{String(actual)}</TD>
                            <TD>
                              <span className={Number(ach) >= 100 ? 'text-emerald-600 font-bold' : 'text-amber-600 font-medium'}>
                                {ach}%
                              </span>
                            </TD>
                            <TD>{weight}x</TD>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM KPI & SCORES (Oversight)                                     */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <Card>
          <CardHeader
            title={`Team Performance Scorecard — ${period}`}
            action={
              <div className="text-xs text-slate-500 font-medium">
                {safeTeamScores.length} employee{safeTeamScores.length === 1 ? '' : 's'} evaluated
              </div>
            }
          />
          {loading && safeTeamScores.length === 0 ? (
            <Spinner label="Computing live performance scores…" />
          ) : safeTeamScores.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 space-y-3">
              <p>No KPI scores evaluated for {period} yet.</p>
              <Button size="sm" onClick={handleCompute} disabled={computing}>
                {computing ? 'Computing…' : 'Compute Live Scores Now'}
              </Button>
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Employee</TH>
                  <TH>Department / Role</TH>
                  <TH>Calls Placed</TH>
                  <TH>Connected</TH>
                  <TH>Conversions</TH>
                  <TH>Conv Rate</TH>
                  <TH>Overall Score</TH>
                  <TH>Rating</TH>
                  <TH>Score State</TH>
                  <TH>Actions</TH>
                </tr>
              </THead>
              <tbody>
                {safeTeamScores.map((row) => (
                  <tr key={row.employee?.id || row.id} className="hover:bg-slate-50">
                    <TD>
                      <Link
                        to={`/hrms/employees/${row.employee?.id}`}
                        className="font-semibold text-slate-900 hover:text-brand-600"
                      >
                        {row.employee?.fullName || '—'}
                      </Link>
                      <div className="text-xs text-slate-400 font-mono">
                        {row.employee?.employeeCode || '—'}
                      </div>
                    </TD>
                    <TD>
                      <div className="text-xs text-slate-700">{row.employee?.department || 'Calling'}</div>
                      <div className="text-[11px] text-slate-400">
                        {row.employee?.designation || row.employee?.role?.name || 'Staff'}
                      </div>
                    </TD>
                    <TD className="font-mono text-xs">{row.actualValues?.CALLS_DIALED ?? 0}</TD>
                    <TD className="font-mono text-xs">{row.actualValues?.CALLS_CONNECTED ?? 0}</TD>
                    <TD className="font-mono text-xs font-semibold text-emerald-700">
                      {row.actualValues?.LEADS_CONVERTED ?? 0}
                    </TD>
                    <TD className="font-mono text-xs">{row.actualValues?.CONVERSION_RATE ?? 0}%</TD>
                    <TD>
                      <span className="font-bold text-slate-900">{row.overallScore ?? '—'}%</span>
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          row.performanceStatus === 'Exceeds Expectations'
                            ? 'green'
                            : row.performanceStatus === 'Meets Expectations'
                            ? 'slate'
                            : 'amber'
                        }
                      >
                        {row.performanceStatus}
                      </Badge>
                    </TD>
                    <TD>
                      {row.isFrozen ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                          Frozen
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <RotateCcw className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                          Live
                        </span>
                      )}
                    </TD>
                    <TD>
                      <Button
                        size="sm"
                        variant={row.isFrozen ? 'outline' : 'primary'}
                        onClick={() => {
                          setFreezeEmployee(row);
                          setFreezeNotes(row.reviewNotes || '');
                          setCoachingActions(row.coachingActions || '');
                        }}
                        className="text-xs"
                      >
                        {row.isFrozen ? 'Review Notes' : 'Freeze & Review'}
                      </Button>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Freeze Score Review Modal */}
      {freezeEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Performance Review — {freezeEmployee.employee?.fullName}
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Period: {period} • Score: {freezeEmployee.overallScore}% ({freezeEmployee.performanceStatus})
            </p>
            <form onSubmit={handleFreeze} className="space-y-4">
              <Field label="Manager Appraisal Notes">
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-brand-600 focus:outline-none"
                  placeholder="Summarize employee contribution, caller conversion efficiency, and field remarks…"
                  value={freezeNotes}
                  onChange={(e) => setFreezeNotes(e.target.value)}
                />
              </Field>
              <Field label="Coaching & Corrective Action Plan">
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-brand-600 focus:outline-none"
                  placeholder="Follow-up training, script improvements, objection handling targets…"
                  value={coachingActions}
                  onChange={(e) => setCoachingActions(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFreezeEmployee(null)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {freezeEmployee.isFrozen ? 'Update Review Notes' : 'Freeze Official Score'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Target Modal */}
      {showTargetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Configure Target</h2>
            <form onSubmit={handleSaveTarget} className="space-y-4">
              <Field label="Period">
                <Input
                  type="month"
                  value={targetForm.period}
                  onChange={(e) => setTargetForm({ ...targetForm, period: e.target.value })}
                />
              </Field>
              <Field label="Metric">
                <Select
                  value={targetForm.metric}
                  onChange={(e) => setTargetForm({ ...targetForm, metric: e.target.value })}
                >
                  <option value="CALLS_DIALED">Calls Dialed</option>
                  <option value="CALLS_CONNECTED">Calls Connected</option>
                  <option value="LEADS_CONVERTED">Leads Converted</option>
                  <option value="CONVERSION_RATE">Conversion Rate (%)</option>
                  <option value="ATTENDANCE">Attendance (%)</option>
                  <option value="CRM_DISCIPLINE">CRM Discipline (%)</option>
                </Select>
              </Field>
              <Field label="Target Value">
                <Input
                  type="number"
                  required
                  value={targetForm.targetValue}
                  onChange={(e) => setTargetForm({ ...targetForm, targetValue: Number(e.target.value) })}
                />
              </Field>
              <Field label="Weight Factor (Multiplier)">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  required
                  value={targetForm.weight}
                  onChange={(e) => setTargetForm({ ...targetForm, weight: Number(e.target.value) })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowTargetModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Target</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
