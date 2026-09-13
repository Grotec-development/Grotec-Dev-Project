import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, X, MapPin, Sprout } from 'lucide-react';
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

interface CropOption {
  id: string;
  code: string;
  name: string;
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

  // Farm Location fields
  const [village, setVillage] = useState('');
  const [taluk, setTaluk] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('');

  // Crop & Agricultural fields
  const [availableCrops, setAvailableCrops] = useState<CropOption[]>([]);
  const [cropId, setCropId] = useState('');
  const [acreage, setAcreage] = useState('');
  const [cropNotes, setCropNotes] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<{ id: string; fullName: string; phone: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<CropOption[]>('/crops')
      .then((res) => {
        if (!cancelled && res.data) {
          setAvailableCrops(res.data);
          if (res.data.length > 0) {
            const defaultCrop = res.data.find((c) => c.code === 'RICE') || res.data[0];
            setCropId(defaultCrop.id);
          }
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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
      const payload: any = {
        fullName: fullName.trim(),
        soilType: soilType.trim() || null,
        phones: { phones: phones.map((p) => ({ number: p.number.trim(), kind: p.kind, isPrimary: p.isPrimary })) },
      };

      if (village.trim() || taluk.trim() || district.trim() || state.trim() || pincode.trim()) {
        payload.locations = {
          locations: [
            {
              village: village.trim() || undefined,
              taluk: taluk.trim() || undefined,
              district: district.trim() || undefined,
              state: state.trim() || undefined,
              pincode: pincode.trim() || undefined,
              isPrimary: true,
            },
          ],
        };
      }

      if (cropId && acreage.trim()) {
        const parsedAcreage = parseFloat(acreage.trim());
        if (!isNaN(parsedAcreage) && parsedAcreage > 0) {
          payload.crops = {
            crops: [
              {
                cropId,
                acreage: parsedAcreage,
                unit: 'ACRES',
                notes: cropNotes.trim() || undefined,
              },
            ],
          };
        }
      }

      const res = await api.post<CustomerDetail>('/customers', payload);
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

          {/* Farm Location */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
              <MapPin className="h-3.5 w-3.5 text-emerald-700" />
              <span>Farm Location</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Village">
                <Input
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  placeholder="e.g. Papanasam"
                />
              </Field>
              <Field label="Taluk">
                <Input
                  value={taluk}
                  onChange={(e) => setTaluk(e.target.value)}
                  placeholder="e.g. Papanasam"
                />
              </Field>
              <Field label="District">
                <Input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Thanjavur"
                />
              </Field>
              <Field label="State">
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Tamil Nadu"
                />
              </Field>
              <div className="col-span-2 sm:col-span-1">
                <Field label="Pincode">
                  <Input
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="e.g. 614205"
                    maxLength={10}
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Cultivating Crop Details */}
          <div className="space-y-3 rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-950">
                <Sprout className="h-3.5 w-3.5 text-emerald-700" />
                <span>Cultivating Crop</span>
              </span>
              <span className="text-[10px] text-emerald-800 font-medium">Agricultural Profile</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Crop</label>
                <Select
                  value={cropId}
                  onChange={(e) => setCropId(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="">Select crop...</option>
                  {availableCrops.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <Field label="Acreage">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={acreage}
                  onChange={(e) => setAcreage(e.target.value)}
                  placeholder="e.g. 5.0 (Acres)"
                />
              </Field>
              <div className="col-span-2">
                <Field label="Variety / Crop Stage">
                  <Input
                    value={cropNotes}
                    onChange={(e) => setCropNotes(e.target.value)}
                    placeholder="e.g. Variety: BPT 5204 (Samba Season, Tillering stage)"
                  />
                </Field>
              </div>
            </div>
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
