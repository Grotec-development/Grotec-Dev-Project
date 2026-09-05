import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CalendarCheck,
  Check,
  Clock,
  Fingerprint,
  IndianRupee,
  Palmtree,
  RefreshCw,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
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
  Spinner,
  StatusBadge,
  TD,
  TH,
  THead,
  Table,
} from '../../components/ui';

export function HrmsDashboardPage() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingEssl, setSyncingEssl] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/hrms/dashboard');
      setData(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load HRMS dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, []);

  const handleSyncEssl = async () => {
    setSyncingEssl(true);
    setSyncMsg(null);
    try {
      const res = await api.post('/attendance/essl/sync', {});
      setSyncMsg(`Synced ${res.data.recordsSynced} biometric attendance punches successfully`);
      void fetchDashboard();
    } catch (err: any) {
      setSyncMsg(err.response?.data?.error?.message || 'Biometric sync failed');
    } finally {
      setSyncingEssl(false);
    }
  };

  const handleApproveLeave = async (id: string) => {
    try {
      await api.post(`/leave/${id}/approve`);
      void fetchDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Approval failed');
    }
  };

  const handleRejectLeave = async (id: string) => {
    const reason = window.prompt('Please enter rejection reason:');
    if (!reason) return;
    try {
      await api.post(`/leave/${id}/reject`, { reason });
      void fetchDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Rejection failed');
    }
  };

  const handleApproveAttendance = async (id: string) => {
    try {
      await api.post(`/attendance/${id}/approve`);
      void fetchDashboard();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Approval failed');
    }
  };

  if (loading && !data) {
    return <Spinner label="Loading HRMS dashboard…" />;
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert tone="error">{error}</Alert>
        <Button onClick={fetchDashboard} className="mt-4" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  const { metrics, todayAttendance, pendingApprovals, departmentDistribution } = data;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">HRMS & Operations Dashboard</h1>
          <p className="text-sm text-slate-500">
            Real-time organizational headcount, daily attendance, leave approvals, and payroll operations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('attendance.approve') && (
            <Button
              onClick={handleSyncEssl}
              disabled={syncingEssl}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Fingerprint className="h-4 w-4 text-brand-600" />
              {syncingEssl ? 'Syncing Biometric…' : 'Sync ESSL Biometric'}
            </Button>
          )}
          <Link to="/hrms/attendance">
            <Button variant="outline" size="sm" className="gap-1.5">
              <CalendarCheck className="h-4 w-4" />
              Mark Attendance
            </Button>
          </Link>
          <Link to="/hrms/leave">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Palmtree className="h-4 w-4" />
              Apply Leave
            </Button>
          </Link>
          {hasPermission('payroll.manage') && (
            <Link to="/hrms/payroll">
              <Button size="sm" className="gap-1.5">
                <IndianRupee className="h-4 w-4" />
                Payroll ({metrics.currentPayrollMonth})
              </Button>
            </Link>
          )}
        </div>
      </div>

      {syncMsg && (
        <Alert tone="info">
          <div className="flex items-center justify-between">
            <span>{syncMsg}</span>
            <button
              onClick={() => setSyncMsg(null)}
              className="text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        </Alert>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">Headcount</span>
            <Users className="h-4 w-4 text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{metrics.totalEmployees}</p>
          <span className="text-xs text-slate-500">Active employees</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">Present Today</span>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{metrics.presentToday}</p>
          <span className="text-xs text-slate-500">
            {metrics.lateToday > 0 ? `${metrics.lateToday} late check-ins` : 'On time'}
          </span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">On Leave</span>
            <Palmtree className="h-4 w-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-blue-600">{metrics.leaveToday}</p>
          <span className="text-xs text-slate-500">Approved leave</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">Absent Today</span>
            <UserX className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-red-600">{metrics.absentToday}</p>
          <span className="text-xs text-slate-500">Unaccounted / Off</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">Leave Pending</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{metrics.pendingLeaveApprovals}</p>
          <span className="text-xs text-slate-500">Needs review</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase">Payroll Status</span>
            <IndianRupee className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-2">
            <Badge tone={metrics.currentPayrollStatus === 'PUBLISHED' ? 'green' : 'amber'}>
              {metrics.currentPayrollStatus}
            </Badge>
          </div>
          <span className="text-xs text-slate-500 mt-1 block">{metrics.currentPayrollMonth}</span>
        </Card>
      </div>

      {/* Main Content Layout: Pending Approvals & Today Attendance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Today Attendance */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title={`Today's Attendance Overview (${new Date().toLocaleDateString()})`}
              action={
                <Link to="/hrms/attendance" className="text-xs font-medium text-brand-600 hover:text-brand-800">
                  View Full Calendar →
                </Link>
              }
            />
            {todayAttendance.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No attendance punches logged for today yet.{' '}
                {hasPermission('attendance.approve') && (
                  <button
                    onClick={handleSyncEssl}
                    className="text-brand-600 underline hover:text-brand-800 ml-1"
                  >
                    Sync biometric punches now
                  </button>
                )}
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Employee</TH>
                    <TH>Department</TH>
                    <TH>Punch In</TH>
                    <TH>Punch Out</TH>
                    <TH>Status</TH>
                    <TH>Source</TH>
                  </tr>
                </THead>
                <tbody>
                  {todayAttendance.map((rec: any) => (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <TD>
                        <div className="font-medium text-slate-900">{rec.employee.fullName}</div>
                        <div className="text-xs text-slate-400">{rec.employee.employeeCode || 'N/A'}</div>
                      </TD>
                      <TD>{rec.employee.department || 'General'}</TD>
                      <TD className="text-xs">
                        {rec.punchIn
                          ? new Date(rec.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </TD>
                      <TD className="text-xs">
                        {rec.punchOut
                          ? new Date(rec.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '—'}
                      </TD>
                      <TD>
                        <Badge
                          tone={
                            rec.status === 'PRESENT'
                              ? 'green'
                              : rec.status === 'LATE'
                              ? 'amber'
                              : rec.status === 'HALF_DAY'
                              ? 'amber'
                              : 'red'
                          }
                        >
                          {rec.status}
                        </Badge>
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          {rec.source === 'ESSL' ? (
                            <Fingerprint className="h-3 w-3 text-brand-600" />
                          ) : (
                            <Calendar className="h-3 w-3 text-slate-400" />
                          )}
                          {rec.source}
                        </span>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {/* Department Headcount Breakdown */}
          <Card className="p-4">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">Headcount by Department</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(departmentDistribution).map(([dept, count]: any) => (
                <div key={dept} className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 truncate">{dept}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{count}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Col: Pending Approvals Queue */}
        <div className="space-y-6">
          <Card>
            <CardHeader
              title={`Pending Leave Applications (${pendingApprovals.leaves.length})`}
              action={
                <Link to="/hrms/leave" className="text-xs font-medium text-brand-600 hover:text-brand-800">
                  All Leaves →
                </Link>
              }
            />
            {pendingApprovals.leaves.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No pending leave applications</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingApprovals.leaves.map((leave: any) => (
                  <div key={leave.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-slate-900">{leave.employee.fullName}</span>
                      <Badge tone="amber">{leave.leaveType.name}</Badge>
                    </div>
                    <p className="text-xs text-slate-600 leading-snug">
                      {new Date(leave.startDate).toLocaleDateString()} to{' '}
                      {new Date(leave.endDate).toLocaleDateString()} ({leave.daysCount} days)
                    </p>
                    <p className="text-[11px] text-slate-500 italic">“{leave.reason}”</p>
                    {hasPermission('leave.approve') && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRejectLeave(leave.id)}
                          className="h-7 px-2 text-xs"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApproveLeave(leave.id)}
                          className="h-7 px-2 text-xs"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title={`Attendance Approvals & Corrections (${pendingApprovals.attendance.length})`}
              action={
                <Link to="/hrms/attendance" className="text-xs font-medium text-brand-600 hover:text-brand-800">
                  Review All →
                </Link>
              }
            />
            {pendingApprovals.attendance.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">No attendance corrections pending</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingApprovals.attendance.map((att: any) => (
                  <div key={att.id} className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-xs text-slate-900">{att.employee.fullName}</span>
                      <span className="text-[11px] text-slate-500">
                        {new Date(att.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={att.status === 'PRESENT' ? 'green' : 'amber'}>{att.status}</Badge>
                      <span className="text-xs text-slate-500">Source: {att.source}</span>
                    </div>
                    {att.rejectionReason && (
                      <p className="text-[11px] text-red-500">{att.rejectionReason}</p>
                    )}
                    {hasPermission('attendance.approve') && (
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          onClick={() => handleApproveAttendance(att.id)}
                          className="h-7 px-2 text-xs"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
