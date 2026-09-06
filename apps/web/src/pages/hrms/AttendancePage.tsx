import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Fingerprint,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ConfirmModal,
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

export function AttendancePage() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Role permissions
  const isFounder = user?.roleCode === 'FOUNDER';
  const canMy = !isFounder && hasPermission('attendance.read');
  const canTeam = hasPermission('attendance.approve') || hasPermission('hrms.attendance.manage');

  // Active tab state: if user cannot see My (Founder), force 'team'.
  // If user cannot see Team (Agent/Staff), force 'my'.
  // If user has both (Manager), use search param 'tab' (defaults to 'my').
  const paramTab = searchParams.get('tab');
  const activeTab: 'my' | 'team' = !canMy ? 'team' : (!canTeam ? 'my' : (paramTab === 'team' ? 'team' : 'my'));

  const setActiveTab = (tab: 'my' | 'team') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Common filters
  const [month, setMonth] = useState(currentMonthStr);
  const [statusFilter, setStatusFilter] = useState('');

  // Team-only filters
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [rejectAttendanceId, setRejectAttendanceId] = useState<string | null>(null);

  // My Attendance state
  const [myRecords, setMyRecords] = useState<any[]>([]);
  const [mySummary, setMySummary] = useState<any>(null);

  // Team Attendance state
  const [teamRecords, setTeamRecords] = useState<any[]>([]);
  const [teamSummary, setTeamSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showMyMarkModal, setShowMyMarkModal] = useState(false);
  const [myMarkForm, setMyMarkForm] = useState({
    date: todayStr,
    status: 'PRESENT',
    punchIn: `${todayStr}T09:15:00.000Z`,
    punchOut: `${todayStr}T18:30:00.000Z`,
    notes: '',
  });

  const [showTeamMarkModal, setShowTeamMarkModal] = useState(false);
  const [teamMarkForm, setTeamMarkForm] = useState({
    employeeId: '',
    date: todayStr,
    status: 'PRESENT',
    punchIn: `${todayStr}T09:15:00.000Z`,
    punchOut: `${todayStr}T18:30:00.000Z`,
    notes: '',
  });

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDate, setBulkDate] = useState(todayStr);
  const [bulkRows, setBulkRows] = useState<any[]>([]);

  const [syncingEssl, setSyncingEssl] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Fetch My Attendance data
  const fetchMyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, sumRes] = await Promise.all([
        api.get('/attendance/my', {
          params: { month, status: statusFilter || undefined, pageSize: 100 },
        }),
        api.get('/attendance/my/summary', {
          params: { month },
        }),
      ]);
      setMyRecords(recRes.data.items || []);
      setMySummary(sumRes.data || null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load your attendance data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Team Attendance data
  const fetchTeamData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, sumRes, empRes] = await Promise.all([
        api.get('/attendance', {
          params: {
            month,
            employeeId: employeeFilter || undefined,
            status: statusFilter || undefined,
            pageSize: 100,
          },
        }),
        api.get('/attendance/summary', {
          params: { month, employeeId: employeeFilter || undefined },
        }),
        api.get('/attendance/roster').catch(() => ({ data: { items: [] } })),
      ]);
      setTeamRecords(recRes.data.items || []);
      setTeamSummary(sumRes.data || null);
      setEmployees((empRes.data.items || []).filter((e: any) => e.role?.code !== 'FOUNDER'));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load team attendance data');
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
  }, [activeTab, month, statusFilter, employeeFilter]);

  // Handle self mark attendance
  const handleMyMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/attendance/my/mark', myMarkForm);
      setShowMyMarkModal(false);
      void fetchMyData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to mark attendance');
    }
  };

  // Handle team manager mark
  const handleTeamMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/attendance/mark', teamMarkForm);
      setShowTeamMarkModal(false);
      void fetchTeamData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to record attendance');
    }
  };

  const handleOpenBulkModal = () => {
    const rows = employees.map((emp) => ({
      employeeId: emp.id,
      fullName: emp.fullName,
      employeeCode: emp.employeeCode,
      status: 'PRESENT',
      notes: '',
    }));
    setBulkRows(rows);
    setShowBulkModal(true);
  };

  const handleSaveBulk = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/attendance/bulk', {
        date: bulkDate,
        records: bulkRows.map((r) => ({
          employeeId: r.employeeId,
          status: r.status,
          notes: r.notes || undefined,
        })),
      });
      setShowBulkModal(false);
      void fetchTeamData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save bulk attendance');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/attendance/${id}/approve`);
      void fetchTeamData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Approval failed');
    }
  };

  const handleReject = (id: string) => {
    setRejectAttendanceId(id);
  };

  const handleSyncEssl = async () => {
    setSyncingEssl(true);
    setSyncResult(null);
    try {
      const res = await api.post('/attendance/essl/sync', { date: todayStr });
      setSyncResult(`ESSL sync completed: ${res.data.recordsSynced} records updated from biometric feeds.`);
      if (activeTab === 'team') void fetchTeamData();
      else void fetchMyData();
    } catch (err: any) {
      setSyncResult(err.response?.data?.error?.message || 'Biometric sync failed');
    } finally {
      setSyncingEssl(false);
    }
  };

  // Find today's record for self punch card
  const todayRecord = myRecords.find((r) => {
    const d = new Date(r.date).toISOString().slice(0, 10);
    return d === todayStr;
  });

  const pendingTeamCount = teamRecords.filter((r) => r.approvalStatus === 'PENDING').length;

  return (
    <div className="space-y-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {activeTab === 'my' ? 'My Attendance' : 'Team Attendance & Biometrics'}
          </h1>
          <p className="text-sm text-slate-500">
            {activeTab === 'my'
              ? 'Log your daily check-in, review personal punch history, and track monthly attendance status.'
              : 'Biometric punches from ESSL devices, attendance roster, bulk mark, and approval queue.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'my' && (
            <Button size="sm" onClick={() => setShowMyMarkModal(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Mark Attendance
            </Button>
          )}

          {activeTab === 'team' && (
            <>
              {hasPermission('attendance.approve') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncEssl}
                  disabled={syncingEssl}
                  className="gap-1.5"
                >
                  <Fingerprint className="h-4 w-4 text-brand-600" />
                  {syncingEssl ? 'Syncing…' : 'Sync ESSL Device'}
                </Button>
              )}
              {hasPermission('attendance.mark') && employees.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleOpenBulkModal} className="gap-1.5">
                  <Users className="h-4 w-4" />
                  Bulk Attendance
                </Button>
              )}
              {hasPermission('attendance.mark') && (
                <Button size="sm" onClick={() => setShowTeamMarkModal(true)} className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Mark for Employee
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dual Tab Mode Switcher (Manager / Admin with both roles) */}
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
            <Clock className="h-4 w-4" />
            My Attendance
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
            Team Attendance & Approvals
            {pendingTeamCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {pendingTeamCount}
              </span>
            )}
          </button>
        </div>
      )}

      {syncResult && (
        <Alert tone="info">
          <div className="flex items-center justify-between">
            <span>{syncResult}</span>
            <button onClick={() => setSyncResult(null)} className="text-slate-500 hover:text-slate-700">
              ✕
            </button>
          </div>
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {/* ========================================================================= */}
      {/* TAB 1: MY ATTENDANCE (Self-Service)                                      */}
      {/* ========================================================================= */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {/* Today's Punch Card */}
          <Card className="border-l-4 border-l-brand-600 p-5 bg-white shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Today&apos;s Punch Status — {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                <div className="mt-2 flex items-center gap-3">
                  {todayRecord ? (
                    <>
                      <Badge
                        tone={
                          todayRecord.status === 'PRESENT'
                            ? 'green'
                            : todayRecord.status === 'LATE' || todayRecord.status === 'HALF_DAY'
                            ? 'amber'
                            : 'red'
                        }
                      >
                        {todayRecord.status}
                      </Badge>
                      <span className="text-sm font-medium text-slate-700">
                        In:{' '}
                        <strong className="font-mono text-slate-900">
                          {todayRecord.punchIn
                            ? new Date(todayRecord.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </strong>
                        {' '}| Out:{' '}
                        <strong className="font-mono text-slate-900">
                          {todayRecord.punchOut
                            ? new Date(todayRecord.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </strong>
                      </span>
                      <Badge
                        tone={
                          todayRecord.approvalStatus === 'APPROVED'
                            ? 'green'
                            : todayRecord.approvalStatus === 'REJECTED'
                            ? 'red'
                            : 'amber'
                        }
                      >
                        {todayRecord.approvalStatus === 'PENDING' ? 'Pending Approval' : todayRecord.approvalStatus}
                      </Badge>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300"></span>
                      <span className="text-sm font-semibold text-slate-600">Not recorded yet for today</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Button
                  size="sm"
                  onClick={() => setShowMyMarkModal(true)}
                  className="gap-1.5 shadow-xs font-semibold"
                >
                  <Clock className="h-4 w-4" />
                  {todayRecord ? 'Update Today’s Mark' : 'Punch In / Mark Today'}
                </Button>
              </div>
            </div>
          </Card>

          {/* My Summary KPI Cards */}
          {mySummary && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Present</span>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{mySummary.present}</p>
                <span className="text-xs text-slate-400">Full day shifts</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Late Check-in</span>
                <p className="mt-1 text-2xl font-bold text-amber-600">{mySummary.late}</p>
                <span className="text-xs text-slate-400">Punched after 09:30</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Half Day</span>
                <p className="mt-1 text-2xl font-bold text-purple-600">{mySummary.halfDay}</p>
                <span className="text-xs text-slate-400">&lt; 4 hours</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">On Leave</span>
                <p className="mt-1 text-2xl font-bold text-blue-600">{mySummary.leave}</p>
                <span className="text-xs text-slate-400">Approved leaves</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Absent</span>
                <p className="mt-1 text-2xl font-bold text-red-600">{mySummary.absent}</p>
                <span className="text-xs text-slate-400">Unapproved absences</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Pending Review</span>
                <p className="mt-1 text-2xl font-bold text-amber-700">{mySummary.pendingApprovals}</p>
                <span className="text-xs text-slate-400">Corrections awaiting</span>
              </Card>
            </div>
          )}

          {/* Filters Bar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Month">
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </Field>
              <Field label="Status Filter">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="LEAVE">Leave</option>
                  <option value="ABSENT">Absent</option>
                </Select>
              </Field>
            </div>
          </Card>

          {/* My Attendance Log Table */}
          <Card>
            <CardHeader
              title={`My Attendance History (${myRecords.length} records)`}
            />
            {loading && myRecords.length === 0 ? (
              <Spinner label="Loading attendance…" />
            ) : myRecords.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No personal attendance records found for {month}.
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Punch In</TH>
                    <TH>Punch Out</TH>
                    <TH>Status</TH>
                    <TH>Source</TH>
                    <TH>Approval Status</TH>
                    <TH>Notes / Reason</TH>
                  </tr>
                </THead>
                <tbody>
                  {myRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <TD className="font-medium text-slate-900">
                        {new Date(r.date).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TD>
                      <TD className="text-xs font-mono">
                        {r.punchIn
                          ? new Date(r.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </TD>
                      <TD className="text-xs font-mono">
                        {r.punchOut
                          ? new Date(r.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
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
                      <TD>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          {r.source === 'ESSL' ? (
                            <Fingerprint className="h-3.5 w-3.5 text-brand-600" />
                          ) : (
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          )}
                          {r.source}
                        </span>
                      </TD>
                      <TD>
                        <Badge
                          tone={
                            r.approvalStatus === 'APPROVED'
                              ? 'green'
                              : r.approvalStatus === 'REJECTED'
                              ? 'red'
                              : 'amber'
                          }
                        >
                          {r.approvalStatus}
                        </Badge>
                      </TD>
                      <TD className="text-xs text-slate-500 max-w-xs truncate">
                        {r.rejectionReason ? (
                          <span className="text-red-500 font-semibold">Rejected: {r.rejectionReason}</span>
                        ) : (
                          r.notes || '—'
                        )}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TEAM ATTENDANCE & APPROVALS (Oversight)                           */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Pending Approvals Notice Banner */}
          {pendingTeamCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-amber-900">
                    {pendingTeamCount} Attendance Correction{pendingTeamCount === 1 ? '' : 's'} Pending Approval
                  </p>
                  <p className="text-xs text-amber-700">
                    Employees have marked manual check-ins that require manager approval before payroll cut-off.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Team Summary KPI Cards */}
          {teamSummary && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Present</span>
                <p className="mt-1 text-2xl font-bold text-emerald-600">{teamSummary.present}</p>
                <span className="text-xs text-slate-400">Full day shifts</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Late Check-in</span>
                <p className="mt-1 text-2xl font-bold text-amber-600">{teamSummary.late}</p>
                <span className="text-xs text-slate-400">Punched after 09:30</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Half Day</span>
                <p className="mt-1 text-2xl font-bold text-purple-600">{teamSummary.halfDay}</p>
                <span className="text-xs text-slate-400">&lt; 4 hours</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">On Leave</span>
                <p className="mt-1 text-2xl font-bold text-blue-600">{teamSummary.leave}</p>
                <span className="text-xs text-slate-400">Approved leaves</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Absent</span>
                <p className="mt-1 text-2xl font-bold text-red-600">{teamSummary.absent}</p>
                <span className="text-xs text-slate-400">Unapproved absences</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Pending Review</span>
                <p className="mt-1 text-2xl font-bold text-amber-700">{teamSummary.pendingApprovals}</p>
                <span className="text-xs text-slate-400">Requiring approval</span>
              </Card>
            </div>
          )}

          {/* Team Filters Bar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Month">
                <Input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </Field>
              <Field label="Employee">
                <Select
                  value={employeeFilter}
                  onChange={(e) => setEmployeeFilter(e.target.value)}
                >
                  <option value="">All Employees</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.employeeCode || e.email})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status Filter">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="LEAVE">Leave</option>
                  <option value="ABSENT">Absent</option>
                </Select>
              </Field>
            </div>
          </Card>

          {/* Team Attendance Log Table */}
          <Card>
            <CardHeader
              title={`Team Attendance Logs (${teamRecords.length} records)`}
            />
            {loading && teamRecords.length === 0 ? (
              <Spinner label="Loading attendance…" />
            ) : teamRecords.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No attendance records found for this period.
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Employee</TH>
                    <TH>Punch In</TH>
                    <TH>Punch Out</TH>
                    <TH>Status</TH>
                    <TH>Source</TH>
                    <TH>Approval Status</TH>
                    <TH>Actions</TH>
                  </tr>
                </THead>
                <tbody>
                  {teamRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <TD className="font-medium text-slate-900">
                        {new Date(r.date).toLocaleDateString([], {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </TD>
                      <TD>
                        <div className="font-semibold text-slate-900">{r.employee?.fullName || '—'}</div>
                        <div className="text-xs text-slate-400">
                          {r.employee?.department} • {r.employee?.employeeCode}
                        </div>
                      </TD>
                      <TD className="text-xs font-mono">
                        {r.punchIn
                          ? new Date(r.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </TD>
                      <TD className="text-xs font-mono">
                        {r.punchOut
                          ? new Date(r.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
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
                      <TD>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          {r.source === 'ESSL' ? (
                            <Fingerprint className="h-3.5 w-3.5 text-brand-600" />
                          ) : (
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          )}
                          {r.source}
                        </span>
                      </TD>
                      <TD>
                        <Badge
                          tone={
                            r.approvalStatus === 'APPROVED'
                              ? 'green'
                              : r.approvalStatus === 'REJECTED'
                              ? 'red'
                              : 'amber'
                          }
                        >
                          {r.approvalStatus}
                        </Badge>
                        {r.rejectionReason && (
                          <div className="text-[10px] text-red-500 max-w-xs truncate">
                            {r.rejectionReason}
                          </div>
                        )}
                      </TD>
                      <TD>
                        {hasPermission('attendance.approve') && r.approvalStatus === 'PENDING' ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(r.id)}
                              className="h-7 px-2 text-xs"
                              title="Approve"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleReject(r.id)}
                              className="h-7 px-2 text-xs"
                              title="Reject"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Locked</span>
                        )}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}

      {/* 1. Self Mark Attendance Modal (calls /attendance/my/mark) */}
      {showMyMarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-2">Mark My Attendance</h2>
            <p className="text-xs text-slate-500 mb-4">
              Your self-marked attendance entry will be submitted to management for verification.
            </p>
            <form onSubmit={handleMyMarkAttendance} className="space-y-4">
              <Field label="Date *">
                <Input
                  type="date"
                  required
                  value={myMarkForm.date}
                  onChange={(e) => setMyMarkForm({ ...myMarkForm, date: e.target.value })}
                />
              </Field>
              <Field label="Status *">
                <Select
                  value={myMarkForm.status}
                  onChange={(e) => setMyMarkForm({ ...myMarkForm, status: e.target.value })}
                >
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late Check-in</option>
                  <option value="HALF_DAY">Half Day</option>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Punch In Time">
                  <Input
                    type="time"
                    value={myMarkForm.punchIn ? myMarkForm.punchIn.slice(11, 16) : '09:15'}
                    onChange={(e) =>
                      setMyMarkForm({
                        ...myMarkForm,
                        punchIn: `${myMarkForm.date}T${e.target.value}:00.000Z`,
                      })
                    }
                  />
                </Field>
                <Field label="Punch Out Time">
                  <Input
                    type="time"
                    value={myMarkForm.punchOut ? myMarkForm.punchOut.slice(11, 16) : '18:30'}
                    onChange={(e) =>
                      setMyMarkForm({
                        ...myMarkForm,
                        punchOut: `${myMarkForm.date}T${e.target.value}:00.000Z`,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Notes / Reason for Manual Mark">
                <Input
                  placeholder="e.g. Field visit, client meeting, biometric offline"
                  value={myMarkForm.notes}
                  onChange={(e) => setMyMarkForm({ ...myMarkForm, notes: e.target.value })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowMyMarkModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit for Approval</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Team Mark Attendance Modal (for Manager/Admin on behalf of an employee) */}
      {showTeamMarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Record Employee Attendance</h2>
            <form onSubmit={handleTeamMarkAttendance} className="space-y-4">
              <Field label="Employee *">
                <Select
                  value={teamMarkForm.employeeId}
                  onChange={(e) => setTeamMarkForm({ ...teamMarkForm, employeeId: e.target.value })}
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.employeeCode || e.email})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date *">
                <Input
                  type="date"
                  required
                  value={teamMarkForm.date}
                  onChange={(e) => setTeamMarkForm({ ...teamMarkForm, date: e.target.value })}
                />
              </Field>
              <Field label="Status *">
                <Select
                  value={teamMarkForm.status}
                  onChange={(e) => setTeamMarkForm({ ...teamMarkForm, status: e.target.value })}
                >
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="ABSENT">Absent</option>
                  <option value="LEAVE">Leave</option>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Punch In">
                  <Input
                    type="time"
                    value={teamMarkForm.punchIn ? teamMarkForm.punchIn.slice(11, 16) : '09:15'}
                    onChange={(e) =>
                      setTeamMarkForm({
                        ...teamMarkForm,
                        punchIn: `${teamMarkForm.date}T${e.target.value}:00.000Z`,
                      })
                    }
                  />
                </Field>
                <Field label="Punch Out">
                  <Input
                    type="time"
                    value={teamMarkForm.punchOut ? teamMarkForm.punchOut.slice(11, 16) : '18:30'}
                    onChange={(e) =>
                      setTeamMarkForm({
                        ...teamMarkForm,
                        punchOut: `${teamMarkForm.date}T${e.target.value}:00.000Z`,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Notes">
                <Input
                  placeholder="Optional admin note"
                  value={teamMarkForm.notes}
                  onChange={(e) => setTeamMarkForm({ ...teamMarkForm, notes: e.target.value })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowTeamMarkModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Attendance</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Bulk Attendance Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            <h2 className="text-base font-bold text-slate-900 mb-2">Bulk Attendance Entry</h2>
            <p className="text-xs text-slate-500 mb-4">
              Mark attendance for multiple employees for date:
            </p>
            <div className="mb-4">
              <Input
                type="date"
                value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)}
                className="w-48"
              />
            </div>
            <form onSubmit={handleSaveBulk} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md">
                <Table>
                  <THead>
                    <tr>
                      <TH>Employee</TH>
                      <TH>Status</TH>
                      <TH>Notes</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {bulkRows.map((r, idx) => (
                      <tr key={r.employeeId}>
                        <TD className="font-semibold text-slate-900">
                          {r.fullName}
                          <span className="text-xs font-normal text-slate-400 ml-1">({r.employeeCode})</span>
                        </TD>
                        <TD>
                          <select
                            className="rounded border border-slate-300 px-2 py-1 text-xs"
                            value={r.status}
                            onChange={(e) => {
                              const updated = [...bulkRows];
                              updated[idx].status = e.target.value;
                              setBulkRows(updated);
                            }}
                          >
                            <option value="PRESENT">Present</option>
                            <option value="LATE">Late</option>
                            <option value="HALF_DAY">Half Day</option>
                            <option value="LEAVE">Leave</option>
                            <option value="ABSENT">Absent</option>
                          </select>
                        </TD>
                        <TD>
                          <input
                            type="text"
                            placeholder="Note…"
                            className="w-full rounded border border-slate-200 px-2 py-1 text-xs"
                            value={r.notes}
                            onChange={(e) => {
                              const updated = [...bulkRows];
                              updated[idx].notes = e.target.value;
                              setBulkRows(updated);
                            }}
                          />
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 mt-4">
                <Button type="button" variant="outline" onClick={() => setShowBulkModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save All ({bulkRows.length})</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Attendance Confirmation with Reason */}
      <ConfirmModal
        isOpen={Boolean(rejectAttendanceId)}
        onClose={() => setRejectAttendanceId(null)}
        onConfirm={() => {}}
        title="Reject Attendance Record"
        variant="danger"
        confirmLabel="Reject Entry"
        withReason={true}
        reasonPlaceholder="e.g. Punch timestamp does not match agronomy field visit log or approved shift timing..."
        description={
          <p>
            Please provide a clear justification for rejecting this attendance entry. The employee will see this explanation in their self-service attendance view.
          </p>
        }
        onConfirmReason={async (reason) => {
          if (!rejectAttendanceId) return;
          try {
            await api.post(`/attendance/${rejectAttendanceId}/reject`, { reason });
            setRejectAttendanceId(null);
            void fetchTeamData();
          } catch (err: any) {
            alert(err.response?.data?.error?.message || 'Rejection failed');
          }
        }}
      />
    </div>
  );
}
