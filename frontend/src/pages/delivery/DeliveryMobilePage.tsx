import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  UserPlus,
  X,
  Camera,
  Navigation,
  Check,
  IndianRupee,
} from 'lucide-react';
import { api } from '../../lib/api';

export function DeliveryMobilePage() {
  const queryClient = useQueryClient();
  const [selectedStop, setSelectedStop] = useState<any | null>(null);
  const [isPodModalOpen, setIsPodModalOpen] = useState(false);
  const [isExceptionModalOpen, setIsExceptionModalOpen] = useState(false);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  // POD Form State
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [podNotes, setPodNotes] = useState('');
  const [paymentCollected, setPaymentCollected] = useState(true);

  // Exception Form State
  const [selectedOrderItemId, setSelectedOrderItemId] = useState('');
  const [requestedQty, setRequestedQty] = useState(0);
  const [exceptionReason, setExceptionReason] = useState('');

  // Field Lead Form State
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadVillage, setLeadVillage] = useState('');
  const [leadNotes, setLeadNotes] = useState('');

  // Fetch active trip for driver
  const { data: trip, isLoading } = useQuery({
    queryKey: ['active-trip'],
    queryFn: async () => {
      const res = await api.get('/delivery/active-trip');
      return res.data;
    },
  });

  // Update stop status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ stopId, status }: any) => {
      const res = await api.patch(`/delivery/stops/${stopId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-trip'] });
    },
  });

  // Complete POD delivery mutation
  const completePodMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post(`/delivery/stops/${selectedStop.id}/complete`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-trip'] });
      setIsPodModalOpen(false);
      setSelectedStop(null);
      resetPodForm();
    },
  });

  // Request exception mutation
  const requestExceptionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/exceptions/quantity', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-trip'] });
      setIsExceptionModalOpen(false);
      setSelectedStop(null);
      setSelectedOrderItemId('');
      setRequestedQty(0);
      setExceptionReason('');
      alert('Quantity Exception submitted! Waiting for manager approval.');
    },
  });

  // Create field lead mutation
  const createLeadMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/delivery/field-lead', payload);
      return res.data;
    },
    onSuccess: () => {
      setIsLeadModalOpen(false);
      setLeadName('');
      setLeadPhone('');
      setLeadVillage('');
      setLeadNotes('');
      alert('Field Lead captured and assigned to CRM telecaller queue!');
    },
  });

  function resetPodForm() {
    setRecipientName('');
    setRecipientPhone('');
    setSignatureText('');
    setPodNotes('');
    setPaymentCollected(true);
  }

  function handlePodSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStop) return;

    completePodMutation.mutate({
      recipientName,
      recipientPhone,
      signatureUrl: signatureText ? `digital-sig:${signatureText}` : null,
      podNotes,
      paymentCollected,
    });
  }

  function handleExceptionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStop || !selectedOrderItemId) {
      alert('Please select an item');
      return;
    }

    requestExceptionMutation.mutate({
      tripId: trip.id,
      stopId: selectedStop.id,
      orderItemId: selectedOrderItemId,
      requestedQty,
      reason: exceptionReason,
    });
  }

  function handleLeadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadName || !leadPhone) {
      alert('Name and Phone are required');
      return;
    }

    createLeadMutation.mutate({
      fullName: leadName,
      phone: leadPhone,
      village: leadVillage,
      notes: leadNotes,
    });
  }

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading delivery run...</div>;
  }

  if (!trip) {
    return (
      <div className="max-w-md mx-auto p-6 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 my-8">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-full w-fit mx-auto">
          <Truck className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Active Trip Assigned</h2>
        <p className="text-sm text-slate-500">
          You currently have no active or in-transit delivery trip assigned to your driver account.
        </p>
        <button
          onClick={() => setIsLeadModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Capture Field Farmer Lead
        </button>
      </div>
    );
  }

  const completedStops = trip.stops.filter((s: any) => s.status === 'COMPLETED').length;
  const progressPercent = Math.round((completedStops / trip.stops.length) * 100);

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-12">
      {/* Active Trip Header */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-lg space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              ACTIVE TRIP: {trip.tripNumber}
            </span>
            <h2 className="text-xl font-bold mt-1.5">{trip.vehicle?.regNumber}</h2>
            <p className="text-xs text-slate-400">{trip.vehicle?.model} · Driver: {trip.driver?.fullName}</p>
          </div>
          <button
            onClick={() => setIsLeadModalOpen(true)}
            className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex items-center gap-1.5 text-xs font-medium shadow-md transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Lead
          </button>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Delivery Progress</span>
            <span className="font-semibold text-white">
              {completedStops} / {trip.stops.length} Stops ({progressPercent}%)
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

      {/* Sequenced Stops List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
          Trip Stops Sequence ({trip.stops.length})
        </h3>

        {trip.stops.map((stop: any) => {
          const farmer = stop.order?.customer;
          const phone = farmer?.phones?.[0]?.phoneE164 || '';
          const isCompleted = stop.status === 'COMPLETED';

          return (
            <div
              key={stop.id}
              className={`bg-white rounded-2xl border transition-all p-4 space-y-3 shadow-sm ${
                isCompleted
                  ? 'border-emerald-200 bg-emerald-50/20 opacity-80'
                  : stop.status === 'ARRIVED'
                  ? 'border-blue-400 ring-2 ring-blue-500/20'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex items-start gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      isCompleted ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : stop.sequence}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">{farmer?.fullName}</h4>
                    <p className="text-xs text-slate-400 font-mono">{farmer?.farmerCode}</p>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-800'
                      : stop.status === 'ARRIVED'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {stop.status}
                </span>
              </div>

              {/* Farmer Address & Tap-to-Call */}
              <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                <p className="flex items-center gap-1.5 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {stop.order?.deliveryAddress || 'Farm address'}
                </p>

                {phone && (
                  <div className="pt-1 flex items-center justify-between">
                    <a
                      href={`tel:${phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-medium border border-emerald-200 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      Call Farmer ({phone})
                    </a>
                    <span className="font-bold text-slate-900 text-sm">
                      ₹{Number(stop.order?.totalAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>

              {/* Order Items to Deliver */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Items on Order:</p>
                {stop.order?.items?.map((it: any) => (
                  <div key={it.id} className="flex justify-between items-center text-slate-700">
                    <span>{it.product?.name}</span>
                    <span className="font-bold">
                      {it.approvedQty} {it.product?.unit}
                    </span>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              {!isCompleted && (
                <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2">
                  {stop.status !== 'ARRIVED' ? (
                    <button
                      onClick={() => updateStatusMutation.mutate({ stopId: stop.id, status: 'ARRIVED' })}
                      className="col-span-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      Mark Arrived at Farm
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedStop(stop);
                          setIsExceptionModalOpen(true);
                        }}
                        className="py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Qty Exception
                      </button>

                      <button
                        onClick={() => {
                          setSelectedStop(stop);
                          setRecipientName(farmer?.fullName || '');
                          setRecipientPhone(phone);
                          setIsPodModalOpen(true);
                        }}
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 shadow-sm"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        Deliver & POD
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Proof of Delivery (POD) Modal */}
      {isPodModalOpen && selectedStop && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Proof of Delivery (POD)</h3>
                <p className="text-xs text-slate-500 font-medium">Customer: {selectedStop.order?.customer?.fullName}</p>
              </div>
              <button onClick={() => setIsPodModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePodSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Recipient Name *</label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Recipient Mobile *</label>
                <input
                  type="tel"
                  required
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Digital Sign-off / Farmer Acknowledgment *
                </label>
                <input
                  type="text"
                  placeholder="Farmer initials / signed note"
                  required
                  value={signatureText}
                  onChange={(e) => setSignatureText(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">
                  Payment Collected (₹{Number(selectedStop.order?.totalAmount || 0).toLocaleString('en-IN')})
                </span>
                <input
                  type="checkbox"
                  checked={paymentCollected}
                  onChange={(e) => setPaymentCollected(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPodModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completePodMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  {completePodMutation.isPending ? 'Submitting...' : 'Sign & Complete Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Quantity Exception Modal (PRD §18.2) */}
      {isExceptionModalOpen && selectedStop && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Raise Quantity Exception</h3>
                <p className="text-xs text-amber-700 font-medium">PRD §18.2 Field Modification Workflow</p>
              </div>
              <button onClick={() => setIsExceptionModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExceptionSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Select Item *</label>
                <select
                  value={selectedOrderItemId}
                  onChange={(e) => {
                    setSelectedOrderItemId(e.target.value);
                    const item = selectedStop.order?.items?.find((i: any) => i.id === e.target.value);
                    if (item) setRequestedQty(Number(item.approvedQty));
                  }}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  <option value="">-- Choose item --</option>
                  {selectedStop.order?.items?.map((it: any) => (
                    <option key={it.id} value={it.id}>
                      {it.product?.name} (Ordered: {it.approvedQty} {it.product?.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Actual Delivered / Requested Qty *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={requestedQty}
                  onChange={(e) => setRequestedQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Reason for Change *</label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Farmer requested only 8 bags due to budget constraint"
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsExceptionModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestExceptionMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
                >
                  {requestExceptionMutation.isPending ? 'Sending...' : 'Submit to Manager'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Field Lead Modal */}
      {isLeadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Capture Field Farmer Lead</h3>
                <p className="text-xs text-slate-500">Auto-routes to telecaller callback queue</p>
              </div>
              <button onClick={() => setIsLeadModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLeadSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Farmer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Murugan"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Village / Mandal</label>
                <input
                  type="text"
                  placeholder="e.g. Harur Village"
                  value={leadVillage}
                  onChange={(e) => setLeadVillage(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Field Observation</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Interested in Bio Jeevan PF for 4 acres of banana"
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLeadModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLeadMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  {createLeadMutation.isPending ? 'Saving...' : 'Save & Route to CRM'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
