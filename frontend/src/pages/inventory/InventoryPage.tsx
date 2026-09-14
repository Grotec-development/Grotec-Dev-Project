import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Boxes,
  Package,
  Layers,
  Truck,
  ArrowRightLeft,
  AlertTriangle,
  Search,
  Plus,
  X,
  History,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api';

export function InventoryPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'STOCKS' | 'MOVEMENTS'>('STOCKS');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);

  // Form state for manual adjustment
  const [selectedProductId, setSelectedProductId] = useState('');
  const [adjustState, setAdjustState] = useState('AVAILABLE');
  const [adjustQuantity, setAdjustQuantity] = useState(10);
  const [adjustReason, setAdjustReason] = useState('');

  // Fetch inventory stocks
  const { data: stockData = { stocks: [], summary: [] }, isLoading: isStocksLoading } = useQuery({
    queryKey: ['inventory-stocks'],
    queryFn: async () => {
      const res = await api.get('/inventory/stocks');
      return res.data;
    },
  });

  // Fetch movements
  const { data: movements = [], isLoading: isMovementsLoading } = useQuery({
    queryKey: ['inventory-movements'],
    queryFn: async () => {
      const res = await api.get('/inventory/movements');
      return res.data;
    },
  });

  // Fetch products for adjustment dropdown
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const res = await api.get('/products');
      return res.data;
    },
  });

  // Stock adjustment mutation
  const adjustMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/inventory/adjust', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stocks'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      setIsAdjustOpen(false);
      setSelectedProductId('');
      setAdjustQuantity(10);
      setAdjustReason('');
    },
  });

  function handleAdjustSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId) {
      alert('Please select a product');
      return;
    }
    adjustMutation.mutate({
      productId: selectedProductId,
      state: adjustState,
      quantity: adjustQuantity,
      reason: adjustReason,
    });
  }

  // Filtered summaries
  const summaries = stockData?.summary || [];
  const filteredSummaries = summaries.filter((item: any) => {
    const p = item.product;
    return (
      p?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p?.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p?.category?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  // Aggregated totals
  const totalAvailable = summaries.reduce((s: number, i: any) => s + (i.available || 0), 0);
  const totalAllocated = summaries.reduce((s: number, i: any) => s + (i.allocated || 0), 0);
  const totalLoaded = summaries.reduce((s: number, i: any) => s + ((i.loaded || 0) + (i.inVehicle || 0)), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <Boxes className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Multi-State Inventory Ledger</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time stock tracking across central warehouse, allocated orders, and field vehicle pools.
          </p>
        </div>
        <button
          onClick={() => setIsAdjustOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium shadow-xs transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Stock Adjustment
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Warehouse Available</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-md">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{totalAvailable.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Ready for order booking</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Allocated (Reserved)</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-md">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2">{totalAllocated.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Locked for confirmed orders</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">In-Transit / Vehicle Stock</p>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-md">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{totalLoaded.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">Currently on lorries & delivery routes</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active SKUs</p>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-md">
              <Package className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-purple-700 mt-2">{products.length}</p>
          <p className="text-xs text-slate-400 mt-1">Across 5 bio-agri categories</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-6 pt-3 rounded-t-xl">
        <button
          onClick={() => setActiveTab('STOCKS')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'STOCKS'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package className="w-4 h-4" />
          Product Stock Ledger
        </button>
        <button
          onClick={() => setActiveTab('MOVEMENTS')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'MOVEMENTS'
              ? 'border-emerald-700 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          Movement Audit Trail
        </button>
      </div>

      {/* Tab 1: Product Stock Ledger */}
      {activeTab === 'STOCKS' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-b-xl rounded-t-none border border-slate-200 shadow-sm">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products by SKU or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">SKU & Product Name</th>
                    <th className="px-5 py-3.5">Category</th>
                    <th className="px-5 py-3.5 text-center">Unit</th>
                    <th className="px-5 py-3.5 text-right font-bold text-emerald-700">Available</th>
                    <th className="px-5 py-3.5 text-right text-blue-700">Allocated</th>
                    <th className="px-5 py-3.5 text-right text-amber-700">In Vehicle</th>
                    <th className="px-5 py-3.5 text-right font-bold text-slate-900">Total Physical</th>
                    <th className="px-5 py-3.5 text-right">Base Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isStocksLoading ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                        Loading inventory...
                      </td>
                    </tr>
                  ) : filteredSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                        No inventory records found.
                      </td>
                    </tr>
                  ) : (
                    filteredSummaries.map((item: any) => (
                      <tr key={item.product?.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{item.product?.name}</p>
                          <p className="text-xs font-mono text-slate-400">{item.product?.sku}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200">
                            {item.product?.category?.name || 'Bio Product'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center font-mono text-xs text-slate-600">
                          {item.product?.unit}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-emerald-700">
                          {item.available}
                        </td>
                        <td className="px-5 py-4 text-right text-blue-600 font-medium">
                          {item.allocated}
                        </td>
                        <td className="px-5 py-4 text-right text-amber-600 font-medium">
                          {item.loaded + item.inVehicle}
                        </td>
                        <td className="px-5 py-4 text-right font-bold text-slate-900">
                          {item.total}
                        </td>
                        <td className="px-5 py-4 text-right text-slate-700 font-medium">
                          ₹{Number(item.product?.basePrice).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Movement Audit Trail */}
      {activeTab === 'MOVEMENTS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Type / Trigger</th>
                  <th className="px-5 py-3.5">State Transition</th>
                  <th className="px-5 py-3.5 text-right">Quantity</th>
                  <th className="px-5 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isMovementsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      Loading movements...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      No stock movement logs found.
                    </td>
                  </tr>
                ) : (
                  movements.map((mov: any) => (
                    <tr key={mov.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {new Date(mov.createdAt).toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {mov.referenceType}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono">
                        <span className="text-slate-400">{mov.fromState || 'INITIAL'}</span>
                        <span className="mx-1.5 text-slate-400">➔</span>
                        <span className="font-bold text-slate-900">{mov.toState}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                        {Number(mov.quantity)}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600">
                        {mov.actor?.fullName || 'System'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-500">
                        {mov.notes || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Adjust Stock Level</h3>
              <button
                onClick={() => setIsAdjustOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Product *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  <option value="">Select product...</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Target State
                  </label>
                  <select
                    value={adjustState}
                    onChange={(e) => setAdjustState(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="ALLOCATED">ALLOCATED</option>
                    <option value="LOADED">LOADED</option>
                    <option value="REMAINING_IN_VEHICLE">IN_VEHICLE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Adjustment Quantity
                  </label>
                  <input
                    type="number"
                    value={adjustQuantity}
                    onChange={(e) => setAdjustQuantity(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Reason for Adjustment *
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Physical inventory count discrepancy audit"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAdjustOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs"
                >
                  {adjustMutation.isPending ? 'Saving...' : 'Apply Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
