import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  Filter,
  Plus,
  Search,
  ShieldCheck,
  User,
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

export function EmployeesPage() {
  const { hasPermission } = useAuth();
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'personal' | 'employment' | 'documents' | 'notes'>('personal');
  const [formData, setFormData] = useState<any>({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    roleId: '',
    employeeCode: '',
    designation: '',
    department: '',
    joiningDate: '',
    experience: '',
    address: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, roleRes] = await Promise.all([
        api.get('/employees', {
          params: {
            q: search || undefined,
            status: statusFilter || undefined,
            pageSize: 100,
          },
        }),
        api.get('/auth/me').catch(() => null),
      ]);
      setEmployees(empRes.data.items || []);

      // If we don't have roles yet, fetch them from employee list roles
      const uniqueRoles = Array.from(
        new Map((empRes.data.items || []).map((e: any) => [e.role?.id, e.role])).values(),
      ).filter(Boolean);
      setRoles(uniqueRoles);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEmployees();
  }, [search, statusFilter]);

  const handleOpenAddModal = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      password: 'Password@123',
      roleId: roles[0]?.id || '',
      employeeCode: `EMP${String(employees.length + 1).padStart(3, '0')}`,
      designation: '',
      department: '',
      joiningDate: new Date().toISOString().slice(0, 10),
      experience: '',
      address: '',
      notes: '',
    });
    setFormError(null);
    setModalTab('personal');
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      await api.post('/employees', formData);
      setIsModalOpen(false);
      void fetchEmployees();
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || 'Failed to create employee');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (emp: any) => {
    const action = emp.status === 'ACTIVE' ? 'deactivate' : 'activate';
    if (!window.confirm(`Are you sure you want to ${action} ${emp.fullName}?`)) return;
    try {
      await api.post(`/employees/${emp.id}/${action}`);
      void fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || `Failed to ${action} employee`);
    }
  };

  const departments = Array.from(new Set(employees.map((e) => e.department).filter(Boolean)));
  const filteredEmployees = employees.filter((e) => {
    if (deptFilter && e.department !== deptFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Management</h1>
          <p className="text-sm text-slate-500">
            Unified directory for CRM telecallers, field relationship managers, agronomists, and staff.
          </p>
        </div>
        {hasPermission('employee.create') && (
          <Button onClick={handleOpenAddModal} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add Employee
          </Button>
        )}
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, code…"
              className="pl-9"
            />
          </div>
          <div>
            <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d: any) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Employee List Table */}
      <Card>
        <CardHeader
          title={`All Employees (${filteredEmployees.length})`}
        />
        {loading && employees.length === 0 ? (
          <Spinner label="Loading employees…" />
        ) : filteredEmployees.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No employees match the selected criteria</div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Name & Email</TH>
                <TH>Department</TH>
                <TH>Designation</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Actions</TH>
              </tr>
            </THead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50">
                  <TD className="font-mono text-xs text-slate-500 font-semibold">
                    {emp.employeeCode || '—'}
                  </TD>
                  <TD>
                    <Link
                      to={`/hrms/employees/${emp.id}`}
                      className="font-medium text-slate-900 hover:text-brand-600"
                    >
                      {emp.fullName}
                    </Link>
                    <div className="text-xs text-slate-400">{emp.email}</div>
                  </TD>
                  <TD>{emp.department || 'General'}</TD>
                  <TD>{emp.designation || 'Staff'}</TD>
                  <TD>
                    <Badge tone="slate">{emp.role?.name || emp.role?.code}</Badge>
                  </TD>
                  <TD>
                    <StatusBadge status={emp.status} />
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/hrms/employees/${emp.id}`}
                        className="text-xs font-medium text-brand-600 hover:text-brand-800"
                      >
                        Profile
                      </Link>
                      {hasPermission('employee.deactivate') && (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(emp)}
                          className="text-xs text-slate-500 hover:text-red-600"
                        >
                          {emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {/* 4-Section Add Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Add New Employee</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-6 text-xs font-medium">
              <button
                type="button"
                onClick={() => setModalTab('personal')}
                className={`py-3 px-4 border-b-2 font-semibold transition-colors ${
                  modalTab === 'personal'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                1. Personal Details
              </button>
              <button
                type="button"
                onClick={() => setModalTab('employment')}
                className={`py-3 px-4 border-b-2 font-semibold transition-colors ${
                  modalTab === 'employment'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                2. Employment & Role
              </button>
              <button
                type="button"
                onClick={() => setModalTab('documents')}
                className={`py-3 px-4 border-b-2 font-semibold transition-colors ${
                  modalTab === 'documents'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                3. Documents & KYC
              </button>
              <button
                type="button"
                onClick={() => setModalTab('notes')}
                className={`py-3 px-4 border-b-2 font-semibold transition-colors ${
                  modalTab === 'notes'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                4. Notes
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEmployee} className="flex-1 overflow-y-auto p-6 space-y-4">
              {formError && <Alert tone="error">{formError}</Alert>}

              {modalTab === 'personal' && (
                <div className="space-y-4">
                  <Field label="Full Name *">
                    <Input
                      required
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="e.g. Ramesh Patel"
                    />
                  </Field>
                  <Field label="Email Address *">
                    <Input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="e.g. ramesh@grotec.local"
                    />
                  </Field>
                  <Field label="Phone Number">
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                    />
                  </Field>
                  <Field label="Password * (min 8 chars, 1 letter, 1 number)">
                    <Input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </Field>
                  <Field label="Residential Address">
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Street, City, PIN"
                    />
                  </Field>
                </div>
              )}

              {modalTab === 'employment' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Employee Code">
                      <Input
                        value={formData.employeeCode}
                        onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                        placeholder="e.g. EMP005"
                      />
                    </Field>
                    <Field label="Role *">
                      <Select
                        required
                        value={formData.roleId}
                        onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                      >
                        {roles.map((r: any) => (
                          <option key={r.id} value={r.id}>
                            {r.name || r.code}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Department">
                      <Input
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        placeholder="e.g. Calling / Operations"
                      />
                    </Field>
                    <Field label="Designation">
                      <Input
                        value={formData.designation}
                        onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                        placeholder="e.g. Telecaller / Field RM"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Joining Date">
                      <Input
                        type="date"
                        value={formData.joiningDate}
                        onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                      />
                    </Field>
                    <Field label="Prior Experience">
                      <Input
                        value={formData.experience}
                        onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                        placeholder="e.g. 2 years in Agri sales"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {modalTab === 'documents' && (
                <div className="space-y-4 text-center py-6">
                  <FileText className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="text-sm font-medium text-slate-700">KYC & Document Records</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Once the employee is created, upload Aadhar, PAN, degree certificates, and bank passbooks directly in the Documents tab on their profile.
                  </p>
                </div>
              )}

              {modalTab === 'notes' && (
                <div className="space-y-4">
                  <Field label="Internal HR Notes">
                    <textarea
                      rows={4}
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Add background notes, interview remarks, or onboarding instructions…"
                      className="w-full rounded-md border border-slate-300 p-2.5 text-sm"
                    />
                  </Field>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-6">
                <div>
                  {modalTab !== 'personal' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (modalTab === 'notes') setModalTab('documents');
                        else if (modalTab === 'documents') setModalTab('employment');
                        else if (modalTab === 'employment') setModalTab('personal');
                      }}
                    >
                      ← Back
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {modalTab !== 'notes' ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (modalTab === 'personal') setModalTab('employment');
                        else if (modalTab === 'employment') setModalTab('documents');
                        else if (modalTab === 'documents') setModalTab('notes');
                      }}
                    >
                      Next →
                    </Button>
                  ) : (
                    <Button type="submit" size="sm" disabled={saving}>
                      {saving ? 'Creating Employee…' : 'Complete & Save'}
                    </Button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
