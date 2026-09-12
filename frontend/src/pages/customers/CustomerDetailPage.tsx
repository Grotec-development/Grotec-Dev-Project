import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone as PhoneIcon, Plus, Sprout, Star, Trash2, Calendar, FileText, ShoppingBag, PhoneCall } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Crop, CustomerDetail, Lead, Page, Referral } from '../../lib/types';
import { formatDate, formatE164 } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Badge, Button, Card, CardHeader, ConfirmModal, Field, Input, Select, Spinner, StatusBadge, Table, TD, TH, THead, cx } from '../../components/ui';

interface PurchaseRecord {
  id: string;
  date: string;
  product: string;
  qty: string;
  amount: string;
}

const MOCK_PURCHASES: PurchaseRecord[] = [
  { id: '1', date: '02 Mar 2026', product: 'Grotec Trishul (Granules)', qty: '2 bags', amount: '₹ 1,850' },
  { id: '2', date: '15 Jan 2026', product: 'Azos Bio-Fertilizer', qty: '4 litres', amount: '₹ 1,200' },
  { id: '3', date: '10 Nov 2025', product: 'Bio Jeevan PF (Liquid)', qty: '2 litres', amount: '₹ 980' },
];

interface TimelineEvent {
  id: string;
  actor: string;
  role: string;
  timestamp: string;
  note: string;
}

const MOCK_TIMELINE: TimelineEvent[] = [
  {
    id: '1',
    actor: 'Priya S.',
    role: 'Telecaller',
    timestamp: '02 Mar 2026, 11:30 AM',
    note: 'Farmer confirmed delivery of Trishul granules. Advised application at base root area during morning watering cycle.',
  },
  {
    id: '2',
    actor: 'Suresh M.',
    role: 'Agronomy Specialist',
    timestamp: '12 Feb 2026, 04:15 PM',
    note: 'On-field inspection completed. Soil moisture found low. Recommended drip calibration.',
  },
  {
    id: '3',
    actor: 'Priya S.',
    role: 'Telecaller',
    timestamp: '15 Jan 2026, 09:45 AM',
    note: 'Placed order for Azos bio-fertilizer. Demanded immediate dispatch due to pest/disease alert in surrounding Dharmapuri tomato cluster.',
  },
];

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canEdit = hasPermission('customer.update');
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'land_crops' | 'advisory_notes'>('overview');
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

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
  const primaryPhone = data.phones?.find((p) => p.isPrimary)?.phone || data.phones?.[0]?.phone || '';

  const handleCallNow = () => {
    navigate(`/agent?phone=${encodeURIComponent(primaryPhone)}&name=${encodeURIComponent(data.fullName)}`);
  };

  const primaryCropNames = data.crops?.map((c) => c.crop.name).join(', ') || 'Tomato (PKM-1), Brinjal';
  const primaryLocation = data.locations?.[0]
    ? `${data.locations[0].village || ''} ${data.locations[0].district || 'Dharmapuri'}, ${data.locations[0].state || 'Tamil Nadu'}`.trim()
    : 'Dharmapuri, Tamil Nadu';

  return (
    <div className="p-6 space-y-4">
      {/* Top Breadcrumb / Back Bar */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/customers" className="flex items-center gap-1 hover:text-slate-800 transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Farmer Directory
        </Link>
      </div>

      {/* Header Banner matching PDF Farmer Profile / CRM Record */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-xs flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{data.fullName}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-xs text-slate-600 font-medium">
            {primaryLocation} • Sowing Sundergarh tomato seeds
          </p>
          <p className="text-xs text-slate-400 font-mono">
            ID: <span className="font-semibold text-slate-700">{data.farmerCode ?? 'GT-F-2289'}</span>
            <span className="mx-2 text-slate-300">•</span>
            Phone: <span className="font-semibold text-slate-700">{primaryPhone ? formatE164(primaryPhone) : '+91 94432 12091'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canToggle ? (
            <Button
              variant="outline"
              size="sm"
              disabled={toggleStatus.isPending}
              onClick={() => {
                if (data.status === 'ACTIVE') {
                  setShowDeactivateConfirm(true);
                } else {
                  toggleStatus.mutate(true);
                }
              }}
              className="text-xs"
            >
              {data.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          ) : null}

          <Button
            variant="call"
            size="md"
            onClick={handleCallNow}
            className="px-4 py-2 text-xs font-bold shadow-xs bg-emerald-700 hover:bg-emerald-800 text-white"
            aria-label={`Call ${data.fullName}`}
          >
            <PhoneCall className="h-3.5 w-3.5 fill-current" /> Call Farmer
          </Button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeactivateConfirm}
        onClose={() => setShowDeactivateConfirm(false)}
        onConfirm={async () => {
          await toggleStatus.mutateAsync(false);
          setShowDeactivateConfirm(false);
        }}
        title={`Deactivate ${data?.fullName || 'Farmer Profile'}`}
        variant="danger"
        confirmLabel="Deactivate Farmer"
        isLoading={toggleStatus.isPending}
        description={
          <div className="space-y-2">
            <p>
              Are you sure you want to mark <strong>{data.fullName}</strong> as inactive?
            </p>
            <p className="text-slate-500">
              This will pause upcoming agronomy advisory callbacks and remove this farmer from active telecaller queues. You can reactivate this profile anytime.
            </p>
          </div>
        }
      />

      {toggleStatus.isError ? (
        <Alert tone="error">{errorMessage(toggleStatus.error)}</Alert>
      ) : null}

      {/* Tabbed Navigation matching PDF */}
      <div className="border-b border-slate-200 bg-white px-2 rounded-t-lg shadow-2xs">
        <nav className="flex space-x-6 text-xs font-semibold" aria-label="Tabs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cx(
              'border-b-2 py-3 px-1 transition-colors',
              activeTab === 'overview'
                ? 'border-brand-600 text-brand-700 font-bold'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={cx(
              'border-b-2 py-3 px-1 transition-colors',
              activeTab === 'invoices'
                ? 'border-brand-600 text-brand-700 font-bold'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            Invoices / Shipments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('land_crops')}
            className={cx(
              'border-b-2 py-3 px-1 transition-colors',
              activeTab === 'land_crops'
                ? 'border-brand-600 text-brand-700 font-bold'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            Land &amp; Crops
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('advisory_notes')}
            className={cx(
              'border-b-2 py-3 px-1 transition-colors',
              activeTab === 'advisory_notes'
                ? 'border-brand-600 text-brand-700 font-bold'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
            )}
          >
            Advisory Notes
          </button>
        </nav>
      </div>

      {/* Tab Content: Overview (Default matching PDF) */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Farm Profile + Purchase History (~60% width) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Card 1: Farm & Agricultural Profile */}
            <Card className="p-4 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 border-b border-slate-100 pb-2">
                Farm &amp; Agricultural Profile
              </h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Crops Sown</p>
                  <p className="text-slate-800 font-bold mt-0.5">{primaryCropNames}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Land Holding</p>
                  <p className="text-slate-800 font-bold mt-0.5">3.5 Acres</p>
                </div>
                <SoilTypeField customerId={data.id} soilType={data.soilType} canEdit={canEdit} />
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Irrigation</p>
                  <p className="text-slate-800 font-bold mt-0.5">Drip irrigation (Subsidy)</p>
                </div>
              </div>
            </Card>

            {/* Card 2: Agro-Input Purchase History */}
            <Card className="shadow-xs overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3 bg-white">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Agro-Input Purchase History
                </h2>
              </div>
              <Table>
                <THead>
                  <tr>
                    <TH>DATE</TH>
                    <TH>PRODUCT</TH>
                    <TH>QTY</TH>
                    <TH>AMOUNT</TH>
                  </tr>
                </THead>
                <tbody className="divide-y divide-slate-100">
                  {MOCK_PURCHASES.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <TD className="text-slate-500 font-mono text-[11px]">{p.date}</TD>
                      <TD className="font-semibold text-slate-800">{p.product}</TD>
                      <TD className="text-slate-600">{p.qty}</TD>
                      <TD className="font-bold text-slate-900">{p.amount}</TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          </div>

          {/* Right Column: Call History Timeline (~40% width) */}
          <div className="lg:col-span-5">
            <Card className="shadow-xs overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3 bg-white">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Call History Timeline
                </h2>
              </div>
              <div className="divide-y divide-slate-100 p-2">
                {MOCK_TIMELINE.map((item) => (
                  <div key={item.id} className="p-3 hover:bg-slate-50/50 rounded-md transition-colors space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <span>{item.actor}</span>
                        <span className="text-slate-400 font-normal">({item.role})</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[10px]">{item.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                      {item.note}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab Content: Invoices / Shipments */}
      {activeTab === 'invoices' && (
        <Card className="p-5 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">Shipment &amp; Delivery Status</h3>
          <p className="text-xs text-slate-500 mb-4">Tracking shipments dispatched from regional agro-hubs.</p>
          <div className="rounded-md border border-slate-100 p-4 bg-slate-50 text-xs text-slate-600 space-y-2">
            <div className="flex justify-between font-semibold text-slate-800">
              <span>Order #GR-9821</span>
              <Badge tone="green">Delivered</Badge>
            </div>
            <p>2 bags Grotec Trishul (Granules) dispatched via Salem Hub on 01 Mar 2026.</p>
          </div>
        </Card>
      )}

      {/* Tab Content: Land & Crops */}
      {activeTab === 'land_crops' && (
        <div className="grid gap-5 xl:grid-cols-2">
          <CropsCard customerId={data.id} customer={data} crops={cropsQuery.data ?? []} canEdit={canEdit} />
          <LocationsCard customerId={data.id} customer={data} canEdit={canEdit} />
          <ReferralsCard customerId={data.id} />
        </div>
      )}

      {/* Tab Content: Advisory Notes */}
      {activeTab === 'advisory_notes' && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Card className="p-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Agronomy &amp; Advisory Notes</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Farmer is keen on organic nutrient alternatives for next planting cycle. Recommended drip emitter cleaning due to high mineral content in bore water.
            </p>
          </Card>
          <PhonesCard customerId={data.id} customer={data} canEdit={canEdit} />
        </div>
      )}
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

/**
 * Soil Profile cell of the Farm & Agricultural Profile card.
 * Shows the persisted Customer.soilType (em-dash when unset) and, for users with
 * customer.update, an inline edit that PATCHes /customers/:id. Saving a blank
 * value sends null, which the backend treats as "clear". No other customer field
 * is sent, so nothing else on the record is disturbed.
 */
function SoilTypeField({ customerId, soilType, canEdit }: { customerId: string; soilType: string | null; canEdit: boolean }) {
  const { pending, error, run } = useCustomerMutation(customerId);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(soilType ?? '');
  const saving = pending === 'soilType';

  async function save() {
    await run('soilType', () => api.patch(`/customers/${customerId}`, { soilType: value.trim() || null }));
    setEditing(false);
  }

  function startEditing() {
    setValue(soilType ?? '');
    setEditing(true);
  }

  function cancel() {
    setValue(soilType ?? '');
    setEditing(false);
  }

  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase">Soil Profile</p>
      {editing ? (
        <>
          <div className="mt-0.5 flex items-center gap-1.5">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={40}
              placeholder="e.g. Red loam"
              aria-label="Soil type"
              disabled={saving}
              autoFocus
            />
            <Button size="xs" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button size="xs" variant="ghost" onClick={cancel} disabled={saving}>
              Cancel
            </Button>
          </div>
          <p className="mt-1 text-[10px] text-slate-400">Leave empty to clear.</p>
          {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
        </>
      ) : (
        <div className="mt-0.5 flex items-center gap-2">
          <p className="text-slate-800 font-bold">{soilType || '—'}</p>
          {canEdit ? (
            <button
              type="button"
              onClick={startEditing}
              className="text-[11px] font-medium text-brand-600 hover:underline"
            >
              Edit
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * Referrals made BY this customer (Step 3B). Append-only: create and read only,
 * no edit or delete. Reuses the page's existing query/mutation and permission
 * patterns. The referred customer shown comes from the lead, never stored twice.
 */
function ReferralsCard({ customerId }: { customerId: string }) {
  const { hasPermission } = useAuth();
  const canRead = hasPermission('referral.read');
  const canManage = hasPermission('referral.manage');
  const { pending, error, run } = useCustomerMutation(customerId);
  const queryClient = useQueryClient();
  const [leadId, setLeadId] = useState('');
  const [notes, setNotes] = useState('');

  const referralsQuery = useQuery({
    queryKey: ['referrals', customerId],
    queryFn: async () => (await api.get<Referral[]>(`/referrals/customers/${customerId}`)).data,
    enabled: canRead,
  });

  // Open leads the actor may see; the backend scopes this to their own leads.
  const leadsQuery = useQuery({
    queryKey: ['leads', 'OPEN'],
    queryFn: async () =>
      (await api.get<Page<Lead>>('/leads', { params: { status: 'OPEN', page: 1, pageSize: 50 } })).data,
    enabled: canManage,
  });

  if (!canRead) return null;

  // A customer cannot refer their own lead — keep those out of the picker.
  const selectableLeads = (leadsQuery.data?.items ?? []).filter((l) => l.customer.id !== customerId);

  async function submit() {
    await run('referral', async () => {
      await api.post('/referrals', {
        referrerCustomerId: customerId,
        leadId,
        notes: notes.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['referrals', customerId] });
    });
    setLeadId('');
    setNotes('');
  }

  return (
    <Card className="p-4 shadow-xs">
      <CardHeader title="Referrals Made" />
      {error ? <div className="p-2"><Alert tone="error">{error}</Alert></div> : null}

      <div className="divide-y divide-slate-100 text-xs">
        {referralsQuery.isLoading ? <div className="py-3"><Spinner label="Loading referrals…" /></div> : null}
        {referralsQuery.data?.length === 0 ? (
          <p className="py-3 text-slate-400">No referrals recorded for this farmer yet.</p>
        ) : null}
        {referralsQuery.data?.map((r) => (
          <div key={r.id} className="py-2">
            <div className="flex items-center gap-2">
              <Link to={`/customers/${r.referredCustomer.id}`} className="font-semibold text-slate-800 hover:underline">
                {r.referredCustomer.fullName}
              </Link>
              <Badge tone={r.leadStatus === 'OPEN' ? 'green' : 'slate'}>{r.leadStatus}</Badge>
            </div>
            {r.notes ? <p className="mt-0.5 text-slate-500">{r.notes}</p> : null}
            <p className="mt-0.5 text-[10px] text-slate-400">
              by {r.createdBy.fullName} • {formatDate(r.createdAt)}
            </p>
          </div>
        ))}
      </div>

      {canManage ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <Field label="Refer a lead" hint="Only leads you can access are listed. A farmer cannot refer their own lead.">
            <Select value={leadId} onChange={(e) => setLeadId(e.target.value)} aria-label="Lead to refer">
              <option value="">Select a lead…</option>
              {selectableLeads.map((l) => (
                <option key={l.id} value={l.id}>{l.customer.fullName}</option>
              ))}
            </Select>
          </Field>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Notes (optional)"
            aria-label="Referral notes"
          />
          <Button
            size="sm"
            onClick={() => void submit()}
            disabled={!leadId || pending === 'referral'}
          >
            {pending === 'referral' ? 'Saving…' : 'Record referral'}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function PhonesCard({ customerId, customer, canEdit }: { customerId: string; customer: CustomerDetail; canEdit: boolean }) {
  const { pending, error, run } = useCustomerMutation(customerId);
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('Mobile');

  return (
    <Card className="p-4 shadow-xs">
      <CardHeader title="Phone Numbers" />
      {error ? <div className="p-2"><Alert tone="error">{error}</Alert></div> : null}
      <div className="divide-y divide-slate-100 text-xs">
        {customer.phones?.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-2">
            <div>
              <span className="font-semibold text-slate-800">{formatE164(p.phone)}</span>
              <span className="ml-2 text-slate-400">({p.kind})</span>
              {p.isPrimary ? <span className="ml-2 text-[10px] text-emerald-600 font-bold">Primary</span> : null}
            </div>
            {canEdit && !p.isPrimary ? (
              <button
                type="button"
                onClick={() => run(`delete-${p.id}`, () => api.delete(`/customers/${customerId}/phones/${p.id}`))}
                className="text-slate-400 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}

function LocationsCard({ customerId, customer, canEdit }: { customerId: string; customer: CustomerDetail; canEdit: boolean }) {
  const { pending, error, run } = useCustomerMutation(customerId);
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');

  return (
    <Card className="p-4 shadow-xs">
      <CardHeader title="Locations / Farm Holdings" />
      {error ? <div className="p-2"><Alert tone="error">{error}</Alert></div> : null}
      <div className="divide-y divide-slate-100 text-xs">
        {customer.locations?.map((loc) => (
          <div key={loc.id} className="flex items-center justify-between py-2">
            <div>
              <span className="font-semibold text-slate-800">{loc.village || 'Farm'}</span>
              <span className="ml-2 text-slate-500">{loc.district}, {loc.state}</span>
              {loc.isPrimary ? <span className="ml-2 text-[10px] text-emerald-600 font-bold">Primary</span> : null}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CropsCard({ customerId, customer, crops, canEdit }: { customerId: string; customer: CustomerDetail; crops: Crop[]; canEdit: boolean }) {
  return (
    <Card className="p-4 shadow-xs">
      <CardHeader title="Cultivated Crops" />
      <div className="flex flex-wrap gap-1.5 p-2">
        {customer.crops?.map((c) => (
          <Badge key={c.id} tone="green">
            {c.crop.name} {c.crop.localName ? `(${c.crop.localName})` : ''}
          </Badge>
        ))}
      </div>
    </Card>
  );
}