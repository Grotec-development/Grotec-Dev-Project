import React, { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Phone as PhoneIcon,
  Plus,
  Sprout,
  Trash2,
  Calendar,
  FileText,
  ShoppingBag,
  PhoneCall,
  Send,
  AlertTriangle,
  X,
  Lock,
  Edit2,
  Check,
  ShieldAlert,
  Clock,
  BookOpen,
  IndianRupee,
  Layers,
  History,
  CheckCircle2,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Crop, CustomerDetail, Lead, Page, Referral } from '../../lib/types';
import { formatDate, formatE164 } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { LocationSelector } from '../../components/LocationSelector';
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
  Table,
  TD,
  TH,
  THead,
  cx,
} from '../../components/ui';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const isSupervisor =
    user?.roleCode === 'FOUNDER' ||
    user?.roleCode === 'MANAGER' ||
    hasPermission('customer.manage') ||
    hasPermission('customer.edit.sensitive');

  const canEdit = hasPermission('customer.update');
  const canDelete = hasPermission('customer.delete') || hasPermission('customer.create');

  // Phase 2.2 — 8 Distinct Profile Sections / Tabs
  const [activeTab, setActiveTab] = useState<
    'overview' | 'contact' | 'crops' | 'calls' | 'followups' | 'orders' | 'tickets' | 'advisory'
  >('overview');

  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationDraft, setLocationDraft] = useState({
    state: 'Tamil Nadu',
    district: '',
    taluk: '',
    village: '',
    pincode: '',
  });

  // Protected Name / Phone Edit Modal (Phase 2.3)
  const [showSensitiveEditModal, setShowSensitiveEditModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameChangeReason, setNameChangeReason] = useState('');
  const [savingSensitive, setSavingSensitive] = useState(false);
  const [sensitiveError, setSensitiveError] = useState<string | null>(null);

  // Add Crop Modal (Phase 2.5)
  const [showAddCropModal, setShowAddCropModal] = useState(false);
  const [selectedCropId, setSelectedCropId] = useState('');
  const [cropAcreage, setCropAcreage] = useState('2');
  const [cropUnit, setCropUnit] = useState('acre');
  const [cropStage, setCropStage] = useState('Vegetative');
  const [cropSeason, setCropSeason] = useState('Kharif 2026');
  const [sowingDate, setSowingDate] = useState('');
  const [harvestDate, setHarvestDate] = useState('');
  const [cropNotes, setCropNotes] = useState('');
  const [addingCrop, setAddingCrop] = useState(false);
  const [cropError, setCropError] = useState<string | null>(null);

  // Fetch farmer detail
  const { data, isError, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => (await api.get<CustomerDetail>(`/customers/${id}`)).data,
    enabled: Boolean(id),
  });

  // Fetch crop master catalogue
  const cropsQuery = useQuery({
    queryKey: ['crops'],
    queryFn: async () => (await api.get<Crop[]>('/crops')).data,
  });

  // Fetch bilingual soils catalogue
  const soilsQuery = useQuery({
    queryKey: ['soil-types-list'],
    queryFn: async () => {
      const res = await api.get('/soil-types');
      return res.data || [];
    },
  });

  // Fetch interaction history
  const callsQuery = useQuery({
    queryKey: ['customer-calls', id],
    queryFn: async () => (await api.get<any[]>(`/customers/${id}/calls`)).data,
    enabled: Boolean(id),
  });

  // Fetch scheduled callbacks
  const followupsQuery = useQuery({
    queryKey: ['customer-followups', id],
    queryFn: async () => {
      const res = await api.get<any[]>('/follow-ups', { params: { customerId: id } }).catch(() => ({ data: [] }));
      return res.data || [];
    },
    enabled: Boolean(id),
  });

  // Fetch orders
  const ordersQuery = useQuery({
    queryKey: ['customer-orders', id],
    queryFn: async () => (await api.get<any[]>('/orders', { params: { customerId: id } })).data,
    enabled: Boolean(id),
  });

  // Fetch support tickets
  const ticketsQuery = useQuery({
    queryKey: ['customer-tickets', id],
    queryFn: async () => {
      const res = await api.get<any[]>('/support-tickets', { params: { customerId: id } }).catch(() => ({ data: [] }));
      return res.data || [];
    },
    enabled: Boolean(id),
  });

  // Fetch advisory notes
  const notesQuery = useQuery({
    queryKey: ['customer-notes', id],
    queryFn: async () => (await api.get<any[]>(`/customers/${id}/notes`)).data,
    enabled: Boolean(id),
  });

  const toggleStatus = useMutation({
    mutationFn: async (activate: boolean) => {
      await api.post(`/customers/${id}/${activate ? 'activate' : 'deactivate'}`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customer', id] }),
  });

  const [newNoteBody, setNewNoteBody] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteBody.trim()) return;
    setAddingNote(true);
    try {
      await api.post(`/customers/${id}/notes`, { body: newNoteBody.trim() });
      setNewNoteBody('');
      void queryClient.invalidateQueries({ queryKey: ['customer-notes', id] });
    } catch {
      // ignore
    } finally {
      setAddingNote(false);
    }
  };

  const purchases = useMemo(() => {
    const orders = Array.isArray(ordersQuery.data) ? ordersQuery.data : [];
    const list: Array<{ id: string; date: string; product: string; qty: string; amount: string }> = [];
    for (const order of orders) {
      const dateStr = formatDate(order.orderDate || order.createdAt);
      for (const item of order.items || []) {
        list.push({
          id: `${order.id}-${item.id}`,
          date: dateStr,
          product: item.product?.name || 'Bio-Product',
          qty: `${Number(item.approvedQty || item.originalQty)} ${item.product?.unit || 'LTR'}`,
          amount: `₹ ${Number(item.totalAmount).toLocaleString('en-IN')}`,
        });
      }
    }
    return list;
  }, [ordersQuery.data]);

  if (isError) {
    return (
      <div className="p-6">
        <Alert tone="error">{errorMessage(error) || 'Failed to load farmer record.'}</Alert>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex justify-center p-12">
        <Spinner label="Loading farmer profile..." />
      </div>
    );
  }

  const primaryPhone = data.phones?.find((p) => p.isPrimary)?.phone ?? data.phones?.[0]?.phone ?? null;
  const primaryLocationObj = data.locations?.find((l) => l.isPrimary) ?? data.locations?.[0] ?? null;

  const handleCallNow = () => {
    const phoneToCall = primaryPhone?.replace(/[^\d+]/g, '');
    if (!phoneToCall) {
      alert('No valid phone number found for this farmer.');
      return;
    }
    navigate(`/agent?phone=${encodeURIComponent(phoneToCall)}&name=${encodeURIComponent(data.fullName)}&customerId=${data.id}`);
  };

  const handleSaveSensitiveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSavingSensitive(true);
    setSensitiveError(null);
    try {
      await api.patch(`/customers/${id}`, {
        fullName: newName.trim(),
        reason: nameChangeReason.trim() || 'Supervisor Correction',
      });
      void queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setShowSensitiveEditModal(false);
    } catch (err) {
      setSensitiveError(errorMessage(err) || 'Failed to correct farmer name');
    } finally {
      setSavingSensitive(false);
    }
  };

  const handleAddCropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCropId) return;
    setAddingCrop(true);
    setCropError(null);
    try {
      await api.post(`/customers/${id}/crops`, {
        cropId: selectedCropId,
        acreage: Number(cropAcreage || 1),
        unit: cropUnit,
        cropStage,
        season: cropSeason,
        sowingDate: sowingDate || undefined,
        harvestDate: harvestDate || undefined,
        notes: cropNotes.trim() || undefined,
        allowMultiple: true,
      });
      void queryClient.invalidateQueries({ queryKey: ['customer', id] });
      setShowAddCropModal(false);
    } catch (err) {
      setCropError(errorMessage(err) || 'Failed to add crop');
    } finally {
      setAddingCrop(false);
    }
  };

  const primaryCropNames = data.crops?.map((c) => c.crop.name).join(', ') || 'Not recorded';
  const landHolding =
    (data.crops ?? []).reduce((acc, c) => acc + Number(c.acreage || 0), 0) + ' Acres';
  const primaryLocation =
    [primaryLocationObj?.village, primaryLocationObj?.taluk, primaryLocationObj?.district, primaryLocationObj?.state]
      .filter(Boolean)
      .join(', ') || 'Location not set';

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Breadcrumb / Back Bar */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/customers" className="flex items-center gap-1 hover:text-slate-800 transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Farmer Directory
        </Link>
      </div>

      {/* Header Banner */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{data.fullName}</h1>
            <StatusBadge status={data.status} />

            {/* Protected Edit Badge / Button (Phase 2.3) */}
            {isSupervisor ? (
              <button
                type="button"
                onClick={() => {
                  setNewName(data.fullName);
                  setNameChangeReason('');
                  setShowSensitiveEditModal(true);
                }}
                className="inline-flex items-center gap-1 rounded bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 border border-slate-200 transition"
                title="Supervisor: Correct Farmer Details"
              >
                <Edit2 className="h-3 w-3 text-slate-600" /> Correct Name
              </button>
            ) : (
              <span
                className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 border border-slate-200"
                title="Name locked. Supervisor authorization required to modify."
              >
                <Lock className="h-3 w-3 text-slate-400" /> Protected Record
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 font-medium">{primaryLocation}</p>
          <p className="text-xs text-slate-400 font-mono">
            ID: <span className="font-bold text-slate-700">{data.farmerCode ?? '—'}</span>
            <span className="mx-2 text-slate-300">•</span>
            Primary Phone: <span className="font-bold text-slate-700">{primaryPhone ? formatE164(primaryPhone) : '—'}</span>
            <span className="mx-2 text-slate-300">•</span>
            Language: <span className="font-bold text-slate-700">{data.preferredLanguage === 'ta' ? 'Tamil' : 'English'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="call"
            size="md"
            onClick={handleCallNow}
            className="px-4 py-2 text-xs font-extrabold shadow-xs bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5"
          >
            <PhoneCall className="h-4 w-4" /> Start Telecall Session
          </Button>
        </div>
      </div>

      {/* 8-Tab Navigation Bar (Phase 2.2) */}
      <div className="border-b border-slate-200 bg-white px-2 rounded-t-xl shadow-2xs overflow-x-auto">
        <nav className="flex space-x-6 text-xs font-semibold whitespace-nowrap" aria-label="Tabs">
          {[
            { key: 'overview', label: '1. Overview' },
            { key: 'contact', label: '2. Contact Details' },
            { key: 'crops', label: '3. Crops & Agricultural Info' },
            { key: 'calls', label: '4. Call History' },
            { key: 'followups', label: '5. Scheduled Follow-ups' },
            { key: 'orders', label: '6. Orders & Sales' },
            { key: 'tickets', label: '7. Support Tickets' },
            { key: 'advisory', label: '8. Crop Advisories' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={cx(
                'border-b-2 py-3 px-1 transition-colors',
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-800 font-bold'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-4 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 border-b border-slate-100 pb-2">
                Farm &amp; Soil Profile
              </h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Crops Sown</p>
                  <p className="text-slate-800 font-bold mt-0.5">{primaryCropNames}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Total Cultivated Area</p>
                  <p className="text-slate-800 font-bold mt-0.5">{landHolding}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Soil Profile</p>
                  <p className="text-slate-800 font-bold mt-0.5">{data.soilType || 'Red Soil (செம்மண்)'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Preferred Language</p>
                  <p className="text-slate-800 font-bold mt-0.5">{data.preferredLanguage === 'ta' ? 'Tamil (தமிழ்)' : 'English'}</p>
                </div>
              </div>
            </Card>

            <Card className="shadow-xs overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3 bg-white">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Recent Commercial Purchases
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
                <tbody className="divide-y divide-slate-100 text-xs">
                  {purchases.length === 0 ? (
                    <tr>
                      <TD colSpan={4} className="py-6 text-center text-slate-400">
                        No purchases recorded yet.
                      </TD>
                    </tr>
                  ) : (
                    purchases.slice(0, 5).map((p) => (
                      <tr key={p.id}>
                        <TD className="text-slate-500 font-mono text-[11px]">{p.date}</TD>
                        <TD className="font-semibold text-slate-800">{p.product}</TD>
                        <TD className="text-slate-600">{p.qty}</TD>
                        <TD className="font-bold text-slate-900">{p.amount}</TD>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <Card className="p-4 shadow-xs">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">
                Quick Farmer Metrics
              </h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Calls</span>
                  <span className="font-mono text-lg font-bold text-slate-900">{(callsQuery.data || []).length}</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sales Orders</span>
                  <span className="font-mono text-lg font-bold text-emerald-700">{(ordersQuery.data || []).length}</span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Open Tickets</span>
                  <span className="font-mono text-lg font-bold text-amber-700">
                    {(ticketsQuery.data || []).filter((t: any) => t.status !== 'RESOLVED' && t.status !== 'CLOSED').length}
                  </span>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Follow-ups Due</span>
                  <span className="font-mono text-lg font-bold text-blue-700">
                    {(followupsQuery.data || []).filter((f: any) => f.status === 'SCHEDULED' || f.status === 'DUE').length}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: CONTACT DETAILS */}
      {activeTab === 'contact' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <PhoneIcon className="h-3.5 w-3.5 text-emerald-700" /> Phone Numbers
              </h3>
              {!isSupervisor && (
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Agent Read-Only
                </span>
              )}
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {data.phones?.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800 font-mono">{formatE164(p.phone)}</span>
                    <span className="ml-2 text-slate-400">({p.kind})</span>
                    {p.isPrimary && (
                      <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                        Primary
                      </span>
                    )}
                  </div>
                  <Button size="xs" variant="outline" onClick={handleCallNow} className="gap-1">
                    <PhoneCall className="h-3 w-3" /> Dial
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-700" /> Farm Locations &amp; Zones
              </h3>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {data.locations?.map((l) => (
                <div key={l.id} className="py-2.5 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{l.village || 'Farm'}</span>
                    {l.isPrimary && <span className="text-[10px] text-emerald-700 font-bold">Primary Location</span>}
                  </div>
                  <p className="text-slate-600">
                    Taluk: <span className="font-semibold text-slate-800">{l.taluk || '—'}</span>, District:{' '}
                    <span className="font-semibold text-slate-800">{l.district || '—'}</span>
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    State: {l.state || 'Tamil Nadu'} • Pincode: {l.pincode || '—'}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: CROPS & AGRICULTURAL INFORMATION (Phase 2.5) */}
      {activeTab === 'crops' && (
        <Card className="p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sprout className="h-4 w-4 text-emerald-700" /> Cultivation &amp; Crop Master Register
              </h2>
              <p className="text-xs text-slate-500">
                Multiple seasonal and perennial crops recorded for this farmer.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setSelectedCropId(cropsQuery.data?.[0]?.id || '');
                setShowAddCropModal(true);
              }}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" /> Add Cultivation Record
            </Button>
          </div>

          <Table>
            <THead>
              <tr>
                <TH>CROP NAME</TH>
                <TH>BOTANICAL / LOCAL</TH>
                <TH>SEASON / CYCLE</TH>
                <TH>CROP STAGE</TH>
                <TH>ACREAGE</TH>
                <TH>SOWING / HARVEST</TH>
                <TH>STATUS</TH>
              </tr>
            </THead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {(data.crops || []).length === 0 ? (
                <tr>
                  <TD colSpan={7} className="py-8 text-center text-slate-400">
                    No crop cultivation records added yet. Click "Add Cultivation Record" above.
                  </TD>
                </tr>
              ) : (
                data.crops.map((c: any) => (
                  <tr key={c.id}>
                    <TD className="font-bold text-slate-900">{c.crop.name}</TD>
                    <TD className="text-slate-600">{c.crop.localName || '—'}</TD>
                    <TD className="font-medium text-slate-800">{c.season || 'Annual / Kharif'}</TD>
                    <TD>
                      <span className="rounded bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                        {c.cropStage || 'Vegetative'}
                      </span>
                    </TD>
                    <TD className="font-semibold text-slate-800 font-mono">
                      {c.acreage} {c.unit || 'acre'}
                    </TD>
                    <TD className="text-slate-500 font-mono text-[11px]">
                      {c.sowingDate ? formatDate(c.sowingDate) : '—'}
                    </TD>
                    <TD>
                      <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                        {c.isActive ? 'Active Cultivation' : 'Past Season'}
                      </span>
                    </TD>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* TAB 4: CALL & INTERACTION HISTORY (Phase 3.4) */}
      {activeTab === 'calls' && (
        <Card className="p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-emerald-700" /> Complete Interaction &amp; Call History
            </h2>
            <Button size="xs" onClick={handleCallNow} className="bg-emerald-700 text-white font-bold gap-1">
              <PhoneCall className="h-3 w-3" /> Dial Call
            </Button>
          </div>

          <div className="space-y-2">
            {(callsQuery.data || []).length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">No telecall interactions logged yet.</p>
            ) : (
              (callsQuery.data || []).map((call: any) => (
                <div key={call.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{formatDate(call.startedAt || call.createdAt)}</span>
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-800">
                        {call.outcomeCustom || call.outcome || 'CONNECTED'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Telecaller: <span className="font-semibold text-slate-700">{call.agent?.fullName || 'Agent'}</span>
                    </span>
                  </div>
                  {call.notes && call.notes.length > 0 && (
                    <p className="text-slate-700 bg-white p-2 rounded border border-slate-100">
                      "{call.notes[0]?.body}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 5: SCHEDULED FOLLOW-UPS (Phase 4.1 & 4.2) */}
      {activeTab === 'followups' && (
        <Card className="p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-700" /> Scheduled Callbacks &amp; Appointments
            </h2>
          </div>

          <div className="space-y-2 text-xs">
            {(followupsQuery.data || []).length === 0 ? (
              <p className="py-8 text-center text-slate-400">No callbacks scheduled for this farmer.</p>
            ) : (
              (followupsQuery.data || []).map((f: any) => (
                <div key={f.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {f.dueAt ? formatDate(f.dueAt) : 'Scheduled Date'}
                    </span>
                    <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      {f.status}
                    </span>
                  </div>
                  <p className="text-slate-700">{f.instructions || f.notes || 'Callback requested'}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 6: ORDERS & SALES (Phase 6) */}
      {activeTab === 'orders' && (
        <Card className="p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5 text-emerald-700" /> Commercial Sales Orders
            </h2>
            <Link to="/sales" className="text-xs text-emerald-700 font-bold hover:underline">
              View Central Sales Ledger →
            </Link>
          </div>

          <Table>
            <THead>
              <tr>
                <TH>ORDER #</TH>
                <TH>DATE</TH>
                <TH>LINE ITEMS</TH>
                <TH>DELIVERY STATUS</TH>
                <TH>TOTAL (₹)</TH>
              </tr>
            </THead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {(ordersQuery.data || []).length === 0 ? (
                <tr>
                  <TD colSpan={5} className="py-8 text-center text-slate-400">
                    No orders placed for this customer yet.
                  </TD>
                </tr>
              ) : (
                (ordersQuery.data || []).map((o: any) => (
                  <tr key={o.id}>
                    <TD className="font-mono font-bold text-slate-900">{o.orderNumber}</TD>
                    <TD className="text-slate-500 font-mono">{formatDate(o.orderDate || o.createdAt)}</TD>
                    <TD>
                      {(o.items || []).map((it: any) => (
                        <span key={it.id} className="block text-[11px]">
                          {it.product?.name} ({Number(it.approvedQty || it.originalQty)} {it.product?.unit})
                        </span>
                      ))}
                    </TD>
                    <TD>
                      <span className="rounded bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                        {o.status}
                      </span>
                    </TD>
                    <TD className="font-mono font-bold text-slate-900">
                      ₹{Number(o.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </TD>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      )}

      {/* TAB 7: SUPPORT TICKETS (Phase 7) */}
      {activeTab === 'tickets' && (
        <Card className="p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Support &amp; Escalation Tickets
            </h2>
            <Link to="/tickets" className="text-xs text-amber-700 font-bold hover:underline">
              View Ticket Management Dashboard →
            </Link>
          </div>

          <div className="space-y-2 text-xs">
            {(ticketsQuery.data || []).length === 0 ? (
              <p className="py-8 text-center text-slate-400">No support tickets logged for this farmer.</p>
            ) : (
              (ticketsQuery.data || []).map((t: any) => (
                <div key={t.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{t.ticketNumber}</span>
                    <span className="rounded bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                      {t.status}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800">{t.category?.replace(/_/g, ' ')}</p>
                  <p className="text-slate-600">{t.description}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 8: CROP ADVISORIES (Phase 8) */}
      {activeTab === 'advisory' && (
        <div className="grid gap-5 xl:grid-cols-2 items-start">
          <Card className="p-4 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Add Advisory Note</h3>
            <form onSubmit={handleAddNote} className="space-y-3">
              <textarea
                value={newNoteBody}
                onChange={(e) => setNewNoteBody(e.target.value)}
                placeholder="Type advisory guidance, product dosages, or farmer feedback..."
                className="w-full text-xs rounded-lg border border-slate-200 p-2.5 min-h-[90px] focus:outline-emerald-600"
                required
              />
              <div className="flex justify-end">
                <Button size="sm" type="submit" disabled={addingNote || !newNoteBody.trim()} className="gap-1.5 bg-emerald-600 text-white font-bold">
                  <Send className="h-3.5 w-3.5" />
                  {addingNote ? 'Saving…' : 'Post Note'}
                </Button>
              </div>
            </form>

            <div className="divide-y divide-slate-100 pt-2 text-xs">
              {(notesQuery.data || []).map((n: any) => (
                <div key={n.id} className="py-2.5 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span className="font-bold text-slate-700">{n.author?.fullName || 'Advisor'}</span>
                    <span>{formatDate(n.createdAt)}</span>
                  </div>
                  <p className="text-slate-700">{n.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Sensitive Name Edit Modal (Phase 2.3) */}
      {showSensitiveEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md p-6 bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-600" /> Authorized Farmer Name Correction
              </h3>
              <button type="button" onClick={() => setShowSensitiveEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSaveSensitiveDetails} className="space-y-3 text-xs">
              {sensitiveError && <div className="rounded bg-red-50 p-2 text-red-800">{sensitiveError}</div>}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">New Farmer Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Reason for Modification (Audit Trail)
                </label>
                <Input
                  value={nameChangeReason}
                  onChange={(e) => setNameChangeReason(e.target.value)}
                  placeholder="e.g. Spelling correction confirmed with farmer"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowSensitiveEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingSensitive || !newName.trim()} className="bg-emerald-700 text-white font-bold">
                  {savingSensitive ? 'Saving…' : 'Save Correction'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Add Cultivation Crop Modal (Phase 2.5) */}
      {showAddCropModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true">
          <Card className="w-full max-w-md p-6 bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Sprout className="h-4 w-4 text-emerald-700" /> Add Crop Cultivation Record
              </h3>
              <button type="button" onClick={() => setShowAddCropModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddCropSubmit} className="space-y-3 text-xs">
              {cropError && <div className="rounded bg-red-50 p-2 text-red-800">{cropError}</div>}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Crop</label>
                <Select value={selectedCropId} onChange={(e) => setSelectedCropId(e.target.value)} className="w-full">
                  {(cropsQuery.data || []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.localName ? `(${c.localName})` : ''} — {c.category || 'Crop'}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cultivated Area</label>
                  <Input type="number" step="0.5" value={cropAcreage} onChange={(e) => setCropAcreage(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Unit</label>
                  <Select value={cropUnit} onChange={(e) => setCropUnit(e.target.value)} className="w-full">
                    <option value="acre">Acres</option>
                    <option value="hectare">Hectares</option>
                    <option value="cent">Cents</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Crop Stage</label>
                  <Select value={cropStage} onChange={(e) => setCropStage(e.target.value)} className="w-full">
                    <option value="Sowing">Sowing</option>
                    <option value="Vegetative">Vegetative</option>
                    <option value="Flowering">Flowering</option>
                    <option value="Fruiting">Fruiting</option>
                    <option value="Harvest">Harvest</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Season</label>
                  <Input value={cropSeason} onChange={(e) => setCropSeason(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowAddCropModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addingCrop || !selectedCropId} className="bg-emerald-700 text-white font-bold">
                  {addingCrop ? 'Saving…' : 'Add Crop'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

export default CustomerDetailPage;