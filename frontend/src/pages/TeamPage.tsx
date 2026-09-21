import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Edit2, Shield, Check, CheckSquare, Square } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { Employee, Page } from '../lib/types';
import { ROLE_CODES, ROLE_LABELS } from '@grotec/shared';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, Spinner, Table, TD, TH, THead, cx } from '../components/ui';
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

      <RolesPermissionsCard />

      {showCreate ? <CreateEmployeeModal onClose={() => setShowCreate(false)} /> : null}
    </div>
  );
}

interface RoleOption {
  id: string;
  code: string;
  name: string;
  permissions?: { code: string; label?: string; category?: string; module?: string; description?: string }[];
}

/**
 * Interactive Roles & Permissions Configuration Panel:
 * Allows Super Admin & Founders to dynamically assign permissions
 * stored in the database without code changes or redeployment.
 */
function RolesPermissionsCard() {
  const { user } = useAuth();
  const [editingRole, setEditingRole] = useState<RoleOption | null>(null);

  const { data, isError, error } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<RoleOption[]>('/roles')).data,
  });

  const canEditPermissions = user?.roleCode === 'FOUNDER' || user?.roleCode === 'SUPER_ADMIN';

  return (
    <Card className="mt-6">
      <CardHeader title="Roles & Permissions Configuration" />
      {isError ? (
        <div className="px-5 py-4">
          <Alert tone="error">{errorMessage(error)}</Alert>
        </div>
      ) : !data ? (
        <div className="px-5 py-4">
          <Spinner label="Loading roles…" />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {data.map((role) => {
            const grouped = new Map<string, { code: string; description: string }[]>();
            for (const perm of role.permissions ?? []) {
              const moduleKey = perm.category || perm.module || 'General';
              const list = grouped.get(moduleKey) ?? [];
              list.push({ code: perm.code, description: perm.description || perm.label || perm.code });
              grouped.set(moduleKey, list);
            }
            const total = role.permissions?.length ?? 0;
            return (
              <div key={role.id} className="px-5 py-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone={role.code === 'FOUNDER' || role.code === 'SUPER_ADMIN' ? 'amber' : role.code === 'AGENT' || role.code === 'FSE' ? 'green' : 'slate'}>
                      {ROLE_LABELS[role.code as keyof typeof ROLE_LABELS] ?? role.name}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {total} permission{total === 1 ? '' : 's'}
                    </span>
                  </div>

                  {canEditPermissions && role.code !== 'SUPER_ADMIN' && (
                    <button
                      type="button"
                      onClick={() => setEditingRole(role)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100/70 border border-emerald-200 px-2.5 py-1 rounded-md transition"
                    >
                      <Edit2 className="h-3 w-3" /> Edit Permissions
                    </button>
                  )}
                </div>

                {grouped.size === 0 ? (
                  <p className="text-xs text-slate-400">No permissions granted.</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...grouped.entries()]
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([module, perms]) => (
                        <div key={module} className="flex flex-wrap items-baseline gap-1.5">
                          <span className="w-28 shrink-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            {module}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {perms
                              .sort((a, b) => a.code.localeCompare(b.code))
                              .map((perm) => (
                                <span
                                  key={perm.code}
                                  title={perm.description}
                                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                                >
                                  {perm.code}
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingRole && (
        <EditRolePermissionsModal
          role={editingRole}
          onClose={() => setEditingRole(null)}
        />
      )}
    </Card>
  );
}

interface EditRolePermissionsModalProps {
  role: RoleOption;
  onClose: () => void;
}

function EditRolePermissionsModal({ role, onClose }: EditRolePermissionsModalProps) {
  const queryClient = useQueryClient();
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(
    () => new Set(role.permissions?.map((p) => p.code) ?? [])
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissionsQuery = useQuery({
    queryKey: ['all-system-permissions'],
    queryFn: async () => {
      const res = await api.get<Array<{ id: string; code: string; label: string | null; category: string; description: string | null }>>('/roles/permissions');
      return res.data;
    },
  });

  const togglePermission = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleCategory = (categoryCodes: string[]) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      const allSelected = categoryCodes.every((c) => next.has(c));
      if (allSelected) {
        categoryCodes.forEach((c) => next.delete(c));
      } else {
        categoryCodes.forEach((c) => next.add(c));
      }
      return next;
    });
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/roles/${role.id}/permissions`, {
        permissionCodes: Array.from(selectedCodes),
      });
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    } catch (err) {
      setError(errorMessage(err) || 'Failed to update permissions');
    } finally {
      setBusy(false);
    }
  };

  // Group permissions by category
  const grouped = new Map<string, Array<{ code: string; label: string | null; description: string | null }>>();
  for (const perm of permissionsQuery.data ?? []) {
    const cat = perm.category || 'General';
    const list = grouped.get(cat) ?? [];
    list.push(perm);
    grouped.set(cat, list);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Configure Permissions: {ROLE_LABELS[role.code as keyof typeof ROLE_LABELS] ?? role.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select or remove permissions dynamically. Changes take effect on next login.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          {permissionsQuery.isLoading ? (
            <div className="py-12 text-center">
              <Spinner label="Loading system permissions..." />
            </div>
          ) : (
            <div className="space-y-4">
              {[...grouped.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([category, perms]) => {
                  const categoryCodes = perms.map((p) => p.code);
                  const selectedCount = categoryCodes.filter((c) => selectedCodes.has(c)).length;
                  const allSelected = selectedCount === categoryCodes.length;

                  return (
                    <div key={category} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                            {category}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-400">
                            ({selectedCount}/{categoryCodes.length})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleCategory(categoryCodes)}
                          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          {allSelected ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {perms.map((perm) => {
                          const isChecked = selectedCodes.has(perm.code);
                          return (
                            <label
                              key={perm.code}
                              className={cx(
                                'flex items-start gap-2 p-2 rounded-md border text-xs cursor-pointer transition',
                                isChecked
                                  ? 'bg-white border-emerald-300 text-emerald-900 shadow-2xs'
                                  : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(perm.code)}
                                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                              <div>
                                <div className="font-mono text-[11px] font-bold">{perm.code}</div>
                                <div className="text-[11px] text-slate-500 leading-snug">
                                  {perm.description || perm.label || ''}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 bg-slate-50">
          <span className="text-xs text-slate-500 font-medium">
            {selectedCodes.size} permission{selectedCodes.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={busy}>
              {busy ? 'Saving...' : 'Save Permissions'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
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
