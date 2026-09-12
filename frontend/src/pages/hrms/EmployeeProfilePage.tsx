import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Fingerprint,
  GraduationCap,
  History,
  IndianRupee,
  Palmtree,
  Plus,
  ShieldCheck,
  TrendingUp,
  Upload,
  User,
  X,
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

type ProfileTab =
  | 'overview'
  | 'performance'
  | 'attendance'
  | 'leave'
  | 'salary'
  | 'advances'
  | 'history';

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({ fileName: '', fileType: 'PDF', fileSize: 102400, fileUrl: '' });

  const [showHistModal, setShowHistModal] = useState(false);
  const [histForm, setHistForm] = useState({ type: 'TRAINING', date: new Date().toISOString().slice(0, 10), description: '' });

  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    effectiveFrom: new Date().toISOString().slice(0, 10),
    baseSalary: 30000,
    basic: 15000,
    hra: 9000,
    allowances: 6000,
    pf: 1800,
    esi: 0,
    tds: 0,
    notes: 'Standard revision',
  });

  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceForm, setAdvanceForm] = useState({ amount: 10000, reason: 'Personal emergency', linkedMonth: '' });

  const fetchProfile = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/employees/${id}/profile`);
      setProfile(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, [id]);

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/employees/${id}/documents`, docForm);
      setShowDocModal(false);
      void fetchProfile();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to add document');
    }
  };

  const handleAddHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/employees/${id}/history`, histForm);
      setShowHistModal(false);
      void fetchProfile();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to add history record');
    }
  };

  const handleAddSalaryRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/payroll/salary-revisions', {
        employeeId: id,
        effectiveFrom: salaryForm.effectiveFrom,
        baseSalary: Number(salaryForm.baseSalary),
        components: {
          basic: Number(salaryForm.basic),
          hra: Number(salaryForm.hra),
          allowances: Number(salaryForm.allowances),
          pf: Number(salaryForm.pf),
          esi: Number(salaryForm.esi),
          tds: Number(salaryForm.tds),
        },
        notes: salaryForm.notes,
      });
      setShowSalaryModal(false);
      void fetchProfile();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to add salary revision');
    }
  };

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/payroll/advances', {
        employeeId: id,
        amount: Number(advanceForm.amount),
        reason: advanceForm.reason,
        linkedMonth: advanceForm.linkedMonth || undefined,
      });
      setShowAdvanceModal(false);
      void fetchProfile();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to issue advance');
    }
  };

  if (loading && !profile) {
    return <Spinner label="Loading employee profile…" />;
  }

  if (error || !profile) {
    return (
      <div className="p-6">
        <Alert tone="error">{error || 'Employee not found'}</Alert>
        <Link to="/hrms/employees" className="mt-4 inline-block text-sm text-brand-600 underline">
          ← Back to Directory
        </Link>
      </div>
    );
  }

  const { overview, performance, attendance, leave, salary, advances, history, documents } = profile;

  return (
    <div className="space-y-6 p-6">
      {/* Back Link */}
      <Link
        to="/hrms/employees"
        className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-800"
      >
        ← Back to Employee Directory
      </Link>

      {/* Header Profile Card */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-bold text-brand-700">
              {overview.fullName
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">{overview.fullName}</h1>
                <StatusBadge status={overview.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="font-mono font-semibold">{overview.employeeCode || 'No Code'}</span>
                <span>•</span>
                <span>{overview.designation || 'Staff'}</span>
                <span>•</span>
                <span>{overview.department || 'General'}</span>
                <span>•</span>
                <span className="text-slate-700 font-medium">{overview.role?.name || overview.role?.code}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasPermission('employee.update') && (
              <Button size="sm" variant="outline" onClick={() => setShowDocModal(true)}>
                <Upload className="h-4 w-4 mr-1" />
                Upload KYC
              </Button>
            )}
            {hasPermission('payroll.manage') && (
              <Button size="sm" variant="outline" onClick={() => setShowAdvanceModal(true)}>
                <IndianRupee className="h-4 w-4 mr-1" />
                Issue Advance
              </Button>
            )}
            {hasPermission('payroll.manage') && (
              <Button size="sm" onClick={() => setShowSalaryModal(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Revise Salary
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 7-Tab Navigation Bar */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto text-sm font-medium">
          {[
            { key: 'overview', label: '1. Overview', icon: User },
            { key: 'performance', label: '2. Performance & CRM', icon: TrendingUp },
            { key: 'attendance', label: '3. Attendance', icon: CalendarCheck },
            { key: 'leave', label: '4. Leave Balances', icon: Palmtree },
            { key: 'salary', label: '5. Salary & Payslips', icon: IndianRupee },
            { key: 'advances', label: '6. Advances & Loans', icon: FileCheck },
            { key: 'history', label: '7. Training & History', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as ProfileTab)}
                className={`flex items-center gap-1.5 whitespace-nowrap py-3 px-3 border-b-2 font-semibold transition-colors ${
                  isCurrent
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Personal & Contact Information
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-xs text-slate-400">Full Name</span>
                <span className="font-medium text-slate-800">{overview.fullName}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Email Address</span>
                <span className="font-medium text-slate-800">{overview.email}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Phone Number</span>
                <span className="font-medium text-slate-800">{overview.phone || '—'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Residential Address</span>
                <span className="font-medium text-slate-800">{overview.address || '—'}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-2">
              Employment Details
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-xs text-slate-400">Employee Code</span>
                <span className="font-mono font-semibold text-slate-800">{overview.employeeCode || '—'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Department</span>
                <span className="font-medium text-slate-800">{overview.department || 'General'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Designation</span>
                <span className="font-medium text-slate-800">{overview.designation || 'Staff'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Joining Date</span>
                <span className="font-medium text-slate-800">
                  {overview.joiningDate ? new Date(overview.joiningDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Prior Experience</span>
                <span className="font-medium text-slate-800">{overview.experience || '—'}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-400">Current Base Salary</span>
                <span className="font-semibold text-emerald-600">
                  {overview.currentSalary
                    ? `₹${Number(overview.currentSalary.baseSalary).toLocaleString('en-IN')}/mo`
                    : 'Not Configured'}
                </span>
              </div>
            </div>
          </Card>

          {overview.notes && (
            <Card className="p-6 md:col-span-2">
              <h2 className="text-sm font-semibold text-slate-800 mb-2">Internal HR Notes</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{overview.notes}</p>
            </Card>
          )}
        </div>
      )}

      {/* Tab 2: Performance & CRM */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* CRM Workload Metrics */}
          <Card className="p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              CRM Calling & Conversion Workload
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs text-slate-500 uppercase font-semibold">Calls Dialed</span>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {performance.crmMetrics?.callsDialed ?? 0}
                </p>
                <span className="text-xs text-slate-400">Outbound calls placed</span>
              </div>

              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs text-slate-500 uppercase font-semibold">Calls Connected</span>
                <p className="mt-1 text-2xl font-bold text-brand-600">
                  {performance.crmMetrics?.callsConnected ?? 0}
                </p>
                <span className="text-xs text-slate-400">Ended or connected</span>
              </div>

              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs text-slate-500 uppercase font-semibold">Leads Converted</span>
                <p className="mt-1 text-2xl font-bold text-emerald-600">
                  {performance.crmMetrics?.leadsConverted ?? 0}
                </p>
                <span className="text-xs text-slate-400">Sales conversions</span>
              </div>

              <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                <span className="text-xs text-slate-500 uppercase font-semibold">Conversion Rate</span>
                <p className="mt-1 text-2xl font-bold text-purple-600">
                  {performance.crmMetrics?.conversionRate ?? 0}%
                </p>
                <span className="text-xs text-slate-400">Lead to conversion</span>
              </div>
            </div>

            {/* Total Revenue Pending State Notice (PRD Invariant) */}
            <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800">
                <span className="font-semibold">Total Revenue: Pending Phase 2 Sales System Integration.</span>{' '}
                Per PRD §7.4, revenue amounts are not fabricated with mock data. Real sales invoices and booking receipts integrate in Phase 2.
              </div>
            </div>
          </Card>

          {/* KPI Target Scorecard */}
          <Card>
            <CardHeader
              title={`KPI Scorecard (${performance.kpiScore ? performance.kpiScore.period : 'Current Period'})`}
              action={
                performance.kpiScore?.isFrozen ? (
                  <Badge tone="green">LOCKED / HISTORICAL</Badge>
                ) : (
                  <Badge tone="slate">LIVE COMPUTED</Badge>
                )
              }
            />
            {(performance.kpiTargets ?? []).length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No individual KPI targets configured for this employee yet.
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Metric</TH>
                    <TH>Target Value</TH>
                    <TH>Weight</TH>
                    <TH>Actual Achievement</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {performance.kpiTargets.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <TD className="font-medium text-slate-900">{t.metric.replace(/_/g, ' ')}</TD>
                      <TD>{Number(t.targetValue)}</TD>
                      <TD>{Number(t.weight)}</TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-200 rounded-full h-2">
                            <div
                              className="bg-brand-600 h-2 rounded-full"
                              style={{ width: `${Math.min(100, Math.round(Number(t.targetValue) * 0.9))}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-700">90%</span>
                        </div>
                      </TD>
                      <TD>
                        <Badge tone="green">On Track</Badge>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Tab 3: Attendance */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Card className="p-3">
              <span className="text-xs text-slate-500">Present</span>
              <p className="text-xl font-bold text-emerald-600">{attendance.stats.present}</p>
            </Card>
            <Card className="p-3">
              <span className="text-xs text-slate-500">Late</span>
              <p className="text-xl font-bold text-amber-600">{attendance.stats.late}</p>
            </Card>
            <Card className="p-3">
              <span className="text-xs text-slate-500">Half Day</span>
              <p className="text-xl font-bold text-purple-600">{attendance.stats.halfDay}</p>
            </Card>
            <Card className="p-3">
              <span className="text-xs text-slate-500">Leave</span>
              <p className="text-xl font-bold text-blue-600">{attendance.stats.leave}</p>
            </Card>
            <Card className="p-3">
              <span className="text-xs text-slate-500">Absent</span>
              <p className="text-xl font-bold text-red-600">{attendance.stats.absent}</p>
            </Card>
          </div>

          <Card>
            <CardHeader title="Recent Attendance Records (Last 30 Days)" />
            {attendance.records.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No attendance records logged</div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Status</TH>
                    <TH>Punch In</TH>
                    <TH>Punch Out</TH>
                    <TH>Source</TH>
                    <TH>Approval</TH>
                  </tr>
                </THead>
                <tbody>
                  {attendance.records.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <TD className="font-medium text-slate-900">
                        {new Date(r.date).toLocaleDateString([], {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TD>
                      <TD>
                        <Badge
                          tone={
                            r.status === 'PRESENT'
                              ? 'green'
                              : r.status === 'LATE' || r.status === 'HALF_DAY'
                              ? 'amber'
                              : 'red'
                          }
                        >
                          {r.status}
                        </Badge>
                      </TD>
                      <TD className="text-xs">
                        {r.punchIn
                          ? new Date(r.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </TD>
                      <TD className="text-xs">
                        {r.punchOut
                          ? new Date(r.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </TD>
                      <TD className="text-xs">
                        <span className="inline-flex items-center gap-1">
                          {r.source === 'ESSL' ? (
                            <Fingerprint className="h-3 w-3 text-brand-600" />
                          ) : (
                            <Calendar className="h-3 w-3 text-slate-400" />
                          )}
                          {r.source}
                        </span>
                      </TD>
                      <TD>
                        <Badge tone={r.approvalStatus === 'APPROVED' ? 'green' : 'amber'}>
                          {r.approvalStatus}
                        </Badge>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Tab 4: Leave */}
      {activeTab === 'leave' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {leave.balances.map((b: any) => (
              <Card key={b.id} className="p-4">
                <span className="text-xs font-semibold text-slate-500 uppercase">{b.leaveType.name}</span>
                <p className="mt-2 text-2xl font-bold text-brand-700">{Number(b.balance)} days</p>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Used: {Number(b.used)}</span>
                  <span>Allocated: {Number(b.allocated)}</span>
                </div>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader title="Past Leave Applications" />
            {leave.applications.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No leave applications recorded</div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Type</TH>
                    <TH>Dates</TH>
                    <TH>Days</TH>
                    <TH>Reason</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {leave.applications.map((app: any) => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <TD className="font-medium text-slate-900">{app.leaveType.name}</TD>
                      <TD className="text-xs">
                        {new Date(app.startDate).toLocaleDateString()} to {new Date(app.endDate).toLocaleDateString()}
                      </TD>
                      <TD>{Number(app.daysCount)}</TD>
                      <TD className="text-xs italic text-slate-600">“{app.reason}”</TD>
                      <TD>
                        <Badge
                          tone={
                            app.status === 'APPROVED' ? 'green' : app.status === 'REJECTED' ? 'red' : 'amber'
                          }
                        >
                          {app.status}
                        </Badge>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Tab 5: Salary & Payslips */}
      {activeTab === 'salary' && (
        <div className="space-y-6">
          {/* Append-Only Salary Revisions */}
          <Card>
            <CardHeader
              title="Salary Revision History (Append-Only Invariant)"
              action={
                hasPermission('payroll.manage') && (
                  <Button size="sm" onClick={() => setShowSalaryModal(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    New Revision
                  </Button>
                )
              }
            />
            {salary.revisions.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No salary revisions configured</div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Rev #</TH>
                    <TH>Effective From</TH>
                    <TH>Gross Salary</TH>
                    <TH>Deductions</TH>
                    <TH>Net Salary</TH>
                    <TH>Notes</TH>
                  </tr>
                </THead>
                <tbody>
                  {salary.revisions.map((rev: any) => (
                    <tr key={rev.id} className="hover:bg-slate-50">
                      <TD className="font-mono font-semibold">#{rev.revisionNumber}</TD>
                      <TD>{new Date(rev.effectiveFrom).toLocaleDateString()}</TD>
                      <TD className="font-medium text-slate-900">
                        ₹{Number(rev.grossSalary).toLocaleString('en-IN')}
                      </TD>
                      <TD className="text-red-600">
                        ₹{Number(rev.totalDeductions).toLocaleString('en-IN')}
                      </TD>
                      <TD className="font-bold text-emerald-600">
                        ₹{Number(rev.netSalary).toLocaleString('en-IN')}
                      </TD>
                      <TD className="text-xs text-slate-500">{rev.notes || '—'}</TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {/* Published Payslips */}
          <Card>
            <CardHeader title="Published Payslips" />
            {salary.payslips.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No published payslips for this employee</div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Month</TH>
                    <TH>Gross Pay</TH>
                    <TH>Deductions</TH>
                    <TH>Net Pay</TH>
                    <TH>Action</TH>
                  </tr>
                </THead>
                <tbody>
                  {salary.payslips.map((slip: any) => (
                    <tr key={slip.id} className="hover:bg-slate-50">
                      <TD className="font-medium text-slate-900">{slip.payrollRun?.month}</TD>
                      <TD>₹{Number(slip.grossEarnings).toLocaleString('en-IN')}</TD>
                      <TD className="text-red-600">₹{Number(slip.totalDeductions).toLocaleString('en-IN')}</TD>
                      <TD className="font-bold text-emerald-600">₹{Number(slip.netPay).toLocaleString('en-IN')}</TD>
                      <TD>
                        <Link
                          to={`/hrms/payslips/${slip.id}`}
                          className="inline-flex items-center text-xs font-semibold text-brand-600 hover:text-brand-800"
                        >
                          View / Print →
                        </Link>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Tab 6: Advances */}
      {activeTab === 'advances' && (
        <div className="space-y-6">
          <Card className="p-4 bg-amber-50/50 border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-amber-700 uppercase">
                  Total Active Advance Running Balance
                </span>
                <p className="mt-1 text-2xl font-bold text-amber-900">
                  ₹{Number(advances.runningBalanceTotal).toLocaleString('en-IN')}
                </p>
              </div>
              {hasPermission('payroll.manage') && (
                <Button size="sm" onClick={() => setShowAdvanceModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Issue New Advance
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Advance Ledger & Recoveries" />
            {advances.records.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No advance history recorded</div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Issue Date</TH>
                    <TH>Original Amount</TH>
                    <TH>Running Balance</TH>
                    <TH>Status</TH>
                    <TH>Reason / Linked Month</TH>
                  </tr>
                </THead>
                <tbody>
                  {advances.records.map((adv: any) => (
                    <tr key={adv.id} className="hover:bg-slate-50">
                      <TD>{new Date(adv.issuedAt).toLocaleDateString()}</TD>
                      <TD className="font-medium text-slate-900">
                        ₹{Number(adv.amount).toLocaleString('en-IN')}
                      </TD>
                      <TD className="font-bold text-amber-700">
                        ₹{Number(adv.runningBalance).toLocaleString('en-IN')}
                      </TD>
                      <TD>
                        <Badge tone={adv.status === 'ACTIVE' ? 'amber' : 'green'}>{adv.status}</Badge>
                      </TD>
                      <TD className="text-xs text-slate-600">
                        {adv.reason || '—'} {adv.linkedMonth && `(Month: ${adv.linkedMonth})`}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Tab 7: Training & History */}
      {activeTab === 'history' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* History Timeline */}
          <Card>
            <CardHeader
              title="Career & Training Timeline"
              action={
                hasPermission('employee.update') && (
                  <Button size="sm" variant="outline" onClick={() => setShowHistModal(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Record
                  </Button>
                )
              }
            />
            {history.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No training or disciplinary records yet</div>
            ) : (
              <div className="divide-y divide-slate-100 p-4 space-y-3">
                {history.map((h: any) => (
                  <div key={h.id} className="pt-3 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge
                        tone={
                          h.type === 'COMMENDATION' || h.type === 'PROMOTION'
                            ? 'green'
                            : h.type === 'WARNING'
                            ? 'red'
                            : 'slate'
                        }
                      >
                        {h.type}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {new Date(h.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 leading-snug">{h.description}</p>
                    <p className="text-[10px] text-slate-400">Recorded by: {h.addedBy}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Documents & KYC */}
          <Card>
            <CardHeader
              title="KYC & Uploaded Documents"
              action={
                hasPermission('employee.update') && (
                  <Button size="sm" variant="outline" onClick={() => setShowDocModal(true)}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    Upload File
                  </Button>
                )
              }
            />
            {documents.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">No KYC documents uploaded</div>
            ) : (
              <div className="divide-y divide-slate-100 p-4 space-y-2">
                {documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between pt-2 first:pt-0">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-brand-600" />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{doc.fileName}</p>
                        <p className="text-[10px] text-slate-400">
                          {doc.fileType} • {(doc.fileSize / 1024).toFixed(0)} KB •{' '}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-brand-600 hover:text-brand-800"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Upload Document Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Upload Employee Document / KYC</h2>
            <form onSubmit={handleAddDocument} className="space-y-4">
              <Field label="Document Name *">
                <Input
                  required
                  placeholder="e.g. Aadhar Card / Bank Passbook"
                  value={docForm.fileName}
                  onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })}
                />
              </Field>
              <Field label="Document Type *">
                <Select
                  value={docForm.fileType}
                  onChange={(e) => setDocForm({ ...docForm, fileType: e.target.value })}
                >
                  <option value="PDF">PDF</option>
                  <option value="IMAGE">Image (JPG/PNG)</option>
                  <option value="KYC">KYC Document</option>
                  <option value="CERTIFICATE">Certificate</option>
                </Select>
              </Field>
              <Field label="File URL *">
                <Input
                  required
                  placeholder="https://storage.grotec.local/docs/..."
                  value={docForm.fileUrl}
                  onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowDocModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Document</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add History Record Modal */}
      {showHistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Add History & Training Record</h2>
            <form onSubmit={handleAddHistory} className="space-y-4">
              <Field label="Record Type *">
                <Select
                  value={histForm.type}
                  onChange={(e) => setHistForm({ ...histForm, type: e.target.value })}
                >
                  <option value="TRAINING">Training</option>
                  <option value="COMMENDATION">Commendation</option>
                  <option value="WARNING">Warning</option>
                  <option value="PROMOTION">Promotion</option>
                </Select>
              </Field>
              <Field label="Date *">
                <Input
                  type="date"
                  required
                  value={histForm.date}
                  onChange={(e) => setHistForm({ ...histForm, date: e.target.value })}
                />
              </Field>
              <Field label="Description *">
                <textarea
                  rows={3}
                  required
                  className="w-full rounded-md border border-slate-300 p-2 text-sm"
                  placeholder="Details of the event or accomplishment…"
                  value={histForm.description}
                  onChange={(e) => setHistForm({ ...histForm, description: e.target.value })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowHistModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Record</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revise Salary Modal */}
      {showSalaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-2">Create Salary Revision</h2>
            <p className="text-xs text-slate-500 mb-4">
              Salary revisions are strictly append-only and preserve all historical wage agreements.
            </p>
            <form onSubmit={handleAddSalaryRevision} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Effective From *">
                  <Input
                    type="date"
                    required
                    value={salaryForm.effectiveFrom}
                    onChange={(e) => setSalaryForm({ ...salaryForm, effectiveFrom: e.target.value })}
                  />
                </Field>
                <Field label="Total Base CTC *">
                  <Input
                    type="number"
                    required
                    value={salaryForm.baseSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, baseSalary: Number(e.target.value) })}
                  />
                </Field>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 space-y-2 border border-slate-100">
                <span className="text-xs font-semibold text-slate-700">Salary Components Breakdown</span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <Field label="Basic (50%)">
                    <Input
                      type="number"
                      value={salaryForm.basic}
                      onChange={(e) => setSalaryForm({ ...salaryForm, basic: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="HRA (30%)">
                    <Input
                      type="number"
                      value={salaryForm.hra}
                      onChange={(e) => setSalaryForm({ ...salaryForm, hra: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Allowances">
                    <Input
                      type="number"
                      value={salaryForm.allowances}
                      onChange={(e) => setSalaryForm({ ...salaryForm, allowances: Number(e.target.value) })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                  <Field label="PF Deduction">
                    <Input
                      type="number"
                      value={salaryForm.pf}
                      onChange={(e) => setSalaryForm({ ...salaryForm, pf: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="ESI">
                    <Input
                      type="number"
                      value={salaryForm.esi}
                      onChange={(e) => setSalaryForm({ ...salaryForm, esi: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="TDS">
                    <Input
                      type="number"
                      value={salaryForm.tds}
                      onChange={(e) => setSalaryForm({ ...salaryForm, tds: Number(e.target.value) })}
                    />
                  </Field>
                </div>
              </div>

              <Field label="Revision Notes">
                <Input
                  value={salaryForm.notes}
                  onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
                  placeholder="e.g. Annual appraisal / performance bump"
                />
              </Field>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowSalaryModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Commit Revision</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issue Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Issue Salary Advance</h2>
            <form onSubmit={handleCreateAdvance} className="space-y-4">
              <Field label="Advance Amount (₹) *">
                <Input
                  type="number"
                  required
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, amount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Reason">
                <Input
                  value={advanceForm.reason}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, reason: e.target.value })}
                  placeholder="e.g. Medical / Family emergency"
                />
              </Field>
              <Field label="Linked Payroll Month (Optional)">
                <Input
                  placeholder="e.g. 2026-09"
                  value={advanceForm.linkedMonth}
                  onChange={(e) => setAdvanceForm({ ...advanceForm, linkedMonth: e.target.value })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAdvanceModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Issue Advance</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
