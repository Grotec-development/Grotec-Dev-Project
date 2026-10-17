import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BadgePercent,
  CheckCircle2,
  DollarSign,
  Download,
  FileText,
  Filter,
  IndianRupee,
  MapPin,
  Printer,
  Search,
  ShoppingBag,
  Truck,
  User,
  X,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Button, Card, Field, Input, Select, Spinner } from '../../components/ui';

interface SaleItem {
  id: string;
  orderNumber: string;
  orderDate: string;
  completedAt?: string | null;
  status: string;
  subtotal: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  paymentStatus: string;
  paymentMethod: string;
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
    product: { id: string; name: string; sku: string; unit: string };
    deliveredQty: number | string;
    approvedQty: number | string;
    originalQty: number | string;
    unitPrice: number | string;
    totalAmount: number | string;
  }>;
  invoice?: {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    status: string;
    total: number | string;
  } | null;
  route?: { id: string; name: string; code: string } | null;
  createdBy?: { id: string; fullName: string; employeeCode?: string | null } | null;
}

export function SalesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL');
  const [selectedInvoiceOrderId, setSelectedInvoiceOrderId] = useState<string | null>(null);

  // Fetch actual completed sales (Phase 6.3)
  const salesQuery = useQuery({
    queryKey: ['sales-list', districtFilter, paymentFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (districtFilter !== 'ALL') params.district = districtFilter;
      if (paymentFilter !== 'ALL') params.paymentStatus = paymentFilter;
      const res = await api.get<SaleItem[]>('/sales', { params });
      return res.data;
    },
    refetchInterval: 15_000,
  });

  const rawSales = salesQuery.data || [];

  // In-memory search & date filter
  const sales = useMemo(() => {
    let list = rawSales;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.orderNumber.toLowerCase().includes(q) ||
          s.customer.fullName.toLowerCase().includes(q) ||
          s.customer.farmerCode?.toLowerCase().includes(q) ||
          s.customer.locations?.[0]?.district?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rawSales, searchTerm]);

  // Aggregate KPI Calculations from verified completed sales
  const kpis = useMemo(() => {
    const totalRev = sales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
    const count = sales.length;
    const avgTicket = count > 0 ? totalRev / count : 0;
    const paidCount = sales.filter((s) => s.paymentStatus === 'PAID').length;
    return { totalRev, count, avgTicket, paidCount };
  }, [sales]);

  // Invoice Data Query
  const invoiceQuery = useQuery({
    queryKey: ['sales-invoice', selectedInvoiceOrderId],
    queryFn: async () => {
      if (!selectedInvoiceOrderId) return null;
      const res = await api.get(`/sales/orders/${selectedInvoiceOrderId}/invoice`);
      return res.data;
    },
    enabled: Boolean(selectedInvoiceOrderId),
  });

  const invoiceData = invoiceQuery.data;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-700 text-white font-bold shadow-xs">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900">Completed Sales &amp; Invoices</h1>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                Phase 6 Sales Reconciliation
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Verified business sales reconciled against completed deliveries and confirmed customer payments.
            </p>
          </div>
        </div>

        {/* Global Action */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void salesQuery.refetch()}
            className="text-xs"
          >
            Refresh Sales
          </Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white shadow-xs space-y-1 border-l-4 border-l-emerald-600">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Reconciled Sales
          </span>
          <p className="text-lg font-black text-slate-900 font-mono">
            ₹{kpis.totalRev.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="text-[10px] text-emerald-700 font-medium">Reconciled delivery revenue</span>
        </Card>

        <Card className="p-3.5 bg-white shadow-xs space-y-1 border-l-4 border-l-blue-600">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Completed Sales Count
          </span>
          <p className="text-lg font-black text-slate-900 font-mono">{kpis.count}</p>
          <span className="text-[10px] text-blue-700 font-medium">Distinct sales transactions</span>
        </Card>

        <Card className="p-3.5 bg-white shadow-xs space-y-1 border-l-4 border-l-brand-600">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Average Sale Value
          </span>
          <p className="text-lg font-black text-slate-900 font-mono">
            ₹{kpis.avgTicket.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <span className="text-[10px] text-brand-700 font-medium">Per farmer invoice</span>
        </Card>

        <Card className="p-3.5 bg-white shadow-xs space-y-1 border-l-4 border-l-purple-600">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Fully Paid Invoices
          </span>
          <p className="text-lg font-black text-slate-900 font-mono">
            {kpis.paidCount} / {kpis.count}
          </p>
          <span className="text-[10px] text-purple-700 font-medium">
            {kpis.count > 0 ? `${Math.round((kpis.paidCount / kpis.count) * 100)}% payment collected` : 'No sales'}
          </span>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="p-3 bg-white shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 text-xs">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order #, farmer name, code..."
              className="pl-8 text-xs py-1.5"
            />
          </div>

          <div>
            <Select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="w-full text-xs"
            >
              <option value="ALL">All Regional Districts</option>
              <option value="Coimbatore">Coimbatore</option>
              <option value="Dharmapuri">Dharmapuri</option>
              <option value="Salem">Salem</option>
              <option value="Erode">Erode</option>
              <option value="Tiruppur">Tiruppur</option>
              <option value="Vellore">Vellore</option>
              <option value="Madurai">Madurai</option>
              <option value="Tiruchirappalli">Tiruchirappalli</option>
            </Select>
          </div>

          <div>
            <Select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="w-full text-xs"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="PAID">Paid / Reconciled</option>
              <option value="UNPAID">Pending Collection</option>
              <option value="PARTIAL">Partially Paid</option>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
              Showing {sales.length} verified sales
            </span>
          </div>
        </div>
      </Card>

      {/* Completed Sales Table */}
      <Card className="bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Sale / Order #</th>
                <th className="py-3 px-4">Farmer Details</th>
                <th className="py-3 px-4">Products Delivered</th>
                <th className="py-3 px-4">Route &amp; Zone</th>
                <th className="py-3 px-4">Completed Date</th>
                <th className="py-3 px-4">Sale Amount</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {salesQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Spinner label="Loading completed sales ledger..." />
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No completed sales found matching current criteria.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => {
                  const farmerDist = sale.customer.locations?.[0]?.district || 'Tamil Nadu';
                  const farmerPhone = sale.customer.phones?.[0]?.phoneE164 || '—';
                  const isPaid = sale.paymentStatus === 'PAID';

                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-slate-900 block">{sale.orderNumber}</span>
                        {sale.invoice && (
                          <span className="font-mono text-[10px] text-emerald-700 block">
                            Inv: {sale.invoice.invoiceNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{sale.customer.fullName}</span>
                        <span className="text-[11px] text-slate-500 block">
                          {sale.customer.farmerCode} • {farmerPhone}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        {sale.items.map((item, i) => (
                          <span key={item.id || i} className="block text-[11px] truncate">
                            {item.product.name} ({Number(item.deliveredQty || item.approvedQty)} {item.product.unit})
                          </span>
                        ))}
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 block w-max">
                          {sale.route?.name || farmerDist}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600">
                        {formatDate(sale.completedAt || sale.orderDate)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono font-extrabold text-slate-900 block">
                          ₹{Number(sale.totalAmount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-slate-400">GST Incl.</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            isPaid
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sale.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setSelectedInvoiceOrderId(sale.id)}
                          className="gap-1 text-slate-700 hover:text-emerald-700"
                        >
                          <Printer className="h-3 w-3" /> View Invoice
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

      {/* Tax Invoice Modal (Phase 6.5) */}
      {selectedInvoiceOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <Card className="max-h-[92vh] w-full max-w-2xl overflow-y-auto shadow-2xl p-6 bg-white space-y-4">
            {invoiceQuery.isLoading ? (
              <div className="py-12 text-center">
                <Spinner label="Loading Tax Invoice data..." />
              </div>
            ) : invoiceData ? (
              <div className="space-y-4 text-xs">
                {/* Invoice Header */}
                <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight">TAX INVOICE</h2>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Invoice No: <span className="font-bold text-slate-800">{invoiceData.invoiceNumber}</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Date: <span className="font-semibold text-slate-700">{formatDate(invoiceData.invoiceDate)}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-extrabold text-sm text-emerald-800">{invoiceData.company.name}</h3>
                    <p className="text-[10px] text-slate-500">{invoiceData.company.address}</p>
                    <p className="text-[10px] text-slate-500 font-mono">GSTIN: {invoiceData.company.gstin}</p>
                  </div>
                </div>

                {/* Billed To */}
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Billed To</span>
                    <span className="font-bold text-slate-900 text-sm">{invoiceData.customer.fullName}</span>
                    <p className="text-slate-600 font-mono">{invoiceData.customer.farmerCode}</p>
                    <p className="text-slate-600">{invoiceData.customer.phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Delivery Details</span>
                    <p className="text-slate-700">{invoiceData.customer.address}</p>
                    <p className="text-slate-600 font-medium">District: {invoiceData.customer.district}</p>
                    <p className="text-slate-500 text-[10px]">Sales Exec: {invoiceData.agent}</p>
                  </div>
                </div>

                {/* Line Items Table */}
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 text-[10px] font-extrabold uppercase text-slate-600">
                    <tr>
                      <th className="p-2">Item Description</th>
                      <th className="p-2">HSN</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Rate</th>
                      <th className="p-2 text-right">Tax (5%)</th>
                      <th className="p-2 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceData.lineItems.map((item: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2 font-semibold text-slate-800">{item.productName}</td>
                        <td className="p-2 font-mono text-[11px] text-slate-500">{item.hsn}</td>
                        <td className="p-2 text-right font-mono font-medium">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-2 text-right font-mono">₹{item.unitPrice.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono text-slate-600">₹{item.taxAmount.toFixed(2)}</td>
                        <td className="p-2 text-right font-mono font-bold text-slate-900">
                          ₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Financial Summary */}
                <div className="flex justify-end pt-2">
                  <div className="w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Taxable Subtotal:</span>
                      <span className="font-mono">₹{invoiceData.financials.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>CGST (2.5%):</span>
                      <span className="font-mono">₹{invoiceData.financials.cgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>SGST (2.5%):</span>
                      <span className="font-mono">₹{invoiceData.financials.sgst.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-slate-200 pt-1.5">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-800">
                        ₹{invoiceData.financials.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <Button variant="ghost" onClick={() => setSelectedInvoiceOrderId(null)}>
                    Close
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => window.print()}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5"
                    >
                      <Printer className="h-3.5 w-3.5" /> Print / Save PDF
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500">Failed to load invoice.</div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
export default SalesPage;
