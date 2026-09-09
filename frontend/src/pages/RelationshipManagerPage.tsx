import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  CalendarClock,
  History,
  MapPin,
  Phone as PhoneIcon,
  Phone,
  Search,
  Sprout,
  StickyNote,
  UserRoundCheck,
  UserX,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { Call, CustomerDetail, CustomerNote, FollowUp, RelationshipHolder, RelationshipPortfolioItem } from '../lib/types';
import { formatDate, formatE164 } from '../lib/format';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, CardHeader, Field, Input, Select, Spinner, StatusBadge, cx } from '../components/ui';
import { OUTCOME_META } from './workspace/OutcomeFlow';

const OUTCOME_LABEL: Record<string, { label: string; tone: 'green' | 'red' | 'amber' | 'slate' }> = {
  INTERESTED: { label: 'Interested', tone: 'green' },
  NOT_INTERESTED: { label: 'Not interested', tone: 'red' },
  NOT_ANSWERED: { label: 'Not answered', tone: 'amber' },
};

type Tab = 'portfolio' | 'unassigned';

export function RelationshipManagerPage() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!hasPermission('relationship.read')) {
    return <Navigate to="/restricted" replace />;
  }

  const isFounder = user.roleCode === 'FOUNDER';
  const canManage = hasPermission('relationship.manage');
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('portfolio');
  const [categoryTab, setCategoryTab] = useState<'ALL' | 'EXISTING' | 'LEADS' | 'NEW'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [q, setQ] = useState('');
  const [rmFilter, setRmFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (tab === 'portfolio' && isFounder && rmFilter) params.set('rmId', rmFilter);
    if (tab === 'unassigned') params.set('unassigned', '1');
    const s = params.toString();
    return s ? `?${s}` : '';
  }, [tab, q, rmFilter, isFounder]);

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['relationship', tab, query],
    queryFn: async () => (await api.get<{ items: RelationshipPortfolioItem[] }>(`/relationship/customers${query}`)).data.items,
  });

  const holdersQuery = useQuery({
    queryKey: ['relationship-holders'],
    queryFn: async () => (await api.get<RelationshipHolder[]>('/relationship/holders')).data,
    enabled: isFounder,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['relationship'] });

  const refresh = (customerId: string | null) => {
    invalidate();
    setSelectedId(customerId);
  };

  const rawRows = data ?? [];

  const rows = useMemo(() => {
    return rawRows.filter((row) => {
      // Category filter
      if (categoryTab === 'EXISTING' && !row.customer.farmerCode) return false;
      if (categoryTab === 'LEADS' && row.customer.farmerCode) return false;
      if (categoryTab === 'NEW' && !row.convertedAt && !row.assignedAt) return false;

      // Status filter
      if (statusFilter === 'ACTIVE' && row.customer.status !== 'ACTIVE') return false;
      if (statusFilter === 'INTERESTED' && row.lastCall?.outcome !== 'INTERESTED') return false;
      if (statusFilter === 'FOLLOWUP' && row.pendingFollowUps <= 0) return false;
      if (statusFilter === 'CONVERTED' && !row.convertedAt) return false;
      if (statusFilter === 'NOT_ANSWERED' && row.lastCall?.status !== 'NOT_ANSWERED') return false;
      if (statusFilter === 'NOT_INTERESTED' && row.lastCall?.outcome !== 'NOT_INTERESTED') return false;

      return true;
    });
  }, [rawRows, categoryTab, statusFilter]);

  // Summary counts
  const totalCount = rawRows.length;
  const interestedCount = useMemo(() => rawRows.filter((r) => r.lastCall?.outcome === 'INTERESTED').length, [rawRows]);
  const overdueCount = useMemo(() => rawRows.reduce((acc, r) => acc + (r.pendingFollowUps || 0), 0), [rawRows]);
  const assignedCount = useMemo(() => rawRows.filter((r) => Boolean(r.owner)).length, [rawRows]);

  return (
    <div className="flex h-[calc(100vh-0px)] flex-col p-6">
      {/* Top Header: Title, Summary Counters & Primary CTA */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Field &amp; Account Management
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Customer Portfolio</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
            <UserRoundCheck className="h-6 w-6 text-emerald-700" />
            Relationship Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Relationship ownership of converted farmers — {isFounder ? 'team portfolio' : 'your assigned portfolio'}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Summary counters */}
          <div className="hidden lg:flex items-center gap-2 text-xs">
            <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
              <span className="text-sm font-black text-slate-900">{totalCount}</span>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block">Interested</span>
              <span className="text-sm font-black text-emerald-700">{interestedCount}</span>
            </div>
            <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-amber-700 block">Follow-ups</span>
              <span className="text-sm font-black text-amber-700">{overdueCount}</span>
            </div>
          </div>

          {/* Primary CTA: Start Calling */}
          <Button
            variant="call"
            size="sm"
            onClick={() => navigate('/agent')}
            className="font-bold shadow-xs px-3.5 py-2 text-xs shrink-0"
          >
            <Phone className="h-3.5 w-3.5 fill-current mr-1" />
            <span>Start Calling</span>
          </Button>
        </div>
      </div>

      {/* Category Tab Row & Controls */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Tabs (All, Existing, Prev. Leads, New Data) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start">
          {(['ALL', 'EXISTING', 'LEADS', 'NEW'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryTab(cat)}
              className={cx(
                'px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer',
                categoryTab === cat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900',
              )}
            >
              {cat === 'ALL' ? 'All' : cat === 'EXISTING' ? 'Existing' : cat === 'LEADS' ? 'Prev. Leads' : 'New Data'}
            </button>
          ))}

          <span className="text-slate-300 mx-1">|</span>

          {/* Sub-view: Portfolio vs Unassigned */}
          <button
            type="button"
            onClick={() => { setTab('portfolio'); setSelectedId(null); }}
            className={cx(
              'px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer',
              tab === 'portfolio' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            Portfolio ({isFounder ? 'All' : 'Mine'})
          </button>
          <button
            type="button"
            onClick={() => { setTab('unassigned'); setSelectedId(null); }}
            className={cx(
              'px-2.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer',
              tab === 'unassigned' ? 'bg-amber-50 text-amber-800 font-bold' : 'text-slate-500 hover:text-slate-800',
            )}
          >
            Unassigned
          </button>
        </div>

        {/* Search Bar & Status Filter */}
        <div className="flex items-center gap-2 self-stretch md:self-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-8 text-xs py-1.5"
              placeholder="Search farmers, phones..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-36 text-xs py-1.5"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INTERESTED">Interested</option>
            <option value="FOLLOWUP">Follow-up Due</option>
            <option value="CONVERTED">Converted</option>
            <option value="NOT_ANSWERED">No Response</option>
            <option value="NOT_INTERESTED">Not Interested</option>
          </Select>

          {isFounder && tab === 'portfolio' ? (
            <Select value={rmFilter} onChange={(e) => setRmFilter(e.target.value)} className="w-40 text-xs py-1.5">
              <option value="">All RM holders</option>
              {(holdersQuery.data ?? []).map((h) => (
                <option key={h.id} value={h.id}>
                  {h.fullName} ({h.customerCount})
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </div>

      {isError ? (
        <Alert tone="error">{errorMessage(error)}</Alert>
      ) : isPending ? (
        <Spinner label="Loading portfolio…" />
      ) : (
        <div className={cx('grid min-h-0 flex-1 gap-4', selectedId ? 'xl:grid-cols-[minmax(0,1fr)_440px]' : '')}>
          <Card className="flex min-h-0 flex-col">
            <CardHeader
              title={tab === 'portfolio' ? 'Relationship customers' : 'Converted, no RM assigned'}
              action={<Badge tone="slate">{rows.length}</Badge>}
            />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <div className="px-4 py-12 text-center text-xs text-slate-400">
                  {tab === 'portfolio'
                    ? 'No customers under relationship ownership yet. Record an Interested → Sales outcome in the Agent workspace to convert one.'
                    : 'Every converted customer has an RM assigned.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Customer</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Phone</th>
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Last Contact</th>
                        <th className="py-2.5 px-3">Follow-up</th>
                        <th className="py-2.5 px-3">Requirement</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((row) => {
                        const isSelected = selectedId === row.customer.id;

                        return (
                          <tr
                            key={row.customer.id}
                            onClick={() => setSelectedId(isSelected ? null : row.customer.id)}
                            className={cx(
                              'cursor-pointer transition-colors',
                              isSelected ? 'bg-emerald-50/80 font-medium' : 'hover:bg-slate-50/70',
                            )}
                          >
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              <div>{row.customer.fullName}</div>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {row.customer.farmerCode || '—'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 text-slate-600">
                              <span className="text-[11px]">
                                {row.customer.farmerCode ? 'Farmer' : 'Conversion'}
                              </span>
                            </td>

                            <td className="py-2.5 px-3 font-mono text-slate-700">
                              {row.customer.primaryPhone ? formatE164(row.customer.primaryPhone) : '—'}
                            </td>

                            <td className="py-2.5 px-3 text-slate-500 max-w-[140px] truncate">
                              {row.customer.location
                                ? [row.customer.location.village, row.customer.location.district].filter(Boolean).join(', ')
                                : '—'}
                            </td>

                            <td className="py-2.5 px-3">
                              <StatusBadge status={row.customer.status} />
                            </td>

                            <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                              {row.lastCall ? formatDate(row.lastCall.startedAt) : '—'}
                            </td>

                            <td className="py-2.5 px-3">
                              {row.pendingFollowUps > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                  <CalendarClock className="h-3 w-3" /> {row.pendingFollowUps} due
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px]">None</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-slate-600 max-w-[150px] truncate">
                              {row.customer.crops.length > 0 ? (
                                row.customer.crops.map((c) => `${c.name} (${c.acreage}${c.unit})`).join(', ')
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-right">
                              <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {row.customer.primaryPhone && (
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/agent?phone=${encodeURIComponent(row.customer.primaryPhone!)}&name=${encodeURIComponent(row.customer.fullName)}`)}
                                    title="Call farmer"
                                    className="p-1.5 rounded text-emerald-700 hover:bg-emerald-50 border border-emerald-200 transition"
                                  >
                                    <Phone className="h-3.5 w-3.5 fill-current" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(isSelected ? null : row.customer.id)}
                                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
                                >
                                  {isSelected ? 'Close' : 'View'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {selectedId ? (
            <RMCustomerPanel
              key={selectedId}
              customerId={selectedId}
              isFounder={isFounder}
              canManage={canManage}
              currentHolder={rows.find((r) => r.customer.id === selectedId)?.owner ?? null}
              onChanged={(customerId) => refresh(customerId)}
              onClose={() => setSelectedId(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function callTone(status: string) {
  if (status === 'CONNECTED' || status === 'ENDED') return 'green' as const;
  if (status === 'NOT_ANSWERED') return 'amber' as const;
  return 'slate' as const;
}

function RMCustomerPanel({
  customerId,
  isFounder,
  canManage,
  currentHolder,
  onChanged,
  onClose,
}: {
  customerId: string;
  isFounder: boolean;
  canManage: boolean;
  currentHolder: { id: string; fullName: string } | null;
  onChanged: (customerId: string) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => (await api.get<CustomerDetail>(`/customers/${customerId}`)).data,
  });
  const notesQuery = useQuery({
    queryKey: ['customer-notes', customerId],
    queryFn: async () => (await api.get<CustomerNote[]>(`/customers/${customerId}/notes`)).data,
  });
  const followUpsQuery = useQuery({
    queryKey: ['customer-followups', customerId],
    queryFn: async () => (await api.get<FollowUp[]>(`/follow-ups?customerId=${customerId}`)).data,
  });
  const callsQuery = useQuery({
    queryKey: ['customer-calls', customerId],
    queryFn: async () => (await api.get<Call[]>(`/customers/${customerId}/calls`)).data,
  });

  const [noteDraft, setNoteDraft] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [reason, setReason] = useState('');
  const holdersQuery = useQuery({
    queryKey: ['relationship-holders'],
    queryFn: async () => (await api.get<RelationshipHolder[]>('/relationship/holders')).data,
    enabled: canManage,
  });

  const refreshCustomer = () => {
    void queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] });
    void queryClient.invalidateQueries({ queryKey: ['customer-followups', customerId] });
    void queryClient.invalidateQueries({ queryKey: ['customer-calls', customerId] });
    onChanged(customerId);
  };

  const addNote = useMutation({
    mutationFn: async (body: string) => api.post(`/customers/${customerId}/notes`, { body }),
    onSuccess: () => {
      setNoteDraft('');
      void queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] });
      onChanged(customerId);
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  const completeFollowUp = useMutation({
    mutationFn: async (id: string) => api.post(`/follow-ups/${id}/complete`),
    onSuccess: refreshCustomer,
    onError: (err) => setActionError(errorMessage(err)),
  });

  const profile = profileQuery.data;

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader title={profile?.fullName ?? 'Customer'} action={
        <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
      } />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {actionError ? <Alert tone="error">{actionError}</Alert> : null}

        {profileQuery.isPending ? <Spinner label="Loading profile…" /> : profile ? (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">{profile.farmerCode}</span>
              <StatusBadge status={profile.status} />
              {currentHolder ? (
                <Badge tone="green">
                  <UserRoundCheck className="mr-1 inline h-3 w-3" /> {currentHolder.fullName}
                </Badge>
              ) : (
                <Badge tone="amber">No relationship manager</Badge>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {profile.phones.map((p) => formatE164(p.phone)).join(' · ') || 'no phone'}
            </p>
            {profile.locations.map((l) => (
              <p key={l.id} className="flex items-start gap-1.5 text-xs text-slate-500">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {[l.village, l.taluk, l.district, l.state, l.pincode].filter(Boolean).join(', ') || l.addressLine}
              </p>
            ))}
            {profile.crops.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.crops.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                    <Sprout className="h-3 w-3" /> {c.crop.name} · {c.acreage} {c.unit}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-1.5">
              {profile.leads.map((lead) => (
                <span key={lead.id} className="text-[11px] text-slate-400">
                  lead {lead.source ?? '—'} <StatusBadge status={lead.status} />
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Ownership actions */}
        {canManage ? (
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              <ArrowLeftRight className="mr-1 inline h-3 w-3" /> Ownership
            </p>
            {currentHolder && !isFounder && currentHolder.id !== user?.id ? (
              <p className="mb-2 text-xs text-slate-500">You can manage ownership of customers in your own portfolio only.</p>
            ) : null}
            <div className="space-y-2">
              <Field label="Relationship manager">
                <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Select an RM…</option>
                  {(holdersQuery.data ?? []).map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.fullName} — {h.customerCount} customers
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reason (optional)">
                <Input placeholder={currentHolder ? 'e.g. regional split, farmer request' : 'e.g. claim after release'} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!assigneeId || assigning}
                  onClick={() => {
                    if (!assigneeId) return;
                    setAssigning(true);
                    setActionError(null);
                    void api
                      .post(`/relationship/customers/${customerId}/assign`, { employeeId: assigneeId, reason: reason.trim() || undefined })
                      .then(() => {
                        setAssigneeId('');
                        setReason('');
                        refreshCustomer();
                      })
                      .catch((err) => setActionError(errorMessage(err)))
                      .finally(() => setAssigning(false));
                  }}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  {currentHolder ? 'Reassign' : 'Assign RM'}
                </Button>
                {currentHolder ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={assigning}
                    onClick={() => {
                      setAssigning(true);
                      setActionError(null);
                      void api
                        .post(`/relationship/customers/${customerId}/release`, { reason: reason.trim() || undefined })
                        .then(() => {
                          setReason('');
                          refreshCustomer();
                        })
                        .catch((err) => setActionError(errorMessage(err)))
                        .finally(() => setAssigning(false));
                    }}
                  >
                    <UserX className="h-3.5 w-3.5" /> Release
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Follow-ups */}
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <CalendarClock className="h-3 w-3" /> Follow-ups
          </p>
          {followUpsQuery.isPending ? (
            <Spinner label="…" />
          ) : (followUpsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">No follow-ups scheduled.</p>
          ) : (
            <ul className="space-y-1.5">
              {(followUpsQuery.data ?? []).slice(0, 8).map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-2 rounded-md border border-slate-100 px-2.5 py-2 text-xs">
                  <div>
                    <p className="font-medium text-slate-700">{formatDate(f.dueAt)}</p>
                    <p className="mt-0.5 text-slate-500">{f.note}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge tone={f.status === 'COMPLETED' ? 'green' : f.status === 'CANCELLED' ? 'slate' : 'amber'}>{f.status.replace('_', ' ')}</Badge>
                    {f.status === 'PENDING' ? (
                      <button
                        type="button"
                        className="rounded border border-slate-200 px-1.5 py-0.5 font-medium text-slate-500 hover:bg-slate-50"
                        onClick={() => completeFollowUp.mutate(f.id)}
                      >
                        Complete
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notes */}
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <StickyNote className="h-3 w-3" /> Notes
          </p>
          <div className="mb-2 flex gap-2">
            <Input placeholder="Add a note about this farmer…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && noteDraft.trim() && addNote.mutate(noteDraft.trim())} />
            <Button size="sm" disabled={!noteDraft.trim() || addNote.isPending} onClick={() => addNote.mutate(noteDraft.trim())}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          {notesQuery.isPending ? (
            <Spinner label="…" />
          ) : (notesQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">No notes yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {(notesQuery.data ?? []).slice(0, 10).map((n) => (
                <li key={n.id} className="rounded-md bg-slate-50 px-2.5 py-2 text-xs">
                  <p className="text-slate-700">{n.body}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{n.author.fullName} · {formatDate(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Call history */}
        <div>
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <History className="h-3 w-3" /> Call history
          </p>
          {callsQuery.isPending ? (
            <Spinner label="…" />
          ) : (callsQuery.data ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">No calls recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {(callsQuery.data ?? []).slice(0, 6).map((call) => (
                <li key={call.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-2.5 py-2 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <PhoneIcon className="h-3 w-3 text-slate-400" />
                    {formatE164(call.phoneNumber)}
                    <span className="text-slate-400">· {formatDate(call.startedAt)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {call.outcome ? <Badge tone={OUTCOME_META[call.outcome].tone}>{OUTCOME_META[call.outcome].label}</Badge> : null}
                    {call.status === 'CONNECTED' || call.status === 'ENDED' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
