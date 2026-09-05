import { useEffect, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  Fingerprint,
  Plus,
  RefreshCw,
  Search,
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

export function AttendancePage() {
  const { user, hasPermission } = useAuth();
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(currentMonthStr);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markForm, setMarkForm] = useState({
    employeeId: user?.id || '',
    date: new Date().toISOString().slice(0, 10),
    status: 'PRESENT',
    punchIn: `${new Date().toISOString().slice(0, 10)}T09:15:00.000Z`,
    punchOut: `${new Date().toISOString().slice(0, 10)}T18:30:00.000Z`,
    notes: '',
  });

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkRows, setBulkRows] = useState<any[]>([]);

  const [syncingEssl, setSyncingEssl] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/attendance/summary', {
        params: { month, employeeId: employeeFilter || undefined },
      });
      setSummary(res.data);
    } catch {
      // ignore
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const [recRes, empRes] = await Promise.all([
        api.get('/attendance', {
          params: {
            month,
            employeeId: employeeFilter || undefined,
            status: statusFilter || undefined,
            pageSize: 100,
          },
        }),
        api.get('/attendance/roster').catch(() => ({ data: { items: [] } })),
      ]);
      setRecords(recRes.data.items || []);
      setEmployees(empRes.data.items || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSummary();
    void fetchRecords();
  }, [month, employeeFilter, statusFilter]);

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/attendance/mark', markForm);
      setShowMarkModal(false);
      void fetchSummary();
      void fetchRecords();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to mark attendance');
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
      void fetchSummary();
      void fetchRecords();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save bulk attendance');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/attendance/${id}/approve`);
      void fetchSummary();
      void fetchRecords();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Approval failed');
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await api.post(`/attendance/${id}/reject`, { reason });
      void fetchSummary();
      void fetchRecords();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Rejection failed');
    }
  };

  const handleSyncEssl = async () => {
    setSyncingEssl(true);
    setSyncResult(null);
    try {
      const res = await api.post('/attendance/essl/sync', { date: new Date().toISOString().slice(0, 10) });
      setSyncResult(`ESSL sync completed: ${res.data.recordsSynced} records updated from biometric feeds.`);
      void fetchSummary();
      void fetchRecords();
    } catch (err: any) {
      setSyncResult(err.response?.data?.error?.message || 'Biometric sync failed');
    } finally {
      setSyncingEssl(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance & Biometrics</h1>
          <p className="text-sm text-slate-500">
            Daily check-in logs, biometric punches from ESSL devices, corrections, and manager approval queues.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          {hasPermission('attendance.mark') && hasPermission('employee.read') && (
            <Button variant="outline" size="sm" onClick={handleOpenBulkModal} className="gap-1.5">
              <Users className="h-4 w-4" />
              Bulk Attendance
            </Button>
          )}
          {hasPermission('attendance.mark') && (
            <Button size="sm" onClick={() => setShowMarkModal(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Mark Attendance
            </Button>
          )}
        </div>
      </div>

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

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <Card className="p-4">
            <span className="text-xs text-slate-500 uppercase font-semibold">Present</span>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{summary.present}</p>
            <span className="text-xs text-slate-400">Full day shifts</span>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-slate-500 uppercase font-semibold">Late Check-in</span>
            <p className="mt-1 text-2xl font-bold text-amber-600">{summary.late}</p>
            <span className="text-xs text-slate-400">Punched after 09:30</span>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-slate-500 uppercase font-semibold">Half Day</span>
            <p className="mt-1 text-2xl font-bold text-purple-600">{summary.halfDay}</p>
            <span className="text-xs text-slate-400">&lt; 4 hours</span>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-slate-500 uppercase font-semibold">On Leave</span>
            <p className="mt-1 text-2xl font-bold text-blue-600">{summary.leave}</p>
            <span className="text-xs text-slate-400">Approved leaves</span>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-slate-500 uppercase font-semibold">Absent</span>
            <p className="mt-1 text-2xl font-bold text-red-600">{summary.absent}</p>
            <span className="text-xs text-slate-400">Unapproved absences</span>
          </Card>
          <Card className="p-4">
            <span className="text-xs text-slate-500 uppercase font-semibold">Pending Review</span>
            <p className="mt-1 text-2xl font-bold text-amber-700">{summary.pendingApprovals}</p>
            <span className="text-xs text-slate-400">Corrections needed</span>
          </Card>
        </div>
      )}

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Month">
            <Input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </Field>
          {hasPermission('attendance.read') && (
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
          )}
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

      {/* Attendance Log Table */}
      <Card>
        <CardHeader
          title={`Attendance Logs (${records.length} records)`}
        />
        {loading && records.length === 0 ? (
          <Spinner label="Loading attendance…" />
        ) : records.length === 0 ? (
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
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <TD className="font-medium text-slate-900">
                    {new Date(r.date).toLocaleDateString([], {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </TD>
                  <TD>
                    <div className="font-semibold text-slate-900">{r.employee.fullName}</div>
                    <div className="text-xs text-slate-400">
                      {r.employee.department} • {r.employee.employeeCode}
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

      {/* Single Mark Attendance Modal */}
      {showMarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Mark Attendance</h2>
            <form onSubmit={handleMarkAttendance} className="space-y-4">
              {hasPermission('attendance.approve') && employees.length > 0 && (
                <Field label="Employee *">
                  <Select
                    value={markForm.employeeId}
                    onChange={(e) => setMarkForm({ ...markForm, employeeId: e.target.value })}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.fullName} ({emp.employeeCode})
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Date *">
                <Input
                  type="date"
                  required
                  value={markForm.date}
                  onChange={(e) => setMarkForm({ ...markForm, date: e.target.value })}
                />
              </Field>
              <Field label="Attendance Status *">
                <Select
                  value={markForm.status}
                  onChange={(e) => setMarkForm({ ...markForm, status: e.target.value as any })}
                >
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late Check-in</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="LEAVE">Leave</option>
                  <option value="ABSENT">Absent</option>
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Punch In Time">
                  <Input
                    type="time"
                    defaultValue="09:15"
                    onChange={(e) =>
                      setMarkForm({
                        ...markForm,
                        punchIn: `${markForm.date}T${e.target.value}:00.000Z`,
                      })
                    }
                  />
                </Field>
                <Field label="Punch Out Time">
                  <Input
                    type="time"
                    defaultValue="18:30"
                    onChange={(e) =>
                      setMarkForm({
                        ...markForm,
                        punchOut: `${markForm.date}T${e.target.value}:00.000Z`,
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Notes / Reason">
                <Input
                  placeholder="e.g. Field visit or manual correction"
                  value={markForm.notes}
                  onChange={(e) => setMarkForm({ ...markForm, notes: e.target.value })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowMarkModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Submit Attendance</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Attendance Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Bulk Attendance Entry</h2>
                <p className="text-xs text-slate-500">Record attendance for the entire roster for a single date.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBulk} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="max-w-xs">
                <Field label="Attendance Date">
                  <Input
                    type="date"
                    required
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                  />
                </Field>
              </div>

              <Table>
                <THead>
                  <tr>
                    <TH>Employee</TH>
                    <TH>Status</TH>
                    <TH>Remarks</TH>
                  </tr>
                </THead>
                <tbody>
                  {bulkRows.map((row, idx) => (
                    <tr key={row.employeeId}>
                      <TD className="font-medium text-slate-900">
                        {row.fullName}{' '}
                        <span className="text-xs text-slate-400">({row.employeeCode || '—'})</span>
                      </TD>
                      <TD>
                        <Select
                          value={row.status}
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
                        </Select>
                      </TD>
                      <TD>
                        <Input
                          placeholder="Optional note"
                          value={row.notes}
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

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                <Button type="button" variant="outline" onClick={() => setShowBulkModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save Bulk Roster</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
