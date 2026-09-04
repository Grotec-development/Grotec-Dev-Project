import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Plus, Search } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { ApiErrorBody, CustomerSummary, Page } from '../../lib/types';
import { formatE164 } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Button, Card, Input, Select, Spinner, StatusBadge, Table, TD, TH, THead, cx } from '../../components/ui';
import { NewCustomerModal } from './NewCustomerModal';

export function CustomersPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['customers', q, status],
    queryFn: async () => {
      const res = await api.get<Page<CustomerSummary>>('/customers', {
        params: { q: q || undefined, status: status || undefined, page: 1, pageSize: 50 },
      });
      return res.data;
    },
  });

  const canCreate = hasPermission('customer.create');

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">Farmer master — search by name or phone number.</p>
        </div>
        {canCreate ? (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New customer
          </Button>
        ) : null}
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          <div className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search name or phone…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search customers"
            />
          </div>
          <Select className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
          {isFetching ? <span className="text-xs text-slate-400">refreshing…</span> : null}
        </div>

        {isError ? (
          <div className="p-4">
            <Alert tone="error">{errorMessage(error)}</Alert>
          </div>
        ) : !data ? (
          <Spinner />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Farmer</TH>
                <TH>Farmer ID</TH>
                <TH>Primary phone</TH>
                <TH>Status</TH>
                <TH>Created</TH>
              </tr>
            </THead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <TD colSpan={5} className="py-8 text-center text-slate-400">
                    No customers found.
                  </TD>
                </tr>
              ) : (
                data.items.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50">
                    <TD>
                      <Link to={`/customers/${customer.id}`} className="font-medium text-brand-700 hover:underline">
                        {customer.fullName}
                      </Link>
                    </TD>
                    <TD className="font-mono text-xs text-slate-500">{customer.farmerCode ?? '—'}</TD>
                    <TD>{customer.primaryPhone ? formatE164(customer.primaryPhone) : '—'}</TD>
                    <TD>
                      <StatusBadge status={customer.status} />
                    </TD>
                    <TD className="text-xs text-slate-500">{new Date(customer.createdAt).toLocaleDateString('en-IN')}</TD>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
        <div className={cx('border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500')}>{data ? `${data.total} customer${data.total === 1 ? '' : 's'}` : ''}</div>
      </Card>

      {showCreate ? (
        <NewCustomerModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => {
            setShowCreate(false);
            void queryClient.invalidateQueries({ queryKey: ['customers'] });
            window.location.assign(`/customers/${id}`);
          }}
        />
      ) : null}
    </div>
  );
}

export function duplicateMatch(error: unknown): ApiErrorBody['error']['matchedCustomer'] | null {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    if (body?.error?.code === 'CUSTOMER_PHONE_EXISTS') return body.error.matchedCustomer ?? null;
  }
  return null;
}
