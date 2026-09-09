import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import type { CustomerDetail } from '../../lib/types';
import { Alert, Button, Card, Field, Input, Select, cx } from '../../components/ui';
import { duplicateMatch } from './CustomersPage';

interface PhoneRow {
  key: number;
  number: string;
  kind: 'MOBILE' | 'OTHER';
  isPrimary: boolean;
}

let nextKey = 1;

export function NewCustomerModal({
  onClose,
  onCreated,
  initialPhone,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
  /** Pre-fill the dialed number (mid-call creation from the Agent workspace). */
  initialPhone?: string;
}) {
  const [fullName, setFullName] = useState('');
  const [soilType, setSoilType] = useState('');
  const [phones, setPhones] = useState<PhoneRow[]>([{ key: nextKey++, number: initialPhone ?? '', kind: 'MOBILE', isPrimary: true }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<{ id: string; fullName: string; phone: string } | null>(null);

  function updatePhone(key: number, patch: Partial<PhoneRow>) {
    setPhones((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    if (patch.isPrimary) {
      setPhones((rows) => rows.map((row) => (row.key === key ? { ...row, isPrimary: true } : { ...row, isPrimary: false })));
    }
  }

  const valid = fullName.trim().length >= 2 && phones.length > 0 && phones.every((p) => p.number.trim().length > 0);

  async function submit() {
    setBusy(true);
    setError(null);
    setMatch(null);
    try {
      const res = await api.post<CustomerDetail>('/customers', {
        fullName: fullName.trim(),
        // Blank is sent as null, matching the backend contract (blank clears / stays unset).
        soilType: soilType.trim() || null,
        phones: { phones: phones.map((p) => ({ number: p.number.trim(), kind: p.kind, isPrimary: p.isPrimary })) },
      });
      onCreated(res.data.id);
    } catch (err) {
      const matched = duplicateMatch(err);
      if (matched) {
        setMatch({ id: matched.id, fullName: matched.fullName, phone: matched.phone });
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-800">New customer</h2>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {match ? (
            <Alert tone="info">
              <p className="mb-1 font-medium">This phone number belongs to an existing customer:</p>
              <p>
                {match.fullName} ({match.phone})
              </p>
              <Link to={`/customers/${match.id}`} onClick={onClose} className="mt-2 inline-block font-medium text-blue-800 underline">
                Open the existing profile instead
              </Link>
            </Alert>
          ) : null}

          <Field label="Full name">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ramesh Patel" autoFocus />
          </Field>

          <Field label="Soil type" hint="Optional — free text, up to 40 characters.">
            <Input
              value={soilType}
              onChange={(e) => setSoilType(e.target.value)}
              maxLength={40}
              placeholder="e.g. Red loam"
            />
          </Field>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Phone numbers</p>
            {phones.map((phone) => (
              <div key={phone.key} className={cx('flex items-center gap-2 rounded-md border p-2', phone.isPrimary ? 'border-brand-200 bg-brand-50/50' : 'border-slate-200')}>
                <Input
                  className="flex-1"
                  inputMode="tel"
                  placeholder="Mobile number"
                  value={phone.number}
                  onChange={(e) => updatePhone(phone.key, { number: e.target.value })}
                />
                <Select
                  className="w-24"
                  value={phone.kind}
                  onChange={(e) => updatePhone(phone.key, { kind: e.target.value as 'MOBILE' | 'OTHER' })}
                  aria-label="Phone kind"
                >
                  <option value="MOBILE">Mobile</option>
                  <option value="OTHER">Other</option>
                </Select>
                <button
                  type="button"
                  onClick={() => updatePhone(phone.key, { isPrimary: true })}
                  title="Set primary"
                  className={cx('rounded-md px-2 py-1.5 text-xs font-medium', phone.isPrimary ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  Primary
                </button>
                <button
                  type="button"
                  onClick={() => setPhones((rows) => rows.filter((row) => row.key !== phone.key))}
                  disabled={phones.length === 1}
                  className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                  aria-label="Remove phone"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPhones((rows) => [...rows, { key: nextKey++, number: '', kind: 'MOBILE', isPrimary: false }])}
            >
              Add another number
            </Button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!valid || busy}>
            {busy ? 'Saving…' : 'Create customer'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
