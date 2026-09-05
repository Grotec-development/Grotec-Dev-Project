import { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Palmtree,
  Plus,
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

export function LeavePage() {
  const { user, hasPermission } = useAuth();
  const [types, setTypes] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');

  // Apply Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    employeeId: user?.id || '',
    leaveTypeId: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    daysCount: 1,
    reason: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [typesRes, balRes, appRes, empRes] = await Promise.all([
        api.get('/leave/types'),
        api.get('/leave/balances', { params: { employeeId: employeeFilter || undefined } }),
        api.get('/leave/applications', {
          params: {
            employeeId: employeeFilter || undefined,
            status: statusFilter || undefined,
            pageSize: 100,
          },
        }),
        hasPermission('leave.approve')
          ? api.get('/employees', { params: { pageSize: 100 } })
          : Promise.resolve({ data: { items: [] } }),
      ]);
      setTypes(typesRes.data || []);
      setBalances(balRes.data || []);
      setApplications(appRes.data.items || []);
      setEmployees(empRes.data.items || []);
      if (typesRes.data?.length > 0 && !applyForm.leaveTypeId) {
        setApplyForm((prev) => ({ ...prev, leaveTypeId: typesRes.data[0].id }));
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load leave records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [statusFilter, employeeFilter]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/leave/apply', {
        ...applyForm,
        daysCount: Number(applyForm.daysCount),
      });
      setShowApplyModal(false);
      void fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to apply for leave');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/leave/${id}/approve`);
      void fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Approval failed');
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await api.post(`/leave/${id}/reject`, { reason });
      void fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Rejection failed');
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leave Management</h1>
          <p className="text-sm text-slate-500">
            Leave quotas, employee balances, application requests, and manager approvals with automated attendance sync.
          </p>
        </div>
        {hasPermission('leave.apply') && (
          <Button onClick={() => setShowApplyModal(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Apply for Leave
          </Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Leave Balances Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {balances.slice(0, 4).map((b) => (
          <Card key={b.id} className="p-4">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase">{b.leaveType.name}</span>
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
          {hasPermission('leave.approve') && (
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
          )}
        </div>
      </Card>

      {/* Leave Applications Table */}
      <Card>
        <CardHeader
          title={`Leave Applications (${applications.length})`}
        />
        {loading && applications.length === 0 ? (
          <Spinner label="Loading leave applications…" />
        ) : applications.length === 0 ? (
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
              {applications.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50">
                  <TD>
                    <div className="font-semibold text-slate-900">{app.employee.fullName}</div>
                    <div className="text-xs text-slate-400">{app.employee.employeeCode}</div>
                  </TD>
                  <TD>
                    <span className="font-medium text-slate-800">{app.leaveType.name}</span>
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
                      <div className="text-[10px] text-red-500">{app.rejectionReason}</div>
                    )}
                  </TD>
                  <TD>
                    {hasPermission('leave.approve') && app.status === 'PENDING' ? (
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

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Apply for Leave</h2>
            <form onSubmit={handleApply} className="space-y-4">
              {hasPermission('leave.approve') && (
                <Field label="Employee">
                  <Select
                    value={applyForm.employeeId}
                    onChange={(e) => setApplyForm({ ...applyForm, employeeId: e.target.value })}
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.fullName} ({e.employeeCode})
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Leave Type *">
                <Select
                  value={applyForm.leaveTypeId}
                  onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
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
              <Field label="Reason *">
                <textarea
                  rows={3}
                  required
                  className="w-full rounded-md border border-slate-300 p-2 text-sm"
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
    </div>
  );
}
