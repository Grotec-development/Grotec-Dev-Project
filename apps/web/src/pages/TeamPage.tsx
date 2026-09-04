import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { Employee, Page } from '../lib/types';
import { ROLE_CODES, ROLE_LABELS } from '@grotec/shared';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner, Table, TD, TH, THead } from '../components/ui';
import { formatDate } from '../lib/format';

export function TeamPage() {
  const { user, hasPermission } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = hasPermission('employee.create');

  const { data, isError, error } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => (await api.get<Page<Employee>>('/employees', { params: { pageSize: 100 } })).data,
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Team</h1>
          <p className="text-sm text-slate-500">Shared employee identity — the same records the future HRMS will extend.</p>
        </div>
        {canCreate ? (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Add employee
          </Button>
        ) : null}
      </div>

      {isError ? <Alert tone="error">{errorMessage(error)}</Alert> : null}

      <Card>
        {!data ? (
          <Spinner />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Name</TH>
                <TH>Email</TH>
                <TH>Role</TH>
                <TH>Status</TH>
                <TH>Joined</TH>
              </tr>
            </THead>
            <tbody>
              {data.items.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-50">
                  <TD className="font-medium">
                    {employee.fullName}
                    {employee.id === user?.id ? <span className="ml-2 text-xs text-slate-400">(you)</span> : null}
                  </TD>
                  <TD>{employee.email}</TD>
                  <TD>
                    <Badge tone={employee.role.code === 'FOUNDER' ? 'amber' : employee.role.code === 'AGENT' ? 'green' : 'slate'}>
                      {employee.role.name}
                    </Badge>
                  </TD>
                  <TD>
                    {employee.status === 'ACTIVE' ? <Badge tone="green">Active</Badge> : <Badge tone="red">Inactive</Badge>}
                  </TD>
                  <TD className="text-xs text-slate-500">{formatDate(employee.createdAt)}</TD>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {showCreate ? <CreateEmployeeModal onClose={() => setShowCreate(false)} /> : null}
    </div>
  );
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
}

function CreateEmployeeModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const roles = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<RoleOption[]>('/roles')).data,
  });

  const defaultRoleId = (roles.data ?? []).find((r) => r.code === ROLE_CODES[2])?.id; // AGENT
  const effectiveRoleId = roleId || defaultRoleId || '';

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post<{ employee: Employee; temporaryPassword?: string }>('/employees', {
        fullName,
        email,
        roleId: effectiveRoleId,
        password: password || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (res.data.temporaryPassword) {
        setNotice(`Employee created. Temporary password: ${res.data.temporaryPassword} — share it once securely.`);
      } else {
        onClose();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-md">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Add employee</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {notice ? <Alert tone="info">{notice}</Alert> : null}
          <Field label="Full name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Role">
            <Select value={roleId || defaultRoleId || ''} onChange={(e) => setRoleId(e.target.value)}>
              <option value="" disabled>
                Choose role…
              </option>
              {(roles.data ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {ROLE_LABELS[role.code as keyof typeof ROLE_LABELS] ?? role.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Password (optional)" hint="Leave blank to receive a generated temporary password.">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            disabled={busy || fullName.trim().length < 2 || !email.includes('@') || !effectiveRoleId}
            onClick={() => void submit()}
          >
            {busy ? 'Saving…' : notice ? 'Done' : 'Create'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
