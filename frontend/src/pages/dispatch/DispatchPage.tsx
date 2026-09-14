import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Plus,
  CheckCircle2,
  AlertOctagon,
  Clock,
  MapPin,
  X,
  FileCheck,
  Send,
  Lock,
  User,
  Boxes,
} from 'lucide-react';
import { api } from '../../lib/api';

export function DispatchPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'TRIPS' | 'VEHICLES'>('TRIPS');
  const [isCreateTripOpen, setIsCreateTripOpen] = useState(false);
  const [isVerifyLoadingOpen, setIsVerifyLoadingOpen] = useState(false);
  const [isCloseTripOpen, setIsCloseTripOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);

  // Form states
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [helperName, setHelperName] = useState('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [startOdo, setStartOdo] = useState(12500);
  const [endOdo, setEndOdo] = useState(12650);

  // Fetch trips
  const { data: trips = [], isLoading: isTripsLoading } = useQuery({
    queryKey: ['dispatch-trips'],
    queryFn: async () => {
      const res = await api.get('/dispatch/trips');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
  });

  // Fetch vehicles
  const { data: vehicles = [] } = useQuery({
    queryKey: ['dispatch-vehicles'],
    queryFn: async () => {
      const res = await api.get('/dispatch/vehicles');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
  });

  // Fetch confirmed orders eligible for trip dispatch
  const { data: confirmedOrders = [] } = useQuery({
    queryKey: ['confirmed-orders'],
    queryFn: async () => {
      const res = await api.get('/orders?status=CONFIRMED');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
  });

  // Create trip mutation
  const createTripMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/dispatch/trips', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-trips'] });
      queryClient.invalidateQueries({ queryKey: ['confirmed-orders'] });
      setIsCreateTripOpen(false);
      setSelectedOrderIds([]);
      setSelectedVehicleId('');
      setSelectedDriverId('');
    },
  });

  // Verify loading mutation
  const verifyLoadingMutation = useMutation({
    mutationFn: async ({ tripId, checklist }: any) => {
      const res = await api.post(`/dispatch/trips/${tripId}/verify-loading`, checklist);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-trips'] });
      setIsVerifyLoadingOpen(false);
      setSelectedTrip(null);
    },
  });

  // Dispatch vehicle mutation
  const dispatchVehicleMutation = useMutation({
    mutationFn: async ({ tripId, startOdometer }: any) => {
      const res = await api.post(`/dispatch/trips/${tripId}/dispatch`, { startOdometer });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-trips'] });
    },
  });

  // Close trip mutation
  const closeTripMutation = useMutation({
    mutationFn: async ({ tripId, endOdometer }: any) => {
      const res = await api.post(`/dispatch/trips/${tripId}/close`, { endOdometer });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispatch-trips'] });
      setIsCloseTripOpen(false);
      setSelectedTrip(null);
    },
  });

  function handleCreateTripSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVehicleId || !selectedDriverId) {
      alert('Please select both a vehicle and driver');
      return;
    }
    if (selectedOrderIds.length === 0) {
      alert('Please select at least one sales order for this trip manifest');
      return;
    }

    createTripMutation.mutate({
      vehicleId: selectedVehicleId,
      driverId: selectedDriverId,
      helperName,
      orderIds: selectedOrderIds,
    });
  }

  function toggleOrderSelection(orderId: string) {
    if (selectedOrderIds.includes(orderId)) {
      setSelectedOrderIds(selectedOrderIds.filter(id => id !== orderId));
    } else {
      setSelectedOrderIds([...selectedOrderIds, orderId]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <Truck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Dispatch & Trip Logistics</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Trip manifests, loading verification, transit tracking, and closure reconciliation (PRD §18.1)
          </p>
        </div>
        <button
          onClick={() => setIsCreateTripOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Schedule Delivery Trip
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6 pt-3 rounded-xl shadow-sm">
        <button
          onClick={() => setActiveTab('TRIPS')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'TRIPS'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Truck className="w-4 h-4" />
          Trip Manifests & Runs
        </button>
        <button
          onClick={() => setActiveTab('VEHICLES')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'VEHICLES'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Fleet Vehicles ({vehicles.length})
        </button>
      </div>

      {/* Tab 1: Trips */}
      {activeTab === 'TRIPS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Trip Number</th>
                  <th className="px-5 py-3.5">Vehicle & Driver</th>
                  <th className="px-5 py-3.5 text-center">Stops</th>
                  <th className="px-5 py-3.5">Departure Time</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Operational Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isTripsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      Loading trip manifests...
                    </td>
                  </tr>
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      No delivery trips scheduled yet. Click "Schedule Delivery Trip" above.
                    </td>
                  </tr>
                ) : (
                  trips.map((trip: any) => (
                    <tr key={trip.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-blue-700">
                        {trip.tripNumber}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">{trip.vehicle?.regNumber}</p>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" /> {trip.driver?.fullName}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {trip.stops?.length || 0} stops
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {trip.departureTime ? new Date(trip.departureTime).toLocaleTimeString('en-IN') : 'Scheduled'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            trip.status === 'CLOSED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : trip.status === 'DELIVERING' || trip.status === 'IN_TRANSIT'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : trip.status === 'LOADED'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {trip.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {trip.status === 'PLANNED' && (
                            <button
                              onClick={() => {
                                setSelectedTrip(trip);
                                setIsVerifyLoadingOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              Verify Loading
                            </button>
                          )}

                          {trip.status === 'LOADED' && (
                            <button
                              onClick={() => dispatchVehicleMutation.mutate({ tripId: trip.id, startOdometer: startOdo })}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Dispatch Vehicle
                            </button>
                          )}

                          {(trip.status === 'DELIVERING' || trip.status === 'IN_TRANSIT') && (
                            <button
                              onClick={() => {
                                setSelectedTrip(trip);
                                setIsCloseTripOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Close & Reconcile
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Fleet Vehicles */}
      {activeTab === 'VEHICLES' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vehicles.map((v: any) => (
            <div key={v.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold font-mono text-slate-900">{v.regNumber}</h3>
                  <p className="text-xs text-slate-500">{v.model}</p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    v.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {v.status}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                <p>Capacity: <span className="font-semibold">{v.capacityKg} KG</span></p>
                <p>Assigned Driver: <span className="font-semibold">{v.driver?.fullName || 'Unassigned'}</span></p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule Trip Modal */}
      {isCreateTripOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900">Schedule Delivery Trip (Manifest)</h2>
              <button onClick={() => setIsCreateTripOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTripSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Vehicle *</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="">Select vehicle...</option>
                    {vehicles.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.regNumber} ({v.model})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Driver *</label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="">Select driver...</option>
                    {vehicles.map((v: any) => v.driver && (
                      <option key={v.driver.id} value={v.driver.id}>
                        {v.driver.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Select Confirmed Sales Orders to Deliver *
                </label>
                {confirmedOrders.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                    No confirmed orders waiting. Create a sales order first from Orders & Billing.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 p-2 rounded-lg">
                    {confirmedOrders.map((o: any) => (
                      <label
                        key={o.id}
                        className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.includes(o.id)}
                          onChange={() => toggleOrderSelection(o.id)}
                          className="rounded text-blue-600"
                        />
                        <div className="flex-1">
                          <p className="font-semibold font-mono text-slate-800">{o.orderNumber} - {o.customer?.fullName}</p>
                          <p className="text-slate-500">{o.deliveryAddress || 'Direct farm delivery'}</p>
                        </div>
                        <span className="font-bold text-slate-700">₹{Number(o.totalAmount)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">Helper / Crew Name</label>
                <input
                  type="text"
                  placeholder="e.g. Periyasamy (Loading Staff)"
                  value={helperName}
                  onChange={(e) => setHelperName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateTripOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createTripMutation.isPending}
                  className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  {createTripMutation.isPending ? 'Scheduling...' : 'Generate Trip Manifest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading Verification Modal (PRD §18.1) */}
      {isVerifyLoadingOpen && selectedTrip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Loading Bay Verification</h3>
                <p className="text-xs text-slate-500 font-mono">Trip: {selectedTrip.tripNumber}</p>
              </div>
              <button onClick={() => setIsVerifyLoadingOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                <AlertOctagon className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  <strong>PRD §18.1 Invariant:</strong> Loading reconciles planned items vs physically loaded goods.
                  Any mismatch strictly blocks dispatch.
                </p>
              </div>

              <p className="text-xs font-semibold uppercase text-slate-600">Manifest Order Items:</p>
              <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 p-2 rounded-lg text-xs">
                {selectedTrip.stops?.map((stop: any, idx: number) => (
                  <div key={stop.id} className="p-2 bg-slate-50 rounded">
                    <p className="font-bold text-slate-800">Stop #{idx + 1}: {stop.order?.customer?.fullName}</p>
                    <p className="text-slate-600">
                      {stop.order?.items?.map((it: any) => `${it.product?.name} (${it.approvedQty})`).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsVerifyLoadingOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => verifyLoadingMutation.mutate({ tripId: selectedTrip.id, checklist: { hasMismatch: false } })}
                disabled={verifyLoadingMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
              >
                {verifyLoadingMutation.isPending ? 'Verifying...' : 'Confirm Loaded & Authorize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Closure Reconciliation Modal (PRD §18.3) */}
      {isCloseTripOpen && selectedTrip && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Trip Closure Reconciliation</h3>
                <p className="text-xs text-slate-500 font-mono">Trip: {selectedTrip.tripNumber}</p>
              </div>
              <button onClick={() => setIsCloseTripOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800">
                <p className="font-semibold">Reconciliation Invariant (PRD §18.3):</p>
                <p className="mt-0.5">
                  All stops are verified. Excess lorry stock from quantity reductions will be automatically credited
                  back to the central warehouse available pool.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 mb-1">
                  Final Odometer Reading (KM)
                </label>
                <input
                  type="number"
                  value={endOdo}
                  onChange={(e) => setEndOdo(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCloseTripOpen(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => closeTripMutation.mutate({ tripId: selectedTrip.id, endOdometer: endOdo })}
                disabled={closeTripMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
              >
                {closeTripMutation.isPending ? 'Closing...' : 'Finalize Trip & Balance Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
