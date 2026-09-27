import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { Lead, Page } from '../../lib/types';
import { formatDate } from '../../lib/format';
import { Alert, Card, Select, Spinner, StatusBadge, Table, TD, TH, THead } from '../../components/ui';
import { useState } from 'react';

export function LeadsPage() {
  const [status, setStatus] = useState('');
  const { data, isError, error } = useQuery({
    queryKey: ['leads', status],
    queryFn: async () => {
      const res = await api.get<Page<Lead>>('/leads', { params: { status: status || undefined, page: 1, pageSize: 50 } });
      return res.data;
    },
    refetchInterval: 10_000,
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">
            Prospects you own (agents) or all leads (managers). Lead creation and outcome handling arrive with the Agent workspace.
          </p>
        </div>
        <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </div>

      {isError ? <Alert tone="error">{errorMessage(error)}</Alert> : null}

      <Card>
        {!data ? (
          <Spinner />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Customer</TH>
                <TH>Status</TH>
                <TH>Source</TH>
                <TH>Owner</TH>
                <TH>Opened</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <TD colSpan={6} className="py-8 text-center text-slate-400">
                    No leads found.
                  </TD>
                </tr>
              ) : (
                data.items.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <TD>
                      <Link to={`/customers/${lead.customer.id}`} className="font-medium text-brand-700 hover:underline">
                        {lead.customer.fullName}
                      </Link>
                    </TD>
                    <TD>
                      <StatusBadge status={lead.status} />
                    </TD>
                    <TD>{lead.source ?? '—'}</TD>
                    <TD>{lead.owner?.fullName ?? '—'}</TD>
                    <TD className="text-xs text-slate-500">{formatDate(lead.createdAt)}</TD>
                    <TD className="text-right">
                      <Link
                        to={`/agent?customerId=${lead.customer.id}&name=${encodeURIComponent(lead.customer.fullName)}`}
                        className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition"
                        title="Call Farmer in Calling Workspace"
                      >
                        <Phone className="h-3 w-3" />
                        <span>Call</span>
                      </Link>
                    </TD>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
        <div className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500">{data ? `${data.total} lead${data.total === 1 ? '' : 's'}` : ''}</div>
      </Card>
    </div>
  );
}
