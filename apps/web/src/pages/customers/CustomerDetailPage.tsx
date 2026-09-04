import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MapPin, Phone as PhoneIcon, Sprout } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { CustomerDetail } from '../../lib/types';
import { formatDate, formatE164 } from '../../lib/format';
import { useAuth } from '../../auth/AuthContext';
import { Alert, Badge, Button, Card, CardHeader, Spinner, StatusBadge, Table, TD, TH, THead } from '../../components/ui';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const { data, isError, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: async () => (await api.get<CustomerDetail>(`/customers/${id}`)).data,
    enabled: Boolean(id),
  });

  const toggleStatus = useMutation({
    mutationFn: async (activate: boolean) => {
      await api.post(`/customers/${id}/${activate ? 'activate' : 'deactivate'}`);
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['customer', id] }),
  });

  if (!data) {
    return (
      <div className="p-8">
        {isError ? <Alert tone="error">{errorMessage(error)}</Alert> : <Spinner label="Loading profile…" />}
      </div>
    );
  }

  const canToggle = hasPermission('customer.deactivate');

  return (
    <div className="p-8">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/customers" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">{data.fullName}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-sm text-slate-500">
            {data.farmerCode ?? 'No farmer ID'} · created {formatDate(data.createdAt)}
            {data.createdBy ? ` by ${data.createdBy.fullName}` : ''}
          </p>
        </div>
        <div className="ml-auto">
          {canToggle ? (
            toggleStatus.isPending ? (
              <span className="text-xs text-slate-400">updating…</span>
            ) : data.status === 'ACTIVE' ? (
              <Button variant="outline" onClick={() => toggleStatus.mutate(false)}>
                Deactivate
              </Button>
            ) : (
              <Button onClick={() => toggleStatus.mutate(true)}>Activate</Button>
            )
          ) : null}
        </div>
      </div>

      {toggleStatus.isError ? <div className="mb-4"><Alert tone="error">{errorMessage(toggleStatus.error)}</Alert></div> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Contact" action={<Badge tone="slate">primary marked</Badge>} />
          <ul className="divide-y divide-slate-100 px-4">
            {data.phones.length === 0 ? <li className="py-4 text-sm text-slate-400">No phone numbers.</li> : null}
            {data.phones.map((phone) => (
              <li key={phone.id} className="flex items-center gap-2.5 py-3 text-sm">
                <PhoneIcon className="h-4 w-4 text-slate-400" />
                <span className="font-medium">{formatE164(phone.phone)}</span>
                <Badge tone="slate">{phone.kind}</Badge>
                {phone.isPrimary ? <Badge tone="green">primary</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Location" action={<MapPin className="h-4 w-4 text-slate-300" />} />
          <ul className="divide-y divide-slate-100 px-4">
            {data.locations.length === 0 ? <li className="py-4 text-sm text-slate-400">No location recorded.</li> : null}
            {data.locations.map((location) => (
              <li key={location.id} className="py-3 text-sm text-slate-600">
                {[location.village, location.taluk, location.district, location.state, location.pincode].filter(Boolean).join(', ') ||
                  location.addressLine ||
                  '—'}
                {location.isPrimary ? <Badge tone="green" >primary</Badge> : null}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Crops & acreage" action={<Sprout className="h-4 w-4 text-slate-300" />} />
          {data.crops.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400">No crops recorded.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Crop</TH>
                  <TH>Acreage</TH>
                  <TH>Notes</TH>
                </tr>
              </THead>
              <tbody>
                {data.crops.map((crop) => (
                  <tr key={crop.id}>
                    <TD>
                      {crop.crop.name}
                      {crop.crop.localName ? <span className="ml-1 text-xs text-slate-400">({crop.crop.localName})</span> : null}
                    </TD>
                    <TD>
                      {crop.acreage} {crop.unit}
                    </TD>
                    <TD className="text-xs text-slate-500">{crop.notes ?? '—'}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Leads" />
          {data.leads.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400">No leads for this customer yet.</p>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Status</TH>
                  <TH>Source</TH>
                  <TH>Owner</TH>
                  <TH>Opened</TH>
                </tr>
              </THead>
              <tbody>
                {data.leads.map((lead) => (
                  <tr key={lead.id}>
                    <TD>
                      <StatusBadge status={lead.status} />
                    </TD>
                    <TD>{lead.source ?? '—'}</TD>
                    <TD>{lead.currentOwner?.fullName ?? '—'}</TD>
                    <TD className="text-xs text-slate-500">{formatDate(lead.createdAt)}</TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
