import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import type { Page } from '../lib/types';
import { formatDate } from '../lib/format';
import { Alert, Card, Select, Spinner, Table, TD, TH, THead } from '../components/ui';

interface AuditEvent {
  id: string;
  actor: { id: string; fullName: string; email: string } | null;
  entityType: string;
  entityLabel: string | null;
  action: string;
  createdAt: string;
}

const ENTITY_TYPES = ['', 'AUTH', 'EMPLOYEE', 'CUSTOMER', 'CUSTOMER_PHONE', 'CUSTOMER_LOCATION', 'CUSTOMER_CROP', 'CROP', 'LEAD'];

export function AuditPage() {
  const [entityType, setEntityType] = useState('');
  const { data, isError, error } = useQuery({
    queryKey: ['audit', entityType],
    queryFn: async () => {
      const res = await api.get<Page<AuditEvent>>('/audit', {
        params: { entityType: entityType || undefined, page: 1, pageSize: 100 },
      });
      return res.data;
    },
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Audit log</h1>
          <p className="text-sm text-slate-500">
            Append-only record of who changed what. Founder-only per PRD §5.2.
          </p>
        </div>
        <Select className="w-56" value={entityType} onChange={(e) => setEntityType(e.target.value)} aria-label="Filter by entity">
          <option value="">All entity types</option>
          {ENTITY_TYPES.filter(Boolean).map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
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
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Entity</TH>
                <TH>Action</TH>
                <TH>Label</TH>
              </tr>
            </THead>
            <tbody>
              {data.items.length === 0 ? (
                <tr>
                  <TD colSpan={5} className="py-8 text-center text-slate-400">
                    No audit events.
                  </TD>
                </tr>
              ) : (
                data.items.map((event) => (
                  <tr key={event.id} className="hover:bg-slate-50">
                    <TD className="whitespace-nowrap text-xs text-slate-500">{formatDate(event.createdAt)}</TD>
                    <TD>{event.actor?.fullName ?? 'system'}</TD>
                    <TD>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">{event.entityType}</span>
                    </TD>
                    <TD>
                      <span className="font-mono text-xs text-brand-700">{event.action}</span>
                    </TD>
                    <TD className="text-xs text-slate-500">{event.entityLabel ?? '—'}</TD>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
