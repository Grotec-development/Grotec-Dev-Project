import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import type { Crop } from '../lib/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, Field, Input, Spinner, Table, TD, TH, THead } from '../components/ui';

export function CropsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const canManage = hasPermission('crop.manage');

  const { data, isError, error } = useQuery({
    queryKey: ['crops'],
    queryFn: async () => (await api.get<Crop[]>('/crops')).data,
  });

  const toggleActive = useMutation({
    mutationFn: async (crop: Crop) => {
      await api.patch(`/crops/${crop.id}`, { isActive: !crop.isActive });
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['crops'] }),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Crops</h1>
          <p className="text-sm text-slate-500">Reference catalog. Crop categories arrive with the Knowledge Base (Month 4).</p>
        </div>
        {canManage ? (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Add crop
          </Button>
        ) : null}
      </div>

      {isError ? <Alert tone="error">{errorMessage(error)}</Alert> : null}

      <Card>
        {!data ? (
          <Spinner />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Code</TH>
                <TH>Name</TH>
                <TH>Local name</TH>
                <TH>Status</TH>
                {canManage ? <TH className="text-right">Actions</TH> : null}
              </tr>
            </THead>
            <tbody>
              {data.map((crop) => (
                <tr key={crop.id} className="hover:bg-slate-50">
                  <TD className="font-mono text-xs">{crop.code}</TD>
                  <TD className="font-medium">{crop.name}</TD>
                  <TD>{crop.localName ?? '—'}</TD>
                  <TD>
                    {crop.isActive ? <Badge tone="green">active</Badge> : <Badge tone="slate">inactive</Badge>}
                  </TD>
                  {canManage ? (
                    <TD className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={toggleActive.isPending}
                        onClick={() => toggleActive.mutate(crop)}
                      >
                        {crop.isActive ? 'Retire' : 'Reactivate'}
                      </Button>
                    </TD>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {showCreate ? <CreateCropModal onClose={() => setShowCreate(false)} onCreated={() => setShowCreate(false)} /> : null}
    </div>
  );
}

function CreateCropModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [localName, setLocalName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.post('/crops', { code, name, localName: localName || undefined });
      await queryClient.invalidateQueries({ queryKey: ['crops'] });
      onCreated();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <Card className="w-full max-w-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Add crop</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Code" hint="e.g. RICE">
            <Input value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Local name (optional)">
            <Input value={localName} onChange={(e) => setLocalName(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !code.trim() || name.trim().length < 2} onClick={() => void submit()}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
