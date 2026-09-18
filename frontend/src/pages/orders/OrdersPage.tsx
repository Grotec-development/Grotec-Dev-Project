import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart,
  Plus,
  Search,
  FileText,
  CheckCircle,
  Truck,
  IndianRupee,
  Clock,
  X,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Alert } from '../../components/ui';

export function OrdersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [orderItems, setOrderItems] = useState<Array<{ productId: string; quantity: number; unitPrice: number }>>([
    { productId: '', quantity: 1, unitPrice: 0 },
  ]);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY');
  const [notes, setNotes] = useState('');

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const res = await api.get('/orders');
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

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const res = await api.get('/customers?pageSize=50');
      return Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.customers || []);
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await api.post('/orders', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setIsCreateOpen(false);
      resetForm();
    },
  });

  function resetForm() {
    setSelectedCustomerId('');
    setOrderItems([{ productId: '', quantity: 1, unitPrice: 0 }]);
    setDeliveryAddress('');
    setPaymentMethod('CASH_ON_DELIVERY');
    setNotes('');
  }

  function handleProductChange(index: number, productId: string) {
    const prod = products.find((p: any) => p.id === productId);
    const updated = [...orderItems];
    updated[index].productId = productId;
    if (prod) {
      updated[index].unitPrice = Number(prod.basePrice);
    }
    setOrderItems(updated);
  }

  function handleQuantityChange(index: number, qty: number) {
    const updated = [...orderItems];
    updated[index].quantity = Math.max(1, qty);
    setOrderItems(updated);
  }

  function addOrderItem() {
    setOrderItems([...orderItems, { productId: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeOrderItem(index: number) {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  }

  // Calculate live order totals
  const subtotal = orderItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const tax = subtotal * 0.05;
  const grandTotal = subtotal + tax;

  function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId) {
      alert('Please select a customer');
      return;
    }
    if (orderItems.some(item => !item.productId)) {
      alert('Please select valid products for all items');
      return;
    }

    createOrderMutation.mutate({
      customerId: selectedCustomerId,
      items: orderItems,
      deliveryAddress,
      paymentMethod,
      notes,
    });
  }

  // Filtered orders
  const filteredOrders = orders.filter((order: any) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customer?.farmerCode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Summary counts
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + Number(o.totalAmount || 0), 0);
  const confirmedCount = orders.filter((o: any) => o.status === 'CONFIRMED').length;
  const dispatchedCount = orders.filter((o: any) => o.status === 'DISPATCHED').length;
  const deliveredCount = orders.filter((o: any) => o.status === 'DELIVERED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sales Orders & Billing</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Order management, warehouse allocation, GST tax invoices, and payment tracking.
          </p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-medium shadow-xs transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Create Sales Order
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Orders</p>
            <span className="p-2 bg-slate-100 text-slate-600 rounded-md">
              <FileText className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{orders.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total orders booked</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confirmed (Pending Dispatch)</p>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-md">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-2">{confirmedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Allocated in warehouse</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">In Transit</p>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-md">
              <Truck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{dispatchedCount}</p>
          <p className="text-xs text-slate-400 mt-1">On delivery vehicles</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Value</p>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-md">
              <IndianRupee className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">₹{totalRevenue.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-400 mt-1">{deliveredCount} orders delivered</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Order #, Farmer Name or Code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Order Number</th>
                <th className="px-5 py-3.5">Farmer / Customer</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Items</th>
                <th className="px-5 py-3.5 text-right">Total Amount</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-center">Payment</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    Loading orders...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-500">
                    No sales orders found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order: any) => (
                  <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-mono font-medium text-emerald-700">
                      {order.orderNumber}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{order.customer?.fullName}</p>
                      <p className="text-xs text-slate-400 font-mono">{order.customer?.farmerCode}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500">
                      {new Date(order.orderDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {order.items?.map((it: any) => (
                          <span
                            key={it.id}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {it.product?.name} × {it.approvedQty}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-900">
                      ₹{Number(order.totalAmount).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          order.status === 'DELIVERED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : order.status === 'DISPATCHED'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.paymentStatus === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Invoice
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Sales Order Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create New Sales Order</h2>
                <p className="text-xs text-slate-500">Book farmer order & allocate warehouse stock</p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitOrder} className="flex-1 overflow-y-auto p-6 space-y-5">
              {createOrderMutation.isError ? (
                <Alert tone="error">{errorMessage(createOrderMutation.error)}</Alert>
              ) : null}
              {/* Customer Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Select Farmer / Customer *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="">-- Choose a farmer --</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({c.farmerCode || 'No Code'}) - {c.phones?.[0]?.phoneE164 || ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Items */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Order Products (Grotec 14 Genuine Lines) *
                  </label>
                  <button
                    type="button"
                    onClick={addOrderItem}
                    className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>

                {orderItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductChange(idx, e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-white"
                      >
                        <option value="">Select product...</option>
                        {products.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit}) - ₹{Number(p.basePrice)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                        required
                        className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-md bg-white text-center"
                      />
                    </div>

                    <div className="w-24 text-right text-sm font-semibold text-slate-800">
                      ₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}
                    </div>

                    {orderItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeOrderItem(idx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Order Calculation Box */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/60 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST (CGST 2.5% + SGST 2.5%):</span>
                  <span>₹{tax.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-emerald-200 text-base">
                  <span>Grand Total:</span>
                  <span className="text-emerald-700">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Delivery Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Delivery Address / Land Landmark
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Near village lake farm, Dharmapuri"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="CASH_ON_DELIVERY">Cash on Delivery (POD)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="CREDIT">Kisan Credit / 15-day terms</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending}
                  className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  {createOrderMutation.isPending ? 'Booking Order...' : 'Confirm & Issue Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Tax Invoice Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Tax Invoice {selectedOrder.invoice?.invoiceNumber || selectedOrder.orderNumber}
                </h2>
                {selectedOrder.invoice?.isRevised && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    REVISED
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 text-slate-800 bg-white" id="invoice-sheet">
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                <div>
                  <h3 className="text-xl font-bold text-emerald-800">GROTEC AGRO PRODUCTS</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Bio-Fertilizer & Plant Bio-Tech Manufacturer</p>
                  <p className="text-xs text-slate-500">Dharmapuri, Tamil Nadu, India</p>
                  <p className="text-xs text-slate-500">GSTIN: 33AAAAA0000A1Z5 · FCO 1985 Certified</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">TAX INVOICE</p>
                  <p className="text-lg font-bold font-mono text-slate-900">
                    {selectedOrder.invoice?.invoiceNumber || 'INV-PENDING'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Date: {new Date(selectedOrder.orderDate).toLocaleDateString('en-IN')}
                  </p>
                  <p className="text-xs text-slate-500">
                    Order Ref: <span className="font-mono">{selectedOrder.orderNumber}</span>
                  </p>
                </div>
              </div>

              {/* Billed To */}
              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Billed To (Farmer):</p>
                  <p className="font-bold text-slate-900">{selectedOrder.customer?.fullName}</p>
                  <p className="text-xs text-slate-600">Farmer Code: {selectedOrder.customer?.farmerCode}</p>
                  <p className="text-xs text-slate-600">Phone: {selectedOrder.customer?.phones?.[0]?.phoneE164}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Delivery Destination:</p>
                  <p className="text-slate-700">{selectedOrder.deliveryAddress || 'Direct Farm Delivery'}</p>
                  <p className="text-xs text-slate-500 mt-1">Status: {selectedOrder.status}</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Item Description</th>
                      <th className="px-4 py-2.5 text-center">HSN</th>
                      <th className="px-4 py-2.5 text-center">Qty</th>
                      <th className="px-4 py-2.5 text-right">Unit Price</th>
                      <th className="px-4 py-2.5 text-right">Taxable</th>
                      <th className="px-4 py-2.5 text-right">GST (5%)</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items?.map((it: any) => (
                      <tr key={it.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{it.product?.name}</td>
                        <td className="px-4 py-3 text-center text-slate-500 font-mono">31010099</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-800">
                          {it.approvedQty} {it.product?.unit}
                        </td>
                        <td className="px-4 py-3 text-right">₹{Number(it.unitPrice)}</td>
                        <td className="px-4 py-3 text-right">
                          ₹{(Number(it.unitPrice) * Number(it.approvedQty)).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3 text-right">₹{Number(it.taxAmount).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          ₹{Number(it.totalAmount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Subtotal:</span>
                    <span>₹{Number(selectedOrder.subtotal).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST (2.5%):</span>
                    <span>₹{(Number(selectedOrder.taxAmount) / 2).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST (2.5%):</span>
                    <span>₹{(Number(selectedOrder.taxAmount) / 2).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-900 pt-2 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="text-emerald-700">₹{Number(selectedOrder.totalAmount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {selectedOrder.invoice?.revisionReason && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800">
                  <span className="font-semibold">Revision Note: </span>
                  {selectedOrder.invoice.revisionReason}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center px-6 py-4 border-t border-slate-200 bg-slate-50">
              <span className="text-xs text-slate-500">Generated automatically by GROTEC FarmerOS Phase 2</span>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
