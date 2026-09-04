import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone as PhoneIcon, Plus, Sprout, Star, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Crop, CustomerDetail } from '../../lib/types';
import { formatDate, formatE164 } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Badge, Button, Card, CardHeader, Input, Select, Spinner, StatusBadge, Table, TD, TH, THead } from '../../components/ui';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canEdit = hasPermission('customer.update');

  const { data, isError, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => (await api.get<CustomerDetail>(`/customers/${id}`)).data,
    enabled: Boolean(id),
  });

  const cropsQuery = useQuery({
    queryKey: ['crops'],
    queryFn: async () => (await api.get<Crop[]>('/crops')).data,
    enabled: canEdit,
  });

  const toggleStatus = useMutation({
    mutationFn: async (activate: boolean) => {
      await api.post(`/customers/${id}/${activate ? 'activate' : 'deactivate'}`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customer', id] }),
  });

  if (!data) {
    return (
      <div className="p-8">
        {isError ? <Alert tone="error">{errorMessage(error)}</Alert> : <Spinner label="Loading profile…" />}
      </div>
    );
  }

  const canToggle = hasPermission('customer.deactivate');

  return (
    <div className="p-8">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/customers" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{data.fullName}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-sm text-slate-500">
            {data.farmerCode ?? 'No farmer ID'} · created {formatDate(data.createdAt)}
            {data.createdBy ? ` by ${data.createdBy.fullName}` : ''}
          </p>
        </div>
        <div className="ml-auto">
          {canToggle ? (
            toggleStatus.isPending ? (
              <span className="text-xs text-slate-400">updating…</span>
            ) : data.status === 'ACTIVE' ? (
              <Button variant="outline" onClick={() => toggleStatus.mutate(false)}>
                Deactivate
              </Button>
            ) : (
              <Button onClick={() => toggleStatus.mutate(true)}>Activate</Button>
            )
          ) : null}
        </div>
      </div>

      {toggleStatus.isError ? <div className="mb-4"><Alert tone="error">{errorMessage(toggleStatus.error)}</Alert></div> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <PhonesCard customerId={data.id} customer={data} canEdit={canEdit} />
        <LocationsCard customerId={data.id} customer={data} canEdit={canEdit} />
        <CropsCard customerId={data.id} customer={data} crops={cropsQuery.data ?? []} canEdit={canEdit} />
        <Card>
          <CardHeader title="Leads" />
          {data.leads.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400">No leads for this customer yet.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Status</TH>
                  <TH>Source</TH>
                  <TH>Owner</TH>
                  <TH>Opened</TH>
                </tr>
              </THead>
              <tbody>
                {data.leads.map((lead) => (
                  <tr key={lead.id}>
                    <TD>
                      <StatusBadge status={lead.status} />
                    </TD>
                    <TD>{lead.source ?? '—'}</TD>
                    <TD>{lead.currentOwner?.fullName ?? '—'}</TD>
                    <TD className="text-xs text-slate-500">{formatDate(lead.createdAt)}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Reusable mutation runner: POST/PATCH/DELETE then refresh the profile. */
function useCustomerMutation(customerId: string) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>) {
    setPending(key);
    setError(null);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }
  return { pending, error, setError, run };
}

function PhonesCard({ customerId, customer, canEdit }: { customerId: string; customer: CustomerDetail; canEdit: boolean }) {
  const { pending, error, run } = useCustomerMutation(customerId);
  const [number, setNumber] = useState('');
  const [makePrimary, setMakePrimary] = useState(false);

  async function addPhone() {
    if (!number.trim()) return;
    await run('add-phone', () => api.post(`/customers/${customerId}/phones`, { number: number.trim(), isPrimary: makePrimary || undefined }));
    if (!error) {
      setNumber('');
      setMakePrimary(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Contact"
        action={customer.phones.length > 1 ? <Badge tone="slate">{customer.phones.length} numbers</Badge> : <Badge tone="green">primary marked</Badge>}
      />
      {error ? <div className="px-4 pb-2"><Alert tone="error">{error}</Alert></div> : null}
      <ul className="divide-y divide-slate-100 px-4">
        {customer.phones.length === 0 ? <li className="py-4 text-sm text-slate-400">No phone numbers.</li> : null}
        {customer.phones.map((phone) => (
          <li key={phone.id} className="flex items-center gap-2.5 py-3 text-sm">
            <PhoneIcon className="h-4 w-4 text-slate-400" />
            <span className="font-medium">{formatE164(phone.phone)}</span>
            <Badge tone="slate">{phone.kind}</Badge>
            {phone.isPrimary ? <Badge tone="green">primary</Badge> : null}
            <span className="ml-auto flex items-center gap-1.5">
              {canEdit && !phone.isPrimary ? (
                <Button size="sm" variant="ghost" disabled={pending !== null} onClick={() => void run('primary', () => api.patch(`/customers/${customerId}/phones/${phone.id}`, { isPrimary: true }))}>
                  <Star className="h-3.5 w-3.5 text-amber-500" /> Make primary
                </Button>
              ) : null}
              {canEdit ? (
                <Button size="sm" variant="ghost" disabled={pending !== null} onClick={() => void run('remove', () => api.delete(`/customers/${customerId}/phones/${phone.id}`))}>
                  <Trash2 className="h-3.5 w-3.5 text-red-400" /> Remove
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
          <Input inputMode="tel" placeholder="+91 or 10-digit mobile" value={number} onChange={(e) => setNumber(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void addPhone()} className="flex-1" />
          <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-slate-600">
            <input type="checkbox" checked={makePrimary} onChange={(e) => setMakePrimary(e.target.checked)} className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600" />
            primary
          </label>
          <Button size="sm" disabled={!number.trim() || pending !== null} onClick={() => void addPhone()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function LocationsCard({ customerId, customer, canEdit }: { customerId: string; customer: CustomerDetail; canEdit: boolean }) {
  const { pending, error, run } = useCustomerMutation(customerId);
  const [form, setForm] = useState({ village: '', taluk: '', district: '', state: '', pincode: '' });

  async function addLocation() {
    if (!form.village.trim() && !form.district.trim() && !form.state.trim()) return;
    await run('add-loc', () =>
      api.post(`/customers/${customerId}/locations`, {
        village: form.village.trim() || undefined,
        taluk: form.taluk.trim() || undefined,
        district: form.district.trim() || undefined,
        state: form.state.trim() || undefined,
        pincode: form.pincode.trim() || undefined,
        isPrimary: customer.locations.length === 0 ? true : undefined,
      }),
    );
    if (!error) setForm({ village: '', taluk: '', district: '', state: '', pincode: '' });
  }

  return (
    <Card>
      <CardHeader title="Location" action={<MapPin className="h-4 w-4 text-slate-300" />} />
      {error ? <div className="px-4 pb-2"><Alert tone="error">{error}</Alert></div> : null}
      <ul className="divide-y divide-slate-100 px-4">
        {customer.locations.length === 0 ? <li className="py-4 text-sm text-slate-400">No location recorded.</li> : null}
        {customer.locations.map((location) => (
          <li key={location.id} className="flex items-center gap-2 py-3 text-sm text-slate-600">
            <MapPin className="h-4 w-4 shrink-0 text-slate-300" />
            <span className="flex-1">
              {[location.village, location.taluk, location.district, location.state, location.pincode].filter(Boolean).join(', ') || location.addressLine || '—'}
            </span>
            {location.isPrimary ? <Badge tone="green">primary</Badge> : null}
            {canEdit ? (
              <span className="flex shrink-0 items-center gap-1">
                {!location.isPrimary ? (
                  <Button size="sm" variant="ghost" disabled={pending !== null} onClick={() => void run('primary-loc', () => api.patch(`/customers/${customerId}/locations/${location.id}`, { isPrimary: true }))}>
                    <Star className="h-3.5 w-3.5 text-amber-500" /> Primary
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" disabled={pending !== null} onClick={() => void run('remove-loc', () => api.delete(`/customers/${customerId}/locations/${location.id}`))}>
                  <Trash2 className="h-3.5 w-3.5 text-red-400" /> Remove
                </Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {canEdit ? (
        <div className="space-y-2 border-t border-slate-100 px-4 py-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <Input placeholder="Village" value={form.village} onChange={(e) => setForm({ ...form, village: e.target.value })} />
            <Input placeholder="Taluk" value={form.taluk} onChange={(e) => setForm({ ...form, taluk: e.target.value })} />
            <Input placeholder="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} />
            <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <Input placeholder="Pincode" inputMode="numeric" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
          </div>
          <div className="flex justify-end">
            <Button size="sm" disabled={pending !== null} onClick={() => void addLocation()}>
              <Plus className="h-3.5 w-3.5" /> Add location
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function CropsCard({
  customerId,
  customer,
  crops,
  canEdit,
}: {
  customerId: string;
  customer: CustomerDetail;
  crops: Crop[];
  canEdit: boolean;
}) {
  const { pending, error, run } = useCustomerMutation(customerId);
  const [cropId, setCropId] = useState('');
  const [acreage, setAcreage] = useState('');
  const [unit, setUnit] = useState('acre');
  const [notes, setNotes] = useState('');

  async function addCrop() {
    const parsed = Number.parseFloat(acreage);
    if (!cropId || !Number.isFinite(parsed) || parsed <= 0) return;
    await run('add-crop', () =>
      api.post(`/customers/${customerId}/crops`, {
        cropId,
        acreage: parsed,
        unit,
        notes: notes.trim() || undefined,
      }),
    );
    if (!error) {
      setCropId('');
      setAcreage('');
      setNotes('');
    }
  }

  const existingCropIds = new Set(customer.crops.map((c) => c.crop.id));
  const addable = crops.filter((c) => c.isActive && !existingCropIds.has(c.id));

  return (
    <Card>
      <CardHeader title="Crops & acreage" action={<Sprout className="h-4 w-4 text-slate-300" />} />
      {error ? <div className="px-4 pb-2"><Alert tone="error">{error}</Alert></div> : null}
      {customer.crops.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-400">No crops recorded.</p>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Crop</TH>
              <TH>Acreage</TH>
              <TH>Notes</TH>
              {canEdit ? <TH className="text-right">Actions</TH> : null}
            </tr>
          </THead>
          <tbody>
            {customer.crops.map((crop) => (
              <tr key={crop.id}>
                <TD>
                  {crop.crop.name}
                  {crop.crop.localName ? <span className="ml-1 text-xs text-slate-400">({crop.crop.localName})</span> : null}
                </TD>
                <TD>
                  {crop.acreage} {crop.unit}
                </TD>
                <TD className="text-xs text-slate-500">{crop.notes ?? '—'}</TD>
                {canEdit ? (
                  <TD className="text-right">
                    <Button size="sm" variant="ghost" disabled={pending !== null} onClick={() => void run('remove-crop', () => api.delete(`/customers/${customerId}/crops/${crop.id}`))}>
                      <Trash2 className="h-3.5 w-3.5 text-red-400" /> Remove
                    </Button>
                  </TD>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {canEdit ? (
        <div className="space-y-2 border-t border-slate-100 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={cropId} onChange={(e) => setCropId(e.target.value)} className="min-w-44 flex-1">
              <option value="">Select crop…</option>
              {addable.map((crop) => (
                <option key={crop.id} value={crop.id}>
                  {crop.name}
                </option>
              ))}
            </Select>
            <Input type="number" inputMode="decimal" step="0.01" min="0.01" placeholder="Acreage" className="w-28" value={acreage} onChange={(e) => setAcreage(e.target.value)} />
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-24">
              <option value="acre">acre</option>
              <option value="hectare">hectare</option>
            </Select>
            <Button size="sm" disabled={!cropId || !acreage || pending !== null} onClick={() => void addCrop()}>
              <Plus className="h-3.5 w-3.5" /> Add crop
            </Button>
          </div>
          <Input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="text-xs" />
        </div>
      ) : null}
    </Card>
  );
}
