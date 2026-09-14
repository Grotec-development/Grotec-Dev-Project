import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Factory,
  Layers,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  X,
  Package,
} from 'lucide-react';
import { api } from '../../lib/api';

export function FactoryPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantityProduced, setQuantityProduced] = useState(500);
  const [mfgDate, setMfgDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  // Fetch batches
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['production-batches'],
    queryFn: async () => {
      const res = await api.get('/production/batches');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
  });

  // Fetch products
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
  });

  // Create batch mutation
  const createBatchMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/production/batches', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stocks'] });
      setIsModalOpen(false);
      setSelectedProductId('');
      setQuantityProduced(500);
      setNotes('');
    },
  });

  function handleSubmitBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId) {
      alert('Please select a product');
      return;
    }

    createBatchMutation.mutate({
      productId: selectedProductId,
      quantityProduced,
      mfgDate,
      notes,
    });
  }

  // Filtered batches
  const filteredBatches = batches.filter((b: any) =>
    b.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.product?.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalProducedUnits = batches.reduce((acc: number, b: any) => acc + Number(b.quantityProduced || 0), 0);
  const totalRemainingUnits = batches.reduce((acc: number, b: any) => acc + Number(b.quantityRemaining || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-50 text-amber-700 rounded-lg">
              <Factory className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Factory & Production</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Finished-goods register, certified batch runs, and manufacturing quality control (PRD §18.1)
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium shadow-sm transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Record Production Batch
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Batches Produced</p>
            <span className="p-2 bg-slate-100 text-slate-600 rounded-md">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{batches.length}</p>
          <p className="text-xs text-slate-400 mt-1">Dharmapuri manufacturing facility</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Units Output</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{totalProducedUnits.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">100% bio-organic formulations</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Remaining Factory Stock</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-md">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2">{totalRemainingUnits.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Available across batches</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search batches by Batch #, Product Name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>
      </div>

      {/* Production Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Batch Code</th>
                <th className="px-5 py-3.5">Product Name</th>
                <th className="px-5 py-3.5 text-center">Unit</th>
                <th className="px-5 py-3.5 text-right font-bold text-slate-900">Qty Produced</th>
                <th className="px-5 py-3.5 text-right font-medium text-emerald-700">Remaining</th>
                <th className="px-5 py-3.5">Mfg Date</th>
                <th className="px-5 py-3.5">Exp Date</th>
                <th className="px-5 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    Loading factory batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    No production batches found.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch: any) => (
                  <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-amber-800">
                      {batch.batchNumber}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{batch.product?.name}</p>
                      <p className="text-xs font-mono text-slate-400">{batch.product?.sku}</p>
                    </td>
                    <td className="px-5 py-4 text-center font-mono text-xs text-slate-600">
                      {batch.product?.unit}
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-slate-900">
                      {Number(batch.quantityProduced).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-emerald-700">
                      {Number(batch.quantityRemaining).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {new Date(batch.mfgDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {new Date(batch.expDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {batch.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Production Batch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Record Production Batch</h3>
                <p className="text-xs text-slate-500">Manufactured in Dharmapuri factory</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBatch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Product Formulation *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  <option value="">Select product to produce...</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.unit}) - {p.sku}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Produced Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantityProduced}
                    onChange={(e) => setQuantityProduced(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Mfg Date
                  </label>
                  <input
                    type="date"
                    value={mfgDate}
                    onChange={(e) => setMfgDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Batch Quality Notes / Lab Test Cert
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Standard bio-inoculant titer test passed (>2x10^8 CFU/ml)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBatchMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
                >
                  {createBatchMutation.isPending ? 'Recording...' : 'Register Batch & Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
