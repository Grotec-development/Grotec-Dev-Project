import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X, Check, ShieldAlert, UserCheck } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { Button, Card, Field, Input, Select, Spinner } from '../../components/ui';

interface EmployeeOption {
  id: string;
  fullName: string;
  roleCode?: string;
  department?: string;
}

interface InCallTicketModalProps {
  customer: {
    id: string;
    fullName: string;
    farmerCode?: string | null;
  };
  activeCallId?: string | null;
  onClose: () => void;
  onTicketCreated: (ticket: any) => void;
}

export function InCallTicketModal({ customer, activeCallId, onClose, onTicketCreated }: InCallTicketModalProps) {
  // Fetch team leaders and management staff for escalation
  const staffQuery = useQuery({
    queryKey: ['staff-options'],
    queryFn: async () => {
      const res = await api.get<EmployeeOption[]>('/employees');
      return res.data;
    },
  });

  const staff = staffQuery.data || [];

  const [category, setCategory] = useState('TEAM_LEADER_REQUEST');
  const [priority, setPriority] = useState('HIGH');
  const [assignedRole, setAssignedRole] = useState('TEAM_LEADER');
  const [assignedToId, setAssignedToId] = useState('');
  const [description, setDescription] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTicket, setCreatedTicket] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please provide escalation details or customer request description');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        customerId: customer.id,
        callId: activeCallId || undefined,
        category,
        priority,
        assignedRole,
        assignedToId: assignedToId || undefined,
        description: description.trim(),
      };

      const res = await api.post('/support-tickets', payload);
      setCreatedTicket(res.data);
      onTicketCreated(res.data);
    } catch (err) {
      setError(errorMessage(err) || 'Failed to raise ticket');
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
      <Card className="max-h-[92vh] w-full max-w-lg overflow-y-auto shadow-2xl border-amber-500/30">
        <div className="flex items-center justify-between border-b border-slate-100 bg-amber-50/70 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-700 text-white shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Raise Escalation Ticket</h2>
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

        {createdTicket ? (
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Check className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Ticket Raised Successfully!</h3>
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Ticket ID: <span className="font-bold text-slate-800">{createdTicket.ticketNumber}</span>
              </p>
              <p className="text-xs text-slate-600 mt-2 max-w-sm mx-auto">
                Assigned to <span className="font-bold text-slate-800">{assignedRole.replace(/_/g, ' ')}</span> queue
                for priority resolution.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button size="sm" variant="primary" onClick={onClose} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                Return to Calling Workspace
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4 text-xs">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-red-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Escalation Category</label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full">
                  <option value="TEAM_LEADER_REQUEST">Team Leader Request</option>
                  <option value="MANAGEMENT_REQUEST">Senior Management Request</option>
                  <option value="MD_REQUEST">Managing Director Request</option>
                  <option value="CROP_ADVISORY">Crop Advisory Escalation</option>
                  <option value="PRICE_CLARIFICATION">Special Pricing / Bulk Discount</option>
                  <option value="ORDER_ISSUE">Order Discrepancy</option>
                  <option value="DELIVERY_ISSUE">Delivery Delay / Route Query</option>
                  <option value="PAYMENT_ISSUE">Payment Clarification</option>
                  <option value="PRODUCT_ENQUIRY">Product Specific Technical Query</option>
                </Select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Priority Level</label>
                <Select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full">
                  <option value="URGENT">Urgent (Immediate Callback)</option>
                  <option value="HIGH">High (Today)</option>
                  <option value="MEDIUM">Medium (Within 24h)</option>
                  <option value="LOW">Low</option>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Escalation Hierarchy Role</label>
                <Select value={assignedRole} onChange={(e) => setAssignedRole(e.target.value)} className="w-full">
                  <option value="TEAM_LEADER">Team Leader</option>
                  <option value="GROUP_LEADER">Group Leader</option>
                  <option value="OPERATIONS">Operations &amp; Logistics Lead</option>
                  <option value="MANAGEMENT">Senior Management / MD Office</option>
                </Select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Assign Specific Person (Optional)</label>
                <Select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full">
                  <option value="">(Assign to Role Queue)</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.department || s.roleCode || 'Staff'})
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Issue Description / Farmer Stated Requirement
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="State the farmer's concern, reasons for escalation, and any specific commitments made..."
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-amber-600 focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-3">
              <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !description.trim()}
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-5 gap-2"
              >
                {submitting ? (
                  <>
                    <Spinner className="h-3.5 w-3.5" /> Raising Ticket...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-4 w-4" /> Raise Escalation Ticket
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
export default InCallTicketModal;
