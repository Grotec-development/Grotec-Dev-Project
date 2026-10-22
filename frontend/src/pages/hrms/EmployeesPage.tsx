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
import { validatePersonName } from '../../lib/validation';
import { describeApiError } from '../../lib/errors';
import { PasswordInput } from '../../components/PasswordInput';
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
  const { user, hasPermission } = useAuth();
  const canAccessExEmployees = user?.roleCode === 'FOUNDER' || user?.roleCode === 'MANAGER' || user?.roleCode === 'SUPER_ADMIN';
  const [currentTab, setCurrentTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');

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
    bloodGroup: '',
    aadhaarNumber: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const [empRes, roleRes] = await Promise.all([
        api.get('/employees', {
          params: {
            q: search || undefined,
            status: statusFilter || undefined,
            archived: currentTab === 'ARCHIVED' ? 'true' : undefined,
            pageSize: 100,
          },
        }),
        // Every role that exists, not just ones an employee already has —
        // otherwise a freshly-added role (e.g. Super Admin) can never be
        // assigned to a first employee from this dropdown.
        api.get('/employees/roles').catch(() => null),
      ]);
      setEmployees(empRes.data.items || []);
      setRoles(roleRes?.data || []);
    } catch (err: any) {
      setError(describeApiError(err, 'Failed to load employees'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEmployees();
  }, [search, statusFilter, currentTab]);

  const handlePermanentRemove = async (emp: any) => {
    if (!window.confirm(`Are you sure you want to permanently remove/relieve ${emp.fullName}? They will be removed from the active directory and archived into Ex-Employees History.`)) return;
    try {
      await api.delete(`/employees/${emp.id}`);
      void fetchEmployees();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to remove employee');
    }
  };

  const handleOpenAddModal = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      password: '',
      roleId: roles[0]?.id || '',
      employeeCode: `EMP${String(employees.length + 1).padStart(3, '0')}`,
      designation: '',
      department: '',
      joiningDate: new Date().toISOString().slice(0, 10),
      experience: '',
      address: '',
      bloodGroup: '',
      aadhaarNumber: '',
      notes: '',
    });
    setConfirmPassword('');
    setNameError(null);
    setPasswordError(null);
    setFormError(null);
    setModalTab('personal');
    setIsModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    // Validate person name (BUG-016)
    const nameVal = validatePersonName(formData.fullName);
    if (!nameVal.valid) {
      setNameError(nameVal.error || 'Invalid full name');
      setModalTab('personal');
      return;
    }
    setNameError(null);

    // Validate password if supplied (BUG-018)
    if (formData.password) {
      if (formData.password.length < 8) {
        setPasswordError('Password must be at least 8 characters');
        setModalTab('personal');
        return;
      }
      if (formData.password !== confirmPassword) {
        setPasswordError('Passwords do not match');
        setModalTab('personal');
        return;
      }
    }
    setPasswordError(null);

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        ...formData,
        fullName: formData.fullName.trim(),
        password: formData.password || undefined,
      };
      const res = await api.post('/employees', payload);
      setIsModalOpen(false);
      if (res.data?.temporaryPassword) {
        alert(
          `Employee created successfully!\n\nTemporary Password: ${res.data.temporaryPassword}\n\nPlease share this one-time password securely with the employee.`
        );
      }
      void fetchEmployees();
    } catch (err: any) {
      setFormError(describeApiError(err, 'Failed to create employee'));
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
            Unified directory for CRM telecallers, agronomists, field executives, and operations staff.
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

      {/* Tabs for Manager / Founder */}
      {canAccessExEmployees && (
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setCurrentTab('ACTIVE')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              currentTab === 'ACTIVE'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="h-4 w-4" />
            Active Staff Directory
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('ARCHIVED')}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              currentTab === 'ARCHIVED'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserX className="h-4 w-4 text-amber-600" />
            Ex-Employees & History
            <span className="ml-1 text-[10px]"><Badge tone="slate">Founder & Manager Only</Badge></span>
          </button>
        </div>
      )}

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
          {currentTab === 'ACTIVE' && (
            <div>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
          )}
        </div>
      </Card>

      {/* Employee List Table */}
      <Card>
        <CardHeader
          title={
            currentTab === 'ACTIVE'
              ? `Active Staff Directory (${filteredEmployees.length})`
              : `Ex-Employees History (${filteredEmployees.length})`
          }
        />
        {currentTab === 'ARCHIVED' && (
          <p className="px-5 pb-2 text-xs text-slate-500">
            Permanently relieved staff records. Work history, call recordings, orders, and audits remain strictly preserved.
          </p>
        )}
        {loading && employees.length === 0 ? (
          <Spinner label="Loading employees…" />
        ) : filteredEmployees.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            {currentTab === 'ACTIVE'
              ? 'No active employees match the selected criteria'
              : 'No archived ex-employees found'}
          </div>
        ) : currentTab === 'ACTIVE' ? (
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
                    <div className="flex items-center gap-3">
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
                          className="text-xs text-slate-500 hover:text-slate-800"
                        >
                          {emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      {canAccessExEmployees && (
                        <button
                          type="button"
                          onClick={() => handlePermanentRemove(emp)}
                          className="text-xs font-medium text-rose-600 hover:text-rose-800"
                          title="Relieve/Remove staff permanently to Ex-Employees History"
                        >
                          Relieve / Remove
                        </button>
                      )}
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Former Staff & Email</TH>
                <TH>Department & Role</TH>
                <TH>Relieved Date</TH>
                <TH>Historical Work Records</TH>
                <TH>Actions</TH>
              </tr>
            </THead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50 bg-slate-50/50">
                  <TD className="font-mono text-xs text-slate-500 font-semibold">
                    {emp.employeeCode || '—'}
                  </TD>
                  <TD>
                    <div className="font-medium text-slate-800">{emp.fullName}</div>
                    <div className="text-xs text-slate-400">{emp.email}</div>
                  </TD>
                  <TD>
                    <div className="text-xs text-slate-700">{emp.department || 'General'}</div>
                    <div className="text-xs text-slate-400">{emp.role?.name || emp.role?.code}</div>
                  </TD>
                  <TD className="text-xs text-slate-600">
                    {emp.deletedAt ? new Date(emp.deletedAt).toLocaleDateString() : 'Archived'}
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Preserved: Calls, Orders & Audit Records
                    </span>
                  </TD>
                  <TD>
                    <Link
                      to={`/hrms/employees/${emp.id}`}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-800"
                    >
                      View History & Records →
                    </Link>
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
              {formError && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-800">
                  <span>{formError}</span>
                  <button
                    type="button"
                    onClick={() => setFormError(null)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {modalTab === 'personal' && (
                <div className="space-y-4">
                  <Field label="Full Name *" error={nameError}>
                    <Input
                      required
                      value={formData.fullName}
                      onChange={(e) => {
                        setFormData({ ...formData, fullName: e.target.value });
                        if (nameError) setNameError(null);
                      }}
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
                  <PasswordInput
                    label="Password (optional)"
                    hint="Leave blank to let the system generate a secure temporary password."
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      if (passwordError) setPasswordError(null);
                    }}
                    error={passwordError}
                  />
                  {formData.password ? (
                    <PasswordInput
                      label="Confirm Password *"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (passwordError) setPasswordError(null);
                      }}
                      placeholder="Re-enter password to confirm"
                    />
                  ) : null}
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Blood Group">
                      <Select
                        value={formData.bloodGroup}
                        onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                      >
                        <option value="">(Select Blood Group)</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </Select>
                    </Field>
                    <Field label="Aadhaar Number">
                      <Input
                        value={formData.aadhaarNumber}
                        onChange={(e) => setFormData({ ...formData, aadhaarNumber: e.target.value })}
                        placeholder="12-digit Aadhaar"
                        maxLength={20}
                      />
                    </Field>
                  </div>
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
