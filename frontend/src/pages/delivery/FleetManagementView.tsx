import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Wrench,
  Navigation,
  Search,
  Filter,
  X,
  ShieldCheck,
  RefreshCw,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../../lib/api';
import { POLL_INTERVAL_LIVE } from '../../lib/polling';
import { PageHead } from '../../components/PageHead';
import { Alert, Badge, Button, Card, Input, Spinner, cx } from '../../components/ui';

interface VehicleItem {
  id: string;
  regNumber: string;
  model: string;
  capacityKg: number | string;
  status: 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE';
  driverId: string | null;
  driver?: {
    id: string;
    fullName: string;
    phone: string | null;
    employeeCode: string | null;
  } | null;
  createdAt: string;
}

export function FleetManagementView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE'>('ALL');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleItem | null>(null);

  // Form states for new vehicle
  const [regNumber, setRegNumber] = useState('');
  const [model, setModel] = useState('');
  const [capacityKg, setCapacityKg] = useState('2000');
  const [driverId, setDriverId] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch vehicles
  const { data: vehicles = [], isLoading, isRefetching, refetch } = useQuery<VehicleItem[]>({
    queryKey: ['fleet-vehicles'],
    queryFn: async () => {
      const res = await api.get('/dispatch/vehicles');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
    refetchInterval: POLL_INTERVAL_LIVE,
  });

  // Fetch eligible drivers (employees in delivery role)
  const { data: drivers = [] } = useQuery({
    queryKey: ['fleet-drivers'],
    queryFn: async () => {
      const res = await api.get('/employees');
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      return list.filter((emp: any) => emp.role?.code === 'DELIVERY' || emp.roleCode === 'DELIVERY' || emp.status === 'ACTIVE');
    },
  });

  // Create vehicle mutation
  const createMutation = useMutation({
    mutationFn: async (payload: { regNumber: string; model: string; capacityKg: number; driverId?: string }) => {
      const res = await api.post('/dispatch/vehicles', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      setIsRegisterOpen(false);
      setRegNumber('');
      setModel('');
      setCapacityKg('2000');
      setDriverId('');
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message || err?.message || 'Failed to register vehicle');
    },
  });

  // Update vehicle status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, driverId }: { id: string; status?: string; driverId?: string | null }) => {
      const res = await api.patch(`/dispatch/vehicles/${id}`, { status, driverId });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicles'] });
    },
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!regNumber.trim()) {
      setFormError('Please enter registration number');
      return;
    }
    createMutation.mutate({
      regNumber: regNumber.trim().toUpperCase(),
      model: model.trim() || 'Logistics Carrier',
      capacityKg: Number(capacityKg) || 2000,
      driverId: driverId || undefined,
    });
  };

  // Fleet stats
  const stats = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter((v) => v.status === 'AVAILABLE').length;
    const inTransit = vehicles.filter((v) => v.status === 'IN_TRANSIT').length;
    const maintenance = vehicles.filter((v) => v.status === 'MAINTENANCE').length;
    const totalCapacityKg = vehicles.reduce((sum, v) => sum + Number(v.capacityKg || 0), 0);
    return { total, available, inTransit, maintenance, totalCapacityKg };
  }, [vehicles]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
      const matchesSearch =
        search === '' ||
        v.regNumber.toLowerCase().includes(search.toLowerCase()) ||
        v.model.toLowerCase().includes(search.toLowerCase()) ||
        (v.driver?.fullName && v.driver.fullName.toLowerCase().includes(search.toLowerCase()));
      return matchesStatus && matchesSearch;
    });
  }, [vehicles, statusFilter, search]);

  return (
    <>
      <PageHead
        title="Fleet & Vehicles — GROTEC FarmerOS"
        description="Real-time vehicle and fleet logistics management for GROTEC delivery operations."
      />

      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Logistics &amp; Delivery Ops
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500 font-medium">Real-Time Fleet Status</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2.5">
              <Truck className="h-6 w-6 text-emerald-700" />
              <span>Vehicle &amp; Fleet Management</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor active transport carriers, payloads, maintenance schedules, and assigned route drivers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isRefetching}
              className="text-xs font-semibold gap-1.5"
            >
              <RefreshCw className={cx('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
              <span>Refresh</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setIsRegisterOpen(true)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs gap-1.5 shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Register Vehicle</span>
            </Button>
          </div>
        </div>

        {/* Fleet KPI Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Fleet</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Active carriers</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Available</p>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-900 mt-1">{stats.available}</p>
            <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Ready for dispatch</p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">On Route</p>
              <Navigation className="h-3.5 w-3.5 text-blue-600 animate-pulse" />
            </div>
            <p className="text-2xl font-black text-blue-900 mt-1">{stats.inTransit}</p>
            <p className="text-[10px] text-blue-700 font-medium mt-0.5">Active delivery trips</p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Maintenance</p>
              <Wrench className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="text-2xl font-black text-amber-900 mt-1">{stats.maintenance}</p>
            <p className="text-[10px] text-amber-700 font-medium mt-0.5">Service &amp; inspection</p>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Payload</p>
            <p className="text-2xl font-black text-slate-900 mt-1">
              {(stats.totalCapacityKg / 1000).toFixed(1)} <span className="text-xs font-semibold text-slate-500">Tons</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">{stats.totalCapacityKg.toLocaleString()} KG capacity</p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reg number, model, or driver..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600 transition"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['ALL', 'AVAILABLE', 'IN_TRANSIT', 'MAINTENANCE'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cx(
                  'px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer shrink-0',
                  statusFilter === st
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                )}
              >
                {st === 'ALL' ? 'All Vehicles' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicles Grid */}
        {isLoading ? (
          <div className="p-16 flex justify-center">
            <Spinner label="Loading fleet status..." />
          </div>
        ) : filteredVehicles.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
            <Truck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No vehicles match your criteria</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting the status filter or register a new fleet carrier.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVehicles.map((v) => {
              const isAvailable = v.status === 'AVAILABLE';
              const isInTransit = v.status === 'IN_TRANSIT';
              const isMaintenance = v.status === 'MAINTENANCE';

              return (
                <div
                  key={v.id}
                  className={cx(
                    'bg-white rounded-xl border p-4.5 shadow-xs transition-all flex flex-col justify-between space-y-4 hover:shadow-sm',
                    isAvailable
                      ? 'border-slate-200 hover:border-emerald-400'
                      : isInTransit
                      ? 'border-blue-200 bg-blue-50/20 hover:border-blue-400'
                      : 'border-amber-200 bg-amber-50/20 hover:border-amber-400'
                  )}
                >
                  <div>
                    {/* Top Row: Reg number & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-base font-black text-slate-900 tracking-tight">
                            {v.regNumber}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-600 mt-0.5">{v.model}</p>
                      </div>

                      <span
                        className={cx(
                          'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1',
                          isAvailable
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : isInTransit
                            ? 'bg-blue-100 text-blue-800 border border-blue-200 animate-pulse'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        )}
                      >
                        {isAvailable && <CheckCircle2 className="h-3 w-3" />}
                        {isInTransit && <Navigation className="h-3 w-3" />}
                        {isMaintenance && <Wrench className="h-3 w-3" />}
                        <span>{v.status.replace('_', ' ')}</span>
                      </span>
                    </div>

                    {/* Specs & Driver Info */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 font-medium">Payload Capacity:</span>
                        <span className="font-bold font-mono text-slate-800">{Number(v.capacityKg).toLocaleString()} KG</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400 font-medium">Assigned Driver:</span>
                        {v.driver ? (
                          <span className="font-bold text-slate-900 flex items-center gap-1">
                            <User className="h-3 w-3 text-emerald-700" />
                            <span>{v.driver.fullName}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </div>

                      {v.driver?.employeeCode && (
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Driver ID:</span>
                          <span className="font-mono font-semibold text-slate-600">{v.driver.employeeCode}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Set Status:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isAvailable || updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ id: v.id, status: 'AVAILABLE' })}
                        className={cx(
                          'px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer',
                          isAvailable
                            ? 'bg-emerald-700 text-white opacity-50 cursor-default'
                            : 'bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700'
                        )}
                        title="Mark Available"
                      >
                        Available
                      </button>
                      <button
                        type="button"
                        disabled={isInTransit || updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ id: v.id, status: 'IN_TRANSIT' })}
                        className={cx(
                          'px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer',
                          isInTransit
                            ? 'bg-blue-700 text-white opacity-50 cursor-default'
                            : 'bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700'
                        )}
                        title="Mark On Route"
                      >
                        On Route
                      </button>
                      <button
                        type="button"
                        disabled={isMaintenance || updateStatusMutation.isPending}
                        onClick={() => updateStatusMutation.mutate({ id: v.id, status: 'MAINTENANCE' })}
                        className={cx(
                          'px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer',
                          isMaintenance
                            ? 'bg-amber-700 text-white opacity-50 cursor-default'
                            : 'bg-slate-100 hover:bg-amber-600 hover:text-white text-slate-700'
                        )}
                        title="Mark In Maintenance"
                      >
                        Service
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Register Vehicle */}
        {isRegisterOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-emerald-700" />
                  <h3 className="text-base font-bold text-slate-900">Register Fleet Vehicle</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="p-5 space-y-4">
                {formError && (
                  <Alert tone="error">
                    <span>{formError}</span>
                  </Alert>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Registration Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. TN-38-BZ-4102"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600 uppercase"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Standard Indian commercial vehicle registration plate format</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Make &amp; Model *
                  </label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. Mahindra Bolero Maxi Truck / Tata 407 LPT"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Payload Capacity (KG) *
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="20000"
                    step="50"
                    required
                    value={capacityKg}
                    onChange={(e) => setCapacityKg(e.target.value)}
                    placeholder="2000"
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                    Assigned Driver (Optional)
                  </label>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">Select a logistics driver (optional)...</option>
                    {drivers.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.fullName} ({d.employeeCode || 'Driver'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRegisterOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={createMutation.isPending}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                  >
                    {createMutation.isPending ? 'Registering...' : 'Register Vehicle'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
