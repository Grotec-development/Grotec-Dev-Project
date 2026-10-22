import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Truck,
  IndianRupee,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  Navigation,
  Eye,
  Check,
  X,
  Filter,
  Search,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatNumber } from '../../lib/format';
import { POLL_INTERVAL_LISTS } from '../../lib/polling';
import { PaymentSlipModal, PaymentSlipData } from '../../components/delivery/PaymentSlipModal';

export function ManagerDeliveryConsole() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'TRIPS' | 'RECONCILIATION'>('PAYMENTS');
  const [selectedSlip, setSelectedSlip] = useState<PaymentSlipData | null>(null);
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [rejectionModalPayment, setRejectionModalPayment] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [toastNotification, setToastNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 1. Fetch pending payments awaiting manager review
  const { data: pendingPayments = [], isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['pending-delivery-payments'],
    queryFn: async () => {
      const res = await api.get('/delivery/payments/pending');
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: POLL_INTERVAL_LISTS,
  });

  // 2. Fetch business-wide trips
  const { data: trips = [], isLoading: isTripsLoading } = useQuery({
    queryKey: ['manager-all-trips'],
    queryFn: async () => {
      const res = await api.get('/dispatch/trips');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
    refetchInterval: POLL_INTERVAL_LISTS,
  });

  // Review Payment Mutation (Approve / Reject)
  const reviewPaymentMutation = useMutation({
    mutationFn: async ({ paymentId, action, reason }: { paymentId: string; action: 'APPROVE' | 'REJECT'; reason?: string }) => {
      const res = await api.post(`/delivery/payments/${paymentId}/review`, { action, reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-delivery-payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setRejectionModalPayment(null);
      setRejectionReason('');
      setToastNotification({
        type: 'success',
        message: 'Payment collection decision successfully recorded and posted to the ledger.',
      });
      setTimeout(() => setToastNotification(null), 5000);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to review payment';
      setToastNotification({ type: 'error', message: msg });
      setTimeout(() => setToastNotification(null), 7000);
    },
  });

  const handleApprove = (payment: any) => {
    if (confirm(`Approve payment of ₹${formatNumber(payment.amount)} for Order ${payment.order?.orderNumber || payment.paymentNumber}?`)) {
      reviewPaymentMutation.mutate({ paymentId: payment.id, action: 'APPROVE' });
    }
  };

  const handleOpenReject = (payment: any) => {
    setRejectionModalPayment(payment);
    setRejectionReason('');
  };

  const handleConfirmReject = () => {
    if (!rejectionReason.trim()) {
      alert('Please specify a rejection reason for the audit trail.');
      return;
    }
    reviewPaymentMutation.mutate({
      paymentId: rejectionModalPayment.id,
      action: 'REJECT',
      reason: rejectionReason,
    });
  };

  const handleViewSlip = (payment: any) => {
    const order = payment.order;
    const slipData: PaymentSlipData = {
      slipNumber: payment.paymentNumber,
      orderNumber: order?.orderNumber || '—',
      invoiceNumber: order?.invoice?.invoiceNumber,
      customerName: order?.customer?.fullName || 'Customer',
      farmerCode: order?.customer?.farmerCode,
      orderTotal: Number(order?.totalAmount || 0),
      previousPaid: Number(order?.advancePaidAmount || 0),
      amountCollected: Number(payment.amount),
      remainingBalance: Math.max(0, Number(order?.totalAmount || 0) - Number(order?.advancePaidAmount || 0)),
      paymentMethod: payment.paymentMethod,
      transactionReference: payment.referenceNumber,
      collectedAt: payment.createdAt,
      agentName: payment.createdBy?.fullName || 'Delivery Specialist',
      agentCode: payment.createdBy?.employeeCode,
      status: payment.status,
      isApproved: payment.status === 'VERIFIED',
    };
    setSelectedSlip(slipData);
    setIsSlipOpen(true);
  };

  const totalPendingAmount = pendingPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Operations Command
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium">Logistics &amp; Finance Oversight</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            Manager Delivery &amp; Collections Command
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit field payment collections, authorize dispatch trips, and verify proof-of-delivery evidence.
          </p>
        </div>

        {/* Quick Nav Links */}
        <div className="flex items-center gap-2">
          <Link
            to="/delivery/fleet"
            className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-xs transition flex items-center gap-1.5"
          >
            <Truck className="h-4 w-4 text-slate-600" />
            <span>Fleet Management</span>
          </Link>
          <Link
            to="/dispatch"
            className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <Navigation className="h-4 w-4" />
            <span>Dispatch Corridor Planning</span>
          </Link>
        </div>
      </div>

      {toastNotification && (
        <div
          className={`rounded-xl border p-3.5 text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
            toastNotification.type === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastNotification.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-700 shrink-0" />
            )}
            <span>{toastNotification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastNotification(null)}
            className="text-slate-400 hover:text-slate-600 text-xs px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pending Payment Approvals
            </p>
            <IndianRupee className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              ₹{formatNumber(totalPendingAmount)}
            </span>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
              {pendingPayments.length} Submissions
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Field collections submitted by delivery drivers awaiting review
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Active Trips In Field
            </p>
            <Truck className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {trips.filter((t: any) => t.status === 'IN_TRANSIT' || t.status === 'DELIVERING').length}
            </span>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
              {trips.length} Total Trips
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Regional corridors: Coimbatore, Pollachi, Tiruppur, Erode
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Trip Stops Reconciled
            </p>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900">
              {trips.filter((t: any) => t.status === 'COMPLETED').length}
            </span>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Reconciled
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Full closure of proof-of-delivery &amp; payment settlement
          </p>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('PAYMENTS')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'PAYMENTS'
              ? 'border-emerald-600 text-emerald-800 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <IndianRupee className="h-3.5 w-3.5" />
          <span>Pending Payment Approvals ({pendingPayments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TRIPS')}
          className={`pb-3 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'TRIPS'
              ? 'border-emerald-600 text-emerald-800 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          <span>Trip Oversight &amp; Manifest ({trips.length})</span>
        </button>
      </div>

      {/* Tab 1: Pending Payment Approvals */}
      {activeTab === 'PAYMENTS' && (
        <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden space-y-4 p-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Awaiting Manager Review &amp; Ledger Posting
              </h2>
              <p className="text-xs text-slate-500">
                Delivery agents cannot approve their own collections. Review amount, method, and transaction evidence.
              </p>
            </div>
          </div>

          {pendingPayments.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto opacity-70" />
              <p className="text-xs font-bold text-slate-700">All payment collections are fully reconciled.</p>
              <p className="text-xs text-slate-400">No pending field collections awaiting review.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Slip / Payment ID</th>
                    <th className="py-3 px-4">Order &amp; Customer</th>
                    <th className="py-3 px-4">Collected By</th>
                    <th className="py-3 px-4">Method &amp; Ref</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Slip Preview</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingPayments.map((p: any) => {
                    const order = p.order;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 block">{p.paymentNumber}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(p.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-900 block">{order?.customer?.fullName}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="font-mono text-emerald-700">{order?.orderNumber}</span>
                            <span>• Total: ₹{formatNumber(order?.totalAmount)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800 block">{p.createdBy?.fullName || 'Agent'}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {p.createdBy?.employeeCode || 'Field Driver'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                            {p.paymentMethod}
                          </span>
                          {p.referenceNumber && (
                            <span className="block text-[10px] text-slate-400 font-mono truncate max-w-[120px]">
                              {p.referenceNumber}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 text-sm">
                          ₹{formatNumber(p.amount)}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleViewSlip(p)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] inline-flex items-center gap-1 transition"
                          >
                            <Eye className="h-3 w-3" />
                            <span>Slip</span>
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleApprove(p)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] flex items-center gap-1 shadow-xs transition"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReject(p)}
                              className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center gap-1 transition"
                            >
                              <X className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Trip Oversight */}
      {activeTab === 'TRIPS' && (
        <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Regional Corridors &amp; Trip Manifests
              </h2>
              <p className="text-xs text-slate-500">
                Track departure, stops completed, load distribution, and driver assignments.
              </p>
            </div>
            <Link
              to="/dispatch"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              Open Dispatch Queue &rarr;
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Trip Number</th>
                  <th className="py-3 px-4">Vehicle &amp; Capacity</th>
                  <th className="py-3 px-4">Driver</th>
                  <th className="py-3 px-4">Stops</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {t.tripNumber}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 block">{t.vehicle?.regNumber}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {t.vehicle?.capacityKg} kg payload
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">
                      {t.driver?.fullName || 'Assigned Driver'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-slate-900">
                        {t.stops?.length || 0} drops
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'IN_TRANSIT' || t.status === 'DELIVERING'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-slate-500 font-mono text-[11px]">
                      {new Date(t.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slip Modal Preview */}
      {selectedSlip && (
        <PaymentSlipModal
          isOpen={isSlipOpen}
          onClose={() => setIsSlipOpen(false)}
          slip={selectedSlip}
        />
      )}

      {/* Rejection Reason Modal */}
      {rejectionModalPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Reject Payment Submission: {rejectionModalPayment.paymentNumber}
            </h3>
            <p className="text-xs text-slate-500">
              Specify reason for rejection (e.g. invalid UPI screenshot, shortfall, incorrect cash count).
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason for audit log..."
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectionModalPayment(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs transition"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
