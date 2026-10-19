import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  MapPin,
  Sprout,
  Calendar,
  FileText,
  Volume2,
  VolumeX,
  Delete,
  SkipForward,
  Check,
  Building2,
  Edit2,
  X,
  ShoppingBag,
  ShieldAlert,
  Search,
  BookOpen,
  Filter,
  History,
  Tag,
  Truck,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Call, CustomerDetail, QueueItem } from '../../lib/types';
import { formatE164, formatDate } from '../../lib/format';
import { getDistricts, getTaluks } from '../../lib/location-data';
import { Button, Card, Field, Input, Select, cx } from '../../components/ui';
import { LocationSelector } from '../../components/LocationSelector';
import { InCallOrderModal } from './InCallOrderModal';
import { InCallTicketModal } from './InCallTicketModal';

const CALL_TIMEOUT_SECONDS = 180; // 3 minutes per customer operation

export function DedicatedAgentCallingWorkspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Navigation from other pages (e.g. ?phone=...&name=...)
  const targetPhoneParam = searchParams.get('phone');
  const targetCustomerIdParam = searchParams.get('customerId');

  // Queue state & filters
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL');
  const [queueMode, setQueueMode] = useState<'ALL' | 'SCHEDULED'>('ALL');
  const [queueSearch, setQueueSearch] = useState<string>('');

  // 3-Minute Timer state
  const [timeLeft, setTimeLeft] = useState(CALL_TIMEOUT_SECONDS);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(false);

  // Call simulation / state
  const [callActive, setCallActive] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [activePhoneDialed, setActivePhoneDialed] = useState<string>('');
  const [isMuted, setIsMuted] = useState(false);

  // Keypad dialer state
  const [showKeypad, setShowKeypad] = useState(false);
  const [dialedNumber, setDialedNumber] = useState('');

  // Call Outcome & Notes Form
  const [outcome, setOutcome] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [callbackDateTime, setCallbackDateTime] = useState('');
  const [callPurpose, setCallPurpose] = useState<string>('Biofertilizer Enquiry');
  const [savingOutcome, setSavingOutcome] = useState(false);

  // Modals state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [orderToast, setOrderToast] = useState<string | null>(null);
  const [ticketToast, setTicketToast] = useState<string | null>(null);

  // Inline Taluk Editor State
  const [showTalukEditor, setShowTalukEditor] = useState(false);
  const [editState, setEditState] = useState('Tamil Nadu');
  const [editDistrict, setEditDistrict] = useState('');
  const [editTaluk, setEditTaluk] = useState('');
  const [savingTaluk, setSavingTaluk] = useState(false);
  const [talukSuccessMsg, setTalukSuccessMsg] = useState(false);

  // Full Farmer Details Edit Modal State
  const [showEditFarmerModal, setShowEditFarmerModal] = useState(false);
  const [farmerEditName, setFarmerEditName] = useState('');
  const [farmerEditSoil, setFarmerEditSoil] = useState('');
  const [farmerEditLanguage, setFarmerEditLanguage] = useState('ta');
  const [farmerEditState, setFarmerEditState] = useState('Tamil Nadu');
  const [farmerEditDistrict, setFarmerEditDistrict] = useState('Dharmapuri');
  const [farmerEditTaluk, setFarmerEditTaluk] = useState('');
  const [farmerEditVillage, setFarmerEditVillage] = useState('');
  const [farmerEditPincode, setFarmerEditPincode] = useState('');
  const [farmerEditSaving, setFarmerEditSaving] = useState(false);
  const [farmerEditError, setFarmerEditError] = useState<string | null>(null);
  const [farmerEditSuccess, setFarmerEditSuccess] = useState<string | null>(null);

  // Right Panel Tab state
  const [rightPanelTab, setRightPanelTab] = useState<'history' | 'orders' | 'tickets' | 'kb'>('history');

  // Fetch agent's customer calling queue with district filter & mode
  const queueQuery = useQuery({
    queryKey: ['calls-queue', selectedDistrict, queueMode],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedDistrict && selectedDistrict !== 'ALL') {
        params.district = selectedDistrict;
      }
      if (queueMode === 'SCHEDULED') {
        params.scheduledOnly = 'true';
      }
      const res = await api.get<QueueItem[]>('/calls/queue', { params });
      return res.data;
    },
    refetchInterval: 12_000,
  });

  const rawQueueItems = queueQuery.data || [];

  // In-memory search filtering on queue
  const queueItems = useMemo(() => {
    if (!queueSearch.trim()) return rawQueueItems;
    const q = queueSearch.trim().toLowerCase();
    return rawQueueItems.filter((item) => {
      const nameMatch = item.customer.fullName.toLowerCase().includes(q);
      const codeMatch = item.customer.farmerCode?.toLowerCase().includes(q);
      const phoneMatch = item.customer.primaryPhone?.includes(q);
      const distMatch = item.customer.location?.district?.toLowerCase().includes(q);
      return nameMatch || codeMatch || phoneMatch || distMatch;
    });
  }, [rawQueueItems, queueSearch]);

  // Direct customer query if navigated with ?customerId=...
  const directCustomerQuery = useQuery({
    queryKey: ['customer-direct-call', targetCustomerIdParam],
    queryFn: async () => {
      if (!targetCustomerIdParam) return null;
      const res = await api.get<CustomerDetail>(`/customers/${targetCustomerIdParam}`);
      return res.data;
    },
    enabled: Boolean(targetCustomerIdParam),
  });

  // Automatically match customer from queue if navigated with query params
  useEffect(() => {
    if (!queueItems.length) return;
    if (targetCustomerIdParam) {
      const idx = queueItems.findIndex((it) => it.customer.id === targetCustomerIdParam);
      if (idx !== -1) {
        setCurrentIndex(idx);
        return;
      }
    }
    if (targetPhoneParam) {
      const idx = queueItems.findIndex(
        (it) =>
          it.customer.primaryPhone === targetPhoneParam ||
          it.customer.phones?.some((p) => p.phone === targetPhoneParam)
      );
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [targetCustomerIdParam, targetPhoneParam, queueItems]);

  // Determine current customer in queue or direct target
  const currentItem: QueueItem | undefined = useMemo(() => {
    if (queueItems.length === 0) return undefined;
    if (currentIndex >= queueItems.length) return queueItems[0];
    return queueItems[currentIndex];
  }, [queueItems, currentIndex]);

  const currentCustomer: any = useMemo(() => {
    if (currentItem?.customer) return currentItem.customer;
    if (directCustomerQuery.data) {
      const d = directCustomerQuery.data;
      return {
        id: d.id,
        farmerCode: d.farmerCode,
        fullName: d.fullName,
        primaryPhone: d.phones?.[0]?.phone || targetPhoneParam || '',
        phones: d.phones,
        location: d.locations?.[0] || { state: 'Tamil Nadu', district: 'Dharmapuri', taluk: '' },
        crops: d.crops,
        soilType: d.soilType,
        preferredLanguage: (d as any).preferredLanguage,
      };
    }
    return undefined;
  }, [currentItem, directCustomerQuery.data, targetPhoneParam]);

  // Dynamic phone numbers for current customer
  const customerPhones = useMemo(() => {
    if (!currentCustomer) return [];
    if (currentCustomer.phones && currentCustomer.phones.length > 0) {
      return currentCustomer.phones;
    }
    if (currentCustomer.primaryPhone) {
      return [{ id: 'p1', phone: currentCustomer.primaryPhone, isPrimary: true, kind: 'MOBILE' }];
    }
    return [];
  }, [currentCustomer]);

  // Check if current customer has missing Taluk
  const isTalukMissing = useMemo(() => {
    if (!currentCustomer) return false;
    const taluk = currentCustomer.location?.taluk;
    return !taluk || taluk.trim().length === 0;
  }, [currentCustomer]);

  // Available districts and taluks for inline editor
  const availableDistricts = useMemo(() => getDistricts(editState), [editState]);
  const availableTaluks = useMemo(() => getTaluks(editState, editDistrict), [editState, editDistrict]);

  // Right Panel: Fetch last 5 interactions for current customer
  const interactionsQuery = useQuery({
    queryKey: ['customer-calls-history', currentCustomer?.id],
    queryFn: async () => {
      if (!currentCustomer?.id) return [];
      const res = await api.get<any[]>(`/calls/customer/${currentCustomer.id}`);
      return res.data;
    },
    enabled: Boolean(currentCustomer?.id),
  });

  // Right Panel: Fetch existing orders for current customer
  const customerOrdersQuery = useQuery({
    queryKey: ['customer-orders-history', currentCustomer?.id],
    queryFn: async () => {
      if (!currentCustomer?.id) return [];
      const res = await api.get<any[]>('/orders', { params: { customerId: currentCustomer.id } });
      return res.data;
    },
    enabled: Boolean(currentCustomer?.id),
  });

  // Right Panel: Fetch support tickets for current customer
  const customerTicketsQuery = useQuery({
    queryKey: ['customer-tickets-history', currentCustomer?.id],
    queryFn: async () => {
      if (!currentCustomer?.id) return [];
      const res = await api.get<any[]>('/support-tickets', { params: { customerId: currentCustomer.id } });
      return res.data;
    },
    enabled: Boolean(currentCustomer?.id),
  });

  // Initialize taluk editor fields when customer changes
  useEffect(() => {
    if (currentCustomer?.location) {
      setEditState(currentCustomer.location.state || 'Tamil Nadu');
      setEditDistrict(currentCustomer.location.district || (availableDistricts[0] || ''));
      setEditTaluk(currentCustomer.location.taluk || '');
    } else {
      setEditState('Tamil Nadu');
      setEditDistrict('Dharmapuri');
      setEditTaluk('');
    }
    setTalukSuccessMsg(false);
    setShowTalukEditor(false);
  }, [currentCustomer]);

  // Reset timer & outcomes whenever customer changes
  useEffect(() => {
    setTimeLeft(CALL_TIMEOUT_SECONDS);
    setIsTimerPaused(false);
    setShowTimeoutAlert(false);
    setOutcome('');
    setNotes('');
    setCallbackDateTime('');
    setCallActive(false);
    setActiveCallId(null);
    setCallDuration(0);
    setDialedNumber('');
  }, [currentIndex, currentCustomer?.id]);

  // Operation Countdown Timer Loop
  useEffect(() => {
    if (isTimerPaused || timeLeft <= 0 || !currentCustomer) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowTimeoutAlert(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, isTimerPaused, currentCustomer]);

  // In-call duration timer
  useEffect(() => {
    if (!callActive) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callActive]);

  // Start Call Handler
  const handleStartCall = async (phoneToDial: string) => {
    if (!currentCustomer || callActive) return;

    const cleaned = phoneToDial.replace(/[^\d+]/g, '');
    if (cleaned.length < 10) {
      alert('Phone number must have at least 10 digits.');
      return;
    }

    setActivePhoneDialed(phoneToDial);
    setCallActive(true);
    setCallDuration(0);
    setIsMuted(false);

    try {
      const res = await api.post<Call>('/calls', {
        phoneNumber: phoneToDial,
        customerId: currentCustomer.id,
        leadId: currentItem?.leadId,
        mode: 'OUTBOUND_DIALER',
      });
      if (res.data?.id) {
        setActiveCallId(res.data.id);
      }
    } catch {
      // Continue call workspace even if dialer runs in direct SIM mode
    }
  };

  // End Call Handler
  const handleEndCall = async () => {
    if (!callActive) return;
    setCallActive(false);

    if (activeCallId) {
      try {
        await api.post(`/calls/${activeCallId}/end`, {
          disconnectReason: 'AGENT_HANGUP',
        });
      } catch {
        // Silently end
      }
    }
  };

  // Save Outcome and Move to Next Customer
  const handleSaveAndNext = async () => {
    if (!currentCustomer) return;
    setSavingOutcome(true);

    try {
      const selectedOutcome = outcome || 'COMPLETED';
      const formattedNote = notes.trim() ? `[${callPurpose}] ${notes.trim()}` : `[${callPurpose}] Call logged`;
      const outcomePayload = {
        outcome: selectedOutcome,
        notes: formattedNote,
        followUpNote: formattedNote,
        followUpDate: callbackDateTime ? callbackDateTime.split('T')[0] : undefined,
        followUpTime: callbackDateTime && callbackDateTime.includes('T') ? callbackDateTime.split('T')[1].slice(0, 5) : undefined,
      };

      if (activeCallId) {
        await api.post(`/calls/${activeCallId}/outcome`, outcomePayload);
      } else {
        const createdCall = await api
          .post<Call>('/calls', {
            phoneNumber: currentCustomer.primaryPhone || '9876543100',
            customerId: currentCustomer.id,
            leadId: currentItem?.leadId,
            mode: 'DIRECT_MANUAL',
          });

        if (createdCall?.data?.id) {
          await api.post(`/calls/${createdCall.data.id}/outcome`, outcomePayload);
        }
      }

      void queryClient.invalidateQueries({ queryKey: ['calls-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-calls-history', currentCustomer.id] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });

      // Reset form on success
      setOutcome('');
      setNotes('');
      setCallbackDateTime('');

      // Advance to Next Customer
      if (currentIndex + 1 < queueItems.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        const refreshed = await queueQuery.refetch();
        if (refreshed.data && refreshed.data.length > 0) {
          setCurrentIndex(0);
        }
      }
    } catch (err) {
      alert(errorMessage(err) || 'Failed to save call outcome. Data preserved.');
    } finally {
      setSavingOutcome(false);
    }
  };

  // Skip Customer Handler
  const handleSkipToNext = () => {
    if (currentIndex + 1 < queueItems.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      void queueQuery.refetch();
      setCurrentIndex(0);
    }
  };

  // Inline Taluk Quick Save
  const handleSaveTaluk = async () => {
    if (!currentCustomer || !editTaluk) return;
    setSavingTaluk(true);
    try {
      await api.patch(`/customers/${currentCustomer.id}`, {
        state: editState,
        district: editDistrict,
        taluk: editTaluk,
      });
      setTalukSuccessMsg(true);
      setShowTalukEditor(false);
      void queryClient.invalidateQueries({ queryKey: ['calls-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['customer', currentCustomer.id] });
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSavingTaluk(false);
    }
  };

  const handleOpenFarmerEditModal = () => {
    if (!currentCustomer) return;
    setFarmerEditName(currentCustomer.fullName || '');
    setFarmerEditSoil(currentCustomer.soilType || '');
    setFarmerEditLanguage(currentCustomer.preferredLanguage || 'ta');
    setFarmerEditState(currentCustomer.location?.state || 'Tamil Nadu');
    setFarmerEditDistrict(currentCustomer.location?.district || 'Dharmapuri');
    setFarmerEditTaluk(currentCustomer.location?.taluk || '');
    setFarmerEditVillage(currentCustomer.location?.village || '');
    setFarmerEditPincode(currentCustomer.location?.pincode || '');
    setFarmerEditError(null);
    setFarmerEditSuccess(null);
    setShowEditFarmerModal(true);
  };

  const handleSaveFarmerEdit = async () => {
    if (!currentCustomer) return;
    setFarmerEditSaving(true);
    setFarmerEditError(null);
    try {
      await api.patch(`/customers/${currentCustomer.id}`, {
        fullName: farmerEditName.trim(),
        soilType: farmerEditSoil.trim() || null,
        preferredLanguage: farmerEditLanguage,
        state: farmerEditState,
        district: farmerEditDistrict,
        taluk: farmerEditTaluk.trim() || null,
        village: farmerEditVillage.trim() || null,
        pincode: farmerEditPincode.trim() || null,
      });

      setFarmerEditSuccess('Farmer profile updated successfully!');
      void queryClient.invalidateQueries({ queryKey: ['calls-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['customer-direct-call', currentCustomer.id] });
      setTimeout(() => setShowEditFarmerModal(false), 800);
    } catch (err: any) {
      setFarmerEditError(errorMessage(err) || 'Failed to save farmer details');
    } finally {
      setFarmerEditSaving(false);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Recent interaction records for right panel
  const recentInteractions = useMemo(() => {
    const list = interactionsQuery.data || [];
    return list.slice(0, 5);
  }, [interactionsQuery.data]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100 p-3 md:p-5 space-y-3">
      {/* Top Header Bar: Queue Status & Call Timer */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white font-bold shadow-xs">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900">AI Telecalling Workspace</h1>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                Farmer Calling Queue
              </span>
              {selectedDistrict !== 'ALL' && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                  Zone: {selectedDistrict}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {queueItems.length > 0
                ? `Customer ${currentIndex + 1} of ${queueItems.length} (${queueItems.length - currentIndex - 1} remaining in current filter)`
                : 'No pending customer calls matching current filter'}
            </p>
          </div>
        </div>

        {/* Timer & Queue Actions */}
        <div className="flex items-center gap-2.5">
          <div
            className={cx(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border font-mono text-xs font-bold shadow-xs transition-colors',
              timeLeft <= 30
                ? 'bg-red-50 border-red-300 text-red-700 animate-pulse'
                : timeLeft <= 60
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            )}
            title="Session Operation Timer"
          >
            <Clock className={cx('h-3.5 w-3.5', timeLeft <= 30 ? 'text-red-600' : 'text-emerald-700')} />
            <span>{formatCountdown(timeLeft)}</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSkipToNext}
            className="text-xs gap-1 text-slate-600 hover:text-slate-900"
          >
            <SkipForward className="h-3.5 w-3.5" /> Skip
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => void queueQuery.refetch()}
            className="text-xs gap-1 text-slate-600 hover:text-slate-900"
            title="Refresh Queue"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Toast Notifications */}
      {orderToast && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="font-semibold">{orderToast}</span>
          </div>
          <button onClick={() => setOrderToast(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {ticketToast && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
            <span className="font-semibold">{ticketToast}</span>
          </div>
          <button onClick={() => setTicketToast(null)} className="text-amber-700 hover:text-amber-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* THREE-PANEL OPERATIONAL LAYOUT (Phase 3.1) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ============================================================ */}
        {/* LEFT PANEL — CALLING QUEUE (Phase 3.1 & 4.3) (3 cols)        */}
        {/* ============================================================ */}
        <div className="lg:col-span-3 space-y-3">
          <Card className="p-3.5 bg-white shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-emerald-700" /> Calling Queue
              </span>
              <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                {queueItems.length} Leads
              </span>
            </div>

            {/* Queue Mode & District Selector (Phase 4.3) */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setQueueMode('ALL')}
                  className={cx(
                    'py-1 rounded text-center transition',
                    queueMode === 'ALL' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  All Leads
                </button>
                <button
                  type="button"
                  onClick={() => setQueueMode('SCHEDULED')}
                  className={cx(
                    'py-1 rounded text-center transition',
                    queueMode === 'SCHEDULED' ? 'bg-white shadow-xs font-bold text-amber-800' : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  Due Callbacks
                </button>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  District Filter
                </label>
                <Select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setCurrentIndex(0);
                  }}
                  className="w-full text-xs"
                >
                  <option value="ALL">All Regional Districts</option>
                  <option value="Coimbatore">Coimbatore</option>
                  <option value="Dharmapuri">Dharmapuri</option>
                  <option value="Salem">Salem</option>
                  <option value="Erode">Erode</option>
                  <option value="Tiruppur">Tiruppur</option>
                  <option value="Vellore">Vellore</option>
                  <option value="Chennai">Chennai</option>
                  <option value="Madurai">Madurai</option>
                  <option value="Tiruchirappalli">Tiruchirappalli</option>
                  <option value="Dindigul">Dindigul</option>
                  <option value="Krishnagiri">Krishnagiri</option>
                </Select>
              </div>

              {/* Search Queue */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  placeholder="Filter name, phone, code..."
                  className="pl-8 text-xs py-1.5"
                />
              </div>
            </div>

            {/* Scrollable List of Upcoming Farmers */}
            <div className="max-h-[520px] overflow-y-auto space-y-1.5 divide-y divide-slate-100 pr-1">
              {queueItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No farmers in queue for this filter.
                </div>
              ) : (
                queueItems.map((item, idx) => {
                  const isCurrent = idx === currentIndex;
                  return (
                    <button
                      key={item.leadId || idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={cx(
                        'w-full text-left p-2.5 rounded-lg transition space-y-1',
                        isCurrent
                          ? 'bg-emerald-50 border-2 border-emerald-600 shadow-xs ring-1 ring-emerald-500'
                          : 'hover:bg-slate-50 border border-transparent'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {item.customer.fullName}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{item.customer.location?.district || 'Tamil Nadu'}</span>
                        <span className="font-mono font-medium text-slate-700">
                          {item.customer.primaryPhone ? formatE164(item.customer.primaryPhone) : '—'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* ============================================================ */}
        {/* CENTER PANEL — ACTIVE CALL & WORKSPACE (5 cols)             */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 space-y-3">
          {currentCustomer ? (
            <>
              {/* Active Call Status Card */}
              <Card
                className={cx(
                  'p-4 shadow-sm transition-all',
                  callActive ? 'border-2 border-emerald-500 bg-emerald-50/50' : 'bg-white'
                )}
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className={cx(
                        'h-3 w-3 rounded-full',
                        callActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
                      )}
                    />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                      {callActive ? 'Live Call Connected' : 'Telephony Dial Control'}
                    </h3>
                  </div>
                  {callActive && (
                    <span className="font-mono text-sm font-extrabold text-emerald-800">
                      {formatDuration(callDuration)}
                    </span>
                  )}
                </div>

                {callActive ? (
                  <div className="py-3 text-center space-y-2.5">
                    <p className="text-xs text-slate-500 font-mono">
                      Speaking with: <span className="font-bold text-slate-800">{currentCustomer.fullName}</span> (
                      {activePhoneDialed})
                    </p>
                    <div className="flex items-center justify-center gap-2.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsMuted((m) => !m)}
                        className={cx(isMuted && 'bg-amber-100 text-amber-800 border-amber-300')}
                      >
                        {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
                      </Button>

                      <Button
                        size="sm"
                        onClick={() => void handleEndCall()}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 gap-1.5"
                      >
                        <PhoneOff className="h-4 w-4" /> End Call
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-2.5 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {customerPhones.map((p: any, idx: number) => (
                        <button
                          key={p.id || idx}
                          type="button"
                          disabled={callActive}
                          onClick={() => void handleStartCall(p.phone)}
                          className={cx(
                            'flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold shadow-xs transition',
                            p.isPrimary
                              ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                              : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                          )}
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          <span>{formatE164(p.phone)}</span>
                          <span className="text-[10px] font-normal opacity-80">
                            {p.isPrimary ? '(Primary)' : `(Alt ${idx + 1})`}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* Farmer Header Info Card */}
              <Card className="p-4 bg-white shadow-xs space-y-3">
                <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-extrabold text-slate-900">{currentCustomer.fullName}</h2>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        Farmer
                      </span>
                      <button
                        type="button"
                        onClick={handleOpenFarmerEditModal}
                        className="rounded bg-slate-100 hover:bg-slate-200 p-1 text-slate-600 text-xs border border-slate-200"
                        title="Edit Details"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      Farmer Code: <span className="font-bold text-slate-700">{currentCustomer.farmerCode || '—'}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned FSE</p>
                    <p className="text-xs font-bold text-slate-700">
                      {currentItem?.owner?.fullName || 'Assigned to You'}
                    </p>
                  </div>
                </div>

                {/* Location Quick Info */}
                <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-xs grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Village</span>
                    <span className="font-semibold text-slate-800">{currentCustomer.location?.village || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Taluk</span>
                    <span className="font-semibold text-slate-800">{currentCustomer.location?.taluk || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">District</span>
                    <span className="font-semibold text-slate-800">{currentCustomer.location?.district || '—'}</span>
                  </div>
                </div>

                {/* High Priority In-Call Action Buttons (Phase 3.3 & 7.1) */}
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowOrderModal(true)}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-xs gap-1.5 py-2.5"
                  >
                    <ShoppingBag className="h-4 w-4" /> Create Sales Order
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowTicketModal(true)}
                    className="border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs gap-1.5 py-2.5"
                  >
                    <ShieldAlert className="h-4 w-4 text-amber-700" /> Raise Escalation Ticket
                  </Button>
                </div>
              </Card>

              {/* Call Outcomes & Advance Card (Phase 3.2 & 3.6) */}
              <Card className="p-4 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Record Call Outcome
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Select outcome to advance</span>
                </div>

                {/* Outcome Buttons Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-xs">
                  {[
                    { key: 'INTERESTED', label: 'Interested', color: 'emerald' },
                    { key: 'CALL_BACK', label: 'Call Back', color: 'amber' },
                    { key: 'NOT_INTERESTED', label: 'Not Interested', color: 'red' },
                    { key: 'NOT_ANSWERED', label: 'Not Answered', color: 'slate' },
                    { key: 'BUSY', label: 'Busy', color: 'slate' },
                    { key: 'INVALID_NUMBER', label: 'Invalid #', color: 'slate' },
                    { key: 'COMPLETED', label: 'Completed', color: 'emerald' },
                  ].map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => setOutcome(o.key)}
                      className={cx(
                        'py-2 px-2 rounded-lg border text-center transition font-semibold text-xs',
                        outcome === o.key
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500 font-extrabold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>

                {/* Callback Date/Time Picker */}
                {(outcome === 'CALL_BACK' || outcome === 'INTERESTED') && (
                  <div className="space-y-1 rounded-lg bg-amber-50/70 p-2.5 border border-amber-200 text-xs">
                    <label className="font-bold text-amber-900 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-amber-700" /> Callback Date &amp; Time (Asia/Kolkata)
                    </label>
                    <input
                      type="datetime-local"
                      value={callbackDateTime}
                      onChange={(e) => setCallbackDateTime(e.target.value)}
                      className="w-full rounded border border-amber-300 bg-white p-1.5 text-xs focus:outline-emerald-600"
                    />
                  </div>
                )}

                {/* Call Purpose Selection (Phase 3.5) */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Predefined Call Purpose</label>
                  <Select
                    value={callPurpose}
                    onChange={(e) => setCallPurpose(e.target.value)}
                    className="w-full text-xs"
                  >
                    <option value="Biofertilizer Enquiry">Biofertilizer Enquiry</option>
                    <option value="Price Discussion">Price Discussion</option>
                    <option value="Crop Business Advice">Crop Business Advice</option>
                    <option value="Product Information">Product Information</option>
                    <option value="Order Follow-up">Order Follow-up</option>
                    <option value="Payment Follow-up">Payment Follow-up</option>
                    <option value="General Enquiry">General Enquiry</option>
                  </Select>
                </div>

                {/* Free Text Interaction Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-slate-400" /> Call Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Record notes on dosage, delivery date, farmer inquiries..."
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 p-2 text-xs focus:border-brand-600 focus:outline-none"
                  />
                </div>

                {/* Save & Advance Button */}
                <Button
                  size="md"
                  onClick={() => void handleSaveAndNext()}
                  disabled={savingOutcome}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs py-3 shadow-sm gap-2"
                >
                  {savingOutcome ? (
                    'Saving & Loading Next Customer...'
                  ) : (
                    <>
                      <span>Save &amp; Next Customer</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </Card>
            </>
          ) : (
            <Card className="p-10 text-center bg-white shadow-xs">
              <p className="text-sm font-bold text-slate-700">No customer selected.</p>
              <p className="text-xs text-slate-500 mt-1">Select a farmer from the queue on the left to begin calling.</p>
            </Card>
          )}
        </div>

        {/* ============================================================ */}
        {/* RIGHT PANEL — FARMER CONTEXT & KNOWLEDGE (Phase 3.1) (4 cols)*/}
        {/* ============================================================ */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="p-3.5 bg-white shadow-xs space-y-3">
            {/* Context Navigation Tabs */}
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setRightPanelTab('history')}
                className={cx(
                  'py-1 rounded text-center transition',
                  rightPanelTab === 'history' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                History
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('orders')}
                className={cx(
                  'py-1 rounded text-center transition',
                  rightPanelTab === 'orders' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Orders
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('tickets')}
                className={cx(
                  'py-1 rounded text-center transition',
                  rightPanelTab === 'tickets' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Tickets
              </button>
              <button
                type="button"
                onClick={() => setRightPanelTab('kb')}
                className={cx(
                  'py-1 rounded text-center transition',
                  rightPanelTab === 'kb' ? 'bg-white shadow-xs font-bold text-slate-900' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                Advisory
              </button>
            </div>

            {/* TAB 1: Last 5 Interactions (Phase 3.4) */}
            {rightPanelTab === 'history' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-emerald-700" /> Recent Call History
                  </span>
                  <span className="text-[10px] text-slate-400">Newest first</span>
                </div>

                {recentInteractions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    No previous calls recorded for this farmer.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {recentInteractions.map((call: any, idx: number) => (
                      <div key={call.id || idx} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            {formatDate(call.startedAt || call.createdAt)}
                          </span>
                          <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                            {call.outcomeCustom || call.outcome || 'CONNECTED'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Agent: <span className="font-medium text-slate-700">{call.agent?.fullName || 'Telecaller'}</span>
                        </p>
                        {call.notes && call.notes.length > 0 && (
                          <p className="text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-100 italic">
                            "{call.notes[0]?.body || 'Call logged'}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Orders & Sales (Phase 6.1) */}
            {rightPanelTab === 'orders' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShoppingBag className="h-3.5 w-3.5 text-emerald-700" /> Purchase &amp; Sales Orders
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {(customerOrdersQuery.data || []).length} Orders
                  </span>
                </div>

                {(customerOrdersQuery.data || []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    No sales orders placed yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {(customerOrdersQuery.data || []).map((order: any) => (
                      <div key={order.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                            {order.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-600">
                          <span>{formatDate(order.orderDate || order.createdAt)}</span>
                          <span className="font-mono font-bold text-slate-900">
                            ₹{Number(order.totalAmount).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {order.route && (
                          <p className="text-[10px] text-brand-700 font-medium">
                            Route: {order.route.name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Escalation Support Tickets (Phase 7.5) */}
            {rightPanelTab === 'tickets' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Escalation Tickets
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowTicketModal(true)}
                    className="text-[10px] text-amber-700 hover:text-amber-900 p-0 h-auto"
                  >
                    + Raise Ticket
                  </Button>
                </div>

                {(customerTicketsQuery.data || []).length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    No active support or escalation tickets.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {(customerTicketsQuery.data || []).map((t: any) => (
                      <div key={t.id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-slate-900">{t.ticketNumber}</span>
                          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                            {t.status}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800 text-[11px]">{t.category?.replace(/_/g, ' ')}</p>
                        <p className="text-[10px] text-slate-600 line-clamp-2">{t.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Crop Knowledge & Biofertilizer Guidance (Phase 8.1) */}
            {rightPanelTab === 'kb' && (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-emerald-700" /> Approved Advisory Guidance
                  </span>
                </div>

                {/* Farmer's Crop & Soil context */}
                <div className="rounded-lg bg-emerald-50/70 p-2.5 border border-emerald-200 space-y-1">
                  <p className="font-bold text-emerald-950 flex items-center gap-1">
                    <Sprout className="h-3.5 w-3.5 text-emerald-700" /> Active Cultivation
                  </p>
                  <p className="text-[11px] text-emerald-900">
                    {currentCustomer?.crops && currentCustomer.crops.length > 0
                      ? currentCustomer.crops.map((c: any) => c.crop?.name || c.name).join(', ')
                      : 'Tomato, Brinjal, Paddy'}
                  </p>
                  <p className="text-[10px] text-emerald-800">
                    Soil: <span className="font-semibold">{currentCustomer?.soilType || 'Red Soil (செம்மண்)'}</span>
                  </p>
                </div>

                {/* Approved Biofertilizer Dosage & Guidance */}
                <div className="space-y-2 text-[11px]">
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
                    <p className="font-bold text-slate-900">Azospirillum &amp; Phosphobacteria</p>
                    <p className="text-slate-600">
                      Standard dosage: 2 Litres / Acre via drip irrigation or root drenching at vegetative stage.
                    </p>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
                      Suitable for Paddy, Sugarcane, Vegetables
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1">
                    <p className="font-bold text-slate-900">Pseudomonas Fluorescens</p>
                    <p className="text-slate-600">
                      Bio-fungicide control for root rot &amp; wilt. Apply 2.5 kg or Ltr per acre during soil prep.
                    </p>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
                      Bio-Protection
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Embedded In-Call Order Modal (Phase 3.3) */}
      {showOrderModal && currentCustomer && (
        <InCallOrderModal
          customer={currentCustomer}
          onClose={() => setShowOrderModal(false)}
          onOrderCreated={(order) => {
            setOrderToast(`Sales Order ${order.orderNumber} successfully submitted!`);
            void queryClient.invalidateQueries({ queryKey: ['customer-orders-history', currentCustomer.id] });
            setTimeout(() => setOrderToast(null), 6000);
          }}
        />
      )}

      {/* Embedded In-Call Support Ticket Modal (Phase 7.1) */}
      {showTicketModal && currentCustomer && (
        <InCallTicketModal
          customer={currentCustomer}
          activeCallId={activeCallId}
          onClose={() => setShowTicketModal(false)}
          onTicketCreated={(ticket) => {
            setTicketToast(`Ticket ${ticket.ticketNumber} created and assigned.`);
            void queryClient.invalidateQueries({ queryKey: ['customer-tickets-history', currentCustomer.id] });
            setTimeout(() => setTicketToast(null), 6000);
          }}
        />
      )}

      {/* Full Farmer Edit Modal */}
      {showEditFarmerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-emerald-700" />
                <h2 className="text-sm font-bold text-slate-900">Edit Farmer Details</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowEditFarmerModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4 text-xs">
              {farmerEditError && <div className="rounded bg-red-50 p-2 text-red-800">{farmerEditError}</div>}

              <Field label="Farmer Full Name">
                <Input
                  value={farmerEditName}
                  onChange={(e) => setFarmerEditName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="font-medium text-slate-900"
                  autoFocus
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Soil Classification">
                  <Input
                    value={farmerEditSoil}
                    onChange={(e) => setFarmerEditSoil(e.target.value)}
                    placeholder="e.g. Red Soil, Clay Soil"
                    maxLength={40}
                  />
                </Field>
                <Field label="Preferred Spoken Language">
                  <Select
                    value={farmerEditLanguage}
                    onChange={(e) => setFarmerEditLanguage(e.target.value)}
                    className="w-full"
                  >
                    <option value="ta">Tamil (தமிழ்)</option>
                    <option value="en">English</option>
                    <option value="te">Telugu (తెలుగు)</option>
                    <option value="kn">Kannada (ಕನ್ನಡ)</option>
                    <option value="ml">Malayalam (മലയാളം)</option>
                  </Select>
                </Field>
              </div>

              {/* Farm Location */}
              <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                  <span>Farm Location / Zone</span>
                </div>
                <LocationSelector
                  state={farmerEditState}
                  district={farmerEditDistrict}
                  taluk={farmerEditTaluk}
                  village={farmerEditVillage}
                  pincode={farmerEditPincode}
                  onChange={(patch) => {
                    if (patch.state !== undefined) setFarmerEditState(patch.state);
                    if (patch.district !== undefined) setFarmerEditDistrict(patch.district);
                    if (patch.taluk !== undefined) setFarmerEditTaluk(patch.taluk);
                    if (patch.village !== undefined) setFarmerEditVillage(patch.village);
                    if (patch.pincode !== undefined) setFarmerEditPincode(patch.pincode);
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <Button variant="ghost" onClick={() => setShowEditFarmerModal(false)} disabled={farmerEditSaving}>
                Cancel
              </Button>
              <Button onClick={() => void handleSaveFarmerEdit()} disabled={farmerEditSaving || !farmerEditName.trim()}>
                {farmerEditSaving ? 'Saving Changes...' : 'Save Farmer Details'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default DedicatedAgentCallingWorkspace;
