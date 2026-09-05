import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
} from '../../components/ui';

export function KpiPage() {
  const { user, hasPermission } = useAuth();
  const isManager = hasPermission('kpi.manage');
  const currentPeriodStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [period, setPeriod] = useState(currentPeriodStr);
  const [teamScores, setTeamScores] = useState<any[]>([]);
  const [myScore, setMyScore] = useState<any>(null);
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isManager) {
        const [teamRes, targetsRes] = await Promise.all([
          api.get(`/kpi/team-summary/${period}`),
          api.get('/kpi/targets', { params: { period } }),
        ]);
        setTeamScores(teamRes.data || []);
        setTargets(targetsRes.data || []);
      } else if (user?.id) {
        const [scoreRes, targetsRes] = await Promise.all([
          api.get(`/kpi/scores/${user.id}/${period}`),
          api.get('/kpi/targets', { params: { period } }),
        ]);
        setMyScore(scoreRes.data || null);
        setTargets(targetsRes.data || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load KPI metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [period]);

  const handleFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeEmployee) return;
    try {
      await api.post(`/kpi/freeze/${freezeEmployee.employee.id}/${period}`, {
        reviewNotes: freezeNotes,
        coachingActions,
      });
      setFreezeEmployee(null);
      void fetchData();
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
      void fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save target');
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isManager ? 'CRM-to-HRMS Performance & KPIs' : 'My Performance Scorecard'}
          </h1>
          <p className="text-sm text-slate-500">
            {isManager
              ? 'Live telecaller calling activity, conversion rates, weighted scorecard evaluations, and period score freezing.'
              : 'Your monthly KPI achievement, calling metrics, conversion rate, and evaluation status.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button onClick={() => setShowTargetModal(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Configure Target
            </Button>
          )}
        </div>
      </div>

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

        {/* PRD Data Invariant Notice */}
        <div className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-md">
          <ShieldCheck className="h-4 w-4 text-brand-600" />
          <span>Historical score immutability enforced upon freezing per PRD §7.4.2</span>
        </div>
      </div>

      {/* Manager View: Team Performance Table */}
      {isManager && (
        <Card>
          <CardHeader
            title={`Team Performance Scorecard — ${period}`}
          />
          {loading && teamScores.length === 0 ? (
            <Spinner label="Computing live performance scores…" />
          ) : teamScores.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No active employees found</div>
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
                {teamScores.map((row) => (
                  <tr key={row.employee.id} className="hover:bg-slate-50">
                    <TD>
                      <Link
                        to={`/hrms/employees/${row.employee.id}`}
                        className="font-semibold text-slate-900 hover:text-brand-600"
                      >
                        {row.employee.fullName}
                      </Link>
                      <div className="text-xs text-slate-400 font-mono">
                        {row.employee.employeeCode || '—'}
                      </div>
                    </TD>
                    <TD>
                      <div className="text-xs text-slate-700">{row.employee.department || 'Calling'}</div>
                      <div className="text-[11px] text-slate-400">{row.employee.role?.name}</div>
                    </TD>
                    <TD className="font-semibold">{row.actuals?.CALLS_DIALED ?? 0}</TD>
                    <TD className="text-brand-600 font-medium">{row.actuals?.CALLS_CONNECTED ?? 0}</TD>
                    <TD className="text-emerald-600 font-bold">{row.actuals?.LEADS_CONVERTED ?? 0}</TD>
                    <TD className="font-medium">{row.actuals?.CONVERSION_RATE ?? 0}%</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{row.overallScore}%</span>
                        <div className="w-16 bg-slate-200 rounded-full h-1.5">
                          <div
                            className="bg-brand-600 h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, row.overallScore)}%` }}
                          />
                        </div>
                      </div>
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
                      <Badge tone={row.isFrozen ? 'slate' : 'green'}>
                        {row.isFrozen ? 'Locked (Frozen)' : 'Live Computed'}
                      </Badge>
                    </TD>
                    <TD>
                      {!row.isFrozen ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFreezeEmployee(row);
                            setFreezeNotes('Performance review conducted for the month.');
                            setCoachingActions('Focus on calling cadence and script discipline.');
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          Freeze Score
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-400">Immutable</span>
                      )}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Non-Manager Personal Scorecard */}
      {!isManager && (
        <div className="space-y-6">
          {loading && !myScore ? (
            <Spinner label="Computing your personal performance score…" />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Performance</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">{myScore?.overallScore ?? '—'}%</span>
                    {myScore && (
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
                    )}
                  </div>
                  <div className="mt-2 w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="bg-brand-600 h-2 rounded-full"
                      style={{ width: `${Math.min(100, myScore?.overallScore ?? 0)}%` }}
                    />
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Calling Activity</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {myScore?.actualValues?.CALLS_DIALED ?? 0}
                    <span className="text-xs font-normal text-slate-400 ml-1">dialed</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Connected: <span className="font-semibold text-brand-600">{myScore?.actualValues?.CALLS_CONNECTED ?? 0}</span>
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Conversion & Leads</div>
                  <div className="mt-2 text-2xl font-bold text-emerald-600">
                    {myScore?.actualValues?.LEADS_CONVERTED ?? 0}
                    <span className="text-xs font-normal text-slate-400 ml-1">converted</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Rate: <span className="font-semibold text-slate-700">{myScore?.actualValues?.CONVERSION_RATE ?? 0}%</span>
                  </p>
                </Card>

                <Card className="p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Discipline & Attendance</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {myScore?.actualValues?.ATTENDANCE ?? 100}%
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    CRM Discipline: <span className="font-semibold text-slate-700">{myScore?.actualValues?.CRM_DISCIPLINE ?? 100}%</span>
                  </p>
                </Card>
              </div>

              {myScore?.isFrozen && (
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
                    {Object.keys(myScore?.targetValues || {}).length === 0 ? (
                      <tr>
                        <TD colSpan={5} className="py-8 text-center text-sm text-slate-500">
                          No explicit targets set for this period. Standard activity evaluations apply.
                        </TD>
                      </tr>
                    ) : (
                      Object.entries(myScore?.targetValues || {}).map(([metric, targetVal]) => {
                        const actual = myScore?.actualValues?.[metric] ?? '—';
                        const ach = myScore?.achievementPercentages?.[metric] ?? '—';
                        const weight = myScore?.weights?.[metric] ?? 1;
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

      {/* Freeze Score Review Modal */}
      {freezeEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Freeze KPI Score — {freezeEmployee.employee.fullName} ({period})
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Once frozen, this period's achievement percentages and overall score become permanently immutable.
            </p>
            <form onSubmit={handleFreeze} className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-xs border border-slate-200">
                <span className="font-semibold text-slate-700">Computed Score: </span>
                <span className="font-bold text-brand-700 text-sm">{freezeEmployee.overallScore}%</span>{' '}
                ({freezeEmployee.performanceStatus})
              </div>
              <Field label="Manager Review Notes">
                <textarea
                  rows={3}
                  required
                  className="w-full rounded-md border border-slate-300 p-2 text-sm"
                  value={freezeNotes}
                  onChange={(e) => setFreezeNotes(e.target.value)}
                />
              </Field>
              <Field label="Coaching & Corrective Actions">
                <textarea
                  rows={2}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm"
                  value={coachingActions}
                  onChange={(e) => setCoachingActions(e.target.value)}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setFreezeEmployee(null)}>
                  Cancel
                </Button>
                <Button type="submit">Lock & Freeze Score</Button>
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
              <Field label="Target Period *">
                <Input
                  type="month"
                  required
                  value={targetForm.period}
                  onChange={(e) => setTargetForm({ ...targetForm, period: e.target.value })}
                />
              </Field>
              <Field label="Target Metric *">
                <Select
                  value={targetForm.metric}
                  onChange={(e) => setTargetForm({ ...targetForm, metric: e.target.value })}
                >
                  <option value="CALLS_DIALED">Calls Dialed</option>
                  <option value="CALLS_CONNECTED">Calls Connected</option>
                  <option value="LEADS_CONVERTED">Leads Converted</option>
                  <option value="CONVERSION_RATE">Conversion Rate (%)</option>
                  <option value="ATTENDANCE">Attendance Discipline (%)</option>
                  <option value="CRM_DISCIPLINE">Follow-Up Completion (%)</option>
                </Select>
              </Field>
              <Field label="Target Value *">
                <Input
                  type="number"
                  required
                  value={targetForm.targetValue}
                  onChange={(e) => setTargetForm({ ...targetForm, targetValue: Number(e.target.value) })}
                />
              </Field>
              <Field label="Evaluation Weight">
                <Input
                  type="number"
                  step="0.1"
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
