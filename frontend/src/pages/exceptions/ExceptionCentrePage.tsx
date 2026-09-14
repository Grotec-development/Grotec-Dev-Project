import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  FileText,
  Boxes,
  User,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../lib/api';

export function ExceptionCentrePage() {
  const queryClient = useQueryClient();
  const [selectedException, setSelectedException] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');

  // Fetch pending exceptions
  const { data: exceptions = [], isLoading } = useQuery({
    queryKey: ['pending-exceptions'],
    queryFn: async () => {
      const res = await api.get('/exceptions/pending');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
  });

  // Review exception mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, notes }: any) => {
      const res = await api.post(`/exceptions/${id}/review`, {
        decision,
        reviewNotes: notes,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stocks'] });
      setSelectedException(null);
      setReviewNotes('');
    },
  });

  function handleApprove(ex: any) {
    if (confirm(`Approve quantity adjustment for ${ex.orderItem?.product?.name} from ${ex.originalQty} to ${ex.requestedQty}? This will automatically revise the invoice and balance vehicle stock.`)) {
      reviewMutation.mutate({ id: ex.id, decision: 'APPROVE', notes: 'Approved by manager via Exception Centre' });
    }
  }

  function handleReject(ex: any) {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      reviewMutation.mutate({ id: ex.id, decision: 'REJECT', notes: reason });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-50 text-rose-700 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Operations Exception Centre</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review and approve in-flight delivery adjustments, vehicle stock reconciliations, and invoice revisions.
          </p>
        </div>

        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ['pending-exceptions'] })}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Exceptions
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Quantity Approvals</p>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-md">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-2">{exceptions.length}</p>
          <p className="text-xs text-slate-400 mt-1">Waiting for manager decision</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Auto-Revision Rule</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-sm font-semibold text-emerald-800 mt-2">Zero Silent Quantity Edits</p>
          <p className="text-xs text-slate-400 mt-1">Invoice and stock update synchronously</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Stock Reallocation Pool</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-md">
              <Boxes className="w-4 h-4" />
            </span>
          </div>
          <p className="text-sm font-semibold text-blue-800 mt-2">Active Lorry Excess Tracking</p>
          <p className="text-xs text-slate-400 mt-1">Undelivered units return to lorry stock</p>
        </div>
      </div>

      {/* Exceptions List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Pending Quantity Change Requests ({exceptions.length})
          </h2>
          <span className="text-xs text-slate-500">Requires Founder / Manager Authorization</span>
        </div>

        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="p-8 text-center text-slate-500">Loading pending exceptions...</div>
          ) : exceptions.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-semibold text-slate-800">All Operations Clear</p>
              <p className="text-xs text-slate-400">
                No outstanding quantity change exceptions or shortages pending approval.
              </p>
            </div>
          ) : (
            exceptions.map((ex: any) => {
              const delta = Number(ex.requestedQty) - Number(ex.originalQty);
              const isReduction = delta < 0;

              return (
                <div key={ex.id} className="p-6 hover:bg-slate-50/70 transition-colors space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                          {ex.trip?.tripNumber}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-semibold text-slate-700">
                          Customer: {ex.stop?.order?.customer?.fullName} ({ex.stop?.order?.customer?.farmerCode})
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {ex.orderItem?.product?.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReject(ex)}
                        disabled={reviewMutation.isPending}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>

                      <button
                        onClick={() => handleApprove(ex)}
                        disabled={reviewMutation.isPending}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve & Revise Invoice
                      </button>
                    </div>
                  </div>

                  {/* Quantity Comparison Matrix */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">Original Ordered:</span>
                      <span className="font-bold text-slate-800 text-sm">{ex.originalQty} {ex.orderItem?.product?.unit}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">Requested Delivery:</span>
                      <span className="font-bold text-blue-700 text-sm">{ex.requestedQty} {ex.orderItem?.product?.unit}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block uppercase tracking-wider text-[10px] font-semibold">Stock Impact:</span>
                      <span className={`font-bold text-sm ${isReduction ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {isReduction
                          ? `+${Math.abs(delta)} returns to vehicle pool`
                          : `-${Math.abs(delta)} from excess pool`}
                      </span>
                    </div>
                  </div>

                  {/* Reason & Driver context */}
                  <div className="flex flex-col sm:flex-row justify-between text-xs text-slate-600 gap-2 pt-1">
                    <p className="flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-semibold text-slate-700">Reason:</span> {ex.reason}
                    </p>
                    <p className="text-slate-400">
                      Vehicle: {ex.trip?.vehicle?.regNumber} · Driver: {ex.trip?.driver?.fullName}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
