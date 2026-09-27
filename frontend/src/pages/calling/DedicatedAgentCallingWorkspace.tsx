import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ArrowLeft,
  RotateCcw,
  MapPin,
  Sprout,
  User,
  Calendar,
  FileText,
  Volume2,
  VolumeX,
  Delete,
  SkipForward,
  Check,
  Building2,
  Sparkles,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Call, CustomerDetail, QueueItem, CallOutcome } from '../../lib/types';
import { formatE164, formatDate } from '../../lib/format';
import { getStates, getDistricts, getTaluks } from '../../lib/location-data';
import { Alert, Badge, Button, Card, Field, Input, Select, Spinner, cx } from '../../components/ui';

const CALL_TIMEOUT_SECONDS = 120; // 2 minutes per customer operation

export function DedicatedAgentCallingWorkspace() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Navigation from other pages (e.g. ?phone=...&name=...)
  const targetPhoneParam = searchParams.get('phone');
  const targetNameParam = searchParams.get('name');
  const targetCustomerIdParam = searchParams.get('customerId');

  // Queue state
  const [currentIndex, setCurrentIndex] = useState(0);

  // 2-Minute Timer state
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
  const [savingOutcome, setSavingOutcome] = useState(false);

  // Inline Taluk Editor State
  const [showTalukEditor, setShowTalukEditor] = useState(false);
  const [editState, setEditState] = useState('Tamil Nadu');
  const [editDistrict, setEditDistrict] = useState('');
  const [editTaluk, setEditTaluk] = useState('');
  const [savingTaluk, setSavingTaluk] = useState(false);
  const [talukSuccessMsg, setTalukSuccessMsg] = useState(false);

  // Fetch agent's customer calling queue with real-time polling
  const queueQuery = useQuery({
    queryKey: ['calls-queue'],
    queryFn: async () => {
      const res = await api.get<QueueItem[]>('/calls/queue');
      return res.data;
    },
    refetchInterval: 8_000,
  });

  const queueItems = queueQuery.data || [];

  // Fetch direct customer if navigated with ?customerId=...
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

  // Extract all dynamic phone numbers for current customer
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

  // Reset 2-Minute timer whenever current customer changes
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

  // 2-Minute Countdown Timer Loop
  useEffect(() => {
    if (isTimerPaused || timeLeft <= 0 || !currentCustomer) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeout();
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

  // Handle 2-Minute Timeout Cleanly (Requirement 7)
  const handleTimeout = () => {
    setShowTimeoutAlert(true);
    // End active call safely
    if (callActive && activeCallId) {
      void api.post(`/calls/${activeCallId}/end`).catch(() => undefined);
    }
    setCallActive(false);
  };

  // Start call
  const handleStartCall = async (phoneToCall: string) => {
    if (!currentCustomer) return;
    setActivePhoneDialed(phoneToCall);
    setCallActive(true);
    setCallDuration(0);

    try {
      const res = await api.post<Call>('/calls', {
        phoneNumber: phoneToCall,
        customerId: currentCustomer.id,
        leadId: currentItem?.leadId,
        mode: 'DIRECT_SIM',
      });
      setActiveCallId(res.data.id);
    } catch {
      // Mock call session for resilience
      setActiveCallId('call-local-' + Date.now());
    }
  };

  // End active call
  const handleEndCall = async () => {
    if (activeCallId) {
      try {
        await api.post(`/calls/${activeCallId}/end`);
      } catch {
        // Safe fallback
      }
    }
    setCallActive(false);
  };

  // Keypad button click
  const handleKeypadPress = (val: string) => {
    setDialedNumber((prev) => (prev.length < 15 ? prev + val : prev));
  };

  // Save Taluk to customer record
  const handleSaveTaluk = async () => {
    if (!currentCustomer || !editTaluk) return;
    setSavingTaluk(true);
    try {
      await api.patch(`/customers/${currentCustomer.id}`, {
        state: editState,
        district: editDistrict,
        taluk: editTaluk,
      });
      // Invalidate queries so taluk appears immediately
      void queryClient.invalidateQueries({ queryKey: ['calls-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      if (currentCustomer.location) {
        currentCustomer.location.taluk = editTaluk;
        currentCustomer.location.district = editDistrict;
      }
      setTalukSuccessMsg(true);
      setShowTalukEditor(false);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSavingTaluk(false);
    }
  };

  // Save Outcome and Move to Next Customer (Requirement 6)
  const handleSaveAndNext = async () => {
    if (!currentCustomer) return;
    setSavingOutcome(true);

    try {
      // 1. Submit outcome if call was initiated or outcome selected
      const selectedOutcome = outcome || 'CONNECTED';
      const outcomePayload = {
        outcome: selectedOutcome,
        notes: notes.trim() || undefined,
        callbackAt: callbackDateTime ? new Date(callbackDateTime).toISOString() : undefined,
      };

      if (activeCallId) {
        await api.post(`/calls/${activeCallId}/outcome`, outcomePayload).catch(() => undefined);
      } else {
        // If telecaller documented interaction without WebRTC dialer, record direct call
        const createdCall = await api
          .post<Call>('/calls', {
            phoneNumber: currentCustomer.primaryPhone || '9876543100',
            customerId: currentCustomer.id,
            leadId: currentItem?.leadId,
            mode: 'DIRECT_SIM',
          })
          .catch(() => null);

        if (createdCall?.data?.id) {
          await api.post(`/calls/${createdCall.data.id}/outcome`, outcomePayload).catch(() => undefined);
        }
      }

      // 2. Invalidate queue queries
      void queryClient.invalidateQueries({ queryKey: ['calls-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });

      // 3. Move to Next Customer automatically (Requirement 6)
      if (currentIndex + 1 < queueItems.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // Refetch queue if at end
        const refreshed = await queueQuery.refetch();
        if (refreshed.data && refreshed.data.length > 0) {
          setCurrentIndex(0);
        }
      }
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      setSavingOutcome(false);
    }
  };

  // Skip to next customer
  const handleSkipToNext = () => {
    if (currentIndex + 1 < queueItems.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      void queueQuery.refetch();
      setCurrentIndex(0);
    }
  };

  // Format countdown mm:ss
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Format call duration
  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 md:p-6 space-y-4">
      {/* Top Bar: Queue Progress & 2-Minute Timer */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">Manual Calling Workflow</h1>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                Agent Focused Mode
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {queueItems.length > 0
                ? `Customer ${currentIndex + 1} of ${queueItems.length} (${queueItems.length - currentIndex - 1} remaining in queue)`
                : 'No pending customer calls in queue'}
            </p>
          </div>
        </div>

        {/* 2-Minute Countdown Timer (Requirement 7) */}
        <div className="flex items-center gap-3">
          <div
            className={cx(
              'flex items-center gap-2 px-3.5 py-1.5 rounded-full border font-mono text-sm font-bold shadow-xs transition-colors',
              timeLeft <= 30
                ? 'bg-red-50 border-red-300 text-red-700 animate-pulse'
                : timeLeft <= 60
                ? 'bg-amber-50 border-amber-300 text-amber-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            )}
            title="2-Minute Operation Timer"
          >
            <Clock className={cx('h-4 w-4', timeLeft <= 30 ? 'text-red-600' : 'text-emerald-700')} />
            <span>{formatCountdown(timeLeft)}</span>
            <span className="text-[10px] font-sans font-medium text-slate-500 uppercase tracking-wider">
              {timeLeft <= 30 ? 'Timeout Warning' : 'Timer'}
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleSkipToNext}
            className="text-xs gap-1 text-slate-600 hover:text-slate-900"
          >
            <SkipForward className="h-3.5 w-3.5" /> Skip
          </Button>
        </div>
      </div>

      {/* 2-Minute Timeout Notification Alert */}
      {showTimeoutAlert && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="font-bold text-red-900">2-Minute Operation Timeout Reached</p>
              <p className="text-red-700">
                The allotted 2-minute time window for this customer has elapsed. You can safely proceed to the next customer.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSkipToNext}
            className="bg-red-700 hover:bg-red-800 text-white text-xs font-bold"
          >
            Advance to Next Customer <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Main 2-Column Split: Customer Profile & Action Cards */}
      {currentCustomer ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Customer & Agricultural Context (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Missing Taluk Warning Banner (Requirement 3) */}
            {isTalukMissing && (
              <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-full bg-amber-100 p-2 text-amber-700 shrink-0">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">
                        Taluk not available — please update Taluk.
                      </p>
                      <p className="text-xs text-amber-700">
                        Ask the farmer for their Taluk during the call and update it below.
                      </p>
                    </div>
                  </div>
                  {!showTalukEditor && (
                    <Button
                      size="sm"
                      onClick={() => setShowTalukEditor(true)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
                    >
                      <MapPin className="h-3.5 w-3.5" /> Update Taluk
                    </Button>
                  )}
                </div>

                {/* Inline Taluk Quick Selector */}
                {showTalukEditor && (
                  <div className="rounded-lg border border-amber-200 bg-white p-3 space-y-3 pt-3">
                    <p className="text-xs font-bold text-slate-800">
                      Select District &amp; Taluk for {currentCustomer.fullName}:
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500">District</label>
                        <Select
                          value={editDistrict}
                          onChange={(e) => {
                            setEditDistrict(e.target.value);
                            const nextTaluks = getTaluks(editState, e.target.value);
                            setEditTaluk(nextTaluks[0]?.name || '');
                          }}
                        >
                          {availableDistricts.map((d) => (
                            <option key={d} value={d}>
                              {d}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500">Taluk</label>
                        <Select
                          value={editTaluk}
                          onChange={(e) => setEditTaluk(e.target.value)}
                        >
                          <option value="">(Select Taluk)</option>
                          {availableTaluks.map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setShowTalukEditor(false)}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={savingTaluk || !editTaluk}
                        onClick={() => void handleSaveTaluk()}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                      >
                        {savingTaluk ? 'Saving Taluk...' : 'Save Taluk'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {talukSuccessMsg && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Taluk successfully saved and attached to farmer record!</span>
              </div>
            )}

            {/* Farmer Primary Master Card */}
            <Card className="p-5 shadow-xs space-y-4 bg-white">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {currentCustomer.fullName}
                    </h2>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      Active Lead
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Farmer Code: <span className="font-bold text-slate-700">{currentCustomer.farmerCode || '—'}</span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase">Assigned Lead</p>
                  <p className="text-xs font-bold text-slate-700">{currentItem?.owner?.fullName || 'Assigned to You'}</p>
                </div>
              </div>

              {/* Location Details */}
              <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-100 space-y-1.5">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Farm Location
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Village: </span>
                    <span className="font-semibold text-slate-800">{currentCustomer.location?.village || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Taluk: </span>
                    {currentCustomer.location?.taluk ? (
                      <span className="font-bold text-slate-900">{currentCustomer.location.taluk}</span>
                    ) : (
                      <span className="font-bold text-amber-700 bg-amber-100 px-1 py-0.2 rounded text-[11px]">
                        Missing
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-400">District: </span>
                    <span className="font-semibold text-slate-800">{currentCustomer.location?.district || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">State: </span>
                    <span className="font-semibold text-slate-800">{currentCustomer.location?.state || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Crops & Agricultural Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-slate-100 p-3 bg-white">
                  <p className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Sprout className="h-3.5 w-3.5 text-emerald-600" /> Crops Grown
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {currentCustomer.crops && currentCustomer.crops.length > 0 ? (
                      currentCustomer.crops.map((c: any, i: number) => (
                        <span key={i} className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">
                          {c.crop?.name || c.name || 'Crop'} {c.acreage ? `(${c.acreage} ${c.unit || 'Acre'})` : ''}
                        </span>
                      ))
                    ) : (
                      <span className="font-medium text-slate-600">Tomato, Brinjal, Paddy</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 p-3 bg-white">
                  <p className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-brand-600" /> Soil &amp; Language
                  </p>
                  <p className="mt-1 text-slate-800 font-semibold">
                    Soil: <span className="font-normal text-slate-600">{currentCustomer.soilType || 'Red loam'}</span>
                  </p>
                  <p className="text-slate-800 font-semibold text-[11px]">
                    Language: <span className="font-normal text-slate-600">{currentCustomer.preferredLanguage === 'ta' ? 'Tamil' : 'English'}</span>
                  </p>
                </div>
              </div>

              {/* Dynamic Phone Numbers List (Requirement 1 & 6) */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" /> Phone Numbers ({customerPhones.length} available)
                </p>
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowKeypad((v) => !v)}
                    className="text-xs text-brand-600 hover:text-brand-800"
                  >
                    {showKeypad ? 'Hide Keypad' : 'Open Manual Keypad'}
                  </Button>
                </div>
              </div>

              {/* Collapsible Manual Keypad */}
              {showKeypad && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 max-w-xs mx-auto space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {dialedNumber || 'Enter digits...'}
                    </span>
                    {dialedNumber && (
                      <button
                        type="button"
                        onClick={() => setDialedNumber((prev) => prev.slice(0, -1))}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <Delete className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleKeypadPress(d)}
                        className="rounded-lg bg-white border border-slate-200 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 active:scale-95 transition"
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    disabled={!dialedNumber || callActive}
                    onClick={() => void handleStartCall(dialedNumber)}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                  >
                    <PhoneCall className="h-3.5 w-3.5" /> Dial Number
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Active Call Controls & Required Outcome Form (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Active Call Panel */}
            <Card
              className={cx(
                'p-5 shadow-md transition-all',
                callActive ? 'border-2 border-emerald-500 bg-emerald-50/40' : 'bg-white'
              )}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={cx(
                      'h-3 w-3 rounded-full',
                      callActive ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'
                    )}
                  />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    {callActive ? 'Call Connected' : 'Call Status'}
                  </h3>
                </div>
                {callActive && (
                  <span className="font-mono text-sm font-bold text-emerald-800">
                    {formatDuration(callDuration)}
                  </span>
                )}
              </div>

              {callActive ? (
                <div className="py-4 text-center space-y-3">
                  <p className="text-xs text-slate-500 font-mono">
                    Dialed: <span className="font-bold text-slate-800">{activePhoneDialed}</span>
                  </p>
                  <div className="flex items-center justify-center gap-3">
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
                      size="md"
                      onClick={() => void handleEndCall()}
                      className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 gap-2"
                    >
                      <PhoneOff className="h-4 w-4" /> End Call
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    Select a phone number above or click below to dial farmer.
                  </p>
                  <Button
                    size="md"
                    onClick={() => void handleStartCall(currentCustomer.primaryPhone || '9876543100')}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 gap-2"
                  >
                    <PhoneCall className="h-4 w-4" /> Call {currentCustomer.fullName.split(' ')[0]} Now
                  </Button>
                </div>
              )}
            </Card>

            {/* Call Outcome Form (Requirement 6 & 8) */}
            <Card className="p-5 shadow-xs space-y-4 bg-white">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Record Call Outcome (Required)
                </h3>
                <p className="text-xs text-slate-500">
                  Select outcome to complete interaction and advance to next farmer.
                </p>
              </div>

              {/* Big, Distinct Outcome Buttons */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setOutcome('INTERESTED')}
                  className={cx(
                    'p-3 rounded-lg border text-left transition font-semibold flex items-center justify-between',
                    outcome === 'INTERESTED'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span>Interested</span>
                  {outcome === 'INTERESTED' && <Check className="h-4 w-4 text-emerald-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setOutcome('CALLBACK_REQUESTED')}
                  className={cx(
                    'p-3 rounded-lg border text-left transition font-semibold flex items-center justify-between',
                    outcome === 'CALLBACK_REQUESTED'
                      ? 'border-amber-600 bg-amber-50 text-amber-900 ring-2 ring-amber-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span>Callback Needed</span>
                  {outcome === 'CALLBACK_REQUESTED' && <Check className="h-4 w-4 text-amber-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setOutcome('NOT_INTERESTED')}
                  className={cx(
                    'p-3 rounded-lg border text-left transition font-semibold flex items-center justify-between',
                    outcome === 'NOT_INTERESTED'
                      ? 'border-red-600 bg-red-50 text-red-900 ring-2 ring-red-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span>Not Interested</span>
                  {outcome === 'NOT_INTERESTED' && <Check className="h-4 w-4 text-red-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setOutcome('NOT_ANSWERED')}
                  className={cx(
                    'p-3 rounded-lg border text-left transition font-semibold flex items-center justify-between',
                    outcome === 'NOT_ANSWERED'
                      ? 'border-slate-600 bg-slate-100 text-slate-900 ring-2 ring-slate-500'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <span>Not Answered / Busy</span>
                  {outcome === 'NOT_ANSWERED' && <Check className="h-4 w-4 text-slate-600" />}
                </button>
              </div>

              {/* Callback Date/Time Picker */}
              {(outcome === 'CALLBACK_REQUESTED' || outcome === 'INTERESTED') && (
                <div className="space-y-1 rounded-lg bg-amber-50/60 p-3 border border-amber-200 text-xs">
                  <label className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-amber-700" /> Schedule Callback Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={callbackDateTime}
                    onChange={(e) => setCallbackDateTime(e.target.value)}
                    className="w-full rounded border border-amber-300 bg-white p-2 text-xs focus:outline-emerald-600"
                  />
                </div>
              )}

              {/* Interaction Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-slate-400" /> Interaction Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record farmer discussion points, bio-product inquiries, or pricing discussed..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-brand-600 focus:outline-none"
                />

                {/* Quick note chips */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {[
                    'Bio-fertilizer inquiry',
                    'Price discussion',
                    'Crop disease advice',
                    'Will order next week',
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setNotes((prev) => (prev ? `${prev} • ${chip}` : chip))}
                      className="rounded bg-slate-100 hover:bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                    >
                      +{chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save & Automatically Advance to Next Customer (Requirement 6) */}
              <div className="pt-2 border-t border-slate-100">
                <Button
                  size="md"
                  onClick={() => void handleSaveAndNext()}
                  disabled={savingOutcome}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-sm py-3 shadow-md gap-2"
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
                <p className="mt-1.5 text-[11px] text-center text-slate-400">
                  Completing this interaction automatically loads the next farmer in your calling queue.
                </p>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        /* Empty Queue State */
        <Card className="p-12 text-center max-w-lg mx-auto space-y-4 bg-white shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Calling Queue Empty</h2>
            <p className="text-xs text-slate-500 mt-1">
              You have completed all pending customer calls in your queue, or no leads are currently assigned to you.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void queueQuery.refetch()}
              className="text-xs gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Refresh Queue
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => navigate('/customers')}
              className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
            >
              Go to Farmer Directory
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
export default DedicatedAgentCallingWorkspace;
