import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  BarChart3,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Printer,
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
  TD,
  TH,
  THead,
  Table,
} from '../../components/ui';

export function PayslipsPage() {
  const { id: routeLineItemId } = useParams<{ id?: string }>();
  const { user, hasPermission } = useAuth();

  const [payslips, setPayslips] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'payslips' | 'reports'>('payslips');

  const fetchPayslips = async () => {
    setLoading(true);
    setError(null);
    try {
      const [slipRes, repRes] = await Promise.all([
        api.get('/payroll/payslips'),
        hasPermission('payroll.manage') ? api.get('/payroll/reports') : Promise.resolve({ data: [] }),
      ]);
      setPayslips(slipRes.data || []);
      setReports(repRes.data || []);

      if (routeLineItemId) {
        const item = (slipRes.data || []).find((s: any) => s.id === routeLineItemId);
        if (item) setSelectedPayslip(item);
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load payslips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPayslips();
  }, [routeLineItemId]);

  const handlePrint = () => {
    window.print();
  };

  const isManager = hasPermission('payroll.manage');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {isManager ? 'Payslips & Payroll Reports' : 'My Payslips'}
          </h1>
          <p className="text-sm text-slate-500">
            {isManager
              ? 'Published employee wage slips, printable salary certificates, and department cost reports.'
              : 'Your published monthly wage slips, earnings breakdowns, and printable salary statements.'}
          </p>
        </div>
        {isManager && (
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'payslips' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('payslips')}
            >
              Payslips ({payslips.length})
            </Button>
            <Button
              variant={activeTab === 'reports' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('reports')}
            >
              Cost Reports
            </Button>
          </div>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Tab 1: Payslips */}
      {activeTab === 'payslips' && (
        <Card>
          <CardHeader
            title={isManager ? `Released Payslips (${payslips.length})` : `My Payslips (${payslips.length})`}
          />
          {loading && payslips.length === 0 ? (
            <Spinner label="Loading payslips…" />
          ) : payslips.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No published payslips available yet. Once a payroll run is published by management, payslips appear here.
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Month</TH>
                  <TH>Employee</TH>
                  <TH>Department</TH>
                  <TH>Working Days</TH>
                  <TH>Gross Earnings</TH>
                  <TH>Total Deductions</TH>
                  <TH>Net Pay</TH>
                  <TH>Action</TH>
                </tr>
              </THead>
              <tbody>
                {payslips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-slate-50">
                    <TD className="font-semibold text-slate-900">{slip.payrollRun?.month}</TD>
                    <TD>
                      <div className="font-medium text-slate-900">{slip.employee.fullName}</div>
                      <div className="text-xs text-slate-400 font-mono">
                        {slip.employee.employeeCode || '—'}
                      </div>
                    </TD>
                    <TD>{slip.employee.department || 'General'}</TD>
                    <TD className="text-xs">{slip.workingDays} days</TD>
                    <TD className="font-medium">
                      ₹{Number(slip.grossEarnings).toLocaleString('en-IN')}
                    </TD>
                    <TD className="text-red-600 font-medium">
                      ₹{Number(slip.totalDeductions).toLocaleString('en-IN')}
                    </TD>
                    <TD className="font-bold text-emerald-600">
                      ₹{Number(slip.netPay).toLocaleString('en-IN')}
                    </TD>
                    <TD>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedPayslip(slip)}
                        className="h-7 px-2 text-xs gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View Slip
                      </Button>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {/* Tab 2: Cost Reports */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {reports.map((rep) => (
            <Card key={rep.month} className="p-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Payroll Cost Breakdown — {rep.month}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {rep.totalEmployees} employees • Total Net: ₹{Number(rep.totalNet).toLocaleString('en-IN')}
                  </p>
                </div>
                <Badge tone={rep.status === 'PUBLISHED' ? 'green' : 'amber'}>{rep.status}</Badge>
              </div>

              <Table>
                <THead>
                  <tr>
                    <TH>Department</TH>
                    <TH>Headcount</TH>
                    <TH>Gross Earnings</TH>
                    <TH>Total Deductions</TH>
                    <TH>Net Outflow</TH>
                  </tr>
                </THead>
                <tbody>
                  {Object.entries(rep.departments || {}).map(([dept, stats]: any) => (
                    <tr key={dept} className="hover:bg-slate-50">
                      <TD className="font-semibold text-slate-900">{dept}</TD>
                      <TD>{stats.count}</TD>
                      <TD>₹{stats.gross.toLocaleString('en-IN')}</TD>
                      <TD className="text-red-600">₹{stats.deductions.toLocaleString('en-IN')}</TD>
                      <TD className="font-bold text-emerald-600">₹{stats.net.toLocaleString('en-IN')}</TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          ))}
        </div>
      )}

      {/* Printable Payslip Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:p-0 print:static print:bg-transparent">
          <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-2xl border border-slate-200 overflow-y-auto max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:w-full">
            {/* Header / Actions */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-6 print:hidden">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Official Salary Slip
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handlePrint} className="gap-1">
                  <Printer className="h-3.5 w-3.5" />
                  Print / Save PDF
                </Button>
                <button
                  type="button"
                  onClick={() => setSelectedPayslip(null)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Payslip Document Body */}
            <div className="space-y-6">
              {/* Company Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-bold text-white">
                    G
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">
                      GROTEC AGRI SERVICES PVT LTD
                    </h2>
                    <p className="text-xs text-slate-500">
                      FarmerOS Operations & Agronomy Hub • Bengaluru, Karnataka
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase font-bold text-slate-400">Salary Slip</p>
                  <p className="text-sm font-bold text-brand-700">
                    {selectedPayslip.payrollRun?.month}
                  </p>
                </div>
              </div>

              {/* Employee Particulars */}
              <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-xs border border-slate-200">
                <div>
                  <span className="text-slate-400 block">Employee Name:</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedPayslip.employee.fullName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Employee Code:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedPayslip.employee.employeeCode || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Department & Designation:</span>
                  <span className="font-medium text-slate-800">
                    {selectedPayslip.employee.department} • {selectedPayslip.employee.designation}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Total Working Days / Days Worked:</span>
                  <span className="font-medium text-slate-800">
                    {selectedPayslip.workingDays} days / {Number(selectedPayslip.presentDays)} days
                  </span>
                </div>
              </div>

              {/* Itemized Earnings and Deductions Table */}
              <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg overflow-hidden">
                {/* Earnings Column */}
                <div className="divide-y divide-slate-100">
                  <div className="bg-slate-100 px-4 py-2 font-semibold text-xs text-slate-700 uppercase">
                    Earnings
                  </div>
                  <div className="flex justify-between px-4 py-2 text-xs">
                    <span className="text-slate-600">Basic Salary</span>
                    <span className="font-medium">
                      ₹{((selectedPayslip.components?.basic as number) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2 text-xs">
                    <span className="text-slate-600">House Rent Allowance (HRA)</span>
                    <span className="font-medium">
                      ₹{((selectedPayslip.components?.hra as number) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2 text-xs">
                    <span className="text-slate-600">Special Allowances</span>
                    <span className="font-medium">
                      ₹{((selectedPayslip.components?.allowances as number) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 bg-slate-50 font-bold text-xs text-slate-900">
                    <span>Total Gross Earnings</span>
                    <span>₹{Number(selectedPayslip.grossEarnings).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* Deductions Column */}
                <div className="divide-y divide-slate-100 border-l border-slate-200">
                  <div className="bg-slate-100 px-4 py-2 font-semibold text-xs text-slate-700 uppercase">
                    Deductions
                  </div>
                  <div className="flex justify-between px-4 py-2 text-xs">
                    <span className="text-slate-600">Provident Fund (PF)</span>
                    <span className="font-medium">
                      ₹{((selectedPayslip.components?.pf as number) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2 text-xs">
                    <span className="text-slate-600">Attendance Loss of Pay</span>
                    <span className="font-medium text-red-600">
                      ₹{Number(selectedPayslip.attendanceAdjustment).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2 text-xs">
                    <span className="text-slate-600">Advance Recovery</span>
                    <span className="font-medium text-amber-700">
                      ₹{Number(selectedPayslip.advanceRecovery).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between px-4 py-2.5 bg-slate-50 font-bold text-xs text-red-700">
                    <span>Total Deductions</span>
                    <span>₹{Number(selectedPayslip.totalDeductions).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Net Pay Highlight Banner */}
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase text-emerald-800">
                    Net Payable Amount
                  </span>
                  <p className="text-2xl font-black text-emerald-700 mt-0.5">
                    ₹{Number(selectedPayslip.netPay).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <span>Authorized Signature</span>
                  <div className="h-8 border-b border-slate-300 w-32 mt-2" />
                </div>
              </div>

              <p className="text-center text-[10px] text-slate-400 pt-4">
                This is a computer-generated payslip issued by GROTEC FarmerOS and requires no manual signature.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
