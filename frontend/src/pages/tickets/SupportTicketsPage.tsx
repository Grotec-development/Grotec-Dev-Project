import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  LifeBuoy,
  MessageSquare,
  Search,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Button, Card, Field, Input, Select, Spinner } from '../../components/ui';
import { POLL_INTERVAL_LISTS } from '../../lib/polling';

interface SupportTicketItem {
  id: string;
  ticketNumber: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  description: string;
  resolutionNotes?: string | null;
  assignedRole?: string | null;
  createdAt: string;
  dueDate?: string | null;
  resolvedAt?: string | null;
  customer: {
    id: string;
    farmerCode?: string | null;
    fullName: string;
    phones?: Array<{ phoneE164: string }>;
    locations?: Array<{ district?: string | null }>;
  };
  assignedTo?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  createdBy?: {
    id: string;
    fullName: string;
  } | null;
  history?: Array<{
    id: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    notes?: string | null;
    createdAt: string;
    actor?: { fullName: string } | null;
  }>;
}

export function SupportTicketsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketItem | null>(null);

  // Update status modal state
  const [newStatus, setNewStatus] = useState<string>('IN_PROGRESS');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Fetch tickets
  const ticketsQuery = useQuery({
    queryKey: ['support-tickets-list', statusFilter, priorityFilter, categoryFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (priorityFilter !== 'ALL') params.priority = priorityFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      const res = await api.get<SupportTicketItem[]>('/support-tickets', { params });
      return res.data;
    },
    refetchInterval: POLL_INTERVAL_LISTS,
  });

  const rawTickets = ticketsQuery.data || [];

  const tickets = useMemo(() => {
    let list = rawTickets;
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(q) ||
          t.customer.fullName.toLowerCase().includes(q) ||
          t.customer.farmerCode?.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rawTickets, searchTerm]);

  // KPIs
  const kpis = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === 'OPEN' || t.status === 'ASSIGNED').length;
    const urgent = tickets.filter((t) => t.priority === 'URGENT' && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;
    const resolved = tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    return { total, open, urgent, resolved };
  }, [tickets]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    setStatusError(null);

    try {
      await api.patch(`/support-tickets/${selectedTicket.id}/status`, {
        status: newStatus,
        notes: resolutionNotes.trim() || undefined,
      });

      void queryClient.invalidateQueries({ queryKey: ['support-tickets-list'] });
      setSelectedTicket(null);
      setResolutionNotes('');
    } catch (err) {
      setStatusError(errorMessage(err) || 'Failed to update ticket status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100 p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600 text-white font-bold shadow-xs">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-slate-900">Support &amp; Escalation Tickets</h1>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                Phase 7 Management Escalations
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Centralized tracking of farmer support requests, team-leader assignments, and executive escalations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void ticketsQuery.refetch()}
            className="text-xs"
          >
            Refresh Tickets
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-white shadow-xs space-y-1 border-l-4 border-l-amber-500">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Open / Pending Action
          </span>
          <p className="text-lg font-black text-slate-900 font-mono">{kpis.open}</p>
          <span className="text-[10px] text-amber-700 font-medium">Requiring team action</span>
        </Card>

        <Card className="p-3.5 bg-white shadow-xs space-y-1 border-l-4 border-l-red-500">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Urgent Escalations
          </span>
          <p className="text-lg font-black text-red-700 font-mono">{kpis.urgent}</p>
          <span className="text-[10px] text-red-600 font-medium">Critical farmer priority</span>
        </Card>

        <Card className="p-3.5 bg-white shadow-xs space-y-1 border-l-4 border-l-emerald-600">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Resolved Issues
          </span>
          <p className="text-lg font-black text-slate-900 font-mono">{kpis.resolved}</p>
          <span className="text-[10px] text-emerald-700 font-medium">Successfully completed</span>
        </Card>

        <Card className="p-3.5 bg-white shadow-xs space-y-1 border-l-4 border-l-slate-400">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Total Logged
          </span>
          <p className="text-lg font-black text-slate-900 font-mono">{kpis.total}</p>
          <span className="text-[10px] text-slate-500 font-medium">All historical tickets</span>
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
              placeholder="Search by ticket #, farmer, keyword..."
              className="pl-8 text-xs py-1.5"
            />
          </div>

          <div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs"
            >
              <option value="ALL">All Ticket Statuses</option>
              <option value="OPEN">Open (Unassigned)</option>
              <option value="ASSIGNED">Assigned to Team Lead</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </Select>
          </div>

          <div>
            <Select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full text-xs"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </Select>
          </div>

          <div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full text-xs"
            >
              <option value="ALL">All Categories</option>
              <option value="TEAM_LEADER_REQUEST">Team Leader Request</option>
              <option value="MANAGEMENT_REQUEST">Senior Management Request</option>
              <option value="MD_REQUEST">Managing Director Request</option>
              <option value="CROP_ADVISORY">Crop Advisory Escalation</option>
              <option value="PRICE_CLARIFICATION">Price Clarification</option>
              <option value="ORDER_ISSUE">Order Discrepancy</option>
              <option value="DELIVERY_ISSUE">Delivery Route Issue</option>
              <option value="PAYMENT_ISSUE">Payment Clarification</option>
              <option value="PRODUCT_ENQUIRY">Product Specific Query</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Tickets Table */}
      <Card className="bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Farmer Details</th>
                <th className="py-3 px-4">Category &amp; Issue</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Raised Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {ticketsQuery.isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Spinner label="Loading escalation tickets..." />
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No support tickets found matching current filters.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => {
                  const isUrgent = ticket.priority === 'URGENT';
                  const isHigh = ticket.priority === 'HIGH';

                  return (
                    <tr key={ticket.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {ticket.ticketNumber}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{ticket.customer.fullName}</span>
                        <span className="text-[11px] text-slate-500 block">
                          {ticket.customer.farmerCode} • {ticket.customer.locations?.[0]?.district || 'Tamil Nadu'}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <span className="font-bold text-slate-800 block">
                          {ticket.category.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] text-slate-600 line-clamp-1">
                          {ticket.description}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            isUrgent
                              ? 'bg-red-100 text-red-800'
                              : isHigh
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800 block">
                          {ticket.assignedTo?.fullName || ticket.assignedRole?.replace(/_/g, ' ') || 'Unassigned'}
                        </span>
                        {ticket.createdBy && (
                          <span className="text-[10px] text-slate-400 block">
                            By {ticket.createdBy.fullName}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600">
                        {formatDate(ticket.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ticket.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            setNewStatus(ticket.status);
                            setResolutionNotes('');
                          }}
                          className="text-slate-700 hover:text-emerald-700"
                        >
                          Manage / Resolve
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

      {/* Ticket Details & Resolution Modal */}
      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto shadow-2xl p-6 bg-white space-y-4">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900">
                    Ticket {selectedTicket.ticketNumber}
                  </h2>
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    {selectedTicket.priority} Priority
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Farmer: <span className="font-bold text-slate-700">{selectedTicket.customer.fullName}</span> ({selectedTicket.customer.farmerCode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wide text-[10px] block">
                  Category: {selectedTicket.category.replace(/_/g, ' ')}
                </span>
                <p className="text-slate-800 leading-relaxed font-medium">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.resolutionNotes && (
                <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 space-y-1">
                  <span className="font-bold text-emerald-800 text-[10px] block uppercase">Existing Resolution Notes</span>
                  <p className="text-emerald-900">{selectedTicket.resolutionNotes}</p>
                </div>
              )}

              {/* Status Update Form */}
              <form onSubmit={handleUpdateStatus} className="space-y-3 pt-2 border-t border-slate-200">
                {statusError && (
                  <div className="rounded bg-red-50 p-2.5 text-xs text-red-800">{statusError}</div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Update Status</label>
                    <Select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full text-xs"
                    >
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
                      <option value="RESOLVED">Resolved (Issue Addressed)</option>
                      <option value="CLOSED">Closed (Archived)</option>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Assigned Role</label>
                    <Input
                      value={selectedTicket.assignedRole || 'Team Leader'}
                      disabled
                      className="text-xs bg-slate-100 text-slate-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Resolution / Progress Notes
                  </label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={3}
                    placeholder="Enter resolution notes, farmer contact outcome, or actions taken..."
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs focus:border-emerald-600 focus:outline-none"
                    required={newStatus === 'RESOLVED' || newStatus === 'CLOSED'}
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setSelectedTicket(null)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updatingStatus}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1.5"
                  >
                    {updatingStatus ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-4 w-4" />}
                    Update Status &amp; Save Notes
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
export default SupportTicketsPage;
