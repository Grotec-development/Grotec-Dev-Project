import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, X, Check, AlertCircle, Calendar, MapPin, Truck, IndianRupee } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Button, Card, Field, Input, Select, Spinner } from '../../components/ui';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  basePrice: number | string;
  unit: string;
  gstRate?: number | string;
}

interface DeliveryRouteOption {
  id: string;
  name: string;
  code: string;
  districts?: Array<{ district: string }>;
}

interface InCallOrderModalProps {
  customer: {
    id: string;
    fullName: string;
    farmerCode?: string | null;
    primaryPhone?: string | null;
    location?: {
      addressLine?: string | null;
      district?: string | null;
      taluk?: string | null;
      village?: string | null;
      state?: string | null;
      pincode?: string | null;
    } | null;
  };
  onClose: () => void;
  onOrderCreated: (order: any) => void;
}

export function InCallOrderModal({ customer, onClose, onOrderCreated }: InCallOrderModalProps) {
  // Fetch active product catalogue
  const productsQuery = useQuery({
    queryKey: ['products-list'],
    queryFn: async () => {
      const res = await api.get<ProductItem[]>('/products');
      return res.data;
    },
  });

  // Fetch delivery routes
  const routesQuery = useQuery({
    queryKey: ['routes-list'],
    queryFn: async () => {
      const res = await api.get<DeliveryRouteOption[]>('/routes');
      return res.data;
    },
  });

  const products = productsQuery.data || [];
  const routes = routesQuery.data || [];

  // Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<any | null>(null);

  // Initialize defaults
  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
      setUnitPrice(Number(products[0].basePrice || 0));
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    if (customer.location) {
      const loc = customer.location;
      const parts = [loc.village, loc.taluk, loc.district, loc.state, loc.pincode].filter(Boolean);
      setDeliveryAddress(loc.addressLine || parts.join(', ') || 'Farm address');

      // Auto-suggest route based on district
      if (routes.length > 0 && loc.district && !selectedRouteId) {
        const matchedRoute = routes.find((r) =>
          r.districts?.some((d) => d.district.toLowerCase() === loc.district?.toLowerCase())
        );
        if (matchedRoute) {
          setSelectedRouteId(matchedRoute.id);
        } else if (routes[0]) {
          setSelectedRouteId(routes[0].id);
        }
      }
    } else if (routes.length > 0 && !selectedRouteId) {
      setSelectedRouteId(routes[0].id);
    }
  }, [customer, routes, selectedRouteId]);

  // Set default requested date to 3 days ahead
  useEffect(() => {
    if (!requestedDeliveryDate) {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      setRequestedDeliveryDate(d.toISOString().slice(0, 10));
    }
  }, [requestedDeliveryDate]);

  const activeProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const p = products.find((item) => item.id === prodId);
    if (p) {
      setUnitPrice(Number(p.basePrice || 0));
    }
  };

  // Live financial calculations
  const taxableAmount = Math.max(0, unitPrice * Number(quantity || 0) - Number(discount || 0));
  const taxRate = Number(activeProduct?.gstRate || 5.0);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const grandTotal = taxableAmount + taxAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setError('Please select a product');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        customerId: customer.id,
        status: 'SUBMITTED', // Distinct Order stage (Phase 6.1)
        items: [
          {
            productId: selectedProductId,
            quantity: Number(quantity),
            unitPrice: Number(unitPrice),
            discount: Number(discount || 0),
          },
        ],
        routeId: selectedRouteId || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        requestedDeliveryDate: requestedDeliveryDate || undefined,
        paymentMethod,
        notes: notes.trim() ? `[In-Call Order] ${notes.trim()}` : '[In-Call Order]',
      };

      const res = await api.post('/orders', payload);
      setSuccessOrder(res.data);
      onOrderCreated(res.data);
    } catch (err) {
      setError(errorMessage(err) || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto shadow-2xl border-emerald-500/30">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-50/60 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">In-Call Sales Order</h2>
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Active Call Mode
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Farmer: <span className="font-bold text-slate-800">{customer.fullName}</span>{' '}
                {customer.farmerCode && `(${customer.farmerCode})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Success State */}
        {successOrder ? (
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Sales Order Placed Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Order Number: <span className="font-bold text-emerald-700">{successOrder.orderNumber}</span>
              </p>
              <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto">
                The order has been created in <span className="font-semibold text-slate-800">SUBMITTED</span> stage
                and routed for delivery confirmation. Active call context is preserved.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" variant="primary" onClick={onClose} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                Return to Call Workspace
              </Button>
            </div>
          </div>
        ) : (
          /* Order Form */
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4 text-xs">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Product & Variant Selection */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <ShoppingBag className="h-3.5 w-3.5 text-emerald-700" /> Product Details
              </p>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Bio-Product</label>
                <Select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full font-medium"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — ₹{Number(p.basePrice).toLocaleString('en-IN')} / {p.unit}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Unit Price (₹)</label>
                  <Input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Discount (₹)</label>
                  <Input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Transport & Delivery Route Selection (Phase 10) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <Truck className="h-3.5 w-3.5 text-brand-600" /> Regional Delivery &amp; Route
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Delivery Route</label>
                  <Select
                    value={selectedRouteId}
                    onChange={(e) => setSelectedRouteId(e.target.value)}
                    className="w-full text-xs"
                  >
                    <option value="">(Select Regional Route)</option>
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Requested Delivery Date</label>
                  <Input
                    type="date"
                    value={requestedDeliveryDate}
                    onChange={(e) => setRequestedDeliveryDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Delivery Address</label>
                <Input
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Village, Taluk, District, Landmark..."
                  className="text-xs"
                />
              </div>
            </div>

            {/* Payment & Order Notes */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Payment Method</label>
                <Select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="CASH_ON_DELIVERY">Cash on Delivery (COD)</option>
                  <option value="ONLINE_UPI">UPI / Online Payment</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer</option>
                  <option value="CREDIT">Authorized Credit Term</option>
                </Select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Order Instructions</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery timing, pack instructions..."
                  className="text-xs"
                />
              </div>
            </div>

            {/* Financial Summary */}
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-emerald-800">
                  Subtotal: ₹{taxableAmount.toLocaleString('en-IN')} + GST ({taxRate}%): ₹
                  {taxAmount.toFixed(2)}
                </span>
                <p className="text-[10px] text-emerald-700">Standard GST included on agro products</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-emerald-800 block">Total Payable</span>
                <span className="text-base font-extrabold text-emerald-950 font-mono">
                  ₹{grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !selectedProductId || quantity <= 0}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-5 gap-2"
              >
                {submitting ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" /> Placing Order...
                  </>
                ) : (
                  <>
                    <ShoppingBag className="h-4 w-4" /> Submit Sales Order
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
export default InCallOrderModal;
