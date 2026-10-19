import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, X, Check, AlertCircle, Calendar, MapPin, Truck, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Button, Card, Input, Select, Spinner } from '../../components/ui';
import { LocationSelector } from '../../components/LocationSelector';

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

interface FarmLocation {
  id: string;
  locationName?: string | null;
  customName?: string | null;
  addressLine?: string | null;
  district?: string | null;
  taluk?: string | null;
  village?: string | null;
  state?: string | null;
  pincode?: string | null;
  isPrimary?: boolean;
  verifiedAt?: string | null;
}

interface OrderLineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
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

  // Fetch farmer's saved locations
  const customerDetailsQuery = useQuery({
    queryKey: ['customer-detail', customer.id],
    queryFn: async () => {
      const res = await api.get<{ locations?: FarmLocation[] }>(`/customers/${customer.id}`);
      return res.data;
    },
  });

  const products = productsQuery.data || [];
  const routes = routesQuery.data || [];
  const savedLocations: FarmLocation[] = customerDetailsQuery.data?.locations || [];

  // Order Items State
  const [items, setItems] = useState<OrderLineItem[]>([
    { productId: '', quantity: 1, unitPrice: 0, discount: 0 },
  ]);

  // Selected Location & Route State
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY');
  const [discountReason, setDiscountReason] = useState('');
  const [notes, setNotes] = useState('');

  // Inline "Add New Farm Location" State
  const [showAddNewLocation, setShowAddNewLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('Farm 2');
  const [newLocState, setNewLocState] = useState('Tamil Nadu');
  const [newLocDistrict, setNewLocDistrict] = useState('');
  const [newLocTaluk, setNewLocTaluk] = useState('');
  const [newLocVillage, setNewLocVillage] = useState('');
  const [newLocPincode, setNewLocPincode] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<any | null>(null);

  // Initialize first item product if not set
  useEffect(() => {
    if (products.length > 0 && items.length === 1 && !items[0].productId) {
      setItems([
        {
          productId: products[0].id,
          quantity: 1,
          unitPrice: Number(products[0].basePrice || 0),
          discount: 0,
        },
      ]);
    }
  }, [products]);

  // Initialize selected location
  useEffect(() => {
    if (savedLocations.length > 0 && !selectedLocationId) {
      const primaryLoc = savedLocations.find((l) => l.isPrimary) || savedLocations[0];
      setSelectedLocationId(primaryLoc.id);
      applyLocation(primaryLoc);
    } else if (!selectedLocationId && customer.location) {
      const loc = customer.location;
      const parts = [loc.addressLine, loc.village, loc.taluk, loc.district, loc.state, loc.pincode].filter(Boolean);
      setDeliveryAddress(parts.join(', ') || 'Farm address');
      suggestRoute(loc.district);
    }
  }, [savedLocations, selectedLocationId, customer]);

  const applyLocation = (loc: FarmLocation) => {
    const parts = [
      loc.locationName || loc.customName,
      loc.addressLine,
      loc.village,
      loc.taluk,
      loc.district,
      loc.state ? `${loc.state}${loc.pincode ? ' - ' + loc.pincode : ''}` : loc.pincode,
    ].filter(Boolean);
    setDeliveryAddress(parts.join(', '));
    suggestRoute(loc.district);
  };

  const suggestRoute = (districtName?: string | null) => {
    if (!districtName || routes.length === 0) return;
    const lower = districtName.toLowerCase();
    const matched = routes.find(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.districts?.some((d) => d.district.toLowerCase() === lower)
    );
    if (matched) {
      setSelectedRouteId(matched.id);
    } else if (!selectedRouteId && routes[0]) {
      setSelectedRouteId(routes[0].id);
    }
  };

  // Set default requested date to 3 days ahead
  useEffect(() => {
    if (!requestedDeliveryDate) {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      setRequestedDeliveryDate(d.toISOString().slice(0, 10));
    }
  }, [requestedDeliveryDate]);

  // Handle location selection from dropdown
  const handleLocationChange = (locId: string) => {
    if (locId === 'NEW') {
      setShowAddNewLocation(true);
      return;
    }
    setSelectedLocationId(locId);
    setShowAddNewLocation(false);
    const loc = savedLocations.find((l) => l.id === locId);
    if (loc) {
      applyLocation(loc);
    }
  };

  // Save new farm location inline
  const handleSaveNewLocation = async () => {
    if (!newLocDistrict || !newLocTaluk) {
      setError('District and Taluk are required for the new farm location');
      return;
    }
    setSavingLocation(true);
    setError(null);
    try {
      const payload = {
        locationName: newLocationName.trim() || 'New Farm',
        state: newLocState,
        district: newLocDistrict,
        taluk: newLocTaluk,
        village: newLocVillage.trim() || undefined,
        pincode: newLocPincode.trim() || undefined,
        addressLine: newLocAddress.trim() || undefined,
        isPrimary: false,
      };

      const res = await api.post(`/customers/${customer.id}/locations`, payload);
      await customerDetailsQuery.refetch();

      // Find created location ID or set first
      const newLoc = res.data?.locations?.[res.data.locations.length - 1];
      if (newLoc?.id) {
        setSelectedLocationId(newLoc.id);
        applyLocation(newLoc);
      }
      setShowAddNewLocation(false);
    } catch (err) {
      setError(errorMessage(err) || 'Failed to save new location');
    } finally {
      setSavingLocation(false);
    }
  };

  // Product item row operations
  const handleItemChange = (index: number, patch: Partial<OrderLineItem>) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...patch };
      if (patch.productId) {
        const prod = products.find((p) => p.id === patch.productId);
        if (prod) {
          copy[index].unitPrice = Number(prod.basePrice || 0);
        }
      }
      return copy;
    });
  };

  const handleAddItem = () => {
    const defaultProd = products[0];
    setItems((prev) => [
      ...prev,
      {
        productId: defaultProd?.id || '',
        quantity: 1,
        unitPrice: Number(defaultProd?.basePrice || 0),
        discount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Live financial calculations
  const totals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    for (const item of items) {
      const prod = products.find((p) => p.id === item.productId);
      const qty = Number(item.quantity || 0);
      const price = Number(item.unitPrice || 0);
      const disc = Number(item.discount || 0);
      const taxable = Math.max(0, qty * price - disc);
      const gstRate = Number(prod?.gstRate || 5.0);
      const tax = (taxable * gstRate) / 100;

      subtotal += taxable;
      totalDiscount += disc;
      totalTax += tax;
    }

    const grandTotal = subtotal + totalTax;
    const isLargeOrder = grandTotal >= 100000;
    const requiredAdvance = isLargeOrder ? Math.round(grandTotal * 0.25 * 100) / 100 : 0;

    return { subtotal, totalDiscount, totalTax, grandTotal, isLargeOrder, requiredAdvance };
  }, [items, products]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((it) => !it.productId || it.quantity <= 0)) {
      setError('All product lines must have a selected product and quantity greater than zero');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        customerId: customer.id,
        locationId: selectedLocationId || undefined,
        status: 'SUBMITTED',
        items: items.map((it) => ({
          productId: it.productId,
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount || 0),
        })),
        routeId: selectedRouteId || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        requestedDeliveryDate: requestedDeliveryDate || undefined,
        paymentMethod,
        discountReason: totals.totalDiscount > 0 ? (discountReason.trim() || 'Agent requested discount') : undefined,
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

  const selectedLocObj = savedLocations.find((l) => l.id === selectedLocationId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto shadow-2xl border-emerald-500/30">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-50/70 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white shadow-xs">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-extrabold text-slate-900">In-Call Sales Order Form</h2>
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
                and allocated to warehouse stock. Active call context is preserved.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" variant="primary" onClick={onClose} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                Return to Calling Workspace
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

            {/* Farm Delivery Location Section (Section 3.1 & 3.2) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <MapPin className="h-3.5 w-3.5 text-emerald-700" /> Saved Farm Delivery Locations
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddNewLocation(!showAddNewLocation)}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> {showAddNewLocation ? 'Cancel New Farm' : 'Add New Farm Location'}
                </button>
              </div>

              {!showAddNewLocation ? (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Delivery Farm</label>
                  <Select
                    value={selectedLocationId}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full font-medium"
                  >
                    {savedLocations.length === 0 && <option value="">No saved locations found</option>}
                    {savedLocations.map((loc, idx) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.locationName || `Farm ${idx + 1}`}
                        {loc.customName ? ` (${loc.customName})` : ''} — {loc.village || ''}, {loc.taluk || ''}, {loc.district || ''}
                      </option>
                    ))}
                    <option value="NEW">+ Add New Farm Location</option>
                  </Select>

                  {selectedLocObj && (
                    <div className="mt-2 rounded bg-white p-2.5 border border-slate-200 text-[11px] text-slate-700 flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{selectedLocObj.locationName || 'Farm Location'}: </span>
                        <span>{deliveryAddress}</span>
                      </div>
                      {selectedLocObj.verifiedAt ? (
                        <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 shrink-0">
                          Verified
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 shrink-0">
                          Unverified
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Inline Add New Farm Location (Section 3.3) */
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 text-xs">Add New Farm for this Farmer</span>
                    <span className="text-[10px] text-slate-500">Will be saved to farmer without overwriting existing</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Location Name</label>
                      <Input
                        value={newLocationName}
                        onChange={(e) => setNewLocationName(e.target.value)}
                        placeholder="e.g. Farm 2, Pollachi Farm"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Street / Address Line</label>
                      <Input
                        value={newLocAddress}
                        onChange={(e) => setNewLocAddress(e.target.value)}
                        placeholder="Survey no, Landmark"
                        className="text-xs"
                      />
                    </div>
                  </div>

                  <LocationSelector
                    state={newLocState}
                    district={newLocDistrict}
                    taluk={newLocTaluk}
                    village={newLocVillage}
                    pincode={newLocPincode}
                    compact
                    onChange={(patch) => {
                      if (patch.state !== undefined) setNewLocState(patch.state);
                      if (patch.district !== undefined) setNewLocDistrict(patch.district);
                      if (patch.taluk !== undefined) setNewLocTaluk(patch.taluk);
                      if (patch.village !== undefined) setNewLocVillage(patch.village);
                      if (patch.pincode !== undefined) setNewLocPincode(patch.pincode);
                    }}
                  />

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowAddNewLocation(false)}
                      disabled={savingLocation}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={handleSaveNewLocation}
                      disabled={savingLocation || !newLocDistrict || !newLocTaluk}
                      className="bg-emerald-700 text-white font-bold"
                    >
                      {savingLocation ? 'Saving...' : 'Save & Select Location'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Product Line Items (Section 10) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <ShoppingBag className="h-3.5 w-3.5 text-emerald-700" /> Order Product Items
                </p>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Product
                </button>
              </div>

              {items.map((item, index) => {
                const prod = products.find((p) => p.id === item.productId);
                return (
                  <div key={index} className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Bio-Product</label>
                        <Select
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, { productId: e.target.value })}
                          className="w-full text-xs font-medium"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) — ₹{Number(p.basePrice).toLocaleString('en-IN')} / {p.unit}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-red-500 hover:text-red-700 mt-4 p-1 rounded"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                          Quantity ({prod?.unit || 'Units'})
                        </label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="font-bold text-slate-900 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Unit Price (₹)</label>
                        <Input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Discount (₹)</label>
                        <Input
                          type="number"
                          min="0"
                          value={item.discount}
                          onChange={(e) => handleItemChange(index, { discount: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {totals.totalDiscount > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-amber-800 mb-1">
                    Discount Reason (Subject to Manager Approval)
                  </label>
                  <Input
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="e.g. Bulk seasonal purchase, special promotional concession"
                    className="text-xs border-amber-300 bg-amber-50/50"
                  />
                </div>
              )}
            </div>

            {/* Transport & Delivery Route Selection */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <Truck className="h-3.5 w-3.5 text-brand-600" /> Regional Delivery Corridor
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
                        {r.name} ({r.code})
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

            {/* Large-Order Advance Warning (Section 11.2) */}
            {totals.isLargeOrder && (
              <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 flex items-start gap-2.5 text-amber-900">
                <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[11px]">
                  <p className="font-bold text-amber-950">Large Order Advance Payment Policy (₹1,00,000+)</p>
                  <p className="mt-0.5">
                    Orders exceeding ₹1,00,000 require a verified <span className="font-bold">25% advance payment</span> (
                    <span className="font-mono font-bold">₹{totals.requiredAdvance.toLocaleString('en-IN')}</span>) before
                    dispatch approval unless an authorized manager grants an exception.
                  </p>
                </div>
              </div>
            )}

            {/* Financial Summary */}
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-emerald-800 block">
                  Subtotal: ₹{totals.subtotal.toLocaleString('en-IN')} + GST: ₹{totals.totalTax.toFixed(2)}
                </span>
                {totals.totalDiscount > 0 && (
                  <span className="text-[10px] text-amber-700 block">
                    Requested Discount: ₹{totals.totalDiscount.toLocaleString('en-IN')} (Pending Supervisor Approval)
                  </span>
                )}
                <span className="text-[10px] text-emerald-700 block">Standard GST included on agro products</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-emerald-800 block">Total Payable</span>
                <span className="text-base font-extrabold text-emerald-950 font-mono">
                  ₹{totals.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
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
                disabled={submitting || items.length === 0}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold px-5 gap-2"
              >
                {submitting ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" /> Submitting Order...
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
