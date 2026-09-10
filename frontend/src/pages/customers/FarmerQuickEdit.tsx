import { useEffect, useState } from 'react';
import { api, errorMessage } from '../../lib/api';
import { formatE164 } from '../../lib/format';
import type { CustomerDetail } from '../../lib/types';
import { Alert, Button, Input } from '../../components/ui';
import {
  EMPTY_LOCATION_DRAFT,
  buildAddPhonePayload,
  buildCropPayload,
  buildLocationPayload,
  locationDraftFrom,
  parseAcreage,
  type LocationDraft,
} from './customer-edit.util';

/**
 * Compact editor for the farmer details Agent Mode shows beside the call: the
 * primary location, each crop's acreage, and the phone list.
 *
 * Every section calls an EXISTING customer endpoint, each of which starts with
 * CustomersService.scopedCustomer() and returns the freshly scoped CustomerDetail
 * — so the backend stays the authorization boundary and the caller can refresh
 * straight from the response. Farmer name and soil type are edited separately by
 * the caller through PATCH /customers/:id and are deliberately not repeated here.
 *
 * Two limits come from the current API, not from this component:
 *  - an existing phone NUMBER cannot be changed in place (UpdatePhoneDto carries
 *    only kind/isPrimary), so a correction is "add the new number, then remove
 *    the old one";
 *  - PATCH .../crops/:id changes acreage, unit and notes but not WHICH crop.
 */
export function FarmerQuickEdit({
  customer,
  onSaved,
}: {
  customer: CustomerDetail;
  onSaved: (updated: CustomerDetail) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [locationDraft, setLocationDraft] = useState<LocationDraft>(() => locationDraftFrom(customer.locations));
  const [cropDrafts, setCropDrafts] = useState<Record<string, { acreage: string; unit: string }>>({});
  const [newPhone, setNewPhone] = useState('');

  // Re-seed every draft when the record changes (also how Cancel restores).
  useEffect(() => {
    setLocationDraft(locationDraftFrom(customer.locations));
    setCropDrafts(
      Object.fromEntries(
        (customer.crops ?? []).map((c) => [c.id, { acreage: String(c.acreage), unit: c.unit ?? '' }]),
      ),
    );
    setNewPhone('');
    setError(null);
  }, [customer]);

  async function run(key: string, call: () => Promise<{ data: CustomerDetail }>) {
    setPending(key);
    setError(null);
    try {
      const res = await call();
      onSaved(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(null);
    }
  }

  const primaryLocation = customer.locations?.find((l) => l.isPrimary) ?? customer.locations?.[0] ?? null;

  function saveLocation() {
    const payload = buildLocationPayload(locationDraft);
    void run('location', () =>
      primaryLocation
        ? api.patch<CustomerDetail>(`/customers/${customer.id}/locations/${primaryLocation.id}`, payload)
        : api.post<CustomerDetail>(`/customers/${customer.id}/locations`, { ...payload, isPrimary: true }),
    );
  }

  function saveCrop(customerCropId: string) {
    const draft = cropDrafts[customerCropId];
    const acreage = parseAcreage(draft?.acreage ?? '');
    if (acreage === null) {
      setError('Acreage must be a number of at least 0.01, with up to two decimals.');
      return;
    }
    void run(`crop-${customerCropId}`, () =>
      api.patch<CustomerDetail>(
        `/customers/${customer.id}/crops/${customerCropId}`,
        buildCropPayload(acreage, draft?.unit ?? ''),
      ),
    );
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-3 text-xs">
      {error ? <Alert tone="error">{error}</Alert> : null}

      {/* Location — PATCH when one exists, POST for the farmer's first one */}
      <div>
        <p className="text-[10px] font-bold uppercase text-slate-400">Location</p>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {(['village', 'taluk', 'district', 'state'] as const).map((field) => (
            <Input
              key={field}
              value={locationDraft[field]}
              onChange={(e) => setLocationDraft((d) => ({ ...d, [field]: e.target.value }))}
              placeholder={field[0].toUpperCase() + field.slice(1)}
              aria-label={field}
              disabled={pending !== null}
            />
          ))}
          <Input
            value={locationDraft.pincode}
            onChange={(e) => setLocationDraft((d) => ({ ...d, pincode: e.target.value }))}
            placeholder="Pincode"
            aria-label="pincode"
            maxLength={10}
            disabled={pending !== null}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Button size="xs" onClick={saveLocation} disabled={pending !== null}>
            {pending === 'location' ? 'Saving…' : primaryLocation ? 'Save location' : 'Add location'}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setLocationDraft(locationDraftFrom(customer.locations))}
            disabled={pending !== null}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Crops — acreage and unit per existing crop entry */}
      {customer.crops?.length ? (
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400">Crops &amp; Acreage</p>
          <div className="mt-1 space-y-1.5">
            {customer.crops.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 truncate font-semibold text-slate-700">{c.crop.name}</span>
                <Input
                  value={cropDrafts[c.id]?.acreage ?? ''}
                  onChange={(e) =>
                    setCropDrafts((d) => ({ ...d, [c.id]: { ...d[c.id], acreage: e.target.value } }))
                  }
                  inputMode="decimal"
                  aria-label={`${c.crop.name} acreage`}
                  disabled={pending !== null}
                />
                <Input
                  value={cropDrafts[c.id]?.unit ?? ''}
                  onChange={(e) => setCropDrafts((d) => ({ ...d, [c.id]: { ...d[c.id], unit: e.target.value } }))}
                  placeholder="Unit"
                  aria-label={`${c.crop.name} unit`}
                  maxLength={20}
                  disabled={pending !== null}
                />
                <Button size="xs" onClick={() => saveCrop(c.id)} disabled={pending !== null}>
                  {pending === `crop-${c.id}` ? '…' : 'Save'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Phones — the API allows re-designating the primary and adding numbers */}
      <div>
        <p className="text-[10px] font-bold uppercase text-slate-400">Phone Numbers</p>
        <div className="mt-1 space-y-1">
          {customer.phones?.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <span className="font-mono text-slate-700">
                {formatE164(p.phone)}
                {p.isPrimary ? <span className="ml-1.5 text-[10px] font-bold text-emerald-700">Primary</span> : null}
              </span>
              {!p.isPrimary ? (
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={pending !== null}
                  onClick={() =>
                    void run(`phone-${p.id}`, () =>
                      api.patch<CustomerDetail>(`/customers/${customer.id}/phones/${p.id}`, { isPrimary: true }),
                    )
                  }
                >
                  {pending === `phone-${p.id}` ? '…' : 'Make primary'}
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <Input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Add another number"
            aria-label="New phone number"
            maxLength={30}
            disabled={pending !== null}
          />
          <Button
            size="xs"
            disabled={pending !== null || newPhone.trim().length < 6}
            onClick={() =>
              void run('add-phone', () =>
                api.post<CustomerDetail>(`/customers/${customer.id}/phones`, buildAddPhonePayload(newPhone, false)),
              )
            }
          >
            {pending === 'add-phone' ? '…' : 'Add'}
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          An existing number cannot be rewritten — add the correct one, then remove the old one from the full profile.
        </p>
      </div>
    </div>
  );
}
