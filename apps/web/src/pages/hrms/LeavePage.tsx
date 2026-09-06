import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Palmtree,
  Plus,
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

export function LeavePage() {
  const { user, hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const isFounder = user?.roleCode === 'FOUNDER';
  const canMy = !isFounder && (hasPermission('leave.apply') || hasPermission('leave.read'));
  const canTeam = hasPermission('leave.approve') || hasPermission('hrms.leave.manage');

  const paramTab = searchParams.get('tab');
  const activeTab: 'my' | 'team' = !canMy ? 'team' : (!canTeam ? 'my' : (paramTab === 'team' ? 'team' : 'my'));

  const setActiveTab = (tab: 'my' | 'team') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  // Common filters
  const [statusFilter, setStatusFilter] = useState('');

  // Team-only filters
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [rejectLeaveId, setRejectLeaveId] = useState<string | null>(null);

  // Data state
  const [types, setTypes] = useState<any[]>([]);
  const [myBalances, setMyBalances] = useState<any[]>([]);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [teamBalances, setTeamBalances] = useState<any[]>([]);
  const [teamApplications, setTeamApplications] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: todayStr,
    endDate: todayStr,
    daysCount: 1,
    reason: '',
  });

  // Fetch types
  const fetchTypes = async () => {
    try {
      const res = await api.get('/leave/types');
      setTypes(res.data || []);
      if (res.data?.length > 0 && !applyForm.leaveTypeId) {
        setApplyForm((prev) => ({ ...prev, leaveTypeId: res.data[0].id }));
      }
    } catch {
      // ignore
    }
  };

  // Fetch My Leave
  const fetchMyData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [balRes, appRes] = await Promise.all([
        api.get('/leave/my/balances'),
        api.get('/leave/my/applications', {
          params: { status: statusFilter || undefined, pageSize: 100 },
        }),
      ]);
      setMyBalances(balRes.data || []);
      setMyApplications(appRes.data.items || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load your leave records');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Team Leave
  const fetchTeamData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [balRes, appRes, empRes] = await Promise.all([
        api.get('/leave/balances', { params: { employeeId: employeeFilter || undefined } }),
        api.get('/leave/applications', {
          params: {
            employeeId: employeeFilter || undefined,
            status: statusFilter || undefined,
            pageSize: 100,
          },
        }),
        api.get('/employees', { params: { pageSize: 100 } }).catch(() => ({ data: { items: [] } })),
      ]);
      setTeamBalances(balRes.data || []);
      setTeamApplications(appRes.data.items || []);
      setEmployees((empRes.data.items || []).filter((e: any) => e.role?.code !== 'FOUNDER'));
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load team leave requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTypes();
  }, []);

  useEffect(() => {
    if (activeTab === 'my' && canMy) {
      void fetchMyData();
    } else if (activeTab === 'team' && canTeam) {
      void fetchTeamData();
    }
  }, [activeTab, statusFilter, employeeFilter]);

  // Submit self-service leave application
  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/leave/my/apply', {
        ...applyForm,
        daysCount: Number(applyForm.daysCount),
      });
      setShowApplyModal(false);
      setApplyForm({
        leaveTypeId: types[0]?.id || '',
        startDate: todayStr,
        endDate: todayStr,
        daysCount: 1,
        reason: '',
      });
      void fetchMyData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to apply for leave');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/leave/${id}/approve`);
      void fetchTeamData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Approval failed');
    }
  };

  const handleReject = (id: string) => {
    setRejectLeaveId(id);
  };

  const pendingTeamCount = teamApplications.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {activeTab === 'my' ? 'My Leave' : 'Team Leave Requests & Approvals'}
          </h1>
          <p className="text-sm text-slate-500">
            {activeTab === 'my'
              ? 'Track your personal leave balances, request time off, and monitor application approval status.'
              : 'Review employee leave requests, balances across departments, and process approvals.'}
          </p>
        </div>

        {activeTab === 'my' && canMy && (
          <Button onClick={() => setShowApplyModal(true)} className="gap-1.5 shadow-xs font-semibold">
            <Plus className="h-4 w-4" />
            Apply for Leave
          </Button>
        )}
      </div>

      {/* Dual Tab Mode Switcher (Manager with both permissions) */}
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
            <Palmtree className="h-4 w-4" />
            My Leave
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
            Team Leave Approvals
            {pendingTeamCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                {pendingTeamCount}
              </span>
            )}
          </button>
        </div>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {/* ========================================================================= */}
      {/* TAB 1: MY LEAVE (Self-Service)                                           */}
      {/* ========================================================================= */}
      {activeTab === 'my' && (
        <div className="space-y-6">
          {/* My Leave Balances Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {myBalances.map((b) => (
              <Card key={b.id} className="p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase">{b.leaveType?.name || 'Leave'}</span>
                  <Palmtree className="h-4 w-4 text-brand-600" />
                </div>
                <p className="mt-2 text-2xl font-bold text-brand-700">{Number(b.balance)} days</p>
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span>Used: {Number(b.used)}</span>
                  <span>Total: {Number(b.allocated)}</span>
                </div>
              </Card>
            ))}
          </div>

          {/* Filters Bar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Status Filter">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
              </Field>
            </div>
          </Card>

          {/* My Leave Applications Table */}
          <Card>
            <CardHeader
              title={`My Leave Applications (${myApplications.length})`}
            />
            {loading && myApplications.length === 0 ? (
              <Spinner label="Loading applications…" />
            ) : myApplications.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                You have not submitted any leave applications.
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Leave Type</TH>
                    <TH>Period</TH>
                    <TH>Days</TH>
                    <TH>Reason</TH>
                    <TH>Applied On</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {myApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <TD>
                        <span className="font-semibold text-slate-900">{app.leaveType?.name}</span>
                      </TD>
                      <TD className="text-xs font-medium text-slate-700">
                        {new Date(app.startDate).toLocaleDateString()} to {new Date(app.endDate).toLocaleDateString()}
                      </TD>
                      <TD className="font-bold text-slate-900">{Number(app.daysCount)}</TD>
                      <TD className="text-xs italic text-slate-600 max-w-xs truncate">
                        “{app.reason}”
                      </TD>
                      <TD className="text-xs text-slate-400">
                        {new Date(app.createdAt).toLocaleDateString()}
                      </TD>
                      <TD>
                        <Badge
                          tone={
                            app.status === 'APPROVED'
                              ? 'green'
                              : app.status === 'REJECTED'
                              ? 'red'
                              : 'amber'
                          }
                        >
                          {app.status}
                        </Badge>
                        {app.rejectionReason && (
                          <div className="text-[10px] text-red-500 mt-0.5">{app.rejectionReason}</div>
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
      {/* TAB 2: TEAM LEAVE APPROVALS (Oversight)                                  */}
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
                    {pendingTeamCount} Employee Leave Request{pendingTeamCount === 1 ? '' : 's'} Pending Approval
                  </p>
                  <p className="text-xs text-amber-700">
                    Review requested dates and team coverage before approving or rejecting.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Team Filters Bar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Status Filter">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
              </Field>
              <Field label="Employee Filter">
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
            </div>
          </Card>

          {/* Team Leave Applications Table */}
          <Card>
            <CardHeader
              title={`Team Leave Applications (${teamApplications.length})`}
            />
            {loading && teamApplications.length === 0 ? (
              <Spinner label="Loading leave applications…" />
            ) : teamApplications.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">No leave applications found</div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Employee</TH>
                    <TH>Leave Type</TH>
                    <TH>Period</TH>
                    <TH>Days</TH>
                    <TH>Reason</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </tr>
                </THead>
                <tbody>
                  {teamApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <TD>
                        <div className="font-semibold text-slate-900">{app.employee?.fullName || '—'}</div>
                        <div className="text-xs text-slate-400">{app.employee?.employeeCode}</div>
                      </TD>
                      <TD>
                        <span className="font-medium text-slate-800">{app.leaveType?.name}</span>
                      </TD>
                      <TD className="text-xs">
                        {new Date(app.startDate).toLocaleDateString()} to {new Date(app.endDate).toLocaleDateString()}
                      </TD>
                      <TD className="font-semibold">{Number(app.daysCount)}</TD>
                      <TD className="text-xs italic text-slate-600 max-w-xs truncate">
                        “{app.reason}”
                      </TD>
                      <TD>
                        <Badge
                          tone={
                            app.status === 'APPROVED'
                              ? 'green'
                              : app.status === 'REJECTED'
                              ? 'red'
                              : 'amber'
                          }
                        >
                          {app.status}
                        </Badge>
                        {app.rejectionReason && (
                          <div className="text-[10px] text-red-500 mt-0.5">{app.rejectionReason}</div>
                        )}
                      </TD>
                      <TD>
                        {app.status === 'PENDING' ? (
                          app.employeeId === user?.id ? (
                            <span className="text-xs italic text-slate-400">Own request</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(app.id)}
                                className="h-7 px-2 text-xs"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleReject(app.id)}
                                className="h-7 px-2 text-xs"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">Closed</span>
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
      {/* MODAL: Apply for Leave (Self-Service)                                      */}
      {/* ========================================================================= */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-2">Apply for Leave</h2>
            <p className="text-xs text-slate-500 mb-4">
              Submit your leave request for management approval. Your balance will be reserved upon submission.
            </p>
            <form onSubmit={handleApply} className="space-y-4">
              <Field label="Leave Type *">
                <Select
                  value={applyForm.leaveTypeId}
                  onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
                  required
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.quotaDays} days quota)
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start Date *">
                  <Input
                    type="date"
                    required
                    value={applyForm.startDate}
                    onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                  />
                </Field>
                <Field label="End Date *">
                  <Input
                    type="date"
                    required
                    value={applyForm.endDate}
                    onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Number of Days *">
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={applyForm.daysCount}
                  onChange={(e) => setApplyForm({ ...applyForm, daysCount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Reason for Leave *">
                <textarea
                  rows={3}
                  required
                  className="w-full rounded-md border border-slate-300 p-2 text-sm focus:border-brand-600 focus:outline-none"
                  placeholder="State the reason for leave request…"
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowApplyModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Application</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Leave Request Confirmation with Reason */}
      <ConfirmModal
        isOpen={Boolean(rejectLeaveId)}
        onClose={() => setRejectLeaveId(null)}
        onConfirm={() => {}}
        title="Reject Leave Application"
        variant="danger"
        confirmLabel="Reject Application"
        withReason={true}
        reasonPlaceholder="e.g. Overlapping field campaign coverage required, peak advisory season..."
        description={
          <p>
            Please provide a specific reason for declining this leave request. The employee will see this feedback in their leave portal.
          </p>
        }
        onConfirmReason={async (reason) => {
          if (!rejectLeaveId) return;
          try {
            await api.post(`/leave/${rejectLeaveId}/reject`, { reason });
            setRejectLeaveId(null);
            void fetchTeamData();
          } catch (err: any) {
            alert(err.response?.data?.error?.message || 'Rejection failed');
          }
        }}
      />
    </div>
  );
}
