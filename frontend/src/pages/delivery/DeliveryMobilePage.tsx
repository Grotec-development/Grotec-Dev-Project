import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Camera,
  Navigation,
  Check,
  IndianRupee,
  Calendar,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
  X,
  Compass,
  ChevronRight,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatNumber } from '../../lib/format';
import { SyncStatusBar } from '../../components/delivery/SyncStatusBar';
import { PaymentSlipModal, PaymentSlipData } from '../../components/delivery/PaymentSlipModal';
import {
  cacheActiveTrip,
  getCachedActiveTrip,
  saveDeliveryDraft,
  getDeliveryDraft,
  clearDeliveryDraft,
  enqueueOperation,
} from '../../lib/offline/db';
import { syncEngine } from '../../lib/offline/syncEngine';
import { compressImageFile, triggerHaptic } from '../../lib/imageCompression';

export function DeliveryMobilePage() {
  const queryClient = useQueryClient();

  const [selectedStop, setSelectedStop] = useState<any | null>(null);
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  // Active slip for viewing
  const [activeSlip, setActiveSlip] = useState<PaymentSlipData | null>(null);
  const [isSlipModalOpen, setIsSlipModalOpen] = useState(false);

  // POD Form State
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [podNotes, setPodNotes] = useState('');
  const [deliveredQuantities, setDeliveredQuantities] = useState<Record<string, number>>({});
  const [capturedGps, setCapturedGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentReceiptPhoto, setPaymentReceiptPhoto] = useState<string | null>(null);

  // Call Outcome State
  const [callOutcome, setCallOutcome] = useState('CONFIRMED');
  const [callNotes, setCallNotes] = useState('');
  const [rescheduledDate, setRescheduledDate] = useState('');

  // Exception Form State
  const [exceptionReason, setExceptionReason] = useState('CUSTOMER_UNAVAILABLE');
  const [exceptionNotes, setExceptionNotes] = useState('');

  // Field Lead State
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadVillage, setLeadVillage] = useState('');
  const [leadNotes, setLeadNotes] = useState('');

  // Fetch active trip from API with fallback to IndexedDB
  const { data: trip, isLoading, refetch } = useQuery({
    queryKey: ['active-trip'],
    queryFn: async () => {
      try {
        const res = await api.get('/delivery/active-trip');
        if (res.data) {
          await cacheActiveTrip(res.data);
          return res.data;
        }
      } catch (err) {
        // Fallback to offline cached trip
        const cached = await getCachedActiveTrip();
        if (cached) return cached;
        throw err;
      }
      return null;
    },
    refetchInterval: 12_000,
  });

  // Auto-restore draft when opening POD modal
  useEffect(() => {
    if (selectedStop?.id && isPodModalOpen) {
      void getDeliveryDraft(selectedStop.id).then((draft) => {
        if (draft) {
          setRecipientName(draft.recipientName || '');
          setRecipientPhone(draft.recipientPhone || '');
          setSignatureText(draft.signatureText || '');
          setPodNotes(draft.podNotes || '');
          if (draft.deliveredItems?.length) {
            const map: Record<string, number> = {};
            draft.deliveredItems.forEach((i) => {
              map[i.orderItemId] = i.deliveredQty;
            });
            setDeliveredQuantities(map);
          }
        } else {
          // Initialize default quantities to order quantities
          const initialMap: Record<string, number> = {};
          selectedStop.order?.items?.forEach((item: any) => {
            initialMap[item.id] = Number(item.quantity || 1);
          });
          setDeliveredQuantities(initialMap);
        }
      });
    }
  }, [selectedStop, isPodModalOpen]);

  // Capture GPS on demand
  const handleCaptureGps = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCapturedGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Math.round(pos.coords.accuracy),
          });
        },
        () => {
          alert('GPS capture failed. Please ensure location permissions are granted.');
        },
        { enableHighAccuracy: true, timeout: 10_000 }
      );
    }
  };

  // Open Google Maps Navigation
  const handleOpenNavigation = (stop: any) => {
    const loc = stop.order?.customer?.locations?.[0];
    const destination = loc
      ? encodeURIComponent(`${loc.village || ''}, ${loc.taluk || ''}, ${loc.district || ''}, Tamil Nadu`)
      : 'Tamil Nadu';
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
  };

  // 1. Update stop travel status (DEPART -> EN_ROUTE or ARRIVE -> ARRIVED)
  const handleUpdateStopStatus = async (stop: any, newStatus: string) => {
    const isOnline = navigator.onLine;

    if (!isOnline) {
      await enqueueOperation({
        action: 'UPDATE_STATUS',
        stopId: stop.id,
        tripId: trip.id,
        payload: { status: newStatus },
      });
      alert(`Recorded ${newStatus} locally. Will sync when reconnected.`);
      void refetch();
      return;
    }

    try {
      await api.patch(`/delivery/stops/${stop.id}/status`, { status: newStatus });
      void queryClient.invalidateQueries({ queryKey: ['active-trip'] });
    } catch {
      // Fallback to queue
      await enqueueOperation({
        action: 'UPDATE_STATUS',
        stopId: stop.id,
        tripId: trip.id,
        payload: { status: newStatus },
      });
      alert(`Network error: status update saved locally for sync.`);
    }
  };

  // 2. Submit Call Outcome
  const handleCallSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStop) return;

    const payload = {
      outcome: callOutcome,
      notes: callNotes,
      confirmedDate: callOutcome === 'CONFIRMED' ? new Date().toISOString() : undefined,
      rescheduledDate: callOutcome === 'RESCHEDULED' ? rescheduledDate : undefined,
    };

    if (!navigator.onLine) {
      await enqueueOperation({
        action: 'RECORD_CALL',
        stopId: selectedStop.id,
        tripId: trip.id,
        payload,
      });
      alert('Call outcome queued locally for sync.');
      setIsCallModalOpen(false);
      return;
    }

    try {
      await api.post(`/delivery/stops/${selectedStop.id}/call-outcome`, payload);
      alert('Call outcome recorded.');
      setIsCallModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['active-trip'] });
    } catch {
      await enqueueOperation({
        action: 'RECORD_CALL',
        stopId: selectedStop.id,
        tripId: trip.id,
        payload,
      });
      alert('Network interrupted. Call outcome saved offline.');
      setIsCallModalOpen(false);
    }
  };

  // 3. Save POD Draft
  const handleSaveDraft = async () => {
    if (!selectedStop) return;
    const itemsList = Object.entries(deliveredQuantities).map(([orderItemId, deliveredQty]) => ({
      orderItemId,
      deliveredQty,
    }));

    await saveDeliveryDraft({
      stopId: selectedStop.id,
      recipientName,
      recipientPhone,
      signatureText,
      podNotes,
      deliveredItems: itemsList,
      paymentCollected: false,
      updatedAt: new Date().toISOString(),
    });
    alert('Delivery draft saved locally on this device!');
  };

  // 4. Submit Delivery & POD
  const handlePodSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStop) return;

    const itemsList = Object.entries(deliveredQuantities).map(([orderItemId, deliveredQty]) => ({
      orderItemId,
      deliveredQty,
    }));

    const payload = {
      recipientName: recipientName || selectedStop.order?.customer?.fullName,
      recipientPhone,
      signatureUrl: signatureText ? `digital-sig:${signatureText}` : null,
      photoUrl: photoPreview || null,
      podNotes,
      deliveredItems: itemsList,
      gpsLatitude: capturedGps?.lat,
      gpsLongitude: capturedGps?.lng,
    };

    if (!navigator.onLine) {
      await enqueueOperation({
        action: 'COMPLETE_DELIVERY',
        stopId: selectedStop.id,
        tripId: trip.id,
        payload,
      });
      await clearDeliveryDraft(selectedStop.id);
      triggerHaptic('success');
      alert('Proof of Delivery saved locally! Will automatically sync upon reconnecting.');
      setIsPodModalOpen(false);
      return;
    }

    try {
      await api.post(`/delivery/stops/${selectedStop.id}/complete`, payload);
      await clearDeliveryDraft(selectedStop.id);
      triggerHaptic('success');
      alert('Delivery & POD successfully recorded on server!');
      setIsPodModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['active-trip'] });
    } catch (err: any) {
      await enqueueOperation({
        action: 'COMPLETE_DELIVERY',
        stopId: selectedStop.id,
        tripId: trip.id,
        payload,
      });
      await clearDeliveryDraft(selectedStop.id);
      alert('Network issue: Delivery record queued for offline sync.');
      setIsPodModalOpen(false);
    }
  };

  // 5. Submit Payment Collection
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStop) return;
    if (paymentAmount <= 0) {
      alert('Please enter a valid collection amount.');
      return;
    }

    const payload = {
      amount: paymentAmount,
      paymentMethod,
      referenceNumber: paymentRef || null,
      notes: paymentNotes || null,
      photoUrl: paymentReceiptPhoto || null,
    };
    triggerHaptic('success');

    const order = selectedStop.order;
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const slipNumber = `COLL-${dateCode}-${Math.floor(1000 + Math.random() * 9000)}`;

    const localSlip: PaymentSlipData = {
      slipNumber,
      orderNumber: order?.orderNumber || '—',
      invoiceNumber: order?.invoice?.invoiceNumber,
      customerName: order?.customer?.fullName || 'Customer',
      farmerCode: order?.customer?.farmerCode,
      orderTotal: Number(order?.totalAmount || 0),
      previousPaid: Number(order?.advancePaidAmount || 0),
      amountCollected: Number(paymentAmount),
      remainingBalance: Math.max(0, Number(order?.totalAmount || 0) - (Number(order?.advancePaidAmount || 0) + Number(paymentAmount))),
      paymentMethod,
      transactionReference: paymentRef,
      collectedAt: new Date().toISOString(),
      agentName: trip?.driver?.fullName || 'Delivery Specialist',
      status: 'PENDING_APPROVAL',
      isApproved: false,
    };

    if (!navigator.onLine) {
      await enqueueOperation({
        action: 'SUBMIT_PAYMENT',
        stopId: selectedStop.id,
        tripId: trip.id,
        payload,
      });
      setIsPaymentModalOpen(false);
      setActiveSlip(localSlip);
      setIsSlipModalOpen(true);
      return;
    }

    try {
      const res = await api.post(`/delivery/stops/${selectedStop.id}/payments`, payload);
      setIsPaymentModalOpen(false);
      setActiveSlip(res.data?.slip || localSlip);
      setIsSlipModalOpen(true);
      void queryClient.invalidateQueries({ queryKey: ['active-trip'] });
    } catch {
      await enqueueOperation({
        action: 'SUBMIT_PAYMENT',
        stopId: selectedStop.id,
        tripId: trip.id,
        payload,
      });
      setIsPaymentModalOpen(false);
      setActiveSlip(localSlip);
      setIsSlipModalOpen(true);
    }
  };

  // 6. Record Delivery Exception
  const handleExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStop) return;

    const payload = {
      status: 'EXCEPTION',
      reason: exceptionReason,
      notes: exceptionNotes,
    };

    if (!navigator.onLine) {
      await enqueueOperation({
        action: 'UPDATE_STATUS',
        stopId: selectedStop.id,
        tripId: trip.id,
        payload,
      });
      alert('Exception recorded locally. Will sync when reconnected.');
      setIsExceptionModalOpen(false);
      return;
    }

    try {
      await api.patch(`/delivery/stops/${selectedStop.id}/status`, payload);
      alert('Delivery exception reported to dispatch console.');
      setIsExceptionModalOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['active-trip'] });
    } catch {
      await enqueueOperation({
        action: 'UPDATE_STATUS',
        stopId: selectedStop.id,
        tripId: trip.id,
        payload,
      });
      alert('Exception saved locally for sync.');
      setIsExceptionModalOpen(false);
    }
  };

  // 7. Field Lead Capture
  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !leadPhone) {
      alert('Farmer Name and Phone are required.');
      return;
    }

    const payload = {
      fullName: leadName,
      phone: leadPhone,
      village: leadVillage,
      notes: leadNotes,
    };

    if (!navigator.onLine) {
      await enqueueOperation({
        action: 'CREATE_FIELD_LEAD',
        tripId: trip?.id,
        payload,
      });
      alert('Field farmer lead queued locally. Will sync to telecalling queue!');
      setIsLeadModalOpen(false);
      setLeadName('');
      setLeadPhone('');
      return;
    }

    try {
      await api.post('/delivery/field-lead', payload);
      alert('Field lead captured and assigned to CRM queue!');
      setIsLeadModalOpen(false);
      setLeadName('');
      setLeadPhone('');
    } catch {
      await enqueueOperation({
        action: 'CREATE_FIELD_LEAD',
        tripId: trip?.id,
        payload,
      });
      alert('Lead saved offline for sync.');
      setIsLeadModalOpen(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
        <RefreshCw className="h-5 w-5 animate-spin text-emerald-700" />
        <span>Loading delivery run manifest…</span>
      </div>
    );
  }

  const completedStops = trip?.stops?.filter((s: any) => s.status === 'COMPLETED' || s.status === 'PARTIAL_DELIVERY').length || 0;
  const totalStops = trip?.stops?.length || 0;
  const progressPercent = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-20 p-3 sm:p-4">
      {/* 1. Persistent Sync Status Bar */}
      <SyncStatusBar />

      {/* No active trip state */}
      {!trip ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-sm my-6">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-full w-fit mx-auto">
            <Truck className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900">No Active Trip Assigned</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You currently have no active or in-transit delivery trip assigned. Check with your dispatch manager or capture a field farmer prospect.
          </p>
          <button
            type="button"
            onClick={() => setIsLeadModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
          >
            <UserPlus className="h-4 w-4" />
            <span>Capture Field Farmer Lead</span>
          </button>
        </div>
      ) : (
        <>
          {/* 2. Swiggy-Style Active Delivery Trip Banner */}
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {trip.tripNumber}
                </span>
                <h2 className="text-lg font-black mt-1 text-white flex items-center gap-2">
                  <span>{trip.vehicle?.regNumber}</span>
                  <span className="text-xs font-normal text-slate-400">({trip.vehicle?.model})</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Driver: <span className="text-slate-200 font-semibold">{trip.driver?.fullName}</span>
                  {trip.helperName && ` • Helper: ${trip.helperName}`}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsLeadModalOpen(true)}
                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 text-[11px] font-bold shadow-xs transition"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>New Lead</span>
              </button>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Trip Completion</span>
                <span className="font-bold text-white">
                  {completedStops} / {totalStops} Drops ({progressPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3. Sequenced Delivery Stops */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Scheduled Stops ({trip.stops?.length || 0})
              </h3>
              <span className="text-[10px] text-slate-400">Tap a stop to open actions</span>
            </div>

            {trip.stops?.map((stop: any, index: number) => {
              const farmer = stop.order?.customer;
              const phone = farmer?.phones?.[0]?.phoneE164 || '';
              const loc = farmer?.locations?.[0];
              const isCompleted = stop.status === 'COMPLETED' || stop.status === 'PARTIAL_DELIVERY';
              const isArrived = stop.status === 'ARRIVED';
              const isEnRoute = stop.status === 'EN_ROUTE';

              return (
                <div
                  key={stop.id}
                  className={`bg-white rounded-2xl border transition-all p-4 space-y-3 shadow-xs ${
                    isCompleted
                      ? 'border-emerald-200 bg-emerald-50/15'
                      : isArrived
                      ? 'border-blue-500 ring-2 ring-blue-500/10'
                      : isEnRoute
                      ? 'border-amber-400 ring-2 ring-amber-400/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Stop Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-800 font-black text-xs font-mono">
                        #{index + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 leading-tight">
                          {farmer?.fullName || 'Farmer Customer'}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {farmer?.farmerCode ? `ID: ${farmer.farmerCode} • ` : ''}Order {stop.order?.orderNumber}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : isArrived
                          ? 'bg-blue-100 text-blue-800'
                          : isEnRoute
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {stop.status}
                    </span>
                  </div>

                  {/* Location & Landmark */}
                  <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <MapPin className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800">
                        {loc?.village ? `${loc.village}, ` : ''}
                        {loc?.taluk ? `${loc.taluk}, ` : ''}
                        {loc?.district || 'Tamil Nadu'}
                      </p>
                      {stop.order?.deliveryAddress && (
                        <p className="text-[11px] text-slate-500 truncate">{stop.order.deliveryAddress}</p>
                      )}
                    </div>
                  </div>

                  {/* Order Products Summary */}
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between text-slate-500 font-semibold text-[10px] uppercase">
                      <span>Products</span>
                      <span>Balance Due</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <div className="text-slate-800 font-medium truncate max-w-[240px]">
                        {stop.order?.items?.map((i: any) => `${i.product?.name || 'Agri Product'} (${i.quantity} ${i.unit || 'units'})`).join(', ')}
                      </div>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        ₹{formatNumber(Number(stop.order?.totalAmount || 0) - Number(stop.order?.advancePaidAmount || 0))}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    {/* Left: Communication & Navigation */}
                    <div className="flex items-center gap-1.5">
                      {phone && (
                        <a
                          href={`tel:${phone}`}
                          onClick={() => {
                            setSelectedStop(stop);
                            setIsCallModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1 transition"
                        >
                          <Phone className="h-3.5 w-3.5 fill-current" />
                          <span>Call</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenNavigation(stop)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 text-xs font-bold flex items-center gap-1 transition"
                      >
                        <Compass className="h-3.5 w-3.5" />
                        <span>Navigate</span>
                      </button>
                    </div>

                    {/* Right: Operational Actions based on current status */}
                    <div className="flex items-center gap-1.5">
                      {!isCompleted && stop.status === 'PLANNED' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStopStatus(stop, 'EN_ROUTE')}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          <span>Start Travel</span>
                        </button>
                      )}

                      {!isCompleted && stop.status === 'EN_ROUTE' && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCaptureGps();
                            handleUpdateStopStatus(stop, 'ARRIVED');
                          }}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          <span>Arrived at Farm</span>
                        </button>
                      )}

                      {!isCompleted && stop.status === 'ARRIVED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStop(stop);
                              setIsPaymentModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition"
                          >
                            <IndianRupee className="h-3.5 w-3.5" />
                            <span>Collect</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStop(stop);
                              handleCaptureGps();
                              setIsPodModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Deliver &amp; POD</span>
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => {
                            const order = stop.order;
                            const slipData: PaymentSlipData = {
                              slipNumber: `REC-${order?.orderNumber}`,
                              orderNumber: order?.orderNumber || '—',
                              invoiceNumber: order?.invoice?.invoiceNumber,
                              customerName: farmer?.fullName || 'Customer',
                              farmerCode: farmer?.farmerCode,
                              orderTotal: Number(order?.totalAmount || 0),
                              previousPaid: Number(order?.advancePaidAmount || 0),
                              amountCollected: Number(order?.advancePaidAmount || 0),
                              remainingBalance: Math.max(0, Number(order?.totalAmount || 0) - Number(order?.advancePaidAmount || 0)),
                              paymentMethod: 'CASH',
                              collectedAt: stop.completedAt || new Date().toISOString(),
                              agentName: trip?.driver?.fullName || 'Delivery Specialist',
                              status: 'VERIFIED',
                              isApproved: true,
                            };
                            setActiveSlip(slipData);
                            setIsSlipModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1 transition"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View POD</span>
                        </button>
                      )}

                      {!isCompleted && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStop(stop);
                            setIsExceptionModalOpen(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Report Exception"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 4. MODAL: Customer Call Outcome */}
      {isCallModalOpen && selectedStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-slate-900">Appointment Call Outcome</h3>
              <button
                type="button"
                onClick={() => setIsCallModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCallSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Call Result</label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="CONFIRMED">Appointment Confirmed</option>
                  <option value="CALL_BACK">Call Back Later</option>
                  <option value="NO_ANSWER">No Answer</option>
                  <option value="BUSY">Line Busy</option>
                  <option value="RESCHEDULED">Customer Requests Rescheduling</option>
                  <option value="INVALID_NUMBER">Invalid Phone Number</option>
                  <option value="CUSTOMER_UNAVAILABLE">Customer Unavailable Today</option>
                </select>
              </div>

              {callOutcome === 'RESCHEDULED' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">New Requested Date</label>
                  <input
                    type="date"
                    value={rescheduledDate}
                    onChange={(e) => setRescheduledDate(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Call Notes</label>
                <textarea
                  rows={2}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Farmer directions or appointment instructions..."
                  className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCallModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold shadow-xs transition"
                >
                  Save Outcome
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: Delivery Completion & Proof of Delivery (POD) */}
      {isPodModalOpen && selectedStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-black text-slate-900">Complete Delivery &amp; Proof of Delivery (POD)</h3>
                <p className="text-[11px] text-slate-500">{selectedStop.order?.customer?.fullName} • Order #{selectedStop.order?.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPodModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePodSubmit} className="space-y-4 text-xs">
              {/* Product Quantities Verified */}
              <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                  Delivered Quantities
                </h4>
                {selectedStop.order?.items?.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-700 flex-1 truncate">
                      {item.product?.name || 'Product'} (Ordered: {item.quantity} {item.unit})
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={item.quantity}
                      value={deliveredQuantities[item.id] ?? item.quantity}
                      onChange={(e) =>
                        setDeliveredQuantities({
                          ...deliveredQuantities,
                          [item.id]: Number(e.target.value),
                        })
                      }
                      className="w-20 p-1.5 rounded-lg border border-slate-200 text-center font-mono font-bold"
                    />
                  </div>
                ))}
              </div>

              {/* Recipient Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Recipient Name</label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder={selectedStop.order?.customer?.fullName}
                    className="w-full p-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Recipient Phone</label>
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+91..."
                    className="w-full p-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              {/* GPS Coordinates Capture */}
              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-900 block text-[11px]">GPS Location Evidence</span>
                  <span className="text-[10px] text-emerald-700 font-mono">
                    {capturedGps
                      ? `Lat: ${capturedGps.lat.toFixed(5)}, Lng: ${capturedGps.lng.toFixed(5)} (±${capturedGps.accuracy}m)`
                      : 'Location not captured yet'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCaptureGps}
                  className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition shadow-xs"
                >
                  {capturedGps ? 'Recapture GPS' : 'Capture GPS'}
                </button>
              </div>

              {/* Photo Evidence Capture */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">Delivery / Goods Photo Evidence</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center gap-2 font-bold text-slate-700">
                    <Camera className="h-4 w-4 text-emerald-700" />
                    <span>Take Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          triggerHaptic('tap');
                          try {
                            const compressed = await compressImageFile(file, 1280, 1280, 0.75);
                            setPhotoPreview(compressed);
                          } catch {
                            const reader = new FileReader();
                            reader.onload = () => setPhotoPreview(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                  </label>
                  {photoPreview && (
                    <img
                      src={photoPreview}
                      alt="POD Preview"
                      className="h-12 w-12 object-cover rounded-lg border border-slate-200 shadow-xs"
                    />
                  )}
                </div>
              </div>

              {/* Digital Signature / Confirmation */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Recipient Signature / Confirmation Text
                </label>
                <input
                  type="text"
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  placeholder="e.g. Received in good condition by Farmer"
                  className="w-full p-2 rounded-lg border border-slate-200"
                />
              </div>

              {/* Delivery Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">POD Notes</label>
                <textarea
                  rows={2}
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                  placeholder="Unloaded at farmhouse shed..."
                  className="w-full p-2 rounded-lg border border-slate-200"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg font-bold"
                >
                  Save Draft
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPodModalOpen(false)}
                    className="px-3 py-2 text-slate-500 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold shadow-xs transition"
                  >
                    Confirm Delivery &amp; POD
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Payment Collection */}
      {isPaymentModalOpen && selectedStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-black text-slate-900">Record Payment Collection</h3>
                <p className="text-[11px] text-slate-500">Stop #{selectedStop.sequence} • Order {selectedStop.order?.orderNumber}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Collection Amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  placeholder="Enter collected rupees"
                  className="w-full p-2.5 rounded-lg border border-slate-200 font-mono font-bold text-base focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2 rounded-lg border border-slate-200 font-semibold"
                >
                  <option value="CASH">Cash Collection</option>
                  <option value="UPI">UPI / QR Code Transfer</option>
                  <option value="BANK_TRANSFER">Direct Bank NEFT / IMPS</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Transaction Reference (Optional for UPI/Bank)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="UTR / UPI Ref Number"
                  className="w-full p-2 rounded-lg border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Collection Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. Received 2 x ₹500 notes"
                  className="w-full p-2 rounded-lg border border-slate-200"
                />
              </div>

              {/* Receipt / Screenshot Attachment */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Payment Receipt / UPI Screenshot (Optional)
                </label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl flex items-center gap-2 font-bold text-slate-700 text-xs touch-tactile">
                    <Camera className="h-4 w-4 text-emerald-700" />
                    <span>Upload Proof</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          triggerHaptic('tap');
                          try {
                            const compressed = await compressImageFile(file, 1280, 1280, 0.75);
                            setPaymentReceiptPhoto(compressed);
                          } catch {
                            const reader = new FileReader();
                            reader.onload = () => setPaymentReceiptPhoto(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                    />
                  </label>
                  {paymentReceiptPhoto && (
                    <img
                      src={paymentReceiptPhoto}
                      alt="Receipt Preview"
                      className="h-10 w-10 object-cover rounded-lg border border-slate-200 shadow-xs"
                    />
                  )}
                </div>
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900">
                Notice: Collection will be submitted as <strong>Pending Approval</strong>. It requires warehouse manager verification before ledger posting.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold shadow-xs transition"
                >
                  Submit &amp; Generate Slip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: Report Delivery Exception */}
      {isExceptionModalOpen && selectedStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-rose-700">Report Delivery Incident / Exception</h3>
              <button
                type="button"
                onClick={() => setIsExceptionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleExceptionSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Exception Category</label>
                <select
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                >
                  <option value="CUSTOMER_UNAVAILABLE">Customer Unavailable at Farm</option>
                  <option value="REJECTED_BY_CUSTOMER">Goods Rejected by Customer</option>
                  <option value="WRONG_ADDRESS">Incomplete or Wrong Farm Location</option>
                  <option value="DAMAGED_GOODS">Goods Damaged in Transit</option>
                  <option value="VEHICLE_BREAKDOWN">Vehicle Mechanical Breakdown</option>
                  <option value="ROAD_CLOSURE">Road Blocked / Impassable Rural Route</option>
                  <option value="PAYMENT_DISPUTE">Payment Shortfall / Dispute</option>
                  <option value="RETURN_TO_DEPOT">Returned to Warehouse Depot</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Incident Notes</label>
                <textarea
                  rows={3}
                  required
                  value={exceptionNotes}
                  onChange={(e) => setExceptionNotes(e.target.value)}
                  placeholder="Explain incident details for dispatch supervisor..."
                  className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExceptionModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-xs transition"
                >
                  Report Exception
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: Field Farmer Lead Capture */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-black text-slate-900">Capture Field Farmer Prospect</h3>
              <button
                type="button"
                onClick={() => setIsLeadModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleLeadSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Farmer Full Name *</label>
                <input
                  type="text"
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="e.g. Ramanathan K"
                  className="w-full p-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full p-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Village / Landmark</label>
                <input
                  type="text"
                  value={leadVillage}
                  onChange={(e) => setLeadVillage(e.target.value)}
                  placeholder="e.g. Negamam, Pollachi"
                  className="w-full p-2 rounded-lg border border-slate-200"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Crop / Inquiry Notes</label>
                <input
                  type="text"
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder="e.g. Coconut 5 acres, interested in bio-fertilizer"
                  className="w-full p-2 rounded-lg border border-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLeadModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold shadow-xs transition"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL: Payment Slip */}
      {activeSlip && (
        <PaymentSlipModal
          isOpen={isSlipModalOpen}
          onClose={() => setIsSlipModalOpen(false)}
          slip={activeSlip}
        />
      )}
    </div>
  );
}
