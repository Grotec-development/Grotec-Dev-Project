import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  Filter,
  MapPin,
  Phone,
  PhoneCall,
  Search,
  Truck,
  UserCheck,
  X,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { formatDate, formatE164 } from '../../lib/format';
import { Button, Card, Field, Input, Select, Spinner } from '../../components/ui';

interface RouteDistrict {
  id: string;
  district: string;
  towns: string[];
}

interface ConsolidatedOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  totalAmount: number | string;
  requestedDeliveryDate?: string | null;
  confirmedDeliveryDate?: string | null;
  deliveryConfirmationStatus?: string | null;
  confirmationNotes?: string | null;
  deliveryAddress?: string | null;
  customer: {
    id: string;
    farmerCode?: string | null;
    fullName: string;
    phones?: Array<{ phoneE164: string; isPrimary: boolean }>;
    locations?: Array<{ district?: string | null; taluk?: string | null; village?: string | null }>;
  };
  items: Array<{
    id: string;
    product: { id: string; name: string; unit: string };
    approvedQty: number | string;
    originalQty: number | string;
  }>;
  createdBy?: { id: string; fullName: string } | null;
}

interface RouteDashboardItem {
  id: string;
  code: string;
  name: string;
  districts: RouteDistrict[];
  pendingCount: number;
  confirmedCount: number;
  awaitingConfirmationCount: number;
  dispatchedCount: number;
  deliveredCount: number;
  deferredCount: number;
  totalRequestedQty: number;
  confirmedDeliveryQty: number;
  orders: ConsolidatedOrder[];
}

export function RegionalRoutesView() {
  const queryClient = useQueryClient();
  const [selectedRouteCode, setSelectedRouteCode] = useState<string>('COIMBATORE');
  const [searchOrder, setSearchOrder] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Customer Confirmation Modal state
  const [confirmOrderModal, setConfirmOrderModal] = useState<ConsolidatedOrder | null>(null);
  const [confirmOutcome, setConfirmOutcome] = useState<string>('CONFIRMED_FOR_DELIVERY');
  const [plannedDeliveryDate, setPlannedDeliveryDate] = useState<string>('');
  const [confirmNotes, setConfirmNotes] = useState<string>('');
  const [confirming, setConfirming] = useState<boolean>(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccessToast, setConfirmSuccessToast] = useState<string | null>(null);

  // Fetch 4 Regional Routes Dashboard (Phase 10.1 & 10.2)
  const dashboardQuery = useQuery({
    queryKey: ['route-dashboard'],
    queryFn: async () => {
      const res = await api.get<RouteDashboardItem[]>('/routes/dashboard');
      return res.data;
    },
    refetchInterval: 12_000,
  });

  const routes = dashboardQuery.data || [];

  // Active selected route
  const activeRoute = useMemo(() => {
    if (routes.length === 0) return null;
    return routes.find((r) => r.code === selectedRouteCode) || routes[0];
  }, [routes, selectedRouteCode]);

  // Orders consolidated under the selected route
  const consolidatedOrders = useMemo(() => {
    if (!activeRoute) return [];
    let list = activeRoute.orders || [];

    if (searchOrder.trim()) {
      const q = searchOrder.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          o.customer.fullName.toLowerCase().includes(q) ||
          o.customer.farmerCode?.toLowerCase().includes(q) ||
          o.customer.locations?.[0]?.village?.toLowerCase().includes(q) ||
          o.customer.locations?.[0]?.taluk?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'ALL') {
      list = list.filter((o) => {
        if (statusFilter === 'CONFIRMED') return o.deliveryConfirmationStatus === 'CONFIRMED_FOR_DELIVERY';
        if (statusFilter === 'PENDING') return !o.deliveryConfirmationStatus || o.deliveryConfirmationStatus === 'PENDING';
        if (statusFilter === 'RESCHEDULED') return o.deliveryConfirmationStatus === 'RESCHEDULED';
        return true;
      });
    }

    return list;
  }, [activeRoute, searchOrder, statusFilter]);

  // Open confirmation dialog
  const handleOpenConfirm = (order: ConsolidatedOrder) => {
    setConfirmOrderModal(order);
    setConfirmOutcome(order.deliveryConfirmationStatus || 'CONFIRMED_FOR_DELIVERY');
    const defaultDate = order.requestedDeliveryDate
      ? order.requestedDeliveryDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setPlannedDeliveryDate(defaultDate);
    setConfirmNotes(order.confirmationNotes || '');
    setConfirmError(null);
  };

  // Submit delivery confirmation
  const handleSubmitConfirmation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmOrderModal) return;
    setConfirming(true);
    setConfirmError(null);

    try {
      await api.post(`/routes/orders/${confirmOrderModal.id}/confirm-delivery`, {
        outcome: confirmOutcome,
        plannedDeliveryDate: plannedDeliveryDate || undefined,
        notes: confirmNotes.trim() || undefined,
      });

      setConfirmSuccessToast(`Order ${confirmOrderModal.orderNumber} confirmed successfully!`);
      void queryClient.invalidateQueries({ queryKey: ['route-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      setConfirmOrderModal(null);
      setTimeout(() => setConfirmSuccessToast(null), 5000);
    } catch (err) {
      setConfirmError(errorMessage(err) || 'Failed to record customer confirmation');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Alert */}
      {confirmSuccessToast && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            <span className="font-semibold">{confirmSuccessToast}</span>
          </div>
          <button onClick={() => setConfirmSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4 Regional Route Selector Cards (Phase 10.1 & 10.2) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {routes.map((route) => {
          const isSelected = (activeRoute?.code || selectedRouteCode) === route.code;
          return (
            <button
              key={route.id}
              type="button"
              onClick={() => setSelectedRouteCode(route.code)}
              className={`p-4 rounded-xl border text-left transition shadow-xs space-y-2.5 ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sm text-slate-900">{route.name}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isSelected ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {route.orders.length} Orders
                </span>
              </div>

              {/* Coverage districts */}
              <div className="flex flex-wrap gap-1">
                {route.districts.slice(0, 4).map((d) => (
                  <span
                    key={d.id}
                    className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium border border-slate-200/60"
                  >
                    {d.district}
                  </span>
                ))}
                {route.districts.length > 4 && (
                  <span className="text-[10px] text-slate-400 font-semibold self-center">
                    +{route.districts.length - 4} more
                  </span>
                )}
              </div>

              {/* Metrics */}
              <div className="pt-2 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Confirmed Qty</span>
                  <span className="font-mono font-extrabold text-slate-900">
                    {route.confirmedDeliveryQty} Units
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Pending Confirm</span>
                  <span className="font-mono font-bold text-amber-700">
                    {route.awaitingConfirmationCount} Orders
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Route Consolidated Orders Workspace (Phase 10.3) */}
      {activeRoute ? (
        <Card className="bg-white shadow-xs p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-emerald-700" />
                <h2 className="text-base font-extrabold text-slate-900">
                  {activeRoute.name} — Order Consolidation &amp; Delivery Planning
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidated sales orders from all agents scheduled for this regional transport corridor.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void dashboardQuery.refetch()}
                className="text-xs gap-1"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Refresh Route
              </Button>
            </div>
          </div>

          {/* Table Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={searchOrder}
                onChange={(e) => setSearchOrder(e.target.value)}
                placeholder="Filter by order #, farmer name, taluk, village..."
                className="pl-8 text-xs py-1.5"
              />
            </div>

            <div>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs"
              >
                <option value="ALL">All Delivery Statuses</option>
                <option value="CONFIRMED">Confirmed for Delivery</option>
                <option value="PENDING">Pending Customer Confirmation</option>
                <option value="RESCHEDULED">Rescheduled / Deferred</option>
              </Select>
            </div>

            <div className="flex items-center text-xs text-slate-500 font-medium">
              Showing {consolidatedOrders.length} orders for {activeRoute.name}
            </div>
          </div>

          {/* Consolidated Orders Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Order Number</th>
                  <th className="py-2.5 px-3">Farmer &amp; Contact</th>
                  <th className="py-2.5 px-3">Delivery Location</th>
                  <th className="py-2.5 px-3">Bio-Products Ordered</th>
                  <th className="py-2.5 px-3">Requested Date</th>
                  <th className="py-2.5 px-3">Customer Confirmation</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {consolidatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No sales orders scheduled for this route corridor.
                    </td>
                  </tr>
                ) : (
                  consolidatedOrders.map((order) => {
                    const phone = order.customer.phones?.[0]?.phoneE164 || '—';
                    const loc = order.customer.locations?.[0];
                    const isConfirmed = order.deliveryConfirmationStatus === 'CONFIRMED_FOR_DELIVERY';
                    const isPending = !order.deliveryConfirmationStatus || order.deliveryConfirmationStatus === 'PENDING';

                    return (
                      <tr key={order.id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold text-slate-900 block">{order.orderNumber}</span>
                          <span className="text-[10px] text-slate-400">
                            {formatDate(order.orderDate)}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{order.customer.fullName}</span>
                          <span className="text-[11px] text-slate-500 font-mono block">
                            {order.customer.farmerCode} • {phone}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-medium text-slate-800 block">
                            {loc?.village ? `${loc.village}, ` : ''}{loc?.taluk || 'Taluk'}
                          </span>
                          <span className="text-[10px] text-slate-500 block">{loc?.district || 'Tamil Nadu'}</span>
                        </td>
                        <td className="py-3 px-3 max-w-xs">
                          {order.items.map((it) => (
                            <span key={it.id} className="block text-[11px] truncate">
                              {it.product.name} ({Number(it.approvedQty || it.originalQty)} {it.product.unit})
                            </span>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-[11px] text-slate-600 font-mono">
                          {order.requestedDeliveryDate ? formatDate(order.requestedDeliveryDate) : 'Flexible'}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              isConfirmed
                                ? 'bg-emerald-100 text-emerald-800'
                                : isPending
                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {order.deliveryConfirmationStatus ? order.deliveryConfirmationStatus.replace(/_/g, ' ') : 'Pending Confirmation'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Button
                            size="xs"
                            onClick={() => handleOpenConfirm(order)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1 text-[11px]"
                          >
                            <PhoneCall className="h-3 w-3" /> Confirm Delivery
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Customer Delivery Confirmation Dialog (Phase 10.4) */}
      {confirmOrderModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <Card className="max-h-[92vh] w-full max-w-lg overflow-y-auto shadow-2xl p-6 bg-white space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-700" />
                  <h2 className="text-base font-extrabold text-slate-900">Customer Delivery Confirmation</h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirm recipient readiness before adding order to vehicle load manifest.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOrderModal(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Farmer Contact Info */}
            <div className="rounded-lg bg-emerald-50/70 p-3.5 border border-emerald-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Recipient Farmer</span>
                  <span className="font-extrabold text-slate-900 text-sm">{confirmOrderModal.customer.fullName}</span>
                  <p className="text-slate-600 font-mono">{confirmOrderModal.customer.farmerCode}</p>
                </div>
                <a
                  href={`tel:${confirmOrderModal.customer.phones?.[0]?.phoneE164}`}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 font-bold text-xs shadow-xs"
                >
                  <Phone className="h-3.5 w-3.5" /> Call Customer
                </a>
              </div>
              <div className="pt-2 border-t border-emerald-200/60 text-emerald-950">
                <span className="font-medium">Delivery Address: </span>
                <span>
                  {confirmOrderModal.deliveryAddress ||
                    confirmOrderModal.customer.locations?.[0]?.village ||
                    'Farm address'}
                </span>
              </div>
            </div>

            {/* Confirmation Form */}
            <form onSubmit={handleSubmitConfirmation} className="space-y-3.5 text-xs">
              {confirmError && (
                <div className="rounded bg-red-50 p-2.5 text-xs text-red-800">{confirmError}</div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Confirmation Result
                </label>
                <Select
                  value={confirmOutcome}
                  onChange={(e) => setConfirmOutcome(e.target.value)}
                  className="w-full text-xs font-semibold"
                >
                  <option value="CONFIRMED_FOR_DELIVERY">Confirmed for Planned Delivery (Ready)</option>
                  <option value="RESCHEDULED">Customer Requested Rescheduling / Postponement</option>
                  <option value="CUSTOMER_UNAVAILABLE">Customer Unavailable / Phone Unreachable</option>
                  <option value="CANCELLED">Customer Cancelled Purchase Order</option>
                  <option value="REQUIRES_FURTHER_CONTACT">Requires Further Field Contact</option>
                </Select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Planned Delivery Date
                </label>
                <Input
                  type="date"
                  value={plannedDeliveryDate}
                  onChange={(e) => setPlannedDeliveryDate(e.target.value)}
                  className="text-xs"
                  required={confirmOutcome === 'CONFIRMED_FOR_DELIVERY'}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Delivery Officer Notes / Instructions
                </label>
                <textarea
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  rows={3}
                  placeholder="Farmer directions, landmark, specific delivery time window requested..."
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <Button type="button" variant="ghost" onClick={() => setConfirmOrderModal(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={confirming}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-5 gap-1.5"
                >
                  {confirming ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-4 w-4" />}
                  Save Confirmation Status
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
export default RegionalRoutesView;
