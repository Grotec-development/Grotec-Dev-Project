import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  FileCheck,
  FileText,
  History,
  IndianRupee,
  Lock,
  Plus,
  RefreshCw,
  Send,
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
} from '../../components/ui';

export function PayrollPage() {
  const { user, hasPermission } = useAuth();
  const currentMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [runs, setRuns] = useState<any[]>([]);
  const [currentRun, setCurrentRun] = useState<any>(null);
  const [advances, setAdvances] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'run' | 'advances'>('run');

  const [loading, setLoading] = useState(true);
  const [operating, setOperating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Issue Advance Modal
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [advForm, setAdvForm] = useState({
    employeeId: '',
    amount: 15000,
    reason: '',
    linkedMonth: currentMonthStr,
  });

  if (!hasPermission('payroll.manage')) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center space-y-4">
        <Alert tone="info">
          Company payroll runs are restricted to management. Please view your personal payslips under Payslips.
        </Alert>
        <div>
          <Link to="/hrms/payslips">
            <Button variant="primary" size="sm">Go to My Payslips</Button>
          </Link>
        </div>
      </div>
    );
  }

  const fetchRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const [runsRes, advRes, empRes] = await Promise.all([
        api.get('/payroll/runs'),
        api.get('/payroll/advances'),
        hasPermission('employee.read') ? api.get('/employees', { params: { pageSize: 100 } }) : Promise.resolve({ data: { items: [] } }),
      ]);
      setRuns(runsRes.data || []);
      setAdvances(advRes.data || []);
      setEmployees(empRes.data.items || []);

      const runForMonth = (runsRes.data || []).find((r: any) => r.month === selectedMonth);
      if (runForMonth) {
        const detailRes = await api.get(`/payroll/runs/${runForMonth.id}`);
        setCurrentRun(detailRes.data);
      } else {
        setCurrentRun(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchRuns();
  }, [selectedMonth]);

  const handleGenerate = async () => {
    setOperating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.post('/payroll/generate', { month: selectedMonth });
      setSuccessMsg(`Payroll generated for ${selectedMonth} (${res.data.totalEmployees} employees calculated).`);
      void fetchRuns();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Payroll generation failed');
    } finally {
      setOperating(false);
    }
  };

  const handleApprove = async () => {
    if (!currentRun) return;
    setOperating(true);
    setError(null);
    try {
      await api.post(`/payroll/${currentRun.id}/approve`);
      setSuccessMsg(`Payroll run ${currentRun.month} successfully approved and locked.`);
      void fetchRuns();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Approval failed');
    } finally {
      setOperating(false);
    }
  };

  const handlePublish = async () => {
    if (!currentRun) return;
    setOperating(true);
    setError(null);
    try {
      await api.post(`/payroll/${currentRun.id}/publish`);
      setSuccessMsg(
        `Payroll run ${currentRun.month} published! Payslips are now live and employee advance recoveries recorded.`,
      );
      void fetchRuns();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Publishing failed');
    } finally {
      setOperating(false);
    }
  };

  const handleCreateAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/payroll/advances', {
        employeeId: advForm.employeeId,
        amount: Number(advForm.amount),
        reason: advForm.reason || undefined,
        linkedMonth: advForm.linkedMonth || undefined,
      });
      setShowAdvanceModal(false);
      void fetchRuns();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to issue advance');
    }
  };

  const runStatus = currentRun?.status || 'IDLE';

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Monthly Payroll Management</h1>
          <p className="text-sm text-slate-500">
            End-to-end payroll calculation: attendance adjustments, advance recovery, state-machine locking, and publishing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/hrms/payslips">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileText className="h-4 w-4" />
              Payslips & Reports
            </Button>
          </Link>
          {hasPermission('payroll.manage') && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setAdvForm({
                  employeeId: employees[0]?.id || '',
                  amount: 15000,
                  reason: 'Personal advance',
                  linkedMonth: selectedMonth,
                });
                setShowAdvanceModal(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Issue Advance
            </Button>
          )}
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {successMsg && <Alert tone="info">{successMsg}</Alert>}

      {/* Month & Tabs Selector Bar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700">Select Month:</span>
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-48"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'run' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('run')}
            >
              Payroll Run Sheet
            </Button>
            <Button
              variant={activeTab === 'advances' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('advances')}
            >
              Advances Ledger ({advances.length})
            </Button>
          </div>
        </div>
      </Card>

      {activeTab === 'run' && (
        <>
          {/* 4-Step State Machine Workflow Ribbon */}
          <Card className="p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Monthly Workflow State Engine (PRD §7.8.4)
              </span>
              <Badge
                tone={
                  runStatus === 'PUBLISHED'
                    ? 'green'
                    : runStatus === 'APPROVED_LOCKED'
                    ? 'amber'
                    : runStatus === 'GENERATED'
                    ? 'slate'
                    : 'slate'
                }
              >
                Status: {runStatus}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              {/* Step 1 */}
              <div
                className={`rounded-lg p-3.5 border transition-all ${
                  runStatus === 'IDLE'
                    ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                    : 'border-slate-200 bg-slate-50 opacity-80'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-700">
                    1
                  </div>
                  <span className="font-semibold text-xs text-slate-800">Idle / Ready</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                  Unprocessed month. Generate to calculate attendance deductions & advance recoveries.
                </p>
                {runStatus === 'IDLE' && hasPermission('payroll.manage') && (
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    onClick={handleGenerate}
                    disabled={operating}
                  >
                    Generate {selectedMonth}
                  </Button>
                )}
              </div>

              {/* Step 2 */}
              <div
                className={`rounded-lg p-3.5 border transition-all ${
                  runStatus === 'GENERATED'
                    ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                    : runStatus === 'APPROVED_LOCKED' || runStatus === 'PUBLISHED'
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-700">
                    2
                  </div>
                  <span className="font-semibold text-xs text-slate-800">Generated</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                  Pro-rated salary computed. Review line items, absent day deductions, and advance offsets.
                </p>
                {runStatus === 'GENERATED' && (
                  <div className="mt-3 flex gap-1.5">
                    {hasPermission('payroll.manage') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGenerate}
                        disabled={operating}
                        className="text-xs flex-1"
                      >
                        Recalculate
                      </Button>
                    )}
                    {hasPermission('payroll.approve') && (
                      <Button
                        size="sm"
                        onClick={() => setShowApproveConfirm(true)}
                        disabled={operating}
                        className="text-xs flex-1"
                      >
                        Approve & Lock
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Step 3 */}
              <div
                className={`rounded-lg p-3.5 border transition-all ${
                  runStatus === 'APPROVED_LOCKED'
                    ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                    : runStatus === 'PUBLISHED'
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-700">
                    3
                  </div>
                  <span className="font-semibold text-xs text-slate-800">Approved & Locked</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                  Approved by management. Numbers are permanently locked against recalculation.
                </p>
                {runStatus === 'APPROVED_LOCKED' && (
                  user?.roleCode === 'FOUNDER' ? (
                    <Button
                      size="sm"
                      onClick={() => setShowPublishConfirm(true)}
                      disabled={operating}
                      className="mt-3 w-full"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Sign-off & Publish Payslips
                    </Button>
                  ) : (
                    <div className="mt-3 rounded bg-amber-100/70 p-2 text-center text-[11px] font-medium text-amber-800">
                      Locked. Awaiting Founder sign-off & disbursement release (PRD §5.1.2).
                    </div>
                  )
                )}
              </div>

              {/* Step 4 */}
              <div
                className={`rounded-lg p-3.5 border transition-all ${
                  runStatus === 'PUBLISHED'
                    ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-800">
                    ✓
                  </div>
                  <span className="font-semibold text-xs text-slate-800">Published</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                  Employee payslips released. Advance recoveries settled in ledger. Notifications delivered.
                </p>
                {runStatus === 'PUBLISHED' && (
                  <div className="mt-3">
                    <Link to="/hrms/payslips">
                      <Button size="sm" variant="outline" className="w-full text-xs">
                        View All Payslips →
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Totals Summary Cards */}
          {currentRun && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Employees</span>
                <p className="mt-1 text-2xl font-bold text-slate-900">{currentRun.totalEmployees}</p>
                <span className="text-xs text-slate-400">Calculated in payroll</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Total Gross</span>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  ₹{Number(currentRun.totalGross).toLocaleString('en-IN')}
                </p>
                <span className="text-xs text-slate-400">Total gross earnings</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Total Deductions</span>
                <p className="mt-1 text-2xl font-bold text-red-600">
                  ₹{Number(currentRun.totalDeductions).toLocaleString('en-IN')}
                </p>
                <span className="text-xs text-slate-400">Statutory + Attendance + Advance</span>
              </Card>
              <Card className="p-4">
                <span className="text-xs text-slate-500 uppercase font-semibold">Net Disbursement</span>
                <p className="mt-1 text-2xl font-bold text-emerald-600">
                  ₹{Number(currentRun.totalNet).toLocaleString('en-IN')}
                </p>
                <span className="text-xs text-slate-400">Net payable bank transfer</span>
              </Card>
            </div>
          )}

          {/* Line Items Table */}
          <Card>
            <CardHeader
              title={`Employee Payroll Line Items (${currentRun?.lineItems?.length || 0})`}
            />
            {!currentRun || currentRun.lineItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No payroll calculations available for {selectedMonth}. Click "Generate" above to calculate.
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Employee</TH>
                    <TH>Department</TH>
                    <TH>Working/Present</TH>
                    <TH>Gross Earnings</TH>
                    <TH>Loss of Pay</TH>
                    <TH>Advance Offset</TH>
                    <TH>Total Deductions</TH>
                    <TH>Net Pay</TH>
                  </tr>
                </THead>
                <tbody>
                  {currentRun.lineItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <TD>
                        <div className="font-semibold text-slate-900">{item.employee.fullName}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {item.employee.employeeCode || '—'}
                        </div>
                      </TD>
                      <TD>{item.employee.department || 'General'}</TD>
                      <TD className="text-xs">
                        {Number(item.presentDays)} / {item.workingDays} days
                        {Number(item.absentDays) > 0 && (
                          <span className="text-red-500 ml-1">({Number(item.absentDays)} absent)</span>
                        )}
                      </TD>
                      <TD className="font-medium text-slate-900">
                        ₹{Number(item.grossEarnings).toLocaleString('en-IN')}
                      </TD>
                      <TD className="text-xs text-red-600 font-medium">
                        {Number(item.attendanceAdjustment) > 0
                          ? `₹${Number(item.attendanceAdjustment).toLocaleString('en-IN')}`
                          : '₹0'}
                      </TD>
                      <TD className="text-xs text-amber-700 font-medium">
                        {Number(item.advanceRecovery) > 0
                          ? `₹${Number(item.advanceRecovery).toLocaleString('en-IN')}`
                          : '₹0'}
                      </TD>
                      <TD className="text-red-600 font-medium">
                        ₹{Number(item.totalDeductions).toLocaleString('en-IN')}
                      </TD>
                      <TD className="font-bold text-emerald-600">
                        ₹{Number(item.netPay).toLocaleString('en-IN')}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}

      {/* Advances Ledger Tab */}
      {activeTab === 'advances' && (
        <Card>
          <CardHeader
            title={`Salary Advances Ledger (${advances.length} records)`}
            action={
              hasPermission('payroll.manage') && (
                <Button
                  size="sm"
                  onClick={() => {
                    setAdvForm({
                      employeeId: employees[0]?.id || '',
                      amount: 15000,
                      reason: 'Emergency advance',
                      linkedMonth: selectedMonth,
                    });
                    setShowAdvanceModal(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Issue Advance
                </Button>
              )
            }
          />
          {advances.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">No advance records in ledger</div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Date</TH>
                  <TH>Employee</TH>
                  <TH>Original Amount</TH>
                  <TH>Running Balance</TH>
                  <TH>Linked Month</TH>
                  <TH>Status</TH>
                  <TH>Reason</TH>
                </tr>
              </THead>
              <tbody>
                {advances.map((adv) => (
                  <tr key={adv.id} className="hover:bg-slate-50">
                    <TD>{new Date(adv.issuedAt).toLocaleDateString()}</TD>
                    <TD>
                      <div className="font-semibold text-slate-900">{adv.employee.fullName}</div>
                      <div className="text-xs text-slate-400">{adv.employee.employeeCode}</div>
                    </TD>
                    <TD className="font-medium">₹{Number(adv.amount).toLocaleString('en-IN')}</TD>
                    <TD className="font-bold text-amber-700">
                      ₹{Number(adv.runningBalance).toLocaleString('en-IN')}
                    </TD>
                    <TD className="text-xs font-mono">{adv.linkedMonth || '—'}</TD>
                    <TD>
                      <Badge tone={adv.status === 'ACTIVE' ? 'amber' : 'green'}>{adv.status}</Badge>
                    </TD>
                    <TD className="text-xs text-slate-600">{adv.reason || '—'}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Issue Advance Modal */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl border border-slate-200">
            <h2 className="text-base font-bold text-slate-900 mb-4">Issue Employee Salary Advance</h2>
            <form onSubmit={handleCreateAdvance} className="space-y-4">
              <Field label="Employee *">
                <Select
                  value={advForm.employeeId}
                  onChange={(e) => setAdvForm({ ...advForm, employeeId: e.target.value })}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeCode || emp.department})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Advance Amount (₹) *">
                <Input
                  type="number"
                  required
                  value={advForm.amount}
                  onChange={(e) => setAdvForm({ ...advForm, amount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Reason / Notes">
                <Input
                  placeholder="e.g. Festival advance / Medical support"
                  value={advForm.reason}
                  onChange={(e) => setAdvForm({ ...advForm, reason: e.target.value })}
                />
              </Field>
              <Field label="Linked Repayment Month">
                <Input
                  type="month"
                  value={advForm.linkedMonth}
                  onChange={(e) => setAdvForm({ ...advForm, linkedMonth: e.target.value })}
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

      {/* Confirm Approve & Lock Run Modal */}
      <ConfirmModal
        isOpen={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={async () => {
          setShowApproveConfirm(false);
          await handleApprove();
        }}
        title={`Approve & Lock Payroll Run for ${currentRun?.month}?`}
        variant="warning"
        confirmLabel="Approve & Lock Payroll"
        isLoading={operating}
        description={
          <div className="space-y-2">
            <p>
              Are you sure you want to approve and lock the payroll calculation for <strong>{currentRun?.month}</strong>?
            </p>
            <p className="text-slate-500">
              This action freezes gross pay, attendance penalties, and advance deductions. The run cannot be recalculated or modified once locked.
            </p>
          </div>
        }
      />

      {/* Confirm Publish Payslips Modal */}
      <ConfirmModal
        isOpen={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={async () => {
          setShowPublishConfirm(false);
          await handlePublish();
        }}
        title={`Sign-off & Publish Payslips for ${currentRun?.month}?`}
        variant="primary"
        confirmLabel="Publish Payslips"
        isLoading={operating}
        description={
          <div className="space-y-2">
            <p>
              Are you sure you want to sign-off and publish payslips for <strong>{currentRun?.month}</strong>?
            </p>
            <p className="text-slate-500">
              This will release individual payslips to all employees in their portal, post recoveries to the advance ledger, and initiate bank disbursement notifications. This action cannot be undone.
            </p>
          </div>
        }
      />
    </div>
  );
}
