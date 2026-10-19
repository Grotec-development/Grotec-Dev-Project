import React from 'react';
import { X, Printer, Share2, ShieldAlert, CheckCircle2, IndianRupee } from 'lucide-react';
import { formatNumber } from '../../lib/format';

export interface PaymentSlipData {
  slipNumber: string;
  orderNumber: string;
  invoiceNumber?: string | null;
  customerName: string;
  farmerCode?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  items?: Array<{ name: string; quantity: number; unit?: string; price?: number }>;
  orderTotal: number;
  previousPaid: number;
  amountCollected: number;
  remainingBalance: number;
  paymentMethod: string;
  transactionReference?: string | null;
  collectedAt: string;
  agentName: string;
  agentCode?: string | null;
  status: 'PENDING_APPROVAL' | 'VERIFIED' | 'REJECTED';
  isApproved: boolean;
}

interface PaymentSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  slip: PaymentSlipData;
}

export function PaymentSlipModal({ isOpen, onClose, slip }: PaymentSlipModalProps) {
  if (!isOpen) return null;

  const isApproved = slip.status === 'VERIFIED';

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    const text = `*GROTEC ORGANIC PRIVATE LIMITED*\nPayment Collection Slip: ${slip.slipNumber}\nCustomer: ${slip.customerName} (${slip.farmerCode || ''})\nOrder: ${slip.orderNumber}\nAmount Collected: ₹${formatNumber(slip.amountCollected)}\nBalance Due: ₹${formatNumber(slip.remainingBalance)}\nMethod: ${slip.paymentMethod}\nStatus: ${isApproved ? 'VERIFIED RECEIPT' : 'SUBMITTED (Pending Manager Review)'}\nAgent: ${slip.agentName}`;

    if (navigator.share) {
      navigator.share({ title: `GROTEC Collection Slip ${slip.slipNumber}`, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('Payment slip details copied to clipboard for sharing!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto print:p-0 print:border-none print:shadow-none">
        {/* Header with Close */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                isApproved
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              {isApproved ? 'Official Payment Receipt' : 'Collection Slip'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Collection Slip Canvas */}
        <div className="space-y-4 p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 print:border-none print:bg-white print:p-0">
          {/* Company Branding */}
          <div className="text-center pb-3 border-b border-slate-200 space-y-1">
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              GROTEC ORGANIC PRIVATE LIMITED
            </h2>
            <p className="text-[10px] text-slate-500">
              Agricultural Inputs &amp; Organic Farm Solutions • Tamil Nadu, India
            </p>
            <p className="text-[10px] font-mono text-slate-400">
              CIN: U01111TZ2025PTC034567 • GSTIN: 33AAACG1234D1Z5
            </p>
          </div>

          {/* Prominent Verification Status Watermark / Notice */}
          <div
            className={`p-3 rounded-lg flex items-center gap-2.5 text-xs font-bold ${
              isApproved
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border border-amber-200 text-amber-900'
            }`}
          >
            {isApproved ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-black uppercase tracking-wider text-[11px]">
                    VERIFIED PAYMENT RECEIPT
                  </p>
                  <p className="text-[10px] font-normal text-emerald-700">
                    Payment has been reviewed, approved, and posted to the customer ledger.
                  </p>
                </div>
              </>
            ) : (
              <>
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-black uppercase tracking-wider text-[11px]">
                    COLLECTION SUBMITTED — PENDING APPROVAL
                  </p>
                  <p className="text-[10px] font-normal text-amber-800">
                    Received on field by delivery agent. Awaiting warehouse manager reconciliation.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Slip Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Slip No:</span>
              <p className="font-mono font-bold text-slate-900">{slip.slipNumber}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Date &amp; Time:</span>
              <p className="font-mono text-slate-800 text-[11px]">
                {new Date(slip.collectedAt).toLocaleString('en-IN')}
              </p>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Farmer / Customer:</span>
              <p className="font-bold text-slate-900">{slip.customerName}</p>
              {slip.farmerCode && (
                <span className="text-[10px] font-mono text-slate-500">ID: {slip.farmerCode}</span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Order Reference:</span>
              <p className="font-mono font-bold text-slate-900">{slip.orderNumber}</p>
              {slip.invoiceNumber && (
                <span className="text-[10px] font-mono text-slate-500">Inv: {slip.invoiceNumber}</span>
              )}
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="pt-2 border-t border-slate-200">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Total Order Value</span>
                <span className="font-mono">₹{formatNumber(slip.orderTotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Prior Verified Advance</span>
                <span className="font-mono text-emerald-700">-₹{formatNumber(slip.previousPaid)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
                <span>Amount Collected ({slip.paymentMethod})</span>
                <span className="font-mono text-emerald-800">
                  ₹{formatNumber(slip.amountCollected)}
                </span>
              </div>
              <div className="flex justify-between text-slate-700 font-semibold pt-1">
                <span>Remaining Balance Due</span>
                <span className="font-mono text-slate-900">
                  ₹{formatNumber(slip.remainingBalance)}
                </span>
              </div>
            </div>
          </div>

          {slip.transactionReference && (
            <div className="text-[11px] bg-white p-2 rounded border border-slate-200 text-slate-600 font-mono">
              Txn Ref: {slip.transactionReference}
            </div>
          )}

          {/* Delivery Staff Signature Line */}
          <div className="pt-3 border-t border-slate-200 flex justify-between items-end text-[10px] text-slate-500">
            <div>
              <p className="font-bold text-slate-800">{slip.agentName}</p>
              <p>Delivery Specialist {slip.agentCode ? `(${slip.agentCode})` : ''}</p>
            </div>
            <div className="text-right italic">
              Authorized Field Representative
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2 print:hidden">
          <button
            type="button"
            onClick={handleShare}
            className="flex-1 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
          >
            <Share2 className="h-4 w-4" />
            <span>Share Slip</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
          >
            <Printer className="h-4 w-4" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
}
